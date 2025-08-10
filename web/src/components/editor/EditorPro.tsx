import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import CharacterCount from "@tiptap/extension-character-count";
import { common, createLowlight } from "lowlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Paper, Stack } from "@mantine/core";
import Toolbar from "./Toolbar";
import Bubble from "./Bubble";
import SlashMenu from "./SlashMenu";
import Outline from "./Outline";
import "./styles.css";

const lowlight = createLowlight(common);

type Props = {  
  value: string;
  onChange: (html: string) => void;
};

export default function EditorPro({ value, onChange }: Props) {
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Underline,
      Link.configure({
        protocols: ["http", "https", "mailto"],
        openOnClick: true,
      }),
      Placeholder.configure({
        placeholder: "Start typing… Use / for commands.",
      }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: true }),
      CharacterCount.configure({ limit: 200000 }),
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
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // keep external value in sync (e.g., on load)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
  }, [value]);

  const containerStyle: React.CSSProperties = useMemo(
    () =>
      fullscreen
        ? {
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "var(--mantine-color-body)",
            padding: 16,
          }
        : {},
    [fullscreen]
  );

  return (
    <div
      ref={rootRef}
      style={containerStyle}>
      <Paper
        withBorder
        radius="md"
        shadow="xs">
        <Toolbar
          editor={editor!}
          onFullscreen={() => setFullscreen((v) => !v)}
          fullscreen={fullscreen}
        />
        <PanelGroup direction="horizontal">
          <Panel
            defaultSize={75}
            minSize={45}>
            <Stack
              gap={0}
              style={{ minHeight: 320 }}>
              {editor && <Bubble editor={editor} />}
              {editor && <SlashMenu editor={editor} />}
              <EditorContent editor={editor} />
            </Stack>
          </Panel>
          <PanelResizeHandle
            style={{
              width: 6,
              cursor: "col-resize",
              background: "var(--mantine-color-default-border)",
            }}
          />
          <Panel
            minSize={15}
            defaultSize={25}>
            <div style={{ padding: 8, height: "100%", overflow: "auto" }}>
              <Outline editor={editor ?? null} />
            </div>
          </Panel>
        </PanelGroup>
      </Paper>
    </div>
  );
}
