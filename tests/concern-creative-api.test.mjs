import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { createConcernCreativeHandler } from '../api/concern-creative.js';

const fakeKey = 'fake-key-for-creative-unit-test';
const query = '사랑이 뭐야?';
const parsed = (analogy = '사랑은 토너 T.1처럼 투명하게 마음을 전하는 일 같아요.', productSlug = 'toner-t1', appropriate = true) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ appropriate, productSlug, analogy }) }] } }] });
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(data) });
const request = (body = { query }, options = {}) => ({ method: options.method || 'POST', headers: { host: 'example.test', 'content-type': 'application/json', ...(options.headers || {}) }, socket: { remoteAddress: '127.0.0.1' }, body });
async function invoke(handler, req = request()) { let raw = ''; const res = new EventEmitter(); res.setHeader = () => {}; res.end = value => { raw = value; res.writableEnded = true; }; await handler(req, res); return { status: res.statusCode, body: JSON.parse(raw), raw }; }

test('creative answer connects the topic to a real product and appends only a verified product fact', async () => {
  let payload;
  const handler = createConcernCreativeHandler({ env: { GEMINI_API_KEY: fakeKey, GEMINI_MODEL: 'gemini-3.5-flash-lite' }, fetchImpl: async (url, options) => {
    assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(options.headers['x-goog-api-key'], fakeKey); payload = JSON.parse(options.body); return response(parsed());
  } });
  const result = await invoke(handler);
  assert.equal(result.status, 200); assert.equal(result.body.status, 'ok'); assert.equal(result.body.productSlug, 'toner-t1');
  assert.match(result.body.message, /사랑은 토너 T\.1처럼/); assert.match(result.body.message, /투명 워터 제형/); assert(!result.raw.includes(fakeKey));
  assert.match(payload.systemInstruction.parts[0].text, /효과, 성분, 수치, 임상/);
  assert.deepEqual(JSON.parse(payload.contents[0].parts[0].text).products.map(item => item.slug).sort(), ['cream-c1', 'serum-s1', 'toner-t1']);
});

test('medical, allergy, requested exclusions, sensitive events and crisis questions skip promotional generation', async () => {
  let calls = 0; const handler = createConcernCreativeHandler({ env: { GEMINI_API_KEY: fakeKey }, fetchImpl: async () => { calls++; throw Error('unexpected'); } });
  for (const message of ['피부에 좁쌀 여드름이 생겼어', '화장품을 바르고 가려워요', '판테놀 알레르기가 있어요', '판테놀 없는 제품을 추천해줘', '무향 제품 있어요?', '살고 싶지 않아요', '가족이 사망했어', '자해하고 싶어', '성폭력을 당했어', '죽고 싶어', '부모님과 사별했어요']) {
    const result = await invoke(handler, request({ query: message }));
    assert.equal(result.status, 200, message); assert.deepEqual(result.body, { status: 'caution' }, message);
  }
  assert.equal(calls, 0);
});

test('unsafe or unverified AI output is never shown as product copy', async () => {
  for (const data of [
    parsed('사랑은 토너 T.1으로 여드름을 치료해요.'),
    parsed('사랑은 토너 T.1의 보습으로 시작해요.'),
    parsed('사랑은 세럼 S.1처럼 투명합니다.'),
    parsed('사랑은 토너 T.1과 세럼 S.1처럼 빛납니다.'),
    parsed('사랑은 토너 T.1처럼 <img src=x> 빛납니다.'),
    parsed('사랑은 토너 T.1처럼 https://evil.example 빛납니다.'),
    parsed(`사랑은 토너 T.1 ${fakeKey}`),
    parsed('사랑은 별빛 같아요.', 'unknown'),
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] },
  ]) {
    const result = await invoke(createConcernCreativeHandler({ env: { GEMINI_API_KEY: fakeKey, GEMINI_MODEL: 'gemini-3.5-flash-lite' }, fetchImpl: async () => response(data) }));
    assert.equal(result.status, 503); assert.equal(result.body.status, 'unavailable'); assert(!result.raw.includes(fakeKey));
  }
});

test('model refusal yields caution rather than invented promotional content', async () => {
  const result = await invoke(createConcernCreativeHandler({ env: { GEMINI_API_KEY: fakeKey }, fetchImpl: async () => response(parsed('', 'toner-t1', false)) }));
  assert.deepEqual(result.body, { status: 'caution' });
});

test('invalid requests, origins, missing credentials and quota limits are handled without exposing input or key', async () => {
  let calls = 0; const handler = createConcernCreativeHandler({ env: { GEMINI_API_KEY: fakeKey, GEMINI_MODEL: 'gemini-3.5-flash-lite' }, rateLimit: 1, fetchImpl: async () => { calls++; return response(parsed()); } });
  for (const [req, code] of [[request({ query }, { method: 'GET' }), 405], [request({ query }, { headers: { origin: 'https://attacker.example' } }), 403], [request({ query }, { headers: { 'content-type': 'text/plain' } }), 415], [request({ query: '' }), 400], [request({ query, other: 'value' }), 400], [request({ query: 'x'.repeat(301) }), 400], [request('x'.repeat(4097)), 413]]) assert.equal((await invoke(handler, req)).status, code);
  assert.equal(calls, 0);
  assert.equal((await invoke(createConcernCreativeHandler({ env: {} }))).status, 503);
  assert.equal((await invoke(handler)).status, 200); assert.equal((await invoke(handler)).status, 429); assert.equal(calls, 1);
});

test('provider failure is an unavailable response and does not pretend static copy is an AI response', async () => {
  const result = await invoke(createConcernCreativeHandler({ env: { GEMINI_API_KEY: fakeKey, GEMINI_MODEL: 'gemini-3.5-flash-lite' }, fetchImpl: async () => response({ error: { message: fakeKey } }, 403) }));
  assert.equal(result.status, 503); assert.deepEqual(result.body, { status: 'unavailable' }); assert(!result.raw.includes(fakeKey));
});
