import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import AIPanel from '../components/AIPanel'

type Page = { id: string; title: string; content: string; tags: string[] }

export default function PageView() {
  const { id } = useParams()
  const [page, setPage] = useState<Page | null>(null)

  async function load() {
    const { data } = await api.get(`/pages/${id}`)
    setPage(data)
  }
  useEffect(() => { load() }, [id])

  async function save(updates: Partial<Page>) {
    await api.put(`/pages/${id}`, updates)
    await load()
  }

  if (!page) return <div>Loading...</div>
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:16}}>
      <div>
        <input value={page.title} onChange={e=>save({ title: e.target.value })} style={{fontSize:18, width:'100%'}}/>
        <textarea value={page.content} onChange={e=>save({ content: e.target.value })} rows={20} style={{width:'100%', marginTop:8}}/>
      </div>
      <AIPanel pageId={page.id} />
    </div>
  )
}
