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
    timeScale: .07,
    rotation: -.55,
    distortion: .65,
    grain: .10,
    pointerRadius: .32,
    pointerPush: .20,
    followRate: 7,
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
    en: ['Nothing to hide.', 'Everything', 'in the clear.'],
    ja: ['隠さない。', 'すべてを、', '透明に。'],
    offsets: [0, 14, 25],
  },
  // Matching ignores whitespace so the service's existing line breaks remain.
  translations: {
    '성분에 장난 없이.': ['成分を、透明に。'],
    '나의 제품. 나의 사용 기록.': ['私の製品。', '私の使用記録。'],
    '가릴 것이 없으니까.': ['隠すものはない。'],
    '지금, 피부에 무엇이 궁금한가요?': ['肌のこと、', '何が気になる？'],
    '내 고민, 확인할 수 있는 것부터.': ['確かな情報から。'],
    '토너 T.1': ['トナー T.1'],
    '세럼 S.1': ['セラム S.1'],
    '크림 C.1': ['クリーム C.1'],
    '나의 루틴을 선택하세요.': ['私のルーティンを、', '選びましょう。'],
    '주문 내용을 확인하세요.': ['注文内容を、', '確認しましょう。'],
    '구매할 제품을 선택해 주세요.': ['製品を選ぶ。'],
  },
};
