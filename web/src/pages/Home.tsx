import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

type Row = { id: string; title: string; snippet: string; tags: string[] }

export default function Home() {
  const [rows, setRows] = useState<Row[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')

  async function load() {
    const { data } = await api.get<Row[]>('/pages')
    setRows(data)
  }
  useEffect(() => { load() }, [])

  async function create() {
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
    await api.post('/pages', { title, content, tags: tagList })
    setTitle(''); setContent(''); setTags('')
    load()
  }

  return (
    <div>
      <div style={{display:'grid', gap:8, marginBottom:16}}>
        <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
        <textarea placeholder="Content (markdown ok)" rows={5} value={content} onChange={e=>setContent(e.target.value)}/>
        <input placeholder="Tags (comma separated)" value={tags} onChange={e=>setTags(e.target.value)} />
        <button onClick={create}>Create Page</button>
      </div>

      <table width="100%" cellPadding="8" style={{borderCollapse:'collapse'}}>
        <thead><tr><th align="left">Title</th><th align="left">Snippet</th><th>Tags</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{borderTop:'1px solid #ddd'}}>
              <td><Link to={`/page/${r.id}`}>{r.title}</Link></td>
              <td>{r.snippet}</td>
              <td>{r.tags?.join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
