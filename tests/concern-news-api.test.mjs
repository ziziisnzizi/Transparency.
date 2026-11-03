import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConcernNewsHandler, MAX_NEWS_REQUEST_BYTES, MAX_CONCERN_ARTICLES } from '../api/concern-news.js';
import { CONCERN_TOPICS, getConcernTopic } from '../lib/concern-topics.js';
import { getConcernNewsSources } from '../lib/concern-news-sources.js';

const fixture = Object.freeze({
  id: 'unit-reviewed-article', title: '검토된 자료 제목', sourceName: '자료 출처',
  sourceUrl: 'https://publisher.example.org', url: 'https://publisher.example.org/skin/article',
  publishedAt: '2026-10-30', checkedAt: '2026-11-03', kind: 'news', topics: Object.freeze(['dryness']),
});

function request(url = '/api/concern-news?topic=dryness', options = {}) {
  return {
    method: options.method || 'GET', url,
    headers: { host: 'example.test', ...options.headers },
    socket: { remoteAddress: options.address || 'unit-address' },
    ...(Object.hasOwn(options, 'body') ? { body: options.body } : {}),
  };
}

async function invoke(handler, req = request()) {
  const response = { statusCode: 0, headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, end(value) { this.raw = value; } };
  await handler(req, response);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.match(response.headers['content-type'], /^application\/json/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers.vary, 'Origin');
  return { status: response.statusCode, headers: response.headers, raw: response.raw, body: JSON.parse(response.raw) };
}

test('reviewed articles and institutional guides keep genuine metadata without a real-time or invented date claim', async () => {
  const guide = { ...fixture, id: 'unit-reviewed-guide', kind: 'guide', url: 'https://publisher.example.org/guide', publishedAt: null, checkedAt: '2026-11-02' };
  const result = await invoke(createConcernNewsHandler({ getSources: () => [fixture, guide] }));
  assert.equal(result.status, 200);
  assert.equal(result.body.topic, 'dryness');
  assert.equal(result.body.status, 'curated');
  assert.equal(result.body.checkedAt, '2026-11-02');
  assert.equal(result.body.articles.length, 2);
  assert.deepEqual(result.body.articles[0], {
    id: fixture.id, title: fixture.title, sourceName: fixture.sourceName,
    sourceUrl: 'https://publisher.example.org/', url: fixture.url,
    publishedAt: fixture.publishedAt, checkedAt: fixture.checkedAt, kind: 'news',
  });
  assert.equal(result.body.articles[1].kind, 'guide');
  assert.equal(result.body.articles[1].publishedAt, null);
  assert.equal(Object.hasOwn(result.body, 'fetchedAt'), false);
  assert.match(result.body.notice, /실시간 뉴스가 아닌/);
});

test('published topic results contain only the reviewed catalog records for that topic', async () => {
  const handler = createConcernNewsHandler();
  for (const topic of CONCERN_TOPICS) {
    const result = await invoke(handler, request(`/api/concern-news?topic=${topic.id}`));
    const originals = getConcernNewsSources(topic.id);
    assert.equal(result.status, 200);
    assert.equal(result.body.status, result.body.articles.length ? 'curated' : 'unavailable');
    if (originals.length) assert.ok(result.body.articles.length > 0, `${topic.id} has reviewed sources and should expose valid cards`);
    assert.ok(result.body.articles.length <= MAX_CONCERN_ARTICLES);
    for (const article of result.body.articles) {
      const original = originals.find(item => item.id === article.id);
      assert.ok(original);
      for (const key of ['title', 'sourceName', 'publishedAt', 'kind', 'checkedAt']) assert.equal(article[key], original[key]);
      assert.equal(article.url, new URL(original.url).href);
      assert.ok(original.topics.includes(topic.id));
    }
    const search = new URL(result.body.searchUrl);
    assert.equal(search.origin, 'https://news.google.com');
    assert.equal(search.pathname, '/search');
    assert.equal(search.searchParams.get('q'), topic.newsQuery);
    assert.equal(search.searchParams.get('hl'), 'ko');
    assert.equal(search.searchParams.get('gl'), 'KR');
    assert.equal(search.searchParams.get('ceid'), 'KR:ko');
  }
});

test('invalid methods, queries, origins, request sizes and private text are rejected before source lookup', async () => {
  const privateText = 'unit-private-question-and-review-marker';
  let calls = 0;
  const handler = createConcernNewsHandler({ getSources: () => { calls++; return [fixture]; } });
  const cases = [
    [request(undefined, { method: 'POST' }), 405],
    [request(undefined, { method: 'DELETE' }), 405],
    [request('/api/concern-news'), 400],
    [request('https://[invalid'), 400],
    [request('/api/concern-news?topic=unknown'), 400],
    [request('/api/concern-news?topic=dryness&topic=barrier'), 400],
    [request(`/api/concern-news?topic=dryness&q=${privateText}`), 400],
    [request(`/api/concern-news?question=${privateText}`), 400],
    [request(`/api/concern-news?topic=${privateText}`), 400],
    [request(`/api/concern-news?topic=${'x'.repeat(MAX_NEWS_REQUEST_BYTES)}`), 414],
    [request(undefined, { headers: { origin: 'https://foreign.test' } }), 403],
    [request(undefined, { headers: { origin: 'null' } }), 403],
    [request(undefined, { body: { question: privateText } }), 400],
    [request(undefined, { headers: { 'content-length': '9000' } }), 400],
    [request(undefined, { headers: { 'content-length': 'invalid' } }), 400],
    [request(undefined, { headers: { 'transfer-encoding': 'chunked' } }), 400],
  ];
  for (const [req, expected] of cases) {
    const result = await invoke(handler, req);
    assert.equal(result.status, expected);
    assert.equal(typeof result.body.error, 'string');
    assert.ok(!result.raw.includes(privateText));
    if (expected === 405) assert.equal(result.headers.allow, 'GET');
  }
  assert.equal(calls, 0);
});

test('same-origin requests work and rate limits remain per address with bounded windows', async () => {
  let time = 1000;
  let calls = 0;
  const handler = createConcernNewsHandler({ getSources: () => { calls++; return [fixture]; }, now: () => time, rateLimit: 2, rateWindowMs: 1000 });
  const req = () => request(undefined, { headers: { origin: 'https://example.test', 'x-forwarded-proto': 'https' } });
  assert.equal((await invoke(handler, req())).status, 200);
  assert.equal((await invoke(handler, req())).status, 200);
  const limited = await invoke(handler, req());
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers['retry-after']) >= 1);
  assert.equal(calls, 2);
  assert.equal((await invoke(handler, request(undefined, { address: 'another-address' }))).status, 200);
  time += 1001;
  assert.equal((await invoke(handler, req())).status, 200);
});

test('unsafe links, mismatched publishers, malformed dates and unrelated records cannot become article cards', async () => {
  const invalid = [
    { ...fixture, id: 'missing-title', title: '' },
    { ...fixture, id: 'missing-source', sourceName: '' },
    { ...fixture, id: 'private-link', url: 'https://127.0.0.1/article', sourceUrl: 'https://127.0.0.1' },
    { ...fixture, id: 'javascript-link', url: 'javascript:alert(1)' },
    { ...fixture, id: 'insecure-link', url: 'http://publisher.example.org/article' },
    { ...fixture, id: 'credential-link', url: 'https://user:password@publisher.example.org/article' },
    { ...fixture, id: 'other-publisher', url: 'https://publisher.example.org.attacker.test/article' },
    { ...fixture, id: 'invalid-date', publishedAt: 'not-a-date' },
    { ...fixture, id: 'impossible-date', publishedAt: '2026-02-31' },
    { ...fixture, id: 'missing-checked-date', checkedAt: null },
    { ...fixture, id: 'unrelated-topic', topics: ['aging'] },
    { ...fixture, id: 'unsupported-kind', kind: 'advertisement' },
  ];
  const result = await invoke(createConcernNewsHandler({ getSources: () => [...invalid, fixture, fixture, { ...fixture, id: 'duplicate-url' }] }));
  assert.equal(result.body.status, 'curated');
  assert.deepEqual(result.body.articles.map(item => item.id), [fixture.id]);
});

test('article data stays plain JSON and metadata arrays are not mutated', async () => {
  const xssTitle = '<img src=x onerror=alert(1)> & 출처 제목';
  const record = Object.freeze({ ...fixture, title: xssTitle, sourceName: '<script>source</script>' });
  const records = Object.freeze([record]);
  const before = JSON.stringify(records);
  const result = await invoke(createConcernNewsHandler({ getSources: () => records }));
  assert.equal(result.body.articles[0].title, xssTitle);
  assert.equal(result.body.articles[0].sourceName, record.sourceName);
  assert.equal(JSON.stringify(records), before);
  assert.match(result.headers['content-type'], /^application\/json/);
});

test('only a fixed topic ID is used for catalog lookup and the endpoint makes no outbound request', async t => {
  let outbound = 0;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async () => { outbound++; throw Error('network must not be used'); });
  const privateText = 'unit-private-question-with-a-full-sentence';
  const handler = createConcernNewsHandler({ getSources: (...args) => { calls.push(args); return [fixture]; } });
  const result = await invoke(handler, request(undefined, { headers: { 'x-private-question': privateText } }));
  assert.deepEqual(calls, [['dryness']]);
  assert.equal(outbound, 0);
  const search = new URL(result.body.searchUrl);
  assert.equal(search.searchParams.get('q'), getConcernTopic('dryness').newsQuery);
  assert.ok(!result.raw.includes(privateText));
});

test('an empty or failed catalog gives an honest unavailable state with a real external search link', async t => {
  const logs = [];
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, (...args) => logs.push(args));
  for (const getSources of [() => [], () => { throw Error('private-key-and-internal-error-marker'); }]) {
    const result = await invoke(createConcernNewsHandler({ getSources }), request('/api/concern-news?topic=sensitivity'));
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'unavailable');
    assert.deepEqual(result.body.articles, []);
    assert.equal(result.body.checkedAt, null);
    assert.equal(new URL(result.body.searchUrl).searchParams.get('q'), getConcernTopic('sensitivity').newsQuery);
    assert.ok(!result.raw.includes('private-key-and-internal-error-marker'));
    assert.ok(!result.raw.includes('live'));
  }
  assert.deepEqual(logs, []);
});

test('result cards are capped without inventing more records than the catalog provides', async () => {
  const records = Array.from({ length: MAX_CONCERN_ARTICLES + 3 }, (_, index) => ({ ...fixture, id: `unit-article-${index}`, url: `https://publisher.example.org/article/${index}` }));
  const result = await invoke(createConcernNewsHandler({ getSources: () => records }));
  assert.equal(result.body.articles.length, MAX_CONCERN_ARTICLES);
  assert.deepEqual(result.body.articles.map(item => item.id), records.slice(0, MAX_CONCERN_ARTICLES).map(item => item.id));
});
