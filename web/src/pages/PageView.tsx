import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Stack } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import EditorPro from "../components/editor/EditorPro";
import HistoryDrawer from "../components/HistoryDrawer";
import { deriveTitleFromContent, normalizeTitle } from "../utils/content";

type PageSummary = { id: string; title: string };

type Page = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  format?: "rich" | "latex";
};

export default function PageView() {
  const { id } = useParams();
  const [page, setPage] = useState<Page | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, setPending] = useState<Partial<Page> | null>(null);
  const pendingRef = useRef<Partial<Page> | null>(null);
  const [pageDirectory, setPageDirectory] = useState<PageSummary[]>([]);
  const [titleMap, setTitleMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const resolveWikiLink = useCallback(
    (title: string) => titleMap.get(normalizeTitle(title)),
    [titleMap]
  );

  async function load() {
    if (!id) return;
    try {
      const [pageRes, directoryRes] = await Promise.all([
        api.get(`/pages/${id}`),
        api.get<PageSummary[]>("/pages"),
      ]);

      const directory = Array.isArray(directoryRes.data)
        ? directoryRes.data
        : [];
      setPageDirectory(directory);

      const map = new Map<string, string>();
      for (const entry of directory) {
        if (!entry?.id || !entry?.title) continue;
        map.set(normalizeTitle(entry.title), entry.id);
      }
      setTitleMap(map);

      setPage(pageRes.data);
      setPending(null);
      pendingRef.current = null;
    } catch (error) {
      console.error("Failed to load page", error);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  const queueSave = useCallback((updates: Partial<Page>) => {
    setPending((prev) => {
      const merged = { ...(prev ?? {}), ...updates };
      pendingRef.current = merged;
      return merged;
    });
  }, []);

  const persistPending = useCallback(async () => {
    if (!id) return;
    const updates = pendingRef.current;
    if (!updates || Object.keys(updates).length === 0) return;
    try {
      await api.put(`/pages/${id}`, updates);
      if (pendingRef.current === updates) {
        pendingRef.current = null;
        setPending(null);
        notifications.show({
          message: `Page "${
            page?.title
          }" saved at ${new Date().toLocaleTimeString()}`,
          color: "green",
        });
      }
    } catch (error) {
      console.error("Failed to save page", error);
      notifications.show({
        message: "Failed to save page",
        color: "red",
      });
    }
  }, [id, page?.title]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void persistPending();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [persistPending]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void persistPending();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [persistPending]);

  useEffect(() => {
    return () => {
      void persistPending();
    };
  }, [persistPending]);

  if (!page) return <div>Loading…</div>;

  return (
    <Stack>
      <EditorPro
        value={page.content}
        onChange={(html) => {
          const format = page.format === "latex" ? "latex" : "rich";
          const derivedTitle = deriveTitleFromContent(html, format);
          setPage((prev) => {
            if (!prev) return prev;
            const next = { ...prev, content: html };
            if (derivedTitle && derivedTitle !== prev.title) {
              next.title = derivedTitle;
            }
            return next;
          });
          const updates: Partial<Page> = { content: html };
          if (derivedTitle && derivedTitle !== page.title) {
            updates.title = derivedTitle;
          }
          queueSave(updates);
        }}
        resolveWikiLink={resolveWikiLink}
        initialPages={pageDirectory}
        onPagesIndexUpdate={(pages) => {
          setPageDirectory(pages);
          const nextMap = new Map<string, string>();
          for (const entry of pages) {
            if (!entry?.id || !entry?.title) continue;
            nextMap.set(normalizeTitle(entry.title), entry.id);
          }
          setTitleMap(nextMap);
        }}
      />
      <HistoryDrawer
        pageId={id!}
        opened={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentTitle={page.title}
        currentContent={page.content}
      />
    </Stack>
  );
}
