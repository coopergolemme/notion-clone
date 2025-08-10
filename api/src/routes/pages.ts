import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db.js';
import { embed } from '../embeddings.js';
import { toPgVector } from '../pgvector.js';
import { extractWikiLinks, normTitle } from '../utils/links.js';
import { snapshotPageVersion } from '../utils/history.js';

const PageInput = z.object({
  title: z.string().min(1),
  // Allow creating pages with empty content so that clients can
  // initialize a page before any text is added. Previously this schema
  // required at least one character which caused a 400 error when the
  // web app attempted to create an "Untitled" page with an empty body.
  content: z.string(),
  tags: z.array(z.string()).optional(),
  format: z.enum(['latex', 'rich']).optional()
});

async function refreshPageLinks(pageId: string) {
  // 1) get this page's title & content
  const { rows: pRows } = await query<{ title: string; content: string }>(
    'select title, content from page where id=$1', [pageId]
  );
  if (!pRows.length) return;

  const titles = extractWikiLinks(pRows[0].content).map(normTitle);
  // short-circuit: clear links if none
  await query('delete from page_link where from_page_id=$1', [pageId]);
  if (titles.length === 0) return;

  // 2) resolve titles -> page ids (exact case-insensitive title match)
  // Avoid self-links
  const { rows: allTargets } = await query<{ id: string; title: string }>(
    `select id, title from page where id <> $1`,
    [pageId]
  );
  const byKey = new Map<string, string>(); // normTitle => id
  for (const r of allTargets) byKey.set(normTitle(r.title), r.id);

  const resolved: string[] = [];
  for (const t of titles) {
    const toId = byKey.get(t);
    if (toId) resolved.push(toId);
  }
  if (resolved.length === 0) return;

  // 3) insert links
  const values = resolved.map((toId, i) => `($1, $${i+2})`).join(',');
  await query(
    `insert into page_link(from_page_id, to_page_id) values ${values}
     on conflict do nothing`,
    [pageId, ...resolved]
  );
}

export function registerPageRoutes(app: FastifyInstance) {
  app.post('/pages', async (req, reply) => {
    const body = PageInput.parse(req.body);
    const { title, content, tags = [], format } = body;

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
      format
        ? 'insert into page(title, content, format) values($1, $2, $3) returning id'
        : 'insert into page(title, content) values($1, $2) returning id',
      format ? [title, content, format] : [title, content]
    );
    const pageId = pRows[0].id;

    // page_tag
    for (const id of tagIds) {
      await query('insert into page_tag(page_id, tag_id) values($1, $2) on conflict do nothing', [pageId, id]);
    }

    // embed (best-effort)
    try {
      const vec = await embed(`${title}\n\n${content}`);
      const pgVec = toPgVector(vec);
      if (pgVec) {
        await query('update page set embedding = $1::vector where id=$2', [pgVec, pageId]);
      }
    } catch {}

    await refreshPageLinks(pageId);
    await snapshotPageVersion(pageId, (req as any)?.user?.id);

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
    const page = await query('select id, title, content, format, created_at, updated_at from page where id=$1', [id]);
    if (!page.rows.length) return reply.code(404).send({ error: 'not found' });
    const tags = await query('select t.name from tag t join page_tag pt on pt.tag_id=t.id where pt.page_id=$1', [id]);
    return { ...page.rows[0], tags: tags.rows.map(r => r.name) };
  });

  app.put('/pages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = PageInput.partial().parse(req.body);
    let { title, content, tags, format } = body;

    if (title) await query('update page set title=$1, updated_at=now() where id=$2', [title, id]);
    if (content) await query('update page set content=$1, updated_at=now() where id=$2', [content, id]);
    if (format) await query('update page set format=$1, updated_at=now() where id=$2', [format, id]);

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
      const pgVec = toPgVector(vec);
      if (pgVec) await query('update page set embedding=$1::vector where id=$2', [pgVec, id]);
    }

    await refreshPageLinks(id);

    if (title || content || format || tags) {
      await snapshotPageVersion(id, (req as any)?.user?.id);
    }

    return { ok: true };
  });

  app.delete('/pages/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await query('delete from page where id=$1', [id]);
    return { ok: true };
  });
}
