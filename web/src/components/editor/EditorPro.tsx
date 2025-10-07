import { useCallback, useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Paper } from "@mantine/core";
import { modals } from "@mantine/modals";
import SlashMenu, { type SlashControls } from "./SlashMenu";
import Outline from "./Outline";
import { MathInline, MathBlock } from "./MathExtensions";
import { MathInputRules } from "./MathInputRules";
import {
  WikiLinkDecoration,
  WIKI_LINK_REFRESH_META,
} from "./WikiLinkDecoration";
import { api } from "../../api";
import { normalizeTitle } from "../../utils/content";
import "./styles.css";

const lowlight = createLowlight(common);

type PageSummary = { id: string; title: string };

type Props = {
  value: string;
  onChange: (html: string) => void;
  resolveWikiLink?: (title: string) => string | undefined;
  initialPages?: PageSummary[];
  onPagesIndexUpdate?: (pages: PageSummary[]) => void;
};

export default function EditorPro({
  value,
  onChange,
  resolveWikiLink,
  initialPages = [],
  onPagesIndexUpdate,
}: Props) {
  const slashControlsRef = useRef<SlashControls>({
    open: false,
    move: () => {},
    select: () => {},
  });
  const pagesCacheRef = useRef<PageSummary[]>(initialPages ?? []);
  const resolveRef = useRef<(title: string) => string | undefined>(
    () => undefined
  );

  useEffect(() => {
    resolveRef.current = resolveWikiLink || (() => undefined);
  }, [resolveWikiLink]);

  useEffect(() => {
    if (initialPages && initialPages.length) {
      pagesCacheRef.current = initialPages;
    }
  }, [initialPages]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      MathInline,
      MathBlock,
      Underline,
      Link.configure({
        protocols: ["http", "https", "mailto"],
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: "Start typing… Use / for commands.",
      }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: true }),
      CharacterCount.configure({ limit: 200000 }),
      MathInputRules,
      WikiLinkDecoration.configure({
        resolveId: (title) => resolveRef.current(title),
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: { class: "tiptap" },
      handlePaste(view, e) {
        const item = e.clipboardData?.items?.[0];
        if (item && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const url = URL.createObjectURL(file);
            (view as any).state.editor
              .chain()
              .focus()
              .setImage({ src: url })
              .run();
            return true;
          }
        }
        return false;
      },
      handleKeyDown(_view, event) {
        if (!editor) return false;

        if (slashControlsRef.current?.open) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            slashControlsRef.current.move(1);
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            slashControlsRef.current.move(-1);
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            slashControlsRef.current.select();
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            removeSlashCommandTrigger(editor);
            return true;
          }
        }

        return false;
      },
      handleDoubleClickOn(view, pos, node, nodePos) {
        if (
          node.type.name === "math_inline" ||
          node.type.name === "math_display"
        ) {
          const latex = node.attrs.latex || "";
          const updated = window.prompt("Edit LaTeX", latex);
          if (updated === null) return true;

          view.dispatch(
            view.state.tr.setNodeMarkup(nodePos, undefined, {
              ...node.attrs,
              latex: updated,
            })
          );
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.view.state.tr.setMeta(WIKI_LINK_REFRESH_META, true)
    );
  }, [editor, resolveWikiLink]);

  const insertPageLink = useCallback(async () => {
    if (!editor) return;

    removeSlashCommandTrigger(editor);

    let pages: PageSummary[] = [];
    try {
      const { data } = await api.get<PageSummary[]>("/pages");
      pages = Array.isArray(data) ? data : [];
      pagesCacheRef.current = pages;
      onPagesIndexUpdate?.(pages);
    } catch (error) {
      console.error("Failed to fetch pages", error);
      pages = pagesCacheRef.current ?? [];
    }

    let resolved = false;

    await new Promise<void>((resolve) => {
      const close = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      modals.openContextModal({
        modal: "linkToPage",
        title: "Link to page",
        innerProps: {
          pages,
          onSelect: (rawTitle: string) => {
            if (resolved) return;
            const title = rawTitle.trim();
            resolved = true;
            close();
            const text = `[[${title}]] `;
            editor.chain().focus().insertContent(text).run();
            resolve();
          },
          onCancel: () => {
            close();
          },
        },
        onClose: close,
        withCloseButton: true,
        trapFocus: true,
        closeOnClickOutside: false,
      });
    });
  }, [editor, onPagesIndexUpdate]);

  if (!editor) {
    return (
      <Paper
        withBorder
        radius="md"
        shadow="xs"
        style={{ minHeight: 360 }}
      />
    );
  }

  return (
    <Paper
      withBorder
      radius="md"
      shadow="xs"
      style={{ overflow: "hidden" }}>
      <PanelGroup direction="horizontal">
        <Panel
          defaultSize={72}
          minSize={40}>
          <div
            style={{
              padding: "24px 24px 48px",
              minHeight: 360,
              position: "relative",
            }}>
            <SlashMenu
              editor={editor}
              onInsertPageLink={insertPageLink}
              onRemoveTrigger={() => removeSlashCommandTrigger(editor)}
              onControlsChange={(controls) => {
                slashControlsRef.current = controls;
              }}
            />
            <EditorContent editor={editor} />
          </div>
        </Panel>
        <PanelResizeHandle
          style={{
            width: 6,
            cursor: "col-resize",
            background: "var(--mantine-color-default-border)",
          }}
        />
        <Panel
          minSize={18}
          defaultSize={28}>
          <div
            style={{
              padding: 16,
              height: "100%",
              overflow: "auto",
              background: "var(--mantine-color-gray-0)",
            }}>
            <Outline editor={editor} />
          </div>
        </Panel>
      </PanelGroup>
    </Paper>
  );
}

function removeSlashCommandTrigger(editor: Editor) {
  const { state } = editor;
  const { from } = state.selection;
  const lookBehind = 80;
  const textBefore = state.doc.textBetween(
    Math.max(0, from - lookBehind),
    from,
    "\n",
    "\u0000"
  );
  const match = /\/(\S*)$/.exec(textBefore);
  if (!match) return;
  const start = from - match[0].length;
  editor.commands.deleteRange({ from: start, to: from });
}
