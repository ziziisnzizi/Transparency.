import { validateQuestionInput, getReferenceAnswer } from '../lib/product-answers.js';
import { geminiConfiguration, generateProductAnswer, getProviderIssue } from '../lib/ai-provider.js';

export const MAX_REQUEST_BYTES = 4096;

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

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
    if (!host || !['http', 'https'].includes(protocol)) return false;
    return new URL(origin).origin === new URL(`${protocol}://${host}`).origin;
  } catch { return false; }
}

async function requestBody(req) {
  const length = header(req, 'content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) throw new RequestError(413, '질문 데이터가 너무 큽니다. 질문을 줄여 주세요.');
  const type = header(req, 'content-type').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new RequestError(415, 'JSON 형식으로 질문을 보내 주세요.');
  let body = req.body;
  if (body === undefined) {
    if (!req || typeof req[Symbol.asyncIterator] !== 'function') throw new RequestError(400, '질문을 확인해 주세요.');
    const chunks = [];
    let bytes = 0;
    const stream = typeof req.iterator === 'function' ? req.iterator({ destroyOnReturn: false }) : req;
    for await (const chunk of stream) {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += data.length;
      if (bytes > MAX_REQUEST_BYTES) {
        req.resume?.();
        throw new RequestError(413, '질문 데이터가 너무 큽니다. 질문을 줄여 주세요.');
      }
      chunks.push(data);
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) throw new RequestError(413, '질문 데이터가 너무 큽니다. 질문을 줄여 주세요.');
    try { return JSON.parse(body); } catch { throw new RequestError(400, '질문 형식을 확인해 주세요.'); }
  }
  try {
    if (Buffer.byteLength(JSON.stringify(body) || '', 'utf8') > MAX_REQUEST_BYTES) throw new RequestError(413, '질문 데이터가 너무 큽니다. 질문을 줄여 주세요.');
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, '질문 형식을 확인해 주세요.');
  }
  return body;
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

export function createAskHandler({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, rateLimit = 20, rateWindowMs = 60000, timeoutMs = 20000 } = {}) {
  const buckets = new Map();
  return async function ask(req, res) {
    try {
      if (!sameOrigin(req)) return send(res, 403, { error: '같은 사이트에서 질문해 주세요.' });
      const configuration = geminiConfiguration(env);
      if (req.method === 'GET') return send(res, 200, { aiAvailable: Boolean(configuration.key), mode: configuration.key ? 'ai' : 'reference' });
      if (req.method !== 'POST') return send(res, 405, { error: '지원하지 않는 요청입니다.' }, { Allow: 'GET, POST' });

      const time = now();
      for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
      const address = (header(req, 'x-forwarded-for').split(',')[0].trim() || req.socket?.remoteAddress || 'anonymous').slice(0, 128);
      const current = buckets.get(address) || { count: 0, expires: time + rateWindowMs };
      if (current.count >= rateLimit || (!buckets.has(address) && buckets.size >= 2000)) return send(res, 429, { error: '질문이 많습니다. 잠시 후 다시 시도해 주세요.' }, { 'Retry-After': String(Math.max(1, Math.ceil((current.expires - time) / 1000))) });
      current.count += 1;
      buckets.set(address, current);

      const input = validateQuestionInput(await requestBody(req));
      if (input.error) return send(res, 400, { error: input.error });
      const reference = getReferenceAnswer(input.product, input.question);
      if (!reference.matched) return send(res, 200, { answer: reference.answer, sources: reference.sources, mode: 'reference', reason: 'no_match' });
      let reason = configuration.key ? 'provider_unavailable' : 'missing_key';
      let providerIssue;
      if (configuration.key) {
        try {
          const answer = await generateProductAnswer(input.product, input.question, { apiKey: configuration.key, model: configuration.model, fetchImpl, timeoutMs });
          return send(res, 200, { ...answer, mode: 'ai' });
        } catch (error) {
          // Never leak provider responses, credentials or request text into logs.
          reason = 'provider_unavailable';
          providerIssue = getProviderIssue(error);
        }
      }
      return send(res, 200, { answer: reference.answer, sources: reference.sources, mode: 'reference', reason, ...(providerIssue ? { providerIssue } : {}) });
    } catch (error) {
      return send(res, error instanceof RequestError ? error.status : 500, { error: error instanceof RequestError ? error.message : '답변을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  };
}

export default createAskHandler();
