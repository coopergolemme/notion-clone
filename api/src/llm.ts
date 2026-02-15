// api/src/llm.ts
import { getGenerationModel } from "./gemini.js";
import fetch from "node-fetch";

const LLM_PROVIDER = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b-instruct";
const LLM_FALLBACK_TO_GEMINI =
  (process.env.LLM_FALLBACK_TO_GEMINI || "true").toLowerCase() === "true";

/**
 * Generate a response using Gemini 1.5 Flash.
 * Returns string or null on failure.
 */
export async function genText(
  system: string,
  user: string
): Promise<string | null> {
  if (LLM_PROVIDER === "ollama") {
    const out = await genTextWithOllama(system, user);
    if (out) return out;
    if (!LLM_FALLBACK_TO_GEMINI) return null;
    console.warn("[genText] Ollama failed, falling back to Gemini");
  }

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
  if (LLM_PROVIDER === "ollama") {
    const out = await genTextStreamWithOllama(system, user, onToken);
    if (out) return out;
    if (!LLM_FALLBACK_TO_GEMINI) return null;
    console.warn("[genTextStream] Ollama failed, falling back to Gemini");
  }

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

async function genTextWithOllama(
  system: string,
  user: string
): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system,
        prompt: user,
        stream: false,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[genTextWithOllama] HTTP ${res.status}: ${txt}`);
      return null;
    }
    const json: any = await res.json();
    const out = String(json?.response || "").trim();
    return out || null;
  } catch (e: any) {
    console.warn("[genTextWithOllama] error:", e?.message || e);
    return null;
  }
}

async function genTextStreamWithOllama(
  system: string,
  user: string,
  onToken: (token: string) => void | Promise<void>
): Promise<string | null> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        system,
        prompt: user,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      console.warn(`[genTextStreamWithOllama] HTTP ${res.status}: ${txt}`);
      return null;
    }

    let full = "";
    let buffer = "";
    for await (const chunk of res.body as any) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let obj: any = null;
        try {
          obj = JSON.parse(trimmed);
        } catch {
          continue;
        }
        const piece = String(obj?.response || "");
        if (piece) {
          full += piece;
          await onToken(piece);
        }
      }
    }

    if (buffer.trim()) {
      try {
        const last = JSON.parse(buffer.trim());
        const piece = String(last?.response || "");
        if (piece) {
          full += piece;
          await onToken(piece);
        }
      } catch {}
    }

    return full.trim() || null;
  } catch (e: any) {
    console.warn("[genTextStreamWithOllama] error:", e?.message || e);
    return null;
  }
}
