import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { MOCK_PRODUCT_REVIEWS } from '../review-mocks.js';
import {
  REVIEW_STORAGE_KEY,
  getProductReviewFeed,
  getReviewSummary,
  normalizeReviews,
  renderProductReviews,
} from '../reviews.js';

const products = [
  { slug: 'toner-t1', name: '토너 T.1' },
  { slug: 'serum-s1', name: '세럼 S.1' },
  { slug: 'cream-c1', name: '크림 C.1' },
];
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let storedValues;
let writeCount;

beforeEach(() => {
  storedValues = new Map();
  writeCount = 0;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => storedValues.get(String(key)) ?? null,
      setItem: (key, value) => {
        writeCount += 1;
        storedValues.set(String(key), String(value));
      },
    },
  });
});

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

test('the example dataset has exactly ten valid, distinct reviews per product and all five ratings', () => {
  assert.equal(MOCK_PRODUCT_REVIEWS.length, 30);
  assert.equal(normalizeReviews(MOCK_PRODUCT_REVIEWS).length, 30);
  assert.equal(new Set(MOCK_PRODUCT_REVIEWS.map(review => review.id)).size, 30);
  assert.equal(new Set(MOCK_PRODUCT_REVIEWS.map(review => review.body)).size, 30);
  assert.deepEqual([...new Set(MOCK_PRODUCT_REVIEWS.map(review => review.productSlug))].sort(), products.map(product => product.slug).sort());

  for (const product of products) {
    const reviews = MOCK_PRODUCT_REVIEWS.filter(review => review.productSlug === product.slug);
    assert.equal(reviews.length, 10, product.slug);
    assert.deepEqual([...new Set(reviews.map(review => review.rating))].sort(), [1, 2, 3, 4, 5]);
    assert.ok(reviews.every(review => Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5));
    assert.ok(reviews.every(review => review.body.trim().length >= 10 && review.body.length <= 1000));
  }
});

function renderedEntries(html) {
  const list = html.match(/<ol class="review-list"[^>]*>([\s\S]*?)<\/ol>/)?.[1];
  assert.ok(list, 'a single shared review list is rendered');
  return [...list.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)].map(([, attributes, content]) => ({
    source: attributes.match(/data-review-source="([^"]+)"/)?.[1],
    id: attributes.match(/data-(?:review-id|example-review)="([^"]+)"/)?.[1],
    content,
    attributes,
  }));
}

test('each product renders one lowest-rating-first list with a single visible source disclosure', () => {
  const sourceBefore = JSON.stringify(MOCK_PRODUCT_REVIEWS);

  for (const product of products) {
    const feed = getProductReviewFeed(product.slug);
    assert.equal(feed.length, 10);
    assert.ok(feed.every(review => review.productSlug === product.slug && review.source === 'example'));
    assert.equal(feed[0].rating, 1);
    assert.equal(feed.at(-1).rating, 5);
    assert.ok(feed.every((review, index) => index === 0 || feed[index - 1].rating <= review.rating));

    const html = renderProductReviews(product);
    const entries = renderedEntries(html);
    assert.equal((html.match(/<ol class="review-list"/g) || []).length, 1);
    assert.equal(entries.length, 10);
    assert.deepEqual(entries.map(entry => entry.id), feed.map(review => review.id));
    assert.ok(entries.every(entry => entry.source === 'example'));
    assert.ok(entries.every(entry => !/목업|미리보기|review-source-badge|<time\b|data-review-delete=/.test(entry.content)));
    assert.equal((html.match(/class="review-source-note"/g) || []).length, 1);
    assert.match(html, /<p class="review-source-note">[^<]*실제 구매 후기가 아니며[^<]*직접 작성한 리뷰만 평균 별점과 리뷰 수에 반영됩니다\.<\/p>/);
    assert.doesNotMatch(html, /목업|미리보기|review-source-badge|review-preview|<details\b/);
    assert.ok(!html.includes('data-review-id='));
    assert.ok(!html.includes('<time'));
  }

  assert.equal(JSON.stringify(MOCK_PRODUCT_REVIEWS), sourceBefore);
});

test('newest user reviews merge with examples by rating without leaking other products or mutating inputs', () => {
  const userReviews = [
    { id: 'user-high', productSlug: 'serum-s1', rating: 5, body: '세럼을 사용한 뒤 느낀 만족스러운 사용 경험입니다.', createdAt: '2026-11-03T11:00:00Z' },
    { id: 'user-low', productSlug: 'serum-s1', rating: 1, body: '세럼을 덜어내는 과정에서 불편했던 사용 경험입니다.', createdAt: '2026-11-03T10:00:00Z' },
    { id: 'other-family', productSlug: 'toner-t1', rating: 1, body: '토너에서만 느낀 불편했던 사용 경험입니다.', createdAt: '2026-11-03T12:00:00Z' },
  ];
  const before = JSON.stringify(userReviews);

  const feed = getProductReviewFeed('serum-s1', userReviews);

  assert.equal(feed.length, 12);
  assert.equal(feed.filter(review => review.source === 'user').length, 2);
  assert.equal(feed.filter(review => review.source === 'example').length, 10);
  assert.ok(feed.every(review => review.productSlug === 'serum-s1'));
  assert.equal(feed[0].id, 'user-low', 'a new one-star review precedes older one-star examples');
  const fiveStar = feed.filter(review => review.rating === 5);
  assert.equal(fiveStar[0].id, 'user-high', 'newest-first tie breaking also spans the two sources');
  assert.ok(feed.every((review, index) => index === 0 || feed[index - 1].rating <= review.rating));
  assert.ok(!feed.some(review => review.id === 'other-family'));
  assert.equal(JSON.stringify(userReviews), before);
});

test('reading the combined list never creates stored user reviews or a real rating summary', () => {
  for (const product of products) {
    assert.deepEqual(getReviewSummary(product.slug), { count: 0, average: null });
    assert.equal(getProductReviewFeed(product.slug).length, 10);
    const page = renderProductReviews(product);
    assert.ok(page.includes('0개 리뷰'));
    assert.equal(renderedEntries(page).filter(entry => entry.source === 'user').length, 0);
    assert.deepEqual(getReviewSummary(product.slug), { count: 0, average: null });
  }

  assert.equal(writeCount, 0);
  assert.equal(storedValues.size, 0);
});

test('the combined list leaves stored user reviews and product-specific summaries unchanged', () => {
  const ratings = [5, 2, 4];
  storedValues.set(REVIEW_STORAGE_KEY, JSON.stringify(products.map((product, index) => ({
    id: `user-${index}`,
    productSlug: product.slug,
    rating: ratings[index],
    body: '사용자가 직접 작성하고 저장한 사용 경험입니다.',
    createdAt: '2026-11-02T10:00:00.000Z',
  }))));
  storedValues.set('another-preference', 'preserve-this-value');
  const before = [...storedValues.entries()];

  for (const [index, product] of products.entries()) {
    const expected = { count: 1, average: ratings[index] };
    assert.deepEqual(getReviewSummary(product.slug), expected);
    assert.equal(getProductReviewFeed(product.slug).length, 11);
    const entries = renderedEntries(renderProductReviews(product));
    assert.equal(entries.filter(entry => entry.source === 'example').length, 10);
    const userEntries = entries.filter(entry => entry.source === 'user');
    assert.equal(userEntries.length, 1);
    assert.equal(userEntries[0].id, `user-${index}`);
    assert.match(userEntries[0].content, new RegExp(`data-review-delete="user-${index}"`));
    assert.ok(entries.filter(entry => entry.source === 'example').every(entry => !entry.content.includes('data-review-delete=')));
    assert.equal(entries.filter(entry => entry.attributes.includes('data-review-id=')).length, 1);
    assert.deepEqual(getReviewSummary(product.slug), expected);
  }

  assert.equal(writeCount, 0);
  assert.deepEqual([...storedValues.entries()], before);
});
