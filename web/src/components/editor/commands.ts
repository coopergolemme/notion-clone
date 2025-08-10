import { Editor } from '@tiptap/react'

export function toggleHeading(editor: Editor, level: 1|2|3) {
  editor.chain().focus().toggleHeading({ level }).run()
}

export function insertCodeBlock(editor: Editor) {
  editor.chain().focus().toggleCodeBlock().run()
}

export function insertTable(editor: Editor) {
  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

export function insertTodo(editor: Editor) {
  editor.chain().focus().toggleTaskList().run()
}
