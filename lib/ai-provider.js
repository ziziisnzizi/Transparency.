import { createGroundingPrompt } from './product-answers.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const providerIssues = new Set(['key_invalid', 'permission_denied', 'quota_exceeded', 'model_unavailable', 'request_rejected', 'timeout', 'invalid_response', 'unavailable']);

class GeminiProviderError extends Error {
  constructor(issue) {
    super('AI provider unavailable');
    this.name = 'GeminiProviderError';
    this.providerIssue = providerIssues.has(issue) ? issue : 'unavailable';
  }
}

export function getProviderIssue(error) {
  return error instanceof GeminiProviderError && providerIssues.has(error.providerIssue) ? error.providerIssue : 'unavailable';
}

async function classifyProviderResponse(response) {
  let payload;
  try { payload = await response.json(); } catch { /* Classification can use the status alone. */ }
  const error = payload?.error;
  const status = typeof error?.status === 'string' ? error.status : '';
  const reasons = Array.isArray(error?.details)
    ? error.details.slice(0, 16).map(detail => typeof detail?.reason === 'string' ? detail.reason : '')
    : [];
  const message = typeof error?.message === 'string' ? error.message.slice(0, 4000) : '';
  // Inspect provider text only in memory. Never attach it to errors or responses.
  if (reasons.some(reason => ['API_KEY_INVALID', 'API_KEY_EXPIRED', 'API_KEY_MISSING', 'CREDENTIALS_MISSING'].includes(reason))
    || response.status === 401 || status === 'UNAUTHENTICATED'
    || /api[ _-]?key (?:not valid|is invalid|has expired|expired)|invalid api[ _-]?key/i.test(message)) return 'key_invalid';
  if (response.status === 429 || status === 'RESOURCE_EXHAUSTED') return 'quota_exceeded';
  if (response.status === 403 || status === 'PERMISSION_DENIED'
    || reasons.some(reason => /API_KEY_(?:SERVICE|HTTP_REFERRER|IP_ADDRESS|ANDROID_APP|IOS_APP)_BLOCKED|SERVICE_DISABLED|ACCESS_TOKEN_SCOPE_INSUFFICIENT/.test(reason))) return 'permission_denied';
  if (response.status === 404 || status === 'NOT_FOUND') return 'model_unavailable';
  if (response.status === 400 || status === 'INVALID_ARGUMENT') return 'request_rejected';
  return 'unavailable';
}

export function geminiConfiguration(env = process.env) {
  const key = typeof env.GEMINI_API_KEY === 'string' && env.GEMINI_API_KEY.trim()
    || typeof env.GOOGLE_API_KEY === 'string' && env.GOOGLE_API_KEY.trim()
    || '';
  const configuredModel = typeof env.GEMINI_MODEL === 'string' ? env.GEMINI_MODEL.replace(/^models\//, '').trim() : '';
  const model = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(configuredModel) ? configuredModel : DEFAULT_GEMINI_MODEL;
  return { key, model };
}

export async function generateProductAnswer(product, question, { apiKey, model = DEFAULT_GEMINI_MODEL, fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
  if (!apiKey || typeof fetchImpl !== 'function' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(model)) throw new GeminiProviderError('unavailable');
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
    if (!response.ok) throw new GeminiProviderError(await classifyProviderResponse(response));
    let raw;
    try { raw = await response.json(); } catch { throw new GeminiProviderError('invalid_response'); }
    const candidate = raw?.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw new GeminiProviderError('invalid_response');
    const text = candidate?.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('') || '';
    let result;
    try { result = JSON.parse(text); } catch { throw new GeminiProviderError('invalid_response'); }
    if (!result || typeof result.answer !== 'string' || !result.answer.trim() || result.answer.length > 3000 || result.answer.includes(apiKey) || !Array.isArray(result.sourceIds)) throw new GeminiProviderError('invalid_response');
    if (!result.sourceIds.length || result.sourceIds.length > 6 || result.sourceIds.some(id => typeof id !== 'string' || !known.has(id))) throw new GeminiProviderError('invalid_response');
    const sources = [...new Set(result.sourceIds)].map(id => known.get(id));
    return { answer: result.answer.trim(), sources };
  } catch (error) {
    if (error instanceof GeminiProviderError) throw error;
    throw new GeminiProviderError(controller.signal.aborted ? 'timeout' : 'unavailable');
  } finally {
    clearTimeout(timeout);
  }
}
