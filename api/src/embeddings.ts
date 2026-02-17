// api/src/embeddings.ts
import { EMBEDDING_MODEL, models } from "./gemini.js";

/**
 * Returns a normalized 768-dim embedding using Gemini text-embedding-004.
 * Returns null on failure.
 */
export async function embed(text: string): Promise<number[] | null> {
  try {
    // Gemini SDK: embedContent accepts plain text; returns .embedding.values
    const res: any = await models.embedContent({model: EMBEDDING_MODEL, contents: text});
    const values: number[] | undefined = res?.embedding?.values;
    if (!values || !Array.isArray(values) || values.length === 0) return null;

    // L2 normalize for cosine ops
    const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
    return values.map((v) => v / norm);
  } catch (e: any) {
    console.warn("[embed] Gemini error:", e?.message || e);
    return null;
  }
}
