import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchConcernWithGoogle25 } from '../lib/concern-google25-provider.js';

const key = 'unit-test-secret-not-a-real-key';
const query = '피부가 건조해요';
const widget = '<style>.chip { color: #123456; }</style><div><a class="chip" href="https://www.google.com/search?q=skin">skin</a></div>';
const original = () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '공개 자료에서 확인한 내용입니다.' }] }, groundingMetadata: { webSearchQueries: ['skin hydration'], searchEntryPoint: { renderedContent: widget }, groundingChunks: [{ web: { uri: 'https://www.aad.org/public/everyday-care/skin-care-basics/dry', title: 'American Academy of Dermatology' } }] } }] });
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(data) });

test('native 2.5 search uses Google Search and returns verified source and unmodified search suggestions', async () => {
  let body;
  const result = await searchConcernWithGoogle25(query, { apiKey: key, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assert.equal(options.headers['x-goog-api-key'], key);
    body = JSON.parse(options.body);
    return response(original());
  } });
  assert.deepEqual(body.tools, [{ googleSearch: {} }]);
  assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), { question: query });
  assert.equal(result.sourceMode, 'google');
  assert.equal(result.answer, '공개 자료에서 확인한 내용입니다.');
  assert.equal(result.searchSuggestions, widget);
  assert.deepEqual(result.sources, [{ title: 'American Academy of Dermatology', url: 'https://www.aad.org/public/everyday-care/skin-care-basics/dry' }]);
  assert(!JSON.stringify(result).includes(key));
});

test('native search rejects missing grounding, unsafe suggestions, invalid URLs and incomplete results', async () => {
  const cases = [
    ['no_grounding', data => { data.candidates[0].groundingMetadata.webSearchQueries = []; }],
    ['no_grounding', data => { data.candidates[0].groundingMetadata.groundingChunks = []; }],
    ['no_grounding', data => { delete data.candidates[0].groundingMetadata.searchEntryPoint; }],
    ['unsafe_suggestions', data => { data.candidates[0].groundingMetadata.searchEntryPoint.renderedContent += '<script>alert(1)</script>'; }],
    ['invalid_response', data => { data.candidates[0].groundingMetadata.groundingChunks[0].web.uri = 'http://127.0.0.1/'; }],
    ['invalid_response', data => { data.candidates[0].content.parts[0].text = key; }],
    ['invalid_response', data => { data.candidates[0].finishReason = 'MAX_TOKENS'; }],
  ];
  for (const [expected, mutate] of cases) {
    const data = original(); mutate(data);
    await assert.rejects(searchConcernWithGoogle25(query, { apiKey: key, fetchImpl: async () => response(data) }), error => error.issue === expected);
  }
});

test('native search classifies provider failures without leaking the response', async () => {
  for (const [status, expected] of [[400, 'provider_http_400'], [403, 'provider_http_403'], [429, 'provider_http_429'], [503, 'provider_http_5xx']]) {
    await assert.rejects(searchConcernWithGoogle25(query, { apiKey: key, fetchImpl: async () => response({ error: { message: 'private provider detail' } }, status) }), error => error.issue === expected && !String(error).includes('private provider detail'));
  }
});

test('native search cancels an interrupted request and stops waiting', async () => {
  const controller = new AbortController();
  let observedSignal;
  const pending = searchConcernWithGoogle25(query, { apiKey: key, signal: controller.signal, fetchImpl: async (_url, options) => { observedSignal = options.signal; return new Promise(() => {}); } });
  controller.abort();
  await assert.rejects(pending, error => error.issue === 'provider_timeout');
  assert(observedSignal.aborted);
});
