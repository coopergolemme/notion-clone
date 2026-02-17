import keywordExtractor from "keyword-extractor";
import { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { embed } from "../embeddings.js";
import { toPgVector } from "../pgvector.js";
import { genText, genTextStream } from "../llm.js";
import katex from "katex";
import { z } from "zod";

function toKebab(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLatexSnippets(html: string): string[] {
  const snippets: string[] = [];
  const attrRegex = /data-latex="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(html))) {
    const raw = decodeHtmlEntities(match[1] || "").trim();
    if (raw) snippets.push(raw);
  }

  // fallback for raw $...$ or $$...$$ content
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  while ((match = blockRegex.exec(html))) {
    const raw = (match[1] || "").trim();
    if (raw) snippets.push(raw);
  }
  const inlineRegex = /(^|[^$])\$([^\n$]+?)\$/g;
  while ((match = inlineRegex.exec(html))) {
    const raw = (match[2] || "").trim();
    if (raw) snippets.push(raw);
  }

  return snippets;
}

function extractLatexTokens(snippets: string[], limit = 24): string[] {
  const counts = new Map<string, number>();
  for (const snip of snippets) {
    const commands = snip.match(/\\[a-zA-Z]+/g) || [];
    const symbols = snip.match(/[a-zA-Z]\w*/g) || [];
    for (const cmd of commands) {
      counts.set(cmd, (counts.get(cmd) || 0) + 2);
    }
    for (const sym of symbols) {
      if (sym.length <= 1) continue;
      counts.set(sym, (counts.get(sym) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

function extractKeywords(texts: string[], limit = 20): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const keywords = keywordExtractor.extract(text, {
      language: "english",
      remove_digits: true,
      return_changed_case: true,
      remove_duplicates: false,
    });
    for (const k of keywords) {
      if (k.length < 3) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, limit)
    .map(([token]) => token);
}

async function buildLatexContext({
  prompt,
  pageId,
}: {
  prompt: string;
  pageId?: string;
}) {
  const pages: { id: string; title: string; content: string }[] = [];
  const seen = new Set<string>();

  const addPage = (row: { id: string; title: string; content: string }) => {
    if (!row?.id || seen.has(row.id)) return;
    if (pageId && row.id === pageId) return;
    seen.add(row.id);
    pages.push(row);
  };

  try {
    const vec = await embed(prompt);
    const pgVec = toPgVector(vec);
    if (pgVec) {
      const similar = await query<{ id: string; title: string; content: string }>(
        `
          select id, title, content
          from page
          order by embedding <=> $1::vector
          limit 5
        `,
        [pgVec]
      );
      similar.rows.forEach(addPage);
    }
  } catch {
    // ignore embedding failures
  }

  const recent = await query<{ id: string; title: string; content: string }>(
    `
      select id, title, content
      from page
      order by updated_at desc nulls last, created_at desc
      limit 6
    `
  );
  recent.rows.forEach(addPage);

  if (!pages.length) return "";

  const snippets: string[] = [];
  for (const p of pages) {
    snippets.push(...extractLatexSnippets(p.content));
  }
  const tokens = extractLatexTokens(snippets, 18);

  const noteSummaries = pages.slice(0, 4).map((p) => {
    const text = stripHtml(p.content).slice(0, 220);
    return `- ${p.title}: ${text}`;
  });

  const lines = [
    "Relevant note context:",
    ...noteSummaries,
  ];
  if (tokens.length) {
    lines.push("", "Common symbols/commands used in your notes:");
    lines.push(tokens.map((t) => `\`${t}\``).join(", "));
  }

  return lines.join("\n");
}

async function buildWritingContext({
  prompt,
  pageId,
}: {
  prompt: string;
  pageId?: string;
}) {
  const pages: { id: string; title: string; content: string }[] = [];
  const seen = new Set<string>();

  const addPage = (row: { id: string; title: string; content: string }) => {
    if (!row?.id || seen.has(row.id)) return;
    if (pageId && row.id === pageId) return;
    seen.add(row.id);
    pages.push(row);
  };

  try {
    const vec = await embed(prompt);
    const pgVec = toPgVector(vec);
    if (pgVec) {
      const similar = await query<{ id: string; title: string; content: string }>(
        `
          select id, title, content
          from page
          order by embedding <=> $1::vector
          limit 5
        `,
        [pgVec]
      );
      similar.rows.forEach(addPage);
    }
  } catch {
    // ignore embedding failures
  }

  const recent = await query<{ id: string; title: string; content: string }>(
    `
      select id, title, content
      from page
      order by updated_at desc nulls last, created_at desc
      limit 6
    `
  );
  recent.rows.forEach(addPage);

  if (!pages.length) return "";

  const textSnippets: string[] = [];
  const latexSnippets: string[] = [];
  for (const p of pages) {
    textSnippets.push(stripHtml(p.content).slice(0, 600));
    latexSnippets.push(...extractLatexSnippets(p.content));
  }

  const keywords = extractKeywords(textSnippets, 16);
  const latexTokens = extractLatexTokens(latexSnippets, 12);

  const noteSummaries = pages.slice(0, 4).map((p) => {
    const text = stripHtml(p.content).slice(0, 220);
    return `- ${p.title}: ${text}`;
  });

  const lines = ["Relevant note context:", ...noteSummaries];
  if (keywords.length) {
    lines.push("", "Common terms used in your notes:");
    lines.push(keywords.map((t) => `\`${t}\``).join(", "));
  }
  if (latexTokens.length) {
    lines.push("", "Common symbols/commands used in your notes:");
    lines.push(latexTokens.map((t) => `\`${t}\``).join(", "));
  }

  return lines.join("\n");
}

export function registerAIRoutes(app: FastifyInstance) {
  const InlineSuggestInput = z.object({
    pageId: z.string().uuid().optional(),
    selectionText: z.string().default(""),
    cursorBefore: z.string().default(""),
    cursorAfter: z.string().default(""),
    mode: z
      .enum(["continue", "rewrite", "fix", "summarize", "explain"])
      .default("continue"),
    tone: z.string().default("neutral"),
    maxTokens: z.number().int().min(32).max(512).default(180),
    variants: z.number().int().min(1).max(5).default(1),
    instruction: z.string().optional(),
    replaceRange: z
      .object({
        from: z.number().int().min(0),
        to: z.number().int().min(0),
      })
      .optional(),
  });

  app.post("/ai/latex-from-text", async (req, reply) => {
    const LatexFromTextInput = z.object({
      prompt: z.string().min(3),
      displayMode: z.boolean().optional().default(false),
      pageId: z.string().uuid().optional(),
    });

    const { prompt, displayMode, pageId } = LatexFromTextInput.parse(
      req.body ?? {}
    );

    let pageContext = "";
    if (pageId) {
      const p = await query<{ title: string }>(
        "select title from page where id=$1 limit 1",
        [pageId]
      );
      if (p.rows.length) {
        pageContext = `Current page title: ${p.rows[0].title}`;
      }
    }

    const contextualNotes = await buildLatexContext({ prompt, pageId });
    
    const system = [
      "You are a LaTeX equation generator.",
      "Output only valid LaTeX expression text.",
      "Do not include markdown code fences.",
      "Do not include dollar signs or math delimiters like \\( \\), \\[ \\], or $$.",
      displayMode
        ? "Generate for display math (block equation)."
        : "Generate for inline math.",
    ].join(" ");
    const user = [
      `Plain English request: ${prompt}`,
      pageContext,
      contextualNotes,
      "Return only LaTeX.",
    ]
      .filter(Boolean)
      .join("\n\n");

    let latex = cleanLatexCandidate(await genText(system, user));

    const firstValidation = validateLatex(latex, displayMode);
    if (!firstValidation.ok) {
      const repairPrompt = [
        "Fix this LaTeX so it parses with KaTeX.",
        `Error: ${firstValidation.error}`,
        `LaTeX: ${latex}`,
        "Return only repaired LaTeX, without markdown fences or dollar signs.",
      ].join("\n");
      latex = cleanLatexCandidate(await genText(system, repairPrompt));
    }

    const finalValidation = validateLatex(latex, displayMode);
    if (!finalValidation.ok) {
      return reply.code(422).send({
        error: "Unable to generate valid LaTeX",
        details: finalValidation.error,
      });
    }

    return {
      latex,
      kind: displayMode ? "block" : "inline",
      valid: true,
    };
  });

  app.post("/ai/inline-suggest", async (req, reply) => {
    const parsed = InlineSuggestInput.parse(req.body ?? {});
    const {
      pageId,
      selectionText,
      cursorBefore,
      cursorAfter,
      mode,
      tone,
      maxTokens,
      variants,
      instruction,
      replaceRange,
    } = parsed;

    const ctx = await buildInlineSuggestContext({
      pageId,
      selectionText,
      cursorBefore,
      cursorAfter,
      mode,
      tone,
      maxTokens,
      instruction,
    });
    const primaryRaw = await genText(ctx.system, ctx.user);
    const primary = cleanInlineSuggestion(primaryRaw, mode, selectionText);
    const suggestions = await buildInlineVariants({
      primary,
      variants,
      mode,
      selectionText,
      system: ctx.system,
    });
    if (!suggestions.length || !suggestions[0]?.trim()) {
      return reply.code(503).send({
        error:
          "Inline suggestion unavailable. Verify configured LLM provider connectivity.",
      });
    }

    return {
      suggestion: suggestions[0] || "",
      suggestions,
      replaceRange:
        replaceRange ??
        (() => {
          const len = selectionText.length;
          return { from: 0, to: len };
        })(),
      confidence: suggestions[0] ? 0.82 : 0.24,
      citations: pageId ? [{ type: "page", id: pageId }] : [],
    };
  });

  app.post("/ai/inline-suggest/stream", async (req, reply) => {
    const parsed = InlineSuggestInput.parse(req.body ?? {});
    const {
      pageId,
      selectionText,
      cursorBefore,
      cursorAfter,
      mode,
      tone,
      maxTokens,
      variants,
      instruction,
      replaceRange,
    } = parsed;

    const ctx = await buildInlineSuggestContext({
      pageId,
      selectionText,
      cursorBefore,
      cursorAfter,
      mode,
      tone,
      maxTokens,
      instruction,
    });

    const origin = (req.headers.origin as string | undefined) || "*";
    reply.raw.setHeader("Access-Control-Allow-Origin", origin);
    reply.raw.setHeader("Vary", "Origin");
    reply.raw.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    reply.raw.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.hijack();

    let primaryRaw = "";
    const writeEvent = (event: string, data: any) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const streamed = await genTextStream(ctx.system, ctx.user, async (token) => {
      primaryRaw += token;
      writeEvent("token", { text: token });
    });

    const primary = cleanInlineSuggestion(
      streamed || primaryRaw,
      mode,
      selectionText
    );
    const suggestions = await buildInlineVariants({
      primary,
      variants,
      mode,
      selectionText,
      system: ctx.system,
    });
    if (!suggestions.length || !suggestions[0]?.trim()) {
      writeEvent("error", {
        error:
          "Inline suggestion unavailable. Verify configured LLM provider connectivity.",
      });
      writeEvent("done", {
        suggestion: "",
        suggestions: [],
        replaceRange:
          replaceRange ??
          (() => {
            const len = selectionText.length;
            return { from: 0, to: len };
          })(),
        confidence: 0,
        citations: pageId ? [{ type: "page", id: pageId }] : [],
      });
      reply.raw.end();
      return;
    }

    writeEvent("done", {
      suggestion: suggestions[0] || "",
      suggestions,
      replaceRange:
        replaceRange ??
        (() => {
          const len = selectionText.length;
          return { from: 0, to: len };
        })(),
      confidence: suggestions[0] ? 0.82 : 0.24,
      citations: pageId ? [{ type: "page", id: pageId }] : [],
    });
    reply.raw.end();
  });

  // RELATED by cosine distance
  app.post("/ai/related", async (req, reply) => {
    const { pageId, k } = (req.body as any) ?? {};
    const limit = Math.min(Number(k || 5), 20);

    const base = await query<{
      title: string;
      content: string;
      embedding: any;
    }>("select title, content, embedding from page where id=$1", [pageId]);
    if (!base.rows.length) return [];

    // If no stored embedding yet, compute on the fly (and persist)
    let vec = toPgVector(base.rows[0].embedding);
    if (!vec) {
      const e = await embed(`${base.rows[0].title}\n\n${base.rows[0].content}`);
      if (e && e.length) {
        vec = toPgVector(e);
        if (vec)
          await query("update page set embedding = $1::vector where id = $2", [
            vec,
            pageId,
          ]);
      } else {
        return []; // cannot compute related without an embedding
      }
    }

    const rows = await query<{ id: string; title: string }>(
      `
      select id, title
      from page
      where id <> $1
      order by embedding <=> $2::vector
      limit $3
    `,
      [pageId, vec, limit]
    );

    return rows.rows;
  });

  // Semantic search by query text (cosine), keyword fallback if embedding fails
  app.post("/ai/search", async (req, reply) => {
    const SearchInput = z.object({
      query: z.string().min(1),
      tags: z.array(z.string()).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      authorId: z.string().optional(),
    });
    const {
      query: q,
      tags,
      dateFrom,
      dateTo,
      authorId,
    } = SearchInput.parse(req.body ?? {});

    const vec = await embed(q);
    if (!vec) {
      const rows = await query(
        "select id, title from page where title ilike $1 or content ilike $1 limit 10",
        [`%${q}%`]
      );
      return rows.rows;
    }
    const pgVec = toPgVector(vec);
    const rows = await query<{ id: string; title: string }>(
      `
      select id, title
      from page
      order by embedding <=> $1::vector
      limit 10
    `,
      [pgVec]
    );
    return rows.rows;
  });

  app.post("/ai/suggest-tags", async (req, reply) => {
    const { pageId } = (req.body as any) ?? {};
    if (!pageId) return reply.code(400).send({ error: "pageId required" });

    // fetch page content
    const res = await query<{ title: string; content: string }>(
      "select title, content from page where id=$1",
      [pageId]
    );
    if (!res.rows.length)
      return reply.code(404).send({ error: "page not found" });

    const { title, content } = res.rows[0];
    const text = `${title}\n\n${content}`;

    // extract keywords using keyword-extractor
    const keywords = keywordExtractor.extract(text, {
      language: "english",
      remove_digits: true,
      return_changed_case: true,
      remove_duplicates: false,
    });

    // rank by frequency, filter out very short ones
    const counts = new Map<string, number>();
    for (const k of keywords) {
      if (k.length < 3) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    // sort by count desc, then length asc (shorter tags nicer)
    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
      .map(([k]) => k);

    // normalize to nice tag slugs/labels, dedupe, pick top 3–5
    const seen = new Set<string>();
    const suggestions: string[] = [];
    for (const raw of ranked) {
      const clean = toKebab(raw).replace(/^-+|-+$/g, "");
      if (!clean || clean.length < 3) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      suggestions.push(clean);
      if (suggestions.length >= 5) break;
    }

    // if we didn’t find enough, fall back to title tokens
    if (suggestions.length < 3) {
      const extra = title.split(/\W+/).map(toKebab).filter(Boolean);
      for (const e of extra) {
        if (!seen.has(e)) {
          seen.add(e);
          suggestions.push(e);
          if (suggestions.length >= 5) break;
        }
      }
    }

    return { tags: suggestions };
  });
}

function cleanInlineSuggestion(
  raw: string | null,
  mode: "continue" | "rewrite" | "fix" | "summarize" | "explain",
  selectionText: string
) {
  if (raw && typeof raw === "string") {
    const cleaned = raw
      .replace(/^```[\w-]*\n?/g, "")
      .replace(/```$/g, "")
      .replace(/^["']+|["']+$/g, "")
      .trim();
    if (cleaned) return cleaned;
  }
  return "";
}

async function buildInlineSuggestContext({
  pageId,
  selectionText,
  cursorBefore,
  cursorAfter,
  mode,
  tone,
  maxTokens,
  instruction,
}: {
  pageId?: string;
  selectionText: string;
  cursorBefore: string;
  cursorAfter: string;
  mode: "continue" | "rewrite" | "fix" | "summarize" | "explain";
  tone: string;
  maxTokens: number;
  instruction?: string;
}) {
  let pageContext = "";
  if (pageId) {
    const p = await query<{ title: string; content: string }>(
      "select title, content from page where id=$1 limit 1",
      [pageId]
    );
    if (p.rows.length) {
      const { title, content } = p.rows[0];
      pageContext = `Page title: ${title}\nPage content (excerpt): ${stripHtml(
        content
      ).slice(0, 2000)}`;
    }
  }

  const contextualNotes = await buildWritingContext({
    prompt: [selectionText, cursorBefore, cursorAfter].filter(Boolean).join("\n"),
    pageId,
  });

  const taskByMode: Record<typeof mode, string> = {
    continue:
      "Continue the draft naturally from the cursor position using the same voice. Do not repeat the text before the cursor. Return only the next continuation text.",
    rewrite:
      "Rewrite the selected text for clarity while preserving meaning.",
    fix: "Fix grammar, spelling, punctuation, and awkward phrasing.",
    summarize: "Summarize the selected text into a concise version.",
    explain: "Explain the selected text clearly in simpler language.",
  };

  const system = [
    "You are an inline writing assistant for a notes app.",
    "Return plain text only. No markdown fences. No surrounding quotes.",
    instruction
      ? "You may include LaTeX math using $...$ for inline and $$...$$ for block equations if requested."
      : "Keep the suggestion concise and directly usable in the document.",
    `Target tone: ${tone}.`,
    `Maximum length: about ${Math.max(20, Math.floor(maxTokens * 0.75))} words.`,
  ].join(" ");

  const user = [
    instruction ? `User Instruction: ${instruction}` : `Task: ${taskByMode[mode]}`,
    selectionText ? `Selected text:\n${selectionText}` : "Selected text: (none)",
    `Text before cursor:\n${cursorBefore}`,
    `Text after cursor:\n${cursorAfter}`,
    pageContext,
    contextualNotes,
    mode === "continue"
      ? "Write only what should be inserted at the cursor as a continuation."
      : "",
    "Return only the suggested replacement/continuation text.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { system, user };
}

async function buildInlineVariants({
  primary,
  variants,
  mode,
  selectionText,
  system,
}: {
  primary: string;
  variants: number;
  mode: "continue" | "rewrite" | "fix" | "summarize" | "explain";
  selectionText: string;
  system: string;
}) {
  const out = [primary].filter(Boolean);
  const target = Math.max(1, variants);
  for (let i = 1; i < target; i++) {
    const altPrompt = [
      "Create an alternative to this inline suggestion.",
      `Base suggestion: ${primary}`,
      mode === "continue"
        ? "Alternative should continue with a different angle."
        : "Alternative should preserve meaning but vary wording.",
      selectionText ? `Original selected text:\n${selectionText}` : "",
      "Return only the alternative text.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const altRaw = await genText(system, altPrompt);
    const alt = cleanInlineSuggestion(altRaw, mode, selectionText);
    if (!alt) continue;
    if (out.includes(alt)) continue;
    out.push(alt);
  }
  return out.length ? out : [];
}

function cleanLatexCandidate(raw: string | null) {
  const cleaned = String(raw || "")
    .replace(/^```[\w-]*\n?/g, "")
    .replace(/```$/g, "")
    .trim()
    .replace(/^\$+\s*/, "")
    .replace(/\s*\$+$/, "")
    .replace(/^\\\[\s*/, "")
    .replace(/\s*\\\]$/, "")
    .replace(/^\\\(\s*/, "")
    .replace(/\s*\\\)$/, "")
    .trim();
  return cleaned;
}

function validateLatex(latex: string, displayMode: boolean) {
  if (!latex) return { ok: false as const, error: "empty latex" };
  try {
    katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      strict: "error",
    });
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "invalid latex" };
  }
}
