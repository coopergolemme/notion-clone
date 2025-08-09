import { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { embed } from '../embeddings.js';

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
}
