import { analyzeConcern, validateConcernQuery } from '../lib/concern-search.js';
import { geminiConfiguration } from '../lib/ai-provider.js';
import { generateConcernCreative, hasSensitiveCreativeContext } from '../lib/concern-creative-provider.js';

const limitBytes = 4096;
const header = (req, name) => { const v = req.headers?.[name.toLowerCase()]; return Array.isArray(v) ? v[0] : typeof v === 'string' ? v : ''; };
const send = (res, code, body, extra = {}) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Vary', 'Origin'); for (const [name, value] of Object.entries(extra)) res.setHeader(name, value); res.end(JSON.stringify(body)); };
function sameOrigin(req) {
  const origin = header(req, 'origin');
  if (!origin) return true;
  try { const host = header(req, 'host'); const protocol = header(req, 'x-forwarded-proto').split(',')[0].trim() || (req.socket?.encrypted ? 'https' : 'http'); return !!host && ['http', 'https'].includes(protocol) && new URL(origin).origin === new URL(`${protocol}://${host}`).origin; } catch { return false; }
}
async function parseBody(req) {
  const length = header(req, 'content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limitBytes)) return { error: 413 };
  if (header(req, 'content-type').split(';')[0].trim().toLowerCase() !== 'application/json') return { error: 415 };
  let body = req.body;
  if (body === undefined) {
    if (typeof req?.[Symbol.asyncIterator] !== 'function') return { error: 400 };
    const chunks = []; let size = 0;
    const stream = typeof req.iterator === 'function' ? req.iterator({ destroyOnReturn: false }) : req;
    for await (const chunk of stream) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += bytes.length; if (size > limitBytes) { req.resume?.(); return { error: 413 }; } chunks.push(bytes); }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') { if (Buffer.byteLength(body, 'utf8') > limitBytes) return { error: 413 }; try { body = JSON.parse(body); } catch { return { error: 400 }; } }
  try { if (Buffer.byteLength(JSON.stringify(body) || '', 'utf8') > limitBytes) return { error: 413 }; } catch { return { error: 400 }; }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'query')) return { error: 400 };
  const validation = validateConcernQuery(body.query);
  return validation.error ? { error: 400 } : { query: validation.query };
}
export function createConcernCreativeHandler({ env = process.env, fetchImpl = globalThis.fetch, now = Date.now, rateLimit = 12, rateWindowMs = 60000, timeoutMs = 25000 } = {}) {
  const buckets = new Map();
  return async function concernCreative(req, res) {
    try {
      if (!sameOrigin(req)) return send(res, 403, { status: 'unavailable' });
      if (req.method !== 'POST') return send(res, 405, { status: 'unavailable' }, { Allow: 'POST' });
      const parsed = await parseBody(req);
      if (parsed.error) return send(res, parsed.error, { status: 'unavailable' });
      const analysis = analyzeConcern(parsed.query);
      // Never turn health, exclusion or crisis requests into sales copy.
      if (hasSensitiveCreativeContext(parsed.query, analysis)) return send(res, 200, { status: 'caution' });
      const { key, model } = geminiConfiguration(env);
      if (!key) return send(res, 503, { status: 'unavailable' });
      const time = now();
      for (const [address, bucket] of buckets) if (bucket.expires <= time) buckets.delete(address);
      const address = (header(req, 'x-forwarded-for').split(',')[0].trim() || req.socket?.remoteAddress || 'anonymous').slice(0, 128);
      const current = buckets.get(address) || { count: 0, expires: time + rateWindowMs };
      if (current.count >= rateLimit || (!buckets.has(address) && buckets.size >= 2000)) return send(res, 429, { status: 'unavailable' }, { 'Retry-After': String(Math.max(1, Math.ceil((current.expires - time) / 1000))) });
      current.count++; buckets.set(address, current);
      const controller = new AbortController();
      const disconnect = () => { if (!res.writableEnded) controller.abort(); };
      res.once?.('close', disconnect);
      try {
        const result = await generateConcernCreative(parsed.query, { apiKey: key, model, fetchImpl, timeoutMs, signal: controller.signal });
        return send(res, 200, result);
      } catch { return send(res, 503, { status: 'unavailable' }); }
      finally { res.removeListener?.('close', disconnect); }
    } catch { return send(res, 500, { status: 'unavailable' }); }
  };
}
export default createConcernCreativeHandler();
