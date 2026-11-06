import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchConcernWikipedia } from '../lib/concern-wikipedia-provider.js';

const fakeKey = 'unit-test-secret-not-a-real-key';
const question = '사랑이 뭐야?';
const page = {
  pageid: 123,
  title: '사랑',
  fullurl: 'https://ko.wikipedia.org/wiki/%EC%82%AC%EB%9E%91',
  extract: '사랑은 사람이나 대상에 대하여 느끼는 깊은 애정과 관심을 뜻합니다. '.repeat(5),
};
const nativeReply = data => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(data) }] } }] });
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(data) });
function mockFetch({ term = '사랑', pages = [page], answer = { answer: '사랑은 애정과 관심을 가리키는 말입니다.', sourceIds: ['123'] }, wikiStatus = 200 } = {}) {
  const calls = [];
  let geminiCalls = 0;
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith('https://generativelanguage.googleapis.com/')) {
      geminiCalls++;
      return response(nativeReply(geminiCalls === 1 ? { searchTerm: term } : answer));
    }
    if (String(url).startsWith('https://ko.wikipedia.org/w/api.php')) return response({ query: { pages } }, wikiStatus);
    assert.fail('only the fixed Google and Wikipedia endpoints may be fetched');
  };
  return { fetchImpl, calls, countGemini: () => geminiCalls };
}

test('general questions use an extracted search term and cite only returned Wikipedia pages', async () => {
  const mock = mockFetch();
  const result = await searchConcernWikipedia(question, { apiKey: fakeKey, fetchImpl: mock.fetchImpl });
  assert.equal(result.status, 'ok');
  assert.equal(result.sourceMode, 'wikipedia');
  assert.match(result.answer, /사랑/);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].title, '사랑');
  assert.equal(new URL(result.sources[0].url).origin, 'https://ko.wikipedia.org');
  const wikipedia = mock.calls.find(call => call.url.startsWith('https://ko.wikipedia.org/'));
  assert(wikipedia, 'Wikipedia must actually be queried');
  const url = new URL(wikipedia.url);
  assert.equal(url.searchParams.get('gsrsearch'), '사랑');
  assert(!decodeURIComponent(wikipedia.url).includes(question), 'the original question must not be sent to Wikipedia');
  assert(!JSON.stringify(wikipedia.options).includes(fakeKey), 'the Gemini key must not be sent to Wikipedia');
  assert(!JSON.stringify(result).includes(fakeKey));
  assert.equal(mock.countGemini(), 2);
});

test('identifying or unsafe generated search terms stop before contacting Wikipedia', async () => {
  for (const term of ['010-1234-5678', 'alex@example.com', 'https://example.test/private', '1234567890123']) {
    const mock = mockFetch({ term });
    await assert.rejects(searchConcernWikipedia(question, { apiKey: fakeKey, fetchImpl: mock.fetchImpl }));
    assert.equal(mock.calls.some(call => call.url.includes('wikipedia.org')), false, term);
  }
});

test('questions containing obvious personal identifiers are not sent to any provider', async () => {
  for (const query of ['내 이메일은 alex@example.com 이야', '전화번호 010-1234-5678이야', '내 이름은 홍길동이야', 'https://example.test/private 을 확인해줘']) {
    const mock = mockFetch();
    await assert.rejects(searchConcernWikipedia(query, { apiKey: fakeKey, fetchImpl: mock.fetchImpl }));
    assert.equal(mock.calls.length, 0);
  }
});

test('an absent public topic is distinct from a privacy rejection', async () => {
  for (const term of ['', '사랑?']) {
    const mock = mockFetch({ term });
    await assert.rejects(searchConcernWikipedia(question, { apiKey: fakeKey, fetchImpl: mock.fetchImpl }), error => error.reason === 'wikipedia_no_topic');
    assert.equal(mock.calls.some(call => call.url.includes('wikipedia.org')), false);
  }
  const mock = mockFetch({ term: 'alex@example.com' });
  await assert.rejects(searchConcernWikipedia(question, { apiKey: fakeKey, fetchImpl: mock.fetchImpl }), error => error.reason === 'wikipedia_privacy_protected');
});

test('results with no actual pages, an invented citation or unsafe model HTML are rejected', async () => {
  for (const options of [
    { pages: [] },
    { answer: { answer: '근거 없는 요약', sourceIds: ['999999'] } },
    { answer: { answer: '<script>alert(1)</script>', sourceIds: ['123'] } },
  ]) {
    const mock = mockFetch(options);
    await assert.rejects(searchConcernWikipedia(question, { apiKey: fakeKey, fetchImpl: mock.fetchImpl }));
  }
});

test('a provider-supplied URL cannot turn a citation into an arbitrary external destination', async () => {
  const mock = mockFetch({ pages: [{ ...page, fullurl: 'https://evil.example/steal' }] });
  let result;
  try {
    result = await searchConcernWikipedia(question, { apiKey: fakeKey, fetchImpl: mock.fetchImpl });
  } catch {
    // Rejecting the unexpected provider URL is also safe.
  }
  if (result) {
    assert(result.sources.length);
    for (const source of result.sources) assert.equal(new URL(source.url).origin, 'https://ko.wikipedia.org');
    assert(!JSON.stringify(result).includes('evil.example'));
  }
  assert.equal(mock.calls.some(call => call.url.includes('evil.example')), false);
});

test('Wikipedia errors and pre-aborted requests fail without a fabricated response', async () => {
  const rateLimited = mockFetch({ wikiStatus: 429 });
  await assert.rejects(searchConcernWikipedia(question, { apiKey: fakeKey, fetchImpl: rateLimited.fetchImpl }));
  assert.equal(rateLimited.countGemini(), 1, 'the model must not invent an answer after search fails');

  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(searchConcernWikipedia(question, { apiKey: fakeKey, signal: controller.signal, fetchImpl: async () => { calls++; throw Error('unexpected'); } }));
  assert.equal(calls, 0);
});

test('transient summary errors retry once without changing the verified sources', async () => {
  let calls = 0;
  const fetchImpl = async url => {
    if (String(url).startsWith('https://ko.wikipedia.org/')) return response({ query: { pages: [page] } });
    calls++;
    if (calls === 1) return response(nativeReply({ searchTerm: '사랑' }));
    if (calls === 2) return response({}, 503);
    return response(nativeReply({ answer: '사랑은 깊은 애정과 관심을 뜻합니다.', sourceIds: ['123'] }));
  };
  const result = await searchConcernWikipedia(question, { apiKey: fakeKey, fetchImpl });
  assert.equal(calls, 3);
  assert.equal(result.sources[0].title, '사랑');
});

test('summary HTTP and response-shape failures return fixed diagnostic codes', async () => {
  for (const [failure, reason] of [
    [response({}, 400), 'wikipedia_summary_http_400'],
    [response({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), 'wikipedia_summary_max_tokens'],
    [response({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not-json' }] } }] }), 'wikipedia_summary_invalid_json'],
  ]) {
    let calls = 0;
    const fetchImpl = async url => {
      if (String(url).startsWith('https://ko.wikipedia.org/')) return response({ query: { pages: [page] } });
      return ++calls === 1 ? response(nativeReply({ searchTerm: '사랑' })) : failure;
    };
    await assert.rejects(searchConcernWikipedia(question, { apiKey: fakeKey, fetchImpl }), error => error.reason === reason);
    assert.equal(calls, 2, reason);
  }
});

test('crisis inputs never leave for search or generation', async () => {
  let calls = 0;
  await assert.rejects(searchConcernWikipedia('죽고 싶어요', { apiKey: fakeKey, fetchImpl: async () => { calls++; throw Error('unexpected'); } }));
  assert.equal(calls, 0);
});

test('a stalled provider is aborted within the request deadline', async () => {
  let pendingSignal;
  const pending = searchConcernWikipedia(question, { apiKey: fakeKey, timeoutMs: 40, fetchImpl: (_url, options) => {
    pendingSignal = options.signal;
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  let timer;
  try {
    await assert.rejects(Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('deadline exceeded')), 1800); })]), error => error.message !== 'deadline exceeded');
  } finally { clearTimeout(timer); }
  assert(pendingSignal?.aborted);
});
