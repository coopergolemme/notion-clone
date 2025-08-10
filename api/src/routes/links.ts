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

  // Graph data (nodes + edges)
  app.get('/graph', async (req) => {
    // Optional query filters (server-side prefilter)
    const { tag, from, to, q } = (req.query as any) || {};

    // base pages
    const pages = await query<{
      id: string; title: string; tags: string[]; updated_at: string; content: string;
    }>(`
    SELECT id, title, COALESCE(tags,'{}') AS tags, updated_at, content
    FROM page
    WHERE ($1::text IS NULL OR $1 = '' OR EXISTS (
      SELECT 1 FROM unnest(tags) t WHERE trim(lower(t)) = trim(lower($1))
    ))
      AND ($2::timestamptz IS NULL OR updated_at >= $2::timestamptz)
      AND ($3::timestamptz IS NULL OR updated_at <= $3::timestamptz)
      AND ($4::text IS NULL OR $4 = '' OR (title ILIKE '%'||$4||'%' OR content ILIKE '%'||$4||'%'))
  `, [tag || null, from || null, to || null, q || null]);

    // edges with weight = number of mentions from from->to in current content
    const links = await query<{ from_page_id: string; to_page_id: string; weight: number }>(`
    SELECT pl.from_page_id, pl.to_page_id, COUNT(*)::int AS weight
    FROM page_link pl
    GROUP BY pl.from_page_id, pl.to_page_id
  `, []);

    // backlink counts (degree-in)
    const degIn = await query<{ id: string; cnt: number }>(`
    SELECT to_page_id AS id, COUNT(*)::int AS cnt
    FROM page_link GROUP BY to_page_id
  `, []);

    const degMap = new Map(degIn.rows.map(r => [r.id, r.cnt]));

    // word count for optional display/weighting (quick estimate)
    const nodes = pages.rows.map(p => {
      const words = (p.content || '').trim().split(/\s+/).filter(Boolean).length;
      return {
        id: p.id,
        label: p.title,
        tags: p.tags,
        updated_at: p.updated_at,
        word_count: words,
        backlinks: degMap.get(p.id) || 0,
      };
    });

    const nodeSet = new Set(nodes.map(n => n.id));
    const edges = links.rows
      .filter(e => nodeSet.has(e.from_page_id) && nodeSet.has(e.to_page_id))
      .map(e => ({ from: e.from_page_id, to: e.to_page_id, weight: e.weight }));

    return { nodes, edges };
  });
}
