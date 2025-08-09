import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import 'katex/dist/katex.min.css'

// Minimal TipTap setup; we’ll store HTML in page.content for MVP
export default function RichEditor({ value, onChange }:{
  value: string
  onChange: (html: string) => void
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    // external updates
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false)
    }
  }, [value])

  if (!editor) return <div>Loading editor…</div>
  return (
    <div>
      <div style={{display:'flex', gap:8, marginBottom:8}}>
        <button onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button onClick={() => editor.chain().focus().toggleCodeBlock().run()}>Code</button>
      </div>
      <div style={{border:'1px solid #ddd', borderRadius:6, padding:8}}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
