// api/src/llm.ts
import { getGenerationModel } from "./gemini.js";

/**
 * Generate a response using Gemini 1.5 Flash.
 * Returns string or null on failure.
 */
export async function genText(
  system: string,
  user: string
): Promise<string | null> {
  try {
    const model = getGenerationModel();
    // We can emulate a "system" + "user" by concatenating with clear separators.
    const prompt = `System:\n${system}\n\nUser:\n${user}\n\nAssistant:`;
    const res = await model.generateContent(prompt);
    const out =
      (res?.response as any)?.text?.() ??
      (await (res as any)?.response?.text());
    return typeof out === "string" ? out.trim() : null;
  } catch (e: any) {
    console.warn("[genText] Gemini error:", e?.message || e);
    return null;
  }
}

/**
 * Stream token chunks from Gemini. Calls onToken for each emitted fragment.
 * Returns final concatenated text, or null on failure.
 */
export async function genTextStream(
  system: string,
  user: string,
  onToken: (token: string) => void | Promise<void>
): Promise<string | null> {
  try {
    const model = getGenerationModel();
    const prompt = `System:\n${system}\n\nUser:\n${user}\n\nAssistant:`;
    const result: any = await (model as any).generateContentStream(prompt);

    let full = "";
    for await (const chunk of result.stream as AsyncIterable<any>) {
      const piece =
        (chunk?.text?.() as string | undefined) ??
        chunk?.candidates?.[0]?.content?.parts
          ?.map((p: any) => p?.text || "")
          .join("");
      if (!piece) continue;
      full += piece;
      await onToken(piece);
    }

    if (!full?.trim()) {
      const fallback =
        (result?.response as any)?.text?.() ??
        (await (result as any)?.response?.text?.());
      if (typeof fallback === "string" && fallback.trim()) {
        full = fallback.trim();
      }
    }

    return full?.trim() ? full.trim() : null;
  } catch (e: any) {
    console.warn("[genTextStream] Gemini error:", e?.message || e);
    return null;
  }
}
