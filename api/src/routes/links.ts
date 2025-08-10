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
    const pages = await query<{
      id: string;
      title: string;
      content: string;
      created_at: Date;
      updated_at: Date;
    }>('select id, title, content, created_at, updated_at from page', []);

    const links = await query<{ from_page_id: string; to_page_id: string }>(
      'select from_page_id, to_page_id from page_link', []
    );

    function getSnippet(text: string) {
      const sentences = text.match(/[^.!?]+[.!?]/g) || [];
      return sentences.slice(0, 2).join(' ').trim();
    }

    function formatDate(d: Date) {
      return d.toISOString().split('T')[0];
    }

    return {
      nodes: pages.rows.map(p => ({
        id: p.id,
        label: p.title,
        title: `${getSnippet(p.content)}<br/><br/>Created: ${formatDate(p.created_at)}<br/>Updated: ${formatDate(p.updated_at)}`,
      })),
      edges: links.rows.map(e => ({ from: e.from_page_id, to: e.to_page_id })),
    };
  });
}
