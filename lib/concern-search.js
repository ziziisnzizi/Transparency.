import { products } from '../products.js';
import { researchPapers } from '../evidence-data.js';
import { normalizeReviews } from '../reviews.js';
import { getConcernTopic } from './concern-topics.js';

export const CONCERN_QUERY_LIMIT = 300;
const PRODUCT_SLUGS = new Set(products.map(product => product.slug));
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const PRODUCT_SCOPE = '성분·연구용 제형의 자료이며, 현재 제품의 공개된 완제품 효능 시험 결과는 없습니다. 성분의 함량이나 연구 결과만으로 개인의 효과와 적합성을 보장할 수 없습니다.';
const INGREDIENTS = [
  { id: 'glycerin', pattern: /글리세린|글리세롤|glycerin|glycerol/ },
  { id: 'panthenol', pattern: /판테놀|덱스판테놀|panthenol|dexpanthenol/ },
  { id: 'hyaluronic-acid', pattern: /히알루론(?:산)?|하이알루론(?:산)?|소듐하이알루로네이트|hyaluron(?:icacid)?/ },
  { id: 'beta-glucan', pattern: /베타글루칸|betaglucan|βglucan/ },
  { id: 'ceramide-np', pattern: /세라마이드(?:np)?|ceramide(?:np)?/ },
  { id: 'squalane', pattern: /스쿠알란|squalane/ },
];
const TOPIC_PAPERS = {
  dryness: ['glycerin-healthy-2001', 'loden-glycerin-2001', 'pavicic-hyaluronic-acid-2011', 'biro-dexpanthenol-2003', 'kim-2007-oligo-hyaluronic-acid', 'cho-2022-dexpanthenol-review'],
  barrier: ['ceramide-np-rct-2026', 'ceramide-np-korean-2022', 'glycerin-healthy-2001', 'loden-glycerin-2001', 'gehring-dexpanthenol-2000', 'cho-2022-dexpanthenol-review'],
  lightweight: ['glycerin-healthy-2001', 'loden-glycerin-2001', 'feng-2025-beta-glucan-review'],
  stickiness: ['glycerin-healthy-2001', 'loden-glycerin-2001', 'cho-2022-dexpanthenol-review'],
  routine: [],
  sensitivity: ['cho-2022-dexpanthenol-review', 'biro-dexpanthenol-2003'],
  aging: ['pavicic-hyaluronic-acid-2011', 'squalane-fibroblast-2025'],
};
const EXTERNAL_TERMS = {
  dryness: 'skin hydration glycerol panthenol hyaluronic acid',
  barrier: 'skin barrier ceramide NP moisturizer',
  lightweight: 'skin moisturizer formulation sensory properties',
  stickiness: 'moisturizer formulation sensory properties',
  routine: 'skin care moisturizer application',
  sensitivity: 'sensitive skin cosmetics safety',
  aging: 'skin aging hyaluronic acid topical trial',
};

export function normalizeConcernQuery(value) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim()
    : '';
}

export function validateConcernQuery(value) {
  const query = normalizeConcernQuery(value);
  if (typeof value !== 'string' || !query) return { query, error: '궁금한 피부 고민이나 사용감을 입력해 주세요.' };
  if (CONTROL_CHARACTERS.test(value) || query.length > CONCERN_QUERY_LIMIT) return { query, error: `고민은 1~${CONCERN_QUERY_LIMIT}자로 입력해 주세요.` };
  return { query, error: '' };
}

const compact = value => normalizeConcernQuery(value).toLocaleLowerCase('ko-KR').replace(/\s+/g, '');

// Interpret short, local Korean negations without letting a later clause negate
// a separate complaint: "따갑지는 않고 끈적여요" still has a texture concern.
function isNegated(text, index, length) {
  const before = text.slice(Math.max(0, index - 5), index);
  const after = text.slice(index + length, index + length + 16);
  return /(?:전혀|별로)?안$/.test(before)
    || /^(?:(?:이|하|거|움|음|임|함|은|는|가|진|지|도|어짐|어지|아지|것|건|운|전혀)){0,6}(?:않|없|안|아니)/.test(after);
}

function affirmed(text, pattern) {
  const matches = text.matchAll(new RegExp(pattern.source, 'g'));
  for (const match of matches) if (!isNegated(text, match.index, match[0].length)) return true;
  return false;
}

function texturePreference(text) {
  const descriptor = '(?:(?:토너|크림|세럼|제형|제품|사용감|느낌|것|걸|게|조금|좀|더|이|가|을|를|은|는|도|정말|약간)){0,8}';
  const light = '(?:가벼운|가벼움|산뜻한|묽은|워터)';
  const rich = '(?:무거운|묵직한|리치한|꾸덕한|진한)';
  const preference = '(좋|선호|원하|원해|찾|쓰고싶)';
  const hasPreference = (adjective, negated) => {
    const expression = new RegExp(`${adjective}${descriptor}${preference}`, 'g');
    for (const match of text.matchAll(expression)) {
      const verb = match[1];
      if (isNegated(text, match.index + match[0].length - verb.length, verb.length) === negated) return true;
    }
    return false;
  };
  if (hasPreference(rich, false)) return 'rich';
  if (hasPreference(light, true) || new RegExp(`${light}${descriptor}(?:싫|원치않|필요없)`).test(text)) return 'avoid-light';
  return null;
}

function inferSourceProduct(text) {
  // A generic serum or somebody else's brand is not evidence that the person
  // already uses S.1. Ordinary ingredient questions must keep all candidates.
  if (/타사|타브랜드|다른브랜드|다른회사|다른곳제품/.test(text)) return null;
  const explicit = [
    { slug: 'toner-t1', pattern: /(?:^|[^a-z0-9])t\.?1(?=$|[^a-z0-9])/ },
    { slug: 'serum-s1', pattern: /(?:^|[^a-z0-9])s\.?1(?=$|[^a-z0-9])/ },
    { slug: 'cream-c1', pattern: /(?:^|[^a-z0-9])c\.?1(?=$|[^a-z0-9])/ },
  ].filter(item => item.pattern.test(text));
  if (explicit.length !== 1) return null;
  const complaint = affirmed(text, /끈적|찐득|끈끈|무겁|무거|답답|불편|건조|당기|당겨|아쉽|별로/);
  const change = /바꾸|바꿔|교체|대안|대체|대신|말고|다른제품(?:을|으로|이|중)?(?:찾|원|추천)|다른제형(?:을|으로)?(?:찾|원)/.test(text);
  return complaint || change ? explicit[0].slug : null;
}

function isMedicalConcern(text) {
  return affirmed(text, /아토피|습진|건선|피부염|주사염|주사피부염|여드름|알레르기|알러지|감염|두드러기|진균|피부병/)
    || affirmed(text, /따갑|따가|가렵|가려|발진|화끈|부어|붓|붉어|빨개|염증|진물|물집|화상|통증|아프/)
    || /치료|진단|처방|스테로이드|항생제|의약품|부작용|임신|임산|수유|영아|유아|어린이|아기/.test(text)
    || /자극(?:이|은|을)?(?:생|있|받|심|나타)/.test(text);
}

function needsUnverifiedExclusion(text) {
  const names = INGREDIENTS.map(item => item.pattern.source).join('|') + '|향료|향|알코올|에탄올|방부제|보존제|오일|실리콘|색소|성분';
  const modifier = '(?:(?:이|가|은|는|을|를|도|성분|첨가|함유|포함|전혀|들어있|들어가|들어가지|들어있지|하지|하지는)){0,5}';
  const absence = '(?:없|무첨가|미첨가|미포함|불포함|무함유|비함유|빼고|제외|안들어|않|프리|free)';
  const withoutTexturePreference = text.replace(/(?:끈적임|끈적거림|찐득함|끈끈함|무거움|부담감|답답함)(?:이|은|가)?(?:없는|없이)/g, '');
  return new RegExp(`(?:${names})${modifier}${absence}`).test(text)
    || /없는(?:제품|크림|세럼|토너|걸|것|거|보습|피부|성분)|(?:빼고|제외)(?:추천|제품|크림|세럼|토너)/.test(withoutTexturePreference)
    || /무첨가|미첨가|미포함|불포함|무함유|비함유|비건|논코메도|noncomedogenic|알코올프리|무향|무자극|저자극인증|알레르기프리/.test(text);
}

function inferTopics(text) {
  const ids = [];
  const add = id => { if (!ids.includes(id)) ids.push(id); };
  const desire = /제품|제형|찾|추천|바꾸|바꿔|원해|원하|선호|사용감|쓰고싶/.test(text);
  const sticky = affirmed(text, /끈적|찐득|끈끈|달라붙|밀리|밀려|밀림/);
  if (sticky || (desire && /끈적|찐득|끈끈/.test(text))) add('stickiness');
  if (affirmed(text, /가벼|가볍|산뜻|워터|묽은|무겁|무거|답답|번들|기름져|유분감/)
    || /가볍(?:지|지는|진)않/.test(text)) add('lightweight');
  if (affirmed(text, /장벽|세라마이드|ceramide|스쿠알란|squalane|보습마무리|수분잠금/)) add('barrier');
  if (affirmed(text, /건조|당기|당겨|당김|속당김|푸석|수분|보습|각질|글리세린|글리세롤|판테놀|히알루론|하이알루론|베타글루칸|glycerin|glycerol|panthenol|hyaluron|betaglucan/)) add('dryness');
  if (/순서|루틴|사용량|사용법|몇방울|얼마나발|얼마나쓰|바르는양|한번에|먼저발|먼저쓰|단계|토너만|세럼만|크림만|단독|같이써|함께써|다써야|다발라/.test(text)) add('routine');
  if (/민감|예민|순한|순하게|저자극|자극/.test(text)) add('sensitivity');
  if (/주름|탄력|안티에이징|노화|콜라겐|피부나이/.test(text)) add('aging');
  return ids;
}

function writtenReviews(value) {
  if (!Array.isArray(value)) return [];
  const eligible = value.filter(review => review && typeof review === 'object'
    && (review.source === undefined || review.source === 'user')
    && typeof review.id === 'string' && !/^(?:mock|example)-/i.test(review.id));
  return normalizeReviews(eligible).filter(review => PRODUCT_SLUGS.has(review.productSlug));
}

function reviewFriction(review, topicIds) {
  if (review.rating > 2) return false;
  const text = compact(review.body);
  if (isMedicalConcern(text)) return false;
  return (topicIds.includes('stickiness') && affirmed(text, /끈적|찐득|끈끈|달라붙|밀리|밀려|밀림/))
    || (topicIds.includes('lightweight') && (affirmed(text, /무겁|무거|답답|번들|기름져|유분감/) || /가볍(?:지|지는|진)않/.test(text)))
    || (topicIds.includes('dryness') && affirmed(text, /건조|당기|당겨|당김|속당김|푸석|각질/));
}

function selectResearch(topicIds, ingredientIds) {
  const ids = [];
  const add = id => { if (!ids.includes(id) && researchPapers.some(paper => paper.id === id)) ids.push(id); };
  if (ingredientIds.length) researchPapers.filter(paper => paper.ingredientIds.some(id => ingredientIds.includes(id))).forEach(paper => add(paper.id));
  else topicIds.forEach(id => (TOPIC_PAPERS[id] || []).forEach(add));
  // Never remove the non-superiority/negative comparator result while showing
  // only the favorable study for the same ingredient.
  if (ids.some(id => researchPapers.find(paper => paper.id === id)?.ingredientIds.includes('glycerin'))) add('loden-glycerin-2001');
  if (ids.includes('ceramide-np-korean-2022')) add('ceramide-np-rct-2026');
  return ids.slice(0, 8).map(id => researchPapers.find(paper => paper.id === id));
}

function externalLinks(topicId) {
  if (!getConcernTopic(topicId)) return [];
  const term = EXTERNAL_TERMS[topicId];
  return [
    { label: 'PubMed에서 관련 연구 더 찾기', url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(term)}` },
    { label: 'Google Scholar에서 관련 연구 더 찾기', url: `https://scholar.google.com/scholar?q=${encodeURIComponent(term)}` },
  ];
}

function findingsFor(topicIds, papers) {
  const findings = [];
  const byId = id => papers.find(paper => paper.id === id);
  const addPaper = (id, kind, title) => {
    const paper = byId(id);
    if (paper) findings.push({ kind, title, text: paper.summary, paperIds: [id] });
  };
  addPaper('glycerin-healthy-2001', 'observed', '수분 증가와 장벽 지표를 구분해 봅니다.');
  addPaper('loden-glycerin-2001', 'limits', '다른 제형·대상에서는 차이가 확인되지 않았습니다.');
  addPaper('ceramide-np-korean-2022', 'observed', '특정 세라마이드 NP 원료의 연구입니다.');
  addPaper('ceramide-np-rct-2026', 'limits', '세라마이드 NP 복합 제형의 군간 유의차는 없었습니다.');
  if (!findings.length && papers.length) findings.push({ kind: 'context', title: '질문과 연결된 성분·제형 연구입니다.', text: papers[0].summary, paperIds: [papers[0].id] });
  if (topicIds.some(id => ['lightweight', 'stickiness'].includes(id))) findings.push({
    kind: 'context', title: '사용감은 제형 안내와 직접 경험을 함께 확인합니다.',
    text: '워터·젤·크림이라는 공개 제형을 비교합니다. 아래 성분 연구는 제품 사이의 가벼움이나 끈적임을 비교한 시험이 아니므로, 더 산뜻하거나 끈적이지 않다고 보장하지 않습니다.', paperIds: [],
  });
  if (topicIds.includes('routine')) findings.push({
    kind: 'context', title: '공개된 사용 순서와 1회량입니다.',
    text: `세안 → 토너 T.1 → 세럼 S.1 → 크림 C.1. ${['toner-t1', 'serum-s1', 'cream-c1'].map(slug => {
      const product = products.find(item => item.slug === slug);
      return `${product.name}: ${product.amount}`;
    }).join(' · ')}. 피부 상태와 사용감에 따라 양을 조절하며, 모든 단계를 반드시 사용해야 한다는 뜻은 아닙니다.`, paperIds: [],
  });
  if (topicIds.includes('sensitivity')) findings.push({
    kind: 'limits', title: '민감성 피부 적합성을 확인할 자료는 공개되지 않았습니다.',
    text: '특정 성분의 연구나 워터·젤 제형이라는 설명만으로 더 순하거나 민감성 피부에 적합하다고 판단할 수 없습니다. 현재 제품의 민감성 피부 대상 시험은 확인되지 않았으며, 제공된 전성분과 개인의 피부 상태를 함께 확인해야 합니다.', paperIds: [],
  });
  if (papers.length) findings.push({ kind: 'limits', title: '성분 연구와 완제품 효과는 다릅니다.', text: PRODUCT_SCOPE, paperIds: papers.map(paper => paper.id) });
  return findings;
}

function productCandidates(topicIds, fromProductSlug, preference) {
  let slugs = [];
  if (preference === 'rich') slugs = ['cream-c1'];
  else if (preference === 'avoid-light') slugs = topicIds.some(id => ['barrier', 'dryness'].includes(id)) ? ['cream-c1'] : [];
  else if (topicIds.some(id => ['stickiness', 'lightweight'].includes(id))) slugs = ['toner-t1', 'serum-s1'];
  else if (topicIds.includes('barrier')) slugs = ['cream-c1'];
  else if (topicIds.includes('dryness')) slugs = ['serum-s1', 'cream-c1'];
  // A review-origin search offers another step to compare, rather than
  // recommending the very product whose experience prompted the search.
  return slugs.filter(slug => slug !== fromProductSlug).slice(0, 2);
}

function makeRecommendation(slug, topicIds, fromProductSlug, frictionReviews, primary) {
  const product = products.find(item => item.slug === slug);
  const reasons = [];
  const limitations = ['공개된 성분 역할과 제형을 기준으로 비교하며, 개인의 효과나 적합성을 예측한 순위가 아닙니다.', PRODUCT_SCOPE];
  if (topicIds.some(id => ['stickiness', 'lightweight'].includes(id))) {
    reasons.push(`${product.name}의 공개 제형은 ${product.texture}입니다. 현재 느낀 사용감과 비교할 수 있는 다른 제형으로 제시합니다.`);
    limitations.push('제품 간 끈적임·흡수 속도·가벼움을 비교한 시험은 공개되지 않았습니다. 제형만으로 끈적임이 줄어든다고 단정할 수 없습니다.');
  } else if (slug === 'cream-c1') {
    reasons.push(`글리세린5.0%, 스쿠알란3.0%, 세라마이드 NP0.1%를 공개한 ${product.type}이며, 루틴의 보습 마무리 단계입니다.`);
    limitations.push('세라마이드 NP의 특수 원료·다른 농도 연구는 이 제품의 장벽 개선 결과와 같지 않습니다.');
  } else if (slug === 'serum-s1') {
    reasons.push('글리세린5.0%, 판테놀0.5%, 소듐하이알루로네이트0.1%의 역할을 확인할 수 있는 수분 세럼입니다.');
    limitations.push('연구에 쓰인 히알루론산 원료·분자량·제형은 현재 소듐하이알루로네이트 제형과 같다고 확인되지 않았습니다.');
  }
  if (fromProductSlug) {
    const source = products.find(item => item.slug === fromProductSlug);
    reasons.push(`${source.name}에서 출발해 다른 제품의 역할을 비교합니다.`);
    limitations.push(`${source.name}과 ${product.name}은 루틴의 서로 다른 단계입니다. 동일한 기능의 대체품이나 반드시 추가해야 하는 제품이라는 뜻은 아닙니다.`);
  }
  if (topicIds.includes('sensitivity')) limitations.push('현재 제품의 민감성 피부 적합성은 확인되지 않았습니다.');
  const reviewInsights = frictionReviews.filter(review => review.productSlug === slug).slice(0, 2)
    .map(({ id, body, rating, productSlug }) => ({ id, body, rating, productSlug }));
  return { product, reasons, limitations, reviewInsights, primary };
}

export function analyzeConcern(value, { reviews = [], fromProductSlug = null } = {}) {
  const validation = validateConcernQuery(value);
  const { query } = validation;
  const actualReviews = writtenReviews(reviews);
  const text = compact(query);
  const sourceSlug = PRODUCT_SLUGS.has(fromProductSlug) ? fromProductSlug : inferSourceProduct(text);
  const result = {
    query, status: 'unknown', title: '고민을 조금 더 구체적으로 알려주세요.',
    summary: '건조함, 피부 장벽, 가벼운 제형, 끈적임, 사용 순서처럼 확인 가능한 주제로 연결합니다.',
    topics: [], newsTopic: null, research: [], findings: [], recommendations: [],
    precautions: [], reviewBasis: { writtenCount: actualReviews.length, usedCount: 0 }, externalLinks: [],
  };
  if (validation.error) return { ...result, validationError: validation.error, summary: validation.error };
  if (isMedicalConcern(text)) return {
    ...result, status: 'care', title: '제품 추천보다 피부 상태 확인이 먼저입니다.',
    summary: '질환의 진단·치료나 이상 반응에 맞는 제품을 이 검색으로 선택할 수는 없습니다. 사용 중 따가움·붉어짐·가려움 등 이상이 생겼다면 사용을 중지하고 전문가와 상담해 주세요.',
    precautions: ['질환, 알레르기, 임신·수유 및 어린이의 적합성을 성분 정보만으로 확답할 수 없습니다.'],
  };
  if (needsUnverifiedExclusion(text)) return {
    ...result, status: 'unsupported', title: '무함유·인증 조건을 확인할 정보가 부족합니다.',
    summary: '제공된 제품별 전성분과 함량을 확인할 수 있습니다. 다만 이름이 목록에 없다는 사실만으로 무첨가·무향·비건 등의 조건이나 인증을 충족한다고 판단할 수 없어 조건에 맞는 제품을 추천하지 않습니다.',
    precautions: ['알고 있는 알레르기 성분이 있다면 전체 전성분과 전문가 안내를 먼저 확인하세요.'],
  };
  if (/(?:토너|세럼|크림)?[tsc]\.?(?:2|3|4)\b|미백|기미|잡티|색소침착|선크림|썬크림|자외선|uv[ab]?|spf|모공|블랙헤드|피지조절|비듬|탈모|다크서클/.test(text)) return {
    ...result, status: 'unsupported', title: '현재 제품 자료로 연결할 수 없는 요청입니다.',
    summary: '등록된 제품은 토너 T.1, 세럼 S.1, 크림 C.1입니다. 이 자료에서 확인되지 않은 제품이나 미백·자외선 차단 등 완제품 효능을 만들어 추천하지 않습니다.',
  };
  const topicIds = inferTopics(text);
  if (!topicIds.length) return result;
  const ingredientIds = INGREDIENTS.filter(item => item.pattern.test(text)).map(item => item.id);
  const papers = selectResearch(topicIds, ingredientIds);
  const primaryTopicId = topicIds[0];
  const preference = texturePreference(text);
  result.topics = topicIds.map(id => ({ id, label: getConcernTopic(id).label }));
  result.newsTopic = primaryTopicId;
  result.research = papers;
  result.externalLinks = externalLinks(primaryTopicId);
  result.findings = findingsFor(topicIds, papers);
  if (topicIds.includes('aging')) return {
    ...result, status: 'unsupported', title: '주름·탄력의 성분 연구와 제품 효과를 구분합니다.',
    summary: '관련 성분 연구를 읽을 수 있지만 현재 제품의 주름·탄력 개선을 입증한 완제품 시험 결과는 없습니다. 연구만으로 해당 효과의 제품을 추천하지 않습니다.',
    precautions: [PRODUCT_SCOPE],
  };
  const frictionReviews = actualReviews.filter(review => reviewFriction(review, topicIds));
  const sourceFriction = sourceSlug ? frictionReviews.filter(review => review.productSlug === sourceSlug) : [];
  const slugs = productCandidates(topicIds, sourceSlug, preference);
  result.recommendations = slugs.map((slug, index) => makeRecommendation(slug, topicIds, sourceSlug, frictionReviews, index === 0));
  const used = new Set([...sourceFriction, ...frictionReviews.filter(review => slugs.includes(review.productSlug))].map(review => `${review.productSlug}/${review.id}`));
  result.reviewBasis.usedCount = used.size;
  if (used.size) result.findings.push({
    kind: 'context', title: '이 브라우저에서 직접 작성한 불편 경험을 함께 봅니다.',
    text: `이 브라우저에서 직접 작성한 별점2점 이하 리뷰 ${used.size}개에서 질문과 관련된 사용감·건조함 표현을 확인했습니다. 리뷰는 개인의 경험이며 효능이나 다른 사람의 적합성을 입증하지 않습니다.`, paperIds: [],
  });
  result.status = 'matched';
  result.title = `${getConcernTopic(primaryTopicId).label}부터 살펴봅니다.`;
  result.summary = result.recommendations.length
    ? '외부 성분·제형 연구의 관찰 결과와 한계를 먼저 읽고, 공개된 성분 역할과 제형이 가까운 제품을 비교해 보세요. 개인 맞춤 진단이나 효과 확률을 산출한 결과는 아닙니다.'
    : topicIds.includes('sensitivity')
      ? '민감성 피부 적합성을 확인한 제품 시험 자료가 없어 특정 제품을 더 순한 선택으로 추천하지 않습니다. 공개된 자료의 범위와 확인할 항목을 안내합니다.'
      : '공개된 사용 안내와 연구 범위를 먼저 확인합니다. 이 질문만으로 추가 구매나 대체 제품이 필요하다고 판단하지 않습니다.';
  result.precautions = [PRODUCT_SCOPE];
  if (preference === 'avoid-light' && !slugs.length) {
    result.status = 'unknown';
    result.title = '선호하는 제형을 조금 더 알려주세요.';
    result.summary = '가벼운 제형을 원하지 않는다는 선호를 확인했습니다. 원하는 질감이나 보습 단계까지 알려주시면 공개된 제품 제형을 비교할 수 있습니다.';
  }
  if (preference === 'rich') {
    result.title = '공개된 크림 제형을 살펴봅니다.';
    result.findings.push({ kind: 'context', title: '원하는 질감과 실제 사용감을 구분합니다.', text: '현재 공개된 흰색 크림 제형을 비교 대상으로 연결했습니다. 실제 무게감·꾸덕함을 측정한 자료는 없으므로 원하는 사용감과 일치한다고 보장하지 않습니다.', paperIds: [] });
  }
  if (topicIds.includes('sensitivity')) result.precautions.push('전체 전성분을 확인하고 작은 부위에 먼저 사용하세요. 이상이 생기면 사용을 중지하고 전문가와 상담하세요.');
  return result;
}
