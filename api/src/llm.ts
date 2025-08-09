import fetch from 'node-fetch'

let pipelineCache: any = null

export async function localGenerate(prompt: string): Promise<string | null> {
  try {
    const { pipeline } = await import('@xenova/transformers')
    if (!pipelineCache) {
      // small, CPU-friendly model; swap to a better one if your machine can handle it
      pipelineCache = await pipeline('text-generation', 'Xenova/distilgpt2')
    }
    const out = await pipelineCache(prompt, { max_new_tokens: 220, temperature: 0.7, top_p: 0.9 })
    const text = Array.isArray(out) ? out[0]?.generated_text || '' : String(out || '')
    return text.slice(prompt.length).trim()
  } catch (e) {
    console.warn('localGenerate failed:', (e as Error).message)
    return null
  }
}

export async function openaiChat(system: string, user: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [
      { role:'system', content: system },
      { role:'user', content: user }
    ]})
  })
  const j: any = await r.json()
  return j?.choices?.[0]?.message?.content ?? null
}
