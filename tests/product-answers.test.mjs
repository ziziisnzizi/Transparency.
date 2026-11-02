import assert from 'node:assert/strict';
import { test } from 'node:test';
import { products, purchasePricing } from '../products.js';
import {
  QUESTION_LIMIT,
  findQuestionProduct,
  buildProductSources,
  validateQuestionInput,
  getReferenceAnswer,
  createGroundingPrompt,
} from '../lib/product-answers.js';

const serum = findQuestionProduct('serum-s1');

test('only published product records can provide facts and product-specific citation identifiers', () => {
  assert.equal(findQuestionProduct('not-a-product'), null);
  const sections = new Set(['제품 정보', '성분·함량', '효능·근거', '사용 안내']);
  for (const product of products) {
    const sources = buildProductSources(product);
    assert.equal(new Set(sources.map(item => item.id)).size, sources.length);
    assert.ok(sources.every(item => item.id.startsWith(`${product.slug}:`)));
    assert.ok(sources.every(item => sections.has(item.section) && item.title && item.excerpt));
    assert.ok(sources.find(item => item.id.endsWith(':overview')).excerpt.includes(product.volume));
    for (const [ingredient] of product.ingredients) assert.ok(sources.some(item => item.title === ingredient));
    const purchase = sources.find(item => item.id.endsWith(':purchase')).excerpt;
    assert.ok(purchase.includes(product.price.toLocaleString('ko-KR')));
    assert.ok(purchase.includes(purchasePricing.shippingFee.toLocaleString('ko-KR')));
    assert.ok(purchase.includes(purchasePricing.freeShippingThreshold.toLocaleString('ko-KR')));
  }
});

test('question validation accepts bounded ordinary text and rejects extra client authority', () => {
  assert.equal(QUESTION_LIMIT, 500);
  const valid = validateQuestionInput({ productSlug: serum.slug, question: '  판테놀의 역할은 무엇인가요?  ' });
  assert.equal(valid.product, serum);
  assert.equal(valid.question, '판테놀의 역할은 무엇인가요?');
  assert.ok(!validateQuestionInput({ productSlug: serum.slug, question: '가'.repeat(500) }).error);
  for (const question of ['', '   ', '가'.repeat(501), null, 3, '질문\u0000내용']) {
    assert.ok(validateQuestionInput({ productSlug: serum.slug, question }).error);
  }
  assert.ok(validateQuestionInput({ productSlug: serum.slug, question: '질문', sources: [] }).error);
  assert.ok(validateQuestionInput({ productSlug: 'toner-t2', question: '질문' }).error);
});

test('ingredient questions return the chosen formula rather than a different product’s concentration', () => {
  const toner = findQuestionProduct('toner-t1');
  const cream = findQuestionProduct('cream-c1');
  const tonerAnswer = getReferenceAnswer(toner, '판테놀은 얼마나 들어 있나요?');
  assert.match(tonerAnswer.answer, /판테놀 0\.5%/);
  assert.ok(tonerAnswer.sources.every(item => item.id.startsWith('toner-t1:')));
  const serumAnswer = getReferenceAnswer(serum, '판테놀 역할을 알려주세요.');
  assert.match(serumAnswer.answer, /판테놀 1\.0%/);
  const creamAnswer = getReferenceAnswer(cream, '스쿠알란이 어떤 성분인가요?');
  assert.match(creamAnswer.answer, /스쿠알란 3\.0%/);
  assert.ok(creamAnswer.sources.every(item => item.id.startsWith('cream-c1:')));
});

test('niacinamide reference research does not become a claim that serum contains it', () => {
  const result = getReferenceAnswer(serum, '나이아신아마이드가 들어 있나요?');
  assert.match(result.answer, /주요 성분/);
  assert.match(result.answer, /목록에는 나이아신아마이드가 포함되어 있지 않습니다/);
  assert.match(result.answer, /전성분/);
  assert.match(result.answer, /완제품의 효능 근거가 아닙니다/);
  assert.ok(result.sources.some(item => item.id.endsWith(':niacinamide-reference')));
});

test('ingredient-study results stay distinct from published finished-product trial evidence', () => {
  const result = getReferenceAnswer(serum, '히알루론산 연구와 효능 근거가 있나요?');
  assert.match(result.answer, /공개된 완제품 시험 결과는 없습니다/);
  assert.match(result.answer, /Pavicic/);
  assert.match(result.answer, /76명/);
  assert.match(result.answer, /완제품 시험과 동일하지 않습니다/);
  assert.ok(result.sources.some(item => item.id.endsWith(':evidence')));
  assert.ok(result.sources.some(item => item.id.endsWith(':hyaluronic-reference')));
});

test('medical suitability, sensitive skin, and disease claims are never promised by reference answers', () => {
  for (const question of ['임산부가 사용해도 되나요?', '수유 중인데 괜찮나요?', '여드름 치료가 되나요?', '민감한 피부에 무조건 안전한가요?']) {
    for (const product of products) {
      const result = getReferenceAnswer(product, question);
      assert.match(result.answer, /확답할 수 있는 시험 자료는 공개되어 있지 않습니다/);
      assert.match(result.answer, /전문가와 상담/);
      assert.ok(result.sources.every(item => item.id.startsWith(`${product.slug}:`)));
    }
  }
});

test('use instructions preserve the known amount without inventing drop counts or fixed shelf life', () => {
  for (const product of products) {
    const routine = getReferenceAnswer(product, '사용 순서와 사용량을 알려주세요.');
    assert.ok(routine.answer.includes(product.amount));
    assert.match(routine.answer, /토너 T\.1.*세럼 S\.1.*크림 C\.1/);
    assert.match(routine.answer, /정해진 방울 수.*하루 사용 횟수는 등록 자료에 없습니다/);
    const shelfLife = getReferenceAnswer(product, '개봉 후 언제까지 사용하나요?');
    assert.match(shelfLife.answer, /확정된 개봉 후 사용기간.*없습니다/);
    assert.match(shelfLife.answer, /임의로 6개월 등 기간을 정할 수 없습니다/);
  }
});

test('missing formula certifications and off-topic questions disclose their unavailable evidence', () => {
  for (const question of ['비건 인증인가요?', '향료 무첨가인가요?', 'pH 수치는 얼마인가요?']) {
    const result = getReferenceAnswer(serum, question);
    assert.equal(result.matched, false);
    assert.match(result.answer, /등록된 제품 자료에서 확인할 수 없습니다/);
  }
  const unknown = getReferenceAnswer(serum, '내일 제주도 항공편을 예약해 주세요.');
  assert.equal(unknown.matched, false);
  assert.deepEqual(unknown.sources, []);
  assert.match(unknown.answer, /추측하지 않습니다/);
});

test('model grounding is a self-contained registered product context rather than review or checkout user data', () => {
  const prompt = createGroundingPrompt(serum);
  assert.deepEqual(prompt.sources, buildProductSources(serum));
  assert.match(prompt.system, /성분 연구와 완제품 시험 결과를 구분/);
  assert.match(prompt.system, /후기·리뷰는 효능 근거가 아닙니다/);
  assert.match(prompt.system, /사용기한·사용 횟수·방울 수를 만들지 마세요/);
  assert.ok(!JSON.stringify(prompt).includes('GEMINI_API_KEY'));
  assert.ok(!JSON.stringify(prompt).includes('구매자 인증'));
});
