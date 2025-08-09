import { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { embed } from '../embeddings.js';

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
    const { query: q } = (req.body as any) ?? {};
    if (!q || typeof q !== 'string') return [];
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
}
