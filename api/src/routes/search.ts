import { FastifyInstance } from 'fastify'
import { query as dbq } from '../db.js'
import { embed } from '../embeddings.js'
import { localGenerate, openaiChat } from '../llm.js'

type PageLite = { id: string; title: string; snippet?: string }

export function registerSearchRoutes(app: FastifyInstance) {
  // Hybrid search: vector + keyword + optional tag filter
  app.get('/search', async (req) => {
    const { q = '', tags = '' } = (req.query as any) || {}
    const tagsArr = String(tags).split(',').map((s)=>s.trim()).filter(Boolean)
    const vec = q ? await embed(String(q)) : null

    // keyword part
    const kw = await dbq<PageLite>(`
      SELECT p.id, p.title, left(p.content, 180) as snippet
      FROM page p
      LEFT JOIN page_tag pt ON pt.page_id = p.id
      LEFT JOIN tag t ON t.id = pt.tag_id
      WHERE ($1 = '' OR to_tsvector('english', p.title || ' ' || p.content) @@ plainto_tsquery('english', $1))
        AND ($2::text[] IS NULL OR $2 = '{}'::text[] OR EXISTS (
              SELECT 1 FROM page_tag pt2 JOIN tag t2 ON t2.id=pt2.tag_id
              WHERE pt2.page_id=p.id AND t2.name = ANY($2)
        ))
      GROUP BY p.id
      LIMIT 30
    `, [q, tagsArr.length ? tagsArr : null])

    // vector part
    let sem: PageLite[] = []
    if (vec) {
      const r = await dbq<PageLite>(`
        SELECT id, title, left(content, 180) as snippet
        FROM page
        ORDER BY embedding <=> $1
        LIMIT 30
      `, [vec])
      sem = r.rows
    }

    // simple rank merge: keyword hits boosted; dedupe by id
    const map = new Map<string, { rec: PageLite; score: number }>()
    kw.rows.forEach((r, i)=> map.set(r.id, { rec: r, score: 1.0 + (30 - i)/100 }))
    sem.forEach((r, i)=>{
      const prev = map.get(r.id)
      const s = 0.8 + (30 - i)/200
      map.set(r.id, { rec: r, score: prev ? prev.score + s : s })
    })

    return Array.from(map.values())
      .sort((a,b)=>b.score - a.score)
      .slice(0, 20)
      .map(x=>x.rec)
  })

  // Multi-doc synthesized answer with caching
  app.post('/ai/answer', async (req) => {
    const { query, k = 5 } = (req.body as any) || {}
    if (!query || typeof query !== 'string') return { answer: '', sources: [] }

    // cache hit?
    const cached = await dbq<{ id: string; answer: string; sources: any }>(
      'SELECT id, answer, sources FROM ai_answer_cache WHERE query=$1 ORDER BY created_at DESC LIMIT 1',
      [query.trim()]
    )
    if (cached.rows.length) {
      return { answer: cached.rows[0].answer, sources: cached.rows[0].sources }
    }

    const vec = await embed(query)
    // fallback to keyword if no vec
    const top = vec ? await dbq<{ id:string; title:string; content:string }>(`
      SELECT id, title, content
      FROM page
      ORDER BY embedding <=> $1
      LIMIT $2
    `, [vec, Math.min(10, Number(k)||5)]) : await dbq(`
      SELECT id, title, content FROM page
      WHERE title ILIKE $1 OR content ILIKE $1
      LIMIT $2
    `, [`%${query}%`, Math.min(10, Number(k)||5)])

    const docs = top.rows
    if (!docs.length) return { answer: 'No relevant pages found.', sources: [] }

    const context = docs.map((d, i)=>`[${i+1}] ${d.title}\n${d.content}\n`).join('\n---\n')
    const sys = 'You are a helpful assistant. Read the provided notes and answer concisely in 4-6 sentences. Cite sources as [#] indices.'
    const user = `Question: ${query}\n\nNotes:\n${context}\n\nAnswer:`

    let answer = await localGenerate(`${sys}\n${user}`)
    if (!answer) answer = (await openaiChat(sys, user)) || 'Unable to generate an answer at this time.'

    const sources = docs.map((d)=>({ id: d.id, title: d.title }))
    await dbq('INSERT INTO ai_answer_cache(query, answer, sources) VALUES ($1,$2,$3)', [query.trim(), answer, JSON.stringify(sources)])
    return { answer, sources }
  })
}
