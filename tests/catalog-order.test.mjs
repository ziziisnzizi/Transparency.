import assert from 'node:assert/strict';
import test from 'node:test';
import { orderProductsByRoutine } from '../catalog.js';

test('product ratings and review counts cannot override the skincare routine', () => {
  const products = [
    { id: 'c1', kind: 'cream', name: '크림 C.1', rating: 1, reviewCount: 500 },
    { id: 's1', kind: 'serum', name: '세럼 S.1', rating: 3, reviewCount: 25 },
    { id: 't1', kind: 'toner', name: '토너 T.1', rating: 5, reviewCount: 1 },
  ];
  assert.deepEqual(orderProductsByRoutine(products).map(p => p.id), ['t1', 's1', 'c1']);

  const changedReviews = products.map(p => ({ ...p, rating: 6 - p.rating, reviewCount: 501 - p.reviewCount }));
  assert.deepEqual(orderProductsByRoutine(changedReviews).map(p => p.id), ['t1', 's1', 'c1']);
});

test('new toner variants stay together before serum and use natural version order', () => {
  const products = [
    { id: 't10', kind: 'toner', name: '토너 T.10' },
    { id: 's1', kind: 'serum', name: '세럼 S.1' },
    { id: 't2', kind: 'toner', name: '토너 T.2' },
    { id: 'c1', kind: 'cream', name: '크림 C.1' },
    { id: 't1', kind: 'toner', name: '토너 T.1' },
  ];

  assert.deepEqual(orderProductsByRoutine(products).map(p => p.id), ['t1', 't2', 't10', 's1', 'c1']);
});

test('ordering leaves the caller’s catalog and product data unchanged', () => {
  const cream = Object.freeze({ id: 'c1', kind: 'cream', name: '크림 C.1', rating: 1 });
  const toner = Object.freeze({ id: 't1', kind: 'toner', name: '토너 T.1', rating: 5 });
  const products = Object.freeze([cream, toner]);
  const before = JSON.stringify(products);

  const ordered = orderProductsByRoutine(products);

  assert.notStrictEqual(ordered, products);
  assert.equal(JSON.stringify(products), before);
  assert.deepEqual(products.map(p => p.id), ['c1', 't1']);
  assert.deepEqual(ordered.map(p => p.id), ['t1', 'c1']);
});

test('ingredient search subsets retain routine order without requiring every product family', () => {
  const products = [
    { id: 's1', kind: 'serum', name: '세럼 S.1', ingredients: '판테놀' },
    { id: 'c1', kind: 'cream', name: '크림 C.1', ingredients: '스쿠알란' },
    { id: 't2', kind: 'toner', name: '토너 T.2', ingredients: '판테놀' },
    { id: 't1', kind: 'toner', name: '토너 T.1', ingredients: '글리세린' },
  ];
  const matches = products.filter(p => p.ingredients.includes('판테놀'));

  assert.deepEqual(orderProductsByRoutine(matches).map(p => p.id), ['t2', 's1']);
  assert.deepEqual(orderProductsByRoutine(products.filter(p => p.kind === 'toner')).map(p => p.id), ['t1', 't2']);
});
