import { FastifyInstance } from 'fastify';
import { query } from '../db.js';

export function registerHistoryRoutes(app: FastifyInstance) {
  // List recent versions
  app.get('/pages/:id/history', async (req) => {
    const { id } = req.params as { id: string };
    const { rows } = await query(
      `
      SELECT id, created_at, created_by, title, left(content, 300) AS snippet, format, array_length(tags,1) AS tag_count
      FROM page_version
      WHERE page_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `,
      [id]
    );
    return rows;
  });

  // Fetch a specific version
  app.get('/pages/:id/history/:versionId', async (req, reply) => {
    const { id, versionId } = req.params as { id: string; versionId: string };
    const { rows } = await query(
      `
      SELECT id, page_id, title, content, format, tags, created_at, created_by
      FROM page_version
      WHERE page_id=$1 AND id=$2
      LIMIT 1
    `,
      [id, versionId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not found' });
    return rows[0];
  });

  // Restore a version (overwrites current page fields)
  app.post('/pages/:id/history/:versionId/restore', async (req, reply) => {
    const { id, versionId } = req.params as { id: string; versionId: string };
    const { rows } = await query(
      `
      SELECT title, content, format, tags
      FROM page_version WHERE page_id=$1 AND id=$2 LIMIT 1
    `,
      [id, versionId]
    );
    if (!rows.length) return reply.code(404).send({ error: 'not found' });
    const v = rows[0];
    await query(
      `
      UPDATE page SET title=$1, content=$2, format=$3, tags=$4, updated_at=now() WHERE id=$5
    `,
      [v.title, v.content, v.format, v.tags, id]
    );
    // snapshot post-restore
    await query(
      `
      INSERT INTO page_version(page_id, title, content, format, tags, created_by)
      VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [id, v.title, v.content, v.format, v.tags, (req as any)?.user?.id || null]
    );
    return { ok: true };
  });
}
