import { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { embed } from '../embeddings.js';
import { pipeline } from '@xenova/transformers';

// Load summarization model once at startup
const summarizer = await pipeline('summarization', 'facebook/bart-large-cnn');

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
    const { query: q } = (req.body as any) ?? {};
    if (!q || typeof q !== 'string') return [];
    const vec = await embed(q);
    if (!vec) {
      const rows = await query('select id, title from page where title ilike $1 or content ilike $1 limit 10', [`%${q}%`]);
      return rows.rows;
    }
    const rows = await query(`
      select id, title
      from page
      order by embedding <#> $1
      limit 10
    `, [vec]);
    return rows.rows;
  });

  app.post('/ai/summarize', async (req, reply) => {
    const { pageId } = (req.body as any) ?? {};
    if (!pageId) return reply.code(400).send({ error: 'pageId required' });

    const { rows } = await query<{ content: string }>('select content from page where id=$1', [pageId]);
    const content = rows[0]?.content;
    if (!content) return reply.code(404).send({ error: 'not found' });

    try {
      const result = await summarizer(content, { min_length: 30, max_length: 120 });
      const summary = Array.isArray(result) ? result[0].summary_text : (result as any).summary_text;
      await query('update page set summary=$1 where id=$2', [summary, pageId]);
      return { summary };
    } catch (e) {
      req.log.error(e);
      return reply.code(500).send({ error: 'summarization failed' });
    }
  });
}
