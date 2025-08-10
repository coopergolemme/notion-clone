import { Node, mergeAttributes } from '@tiptap/core'
import { mathPlugin, mathInline, mathDisplay, REGEX_INLINE, REGEX_BLOCK } from 'prosemirror-math'
import katex from 'katex'

// Inline math: $ ... $
export const MathInline = Node.create({
  name: 'math_inline',
  group: 'inline',
  atom: true,
  inline: true,
  selectable: true,
  addAttributes() {
    return { latex: { default: '' } }
  },
  parseHTML() {
    return [
      { tag: 'span.math-inline', getAttrs: el => ({ latex: (el as HTMLElement).getAttribute('data-latex') || '' }) },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const tex = HTMLAttributes.latex ?? ''
    // store latex in attribute; TipTap will render the view with KaTeX
    return ['span', mergeAttributes({ class: 'math-inline', 'data-latex': tex }), tex]
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'math-inline'
      const tex: string = node.attrs.latex || ''
      try {
        dom.innerHTML = katex.renderToString(tex, { throwOnError: false })
      } catch {
        dom.textContent = `$${tex}$`
      }
      return { dom, update: (n) => {
        if (n.type.name !== 'math_inline') return false
        const t = n.attrs.latex || ''
        try {
          dom.innerHTML = katex.renderToString(t, { throwOnError: false })
        } catch {
          dom.textContent = `$${t}$`
        }
        return true
      }}
    }
  },
})

// Block math: $$ ... $$
export const MathBlock = Node.create({
  name: 'math_display',
  group: 'block',
  atom: true,
  code: false,
  selectable: true,
  defining: true,
  addAttributes() {
    return { latex: { default: '' } }
  },
  parseHTML() {
    return [
      { tag: 'div.math-display', getAttrs: el => ({ latex: (el as HTMLElement).getAttribute('data-latex') || '' }) },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const tex = HTMLAttributes.latex ?? ''
    return ['div', mergeAttributes({ class: 'math-display', 'data-latex': tex }), tex]
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'math-display'
      const tex: string = node.attrs.latex || ''
      try {
        dom.innerHTML = katex.renderToString(tex, { displayMode: true, throwOnError: false })
      } catch {
        dom.textContent = `$$${tex}$$`
      }
      return { dom, update: (n) => {
        if (n.type.name !== 'math_display') return false
        const t = n.attrs.latex || ''
        try {
          dom.innerHTML = katex.renderToString(t, { displayMode: true, throwOnError: false })
        } catch {
          dom.textContent = `$$${t}$$`
        }
        return true
      }}
    }
  },
})

// ProseMirror plugin for input rules ($...$ / $$...$$)
export function mathPMPlugin() {
  return mathPlugin
}

// Helpers to insert/update math nodes from UI
export function insertInlineMath(editor: any) {
  const tex = prompt('Inline LaTeX (without $):') || ''
  if (!tex) return
  editor
    .chain()
    .focus()
    .insertContent({ type: 'math_inline', attrs: { latex: tex } })
    .run()
}
export function insertBlockMath(editor: any) {
  const tex = prompt('Block LaTeX (without $$):') || ''
  if (!tex) return
  editor
    .chain()
    .focus()
    .insertContent({ type: 'math_display', attrs: { latex: tex } })
    .run()
}
