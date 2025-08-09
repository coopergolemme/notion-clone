import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import AIPanel from '../components/AIPanel'

type Page = { id: string; title: string; content: string; tags: string[] }

function renderWikiLinks(text: string, resolver: (title: string) => string | undefined) {
  const re = /\[\[([^\]]+)\]\]/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const [full, title] = m;
    const start = m.index;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const href = resolver(title.trim());
    parts.push(
      href ? <a key={start} href={href}>{title}</a> : <span key={start}>[[{title}]]</span>
    );
    lastIndex = start + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function PageView() {
  const { id } = useParams()
  const [page, setPage] = useState<Page | null>(null)
  const [tagsText, setTagsText] = useState('')
  const [links, setLinks] = useState<{id:string; title:string}[]>([])

  async function load() {
    const { data } = await api.get(`/pages/${id}`)
    setPage(data)
  }
  useEffect(() => { load() }, [id])

  async function loadLinks() {
    const { data } = await api.get(`/pages/${id}/links`)
    setLinks(data)
  }
  useEffect(() => { if (id) loadLinks() }, [id])

  function resolveHref(title: string) {
    const t = title.trim().toLowerCase()
    const match = links.find(l => l.title.trim().toLowerCase() === t)
    return match ? `/page/${match.id}` : undefined
  }

  useEffect(() => {
    if (page?.tags) setTagsText(page.tags.join(', '))
  }, [page])

  async function save(updates: Partial<Page>) {
    await api.put(`/pages/${id}`, updates)
    await load()
  }

  function parseTags(input: string): string[] {
    return Array.from(
      new Set(
        input
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter(Boolean)
      )
    )
  }

  async function saveTags(input: string) {
    const tags = parseTags(input)
    await save({ tags })
  }

  if (!page) return <div>Loading...</div>
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 320px', gap:16}}>
      <div>
        <input value={page.title} onChange={e=>save({ title: e.target.value })} style={{fontSize:18, width:'100%'}}/>
        <textarea
          value={page.content}
          onChange={e=>save({ content: e.target.value })}
          rows={20}
          style={{width:'100%', marginTop:8}}
        />
        <div style={{marginTop:8, padding:8, background:'#fafafa', border:'1px solid #eee'}}>
          <div style={{fontWeight:600, marginBottom:4}}>Preview with links</div>
          <div>{renderWikiLinks(page.content, resolveHref)}</div>
        </div>
        <div style={{marginTop:8}}>
          <label style={{display:'block', fontWeight:600, marginBottom:4}}>Tags (comma-separated)</label>
          <input
            value={tagsText}
            onChange={e => setTagsText(e.target.value)}
            onBlur={e => saveTags(e.target.value)}
            placeholder='ai, research, notes'
            style={{width:'100%'}}
          />
        </div>
      </div>
      <AIPanel pageId={page.id} />
    </div>
  )
}

