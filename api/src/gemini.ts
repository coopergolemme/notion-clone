import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  console.warn('[Gemini] GEMINI_API_KEY not set. AI features will fail until it is provided.');
}

export const genAI = new GoogleGenerativeAI(apiKey);

// Models
export const EMBEDDING_MODEL = 'text-embedding-004';   // 768-d
export const GENERATION_MODEL = 'gemini-1.5-flash';

// Helpers to get models
export function getEmbeddingModel() {
  return genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
}

export function getGenerationModel() {
  return genAI.getGenerativeModel({ model: GENERATION_MODEL });
}
