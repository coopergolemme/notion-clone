import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Group, ActionIcon, Paper } from '@mantine/core'
import { IconBold, IconItalic, IconList, IconListNumbers, IconH2, IconCode } from '@tabler/icons-react'

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
      <Group gap="xs" mb="xs">
        <ActionIcon size="sm" variant="subtle" onClick={() => editor.chain().focus().toggleBold().run()}><IconBold size={16} /></ActionIcon>
        <ActionIcon size="sm" variant="subtle" onClick={() => editor.chain().focus().toggleItalic().run()}><IconItalic size={16} /></ActionIcon>
        <ActionIcon size="sm" variant="subtle" onClick={() => editor.chain().focus().toggleBulletList().run()}><IconList size={16} /></ActionIcon>
        <ActionIcon size="sm" variant="subtle" onClick={() => editor.chain().focus().toggleOrderedList().run()}><IconListNumbers size={16} /></ActionIcon>
        <ActionIcon size="sm" variant="subtle" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><IconH2 size={16} /></ActionIcon>
        <ActionIcon size="sm" variant="subtle" onClick={() => editor.chain().focus().toggleCodeBlock().run()}><IconCode size={16} /></ActionIcon>
      </Group>
      <Paper withBorder radius="md" p="sm">
        <EditorContent editor={editor} />
      </Paper>
    </div>
  )
}
