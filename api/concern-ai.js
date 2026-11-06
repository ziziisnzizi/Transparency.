import { validateConcernQuery } from '../lib/concern-search.js';
import { geminiConfiguration } from '../lib/ai-provider.js';
import { ConcernAiError, searchConcernWithGemini } from '../lib/concern-ai-provider.js';
import { searchConcernResearch } from '../lib/concern-research-provider.js';

export const MAX_CONCERN_AI_REQUEST_BYTES = 4096;
const unavailable = '지금 웹 자료를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
class RequestError extends Error { constructor(status, message) { super(message); this.status = status; } }
const header = (req, name) => {
  const value = req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : typeof value === 'string' ? value : '';
};
function sameOrigin(req) {
  const origin = header(req, 'origin');
  if (!origin) return true;
  try {
    const host = header(req, 'host');
    const protocol = header(req, 'x-forwarded-proto').split(',')[0].trim() || (req.socket?.encrypted ? 'https' : 'http');
    return Boolean(host) && ['http', 'https'].includes(protocol) && new URL(origin).origin === new URL(`${protocol}://${host}`).origin;
  } catch { return false; }
}
function send(res, status, body, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Origin');
  for (const [name, value] of Object.entries(extra)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}
async function requestBody(req) {
  const length = header(req, 'content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_CONCERN_AI_REQUEST_BYTES)) throw new RequestError(413, '고민을 조금 줄여서 입력해 주세요.');
  if (header(req, 'content-type').split(';')[0].trim().toLowerCase() !== 'application/json') throw new RequestError(415, 'JSON 형식으로 보내 주세요.');
  let body = req.body;
  if (body === undefined) {
    if (typeof req?.[Symbol.asyncIterator] !== 'function') throw new RequestError(400, '질문을 확인해 주세요.');
    const chunks = []; let bytes = 0;
    const stream = typeof req.iterator === 'function' ? req.iterator({ destroyOnReturn: false }) : req;
    for await (const chunk of stream) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += data.length;
      if (bytes > MAX_CONCERN_AI_REQUEST_BYTES) { req.resume?.(); throw new RequestError(413, '고민을 조금 줄여서 입력해 주세요.'); }
      chunks.push(data);
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_CONCERN_AI_REQUEST_BYTES) throw new RequestError(413, '고민을 조금 줄여서 입력해 주세요.');
    try { body = JSON.parse(body); } catch { throw new RequestError(400, '질문 형식을 확인해 주세요.'); }
  }
  try { if (Buffer.byteLength(JSON.stringify(body) || '', 'utf8') > MAX_CONCERN_AI_REQUEST_BYTES) throw new RequestError(413, '고민을 조금 줄여서 입력해 주세요.'); }
  catch (error) { if (error instanceof RequestError) throw error; throw new RequestError(400, '질문 형식을 확인해 주세요.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'query')) throw new RequestError(400, '고민 문장만 보내 주세요.');
  const validation = validateConcernQuery(body.query);
  if (validation.error) throw new RequestError(400, validation.error);
  return validation.query;
}

export function createConcernAiHandler({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, rateLimit = 12, rateWindowMs = 60000, timeoutMs = 40000 } = {}) {
  const buckets = new Map();
  return async function concernAi(req, res) {
    try {
      if (!sameOrigin(req)) return send(res, 403, { status: 'unavailable', error: '같은 사이트에서 이용해 주세요.' });
      if (req.method !== 'POST') return send(res, 405, { status: 'unavailable', error: '지원하지 않는 요청입니다.' }, { Allow: 'POST' });
      const query = await requestBody(req);
      const { key, model } = geminiConfiguration(env);
      if (!key) return send(res, 503, { status: 'unavailable', error: unavailable, reason: 'provider_not_configured' });
      const time = now();
      for (const [address, bucket] of buckets) if (bucket.expires <= time) buckets.delete(address);
      const address = (header(req, 'x-forwarded-for').split(',')[0].trim() || req.socket?.remoteAddress || 'anonymous').slice(0, 128);
      const current = buckets.get(address) || { count: 0, expires: time + rateWindowMs };
      if (current.count >= rateLimit || (!buckets.has(address) && buckets.size >= 2000)) return send(res, 429, { status: 'unavailable', error: '요청이 많습니다. 잠시 후 다시 시도해 주세요.' }, { 'Retry-After': String(Math.max(1, Math.ceil((current.expires - time) / 1000))) });
      current.count++; buckets.set(address, current);
      const controller = new AbortController();
      const started = performance.now();
      const disconnect = () => { if (!res.writableEnded) controller.abort(); };
      res.once?.('close', disconnect);
      try {
        let result;
        try {
          result = await searchConcernWithGemini(query, { apiKey: key, model, fetchImpl, timeoutMs: Math.min(timeoutMs, 20000), signal: controller.signal });
        } catch (error) {
          if (!(error instanceof ConcernAiError) || error.issue !== 'provider_http_429' || controller.signal.aborted) throw error;
          const remaining = timeoutMs - (performance.now() - started);
          if (remaining < 1000) throw error;
          result = await searchConcernResearch(query, { apiKey: key, fetchImpl, timeoutMs: remaining, signal: controller.signal });
        }
        return send(res, 200, result);
      } catch (error) {
        // Do not log question, provider responses or credentials.
        return send(res, 503, { status: 'unavailable', error: unavailable, reason: error instanceof ConcernAiError ? error.issue : 'provider_unavailable' });
      } finally { res.removeListener?.('close', disconnect); }
    } catch (error) {
      return send(res, error instanceof RequestError ? error.status : 500, { status: 'unavailable', error: error instanceof RequestError ? error.message : unavailable });
    }
  };
}
export default createConcernAiHandler();
