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
  // RELATED by cosine distance
  app.post('/ai/related', async (req, reply) => {
    const { pageId, k } = (req.body as any) ?? {};
    const limit = Math.min(Number(k || 5), 20);

    const base = await query<{ title: string; content: string; embedding: number[] }>(
      'select title, content, embedding from page where id=$1', [pageId]
    );
    if (!base.rows.length) return [];

    // If no stored embedding yet, compute on the fly (and persist)
    let vec = base.rows[0].embedding as unknown as number[] | null;
    if (!vec || !Array.isArray(vec) || vec.length === 0) {
      const e = await embed(`${base.rows[0].title}\n\n${base.rows[0].content}`);
      if (e && e.length) {
        vec = e;
        await query('update page set embedding = $1::vector where id = $2', [vec, pageId]);
      } else {
        return []; // cannot compute related without an embedding
      }
    }

    const rows = await query<{ id: string; title: string }>(`
      select id, title
      from page
      where id <> $1
      order by embedding <=> $2
      limit $3
    `, [pageId, vec, limit]);

    return rows.rows;
  });

  // Semantic search by query text (cosine), keyword fallback if embedding fails
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
    if (!vec) {
      const rows = await query('select id, title from page where title ilike $1 or content ilike $1 limit 10', [`%${q}%`]);
      return rows.rows;
    }
    const rows = await query<{ id: string; title: string }>(`
      select id, title
      from page
      order by embedding <=> $1
      limit 10
    `, [vec]);
    return rows.rows;
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
