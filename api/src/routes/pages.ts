import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { embed } from '../embeddings.js';

const PageInput = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).optional()
});

export function registerPageRoutes(app: FastifyInstance) {
  app.post('/pages', async (req, reply) => {
    const body = PageInput.parse(req.body);
    const { title, content, tags = [] } = body;

    // upsert tags
    const tagIds: number[] = [];
    for (const t of tags) {
      const { rows } = await query<{ id: number }>(
        'insert into tag(name) values($1) on conflict(name) do update set name=excluded.name returning id',
        [t.trim().toLowerCase()]
      );
      tagIds.push(rows[0].id);
    }

    // insert page
    const { rows: pRows } = await query<{ id: string }>(
      'insert into page(title, content) values($1, $2) returning id',
      [title, content]
    );
    const pageId = pRows[0].id;

    // page_tag
    for (const id of tagIds) {
      await query('insert into page_tag(page_id, tag_id) values($1, $2) on conflict do nothing', [pageId, id]);
    }

    // embed (best-effort)
    try {
      const vec = await embed(`${title}\n\n${content}`);
      if (vec) {
        await query('update page set embedding = $1::vector where id=$2', [vec, pageId]);
      }
    } catch {}

    reply.code(201).send({ id: pageId });
  });

  app.get('/pages', async (req, reply) => {
    const rows = await query(`
      select p.id, p.title, left(p.content, 200) as snippet, p.created_at, 
             coalesce(json_agg(t.name) filter (where t.name is not null), '[]') as tags
      from page p
      left join page_tag pt on pt.page_id = p.id
      left join tag t on t.id = pt.tag_id
      group by p.id
      order by p.created_at desc
      limit 100
    `);
    return rows.rows;
  });

  app.get('/pages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const page = await query('select id, title, content, created_at, updated_at from page where id=$1', [id]);
    if (!page.rows.length) return reply.code(404).send({ error: 'not found' });
    const tags = await query('select t.name from tag t join page_tag pt on pt.tag_id=t.id where pt.page_id=$1', [id]);
    return { ...page.rows[0], tags: tags.rows.map(r => r.name) };
  });

  app.put('/pages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = PageInput.partial().parse(req.body);
    let { title, content, tags } = body;

    if (title) await query('update page set title=$1, updated_at=now() where id=$2', [title, id]);
    if (content) await query('update page set content=$1, updated_at=now() where id=$2', [content, id]);

    if (tags) {
      await query('delete from page_tag where page_id=$1', [id]);
      for (const t of tags) {
        const { rows } = await query<{ id: number }>(
          'insert into tag(name) values($1) on conflict(name) do update set name=excluded.name returning id',
          [t.trim().toLowerCase()]
        );
        await query('insert into page_tag(page_id, tag_id) values($1, $2) on conflict do nothing', [id, rows[0].id]);
      }
    }

    // re-embed if updated
    if (title || content) {
      const row = await query<{ title: string, content: string }>('select title, content from page where id=$1', [id]);
      const vec = await embed(`${row.rows[0].title}\n\n${row.rows[0].content}`);
      if (vec) await query('update page set embedding=$1::vector where id=$2', [vec, id]);
    }

    return { ok: true };
  });

  app.delete('/pages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await query('delete from page where id=$1', [id]);
    return { ok: true };
  });
}
