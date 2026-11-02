import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { MOCK_PRODUCT_REVIEWS } from '../review-mocks.js';
import {
  REVIEW_STORAGE_KEY,
  getReviewSummary,
  normalizeReviews,
  renderMockReviewPreview,
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

test('the preview dataset has exactly ten valid, distinct reviews per product and all five ratings', () => {
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

test('each rendered preview contains only that product’s ten reviews in lowest-rating order', () => {
  const byId = new Map(MOCK_PRODUCT_REVIEWS.map(review => [review.id, review]));
  const sourceBefore = JSON.stringify(MOCK_PRODUCT_REVIEWS);

  for (const product of products) {
    const html = renderMockReviewPreview(product);
    const ids = [...html.matchAll(/data-mock-review="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, 10);
    assert.equal(new Set(ids).size, 10);
    const rendered = ids.map(id => byId.get(id));
    assert.ok(rendered.every(review => review?.productSlug === product.slug));
    assert.equal(rendered[0].rating, 1);
    assert.equal(rendered.at(-1).rating, 5);
    assert.ok(rendered.every((review, index) => index === 0 || rendered[index - 1].rating <= review.rating));
    assert.ok(html.includes('목업 10개'));
    assert.ok(html.includes('실제 사용자 후기가 아니며'));
    assert.ok(!html.includes('data-review-id='));
    assert.ok(!html.includes('<time'));
  }

  assert.equal(JSON.stringify(MOCK_PRODUCT_REVIEWS), sourceBefore);
});

test('viewing mock reviews never creates stored reviews or a real rating summary', () => {
  for (const product of products) {
    assert.deepEqual(getReviewSummary(product.slug), { count: 0, average: null });
    renderMockReviewPreview(product);
    const page = renderProductReviews(product);
    assert.ok(page.includes('0개 리뷰'));
    assert.ok(page.includes('아직 등록된 리뷰가 없습니다.'));
    assert.deepEqual(getReviewSummary(product.slug), { count: 0, average: null });
  }

  assert.equal(writeCount, 0);
  assert.equal(storedValues.size, 0);
});

test('mock previews leave existing stored user reviews and their product-specific summaries unchanged', () => {
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
    renderMockReviewPreview(product, false);
    renderProductReviews(product);
    assert.deepEqual(getReviewSummary(product.slug), expected);
  }

  assert.equal(writeCount, 0);
  assert.deepEqual([...storedValues.entries()], before);
});
