import assert from 'node:assert/strict';
import { test } from 'node:test';
import { products } from '../products.js';
import { fallbackConcernCreative, isEverydayCreativeQuestion } from '../lib/concern-creative-fallback.js';
import { analyzeConcern } from '../lib/concern-search.js';

test('ordinary off-topic questions can use honest, separately marked product information', () => {
  for (const question of ['오늘 뭐 먹지?', '내일 날씨 어때?', '사랑이 뭐야?', '고양이 좋아해?', '우주의 크기는?', '2+2는?', '이 영화 추천해', 'qzxw']) {
    const result = fallbackConcernCreative(question);
    assert.equal(result?.status, 'fallback', question);
    const product = products.find(item => item.slug === result.productSlug);
    assert.ok(product, question);
    assert.ok(result.message.includes(product.name), question);
    assert.ok(result.message.includes(product.texture.replace(/\s*제형\s*$/, '')), question);
    assert.ok(!result.message.includes(question), 'fallback must not echo arbitrary user text');
    assert.ok(!/먹어|마셔|진단|치료|확실한 효과|저자극 인증/.test(result.message), question);
  }
});

test('only explicit everyday topics qualify for an analogy retry, with no invented factual answer', () => {
  for (const question of ['오늘 뭐 먹지?', '내일 날씨 어때?', '사랑이 뭐야?', '고양이 좋아해?', '음악이 뭐야?', '수학이 뭘까?', '2+2', '2+2는?']) {
    assert.equal(isEverydayCreativeQuestion(question), true, question);
    const answer = fallbackConcernCreative(question, { neutral: false });
    assert.equal(answer?.status, 'fallback', question);
    assert.ok(answer.message.includes('\n'), question);
    assert.ok(!/먹어|마셔|진단|치료|내일은 맑|정답은/.test(answer.message), question);
  }
  assert.equal(isEverydayCreativeQuestion('정체를 알 수 없는 질문'), false);
});

test('the factual fallback preserves verified skincare matches and avoids sensitive contexts', () => {
  const query = '가벼운 제형을 찾고 싶어요';
  const expected = analyzeConcern(query).recommendations[0]?.product.slug;
  assert.ok(expected);
  assert.equal(fallbackConcernCreative(query)?.productSlug, expected);
  for (const question of ['', 'a'.repeat(301), '피부에 좁쌀 여드름이 생겼어', '글리세린에 알레르기가 있어요', '무향 제품 추천해줘', '친구가 세상을 떠나고 슬퍼요', '죽고 싶어', '실직해서 힘들어요', '병원에 가야 할까요?']) {
    assert.equal(fallbackConcernCreative(question), null, question);
    assert.equal(isEverydayCreativeQuestion(question), false, question);
  }
});
