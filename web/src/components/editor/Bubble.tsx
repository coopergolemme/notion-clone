import { BubbleMenu, Editor } from '@tiptap/react'
import { ActionIcon, Group, Tooltip } from '@mantine/core'
import { IconBold, IconItalic, IconUnderline, IconLink } from '@tabler/icons-react'

export default function Bubble({ editor }:{ editor: Editor }) {
  if (!editor) return null
  return (
    <BubbleMenu editor={editor} tippyOptions={{ duration: 150 }}>
      <Group gap={4} p={4} style={{ background: 'var(--mantine-color-default)', borderRadius: 8 }}>
        <Tooltip label="Bold"><ActionIcon size="sm" onClick={()=>editor.chain().focus().toggleBold().run()}><IconBold size={14}/></ActionIcon></Tooltip>
        <Tooltip label="Italic"><ActionIcon size="sm" onClick={()=>editor.chain().focus().toggleItalic().run()}><IconItalic size={14}/></ActionIcon></Tooltip>
        <Tooltip label="Underline"><ActionIcon size="sm" onClick={()=>editor.chain().focus().toggleUnderline().run()}><IconUnderline size={14}/></ActionIcon></Tooltip>
        <Tooltip label="Link"><ActionIcon size="sm" onClick={()=>{
          const url = prompt('Enter URL'); if (!url) return
          editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }}><IconLink size={14}/></ActionIcon></Tooltip>
      </Group>
    </BubbleMenu>
  )
}
