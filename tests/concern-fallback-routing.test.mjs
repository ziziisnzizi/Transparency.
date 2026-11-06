import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { createConcernAiHandler } from '../api/concern-ai.js';
import { ConcernAiError } from '../lib/concern-ai-provider.js';
import { WikipediaSearchError } from '../lib/concern-wikipedia-provider.js';

const fakeKey = 'unit-test-secret';
const request = { method: 'POST', headers: { host: 'example.test', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' }, body: { query: '사랑이 뭐야?' } };
const google = { status: 'ok', sourceMode: 'google', answer: '확인한 자료입니다.', sources: [{ title: '출처', url: 'https://example.com/' }], searchSuggestions: '<div>검색</div>' };
const research = { status: 'ok', sourceMode: 'research', answer: '연구 내용입니다.', sources: [{ title: '논문', url: 'https://pubmed.ncbi.nlm.nih.gov/123/' }] };
const wiki = { status: 'ok', sourceMode: 'wikipedia', answer: '백과사전 내용입니다.', sources: [{ title: '사랑', url: 'https://ko.wikipedia.org/wiki/%EC%82%AC%EB%9E%91' }] };
const failing = issue => async () => { throw new ConcernAiError(issue); };

async function invoke(handler, onResponse) {
  let raw = '';
  const response = new EventEmitter();
  response.setHeader = () => {};
  response.end = value => { raw = value; response.writableEnded = true; };
  if (onResponse) onResponse(response);
  await handler(request, response);
  return { status: response.statusCode, body: JSON.parse(raw), raw };
}

test('valid Google grounding short-circuits all alternative searches', async () => {
  const calls = [];
  const result = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
    primary: async () => { calls.push('primary'); return google; },
    google25: async () => { calls.push('google25'); return google; },
    research: async () => { calls.push('research'); return research; },
    wikipedia: async () => { calls.push('wiki'); return wiki; },
  } }));
  assert.equal(result.status, 200); assert.deepEqual(result.body, google); assert.deepEqual(calls, ['primary']);
});

test('quota-limited primary uses compatible Google grounding before other sources', async () => {
  const calls = [];
  const result = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
    primary: async () => { calls.push('primary'); throw new ConcernAiError('provider_http_429'); },
    google25: async (_query, options) => { calls.push('google25'); assert(options.timeoutMs <= 10000); return google; },
    research: async () => { calls.push('research'); return research; },
    wikipedia: async () => { calls.push('wiki'); return wiki; },
  } }));
  assert.equal(result.status, 200); assert.equal(result.body.sourceMode, 'google'); assert.deepEqual(calls, ['primary', 'google25']);
});

test('independently sourced research replaces an unsafe Google response', async () => {
  const calls = [];
  const result = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
    primary: async () => { calls.push('primary'); throw new ConcernAiError('unsafe_suggestions'); },
    google25: async () => { calls.push('google25'); throw new ConcernAiError('invalid_response'); },
    research: async () => { calls.push('research'); return research; },
    wikipedia: async () => { calls.push('wiki'); return wiki; },
  } }));
  assert.equal(result.status, 200); assert.deepEqual(result.body, research); assert.deepEqual(calls, ['primary', 'google25', 'research']);
});

test('unsupported research and source-server failures can fall back to encyclopedia sources', async () => {
  for (const reason of ['research_topic_unavailable', 'research_no_abstract', 'research_irrelevant', 'research_search_unavailable', 'research_search_invalid']) {
    const calls = [];
    const result = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
      primary: failing('provider_http_429'), google25: failing('provider_http_429'),
      research: async () => { calls.push('research'); throw new ConcernAiError(reason); },
      wikipedia: async () => { calls.push('wiki'); return wiki; },
    } }));
    assert.equal(result.status, 200, reason); assert.deepEqual(result.body, wiki); assert.deepEqual(calls, ['research', 'wiki']);
  }
});

test('authentication failure does not send the question to further providers', async () => {
  for (const step of ['primary', 'google25']) {
    const calls = [];
    const result = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
      primary: async () => { calls.push('primary'); throw new ConcernAiError(step === 'primary' ? 'provider_http_401' : 'provider_http_429'); },
      google25: async () => { calls.push('google25'); throw new ConcernAiError('provider_http_401'); },
      research: async () => { calls.push('research'); return research; },
      wikipedia: async () => { calls.push('wiki'); return wiki; },
    } }));
    assert.equal(result.status, 503); assert.equal(result.body.reason, 'provider_http_401');
    assert.deepEqual(calls, step === 'primary' ? ['primary'] : ['primary', 'google25']);
  }
});

test('only fixed encyclopedia error categories reach the browser', async () => {
  for (const reason of ['wikipedia_no_topic', 'wikipedia_privacy_protected', 'wikipedia_search_http_429', 'wikipedia_keyword_http_5xx', 'wikipedia_summary_invalid_finish', 'untrusted-private-detail']) {
    const result = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
      primary: failing('provider_http_429'), google25: failing('provider_http_429'), research: failing('research_topic_unavailable'),
      wikipedia: async () => { throw new WikipediaSearchError(reason); },
    } }));
    assert.equal(result.status, 503);
    assert.equal(result.body.reason, reason.startsWith('wikipedia_') ? reason : 'provider_unavailable');
    assert(!result.raw.includes('untrusted-private-detail')); assert(!result.raw.includes(fakeKey));
  }
});

test('failed requests include only fixed diagnostics for attempted Google stages', async () => {
  const result = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
    primary: failing('provider_http_429'), google25: failing('unsafe_suggestions'), research: failing('research_topic_unavailable'),
    wikipedia: async () => { throw new WikipediaSearchError('wikipedia_summary_unavailable'); },
  } }));
  assert.equal(result.status, 503);
  assert.equal(result.body.reason, 'wikipedia_summary_unavailable');
  assert.deepEqual(result.body.diagnostics, { google_primary: 'provider_http_429', google_25: 'unsafe_suggestions' });
  assert(!result.raw.includes(fakeKey)); assert(!result.raw.includes(request.body.query));
});

test('diagnostics discard unexpected error content and are absent on successful fallbacks', async () => {
  const privateText = 'do-not-expose-provider-message';
  const unsafeError = new ConcernAiError('provider_http_429');
  unsafeError.issue = privateText;
  const denied = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
    primary: async () => { throw unsafeError; },
  } }));
  assert.equal(denied.status, 503); assert.equal(denied.body.reason, 'provider_unavailable');
  assert.deepEqual(denied.body.diagnostics, { google_primary: 'provider_unavailable' });
  assert(!denied.raw.includes(privateText)); assert(!denied.raw.includes(fakeKey));

  const recovered = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
    primary: failing('provider_http_429'), google25: async () => google,
  } }));
  assert.equal(recovered.status, 200); assert.equal(recovered.body.sourceMode, 'google');
  assert.equal('diagnostics' in recovered.body, false);
});

test('the entire request stops on deadline even if a provider ignores cancellation', async () => {
  let fallbackCalled = false;
  const start = performance.now();
  const result = await invoke(createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, timeoutMs: 100, providers: {
    primary: async () => new Promise(() => {}),
    google25: async () => { fallbackCalled = true; return google; },
  } }));
  assert.equal(result.status, 503); assert.equal(result.body.reason, 'provider_timeout');
  assert.equal(fallbackCalled, false); assert(performance.now() - start < 2000);
});

test('disconnect aborts the in-flight stage and prevents all fallbacks', async () => {
  let fallbackCalled = false, abortObserved = false;
  const handler = createConcernAiHandler({ env: { GEMINI_API_KEY: fakeKey }, providers: {
    primary: async (_query, options) => { options.signal.addEventListener('abort', () => { abortObserved = true; }); return new Promise(() => {}); },
    google25: async () => { fallbackCalled = true; return google; },
  } });
  const result = await invoke(handler, response => setTimeout(() => response.emit('close'), 10));
  assert.equal(result.status, 503); assert.equal(result.body.reason, 'provider_timeout');
  assert.equal(abortObserved, true); assert.equal(fallbackCalled, false);
});
