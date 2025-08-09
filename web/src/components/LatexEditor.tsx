import { useEffect, useMemo, useState } from 'react'
import katex from 'katex'
import { Text, Paper, Textarea } from '@mantine/core'

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
        <Text fw={600} mb={6}>LaTeX Source</Text>
        <Textarea
          value={src}
          onChange={e => { setSrc(e.currentTarget.value); onChange(e.currentTarget.value) }}
          rows={22}
          autosize
          minRows={22}
          styles={{ textarea: { fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace' } }}
          placeholder={'Type LaTeX here. Use $...$ for inline and $$...$$ for block math.\nExample: $$E=mc^2$$'}
        />
      </div>
      <div>
        <Text fw={600} mb={6}>Preview</Text>
        <Paper withBorder radius="md" p="md" style={{ minHeight:200, overflowX:'auto' }}
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      </div>
    </div>
  )
}
