import { useEffect, useState } from 'react'
import { api } from '../api'
import { spotlight } from '@mantine/spotlight'

export function useSpotlightSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{id:string; title:string; snippet:string}[]>([])
  const runSearch = async (q: string) => {
    const params = new URLSearchParams({ q })
    const { data } = await api.get(`/search?${params.toString()}`)
    setResults(data)
  }
  useEffect(()=> {
    const id = setTimeout(()=>{ if (query.trim()) runSearch(query) }, 200)
    return ()=> clearTimeout(id)
  }, [query])

  useEffect(()=> {
    spotlight.registerActions([
      { id: 'new', label: 'New page', onClick: async ()=> { await api.post('/pages', { title: 'Untitled', content: '' }); window.location.reload() } },
      { id: 'graph', label: 'Open graph', onClick: ()=> { window.location.href = '/graph' } },
      ...results.map((r)=>({
        id: r.id,
        label: r.title,
        description: r.snippet,
        onClick: ()=> window.location.href = `/page/${r.id}`
      }))
    ])
    return ()=> spotlight.clearActions()
  }, [results])

  return { query, setQuery, results }
}
