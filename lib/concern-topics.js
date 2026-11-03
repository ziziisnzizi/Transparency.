// Only these fixed, general topics may leave the browser for news searches.
// User questions and review text must never be used as external search queries.
export const CONCERN_TOPICS = Object.freeze([
  {
    id: 'dryness', label: '건조함과 수분', newsQuery: '피부 건조 보습 성분 연구',
    examples: ['세안 후 피부가 당겨요', '수분 관리 성분이 궁금해요'],
    ingredientIds: ['glycerin', 'panthenol', 'hyaluronic-acid'],
  },
  {
    id: 'barrier', label: '피부 장벽', newsQuery: '피부 장벽 세라마이드 보습 연구',
    examples: ['피부 장벽과 관련된 성분은?', '보습을 마무리하고 싶어요'],
    ingredientIds: ['ceramide-np', 'glycerin', 'panthenol'],
  },
  {
    id: 'lightweight', label: '제형과 무게감', newsQuery: '화장품 수분 토너 젤 크림 제형 사용감',
    examples: ['가벼운 워터 제형을 찾고 있어요', '무거운 크림보다 가벼운 사용감이 궁금해요'],
    ingredientIds: ['glycerin', 'panthenol', 'beta-glucan'],
  },
  {
    id: 'stickiness', label: '끈적임과 사용감', newsQuery: '보습 화장품 끈적임 제형 사용감',
    examples: ['세럼의 끈적임이 불편해요', '덜 끈적이는 제형을 비교하고 싶어요'],
    ingredientIds: ['glycerin', 'panthenol', 'hyaluronic-acid'],
  },
  {
    id: 'routine', label: '사용 순서와 양', newsQuery: '기초 화장품 사용 순서 보습 관리',
    examples: ['토너 세럼 크림 순서가 궁금해요', '한 번에 얼마나 사용하나요?'],
    ingredientIds: [],
  },
  {
    id: 'sensitivity', label: '민감한 피부의 확인 사항', newsQuery: '민감성 피부 화장품 사용 주의사항',
    examples: ['민감한 피부는 무엇을 확인하나요?', '민감성 피부 적합 시험이 있나요?'],
    ingredientIds: ['panthenol', 'glycerin'],
  },
  {
    id: 'aging', label: '주름과 탄력의 근거 범위', newsQuery: '피부 주름 탄력 보습 성분 연구',
    examples: ['주름과 탄력에 관한 근거가 있나요?', '보습 연구와 주름 개선은 같은가요?'],
    ingredientIds: ['hyaluronic-acid', 'squalane'],
  },
].map(topic => Object.freeze({
  ...topic, examples: Object.freeze(topic.examples), ingredientIds: Object.freeze(topic.ingredientIds),
})));

export function getConcernTopic(id) {
  return typeof id === 'string' ? CONCERN_TOPICS.find(topic => topic.id === id) || null : null;
}
