import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { createAskHandler, MAX_REQUEST_BYTES } from '../api/ask.js';
import { buildProductSources, findQuestionProduct } from '../lib/product-answers.js';
import { geminiConfiguration, DEFAULT_GEMINI_MODEL, getProviderIssue } from '../lib/ai-provider.js';

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
    json: async () => ({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify({ answer, sourceIds }) }] }], ...options }),
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

test('Gemini 3.8 Interactions keeps the key in a header, disables storage, and returns registered citations', async () => {
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
  assert.equal(url.pathname, '/v1beta/interactions');
  assert.equal(url.search, '');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['x-goog-api-key'], fakeKey);
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.model, 'gemini-3.8-flash');
  assert.equal(payload.store, false);
  assert.ok(payload.system_instruction.includes('제공된 sources'));
  const input = JSON.parse(payload.input);
  assert.equal(input.question, validBody.question);
  assert.equal(input.product, product.name);
  assert.deepEqual(input.sources, buildProductSources(product));
  assert.deepEqual(payload.generation_config, { thinking_level: 'low', max_output_tokens: 2048 });
  assert.deepEqual(payload.response_format, {
    type: 'text', mime_type: 'application/json', schema: {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        sourceIds: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string', enum: buildProductSources(product).map(item => item.id) } },
      },
      required: ['answer', 'sourceIds'], additionalProperties: false,
    },
  });
  assert.ok(!captured.options.body.includes(fakeKey));
  assert.ok(!result.raw.includes(fakeKey));
});

test('provider configuration cannot turn model names into arbitrary network destinations', () => {
  assert.deepEqual(geminiConfiguration({}), { key: '', model: DEFAULT_GEMINI_MODEL });
  assert.deepEqual(geminiConfiguration({ GEMINI_API_KEY: `  ${fakeKey}  `, GEMINI_MODEL: 'models/gemini-3.8-flash' }), { key: fakeKey, model: DEFAULT_GEMINI_MODEL });
  assert.equal(geminiConfiguration({ GEMINI_MODEL: 'models/gemini-2.5-flash' }).model, 'gemini-2.5-flash');
  for (const model of ['https://attacker.test/model', '../model', 'x?key=secret', 'model/a', 'x'.repeat(101)]) {
    assert.equal(geminiConfiguration({ GEMINI_MODEL: model }).model, DEFAULT_GEMINI_MODEL);
  }
});

test('Interactions reads only completed model output text and ignores thoughts and tools', async () => {
  const text = JSON.stringify({ answer: '토너 다음에 세럼을 사용합니다.', sourceIds: [source.id] });
  const handler = createAskHandler({
    env: { GEMINI_API_KEY: fakeKey },
    fetchImpl: async () => generated('', [], { steps: [
      { type: 'thought', content: [{ type: 'text', text: fakeKey }] },
      { type: 'tool_result', content: [{ type: 'text', text: 'untrusted tool response' }] },
      { type: 'model_output', content: [{ type: 'thought', text: fakeKey }, { type: 'text', text: text.slice(0, 20) }] },
      { type: 'model_output', content: [{ type: 'text', text: text.slice(20) }] },
    ] }),
  });
  const result = await invoke(handler, request());
  assert.equal(result.body.mode, 'ai');
  assert.equal(result.body.answer, '토너 다음에 세럼을 사용합니다.');
  assert.deepEqual(result.body.sources, [source]);
  assert.ok(!result.raw.includes(fakeKey));
});

test('explicit Gemini 2 configuration retains generateContent compatibility and STOP validation', async () => {
  let captured;
  const legacyResponse = finishReason => ({ ok: true, json: async () => ({ candidates: [{ finishReason, content: { parts: [
    { thought: true, text: fakeKey },
    { text: JSON.stringify({ answer: '토너 다음에 세럼을 사용합니다.', sourceIds: [source.id] }) },
  ] } }] }) });
  const handler = createAskHandler({
    env: { GEMINI_API_KEY: fakeKey, GEMINI_MODEL: 'gemini-2.5-flash' },
    fetchImpl: async (url, options) => { captured = { url, options }; return legacyResponse('STOP'); },
  });
  const result = await invoke(handler, request());
  assert.equal(result.body.mode, 'ai');
  assert.deepEqual(result.body.sources, [source]);
  assert.equal(captured.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  assert.equal(captured.options.headers['x-goog-api-key'], fakeKey);
  const payload = JSON.parse(captured.options.body);
  assert.equal(JSON.parse(payload.contents[0].parts[0].text).product, product.name);
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
  const incompleteHandler = createAskHandler({ env: { GEMINI_API_KEY: fakeKey, GEMINI_MODEL: 'gemini-2.5-flash' }, fetchImpl: async () => legacyResponse('MAX_TOKENS') });
  assert.equal((await invoke(incompleteHandler, request())).body.providerIssue, 'invalid_response');
});

test('provider errors, blocked or incomplete responses, malformed JSON, and unsupported citations fall back safely', async () => {
  const privateMarker = 'unit-private-provider-text';
  const providers = [
    async () => { throw Error(`${fakeKey} ${privateMarker}`); },
    async () => ({ ok: false, status: 429, json: async () => ({ error: fakeKey }) }),
    async () => generated('', [], { status: 'failed', steps: [] }),
    async () => generated('', [], { status: 'in_progress' }),
    async () => generated('', [], { status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'not-json' }] }] }),
    async () => generated('', [], { steps: [{ type: 'thought', content: [{ type: 'text', text: JSON.stringify({ answer: '생각', sourceIds: [source.id] }) }] }] }),
    async () => generated('', [], { steps: {} }),
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
  assert.equal(result.body.providerIssue, 'timeout');
  assert.match(result.body.answer, /토너 T\.1.*세럼 S\.1.*크림 C\.1/);
});

test('provider failures expose only actionable allowlisted categories, never raw upstream diagnostics', async () => {
  const privateMarker = 'private-provider-project-and-prompt-marker';
  const cases = [
    [400, { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] }, 'key_invalid'],
    [400, { status: 'INVALID_ARGUMENT', message: `API key not valid. ${fakeKey}` }, 'key_invalid'],
    [401, { status: 'UNAUTHENTICATED' }, 'key_invalid'],
    [403, { status: 'PERMISSION_DENIED', details: [{ reason: 'API_KEY_SERVICE_BLOCKED' }] }, 'permission_denied'],
    [429, { status: 'RESOURCE_EXHAUSTED' }, 'quota_exceeded'],
    [404, { status: 'NOT_FOUND' }, 'model_unavailable'],
    [400, { status: 'INVALID_ARGUMENT' }, 'request_rejected'],
    [503, { status: 'UNAVAILABLE' }, 'unavailable'],
  ];
  for (const [status, providerError, expected] of cases) {
    const handler = createAskHandler({
      env: { GEMINI_API_KEY: fakeKey },
      fetchImpl: async () => ({ ok: false, status, json: async () => ({ error: { message: `${privateMarker} ${fakeKey}`, ...providerError } }) }),
    });
    const result = await invoke(handler, request());
    assert.equal(result.status, 200);
    assert.equal(result.body.mode, 'reference');
    assert.equal(result.body.reason, 'provider_unavailable');
    assert.equal(result.body.providerIssue, expected);
    assert.ok(!result.raw.includes(fakeKey));
    assert.ok(!result.raw.includes(privateMarker));
    assert.equal(Object.hasOwn(result.body, 'providerStatus'), false);
    assert.equal(Object.hasOwn(result.body, 'providerMessage'), false);
  }
});

test('untrusted errors and malformed provider responses cannot leak or forge diagnostic fields', async () => {
  assert.equal(getProviderIssue({ providerIssue: 'key_invalid', message: fakeKey }), 'unavailable');
  const providers = [
    [async () => { throw { providerIssue: 'key_invalid', message: fakeKey }; }, 'unavailable'],
    [async () => ({ ok: false, status: 429, json: async () => { throw Error(fakeKey); } }), 'quota_exceeded'],
    [async () => ({ ok: true, json: async () => { throw Error(fakeKey); } }), 'invalid_response'],
    [async () => ({ ok: true, json: async () => ({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: fakeKey }] } }] }) }), 'invalid_response'],
    [async () => generated('제품 정보상 24시간 효과가 있습니다.', ['invented:source']), 'invalid_response'],
    [async () => generated(`응답에 노출된 ${fakeKey}`, [source.id]), 'invalid_response'],
  ];
  for (const [fetchImpl, expected] of providers) {
    const handler = createAskHandler({ env: { GEMINI_API_KEY: fakeKey }, fetchImpl });
    const result = await invoke(handler, request());
    assert.equal(result.body.mode, 'reference');
    assert.equal(result.body.providerIssue, expected);
    assert.ok(!result.raw.includes(fakeKey));
    assert.ok(!result.raw.includes('24시간'));
  }
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
