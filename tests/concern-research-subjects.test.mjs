import test from 'node:test';
import assert from 'node:assert/strict';
import { searchConcernResearch } from '../lib/concern-research-provider.js';

const apiKey = 'test-key-not-a-real-credential';
const article = {
  source: 'MED', pmid: '12345678', title: 'A published skin research study',
  abstractText: 'The study describes its participants, observations, and limitations. '.repeat(4),
};
const jsonResponse = (data, status = 200) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: () => null }, text: async () => JSON.stringify(data),
});
const answer = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ relevant: true, answer: '연구의 대상과 한계를 확인해 주세요.', sourceIds: ['12345678'] }) }] } }] };

test('explicit skin concerns use only fixed, non-identifying research search terms', async () => {
  for (const [query, expected] of [
    ['피부에 좁쌀 여드름이 생겼어요, 이름은 김민수', 'acne'],
    ['이마에 좁쌀이 생겼어요', 'acne'],
    ['글리세린에 알레르기가 있어요', 'contact dermatitis'],
    ['아토피 때문에 걱정이에요', 'atopic dermatitis'],
    ['접촉성 피부염이 걱정이에요', 'contact dermatitis'],
    ['주사비가 무엇인가요?', 'rosacea'],
  ]) {
    const calls = [];
    const result = await searchConcernResearch(query, { apiKey, fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return url.includes('europepmc') ? jsonResponse({ resultList: { result: [article] } }) : jsonResponse(answer);
    } });
    assert.equal(result.status, 'ok');
    assert.deepEqual(result.sources, [{ title: article.title, url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' }]);
    const search = calls.find(call => call.url.includes('europepmc'));
    const sentQuery = new URL(search.url).searchParams.get('query');
    assert(sentQuery.toLowerCase().includes(expected), query);
    assert(!sentQuery.includes('김민수'));
    assert(!sentQuery.includes(query));
    assert(!JSON.stringify(search.options).includes(apiKey));
    const generation = calls.find(call => call.url.includes('generativelanguage.googleapis.com'));
    const request = JSON.parse(generation.options.body);
    assert.match(request.systemInstruction.parts[0].text, /개인의 진단이나 원인/);
    assert.match(request.systemInstruction.parts[0].text, /특정 제품의 적합성/);
  }
});

test('unknown subjects and unrelated food allergies do not trigger unrelated research', async () => {
  for (const query of ['사랑이 뭐야?', '땅콩 알레르기가 있어요', '식품 성분 알레르기가 있어요', '좁쌀을 맛있게 요리하는 법']) {
    let calls = 0;
    await assert.rejects(searchConcernResearch(query, { apiKey, fetchImpl: async () => { calls++; throw Error('unexpected fetch'); } }), error => error.issue === 'research_topic_unavailable');
    assert.equal(calls, 0);
  }
});

test('temporary research failures remain distinct from an unsupported subject', async () => {
  for (const fetchImpl of [async () => { throw Error('network failed'); }, async () => jsonResponse({}, 503)]) {
    await assert.rejects(searchConcernResearch('피부에 좁쌀 여드름이 생겼어요', { apiKey, fetchImpl }), error => error.issue === 'research_search_unavailable');
  }
});

test('irrelevant or invented research cannot become an AI answer', async () => {
  for (const generated of [
    { relevant: false, answer: '관련 자료가 없습니다.', sourceIds: [] },
    { relevant: true, answer: '답변', sourceIds: ['87654321'] },
  ]) {
    const fetchImpl = async url => url.includes('europepmc')
      ? jsonResponse({ resultList: { result: [article] } })
      : jsonResponse({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(generated) }] } }] });
    await assert.rejects(searchConcernResearch('피부에 여드름이 있어요', { apiKey, fetchImpl }), error => error.issue === (generated.relevant ? 'research_generation_citation' : 'research_irrelevant'));
  }
});

test('only temporary Gemini 5xx errors are retried, once, within the same request', async () => {
  for (const [firstStatus, secondStatus, expectedCalls, expectedIssue] of [
    [503, 200, 2, null], [500, 503, 2, 'research_generation_http_5xx'],
    [400, 200, 1, 'research_generation_http_400'], [429, 200, 1, 'research_generation_http_429'],
  ]) {
    const requests = [];
    const fetchImpl = async (url, options) => {
      if (url.includes('europepmc')) return jsonResponse({ resultList: { result: [article] } });
      requests.push({ url, options });
      const status = requests.length === 1 ? firstStatus : secondStatus;
      return jsonResponse(status === 200 ? answer : { error: { message: 'provider private detail' } }, status);
    };
    if (expectedIssue) {
      await assert.rejects(searchConcernResearch('피부에 여드름이 있어요', { apiKey, fetchImpl }), error => {
        assert.equal(error.issue, expectedIssue);
        assert(!String(error).includes('provider private detail'));
        return true;
      });
    } else {
      assert.equal((await searchConcernResearch('피부에 여드름이 있어요', { apiKey, fetchImpl })).status, 'ok');
    }
    assert.equal(requests.length, expectedCalls);
    if (requests.length === 2) {
      assert.equal(requests[0].options.body, requests[1].options.body);
      assert.equal(requests[0].options.signal, requests[1].options.signal);
    }
  }
});

test('client abort interrupts a stalled research body and never starts Gemini', async () => {
  const controller = new AbortController();
  let calls = 0;
  const operation = searchConcernResearch('피부에 여드름이 있어요', {
    apiKey, signal: controller.signal, timeoutMs: 2000,
    fetchImpl: async () => { calls++; return { ...jsonResponse({}), text: () => new Promise(() => {}) }; },
  });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(operation, error => error.issue === 'research_search_unavailable');
  assert.equal(calls, 1);
});

test('the total deadline also stops a stalled Gemini retry', async () => {
  let generationCalls = 0;
  const started = Date.now();
  const operation = searchConcernResearch('피부에 여드름이 있어요', {
    apiKey, timeoutMs: 100,
    fetchImpl: async url => {
      if (url.includes('europepmc')) return jsonResponse({ resultList: { result: [article] } });
      generationCalls++;
      return generationCalls === 1 ? jsonResponse({}, 503) : new Promise(() => {});
    },
  });
  await assert.rejects(operation, error => error.issue === 'research_generation_unavailable');
  assert.equal(generationCalls, 2);
  assert(Date.now() - started < 1500, 'the request must not outlive its deadline');
});
