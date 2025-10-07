import { useMemo, useState, useEffect, useCallback } from "react";
import { FloatingMenu, Editor } from "@tiptap/react";
import { Card, Stack, Text } from "@mantine/core";
import { insertInlineMath, insertBlockMath } from "./MathExtensions";

type SlashItem = {
  key: string;
  label: string;
  run: (editor: Editor) => void | Promise<void>;
};

export type SlashControls = {
  open: boolean;
  move: (delta: number) => void;
  select: () => void;
};

const LOOK_BACK = 120;

export default function SlashMenu({
  editor,
  onInsertPageLink,
  onRemoveTrigger,
  onControlsChange,
}: {
  editor: Editor;
  onInsertPageLink: () => void | Promise<void>;
  onRemoveTrigger: () => void;
  onControlsChange: (controls: SlashControls) => void;
}) {
  const items = useMemo<SlashItem[]>(
    () => [
      {
        key: "h1",
        label: "Heading 1",
        run: (e) => e.chain().focus().setHeading({ level: 1 }).run(),
      },
      {
        key: "h2",
        label: "Heading 2",
        run: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        key: "h3",
        label: "Heading 3",
        run: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        key: "ul",
        label: "Bullet list",
        run: (e) => e.chain().focus().toggleBulletList().run(),
      },
      {
        key: "ol",
        label: "Numbered list",
        run: (e) => e.chain().focus().toggleOrderedList().run(),
      },
      {
        key: "todo",
        label: "Task list",
        run: (e) => e.chain().focus().toggleTaskList().run(),
      },
      {
        key: "code",
        label: "Code block",
        run: (e) => e.chain().focus().toggleCodeBlock().run(),
      },
      {
        key: "table",
        label: "Table",
        run: (e) =>
          e
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
      },
      {
        key: "link",
        label: "Link to page",
        run: () => onInsertPageLink(),
      },
      {
        key: "image",
        label: "Image",
        run: (e) => {
          const url = prompt("Image URL");
          if (url) e.chain().focus().setImage({ src: url }).run();
        },
      },
      {
        key: "math-inline",
        label: "Inline math ($…$)",
        run: (e) => insertInlineMath(e),
      },
      {
        key: "math-block",
        label: "Block math ($$…$$)",
        run: (e) => insertBlockMath(e),
      },
    ],
    [onInsertPageLink]
  );

  const [menuState, setMenuState] = useState<{ open: boolean; query: string }>({
    open: false,
    query: "",
  });

  const evaluateState = useCallback(
    (state: Editor["state"]) => {
      const { from, to } = state.selection;
      if (from !== to) {
        setMenuState((prev) =>
          prev.open ? { open: false, query: "" } : prev
        );
        return false;
      }

      const textBefore = state.doc.textBetween(
        Math.max(0, from - LOOK_BACK),
        from,
        "\n",
        "\u0000"
      );
      const match = /\/(\S*)$/.exec(textBefore);
      if (match) {
        const query = match[1] ?? "";
        setMenuState((prev) =>
          prev.open && prev.query === query ? prev : { open: true, query }
        );
        return true;
      } else {
        setMenuState((prev) =>
          prev.open ? { open: false, query: "" } : prev
        );
        return false;
      }
    },
    []
  );

  const filteredItems = useMemo(() => {
    if (!menuState.query) return items;
    const q = menuState.query.toLowerCase();
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(q) || it.key.toLowerCase().includes(q)
    );
  }, [items, menuState.query]);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [menuState.query, menuState.open, filteredItems.length]);

  const move = useCallback(
    (delta: number) => {
      if (!filteredItems.length) return;
      setActiveIndex((prev) => {
        const total = filteredItems.length;
        const next = (prev + delta + total) % total;
        return next;
      });
    },
    [filteredItems.length]
  );

  const select = useCallback(() => {
    if (!filteredItems.length) return;
    const index = Math.min(activeIndex, filteredItems.length - 1);
    const item = filteredItems[index];
    if (!item) return;
    onRemoveTrigger();
    Promise.resolve(item.run(editor)).catch((err) => console.error(err));
  }, [filteredItems, activeIndex, editor, onRemoveTrigger]);

  useEffect(() => {
    onControlsChange({
      open: menuState.open && filteredItems.length > 0,
      move,
      select,
    });
  }, [menuState.open, filteredItems.length, move, select, onControlsChange]);

  useEffect(() => {
    return () => {
      onControlsChange({ open: false, move: () => {}, select: () => {} });
    };
  }, [onControlsChange]);

  return (
    <FloatingMenu
      editor={editor}
      tippyOptions={{ duration: 150 }}
      shouldShow={({ state }) => evaluateState(state)}>
      <Card
        withBorder
        shadow="sm"
        p="xs">
        <Stack gap={4}>
          {filteredItems.length === 0 ? (
            <Text
              size="sm"
              c="dimmed">
              No matches
            </Text>
          ) : (
            filteredItems.map((it, idx) => (
              <Text
                key={it.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setActiveIndex(idx);
                  onRemoveTrigger();
                  Promise.resolve(it.run(editor)).catch((err) =>
                    console.error(err)
                  );
                }}
                size="sm"
                style={{
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: 6,
                  backgroundColor:
                    idx === activeIndex
                      ? "var(--mantine-color-blue-light, rgba(59,130,246,0.12))"
                      : "transparent",
                  color:
                    idx === activeIndex
                      ? "var(--mantine-color-blue-7, #1d4ed8)"
                      : "inherit",
                }}>
                {it.label}
              </Text>
            ))
          )}
        </Stack>
      </Card>
    </FloatingMenu>
  );
}
