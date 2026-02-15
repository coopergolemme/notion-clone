import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  Button,
  Group,
  Paper,
  Popover,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import SlashMenu, { type SlashControls } from "./SlashMenu";
import Outline from "./Outline";
import { MathInline, MathBlock } from "./MathExtensions";
import { MathInputRules } from "./MathInputRules";
import {
  InlineGhostText,
  INLINE_GHOST_REFRESH_META,
} from "./InlineGhostText";
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
  pageId?: string;
  resolveWikiLink?: (title: string) => string | undefined;
  initialPages?: PageSummary[];
  onPagesIndexUpdate?: (pages: PageSummary[]) => void;
};

type InlineMode = "continue" | "rewrite" | "fix" | "summarize" | "explain";

type InlineSuggestion = {
  suggestions: string[];
  activeIndex: number;
  replaceRange: { from: number; to: number };
  mode: InlineMode;
  tone: string;
  streaming?: boolean;
};

export default function EditorPro({
  value,
  onChange,
  pageId,
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
  const editorPaneRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [requestingSuggestion, setRequestingSuggestion] = useState(false);
  const [inlineSuggestion, setInlineSuggestion] =
    useState<InlineSuggestion | null>(null);
  const inlineStreamAbortRef = useRef<AbortController | null>(null);
  const [inlineControlsPos, setInlineControlsPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const inlineSuggestionRef = useRef<InlineSuggestion | null>(null);
  const requestInlineSuggestionRef = useRef<
    ((mode?: InlineMode) => Promise<void>) | null
  >(null);
  const acceptInlineSuggestionRef = useRef<(() => void) | null>(null);
  const rejectInlineSuggestionRef = useRef<(() => void) | null>(null);
  const cycleInlineSuggestionRef = useRef<((delta: number) => void) | null>(
    null
  );
  const popoverOpenRef = useRef(false);
  const openLatexPopoverRef = useRef<
    ((options: {
      title: string;
      initialLatex?: string;
      displayMode?: boolean;
      allowModeToggle?: boolean;
      submitLabel?: string;
      helperText?: string;
      anchorPos?: number;
      editNodePos?: number;
    }) => void) | null
  >(null);
  const closeEquationPopoverRef = useRef<(() => void) | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverKind, setPopoverKind] = useState<"latex" | "english">("latex");
  const [popoverPosition, setPopoverPosition] = useState({ x: 24, y: 24 });
  const [popoverTitle, setPopoverTitle] = useState("");
  const [popoverSubmitLabel, setPopoverSubmitLabel] = useState("Insert");
  const [popoverHelperText, setPopoverHelperText] = useState("");
  const [popoverLatex, setPopoverLatex] = useState("");
  const [popoverPrompt, setPopoverPrompt] = useState("");
  const [popoverDisplayMode, setPopoverDisplayMode] = useState(false);
  const [popoverAllowModeToggle, setPopoverAllowModeToggle] = useState(true);
  const [popoverEditNodePos, setPopoverEditNodePos] = useState<number | null>(
    null
  );
  const [popoverSubmitting, setPopoverSubmitting] = useState(false);

  useEffect(() => {
    resolveRef.current = resolveWikiLink || (() => undefined);
  }, [resolveWikiLink]);

  useEffect(() => {
    if (initialPages && initialPages.length) {
      pagesCacheRef.current = initialPages;
    }
  }, [initialPages]);

  const requestInlineSuggestion = useCallback(
    async (mode: InlineMode = "continue") => {
      const ed = editorRef.current;
      if (!ed || requestingSuggestion) return;
      const { from, to } = ed.state.selection;
      const selectionText = ed.state.doc.textBetween(from, to, "\n", " ");
      const cursorBefore = ed.state.doc.textBetween(
        Math.max(0, from - 400),
        from,
        "\n",
        " "
      );
      const cursorAfter = ed.state.doc.textBetween(
        to,
        Math.min(ed.state.doc.content.size, to + 220),
        "\n",
        " "
      );
      const replaceRange = { from, to };
      const payload = {
        pageId,
        mode,
        tone: "neutral",
        maxTokens: 180,
        variants: 3,
        selectionText,
        cursorBefore,
        cursorAfter,
        replaceRange,
      };

      inlineStreamAbortRef.current?.abort();
      const ctrl = new AbortController();
      inlineStreamAbortRef.current = ctrl;
      setRequestingSuggestion(true);
      setInlineSuggestion({
        suggestions: [""],
        activeIndex: 0,
        replaceRange,
        mode,
        tone: "neutral",
        streaming: true,
      });

      try {
        const baseURL =
          (api.defaults.baseURL as string | undefined) || window.location.origin;
        const endpoint = new URL("/ai/inline-suggest/stream", baseURL).toString();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Inline stream failed: ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventName = "message";
        let streamedText = "";
        let streamError = "";
        let donePayload:
          | {
              suggestions?: string[];
              replaceRange?: { from: number; to: number };
            }
          | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() || "";
          for (const block of blocks) {
            const lines = block.split("\n");
            let data = "";
            eventName = "message";
            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
              }
              if (line.startsWith("data:")) {
                data += line.slice(5).trim();
              }
            }
            if (!data) continue;
            const payload = JSON.parse(data);
            if (eventName === "token") {
              const token = String(payload?.text || "");
              if (!token) continue;
              streamedText += token;
              setInlineSuggestion((prev) => {
                if (!prev) return prev;
                const list = [...prev.suggestions];
                list[0] = (list[0] || "") + token;
                return { ...prev, suggestions: list };
              });
            }
            if (eventName === "done") {
              donePayload = payload;
            }
            if (eventName === "error") {
              streamError = String(payload?.error || "").trim();
            }
          }
        }

        const suggestions = (donePayload?.suggestions || []).filter(
          (s: any) => typeof s === "string" && s.trim()
        ) as string[];
        const finalSuggestions =
          suggestions.length > 0
            ? suggestions
            : streamedText.trim()
              ? [streamedText.trim()]
              : undefined;
        if (!finalSuggestions?.length) {
          const { data } = await api.post<{
            suggestion?: string;
            suggestions?: string[];
            replaceRange?: { from: number; to: number };
          }>("/ai/inline-suggest", payload);
          const recovered = (data?.suggestions || [])
            .filter((s) => typeof s === "string")
            .map((s) => s.trim())
            .filter(Boolean);
          const merged = recovered.length
            ? recovered
            : [String(data?.suggestion || "").trim()].filter(Boolean);
          if (!merged.length) {
            setInlineSuggestion(null);
            notifications.show({
              message: streamError || "No suggestion returned",
              color: "yellow",
            });
          } else {
            setInlineSuggestion((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                suggestions: merged,
                activeIndex: 0,
                replaceRange: data?.replaceRange || donePayload?.replaceRange || replaceRange,
                streaming: false,
              };
            });
          }
        } else {
          setInlineSuggestion((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              suggestions: finalSuggestions,
              activeIndex: 0,
              replaceRange: donePayload?.replaceRange || replaceRange,
              streaming: false,
            };
          });
        }
      } catch (error) {
        if ((error as any)?.name === "AbortError") return;
        console.error("Failed to fetch inline suggestion", error);
        setInlineSuggestion(null);
        notifications.show({
          message:
            (error as any)?.response?.data?.error ||
            (error as any)?.response?.data?.details ||
            "Failed to fetch inline suggestion",
          color: "red",
        });
      } finally {
        if (inlineStreamAbortRef.current === ctrl) {
          inlineStreamAbortRef.current = null;
        }
        setRequestingSuggestion(false);
      }
    },
    [pageId, requestingSuggestion]
  );

  const acceptInlineSuggestion = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || !inlineSuggestion) return;
    const suggestion =
      inlineSuggestion.suggestions[inlineSuggestion.activeIndex] || "";
    if (!suggestion.trim()) return;
    const { replaceRange } = inlineSuggestion;
    ed
      .chain()
      .focus()
      .insertContentAt(replaceRange, suggestion + (replaceRange.from === replaceRange.to ? " " : ""))
      .run();
    setInlineSuggestion(null);
  }, [inlineSuggestion]);

  const rejectInlineSuggestion = useCallback(() => {
    inlineStreamAbortRef.current?.abort();
    setInlineSuggestion(null);
  }, []);

  const cycleInlineSuggestion = useCallback((delta: number) => {
    setInlineSuggestion((prev) => {
      if (!prev || prev.suggestions.length <= 1) return prev;
      const total = prev.suggestions.length;
      const next = (prev.activeIndex + delta + total) % total;
      return { ...prev, activeIndex: next };
    });
  }, []);

  useEffect(() => {
    inlineSuggestionRef.current = inlineSuggestion;
  }, [inlineSuggestion]);

  useEffect(() => {
    requestInlineSuggestionRef.current = requestInlineSuggestion;
  }, [requestInlineSuggestion]);

  useEffect(() => {
    acceptInlineSuggestionRef.current = acceptInlineSuggestion;
  }, [acceptInlineSuggestion]);

  useEffect(() => {
    rejectInlineSuggestionRef.current = rejectInlineSuggestion;
  }, [rejectInlineSuggestion]);

  useEffect(() => {
    cycleInlineSuggestionRef.current = cycleInlineSuggestion;
  }, [cycleInlineSuggestion]);

  useEffect(() => {
    popoverOpenRef.current = popoverOpen;
  }, [popoverOpen]);

  const getPopoverAnchorFromPos = useCallback((pos: number) => {
    const ed = editorRef.current;
    const pane = editorPaneRef.current;
    if (!ed || !pane) return { x: 24, y: 24 };
    try {
      const safePos = Math.max(1, Math.min(pos, ed.state.doc.content.size));
      const coords = ed.view.coordsAtPos(safePos);
      const rect = pane.getBoundingClientRect();
      return {
        x: Math.max(12, Math.min(coords.left - rect.left, rect.width - 20)),
        y: Math.max(12, Math.min(coords.bottom - rect.top + 8, rect.height - 20)),
      };
    } catch {
      return { x: 24, y: 24 };
    }
  }, []);

  const closeEquationPopover = useCallback(() => {
    setPopoverOpen(false);
    setPopoverSubmitting(false);
    setPopoverEditNodePos(null);
  }, []);

  const openLatexPopover = useCallback(
    (options: {
      title: string;
      initialLatex?: string;
      displayMode?: boolean;
      allowModeToggle?: boolean;
      submitLabel?: string;
      helperText?: string;
      anchorPos?: number;
      editNodePos?: number;
    }) => {
      const ed = editorRef.current;
      if (!ed) return;
      setPopoverKind("latex");
      setPopoverTitle(options.title);
      setPopoverSubmitLabel(options.submitLabel || "Insert");
      setPopoverHelperText(options.helperText || "");
      setPopoverLatex(options.initialLatex || "");
      setPopoverDisplayMode(Boolean(options.displayMode));
      setPopoverAllowModeToggle(options.allowModeToggle ?? true);
      setPopoverEditNodePos(options.editNodePos ?? null);
      setPopoverPosition(
        getPopoverAnchorFromPos(options.anchorPos ?? ed.state.selection.from)
      );
      setPopoverOpen(true);
    },
    [getPopoverAnchorFromPos]
  );

  const openEnglishEquationPopover = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    setPopoverKind("english");
    setPopoverTitle("AI Equation from English");
    setPopoverSubmitLabel("Generate Equation");
    setPopoverHelperText("");
    setPopoverPrompt("");
    setPopoverDisplayMode(false);
    setPopoverAllowModeToggle(true);
    setPopoverEditNodePos(null);
    setPopoverPosition(getPopoverAnchorFromPos(ed.state.selection.from));
    setPopoverOpen(true);
  }, [getPopoverAnchorFromPos]);

  useEffect(() => {
    openLatexPopoverRef.current = openLatexPopover;
  }, [openLatexPopover]);

  useEffect(() => {
    closeEquationPopoverRef.current = closeEquationPopover;
  }, [closeEquationPopover]);

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
      InlineGhostText.configure({
        getSuggestion: () => {
          const current = inlineSuggestionRef.current;
          if (!current) return null;
          const text = current.suggestions[current.activeIndex] || "";
          if (!text) return null;
          return { text, at: current.replaceRange.to };
        },
      }),
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

        if (popoverOpenRef.current && event.key === "Escape") {
          event.preventDefault();
          closeEquationPopoverRef.current?.();
          return true;
        }

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
          event.preventDefault();
          if (event.shiftKey && inlineSuggestionRef.current) {
            void requestInlineSuggestionRef.current?.(inlineSuggestionRef.current.mode);
            return true;
          }
          const mode: InlineMode =
            editor.state.selection.from === editor.state.selection.to
              ? "continue"
              : "rewrite";
          void requestInlineSuggestionRef.current?.(mode);
          return true;
        }

        if (inlineSuggestionRef.current) {
          if (event.altKey && event.key === "[") {
            event.preventDefault();
            cycleInlineSuggestionRef.current?.(-1);
            return true;
          }
          if (event.altKey && event.key === "]") {
            event.preventDefault();
            cycleInlineSuggestionRef.current?.(1);
            return true;
          }
          if (event.key === "Tab") {
            event.preventDefault();
            acceptInlineSuggestionRef.current?.();
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            rejectInlineSuggestionRef.current?.();
            return true;
          }
        }

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
          openLatexPopoverRef.current?.({
            title: "Edit LaTeX",
            initialLatex: node.attrs.latex || "",
            displayMode: node.type.name === "math_display",
            allowModeToggle: false,
            submitLabel: "Save",
            anchorPos: nodePos,
            editNodePos: nodePos,
          });
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
    editorRef.current = editor || null;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.view.state.tr.setMeta(INLINE_GHOST_REFRESH_META, true)
    );
  }, [editor, inlineSuggestion]);

  useEffect(() => {
    if (!editor || !inlineSuggestion) {
      setInlineControlsPos(null);
      return;
    }
    setInlineControlsPos(getPopoverAnchorFromPos(inlineSuggestion.replaceRange.to));
  }, [editor, getPopoverAnchorFromPos, inlineSuggestion]);

  useEffect(() => {
    if (!editor || !inlineSuggestion) return;
    const onSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      const range = inlineSuggestionRef.current?.replaceRange;
      if (!range) return;
      if (from !== range.from || to !== range.to) {
        setInlineSuggestion(null);
      }
    };
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [editor, inlineSuggestion]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.view.state.tr.setMeta(WIKI_LINK_REFRESH_META, true)
    );
  }, [editor, resolveWikiLink]);

  useEffect(() => {
    return () => {
      inlineStreamAbortRef.current?.abort();
    };
  }, []);

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

  const insertEquationFromEnglish = useCallback(async () => {
    openEnglishEquationPopover();
  }, [openEnglishEquationPopover]);

  const insertMathWithModal = useCallback(
    async (displayMode: boolean) => {
      const ed = editorRef.current;
      if (!ed) return;
      openLatexPopover({
        title: displayMode ? "Insert Block LaTeX" : "Insert Inline LaTeX",
        displayMode,
        allowModeToggle: true,
        submitLabel: "Insert",
        helperText: "Enter raw LaTeX expression (no surrounding $ delimiters).",
        anchorPos: ed.state.selection.from,
      });
    },
    [openLatexPopover]
  );

  const submitLatexPopover = useCallback(() => {
    const ed = editorRef.current;
    const latex = popoverLatex.trim();
    if (!ed || !latex) return;

    if (popoverEditNodePos !== null) {
      const node = ed.state.doc.nodeAt(popoverEditNodePos);
      if (!node) {
        notifications.show({
          message: "Equation not found",
          color: "red",
        });
        closeEquationPopover();
        return;
      }
      ed.view.dispatch(
        ed.state.tr.setNodeMarkup(popoverEditNodePos, undefined, {
          ...node.attrs,
          latex,
        })
      );
      closeEquationPopover();
      return;
    }

    const { from, to } = ed.state.selection;
    ed.chain()
      .focus()
      .insertContentAt(
        { from, to },
        {
          type: popoverDisplayMode ? "math_display" : "math_inline",
          attrs: { latex },
        }
      )
      .run();
    closeEquationPopover();
  }, [
    closeEquationPopover,
    popoverDisplayMode,
    popoverEditNodePos,
    popoverLatex,
  ]);

  const submitEnglishPopover = useCallback(async () => {
    const ed = editorRef.current;
    const prompt = popoverPrompt.trim();
    if (!ed || !prompt || popoverSubmitting) return;
    setPopoverSubmitting(true);
    try {
      const { data } = await api.post<{
        latex: string;
        kind: "inline" | "block";
        valid: boolean;
      }>("/ai/latex-from-text", {
        prompt,
        displayMode: popoverDisplayMode,
        pageId,
      });

      const latex = String(data?.latex || "").trim();
      if (!latex) {
        notifications.show({
          message: "No LaTeX returned",
          color: "yellow",
        });
        return;
      }

      const { from, to } = ed.state.selection;
      ed.chain()
        .focus()
        .insertContentAt(
          { from, to },
          {
            type: popoverDisplayMode ? "math_display" : "math_inline",
            attrs: { latex },
          }
        )
        .run();
      closeEquationPopover();
    } catch (error: any) {
      console.error("Failed to generate LaTeX from plain English", error);
      notifications.show({
        message:
          error?.response?.data?.details ||
          "Failed to generate a valid LaTeX equation",
        color: "red",
      });
    } finally {
      setPopoverSubmitting(false);
    }
  }, [closeEquationPopover, pageId, popoverDisplayMode, popoverPrompt, popoverSubmitting]);

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
            ref={editorPaneRef}
            style={{
              padding: "24px 24px 48px",
              minHeight: 360,
              position: "relative",
            }}>
            <SlashMenu
              editor={editor}
              onInsertPageLink={insertPageLink}
              onInlineSuggestion={(mode) => {
                removeSlashCommandTrigger(editor);
                void requestInlineSuggestion(mode);
              }}
              onInsertEquationFromEnglish={() => {
                removeSlashCommandTrigger(editor);
                void insertEquationFromEnglish();
              }}
              onInsertInlineMath={() => {
                removeSlashCommandTrigger(editor);
                void insertMathWithModal(false);
              }}
              onInsertBlockMath={() => {
                removeSlashCommandTrigger(editor);
                void insertMathWithModal(true);
              }}
              onRemoveTrigger={() => removeSlashCommandTrigger(editor)}
              onControlsChange={(controls) => {
                slashControlsRef.current = controls;
              }}
            />
            <EditorContent editor={editor} />
            {inlineSuggestion && inlineControlsPos && (
              <div
                style={{
                  position: "absolute",
                  left: inlineControlsPos.x,
                  top: inlineControlsPos.y + 22,
                  zIndex: 30,
                }}>
                <Paper
                  withBorder
                  shadow="sm"
                  radius="md"
                  p={6}>
                  <Group gap={6}>
                    <Button
                      size="compact-xs"
                      variant="light"
                      onClick={acceptInlineSuggestion}>
                      Accept
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="default"
                      onClick={rejectInlineSuggestion}>
                      Reject
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      loading={requestingSuggestion}
                      onClick={() => void requestInlineSuggestion(inlineSuggestion.mode)}>
                      Regenerate
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="default"
                      disabled={inlineSuggestion.suggestions.length <= 1}
                      onClick={() => cycleInlineSuggestion(-1)}>
                      Prev
                    </Button>
                    <Text size="xs" c="dimmed">
                      {inlineSuggestion.activeIndex + 1}/{inlineSuggestion.suggestions.length}
                    </Text>
                    <Button
                      size="compact-xs"
                      variant="default"
                      disabled={inlineSuggestion.suggestions.length <= 1}
                      onClick={() => cycleInlineSuggestion(1)}>
                      Next
                    </Button>
                    {inlineSuggestion.streaming && (
                      <Text size="xs" c="dimmed">
                        streaming...
                      </Text>
                    )}
                  </Group>
                </Paper>
              </div>
            )}
            <Popover
              opened={popoverOpen}
              withinPortal={false}
              position="bottom-start"
              shadow="md"
              withArrow>
              <Popover.Target>
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: popoverPosition.x,
                    top: popoverPosition.y,
                    width: 1,
                    height: 1,
                    pointerEvents: "none",
                  }}
                />
              </Popover.Target>
              <Popover.Dropdown style={{ width: 360, padding: 12 }}>
                <Stack gap="sm">
                  <Text
                    size="sm"
                    fw={600}>
                    {popoverTitle}
                  </Text>
                  {popoverAllowModeToggle && (
                    <SegmentedControl
                      fullWidth
                      data={[
                        { label: "Inline", value: "inline" },
                        { label: "Block", value: "block" },
                      ]}
                      value={popoverDisplayMode ? "block" : "inline"}
                      onChange={(value) => setPopoverDisplayMode(value === "block")}
                    />
                  )}
                  {popoverKind === "english" ? (
                    <Textarea
                      autosize
                      minRows={4}
                      label="Describe the equation"
                      value={popoverPrompt}
                      onChange={(event) => setPopoverPrompt(event.currentTarget.value)}
                      placeholder="e.g. the quadratic formula solving ax^2 + bx + c = 0 for x"
                    />
                  ) : (
                    <>
                      {popoverHelperText && (
                        <Text
                          size="xs"
                          c="dimmed">
                          {popoverHelperText}
                        </Text>
                      )}
                      <Textarea
                        autosize
                        minRows={4}
                        label="LaTeX"
                        value={popoverLatex}
                        onChange={(event) => setPopoverLatex(event.currentTarget.value)}
                        placeholder="e.g. \\int_0^1 x^2\\,dx = \\frac{1}{3}"
                      />
                    </>
                  )}
                  <Group justify="space-between">
                    <Button
                      variant="default"
                      size="xs"
                      onClick={closeEquationPopover}>
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      loading={popoverSubmitting}
                      disabled={
                        popoverKind === "english"
                          ? !popoverPrompt.trim()
                          : !popoverLatex.trim()
                      }
                      onClick={() => {
                        if (popoverKind === "english") {
                          void submitEnglishPopover();
                        } else {
                          submitLatexPopover();
                        }
                      }}>
                      {popoverSubmitLabel}
                    </Button>
                  </Group>
                </Stack>
              </Popover.Dropdown>
            </Popover>
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
