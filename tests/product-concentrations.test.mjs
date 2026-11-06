import { test } from 'node:test';
import assert from 'node:assert/strict';
import { products } from '../products.js';

test('each provided ingredient has a corresponding concentration in the same order', () => {
  const expected = {
    'serum-s1': { '정제수': '85.6%', '판테놀': '0.5%', '병풀추출물': '1.0%', '1,2-헥산다이올': '1.0%' },
    'toner-t1': { '정제수': '88.78%', '소듐하이알루로네이트': '0.05%', '시트릭애씨드': '0.02%' },
    'cream-c1': { '정제수': '72%', '세라마이드엔피': '0.1%', '알란토인': '0.2%' },
  };
  for (const product of products) {
    assert.equal(product.fullIngredients.length, product.fullIngredientConcentrations.length);
    for (const [name, concentration] of Object.entries(expected[product.slug])) {
      assert.equal(product.fullIngredientConcentrations[product.fullIngredients.indexOf(name)], concentration);
    }
    for (const item of product.ingredients) {
      assert.ok(item[0].endsWith('%'));
    }
  }
});

test('preserves the supplied composition totals without inventing a correction', () => {
  const totals = products.map(product => product.fullIngredientConcentrations.reduce((sum, value) => sum + Number.parseFloat(value), 0));
  assert.deepEqual(totals.map(total => Math.round(total * 100) / 100), [100, 100, 99.95]);
});
