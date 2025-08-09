import { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { embed } from '../embeddings.js';

export function registerAdminRoutes(app: FastifyInstance) {
  app.post('/admin/reembed-all', async () => {
    const pages = await query<{ id: string; title: string; content: string }>('select id, title, content from page', []);
    let updated = 0;
    for (const p of pages.rows) {
      const vec = await embed(`${p.title}\n\n${p.content}`);
      if (vec) {
        await query('update page set embedding=$1::vector where id=$2', [vec, p.id]);
        updated++;
      }
    }
    return { updated };
  });
}
