import { createGroundingPrompt } from './product-answers.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export function geminiConfiguration(env = process.env) {
  const key = typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim()
    || typeof env.GOOGLE_API_KEY === 'string' && env.GOOGLE_API_KEY.trim()
    || '';
  const configuredModel = typeof env.GEMINI_MODEL === 'string' ? env.GEMINI_MODEL.replace(/^models\//, '').trim() : '';
  const model = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(configuredModel) ? configuredModel : DEFAULT_GEMINI_MODEL;
  return { key, model };
}

export async function generateProductAnswer(product, question, { apiKey, model = DEFAULT_GEMINI_MODEL, fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
  if (!apiKey || typeof fetchImpl !== 'function' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(model)) throw new Error('AI provider unavailable');
  const grounding = createGroundingPrompt(product);
  const known = new Map(grounding.sources.map(source => [source.id, source]));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: grounding.system }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ product: product.name, question, sources: grounding.sources }) }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              answer: { type: 'STRING' },
              sourceIds: { type: 'ARRAY', minItems: 1, maxItems: 6, items: { type: 'STRING', enum: [...known.keys()] } },
            },
            required: ['answer', 'sourceIds'],
          },
        },
      }),
    });
    if (!response.ok) throw new Error('AI provider unavailable');
    const raw = await response.json();
    const candidate = raw?.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new Error('AI answer incomplete');
    const text = candidate?.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('') || '';
    const result = JSON.parse(text);
    if (!result || typeof result.answer !== 'string' || !result.answer.trim() || result.answer.length > 3000 || result.answer.includes(apiKey) || !Array.isArray(result.sourceIds)) throw new Error('AI answer invalid');
    if (!result.sourceIds.length || result.sourceIds.length > 6 || result.sourceIds.some(id => typeof id !== 'string' || !known.has(id))) throw new Error('AI answer lacks valid product sources');
    const sources = [...new Set(result.sourceIds)].map(id => known.get(id));
    return { answer: result.answer.trim(), sources };
  } finally {
    clearTimeout(timeout);
  }
}
