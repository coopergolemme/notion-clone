import keywordExtractor from "keyword-extractor";
import { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { embed } from "../embeddings.js";
import { toPgVector } from "../pgvector.js";
import { genText } from "../llm.js";
import katex from "katex";
import { z } from "zod";

function toKebab(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function registerAIRoutes(app: FastifyInstance) {
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

    const system = [
      "You are a LaTeX equation generator.",
      "Output only valid LaTeX expression text.",
      "Do not include markdown code fences.",
      "Do not include dollar signs.",
      displayMode
        ? "Generate for display math (block equation)."
        : "Generate for inline math.",
    ].join(" ");
    const user = [
      `Plain English request: ${prompt}`,
      pageContext,
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
      replaceRange: z
        .object({
          from: z.number().int().min(0),
          to: z.number().int().min(0),
        })
        .optional(),
    });

    const parsed = InlineSuggestInput.parse(req.body ?? {});
    const {
      pageId,
      selectionText,
      cursorBefore,
      cursorAfter,
      mode,
      tone,
      maxTokens,
      replaceRange,
    } = parsed;

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

    const taskByMode: Record<typeof mode, string> = {
      continue:
        "Continue the draft naturally from the cursor position using the same voice.",
      rewrite:
        "Rewrite the selected text for clarity while preserving meaning.",
      fix: "Fix grammar, spelling, punctuation, and awkward phrasing.",
      summarize: "Summarize the selected text into a concise version.",
      explain: "Explain the selected text clearly in simpler language.",
    };

    const system = [
      "You are an inline writing assistant for a notes app.",
      "Return plain text only. No markdown fences. No surrounding quotes.",
      "Keep the suggestion concise and directly usable in the document.",
      `Target tone: ${tone}.`,
      `Maximum length: about ${Math.max(20, Math.floor(maxTokens * 0.75))} words.`,
    ].join(" ");

    const user = [
      `Task: ${taskByMode[mode]}`,
      selectionText
        ? `Selected text:\n${selectionText}`
        : "Selected text: (none)",
      `Text before cursor:\n${cursorBefore}`,
      `Text after cursor:\n${cursorAfter}`,
      pageContext,
      "Return only the suggested replacement/continuation text.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await genText(system, user);
    const suggestion = cleanInlineSuggestion(raw, mode, selectionText);

    return {
      suggestion,
      replaceRange:
        replaceRange ??
        (() => {
          const len = selectionText.length;
          return { from: 0, to: len };
        })(),
      confidence: suggestion ? 0.82 : 0.24,
      citations: pageId ? [{ type: "page", id: pageId }] : [],
    };
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

function stripHtml(input: string) {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
  if (mode === "continue") return "Continue the paragraph with a specific point.";
  return selectionText || "";
}

function cleanLatexCandidate(raw: string | null) {
  const cleaned = String(raw || "")
    .replace(/^```[\w-]*\n?/g, "")
    .replace(/```$/g, "")
    .trim()
    .replace(/^\$+\s*/, "")
    .replace(/\s*\$+$/, "")
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
