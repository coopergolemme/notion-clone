import keywordExtractor from 'keyword-extractor';
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

function toKebab(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function registerAIRoutes(app: FastifyInstance) {
  app.post('/ai/related', async (req, reply) => {
    const { pageId, k } = (req.body as any) ?? {};
    const limit = Math.min(Number(k || 5), 20);
    const page = await query<{ embedding: number[] }>('select embedding from page where id=$1', [pageId]);
    const vec = page.rows[0]?.embedding;
    if (!vec) return [];
    const rows = await query(`
      select id, title 
      from page 
      where id <> $1 
      order by embedding <#> $2 
      limit $3
    `, [pageId, vec, limit]);
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
        with search as (
          select p.id, p.title, p.content, p.created_at,
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
          group by p.id
        )
        select id, title, content, created_at, tags,
               (0.6 * vector_score + 0.4 * text_score) as score
        from search
        order by score desc
        limit 20
      `;
      rows = await query(sql, [vec, q, tags && tags.length ? tags : null, dateFrom || null, dateTo || null, authorId || null]);
    } else {
      const sql = `
        with search as (
          select p.id, p.title, p.content, p.created_at,
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
          group by p.id
        )
        select id, title, content, created_at, tags,
               text_score as score
        from search
        order by score desc
        limit 20
      `;
      rows = await query(sql, [q, tags && tags.length ? tags : null, dateFrom || null, dateTo || null, authorId || null]);
    }

    return rows.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      snippet: makeSnippet(r.content, q),
      tags: r.tags || [],
      createdAt: r.created_at,
      score: r.score,
    }));
  });

  app.post('/ai/suggest-tags', async (req, reply) => {
    const { pageId } = (req.body as any) ?? {};
    if (!pageId) return reply.code(400).send({ error: 'pageId required' });

    // fetch page content
    const res = await query<{ title: string; content: string }>(
      'select title, content from page where id=$1',
      [pageId]
    );
    if (!res.rows.length) return reply.code(404).send({ error: 'page not found' });

    const { title, content } = res.rows[0];
    const text = `${title}\n\n${content}`;

    // extract keywords using keyword-extractor
    const keywords = keywordExtractor.extract(text, {
      language: 'english',
      remove_digits: true,
      return_changed_case: true,
      remove_duplicates: false
    });

    // rank by frequency, filter out very short ones
    const counts = new Map<string, number>();
    for (const k of keywords) {
      if (k.length < 3) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    // sort by count desc, then length asc (shorter tags nicer)
    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
      .map(([k]) => k);

    // normalize to nice tag slugs/labels, dedupe, pick top 3–5
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const raw of ranked) {
      const clean = toKebab(raw).replace(/^-+|-+$/g, '');
      if (!clean || clean.length < 3) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      suggestions.push(clean);
      if (suggestions.length >= 5) break;
    }

    // if we didn’t find enough, fall back to title tokens
    if (suggestions.length < 3) {
      const extra = title.split(/\W+/).map(toKebab).filter(Boolean);
      for (const e of extra) {
        if (!seen.has(e)) {
          seen.add(e);
          suggestions.push(e);
          if (suggestions.length >= 5) break;
        }
      }
    }

    return { tags: suggestions };
  });
}
