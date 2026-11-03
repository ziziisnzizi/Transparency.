import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeConcern,
  CONCERN_QUERY_LIMIT,
  normalizeConcernQuery,
  validateConcernQuery,
} from '../lib/concern-search.js';
import { CONCERN_TOPICS, getConcernTopic } from '../lib/concern-topics.js';
import { products } from '../products.js';
import { researchPapers } from '../evidence-data.js';
import { MOCK_PRODUCT_REVIEWS } from '../review-mocks.js';

const topicIds = result => result.topics.map(topic => topic.id);
const recommended = result => result.recommendations.map(item => item.product.slug);

function writtenReview(overrides = {}) {
  return {
    id: 'written-serum-low',
    productSlug: 'serum-s1',
    rating: 1,
    body: '세럼을 바르고 나서 끈적임이 남아 사용감이 불편했어요.',
    createdAt: '2026-11-03T10:00:00.000Z',
    source: 'user',
    ...overrides,
  };
}

function freezeDeep(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function recommendationText(recommendation) {
  return JSON.stringify({ reasons: recommendation.reasons, limitations: recommendation.limitations });
}

test('concern queries normalize Korean composition and whitespace without reversing or splitting Hangul', () => {
  assert.equal(CONCERN_QUERY_LIMIT, 300);
  assert.equal(normalizeConcernQuery('  피부\u3000장벽\n\t 건조해요  '), '피부 장벽 건조해요');
  assert.equal(normalizeConcernQuery('건조해요'.normalize('NFD')), '건조해요');
  assert.equal(normalizeConcernQuery('레미콘'), '레미콘');
  for (const value of [null, undefined, 42, {}, []]) assert.equal(normalizeConcernQuery(value), '');
  assert.equal(validateConcernQuery('가'.repeat(300)).error, '');
  assert.equal(validateConcernQuery('가'.repeat(300).normalize('NFD')).error, '');
  assert.ok(validateConcernQuery('가'.repeat(301)).error);
  for (const value of ['', ' \n\t ', null, 7, {}]) assert.ok(validateConcernQuery(value).error);
  assert.deepEqual(validateConcernQuery('  피부가 건조해요  '), { query: '피부가 건조해요', error: '' });
});

test('invalid input is not truncated into a valid concern and cannot force matches', () => {
  for (const query of [null, 42, {}, '', '건조'.repeat(151), '건조\u0000해요']) {
    const result = analyzeConcern(query);
    assert.equal(result.status, 'unknown');
    assert.deepEqual(result.recommendations, []);
    assert.deepEqual(result.research, []);
    assert.deepEqual(result.externalLinks, []);
    assert.ok(result.validationError);
  }
});

test('recognized concerns use actual product roles instead of recommending every product for everything', () => {
  const dryness = analyzeConcern('세안 후 피부가 당기고 건조해요');
  const barrier = analyzeConcern('피부 장벽과 보습 마무리에 관련된 성분을 찾아줘');
  const lightweight = analyzeConcern('가벼운 워터 제형을 찾고 있어요');
  assert.equal(dryness.status, 'matched');
  assert.ok(topicIds(dryness).includes('dryness'));
  assert.ok(recommended(dryness).some(slug => ['serum-s1', 'toner-t1'].includes(slug)));
  assert.equal(barrier.status, 'matched');
  assert.ok(topicIds(barrier).includes('barrier'));
  assert.equal(recommended(barrier)[0], 'cream-c1');
  assert.equal(lightweight.status, 'matched');
  assert.ok(topicIds(lightweight).includes('lightweight'));
  assert.equal(recommended(lightweight)[0], 'toner-t1');
  assert.notEqual(recommended(barrier)[0], recommended(lightweight)[0]);
  for (const result of [dryness, barrier, lightweight]) {
    assert.ok(result.recommendations.length > 0);
    for (const entry of result.recommendations) {
      assert.ok(products.includes(entry.product), 'recommendations must use the actual published product record');
      assert.ok(entry.reasons.length > 0, 'a suggestion needs a product-specific reason');
      assert.ok(entry.limitations.length > 0, 'a suggestion must retain its application limits');
      assert.equal(typeof entry.primary, 'boolean');
    }
  }
});

test('serum stickiness can suggest the toner’s different texture without using higher stars as proof of suitability', () => {
  const query = '세럼의 끈적임이 불편해서 더 가벼운 제형을 비교하고 싶어요';
  const result = analyzeConcern(query, { fromProductSlug: 'serum-s1', reviews: [writtenReview()] });
  assert.equal(result.status, 'matched');
  assert.ok(topicIds(result).includes('stickiness'));
  assert.equal(recommended(result)[0], 'toner-t1');
  assert.ok(result.recommendations[0].primary);
  assert.match(recommendationText(result.recommendations[0]), /워터|수분 토너|가벼운/);
  assert.match(recommendationText(result.recommendations[0]), /단계|루틴|대체|다릅니다|다른/);
  assert.doesNotMatch(recommendationText(result.recommendations[0]), /(?:끈적임|자극)(?:이|은)?\s*없(?:습니다|어요)|무조건|더 안전|별점.*(?:효능|적합|순함)/);

  const highStars = products.map((product, index) => writtenReview({
    id: `written-high-${index}`, productSlug: product.slug, rating: 5,
    body: '이 제품을 사용하며 전반적으로 만족했던 경험을 남깁니다.',
  }));
  const withoutLowReviews = analyzeConcern(query, { fromProductSlug: 'serum-s1', reviews: highStars });
  assert.equal(recommended(withoutLowReviews)[0], 'toner-t1');
  assert.equal(withoutLowReviews.reviewBasis.usedCount, 0);
});

test('an explicitly named S.1 complaint can request alternatives without recommending that same product again', () => {
  const result = analyzeConcern('세럼 S.1이 끈적해서 다른 제품 찾고 싶어요');
  assert.equal(result.status, 'matched');
  assert.ok(topicIds(result).includes('stickiness'));
  assert.equal(recommended(result)[0], 'toner-t1');
  assert.ok(!recommended(result).includes('serum-s1'));
});

test('ordinary S.1 ingredient questions and another brand’s serum do not imply dissatisfaction with S.1', () => {
  const ingredient = analyzeConcern('세럼 S.1의 판테놀 역할과 성분을 알려줘');
  assert.equal(ingredient.status, 'matched');
  assert.ok(recommended(ingredient).includes('serum-s1'));
  for (const query of ['세럼이 끈적해요', '다른 브랜드 세럼이 끈적해서 대안을 찾고 싶어요']) {
    const generic = analyzeConcern(query);
    assert.equal(generic.status, 'matched');
    assert.ok(recommended(generic).includes('serum-s1'), query);
  }
});

test('rejecting a lightweight toner or asking for a heavier cream does not reverse the stated preference', () => {
  const rejectedLightweight = analyzeConcern('가벼운 토너는 원하지 않아요');
  assert.ok(['matched', 'unknown'].includes(rejectedLightweight.status));
  assert.notEqual(recommended(rejectedLightweight)[0], 'toner-t1');

  const heavyCream = analyzeConcern('무거운 크림을 원해요');
  assert.ok(['matched', 'unknown'].includes(heavyCream.status));
  assert.ok(heavyCream.recommendations.length === 0 || recommended(heavyCream)[0] === 'cream-c1');
});

test('diagnosis, treatment and acute reactions prioritize care without an alternative product recommendation', () => {
  for (const query of [
    '갑자기 얼굴이 붉어지고 붓고 따가워요',
    '아토피를 치료할 제품을 추천해줘',
    '알레르기인지 진단해줘',
  ]) {
    const result = analyzeConcern(query, { fromProductSlug: 'serum-s1', reviews: [writtenReview()] });
    assert.equal(result.status, 'care', query);
    assert.deepEqual(result.recommendations, [], query);
    assert.ok(result.precautions.length > 0, query);
  }
});

test('unpublished full-ingredient, absence and certification conditions never produce a fake qualifying product', () => {
  for (const query of [
    '무향이고 알코올 없는 제품으로 추천해줘',
    '판테놀 없는 제품을 찾고 있어요',
    '비건 인증을 받은 제품을 추천해줘',
    '히알루론산 없는 제품을 추천해줘',
    '세라마이드 NP 없는 제품을 추천해줘',
  ]) {
    const result = analyzeConcern(query);
    assert.equal(result.status, 'unsupported', query);
    assert.deepEqual(result.recommendations, [], query);
    assert.ok(result.precautions.length > 0 || result.findings.length > 0, query);
  }
});

test('unrelated or unintelligible text does not force a product or fabricate a research match', () => {
  for (const query of ['다음 주 제주도 항공권 예약해줘', 'zxqv 9837 @@@', '레미콘']) {
    const result = analyzeConcern(query);
    assert.equal(result.status, 'unknown', query);
    assert.deepEqual(result.recommendations, [], query);
    assert.deepEqual(result.research, [], query);
    assert.deepEqual(result.topics, [], query);
  }
});

test('negated stickiness and irritation are not turned into complaints or acute-reaction diagnoses', () => {
  for (const query of ['끈적이지 않아요', '안 끈적여요']) {
    const result = analyzeConcern(query);
    assert.ok(!topicIds(result).includes('stickiness'), query);
  }
  const mixed = analyzeConcern('안 끈적이는 건 좋은데 피부가 건조해요');
  assert.ok(topicIds(mixed).includes('dryness'));
  assert.ok(!topicIds(mixed).includes('stickiness'));

  const noIrritation = analyzeConcern('따갑지는 않고 끈적여요');
  assert.equal(noIrritation.status, 'matched');
  assert.ok(topicIds(noIrritation).includes('stickiness'));
});

test('an explicitly heavy feel can be compared with a lighter product instead of reversing the preference', () => {
  for (const query of ['크림이 너무 무거워요', '제형이 가볍지 않아요']) {
    const result = analyzeConcern(query, { fromProductSlug: 'cream-c1' });
    assert.equal(result.status, 'matched', query);
    assert.ok(topicIds(result).includes('lightweight'), query);
    assert.equal(recommended(result)[0], 'toner-t1', query);
  }
});

test('only valid written low-star complaints can contribute to the review basis', () => {
  const eligible = writtenReview();
  const storedEligible = writtenReview({ id: 'stored-written-low', source: undefined, rating: 2 });
  const rejected = [
    writtenReview({ id: 'written-high', rating: 5 }),
    writtenReview({ id: 'prepared-low', source: 'example' }),
    writtenReview({ id: 'mock-user-labelled', source: 'user' }),
    writtenReview({ id: 'example-user-labelled', source: undefined }),
    writtenReview({ id: 'unknown-product-low', productSlug: 'unpublished-product' }),
    writtenReview({ id: 'malformed-rating-low', rating: '1' }),
    writtenReview({ id: 'malformed-date-low', createdAt: 'invalid' }),
    writtenReview({ id: 'too-short-low', body: '짧아요' }),
    ...MOCK_PRODUCT_REVIEWS,
  ];
  const result = analyzeConcern('세럼의 끈적임이 불편해요', {
    fromProductSlug: 'serum-s1', reviews: [eligible, storedEligible, ...rejected],
  });
  assert.equal(result.reviewBasis.usedCount, 2);
  assert.equal(result.reviewBasis.writtenCount, 3, 'only the two eligible low reviews and one valid high review are written records');
  const excludedOnly = analyzeConcern('세럼의 끈적임이 불편해요', { fromProductSlug: 'serum-s1', reviews: rejected });
  assert.equal(excludedOnly.reviewBasis.usedCount, 0);
  assert.equal(excludedOnly.reviewBasis.writtenCount, 1);
});

test('a low rating alone or a negated complaint is not evidence of the queried discomfort', () => {
  const result = analyzeConcern('세럼의 끈적임이 불편해요', {
    fromProductSlug: 'serum-s1',
    reviews: [
      writtenReview({ id: 'negative-not-sticky', body: '용기는 불편하지만 제형은 끈적이지 않아서 사용하기 좋았어요.' }),
      writtenReview({ id: 'low-packaging-only', body: '배송 상자가 구겨져서 받았고 포장에 아쉬움이 있었습니다.' }),
    ],
  });
  assert.equal(result.reviewBasis.usedCount, 0);
});

test('review insights remain with their own product and unrelated products cannot affect the comparison', () => {
  const source = writtenReview();
  const alternative = writtenReview({ id: 'written-toner-low', productSlug: 'toner-t1' });
  const unrelated = writtenReview({ id: 'written-cream-low', productSlug: 'cream-c1' });
  const result = analyzeConcern('세럼의 끈적임이 불편해요', {
    fromProductSlug: 'serum-s1', reviews: [source, alternative, unrelated],
  });
  assert.equal(result.reviewBasis.writtenCount, 3);
  assert.equal(result.reviewBasis.usedCount, 2);
  for (const recommendation of result.recommendations) {
    assert.ok(recommendation.reviewInsights.every(review => review.productSlug === recommendation.product.slug));
    assert.ok(!recommendation.reviewInsights.some(review => review.id === unrelated.id || review.id === source.id));
  }
  assert.deepEqual(result.recommendations[0].reviewInsights.map(review => review.id), [alternative.id]);
});

test('recommendations, papers and finding citations stay inside the published catalog and selected topics', () => {
  for (const query of ['피부가 건조해요', '피부 장벽 성분이 궁금해요', '가벼운 워터 제형을 찾고 있어요']) {
    const result = analyzeConcern(query);
    const relevantIngredients = new Set(result.topics.flatMap(topic => getConcernTopic(topic.id).ingredientIds));
    const paperIds = new Set(result.research.map(paper => paper.id));
    assert.equal(paperIds.size, result.research.length);
    for (const paper of result.research) {
      const original = researchPapers.find(source => source.id === paper.id);
      assert.ok(original, `unknown paper ${paper.id}`);
      assert.equal(paper.url, original.url);
      assert.equal(paper.originalTitle, original.originalTitle);
      assert.ok(paper.ingredientIds.some(id => relevantIngredients.has(id)), `${paper.id} is unrelated to the selected topics`);
    }
    for (const finding of result.findings) {
      assert.ok(typeof finding.kind === 'string' && finding.kind);
      assert.ok(typeof finding.title === 'string' && finding.title);
      assert.ok(typeof finding.text === 'string' && finding.text);
      assert.ok(Array.isArray(finding.paperIds));
      assert.ok(finding.paperIds.every(id => paperIds.has(id)), 'findings may cite only returned, registered papers');
    }
    for (const recommendation of result.recommendations) assert.ok(products.includes(recommendation.product));
  }
});

test('contrary comparator findings stay attached when glycerin or ceramide research is shown', () => {
  const glycerin = analyzeConcern('글리세린의 보습 연구가 궁금해요');
  const ceramide = analyzeConcern('세라마이드 NP와 피부 장벽 연구가 궁금해요');
  assert.ok(glycerin.research.some(paper => paper.id === 'loden-glycerin-2001'));
  assert.ok(ceramide.research.some(paper => paper.id === 'ceramide-np-rct-2026'));
  assert.ok(glycerin.findings.some(finding => finding.kind === 'limits' && finding.paperIds.includes('loden-glycerin-2001')));
  assert.ok(ceramide.findings.some(finding => finding.kind === 'limits' && finding.paperIds.includes('ceramide-np-rct-2026')));
});

test('free-text personal details never become outgoing news or external search queries', () => {
  const privateTokens = ['홍길동', 'hong-private@example.com', '010-9876-5432', '서울시비밀주소123'];
  const query = `피부가 건조해요. 제 이름은 ${privateTokens[0]}, 이메일 ${privateTokens[1]}, 전화 ${privateTokens[2]}, 주소 ${privateTokens[3]}예요.`;
  const result = analyzeConcern(query);
  assert.equal(result.status, 'matched');
  const generic = analyzeConcern('피부가 건조해요');
  assert.equal(result.newsTopic, generic.newsTopic);
  assert.deepEqual(result.externalLinks, generic.externalLinks, 'private details must not change the fixed external queries');
  const external = decodeURIComponent(JSON.stringify({ newsTopic: result.newsTopic, externalLinks: result.externalLinks }));
  for (const token of privateTokens) assert.ok(!external.includes(token), `external search leaked ${token}`);
  assert.ok(!external.includes(query));
  const selectedNews = typeof result.newsTopic === 'string' ? getConcernTopic(result.newsTopic) : getConcernTopic(result.newsTopic?.id);
  assert.ok(selectedNews, 'news must select a predeclared topic');
  const fixedQueries = new Set(CONCERN_TOPICS.map(topic => topic.newsQuery));
  if (result.newsTopic?.newsQuery) assert.ok(fixedQueries.has(result.newsTopic.newsQuery));
  for (const link of result.externalLinks) {
    const url = new URL(link.url);
    assert.equal(url.protocol, 'https:');
    assert.ok(['pubmed.ncbi.nlm.nih.gov', 'scholar.google.com'].includes(url.hostname));
    assert.equal(url.username + url.password + url.port, '');
    assert.ok(url.searchParams.get('term') || url.searchParams.get('q'));
  }
});

test('fixed concern topics are unique and unknown topic identifiers cannot add external queries', () => {
  assert.equal(new Set(CONCERN_TOPICS.map(topic => topic.id)).size, CONCERN_TOPICS.length);
  for (const topic of CONCERN_TOPICS) {
    assert.equal(getConcernTopic(topic.id), topic);
    assert.ok(topic.label && topic.newsQuery && Array.isArray(topic.ingredientIds));
  }
  for (const value of ['custom-private-query', '', null, {}]) assert.equal(getConcernTopic(value), null);
});

test('analysis is deterministic and does not mutate the query options, reviews, product catalog or paper records', () => {
  const options = freezeDeep({ fromProductSlug: 'serum-s1', reviews: [writtenReview()] });
  const before = JSON.stringify({ options, products, researchPapers, CONCERN_TOPICS });
  const first = analyzeConcern('세럼의 끈적임이 불편해요', options);
  const second = analyzeConcern('세럼의 끈적임이 불편해요', options);
  assert.deepEqual(second, first);
  assert.equal(JSON.stringify({ options, products, researchPapers, CONCERN_TOPICS }), before);
});
