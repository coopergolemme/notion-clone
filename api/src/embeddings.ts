import fetch from 'node-fetch';

export type Embedder = (input: string) => Promise<number[] | null>;

export const embed: Embedder = async (input) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input
    })
  });
  const data = await resp.json();
  const vec = data?.data?.[0]?.embedding;
  return Array.isArray(vec) ? vec : null;
};
