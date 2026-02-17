import { Node, mergeAttributes } from "@tiptap/core";
import Mathematics from "@tiptap/extension-mathematics";
import katex from "katex";

// Use the official TipTap math extension
export const MathExtension = Mathematics.configure({
  katexOptions: {
    throwOnError: false,
    displayMode: false,
  },
});

// Inline math extension
export const MathInline = Node.create({
  name: "math_inline",
  group: "inline",
  atom: true,
  inline: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex"),
        renderHTML: (attributes) => {
          return {
            "data-latex": attributes.latex,
          }
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="math-inline"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "math-inline",
      }),
      node.attrs.latex,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.setAttribute("data-type", "math-inline");
      const latex = node.attrs.latex || "";

      try {
        dom.innerHTML = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false,
        });
      } catch (error) {
        dom.textContent = `$${latex}$`;
      }

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "math_inline") return false;

          const newLatex = updatedNode.attrs.latex || "";
          try {
            dom.innerHTML = katex.renderToString(newLatex, {
              throwOnError: false,
              displayMode: false,
            });
          } catch (error) {
            dom.textContent = `$${newLatex}$`;
          }
          return true;
        },
      };
    };
  },
});

// Block math extension
export const MathBlock = Node.create({
  name: "math_display",
  group: "block",
  atom: true,
  selectable: true,
  defining: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex"),
        renderHTML: (attributes) => {
          return {
            "data-latex": attributes.latex,
          }
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="math-display"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "math-display",
      }),
      node.attrs.latex,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.setAttribute("data-type", "math-display");
      const latex = node.attrs.latex || "";

      try {
        dom.innerHTML = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (error) {
        dom.textContent = `$$${latex}$$`;
      }

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "math_display") return false;

          const newLatex = updatedNode.attrs.latex || "";
          try {
            dom.innerHTML = katex.renderToString(newLatex, {
              throwOnError: false,
              displayMode: true,
            });
          } catch (error) {
            dom.textContent = `$$${newLatex}$$`;
          }
          return true;
        },
      };
    };
  },
});

// Helper functions
export function insertInlineMath(editor: any) {
  const latex = prompt("Enter LaTeX formula:") || "";
  if (!latex) return;

  editor
    .chain()
    .focus()
    .insertContent({
      type: "math_inline",
      attrs: { latex },
    })
    .run();
}

export function insertBlockMath(editor: any) {
  const latex = prompt("Enter LaTeX formula:") || "";
  if (!latex) return;

  editor
    .chain()
    .focus()
    .insertContent({
      type: "math_display",
      attrs: { latex },
    })
    .run();
}
