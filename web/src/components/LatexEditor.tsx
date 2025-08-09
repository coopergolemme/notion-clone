import { useEffect, useMemo, useState } from 'react'
import 'katex/dist/katex.min.css'
import katex from 'katex'

function renderLatex(src: string): string {
  // Render $$...$$ block then $...$ inline (mirrors server util)
  let html = src

  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try { return `<div class="math-block">${katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })}</div>` }
    catch { return `<pre class="math-error">$${expr}$$</pre>` }
  })

  html = html.replace(/(^|[^$])\$([^\n$]+?)\$/g, (m, pre, expr) => {
    try { return `${pre}<span class="math-inline">${katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false })}</span>` }
    catch { return `${pre}<code>$${expr}$</code>` }
  })

  return html
}

export default function LatexEditor({ value, onChange }:{
  value: string
  onChange: (src: string) => void
}) {
  const [src, setSrc] = useState(value || '')

  useEffect(() => { if (value !== src) setSrc(value || '') }, [value])

  const preview = useMemo(() => renderLatex(src), [src])

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
      <div>
        <div style={{fontWeight:600, marginBottom:6}}>LaTeX Source</div>
        <textarea
          value={src}
          onChange={e => { setSrc(e.target.value); onChange(e.target.value) }}
          rows={22}
          style={{width:'100%', fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', border:'1px solid #ddd', borderRadius:6, padding:8}}
          placeholder={'Type LaTeX here. Use $...$ for inline and $$...$$ for block math.\nExample: $$E=mc^2$$'}
        />
      </div>
      <div>
        <div style={{fontWeight:600, marginBottom:6}}>Preview</div>
        <div
          style={{border:'1px solid #ddd', borderRadius:6, padding:12, minHeight:200, overflowX:'auto'}}
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      </div>
    </div>
  )
}
