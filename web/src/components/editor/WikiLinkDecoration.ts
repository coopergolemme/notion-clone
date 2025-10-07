import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const WIKI_REGEX = /\[\[([^\]]+)\]\]/g;
const KEY = new PluginKey("wiki-link-decoration");

export const WIKI_LINK_REFRESH_META = "wiki-link-refresh";

type ResolveFn = (title: string) => string | undefined;

function createDecorations(doc: any, resolveId?: ResolveFn) {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return true;
    const text: string = node.text ?? "";
    let match: RegExpExecArray | null;

    while ((match = WIKI_REGEX.exec(text))) {
      const start = pos + (match.index ?? 0);
      const end = start + match[0].length;
      const title = (match[1] ?? "").trim();
      const attrs: Record<string, any> = {
        class: "wiki-link",
        "data-title": title,
      };

      const id = resolveId?.(title);
      if (id) attrs["data-id"] = id;

      decorations.push(
        Decoration.inline(start, end, attrs, {
          inclusiveStart: false,
          inclusiveEnd: false,
        })
      );
    }

    return true;
  });

  return DecorationSet.create(doc, decorations);
}

export const WikiLinkDecoration = Extension.create<{
  resolveId?: ResolveFn;
}>({
  name: "wikiLinkDecoration",

  addOptions() {
    return {
      resolveId: undefined,
    };
  },

  addProseMirrorPlugins() {
    const getResolve = () => this.options.resolveId;

    return [
      new Plugin({
        key: KEY,
        state: {
          init: (_, { doc }) => createDecorations(doc, getResolve()),
          apply: (tr, old, _oldState, newState) => {
            if (tr.docChanged || tr.getMeta(WIKI_LINK_REFRESH_META)) {
              return createDecorations(newState.doc, getResolve());
            }
            return old;
          },
        },
        props: {
          decorations(state) {
            return KEY.getState(state);
          },
          handleClick(_view, _pos, event) {
            const target = (event.target as HTMLElement | null)?.closest(
              ".wiki-link"
            ) as HTMLElement | null;
            if (!target) return false;
            if (!(event.metaKey || event.ctrlKey)) return false;
            const id = target.getAttribute("data-id");
            if (!id) return false;
            event.preventDefault();
            event.stopPropagation();
            const url = `/page/${id}`;
            window.open(url, event.metaKey ? "_blank" : "_self", "noopener");
            return true;
          },
          handleKeyDown(_view, event) {
            const target = event.target as HTMLElement | null;
            if (!target || !target.classList.contains("wiki-link")) return false;
            const id = target.getAttribute("data-id");
            if (!id) return false;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              const url = `/page/${id}`;
              window.location.href = url;
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});
