import { useEffect, useState } from 'react'
import { Editor } from '@tiptap/react'
import { ScrollArea, Stack, Text } from '@mantine/core'

type Item = { id: string; level: number; text: string }

export default function Outline({ editor }:{ editor: Editor | null }) {
  const [items, setItems] = useState<Item[]>([])

  useEffect(() => {
    if (!editor) return
    const update = () => {
      const out: Item[] = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const level = (node.attrs as any).level || 1
          const text = node.textContent || 'Untitled'
          const id = `h-${pos}`
          out.push({ id, level, text })
        }
      })
      setItems(out)
    }
    update()
    editor.on('update', update)
    return () => { editor.off('update', update) }
  }, [editor])

  if (!editor) return null
  return (
    <ScrollArea h={300}>
      <Stack gap={4}>
        {items.map(i => (
          <Text
            key={i.id}
            size="sm"
            style={{ marginLeft: (i.level - 1) * 12, cursor: 'pointer' }}
            onClick={() => {
              const pos = Number(i.id.slice(2))
              editor?.commands.focus(pos)
            }}
          >
            {i.text}
          </Text>
        ))}
      </Stack>
    </ScrollArea>
  )
}
