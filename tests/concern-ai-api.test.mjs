import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { createConcernAiHandler, MAX_CONCERN_AI_REQUEST_BYTES } from '../api/concern-ai.js';
import { ConcernAiError, validateSearchSuggestions, searchConcernWithGemini } from '../lib/concern-ai-provider.js';
import { WikipediaSearchError } from '../lib/concern-wikipedia-provider.js';

const fakeKey = 'unit-test-secret-not-a-real-key';
const widget = '<style>.container { display: flex; } .chip { color: #123456; }</style><div class="container"><svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1Z" fill="#4285F4"/></svg><a class="chip" href="https://www.google.com/search?q=skin">skin</a></div>';
const query = '세안 후 피부가 당겨요';
const answer = '세안 후 피부가 당기는 느낌은 여러 원인과 관련될 수 있습니다.\n\n보습에 관한 자료를 확인해 보세요.';
const unavailableCompatibleSearch = async () => { throw new ConcernAiError('provider_http_429'); };
const noWikiSources = async () => { throw new WikipediaSearchError('wikipedia_no_sources'); };
const researchOnly = { google25: unavailableCompatibleSearch, wikipedia: noWikiSources };
const grounded = () => ({ status: 'completed', steps: [
  { type: 'google_search_call', arguments: { queries: ['skin tightness after cleansing'] } },
  { type: 'google_search_result', result: [{ search_suggestions: widget }] },
  { type: 'model_output', content: [{ type: 'text', text: answer, annotations: [{ type: 'url_citation', url: 'https://www.aad.org/public/everyday-care/skin-care-basics/dry', title: 'American Academy of Dermatology' }] }] },
] });
function response(data, status = 200) { return { ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(data) }; }
function request(body = { query }, options = {}) {
  return { method: options.method || 'POST', headers: { host: 'example.test', 'content-type': 'application/json', ...(options.headers || {}) }, socket: { remoteAddress: '127.0.0.1' }, body };
}
async function invoke(handler, req = request()) {
  let raw = ''; const res = new EventEmitter(); res.setHeader = () => {}; res.end = value => { raw = value; res.writableEnded = true; };
  await handler(req, res); return { status: res.statusCode, body: JSON.parse(raw), raw };
}

test('search suggestion validation preserves safe Google markup and rejects active or deceptive content', () => {
  assert(validateSearchSuggestions(widget));
  const unsafe = [
    widget.replace('<div class="container">', '<script>alert(1)</script><div class="container">'),
    widget.replace('class="chip"', 'class="chip" onclick="alert(1)"'),
    widget.replace('https://www.google.com/search?q=skin', 'javascript:alert(1)'),
    widget.replace('https://www.google.com/search?q=skin', 'https://evil.example/search'),
    widget.replace('https://www.google.com/search?q=skin', 'https://www.google.com/search?q=skin" href="javascript:alert(1)'),
    widget.replace('.container { display: flex; }', '@import url(https://evil.example/a.css);'),
    widget.replace('.container { display: flex; }', '.container { background: u\\72l(https://evil.example/a); }'),
    widget.replace('<svg width=', '<svg onload="alert(1)" width='),
    widget.replace('<path d=', '<foreignObject><div>x</div></foreignObject><path d='),
  ];
  for (const html of unsafe) assert.equal(validateSearchSuggestions(html), false, html);
});

test('grounded web answers include unmodified text, real search citations and validated Google search suggestions', async () => {
  let payload;
  const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(options.headers['x-goog-api-key'], fakeKey);
    assert.equal(options.headers['Api-Revision'], '2026-05-20');
    payload = JSON.parse(options.body); return response(grounded());
  } });
  const result = await invoke(handler);
  assert.equal(result.status, 200); assert.equal(result.body.status, 'ok'); assert.equal(result.body.answer, answer);
  assert.deepEqual(result.body.sources, [{ title: 'American Academy of Dermatology', url: 'https://www.aad.org/public/everyday-care/skin-care-basics/dry' }]);
  assert.equal(result.body.searchSuggestions, widget); assert.deepEqual(result.body.searchQueries, ['skin tightness after cleansing']);
  assert.equal(payload.store, false); assert.deepEqual(payload.tools, [{ type: 'google_search' }]); assert.deepEqual(JSON.parse(payload.input), { question: query });
  assert.match(payload.system_instruction, /진단하거나 처방하지 말고/); assert.match(payload.system_instruction, /제품을 추천하거나 광고하지 마세요/);
  assert(!result.raw.includes(fakeKey));
});

test('non-grounded, unsourced, unsafe or fabricated provider responses are never reported as web search results', async () => {
  const cases = [
    ['no_grounding', data => { data.steps = data.steps.filter(step => step.type !== 'google_search_call'); }],
    ['no_grounding', data => { data.steps[1].result = []; }],
    ['unsafe_suggestions', data => { data.steps[1].result[0].search_suggestions = widget.replace('<div class="container">', '<script>alert(1)</script><div class="container">'); }],
    ['no_grounding', data => { data.steps[2].content[0].annotations = []; }],
    ['invalid_response', data => { data.steps[2].content[0].annotations[0].url = 'http://127.0.0.1/private'; }],
    ['invalid_response', data => { data.steps[2].content[0].text = `leaked ${fakeKey}`; }],
    ['invalid_response', data => { data.status = 'in_progress'; }],
  ];
  for (const [expected, modify] of cases) {
    const data = grounded(); modify(data);
    await assert.rejects(searchConcernWithGemini(query, { apiKey: fakeKey, model: 'gemini-3.5-flash-lite', fetchImpl: async () => response(data) }), error => {
      assert.equal(error.issue, expected);
      assert(!String(error).includes(fakeKey));
      return true;
    });
  }
});

test('requests reject invalid origins, excess data and client-supplied context before sending anything to Gemini', async () => {
  let calls = 0;
  const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, fetchImpl: async () => { calls++; throw Error('unexpected'); } });
  const cases = [
    [request({ query }, { method: 'GET' }), 405], [request({ query }, { headers: { origin: 'https://evil.test' } }), 403],
    [request({ query }, { headers: { 'content-type': 'text/plain' } }), 415], [request('{bad json'), 400],
    [request(null), 400], [request({ query: '' }), 400], [request({ query: 'a'.repeat(301) }), 400],
    [request({ query: 'a\u0000b' }), 400], [request({ query, sources: ['made up'] }), 400],
    [request('a'.repeat(MAX_CONCERN_AI_REQUEST_BYTES + 1)), 413],
    [request({ query }, { headers: { 'content-length': String(MAX_CONCERN_AI_REQUEST_BYTES + 1) } }), 413],
  ];
  for (const [req, status] of cases) assert.equal((await invoke(handler, req)).status, status);
  assert.equal(calls, 0);
});

test('missing keys, service failures and rate limits leave the web-search result unavailable', async () => {
  const noKey = await invoke(createConcernAiHandler({ env: {} })); assert.equal(noKey.status, 503); assert.equal(noKey.body.reason, 'provider_not_configured');
  const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, rateLimit: 1, fetchImpl: async () => response({}, 403) });
  assert.equal((await invoke(handler)).status, 503); assert.equal((await invoke(handler)).status, 429);
});

test('provider status codes are reported only as fixed diagnostic categories', async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 418]) {
    await assert.rejects(searchConcernWithGemini(query, { apiKey: fakeKey, model: 'gemini-3.5-flash-lite', fetchImpl: async () => response({ error: { message: 'private provider detail' } }, status) }), error => {
      assert.equal(error.issue, status === 500 ? 'provider_http_5xx' : status === 418 ? 'provider_http_other' : `provider_http_${status}`);
      assert(!String(error).includes('private provider detail'));
      return true;
    });
  }
});

test('grounding quota fallback retrieves real research records and sends only known subject terms to Europe PMC', async () => {
  const calls = [];
  const article = { source: 'MED', pmid: '12345678', title: 'A study of moisturizer', abstractText: 'This abstract describes a study of skin hydration and its limitations. '.repeat(3) };
  const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: researchOnly, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/interactions')) return response({}, 429);
    if (url.includes('europepmc')) return response({ resultList: { result: [article] } });
    return response({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ relevant: true, answer: '논문의 연구 조건과 한계를 함께 확인하세요.', sourceIds: ['12345678'] }) }] } }] });
  } });
  const result = await invoke(handler);
  assert.equal(result.status, 200); assert.equal(result.body.sourceMode, 'research');
  assert.deepEqual(result.body.sources, [{ title: article.title, url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' }]);
  const europeCall = calls.find(call => call.url.includes('europepmc'));
  assert(!decodeURIComponent(europeCall.url).includes(query));
  assert(!JSON.stringify(europeCall.options).includes(fakeKey));
  const generation = calls.find(call => call.url.includes(':generateContent'));
  const input = JSON.parse(JSON.parse(generation.options.body).contents[0].parts[0].text);
  assert.equal(input.question, query); assert.equal(input.articles[0].abstract, article.abstractText.trim());
});

test('research fallback refuses missing abstracts and invented citations', async () => {
  for (const missingAbstract of [true, false]) {
    const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: researchOnly, fetchImpl: async (url) => {
      if (url.includes('/interactions')) return response({}, 429);
      if (url.includes('europepmc')) return response({ resultList: { result: [{ source: 'MED', pmid: '12345678', title: 'Research title', abstractText: missingAbstract ? '' : 'Research details. '.repeat(10) }] } });
      return response({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ relevant: true, answer: '답변', sourceIds: ['98765432'] }) }] } }] });
    } });
    const result = await invoke(handler);
    assert.equal(result.status, 503);
    assert.equal(result.body.reason, missingAbstract ? 'wikipedia_no_sources' : 'research_generation_citation');
  }
});

test('research provider failures have fixed diagnostic categories without provider content', async () => {
  const cases = [
    [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }, 'research_generation_max_tokens'],
    [{ candidates: [{ finishReason: 'SAFETY' }] }, 'research_generation_safety'],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'private malformed value' }] } }] }, 'research_generation_json'],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] }, 'research_generation_relevance_invalid'],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"relevant":true}' }] } }] }, 'research_generation_answer_invalid'],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"relevant":true,"answer":"text","sourceIds":[]}' }] } }] }, 'research_generation_sources_empty'],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"relevant":false,"answer":"none","sourceIds":[]}' }] } }] }, 'research_irrelevant'],
    [{ candidates: [{ finishReason: 'STOP', content: { parts: [] } }] }, 'research_generation_parts_invalid'],
  ];
  for (const [generated, reason] of cases) {
    const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: researchOnly, fetchImpl: async (url) => {
      if (url.includes('/interactions')) return response({}, 429);
      if (url.includes('europepmc')) return response({ resultList: { result: [{ source: 'MED', pmid: '12345678', title: 'Research title', abstractText: 'Research details. '.repeat(10) }] } });
      return response(generated);
    } });
    const result = await invoke(handler);
    assert.equal(result.body.reason, reason === 'research_irrelevant' ? 'wikipedia_no_sources' : reason);
    assert(!result.raw.includes('private malformed value'));
  }
});

test('research generation HTTP errors expose only fixed status categories', async () => {
  for (const status of [400, 401, 403, 404, 429, 500, 418]) {
    const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: researchOnly, fetchImpl: async (url) => {
      if (url.includes('/interactions')) return response({}, 429);
      if (url.includes('europepmc')) return response({ resultList: { result: [{ source: 'MED', pmid: '12345678', title: 'Research title', abstractText: 'Research details. '.repeat(10) }] } });
      return response({ error: { message: 'private provider detail' } }, status);
    } });
    const result = await invoke(handler);
    assert.equal(result.body.reason, status === 500 ? 'research_generation_http_5xx' : status === 418 ? 'research_generation_http_other' : `research_generation_http_${status}`);
    assert(!result.raw.includes('private provider detail'));
  }
});

test('unsupported primary model retries the grounded fallback without disclosing credentials', async () => {
  const called = [];
  const result = await searchConcernWithGemini(query, { apiKey: fakeKey, model: 'primary-model', fetchImpl: async (_url, options) => {
    const model = JSON.parse(options.body).model; called.push(model); return model === 'primary-model' ? response({}, 404) : response(grounded());
  } });
  assert.deepEqual(called, ['primary-model', 'gemini-3.5-flash-lite']); assert.equal(result.status, 'ok'); assert(!JSON.stringify(result).includes(fakeKey));
});

test('multiple search suggestions and text chunks preserve the provider originals', async () => {
  const data = grounded();
  data.steps[1].result.push({ search_suggestions: widget });
  const part = data.steps[2].content[0];
  const splitAt = 20;
  data.steps[2].content = [{ type: 'text', text: answer.slice(0, splitAt) }, { ...part, text: answer.slice(splitAt) }];
  const result = await searchConcernWithGemini(query, { apiKey: fakeKey, model: 'primary-model', fetchImpl: async () => response(data) });
  assert.equal(result.answer, answer);
  assert.equal(result.searchSuggestions, widget + widget);
  assert.equal(result.sources.length, 1);
});

test('a disconnected client aborts the pending provider request', async () => {
  const res = new EventEmitter();
  res.setHeader = () => {};
  res.end = () => { res.writableEnded = true; };
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  let providerSignal;
  const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, fetchImpl: async (_url, options) => {
    providerSignal = options.signal;
    started();
    return new Promise((_, reject) => providerSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  const pending = handler(request(), res);
  await startedPromise;
  res.emit('close');
  await pending;
  assert.equal(providerSignal.aborted, true);
});

test('oversized streamed requests and provider responses fail safely', async () => {
  const stream = Readable.from([Buffer.alloc(MAX_CONCERN_AI_REQUEST_BYTES + 1, 120)]); Object.assign(stream, { method: 'POST', headers: { host: 'example.test', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } });
  assert.equal((await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey } }), stream)).status, 413);
  const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, fetchImpl: async () => ({ ok: true, status: 200, headers: new Headers({ 'content-length': '999999' }), text: async () => { throw Error('must not read'); } }) });
  assert.equal((await invoke(handler)).status, 503);
});
