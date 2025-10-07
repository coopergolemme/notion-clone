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
