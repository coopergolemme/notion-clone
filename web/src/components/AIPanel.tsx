import { useState } from 'react'
import { api } from '../api'

export default function AIPanel({ pageId }: { pageId: string }) {
  const [related, setRelated] = useState<{id:string; title:string}[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{id:string; title:string}[]>([])
  const [suggested, setSuggested] = useState<string[]>([])
  const [applying, setApplying] = useState(false)

  async function loadRelated() {
    const { data } = await api.post('/ai/related', { pageId, k:5 })
    setRelated(data)
  }

  async function semanticSearch() {
    const { data } = await api.post('/ai/search', { query })
    setResults(data)
  }

  async function suggestTags() {
    const { data } = await api.post('/ai/suggest-tags', { pageId })
    setSuggested(data.tags || [])
  }

  async function applySuggested() {
    if (!suggested.length) return
    setApplying(true)
    try {
      const { data: page } = await api.get(`/pages/${pageId}`)
      const current = Array.isArray(page.tags) ? page.tags : []
      const next = Array.from(new Set([...(current as string[]), ...suggested]))
      await api.put(`/pages/${pageId}`, { tags: next })
    } finally {
      setApplying(false)
    }
  }

  return (
    <aside style={{borderLeft:'1px solid #eee', paddingLeft:12}}>
      <h3>AI</h3>
      <button onClick={loadRelated}>Find Related</button>
      <ul>
        {related.map(r => <li key={r.id}>{r.title}</li>)}
      </ul>

      <div style={{marginTop:16}}>
        <input placeholder="Semantic search..." value={query} onChange={e=>setQuery(e.target.value)} />
        <button onClick={semanticSearch}>Search</button>
        <ul>
          {results.map(r => <li key={r.id}>{r.title}</li>)}
        </ul>
      </div>

      <div style={{marginTop:16}}>
        <button onClick={suggestTags}>Suggest Tags (free)</button>
        {!!suggested.length && (
          <>
            <ul>
              {suggested.map(t => <li key={t}>{t}</li>)}
            </ul>
            <button disabled={applying} onClick={applySuggested}>
              {applying ? 'Applying…' : 'Apply Suggested Tags'}
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
