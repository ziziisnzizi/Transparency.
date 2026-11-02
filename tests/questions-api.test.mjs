import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { createAskHandler, MAX_REQUEST_BYTES } from '../api/ask.js';
import { buildProductSources, findQuestionProduct } from '../lib/product-answers.js';
import { geminiConfiguration, DEFAULT_GEMINI_MODEL } from '../lib/ai-provider.js';

const fakeKey = 'unit-only-gemini-key-not-a-credential';
const product = findQuestionProduct('serum-s1');
const source = buildProductSources(product).find(item => item.id.endsWith(':routine'));
const validBody = { productSlug: product.slug, question: '사용 순서와 사용량은 어떻게 되나요?' };

function request(body = validBody, options = {}) {
  return {
    method: options.method || 'POST',
    headers: { host: 'example.test', 'content-type': 'application/json', ...options.headers },
    socket: { remoteAddress: options.address || 'unit-address' },
    body,
  };
}

async function invoke(handler, req) {
  const response = { statusCode: 0, headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, end(value) { this.raw = value; } };
  await handler(req, response);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.match(response.headers['content-type'], /application\/json/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  return { status: response.statusCode, headers: response.headers, raw: response.raw, body: JSON.parse(response.raw) };
}

function generated(answer = '토너 다음에 세럼을 사용합니다.', sourceIds = [source.id], options = {}) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ answer, sourceIds }) }] } }], ...options }),
  };
}

test('capability requests are read-only and never disclose credentials or model configuration', async () => {
  for (const [env, expected] of [[{}, { aiAvailable: false, mode: 'reference' }], [{ GEMINI_API_KEY: fakeKey, GEMINI_MODEL: 'private-model' }, { aiAvailable: true, mode: 'ai' }]]) {
    let calls = 0;
    const handler = createAskHandler({ env, fetchImpl: async () => { calls++; throw Error('unexpected provider call'); } });
    const result = await invoke(handler, request(undefined, { method: 'GET' }));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, expected);
    assert.equal(calls, 0);
    assert.ok(!result.raw.includes(fakeKey));
    assert.ok(!result.raw.includes('private-model'));
  }
});

test('keyless questions return explicitly reference-mode answers with only the selected product sources', async () => {
  let calls = 0;
  const handler = createAskHandler({ env: {}, fetchImpl: async () => { calls++; throw Error('unexpected provider call'); } });
  for (const slug of ['toner-t1', 'serum-s1', 'cream-c1']) {
    const result = await invoke(handler, request({ productSlug: slug, question: '주요 성분과 함량을 알려주세요.' }));
    assert.equal(result.status, 200);
    assert.equal(result.body.mode, 'reference');
    assert.equal(result.body.reason, 'missing_key');
    assert.ok(result.body.answer.length > 20);
    assert.ok(result.body.sources.length > 0);
    assert.ok(result.body.sources.every(item => item.id.startsWith(`${slug}:`)));
    assert.ok(result.body.sources.every(item => ['제품 정보', '성분·함량', '효능·근거', '사용 안내'].includes(item.section)));
  }
  assert.equal(calls, 0);
});

test('methods, origins, JSON types, request sizes, and client-supplied facts are rejected before any provider call', async () => {
  let calls = 0;
  const handler = createAskHandler({ env: { GEMINI_API_KEY: fakeKey }, rateLimit: 100, fetchImpl: async () => { calls++; throw Error('unexpected provider call'); } });
  const cases = [
    [request(validBody, { method: 'DELETE' }), 405],
    [request(validBody, { headers: { origin: 'https://foreign.test' } }), 403],
    [request(validBody, { headers: { 'content-type': 'text/plain' } }), 415],
    [request('{bad json'), 400],
    [request(null), 400],
    [request([]), 400],
    [request({ productSlug: 'unknown-product', question: '사용법' }), 400],
    [request({ productSlug: product.slug, question: '' }), 400],
    [request({ productSlug: product.slug, question: '가'.repeat(501) }), 400],
    [request({ productSlug: product.slug, question: '질문\u0000데이터' }), 400],
    [request({ ...validBody, sources: [{ id: 'fake', excerpt: '허위 제품 정보' }] }), 400],
    [request({ ...validBody, apiKey: fakeKey }), 400],
    [request('x'.repeat(MAX_REQUEST_BYTES + 1)), 413],
    [request(validBody, { headers: { 'content-length': String(MAX_REQUEST_BYTES + 1) } }), 413],
  ];
  for (const [req, expectedStatus] of cases) {
    const result = await invoke(handler, req);
    assert.equal(result.status, expectedStatus);
    assert.equal(typeof result.body.error, 'string');
    assert.ok(!result.raw.includes(fakeKey));
    if (expectedStatus === 405) assert.equal(result.headers.allow, 'GET, POST');
  }
  assert.equal(calls, 0);
});

test('same-origin JSON streams and 500-character Korean questions work in the local Node adapter', async () => {
  const handler = createAskHandler({ env: {} });
  const payload = JSON.stringify({ productSlug: product.slug, question: '가'.repeat(500) });
  const req = Readable.from([Buffer.from(payload.slice(0, 30)), Buffer.from(payload.slice(30))]);
  req.method = 'POST';
  req.headers = { host: 'example.test', origin: 'https://example.test', 'x-forwarded-proto': 'https', 'content-type': 'application/json; charset=utf-8' };
  const result = await invoke(handler, req);
  assert.equal(result.status, 200);
  assert.equal(result.body.mode, 'reference');
  assert.equal(result.body.reason, 'no_match');
  assert.deepEqual(result.body.sources, []);

  const oversized = Readable.from([Buffer.alloc(MAX_REQUEST_BYTES + 1, 'x')]);
  oversized.method = 'POST';
  oversized.headers = { host: 'example.test', 'content-type': 'application/json' };
  assert.equal((await invoke(handler, oversized)).status, 413);
});

test('rate limiting applies per request address, excludes GET, and expires using the configured clock', async () => {
  let time = 1000;
  const handler = createAskHandler({ env: {}, now: () => time, rateLimit: 2, rateWindowMs: 1000 });
  for (let i = 0; i < 3; i++) assert.equal((await invoke(handler, request(undefined, { method: 'GET' }))).status, 200);
  assert.equal((await invoke(handler, request())).status, 200);
  assert.equal((await invoke(handler, request())).status, 200);
  const limited = await invoke(handler, request());
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers['retry-after']) >= 1);
  assert.equal((await invoke(handler, request(validBody, { address: 'another-address' }))).status, 200);
  time += 1001;
  assert.equal((await invoke(handler, request())).status, 200);
});

test('Gemini generation keeps the key in a header, grounds on server data, and returns registered citations', async () => {
  let captured;
  const handler = createAskHandler({
    env: { GEMINI_API_KEY: fakeKey },
    fetchImpl: async (url, options) => { captured = { url, options }; return generated(); },
  });
  const result = await invoke(handler, request());
  assert.equal(result.status, 200);
  assert.equal(result.body.mode, 'ai');
  assert.equal(result.body.answer, '토너 다음에 세럼을 사용합니다.');
  assert.deepEqual(result.body.sources, [source]);
  const url = new URL(captured.url);
  assert.equal(url.hostname, 'generativelanguage.googleapis.com');
  assert.equal(url.pathname, `/v1beta/models/${DEFAULT_GEMINI_MODEL}:generateContent`);
  assert.equal(url.search, '');
  assert.equal(captured.options.headers['x-goog-api-key'], fakeKey);
  const payload = JSON.parse(captured.options.body);
  assert.ok(payload.systemInstruction.parts[0].text.includes('제공된 sources'));
  const input = JSON.parse(payload.contents[0].parts[0].text);
  assert.equal(input.question, validBody.question);
  assert.equal(input.product, product.name);
  assert.deepEqual(input.sources, buildProductSources(product));
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
  assert.ok(payload.generationConfig.maxOutputTokens <= 2048);
  assert.ok(!captured.options.body.includes(fakeKey));
  assert.ok(!result.raw.includes(fakeKey));
});

test('provider configuration cannot turn model names into arbitrary network destinations', () => {
  assert.deepEqual(geminiConfiguration({}), { key: '', model: DEFAULT_GEMINI_MODEL });
  assert.deepEqual(geminiConfiguration({ GEMINI_API_KEY: `  ${fakeKey}  `, GEMINI_MODEL: 'models/gemini-2.5-flash' }), { key: fakeKey, model: DEFAULT_GEMINI_MODEL });
  for (const model of ['https://attacker.test/model', '../model', 'x?key=secret', 'model/a', 'x'.repeat(101)]) {
    assert.equal(geminiConfiguration({ GEMINI_MODEL: model }).model, DEFAULT_GEMINI_MODEL);
  }
});

test('provider errors, blocked or incomplete responses, malformed JSON, and unsupported citations fall back safely', async () => {
  const privateMarker = 'unit-private-provider-text';
  const providers = [
    async () => { throw Error(`${fakeKey} ${privateMarker}`); },
    async () => ({ ok: false, status: 429, json: async () => ({ error: fakeKey }) }),
    async () => ({ ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }) }),
    async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] }) }),
    async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not-json' }] } }] }) }),
    async () => generated('모든 피부에 적합합니다.', ['invented:source']),
    async () => generated('제품 정보상 모든 피부에 적합합니다.', ['invented:source']),
  ];
  for (const fetchImpl of providers) {
    const handler = createAskHandler({ env: { GEMINI_API_KEY: fakeKey }, fetchImpl });
    const result = await invoke(handler, request());
    assert.equal(result.status, 200);
    assert.equal(result.body.mode, 'reference');
    assert.equal(result.body.reason, 'provider_unavailable');
    assert.ok(result.body.sources.every(item => item.id.startsWith(`${product.slug}:`)));
    assert.ok(!result.raw.includes(fakeKey));
    assert.ok(!result.raw.includes(privateMarker));
  }
});

test('provider timeout cancels the request and returns a useful reference answer', async () => {
  let aborted = false;
  const handler = createAskHandler({ env: { GEMINI_API_KEY: fakeKey }, timeoutMs: 10, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(Error('aborted')); }, { once: true });
  }) });
  const result = await invoke(handler, request());
  assert.equal(aborted, true);
  assert.equal(result.status, 200);
  assert.equal(result.body.mode, 'reference');
  assert.match(result.body.answer, /토너 T\.1.*세럼 S\.1.*크림 C\.1/);
});

test('provider failures do not log credentials, prompts, or upstream error text', async t => {
  const logCalls = [];
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, (...args) => logCalls.push(args));
  const handler = createAskHandler({ env: { GEMINI_API_KEY: fakeKey }, fetchImpl: async () => { throw Error(`${fakeKey} private-error`); } });
  const result = await invoke(handler, request({ productSlug: product.slug, question: '가격과 내부질문식별자-1234를 알려주세요.' }));
  assert.equal(result.body.mode, 'reference');
  assert.ok(!result.raw.includes(fakeKey));
  assert.ok(!result.raw.includes('내부질문식별자-1234'));
  assert.deepEqual(logCalls, []);
});
