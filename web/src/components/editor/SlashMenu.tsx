import { FloatingMenu, Editor } from '@tiptap/react'
import { Card, Stack, Text } from '@mantine/core'
import { insertInlineMath, insertBlockMath } from './MathExtensions'

const items = [
  { key: 'h1', label:'Heading 1', run:(e:Editor)=>e.chain().focus().setHeading({level:1}).run() },
  { key: 'h2', label:'Heading 2', run:(e)=>e.chain().focus().setHeading({level:2}).run() },
  { key: 'h3', label:'Heading 3', run:(e)=>e.chain().focus().setHeading({level:3}).run() },
  { key: 'ul', label:'Bullet list', run:(e)=>e.chain().focus().toggleBulletList().run() },
  { key: 'ol', label:'Numbered list', run:(e)=>e.chain().focus().toggleOrderedList().run() },
  { key: 'todo', label:'Task list', run:(e)=>e.chain().focus().toggleTaskList().run() },
  { key: 'code', label:'Code block', run:(e)=>e.chain().focus().toggleCodeBlock().run() },
  { key: 'table', label:'Table', run:(e)=>e.chain().focus().insertTable({rows:3, cols:3, withHeaderRow:true}).run() },
  { key: 'image', label:'Image', run:(e)=>{ const url=prompt('Image URL'); if(url) e.chain().focus().setImage({src:url}).run() } },
  { key: 'math-inline', label:'Inline math ($…$)', run:(e)=>insertInlineMath(e) },
  { key: 'math-block',  label:'Block math ($$…$$)', run:(e)=>insertBlockMath(e) },
]

export default function SlashMenu({ editor }:{ editor: Editor }) {
  return (
    <FloatingMenu editor={editor} tippyOptions={{ duration: 150 }} shouldShow={({ editor }) => {
      const { from, to } = editor.state.selection
      const text = editor.state.doc.textBetween(from - 1, to, '\n', '\0')
      return text.endsWith('/')
    }}>
      <Card withBorder shadow="sm" p="xs">
        <Stack gap={6}>
          {items.map(it => (
            <Text key={it.key} onMouseDown={(e)=>{ e.preventDefault(); it.run(editor); }} style={{ cursor:'pointer' }}>
              {it.label}
            </Text>
          ))}
        </Stack>
      </Card>
    </FloatingMenu>
  )
}
