import { FastifyInstance } from 'fastify';
import fetch from 'node-fetch';
import { query } from '../db.js';
import { embed } from '../embeddings.js';

// Use OpenAI for summarization; the client is initialized once.
async function summarize(text: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('missing api key');
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Summarize the user-provided content into 3-4 sentences.'
        },
        { role: 'user', content: text }
      ]
    })
  });
  const data: any = await resp.json();
  const summary = data?.choices?.[0]?.message?.content?.trim();
  if (!summary) throw new Error('no summary returned');
  return summary;
}

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
      const summary = await summarize(content);
      await query('update page set summary=$1 where id=$2', [summary, pageId]);
      return { summary };
    } catch (e) {
      req.log.error(e);
      return reply.code(500).send({ error: 'summarization failed' });
    }
  });
}
