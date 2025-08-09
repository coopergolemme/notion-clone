// api/src/embeddings.ts
import fetch from 'node-fetch';

// Local embedding (free) using @xenova/transformers
let localPipeline: any | null = null;

async function getLocalPipeline() {
  if (localPipeline) return localPipeline;
  const { pipeline } = await import('@xenova/transformers');
  // feature-extraction pipeline with a MiniLM model; runs on CPU, no internet once cached
  localPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  return localPipeline;
}

function meanPool(arr: number[][]): number[] {
  const rows = arr.length;
  const cols = arr[0]?.length || 0;
  const out = new Array(cols).fill(0);
  for (let i = 0; i < rows; i++) {
    const row = arr[i];
    for (let j = 0; j < cols; j++) out[j] += row[j];
  }
  for (let j = 0; j < cols; j++) out[j] /= Math.max(1, rows);
  return out;
}

function l2norm(v: number[]): number {
  let s = 0; for (const x of v) s += x * x; return Math.sqrt(s);
}
function normalize(v: number[]): number[] {
  const n = l2norm(v) || 1; return v.map(x => x / n);
}

// Local, free embedder (preferred)
export async function embedLocal(text: string): Promise<number[] | null> {
  try {
    const pipe = await getLocalPipeline();
    // returns [tokens x dim]; we mean-pool
    const out = await pipe(text, { normalize: false });
    const pooled = meanPool(out.data as number[][]);
    const vec = normalize(pooled);
    return vec;
  } catch (e) {
    console.warn('embedLocal failed, will try OpenAI fallback if present:', (e as Error)?.message);
    return null;
  }
}

// Optional OpenAI fallback (if env key exists)
export async function embedOpenAI(input: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input })
  });
  const data = await resp.json();
  const vec = data?.data?.[0]?.embedding;
  return Array.isArray(vec) ? vec : null;
}

// Unified embed() — prefer local, fallback to OpenAI
export async function embed(text: string): Promise<number[] | null> {
  const vLocal = await embedLocal(text);
  if (vLocal && vLocal.length) return vLocal;
  return await embedOpenAI(text);
}
