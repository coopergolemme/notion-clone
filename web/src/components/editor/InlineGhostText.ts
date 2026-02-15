import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const INLINE_GHOST_REFRESH_META = "inline-ghost-refresh";

const KEY = new PluginKey("inline-ghost-text");

type Suggestion = {
  text: string;
  at: number;
};

function createDecorations(doc: any, suggestion: Suggestion | null) {
  if (!suggestion?.text || typeof suggestion.at !== "number") {
    return DecorationSet.empty;
  }

  const pos = Math.max(0, Math.min(suggestion.at, doc.content.size));
  const widget = document.createElement("span");
  widget.className = "inline-ghost-text";
  widget.textContent = suggestion.text;

  return DecorationSet.create(doc, [
    Decoration.widget(pos, widget, {
      side: 1,
      ignoreSelection: true,
    }),
  ]);
}

export const InlineGhostText = Extension.create<{
  getSuggestion: () => Suggestion | null;
}>({
  name: "inlineGhostText",

  addOptions() {
    return {
      getSuggestion: () => null,
    };
  },

  addProseMirrorPlugins() {
    const getSuggestion = this.options.getSuggestion;
    return [
      new Plugin({
        key: KEY,
        state: {
          init: (_, { doc }) => createDecorations(doc, getSuggestion()),
          apply: (tr, old, _oldState, newState) => {
            if (tr.docChanged || tr.selectionSet || tr.getMeta(INLINE_GHOST_REFRESH_META)) {
              return createDecorations(newState.doc, getSuggestion());
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            return KEY.getState(state);
          },
        },
      }),
    ];
  },
});
