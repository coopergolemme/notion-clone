import { useEffect, useState } from "react";
import type { SpotlightActionData } from "@mantine/spotlight";
import { api } from "../api";
import { createPage } from "../utils/createPage";
import { triggerOpenAskAI } from "../utils/events";

export function useSpotlightSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { id: string; title: string; snippet: string }[]
  >([]);

  const runSearch = async (q: string) => {
    const params = new URLSearchParams({ q });
    const { data } = await api.get(`/search?${params.toString()}`);
    setResults(rankResults(data, q));
  };

  useEffect(() => {
    const id = setTimeout(() => {
      if (query.trim()) runSearch(query);
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  // Generate actions based on search results
  const actions: SpotlightActionData[] = [
    {
      id: "new",
      label: "New page",
      description: "Create a new page",
      onClick: async () => {
        const id = await createPage({ title: "Untitled", content: "" });
        window.location.href = `/page/${id}`;
      },
    },
    {
      id: "ask-ai",
      label: "Ask AI",
      description: "Send your query to the workspace assistant",
      onClick: () => {
        const q = query.trim();
        triggerOpenAskAI(q ? { query: q } : {});
      },
    },
    {
      id: "graph",
      label: "Open graph",
      description: "View the page graph",
      onClick: () => {
        window.location.href = "/graph";
      },
    },
    ...results.map((r) => ({
      id: r.id,
      label: r.title,
      description: r.snippet,
      onClick: () => (window.location.href = `/page/${r.id}`),
    })),
  ];

  return { query, setQuery, results, actions };
}

function rankResults(
  items: { id: string; title: string; snippet: string }[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

  const scored = items.map((item, index) => {
    const title = item.title?.toLowerCase() ?? "";
    const snippet = item.snippet?.toLowerCase() ?? "";

    let score = 0;

    if (title === normalizedQuery) score += 400;
    if (title.startsWith(normalizedQuery)) score += 200;
    if (title.includes(normalizedQuery)) score += 120;
    if (snippet.includes(normalizedQuery)) score += 50;

    for (const token of tokens) {
      if (!token) continue;
      if (title.includes(token)) score += 40;
      if (snippet.includes(token)) score += 15;
    }

    // Reward shorter titles (closer match) and earlier originals to keep stability
    score -= Math.max(0, title.length - normalizedQuery.length) * 0.5;

    return { item, score, originalIndex: index };
  });

  return scored
    .sort((a, b) => {
      if (b.score === a.score) return a.originalIndex - b.originalIndex;
      return b.score - a.score;
    })
    .map(({ item }) => item);
}
