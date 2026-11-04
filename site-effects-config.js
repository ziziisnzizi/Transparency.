// One shared visual system for the existing service; UI copy and controls retain
// their own colors. These palette values belong to the procedural color layer.
export const siteEffectsConfig = {
  background: {
    palette: {
      white: '#f7fbff',
      sky: '#acdfff',
      blue: '#3574e8',
      navy: '#10244f',
      black: '#030811',
    },
    timeScale: .16,
    rotation: -.55,
    distortion: .65,
    grain: .10,
    pointerRadius: .46,
    pointerPush: .30,
    followRate: 11,
    staticTime: 3.4,
    maxPixelRatio: 1.5,
    pixelBudget: 1800000,
  },
  lens: {
    diameter: 180,
    rimWidth: 10,
    refraction: 7,
    rgbOffset: 1.5,
    followRate: 12,
    fadeRate: 10,
    maxPixelRatio: 2.5,
    pixelBudget: 4000000,
  },
  hero: {
    ko: ['가릴 것이', '없으니까.', '투명하게.'],
    en: ['Nothing', 'to hide.', 'In the clear.'],
    offsets: [0, 14, 25],
  },
  // Matching ignores whitespace so the service's existing line breaks remain.
  translations: {
    '성분에 장난 없이.': ['Honest ingredients.'],
    '나의 제품. 나의 사용 기록.': ['My products.', 'My usage log.'],
    '가릴 것이 없으니까.': ['Nothing to hide.'],
    '지금, 피부에 무엇이 궁금한가요?': ['Your skin.', 'What concerns you?'],
    '내 고민, 확인할 수 있는 것부터.': ['Start with the facts.'],
    '토너 T.1': ['Toner T.1'],
    '세럼 S.1': ['Serum S.1'],
    '크림 C.1': ['Cream C.1'],
    '나의 루틴을 선택하세요.': ['Choose', 'your routine.'],
    '주문 내용을 확인하세요.': ['Review', 'your order.'],
    '구매할 제품을 선택해 주세요.': ['Choose a product.'],
  },
};
