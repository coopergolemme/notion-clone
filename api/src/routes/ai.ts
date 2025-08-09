import { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { embed } from '../embeddings.js';
import { z } from 'zod';

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeSnippet(content: string, q: string) {
  const terms = q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const paragraphs = content.split(/\n+/);
  let best = '';
  let bestScore = -1;
  for (const p of paragraphs) {
    const lower = p.toLowerCase();
    let score = 0;
    for (const t of terms) {
      const re = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'g');
      const matches = lower.match(re);
      if (matches) score += matches.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  if (!best) best = paragraphs[0] || '';
  let snippet = best;
  for (const t of terms) {
    const re = new RegExp(`\\b(${escapeRegExp(t)})\\b`, 'gi');
    snippet = snippet.replace(re, '<mark>$1</mark>');
  }
  return snippet;
}

export function registerAIRoutes(app: FastifyInstance) {
  app.post('/ai/related', async (req, reply) => {
    const { pageId, k } = (req.body as any) ?? {};
    const limit = Math.min(Number(k || 5), 20);
    const page = await query<{ embedding: number[] }>('select embedding from page where id=$1', [pageId]);
    const vec = page.rows[0]?.embedding;
    if (!vec) return [];
    const rows = await query(
      `select id, title
       from page
       where id <> $1
       order by embedding <=> $2
       limit $3`,
      [pageId, vec, limit]
    );
    return rows.rows;
  });

  app.post('/ai/search', async (req, reply) => {
    const SearchInput = z.object({
      query: z.string().min(1),
      tags: z.array(z.string()).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      authorId: z.string().optional(),
    });
    const { query: q, tags, dateFrom, dateTo, authorId } = SearchInput.parse(req.body ?? {});

    const vec = await embed(q);

    let rows;
    if (vec) {
      const sql = `
        with ranked as (
          select p.id,
                 p.title,
                 p.content,
                 p.created_at,
                 coalesce(array_agg(distinct t.name) filter (where t.name is not null), '{}') as tags,
                 1 - (p.embedding <=> $1) as vector_score,
                 ts_rank_cd(to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.content,'')), plainto_tsquery('english', $2)) as text_score
          from page p
          left join page_tag pt on pt.page_id = p.id
          left join tag t on t.id = pt.tag_id
          where ($3::text[] is null or exists (
                   select 1 from page_tag pt2
                   join tag t2 on t2.id = pt2.tag_id
                   where pt2.page_id = p.id and t2.name = any($3)
                 ))
            and ($4::timestamptz is null or p.created_at >= $4)
            and ($5::timestamptz is null or p.created_at <= $5)
            and ($6::text is null or p.author_id = $6)
          group by p.id, p.embedding, p.title, p.content, p.created_at
          order by p.embedding <=> $1
          limit 50
        )
        select id, title, content, created_at, tags,
               (0.6 * vector_score + 0.4 * text_score) as score
        from ranked
        order by score desc
        limit 20`;
      rows = await query(sql, [vec, q, tags && tags.length ? tags : null, dateFrom || null, dateTo || null, authorId || null]);
    } else {
      const sql = `
        with ranked as (
          select p.id,
                 p.title,
                 p.content,
                 p.created_at,
                 coalesce(array_agg(distinct t.name) filter (where t.name is not null), '{}') as tags,
                 ts_rank_cd(to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.content,'')), plainto_tsquery('english', $1)) as text_score
          from page p
          left join page_tag pt on pt.page_id = p.id
          left join tag t on t.id = pt.tag_id
          where ($2::text[] is null or exists (
                   select 1 from page_tag pt2
                   join tag t2 on t2.id = pt2.tag_id
                   where pt2.page_id = p.id and t2.name = any($2)
                 ))
            and ($3::timestamptz is null or p.created_at >= $3)
            and ($4::timestamptz is null or p.created_at <= $4)
            and ($5::text is null or p.author_id = $5)
          group by p.id, p.title, p.content, p.created_at
        )
        select id, title, content, created_at, tags,
               text_score as score
        from ranked
        order by score desc
        limit 20`;
      rows = await query(sql, [q, tags && tags.length ? tags : null, dateFrom || null, dateTo || null, authorId || null]);
    }

    return rows.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      snippet: makeSnippet(r.content, q),
      tags: r.tags || [],
      createdAt: r.created_at,
      score: Number(r.score),
    }));
  });
}
