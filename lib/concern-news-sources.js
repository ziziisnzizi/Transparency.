// Curated publisher links verified on 2026-11-03. Store citation metadata only;
// article bodies, images, and RSS feeds are not copied or aggregated here.
export const CONCERN_NEWS_SOURCES = [
  {
    id: 'newsis-seasonal-moisturizer-amount',
    title: '환절기 피부가뭄에 영양크림 듬뿍…“오히려 독”',
    sourceName: '뉴시스',
    sourceUrl: 'https://www.newsis.com',
    url: 'https://www.newsis.com/view/NISX20261008_0003819910',
    publishedAt: '2026-10-12',
    kind: 'news',
    topics: ['dryness', 'barrier', 'lightweight', 'stickiness', 'routine'],
    checkedAt: '2026-11-03',
  },
  {
    id: 'sportschosun-autumn-dry-skin-habits',
    title: '“가을만 되면 온몸이 근질근질”…피부 가려움 막는 생활습관',
    sourceName: '스포츠조선',
    sourceUrl: 'https://www.sportschosun.com',
    url: 'https://www.sportschosun.com/life/2026-10-14/202610120100074490004828',
    publishedAt: '2026-10-14T08:29:44+09:00',
    kind: 'news',
    topics: ['dryness', 'barrier', 'routine', 'sensitivity'],
    checkedAt: '2026-11-03',
  },
  {
    id: 'amc-xerosis-cutis-guide',
    title: '피부건조증: 원인·증상과 치료 안내',
    sourceName: '서울아산병원 질환백과',
    sourceUrl: 'https://www.amc.seoul.kr',
    url: 'https://www.amc.seoul.kr/asan/healthinfo/disease/diseaseDetail.do?contentId=32470',
    publishedAt: null,
    kind: 'guide',
    topics: ['dryness', 'barrier', 'sensitivity'],
    checkedAt: '2026-11-03',
  },
  {
    id: 'aad-dry-skin-relief-guide',
    title: '건조한 피부를 완화하는 피부과 전문의의 관리법',
    sourceName: '미국피부과학회(AAD)',
    sourceUrl: 'https://www.aad.org',
    url: 'https://www.aad.org/public/everyday-care/skin-care-basics/dry/dry-skin-relief',
    publishedAt: null,
    kind: 'guide',
    topics: ['dryness', 'barrier', 'sensitivity', 'routine'],
    checkedAt: '2026-11-03',
  },
  {
    id: 'aad-oily-skin-care-guide',
    title: '지성 피부의 보습과 제품 선택을 위한 관리법',
    sourceName: '미국피부과학회(AAD)',
    sourceUrl: 'https://www.aad.org',
    url: 'https://www.aad.org/public/everyday-care/skin-care-basics/dry/oily-skin',
    publishedAt: null,
    kind: 'guide',
    topics: ['lightweight', 'stickiness', 'routine', 'sensitivity'],
    checkedAt: '2026-11-03',
  },
  {
    id: 'aad-healthier-skin-care-guide',
    title: '더 건강한 피부를 위한 10가지 관리 습관',
    sourceName: '미국피부과학회(AAD)',
    sourceUrl: 'https://www.aad.org',
    url: 'https://www.aad.org/public/everyday-care/skin-care-secrets/routine/healthier-looking-skin',
    publishedAt: null,
    kind: 'guide',
    topics: ['routine', 'sensitivity', 'aging'],
    checkedAt: '2026-11-03',
  },
];

export function getConcernNewsSources(topicId) {
  if (typeof topicId !== 'string') return [];
  return CONCERN_NEWS_SOURCES
    .filter(source => source.topics.includes(topicId))
    .map(source => ({ ...source, topics: [...source.topics] }));
}
