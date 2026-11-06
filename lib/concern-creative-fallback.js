import { products } from '../products.js';
import { analyzeConcern, validateConcernQuery } from './concern-search.js';
import { isCrisisConcern } from './concern-safety.js';

// The AI may refuse a topic for reasons not captured by local rules. Fallback
// copy is therefore factual product information, never a claim about the user.
// For known everyday topics a gentle bridge can be used when appropriate.
const everyday = [
  { pattern: /날씨|기온|구름|바람|햇빛|맑은\s*하늘|비\s*(?:와|오|올)|weather/i, text: '날씨 이야기를 나누는 순간에도, 일상의 작은 시작이 있죠.' },
  { pattern: /(?:뭐|무엇|뭘)\s*(?:먹|마실)|(?:점심|저녁|아침|식사|메뉴|음식|커피|간식|배고프|배고파)|food|coffee/i, text: '오늘의 메뉴를 고르듯, 하루에도 여러 가지 작은 선택이 있어요.' },
  { pattern: /사랑|연애|설레|고백|love/i, text: '사랑을 떠올리는 순간처럼, 일상에도 맑은 시작이 있어요.' },
  { pattern: /행복|기쁨|즐거움|기분\s*좋|happy|happiness/i, text: '기분 좋은 하루는 작은 순간에서 시작되기도 해요.' },
  { pattern: /고양이|강아지|동물|강아쥐|반려동물|음악|노래|영화|책|게임|취미|운동|여행|수학|숫자|우주|행성|별자리|과학|철학|역사|색깔|꽃|나무|바다|cat|dog|music|movie|game|math|space|hobby/i, text: '좋아하는 이야기를 나누듯, 일상에서도 작은 취향을 살펴보세요.' },
  { pattern: /^\s*[0-9\s.+*/()=-]{1,40}(?:은|는|이|가)?\s*(?:얼마|뭐야|뭐지|정답)?\s*[?!.]*\s*$/, text: '하나씩 생각을 이어 가듯, 일상에도 작은 시작이 있어요.' },
];
// Do not introduce sales copy into adverse personal or sensitive situations,
// even when the existing skincare classifier cannot determine the context.
const sensitive = /사고|질병|질환|병원|수술|암|통증|가난|빚|파산|실직|해고|사기|실종|피해|고통|폭력|차별|학대|불안|두려|무서|아프|힘들|슬프|괴롭|죽|임신|수유|장애|질문.*(?:피해|고통)|assault|illness|cancer|pain|trauma|crisis|abuse|grief|unemploy/i;

export function isEverydayCreativeQuestion(query) {
  const valid = validateConcernQuery(query);
  if (valid.error || isCrisisConcern(valid.query) || sensitive.test(valid.query)) return false;
  const result = analyzeConcern(valid.query);
  return !['care', 'unsupported'].includes(result.status) && everyday.some(item => item.pattern.test(valid.query));
}

export function fallbackConcernCreative(query, { neutral = true } = {}) {
  const valid = validateConcernQuery(query);
  if (valid.error || isCrisisConcern(valid.query) || sensitive.test(valid.query)) return null;
  const result = analyzeConcern(valid.query);
  if (['care', 'unsupported'].includes(result.status)) return null;
  // Known skincare needs may use only an existing evidence-based match.
  const matched = result.recommendations?.[0]?.product;
  if (result.status === 'matched' && !matched) return null;
  const product = matched || products.find(item => item.slug === 'toner-t1');
  if (!product?.slug || typeof product.name !== 'string' || typeof product.texture !== 'string') return null;
  const texture = product.texture.replace(/\s*제형\s*$/, '');
  const bridge = !neutral ? everyday.find(item => item.pattern.test(valid.query))?.text : '';
  return { status: 'fallback', productSlug: product.slug, message: `${bridge ? `${bridge}\n` : ''}${product.name}은 ${texture} 제형입니다.` };
}
