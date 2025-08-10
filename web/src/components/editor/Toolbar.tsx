import { ActionIcon, Group, Tooltip, SegmentedControl } from '@mantine/core'
import { IconBold, IconItalic, IconUnderline, IconH1, IconH2, IconH3, IconList, IconListNumbers, IconCode, IconCodeCircle2, IconChecklist, IconLink, IconTable, IconMathFunction, IconSquareFunction } from '@tabler/icons-react'
import { Editor } from '@tiptap/react'
import { toggleHeading, insertCodeBlock, insertTable, insertTodo } from './commands'
import { insertInlineMath, insertBlockMath } from './MathExtensions'

export default function Toolbar({ editor, onFullscreen, fullscreen }:{
  editor: Editor, onFullscreen: ()=>void, fullscreen: boolean
}) {
  if (!editor) return null

  return (
    <Group gap="xs" wrap="nowrap" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--mantine-color-body)', padding: 8, borderBottom: '1px solid var(--mantine-color-default-border)' }}>
      <Tooltip label="Bold (⌘/Ctrl+B)"><ActionIcon onClick={()=>editor.chain().focus().toggleBold().run()} variant={editor.isActive('bold')?'filled':'subtle'}><IconBold size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Italic (⌘/Ctrl+I)"><ActionIcon onClick={()=>editor.chain().focus().toggleItalic().run()} variant={editor.isActive('italic')?'filled':'subtle'}><IconItalic size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Underline (⌘/Ctrl+U)"><ActionIcon onClick={()=>editor.chain().focus().toggleUnderline().run()} variant={editor.isActive('underline')?'filled':'subtle'}><IconUnderline size={16}/></ActionIcon></Tooltip>
      <SegmentedControl
        size="xs"
        data={[
          { label: <IconH1 size={14}/>, value:'h1' },
          { label: <IconH2 size={14}/>, value:'h2' },
          { label: <IconH3 size={14}/>, value:'h3' },
        ]}
        value={['h1','h2','h3'].find(v => editor.isActive('heading', { level: Number(v[1]) })) || ''}
        onChange={(v)=>toggleHeading(editor, Number(v[1]) as any)}
      />
      <Tooltip label="Bullet list"><ActionIcon onClick={()=>editor.chain().focus().toggleBulletList().run()} variant={editor.isActive('bulletList')?'filled':'subtle'}><IconList size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Ordered list"><ActionIcon onClick={()=>editor.chain().focus().toggleOrderedList().run()} variant={editor.isActive('orderedList')?'filled':'subtle'}><IconListNumbers size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Task list"><ActionIcon onClick={()=>insertTodo(editor)} variant={editor.isActive('taskList')?'filled':'subtle'}><IconChecklist size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Inline code"><ActionIcon onClick={()=>editor.chain().focus().toggleCode().run()} variant={editor.isActive('code')?'filled':'subtle'}><IconCode size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Code block"><ActionIcon onClick={()=>insertCodeBlock(editor)} variant={editor.isActive('codeBlock')?'filled':'subtle'}><IconCodeCircle2 size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Inline math ($…$)"><ActionIcon onClick={()=>insertInlineMath(editor)}><IconMathFunction size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Block math ($$…$$)"><ActionIcon onClick={()=>insertBlockMath(editor)}><IconSquareFunction size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Table"><ActionIcon onClick={()=>insertTable(editor)} variant={editor.isActive('table')?'filled':'subtle'}><IconTable size={16}/></ActionIcon></Tooltip>
      <Tooltip label="Link (⌘/Ctrl+K)"><ActionIcon onClick={()=>{
        const url = prompt('Enter URL'); if (!url) return
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
      }}><IconLink size={16}/></ActionIcon></Tooltip>
      <div style={{ flex: 1 }} />
      <SegmentedControl size="xs" data={[{label:'Normal',value:'n'},{label:'Full',value:'f'}]} value={fullscreen?'f':'n'} onChange={()=>onFullscreen()} />
    </Group>
  )
}
