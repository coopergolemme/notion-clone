// api/src/embeddings.ts
import fetch from "node-fetch";
import crypto from "crypto";

const DIM = 1536;

function hashToken(token: string): number {
  const h = crypto.createHash("sha256").update(token).digest();
  return h.readUInt32LE(0) % DIM;
}

// Local, free embedder using hashed bag-of-words
export async function embedLocal(text: string): Promise<number[] | null> {
  try {
    const vec = new Array<number>(DIM).fill(0);
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const idx = hashToken(t);
      vec[idx] += 1;
    }
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    for (let i = 0; i < DIM; i++) vec[i] /= norm;
    return vec;
  } catch (e) {
    console.warn(
      "embedLocal failed, will try OpenAI fallback if present:",
      (e as Error)?.message
    );
    return null;
  }
}

// Optional OpenAI fallback (if env key exists)
export async function embedOpenAI(input: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input }),
  });
  const data = await resp.json();
  const vec = data?.data?.[0]?.embedding;
  return Array.isArray(vec) ? vec : null;
}

// Unified embed() — prefer local, fallback to OpenAI
export async function embed(text: string): Promise<number[] | null> {
  const vLocal = await embedLocal(text);
  console.log("embedLocal result:", vLocal);
  if (vLocal && vLocal.length) return vLocal;
  return await embedOpenAI(text);
}
