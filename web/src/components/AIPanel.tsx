import { useState } from 'react'
import { api } from '../api'

export default function AIPanel({ pageId }: { pageId: string }) {
  const [related, setRelated] = useState<{id:string; title:string}[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{id:string; title:string}[]>([])

  async function loadRelated() {
    const { data } = await api.post('/ai/related', { pageId, k:5 })
    setRelated(data)
  }

  async function semanticSearch() {
    const { data } = await api.post('/ai/search', { query })
    setResults(data)
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
    </aside>
  )
}
