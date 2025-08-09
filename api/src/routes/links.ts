import { FastifyInstance } from 'fastify';
import { query } from '../db.js';

export function registerLinkRoutes(app: FastifyInstance) {
  // Outbound links
  app.get('/pages/:id/links', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows } = await query<{ id: string; title: string }>(`
      select p.id, p.title
      from page_link pl
      join page p on p.id = pl.to_page_id
      where pl.from_page_id = $1
      order by p.title asc
    `, [id]);
    return rows;
  });

  // Backlinks (inbound)
  app.get('/pages/:id/backlinks', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows } = await query<{ id: string; title: string }>(`
      select p.id, p.title
      from page_link pl
      join page p on p.id = pl.from_page_id
      where pl.to_page_id = $1
      order by p.title asc
    `, [id]);
    return rows;
  });

  // Optional: graph data (nodes + edges)
  app.get('/graph', async () => {
    const pages = await query<{ id: string; title: string }>('select id, title from page', []);
    const links = await query<{ from_page_id: string; to_page_id: string }>(
      'select from_page_id, to_page_id from page_link', []
    );
    return {
      nodes: pages.rows.map(p => ({ id: p.id, label: p.title })),
      edges: links.rows.map(e => ({ from: e.from_page_id, to: e.to_page_id })),
    };
  });
}
