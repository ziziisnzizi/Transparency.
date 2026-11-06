import assert from 'node:assert/strict';
import { test } from 'node:test';
import { products, purchasePricing } from '../products.js';
import { getProductResearch, getInformationCoverage } from '../evidence-data.js';
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
  assert.match(serumAnswer.answer, /판테놀 0\.5%/);
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
  assert.doesNotMatch(result.answer, /제품 상세의 나이아신아마이드|나이아신아마이드.*카드/);
});

test('server research sources contain each product’s registered papers and their actual limits without external URLs', () => {
  for (const product of products) {
    const sources = buildProductSources(product);
    const papers = getProductResearch(product.slug);
    const research = sources.filter(item => item.id.startsWith(`${product.slug}:research-`) && !item.id.endsWith(':research-information-coverage'));
    assert.deepEqual(research.map(item => item.id), papers.map(paper => `${product.slug}:research-${paper.id}`));
    for (const paper of papers) {
      const source = research.find(item => item.id.endsWith(`:research-${paper.id}`));
      assert.equal(source.title, paper.koreanTitle);
      assert.equal(source.section, '효능·근거');
      for (const fact of [paper.studyType, paper.designDetails, paper.summary, paper.applicationNote, ...paper.results, ...paper.limitations]) assert.ok(source.excerpt.includes(fact));
      assert.ok(source.excerpt.includes(`${product.name}의 완제품 시험 결과가 아닙니다`));
    }
    assert.ok(sources.every(item => !/https?:\/\//.test(item.excerpt)));
  }
  const tonerSources = buildProductSources(findQuestionProduct('toner-t1'));
  assert.ok(tonerSources.some(item => /pavicic|liposomal-hyaluronic/.test(item.id)));
  assert.ok(!tonerSources.some(item => /squalane|ceramide-np/.test(item.id)));
  const creamSources = buildProductSources(findQuestionProduct('cream-c1'));
  assert.ok(creamSources.some(item => /dexpanthenol/.test(item.id)));
  assert.ok(!creamSources.some(item => /pavicic|beta-glucan/.test(item.id)));
});

test('paper questions return relevant ingredient research with bounded product-specific citations', () => {
  const cases = [
    ['toner-t1', '판테놀 논문과 근거를 알려주세요.', 'biro-dexpanthenol-2003', /25명|5% 덱스판테놀/],
    ['toner-t1', '베타글루칸 연구를 알려주세요.', 'feng-2025-beta-glucan-review', /문헌고찰|종설/],
    ['serum-s1', '글리세린 효과에 관한 논문이 있나요?', 'loden-glycerin-2001', /차이가 관찰되지|차이를 보여/],
    ['cream-c1', '세라마이드 근거가 궁금해요.', 'ceramide-np-rct-2026', /군간 차이는 통계적으로 유의하지/],
  ];
  for (const [slug, question, id, expected] of cases) {
    const result = getReferenceAnswer(findQuestionProduct(slug), question);
    assert.equal(result.matched, true);
    assert.match(result.answer, expected);
    assert.ok(result.sources.some(item => item.id === `${slug}:research-${id}`));
    assert.ok(result.sources.every(item => item.id.startsWith(`${slug}:`)));
    assert.ok(result.sources.length <= 6);
    assert.ok(result.sources.filter(item => item.id.startsWith(`${slug}:research-`)).length <= 3);
    assert.match(result.answer, /공개된 완제품 시험 결과는 없습니다/);
  }
  const absent = getReferenceAnswer(findQuestionProduct('cream-c1'), '카보머 논문과 근거를 알려주세요.');
  assert.match(absent.answer, /연결할 수 있는 등록 연구 자료는 없습니다/);
  assert.ok(!absent.sources.some(item => item.id.includes(':research-')));
});

test('general research answers cover the selected product’s ingredient groups without claiming a finished-product trial', () => {
  for (const product of products) {
    const result = getReferenceAnswer(product, '공개한 연구와 효능 근거를 알려주세요.');
    const papers = getProductResearch(product.slug);
    const cited = papers.filter(paper => result.sources.some(source => source.id.endsWith(`:research-${paper.id}`)));
    assert.equal(cited.length, 3);
    assert.ok(new Set(cited.flatMap(paper => paper.ingredientIds)).size >= 3);
    assert.match(result.answer, /공개된 완제품 시험 결과는 없습니다/);
    assert.ok(result.sources.every(source => source.id.startsWith(`${product.slug}:`)));
  }
});

test('squalane cell results preserve non-significance and cannot become human collagen or sunscreen claims', () => {
  const cream = findQuestionProduct('cream-c1');
  const result = getReferenceAnswer(cream, '스쿠알란 세포 연구는 콜라겐 합성과 자외선 차단을 증명하나요?');
  assert.match(result.answer, /체외시험/);
  assert.match(result.answer, /배양 섬유아세포/);
  assert.match(result.answer, /콜라겐 합성 증가는 통계적으로 유의하지/);
  assert.match(result.answer, /자외선 차단을 평가한 시험은 아닙니다/);
  const source = result.sources.find(item => item.id.endsWith(':research-squalane-fibroblast-2025'));
  assert.ok(source);
  assert.match(source.excerpt, /p>0\.05/);
  assert.match(source.excerpt, /0\.005–0\.015%/);
  assert.match(source.excerpt, /피부 도포용 스쿠알란3%/);
  assert.match(source.excerpt, /사람에게 제품을 도포한 임상시험이 아닙니다/);
});

test('research information coverage measures six metadata checks rather than efficacy probability', () => {
  for (const product of products) {
    const expected = getInformationCoverage(getProductResearch(product.slug));
    for (const question of ['연구 정보 확인율은 무엇인가요?', '논문 신뢰도 100%면 효과가 보장되나요?', '효능 보장률이 몇 퍼센트인가요?']) {
      const result = getReferenceAnswer(product, question);
      assert.match(result.answer, /6개 항목/);
      assert.ok(result.answer.includes(`${expected.confirmed}개`));
      assert.ok(result.answer.includes(`${expected.percent}%`));
      assert.match(result.answer, /임상적 신뢰도, 효과가 나타날 확률, 효능·안전성 보장률이 아닙니다/);
      assert.match(result.answer, /100%여도 인체 효과나 완제품 효능이 입증되었다는 뜻이 아닙니다/);
      assert.match(result.answer, /체외시험.*인체시험이 되지 않으며/);
      assert.ok(result.sources.some(item => item.id.endsWith(':research-information-coverage')));
    }
  }
});

test('ingredient coverage answers match ingredient UI totals rather than the whole-product percentage', () => {
  const cases = [
    ['cream-c1', 'squalane', '스쿠알란'],
    ['cream-c1', 'ceramide-np', '세라마이드 NP'],
    ['toner-t1', 'beta-glucan', '베타글루칸'],
    ['serum-s1', 'hyaluronic-acid', '히알루론산'],
  ];
  for (const [slug, ingredientId, name] of cases) {
    const product = findQuestionProduct(slug);
    const expected = getInformationCoverage(getProductResearch(slug).filter(paper => paper.ingredientIds.includes(ingredientId)));
    const result = getReferenceAnswer(product, `${name}의 연구 정보 확인율은 몇 퍼센트인가요?`);
    assert.match(result.answer, new RegExp(`연구 정보 확인율은 ${expected.percent}%`));
    assert.ok(result.answer.includes(`${expected.confirmed}/${expected.total}`));
    assert.doesNotMatch(result.answer, /제품 전체 확인율/);
    assert.match(result.answer, /효과가 나타날 확률, 효능·안전성 보장률이 아닙니다/);
    const methodology = buildProductSources(product).find(item => item.id.endsWith(':research-information-coverage'));
    assert.ok(methodology.excerpt.includes(`${expected.confirmed}/${expected.total}`));
    assert.match(methodology.excerpt, /성분별 집계/);
    assert.match(methodology.excerpt, /제품 전체 확인율/);
  }
  const absent = getReferenceAnswer(findQuestionProduct('cream-c1'), '히알루론산 연구 정보 확인율이 얼마인가요?');
  assert.match(absent.answer, /등록 연구가 없어 해당 성분의 확인율을 계산하지 않습니다/);
  assert.doesNotMatch(absent.answer, /제품 전체 확인율/);
});

test('ordinary concentration questions remain ingredient answers and combined review statistics match the UI', () => {
  for (const [slug, amount] of [['toner-t1', '0.5%'], ['serum-s1', '0.5%']]) {
    const result = getReferenceAnswer(findQuestionProduct(slug), '판테놀은 몇 퍼센트인가요?');
    assert.ok(result.answer.includes(`판테놀 ${amount}`));
    assert.ok(result.sources.every(item => item.id.includes(':ingredient-')));
    assert.doesNotMatch(result.answer, /확인율|6개 항목/);
  }
  const reviews = getReferenceAnswer(serum, '리뷰 수와 평균 별점은 어떻게 계산하나요?');
  assert.match(reviews.answer, /전체 리뷰 수와 평균 별점은 준비된 리뷰와 직접 작성한 리뷰를 함께 반영/);
  assert.doesNotMatch(reviews.answer, /직접 작성한 리뷰 기준 평균/);
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

test('provided use instructions keep drop count, shaking and scooping distinct from daily frequency', () => {
  for (const product of products) {
    const routine = getReferenceAnswer(product, '사용 순서와 사용량을 알려주세요.');
    assert.match(routine.answer, /토너 T\.1.*세럼 S\.1.*크림 C\.1/);
    assert.ok(product.directions.every(direction => routine.answer.includes(direction)));
    assert.ok(routine.sources.some(source => source.id === `${product.slug}:routine`));
    assert.match(routine.answer, /하루 사용 횟수.*기재되지 않았습니다/);
    assert.doesNotMatch(routine.answer, /정해진 방울 수.*없습니다/);
    const shelfLife = getReferenceAnswer(product, '개봉 후 언제까지 사용하나요?');
    assert.match(shelfLife.answer, /개봉 후 사용기간이 12개월/);
    assert.match(shelfLife.answer, /용기와 포장에 표시된 날짜/);
    assert.ok(shelfLife.sources.some(source => source.id === `${product.slug}:shelf-life`));
  }
  const serumRoutine = getReferenceAnswer(serum, '세럼은 몇 방울 써요?');
  assert.match(serumRoutine.answer, /2~3방울/);
  assert.doesNotMatch(serumRoutine.answer, /0\.5\s*mL/);
  const tonerRoutine = getReferenceAnswer(findQuestionProduct('toner-t1'), '토너를 몇 번 흔들어야 하나요?');
  assert.match(tonerRoutine.answer, /1~2번 흔듭니다/);
  assert.match(tonerRoutine.answer, /흔드는 횟수이며, 덜어내는 횟수나 양이 아닙니다/);
  assert.ok(tonerRoutine.sources.some(source => source.id === 'toner-t1:routine'));
  const creamRoutine = getReferenceAnswer(findQuestionProduct('cream-c1'), '크림 사용법을 알려주세요.');
  assert.match(creamRoutine.answer, /손가락으로 한 번 덜어냅니다/);
  assert.doesNotMatch(creamRoutine.answer, /하루에 한 번/);
});

test('batch details are attributed to the supplied record, not every purchased product', () => {
  for (const product of products) {
    const result = getReferenceAnswer(product, '제조번호가 뭔가요?');
    assert.ok(result.answer.includes(`LOT ${product.referenceBatch.lot}`));
    assert.match(result.answer, /2027\.12\.17/);
    assert.match(result.answer, /특정 제조분/);
    assert.match(result.answer, /용기 표기를 우선 확인/);
    assert.ok(result.sources.some(source => source.id === `${product.slug}:shelf-life`));
  }
});

test('full ingredient questions cite the supplied ordered list and concentrations', () => {
  for (const product of products) {
    const answer = getReferenceAnswer(product, '전성분을 알려주세요.');
    assert.ok(product.fullIngredients.every(name => answer.answer.includes(name)));
    assert.deepEqual(answer.sources.map(source => source.id), [`${product.slug}:full-ingredients`]);
    assert.match(answer.answer, /개인별 적합성이나 완제품의 효과를 확정할 수 없습니다/);
    product.fullIngredients.forEach((name, i) => assert.ok(answer.answer.includes(`${name} ${product.fullIngredientConcentrations[i]}`)));
  }
  const cream = findQuestionProduct('cream-c1');
  const match = getReferenceAnswer(cream, '세테아릴알코올이 들어 있나요?');
  assert.match(match.answer, /전성분 목록에 세테아릴알코올.*기재되어 있습니다/);
  assert.deepEqual(match.sources.map(source => source.id), ['cream-c1:full-ingredients']);
  assert.match(match.answer, /세테아릴알코올 2\.5%/);
  assert.match(match.answer, /개인별 적합성이나 완제품 효능을 확정할 수 없습니다/);
});

test('stability-test statements do not become published reports or clinical efficacy claims', () => {
  for (const product of products) {
    const answer = getReferenceAnswer(product, '제품 안정성 시험은 무엇인가요?');
    assert.ok(product.stabilityTests.every(name => answer.answer.includes(name)));
    assert.match(answer.answer, /시험.*완료로 기재/);
    assert.match(answer.answer, /기관·조건·결과 및 보고서는 제공되지 않았습니다/);
    assert.match(answer.answer, /피부 안전성이나 완제품 효능을 입증하는 임상시험 결과가 아닙니다/);
    assert.deepEqual(answer.sources.map(source => source.id), [`${product.slug}:stability`]);
    const prompt = createGroundingPrompt(product);
    assert.match(prompt.system, /흔드는 횟수나 한 번 덜어내는 동작을 하루 사용 횟수로 바꾸지/);
    assert.match(prompt.system, /제품 안정성·용기 적합성.*피부 안전성·효능 임상/);
    assert.ok(prompt.sources.some(source => source.id === `${product.slug}:stability`));
    assert.ok(prompt.sources.some(source => source.id === `${product.slug}:full-ingredients`));
    assert.doesNotMatch(JSON.stringify(prompt), /080-532-4132|서울 용산구 한강대로 100/);
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
