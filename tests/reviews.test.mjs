import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  REVIEW_STORAGE_KEY,
  getReviewSummary,
  normalizeReviews,
  renderProductReviews,
  sortProductReviews,
} from '../reviews.js';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const serum = { slug: 'serum-s1', name: '세럼 S.1' };

beforeEach(() => {
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => values.get(String(key)) ?? null,
      setItem: (key, value) => values.set(String(key), String(value)),
    },
  });
});

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

function review(overrides = {}) {
  return {
    id: 'review-1',
    productSlug: serum.slug,
    rating: 3,
    body: '사용감과 용기에 대해 느낀 점을 남깁니다.',
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

function storeReviews(reviews) {
  globalThis.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews));
}

test('a product shows only its own reviews, including when different products share a review id', () => {
  const reviews = [
    review({ id: 'shared', productSlug: 'toner-t1', rating: 1, body: '토너에서만 느낀 사용 경험입니다.' }),
    review({ id: 'serum-high', rating: 5, body: '세럼의 만족스러운 사용 경험입니다.' }),
    review({ id: 'shared', rating: 2, body: '세럼 용기에 아쉬웠던 사용 경험입니다.' }),
    review({ id: 'cream-low', productSlug: 'cream-c1', rating: 1, body: '크림에서만 느낀 사용 경험입니다.' }),
  ];
  storeReviews(reviews);

  assert.deepEqual(sortProductReviews(reviews, serum.slug).map(item => item.id), ['shared', 'serum-high']);
  const html = renderProductReviews(serum);
  assert.ok(html.includes('세럼 용기에 아쉬웠던 사용 경험입니다.'));
  assert.ok(html.includes('세럼의 만족스러운 사용 경험입니다.'));
  assert.ok(!html.includes('토너에서만 느낀 사용 경험입니다.'));
  assert.ok(!html.includes('크림에서만 느낀 사용 경험입니다.'));
});

test('reviews sort from lowest rating upward, with the newest first when ratings tie', () => {
  const reviews = [
    review({ id: 'high-new', rating: 5, createdAt: '2026-11-02T12:00:00Z' }),
    review({ id: 'low-old', rating: 1, createdAt: '2026-10-01T12:00:00Z' }),
    review({ id: 'middle', rating: 3, createdAt: '2026-11-02T13:00:00Z' }),
    review({ id: 'low-new', rating: 1, createdAt: '2026-11-01T12:00:00Z' }),
  ];

  assert.deepEqual(sortProductReviews(reviews, serum.slug).map(item => item.id), [
    'low-new', 'low-old', 'middle', 'high-new',
  ]);
});

test('malformed records, invalid ratings, unsafe identifiers, and invalid review content are rejected', () => {
  const invalid = [
    null, undefined, false, 1, 'review', [], {},
    ...[0, 6, 2.5, '1', NaN, Infinity, undefined].map(rating => review({ rating })),
    ...['', 'Serum S.1', '../serum-s1', 'a'.repeat(81)].map(productSlug => review({ productSlug })),
    ...['', '<script>', 'with spaces', 'a'.repeat(101)].map(id => review({ id })),
    ...[null, 123, '', '  short  ', 'x'.repeat(1001)].map(body => review({ body })),
    ...['not-a-date', '', null, 0].map(createdAt => review({ createdAt })),
  ];

  assert.deepEqual(normalizeReviews([...invalid, review({ id: 'valid' })]).map(item => item.id), ['valid']);
  for (const value of [null, {}, '[]', 123]) assert.deepEqual(normalizeReviews(value), []);
});

test('normalization trims text, accepts the content boundaries, and removes repeated records', () => {
  const short = review({ id: 'ten-characters', body: '  1234567890  ', createdAt: '2026-11-02T09:00:00+09:00' });
  const long = review({ id: 'thousand-characters', body: 'x'.repeat(1000) });
  const normalized = normalizeReviews([short, short, long]);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].body, '1234567890');
  assert.equal(normalized[0].createdAt, '2026-11-02T00:00:00.000Z');
  assert.equal(normalized[1].body.length, 1000);
});

test('normalizing and sorting do not mutate the source reviews or their order', () => {
  const reviews = Object.freeze([
    Object.freeze(review({ id: 'high', rating: 5, body: '  사용감과 용기를 함께 살펴봤습니다.  ' })),
    Object.freeze(review({ id: 'low', rating: 1 })),
  ]);
  const original = JSON.stringify(reviews);

  const normalized = normalizeReviews(reviews);
  const sorted = sortProductReviews(reviews, serum.slug);

  assert.equal(JSON.stringify(reviews), original);
  assert.notStrictEqual(normalized, reviews);
  assert.notStrictEqual(sorted, reviews);
  assert.deepEqual(reviews.map(item => item.id), ['high', 'low']);
  assert.deepEqual(sorted.map(item => item.id), ['low', 'high']);
});

test('totals and averages combine examples with only valid written reviews of the selected product', () => {
  storeReviews([
    review({ id: 'serum-two', rating: 2 }),
    review({ id: 'serum-three', rating: 3 }),
    review({ id: 'serum-five', rating: 5 }),
    review({ id: 'invalid-serum', rating: 6 }),
    review({ id: 'toner-one', productSlug: 'toner-t1', rating: 1 }),
  ]);

  assert.deepEqual(getReviewSummary(serum.slug), { count: 13, average: 3.3, writtenCount: 3, exampleCount: 10 });
  assert.deepEqual(getReviewSummary('toner-t1'), { count: 11, average: 2.9, writtenCount: 1, exampleCount: 10 });
  assert.deepEqual(getReviewSummary('cream-c1'), { count: 10, average: 3, writtenCount: 0, exampleCount: 10 });
});

test('an empty browser displays the ten prepared ratings without creating stored user reviews', () => {
  assert.deepEqual(getReviewSummary(serum.slug), { count: 10, average: 3.3, writtenCount: 0, exampleCount: 10 });
  const html = renderProductReviews(serum);
  assert.equal((html.match(/data-review-source="example"/g) || []).length, 10);
  assert.equal((html.match(/data-review-source="user"/g) || []).length, 0);
  assert.ok(html.includes('10개 리뷰'));
  assert.ok(html.includes('<strong>3.3</strong>'));
  assert.ok(!html.includes('<strong>—</strong>'));
  assert.ok(!html.includes('data-review-id='));
});

test('adding and removing a written review updates its combined average without changing other products', () => {
  const baseline = { count: 10, average: 3.3, writtenCount: 0, exampleCount: 10 };
  assert.deepEqual(getReviewSummary(serum.slug), baseline);
  storeReviews([review({ id: 'new-written-review', rating: 5 })]);

  assert.deepEqual(getReviewSummary(serum.slug), { count: 11, average: 3.5, writtenCount: 1, exampleCount: 10 });
  assert.deepEqual(getReviewSummary('toner-t1'), { count: 10, average: 3.1, writtenCount: 0, exampleCount: 10 });
  assert.deepEqual(getReviewSummary('cream-c1'), { count: 10, average: 3, writtenCount: 0, exampleCount: 10 });

  storeReviews([]);
  assert.deepEqual(getReviewSummary(serum.slug), baseline);
});

test('products without prepared examples have no fabricated count or average', () => {
  assert.deepEqual(getReviewSummary('toner-t2'), { count: 0, average: null, writtenCount: 0, exampleCount: 0 });
  storeReviews([review({ productSlug: 'toner-t2', rating: 4 })]);
  assert.deepEqual(getReviewSummary('toner-t2'), { count: 1, average: 4, writtenCount: 1, exampleCount: 0 });
  assert.deepEqual(getReviewSummary('toner-t1'), { count: 10, average: 3.1, writtenCount: 0, exampleCount: 10 });
});

test('stored review text is escaped before it is rendered as HTML', () => {
  storeReviews([review({ body: '<script>alert("XSS")</script> & \'quoted\' text' })]);

  const html = renderProductReviews(serum);

  assert.ok(html.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('&amp; &#39;quoted&#39; text'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('</script>'));
});

test('corrupted JSON and unexpected storage shapes show a clear error without crashing or inventing reviews', () => {
  for (const raw of ['{"broken":', '{}', 'null', '"unexpected string"']) {
    globalThis.localStorage.setItem(REVIEW_STORAGE_KEY, raw);

    assert.deepEqual(getReviewSummary(serum.slug), { count: 10, average: 3.3, writtenCount: 0, exampleCount: 10 });
    let html;
    assert.doesNotThrow(() => { html = renderProductReviews(serum); });
    assert.ok(html.includes('저장된 리뷰를 불러오지 못했습니다.'));
    assert.ok(html.includes('role="alert"'));
    assert.ok(html.includes('10개 리뷰'));
    assert.ok(!html.includes('data-review-id='));
    assert.equal(globalThis.localStorage.getItem(REVIEW_STORAGE_KEY), raw);
  }
});
