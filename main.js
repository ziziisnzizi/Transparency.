const products = [
  {
    id: 1,
    slug: 'serum-s1',
    name: '세럼 S.1',
    en: 'Transparency. Serum S.1',
    type: '수분 세럼',
    kind: 'serum',
    image: '/images/products/serum-s1.webp',
    imageWidth: 1024,
    imageHeight: 1536,
    textureImage: '/images/textures/serum-s1.webp',
    volume: '30 mL',
    rating: 4.3,
    reviewCount: 128,
    ingredient: '글리세린 5.0% · 판테놀 1.0% · 소듐하이알루로네이트 0.1%',
    searchTerms: '세럼 수분 보습 글리세린 판테놀 소듐하이알루로네이트 히알루론산',
    desc: '필요한 수분, 확인할 수 있는 성분.',
    longDesc: '매일의 수분 관리를 위한 세럼입니다. 성분의 역할과 함량, 사용법을 확인하고 용기의 눈금으로 남은 양까지 살펴보세요.',
    texture: '투명 수용성 젤',
    ingredients: [
      ['글리세린 5.0%', '보습', '수분을 끌어당기는 특성을 가진 보습 성분입니다. 피부가 촉촉한 상태를 유지하도록 돕습니다.'],
      ['판테놀 1.0%', '피부 컨디셔닝 · 보습', '보습과 피부 컨디셔닝에 사용하는 성분입니다. 매일의 수분 관리에 함께합니다.'],
      ['소듐하이알루로네이트 0.1%', '보습', '물을 붙잡는 특성을 가진 보습 성분입니다. 피부 표면의 수분 유지에 도움을 줍니다.'],
    ],
    amount: '약 0.5 mL',
    routine: '세안 → 토너 T.1 → 세럼 S.1 → 크림 C.1',
    routineStep: 'STEP 02 · 수분 채우기',
  },
  {
    id: 2,
    slug: 'toner-t1',
    name: '토너 T.1',
    en: 'Transparency. Toner T.1',
    type: '수분 토너',
    kind: 'toner',
    image: '/images/products/toner-t1.webp',
    imageWidth: 1024,
    imageHeight: 1536,
    textureImage: '/images/textures/toner-t1.webp',
    volume: '150 mL',
    rating: 3.8,
    reviewCount: 46,
    ingredient: '글리세린 3.0% · 판테놀 0.5% · 베타글루칸 0.1%',
    searchTerms: '토너 수분 보습 글리세린 판테놀 베타글루칸 스킨',
    desc: '세안 다음 단계, 필요한 수분만.',
    longDesc: '세안 후 사용하는 첫 단계 수분 토너입니다. 투명한 워터 제형으로 피부를 정돈하고, 다음 단계의 수분 관리 루틴을 시작하세요.',
    texture: '투명 워터 제형',
    ingredients: [
      ['글리세린 3.0%', '보습', '수분을 끌어당기는 보습 성분입니다. 세안 후 수분 관리를 위한 성분으로 사용합니다.'],
      ['판테놀 0.5%', '피부 컨디셔닝 · 보습', '보습과 피부 컨디셔닝을 위해 사용하는 성분입니다.'],
      ['베타글루칸 0.1%', '피부 컨디셔닝', '보습과 피부 컨디셔닝에 사용하는 성분입니다. 성분의 역할을 확인하며 나에게 맞는 루틴을 구성하세요.'],
    ],
    amount: '손바닥에 1~2회 덜어낼 양',
    routine: '세안 → 토너 T.1 → 세럼 S.1 → 크림 C.1',
    routineStep: 'STEP 01 · 피부 정돈하기',
  },
  {
    id: 3,
    slug: 'cream-c1',
    name: '크림 C.1',
    en: 'Transparency. Cream C.1',
    type: '보습 크림',
    kind: 'cream',
    image: '/images/products/cream-c1.webp',
    imageWidth: 1230,
    imageHeight: 1278,
    textureImage: '/images/textures/cream-c1.webp',
    volume: '50 mL',
    rating: 3.4,
    reviewCount: 31,
    ingredient: '글리세린 5.0% · 스쿠알란 3.0% · 세라마이드 NP 0.05%',
    searchTerms: '크림 보습 장벽 글리세린 스쿠알란 세라마이드',
    desc: '수분이 머무는 마지막 단계.',
    longDesc: '수분 관리의 마지막 단계에 사용하는 보습 크림입니다. 담긴 성분의 역할을 확인하고, 필요한 양을 덜어 피부에 부드럽게 펴 발라 주세요.',
    texture: '흰색 크림 제형',
    ingredients: [
      ['글리세린 5.0%', '보습', '수분을 끌어당겨 피부의 보습을 돕는 성분입니다.'],
      ['스쿠알란 3.0%', '에몰리언트', '피부를 부드럽고 유연하게 하는 에몰리언트 성분입니다.'],
      ['세라마이드 NP 0.05%', '피부 컨디셔닝', '피부 장벽의 지질과 관련된 성분으로, 피부 컨디셔닝에 사용합니다.'],
    ],
    amount: '완두콩 1개 정도의 양',
    routine: '세안 → 토너 T.1 → 세럼 S.1 → 크림 C.1',
    routineStep: 'STEP 03 · 보습 마무리',
  },
];
let page = '홈', query = '', filter = '전체', selected = null, tab = '성분·함량', questionDraft = '';
let theme = localStorage.getItem('transparency-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;
const requestedProduct = new URLSearchParams(window.location.search).get('product');
selected = products.find(product => product.slug === requestedProduct) || null;
if (selected) page = '제품 탐색';
let saved = JSON.parse(localStorage.getItem('transparency-products') || '[]');
const catalogVersion = '2026-10-27-three-concepts';
if (localStorage.getItem('transparency-catalog-version') !== catalogVersion) {
  saved = saved.filter(item => item.id === 1);
  localStorage.setItem('transparency-products', JSON.stringify(saved));
  localStorage.setItem('transparency-catalog-version', catalogVersion);
}
const arrow = '<span aria-hidden="true">↗</span>';
const logoMark = '<img src="/images/transparency-logo.svg" alt="" width="2679" height="603">';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function bottle(p) {
  return `<div class="bottle-scene product-visual"><img class="product-packshot" src="${p.image}" alt="${p.name} 제품 이미지" width="${p.imageWidth}" height="${p.imageHeight}" loading="${selected?.id === p.id ? 'eager' : 'lazy'}" decoding="async"><img class="product-texture" src="${p.textureImage}" alt="" aria-hidden="true" width="1536" height="1024" loading="lazy" decoding="async"></div>`;
}

const navIcons = {
  '홈': '<path d="m3 10 9-7 9 7v10H5V10m4 10v-7h6v7"/>',
  '제품 탐색': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  '내 제품': '<rect x="5" y="6" width="14" height="15" rx="3"/><path d="M9 6V3h6v3m-6 6h6m-6 4h4"/>',
  '더보기': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};

function render() {
  document.querySelector('#app').innerHTML = `
    <a class="skip-link" href="#content">본문으로 이동</a>
    <header><button class="logo" data-page="홈" aria-label="Transparency. 홈">${logoMark}</button>

      <div class="header-actions"><button class="theme-toggle" id="theme-toggle" type="button" aria-label="${theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}" aria-pressed="${theme === 'dark'}"><span aria-hidden="true">${theme === 'dark' ? '☀' : '☾'}</span></button><button class="account" data-page="내 제품">MY PRODUCTS ${arrow}</button></div>
    </header>
      <nav aria-label="주요 메뉴">${['홈', '제품 탐색', '내 제품', '더보기'].map(x => `<button ${!selected && page === x ? 'aria-current="page"' : ''} class="${page === x ? 'active' : ''}" data-page="${x}"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[x]}</svg><span>${x}</span></button>`).join('')}</nav>
    <main id="content" tabindex="-1">${selected ? detail() : page === '홈' ? home() : page === '제품 탐색' ? explore() : page === '내 제품' ? my() : more()}</main>
    <footer><div><button class="logo" data-page="홈" aria-label="Transparency. 홈">${logoMark}</button><p>성분에 장난 없이.</p></div><div class="footer-links"><button data-page="더보기">브랜드 소개 ${arrow}</button><a href="mailto:ztheng@inha.edu">ztheng@inha.edu</a></div><small>© 2026 Transparency. All rights reserved.<br>성분부터 사용법까지, 투명하게.</small></footer>`;
  bind();
}

function home() {
  return `<section class="hero" aria-labelledby="hero-title">
    <img class="campaign-image" src="/images/transparency-campaign.png" alt="흑백의 빛과 그림자 속 투명한 플라스크형 세럼 용기, 흰색 패키지와 유리 오브제" fetchpriority="high" width="1536" height="1024">
    <div class="hero-copy"><div class="eyebrow"><i></i> NOTHING TO HIDE.</div><h1 id="hero-title">가릴 것이<br>없으니까.</h1><div class="hero-brand"><img src="/images/transparency-logo.svg" alt="Transparency." width="2679" height="603"></div><p>궁금했던 성분부터,<br>나에게 맞는 사용법까지.</p><button class="dark" data-page="제품 탐색">제품 살펴보기 ${arrow}</button></div>
    <div class="hero-bottom"><span>극도의 투명함, 손안에서.</span><span>NOTHING TO HIDE.</span></div>
  </section>
  <section class="principles" aria-label="정보 공개 원칙"><div class="principle-title">성분에<br>장난 없이.</div><div><span class="number">01 / INGREDIENTS</span><h2>무엇을 담았는지.</h2><p>성분과 함량을 확인하세요.</p></div><div><span class="number">02 / EVIDENCE</span><h2>어디까지 확인됐는지.</h2><p>근거와 그 한계까지 살펴보세요.</p></div><div><span class="number">03 / YOUR ROUTINE</span><h2>어떻게 사용하는지.</h2><p>첫 사용부터 마지막 한 방울까지.</p></div></section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">THE FORMULAS</div><h2>궁금했던 성분부터.</h2></div><button data-page="제품 탐색" class="text-btn">모든 제품 보기 ${arrow}</button></div><div class="cards">${products.map(card).join('')}</div></section>
  <section class="brand-statement"><span class="eyebrow">THE TRANSPARENCY STANDARD</span><h2>보이는 것, 그 너머까지.<br>투명하게.</h2><p>성분, 함량, 근거, 그리고 사용법.<br>제품을 이해하는 데 필요한 정보를 한곳에서.</p><button data-page="더보기" class="text-btn">우리의 정보 공개 원칙 ${arrow}</button><div class="glass-orb" aria-hidden="true"></div></section>
  <section class="bottom-grid"><div><span class="eyebrow">KNOW YOUR PRODUCT</span><h2>손안에서 확인하는<br>제품의 모든 것.</h2><p>제품명과 성분명으로 궁금한 정보를 찾아보세요.</p><button data-page="제품 탐색" class="text-btn">제품 검색하기 ${arrow}</button><span class="panel-number" aria-hidden="true">01</span></div><div><span class="eyebrow">MY PRODUCTS</span><h2>나의 제품.<br>나에게 맞는 사용법.</h2><p>개봉일과 사용 상태를 기록하고 확인하세요.</p><button data-page="내 제품" class="text-btn">내 제품 관리하기 ${arrow}</button><span class="panel-number" aria-hidden="true">02</span></div></section>`;
}

function card(p) {
  return `<button class="product" data-id="${p.id}" aria-label="${p.name} 상세 보기, 평점 ${p.rating.toFixed(1)}점"><div class="product-image">${bottle(p)}<span class="badge">${p.type}</span><span class="round-arrow" aria-hidden="true">↗</span></div><div class="product-meta"><span>${p.en}</span><span>${p.volume}</span></div><h3>${p.name}</h3><div class="product-rating" aria-label="평점 ${p.rating.toFixed(1)}점, 평가 ${p.reviewCount}개"><span aria-hidden="true">★</span><strong>${p.rating.toFixed(1)}</strong><small>${p.reviewCount} REVIEWS</small></div><p>${p.ingredient}<span>성분 확인 ${arrow}</span></p><span class="routine-step">${p.routineStep}</span></button>`;
}

function productResults(list) {
  return list.map(card).join('') || '<div class="empty"><span class="eyebrow">NO RESULTS</span><h2>일치하는 제품이 없어요.</h2><p>다른 검색어로 찾아보거나 필터를 초기화해 보세요.</p><button class="text-btn" id="reset-search">검색·필터 초기화 ↗</button></div>';
}

function matchingProducts() {
  const term = query.trim().toLocaleLowerCase('ko-KR');
  return products
    .filter(p => (filter === '전체' || filter === p.type) && `${p.name} ${p.en} ${p.ingredient} ${p.searchTerms}`.toLocaleLowerCase('ko-KR').includes(term))
    .sort((a, b) => a.rating - b.rating || b.reviewCount - a.reviewCount);
}

function explore() {
  const list = matchingProducts();
  return `<section class="section page-section"><div class="eyebrow">EXPLORE / THE FORMULAS</div><h1 class="page-title">성분에 장난 없이.</h1><p class="page-intro">궁금했던 성분부터, 제품의 근거와 사용법까지.</p><div class="search-field"><label class="sr-only" for="search">제품명 또는 성분명</label><input id="search" type="search" placeholder="제품명 또는 성분명으로 검색" value="${escape(query)}"><span aria-hidden="true">⌕</span></div><div class="explore-toolbar"><div class="filters" aria-label="제품 종류 필터">${['전체', ...products.map(product => product.type)].map(x => `<button data-filter="${x}" aria-pressed="${filter === x}" class="${filter === x ? 'chosen' : ''}">${x}</button>`).join('')}</div><span class="result-count">${String(list.length).padStart(2, '0')} PRODUCTS</span></div><div class="rating-sort-note"><span>★ 별점 낮은 순</span><p>불편을 먼저 보고, 고치고, 반영하기 위한 Transparency.의 기본 정렬입니다.</p></div><div class="cards">${productResults(list)}</div></section>`;
}

function ingredientContent(p) {
  return `<span class="eyebrow">01 / INGREDIENTS</span><h2>무엇을, 얼마나 담았는지.</h2><div class="ingredient-list">${p.ingredients.map(([name, role, reason]) => `<article><div class="ingredient-row"><h3>${name}</h3><span>${role}</span></div><p>${reason}</p></article>`).join('')}</div><div class="info-note"><strong>성분표 읽는 법</strong><br>주요 성분의 함량과 역할을 함께 확인하세요. 전체 성분은 제품의 전성분 표기를 참고해 주세요. 성분의 함량만으로 제품의 효능을 판단하기는 어렵습니다.</div><p class="data-date">정보 확인일 2026.10.27</p>`;
}

function evidenceContent(p) {
  if (p.id !== 1) return `<span class="eyebrow">02 / EVIDENCE</span><h2>확인된 만큼만, 정확하게.</h2><div class="evidence-status"><strong>공개된 완제품 시험 자료가 없습니다.</strong><p>${p.name}의 효능을 확인할 수 있는 완제품 시험 자료는 현재 공개되어 있지 않습니다. 성분의 일반적인 특성과 완제품의 시험 결과를 구분해 확인하세요.</p></div><div class="info-note">시험 자료는 시험 기관·대상·조건·결과·한계·출처를 함께 확인해야 합니다. 확인 가능한 자료를 기준으로 제품 정보를 안내합니다.</div><p class="data-date">자료 확인일 2026.10.27</p>`;
  return `<span class="eyebrow">02 / EVIDENCE</span><h2>성분 연구와 완제품 결과를 구분합니다.</h2><div class="evidence-status"><strong>공개된 완제품 시험 자료가 없습니다.</strong><p>현재 공개된 자료에는 세럼 S.1의 보습 효과와 지속시간에 관한 완제품 시험 결과가 포함되어 있지 않습니다.</p></div><div class="research-grid"><article><span class="number">REFERENCE 01</span><h3>나이아신아마이드</h3><p>피부 장벽과 피부 톤에 관해 연구된 성분입니다. 피부 장벽을 구성하는 지질의 생성과 멜라노솜 전달 과정에 관여하는 것으로 보고되었습니다. 일부 인체 연구에서는 나이아신아마이드를 함유한 제형을 일정 기간 사용했을 때 색소침착, 잔주름, 탄력의 개선이 관찰되었습니다.</p><small>참고 연구: Tanno 외(2000), Hakozaki 외(2002), Bissett 외(2005)</small><div class="reference-note">현재 S.1에 표기된 주요 성분에는 포함되지 않은 성분의 참고 연구입니다.</div></article><article><span class="number">REFERENCE 02</span><h3>히알루론산</h3><p>수분을 붙잡는 특성을 가진 보습 성분입니다. 여성 76명을 대상으로 한 연구에서는 히알루론산 0.1% 크림을 60일간 사용했을 때 대조 크림보다 피부 수분과 탄력이 개선되었습니다. 일부 분자량에서는 주름 깊이 감소도 관찰되었으며, 결과는 원료의 분자량과 제형에 따라 달라질 수 있습니다.</p><small>참고 연구: Pavicic 외(2011)</small><div class="reference-note">S.1의 소듐하이알루로네이트 또는 완제품 시험 결과와 동일한 자료가 아닙니다.</div></article></div><div class="info-note"><strong>연구 적용 범위</strong><br>위 내용은 해당 성분 또는 성분을 함유한 연구용 제형에 관한 자료입니다. 세럼 S.1의 완제품 시험 결과가 아니며, 실제 제품의 효과는 함량·원료 특성·배합·사용 조건에 따라 달라질 수 있습니다.</div><p class="data-date">자료 확인일 2026.10.27</p>`;
}

function usageContent(p) {
  const packageGuide = p.kind === 'cream' ? '용기와 뚜껑의 재질을 확인해 분리합니다.' : p.kind === 'toner' ? '용기와 캡, 라벨을 분리합니다.' : '병과 스포이트 캡, 라벨을 분리합니다.';
  return `<span class="eyebrow">03 / HOW TO USE</span><h2>첫 사용부터, 마지막 한 방울까지.</h2><div class="guide-grid"><div><span class="number">01 / ROUTINE</span><h3>${p.routine}</h3><p>사용량 기준은 ${p.amount}입니다. 피부 상태와 사용감에 맞춰 양을 조절하고, 얼굴에 부드럽게 펴 바르세요.</p></div><div><span class="number">02 / STORAGE</span><h3>직사광선과 고온을 피해 보관</h3><p>사용 후 입구를 깨끗하게 유지하고 뚜껑을 닫아 보관합니다.</p></div><div><span class="number">03 / REMAINING</span><h3>용기에서 남은 양을 직접 확인</h3><p>투명 용기의 내용물 높이를 기준으로 확인합니다. 실제 사용량과 내부 잔류량에 따라 차이가 있을 수 있습니다.</p></div><div><span class="number">04 / DISPOSAL</span><h3>부품별 재질 확인 후 분리</h3><p>내용물을 최대한 사용한 뒤 ${packageGuide} 지역 수거 기준을 함께 확인해 주세요.</p></div></div><div class="info-note">사용 전 제품의 사용법과 주의사항을 확인하세요. 사용 중 피부에 이상이 생기면 사용을 멈추고 전문가와 상담하세요.</div>`;
}

function questionContent(p) {
  const faqs = [['어떤 피부 타입을 위한 제품인가요?', '매일의 수분 관리를 위한 제품입니다. 피부 타입과 현재 피부 상태에 맞춰 성분과 사용감을 확인해 주세요.'], ['1회 사용량은 얼마인가요?', `사용량 기준은 ${p.amount}입니다. 피부 상태와 함께 사용하는 제품에 맞춰 양을 조절해 주세요.`], ['민감한 피부도 사용할 수 있나요?', '피부 상태에 따라 사용감이 다를 수 있습니다. 민감성 피부 대상 시험 자료는 공개되어 있지 않으므로, 사용 전 성분을 확인하고 작은 부위에 먼저 사용해 보세요.'], ['개봉 후 언제까지 사용하나요?', '용기와 패키지에 표시된 사용기한 및 개봉 후 사용기간을 확인하세요. 내 제품에 개봉일을 기록해 관리할 수 있습니다.']];
  return `<span class="eyebrow">04 / QUESTIONS</span><h2>궁금한 것은, 남김없이.</h2><div class="question-compose"><label for="ai-question">Transparency.에게 물어보기</label><p>${p.name}의 성분, 함량, 사용법에 대해 궁금한 내용을 입력해 보세요.</p><textarea id="ai-question" maxlength="500" rows="5" placeholder="예: ${p.ingredients[0][0].split(' ')[0]}을 왜 넣었나요?">${escape(questionDraft)}</textarea><div class="question-meta"><span>현재는 텍스트 입력만 가능합니다. 질문은 전송되거나 저장되지 않습니다.</span><output id="question-count" for="ai-question">${questionDraft.length} / 500</output></div></div><h3 class="faq-title">자주 묻는 질문</h3>${faqs.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}<div class="info-note">성분과 함량은 ‘성분·함량’, 자료의 출처와 적용 범위는 ‘효능·근거’에서 확인할 수 있습니다.</div>`;
}

function detail() {
  const p = selected;
  const contents = { '성분·함량': ingredientContent(p), '효능·근거': evidenceContent(p), '사용 안내': usageContent(p), '질문하기': questionContent(p) };
  return `<section class="section page-section"><button id="back" class="text-btn">← 제품 목록</button><div class="detail-top"><div class="detail-image">${bottle(p)}<span class="image-caption">TRANSPARENCY. / PRODUCT INFORMATION</span></div><div class="detail-copy"><div class="eyebrow">${p.en.toUpperCase()}</div><h1 class="page-title">${p.name}</h1><div class="detail-rating" aria-label="평점 ${p.rating.toFixed(1)}점, 평가 ${p.reviewCount}개"><span aria-hidden="true">★</span><strong>${p.rating.toFixed(1)}</strong><span>${p.reviewCount}개 평가</span></div><p class="page-intro">${p.desc}</p><p>${p.longDesc}</p><dl class="product-specs"><div><dt>루틴 단계</dt><dd>${p.routineStep}</dd></div><div><dt>핵심 성분</dt><dd>${p.ingredient}</dd></div><div><dt>종류 · 용량</dt><dd>${p.type} · ${p.volume}</dd></div><div><dt>제형</dt><dd>${p.texture}</dd></div></dl><aside class="product-qr" aria-label="${p.name} 상세 페이지 QR"><img src="/images/qr/${p.slug}.svg" alt="${p.name} 상세 페이지로 연결되는 QR 코드" width="160" height="160"><div><span class="eyebrow">PRODUCT QR</span><h2>스캔해서 바로 확인.</h2><p>이 QR은 ${p.name} 상세 페이지로 직접 연결됩니다.</p><div class="qr-downloads"><a href="/images/qr/${p.slug}.svg" download="Transparency-${p.slug}-QR.svg">SVG</a><a href="/images/qr/${p.slug}.png" download="Transparency-${p.slug}-QR.png">PNG</a></div></div></aside><button class="dark" id="register">내 제품에 추가 <span aria-hidden="true">＋</span></button><p class="muted">평가 정보: 별점과 평가 수는 화면 구성용 데이터이며, 실제 사용자 평가를 집계한 수치가 아닙니다.</p></div></div><div class="tabs" role="tablist" aria-label="제품 정보">${Object.keys(contents).map(t => `<button id="tab-${t}" role="tab" aria-controls="detail-panel" aria-selected="${tab === t}" data-tab="${t}" class="${tab === t ? 'chosen' : ''}">${t}</button>`).join('')}</div><div class="info" id="detail-panel" role="tabpanel" aria-labelledby="tab-${tab}">${contents[tab]}</div></section>`;
}

function my() {
  return `<section class="section page-section"><div class="eyebrow">MY PRODUCTS</div><div class="section-head"><div><h1 class="page-title">나의 제품.<br>나의 사용 기록.</h1><p class="page-intro">개봉일부터 마지막 한 방울까지, 한눈에.</p></div><button class="dark" data-page="제품 탐색">제품 등록하기 <span aria-hidden="true">＋</span></button></div><div class="shelf-summary"><span>전체 <strong>${saved.length}</strong></span><span>사용 중 <strong>${saved.filter(s => !s.done && s.date).length}</strong></span><span>미개봉 <strong>${saved.filter(s => !s.done && !s.date).length}</strong></span><span>사용 완료 <strong>${saved.filter(s => s.done).length}</strong></span></div><div class="my-list">${saved.map((s, i) => {
    const p = products.find(p => p.id === s.id);
    return `<article class="my-row"><button class="my-product-image" data-id="${p.id}" aria-label="${p.name} 정보 보기">${bottle(p)}</button><div class="my-product-copy"><span class="status-badge">${s.done ? '사용 완료' : s.date ? '사용 중' : '미개봉'}</span><h2>${p.name}</h2><span class="product-english">${p.en} / ${p.volume}</span><label class="date-label">개봉일 <input aria-label="${p.name} 개봉일" type="date" data-date="${i}" value="${escape(s.date || '')}"></label><span class="date-hint">개봉일을 비워두면 미개봉으로 기록됩니다.</span></div><div class="my-actions"><button data-done="${i}">${s.done ? '사용 중으로 변경' : '사용 완료'} ${arrow}</button><button data-delete="${i}" class="delete-btn">등록 삭제</button></div></article>`;
  }).join('') || '<div class="empty"><div class="empty-mark" aria-hidden="true">＋</div><span class="eyebrow">YOUR DAILY RECORD</span><h2>첫 제품을 등록해 보세요.</h2><p>개봉일부터 사용 완료까지,<br>나의 제품을 투명하게 기록하세요.</p><button data-page="제품 탐색" class="text-btn">등록할 제품 찾기 ↗</button></div>'}</div><p class="storage-note">제품 기록은 현재 사용 중인 브라우저에 저장됩니다.</p></section>`;
}

function more() {
  return `<section class="section page-section"><div class="about-banner"><span class="eyebrow">ABOUT TRANSPARENCY.</span><h1 class="page-title">가릴 것이 없으니까.</h1><div class="about-logo"><img src="/images/transparency-logo.svg" alt="Transparency." width="2679" height="603"></div><p>궁금했던 성분부터, 나에게 맞는 사용법까지.<br>극도의 투명함, 손안에서.</p><div class="glass-orb" aria-hidden="true"></div></div><div class="about-list">${[
    ['01', '브랜드 철학', '알고 선택하고, 납득하며 사용하고, 끝까지 확인하는 것. Transparency.가 생각하는 투명함입니다.'],
    ['02', '정보 공개 원칙', '성분의 역할과 함량 기준을 설명합니다. 효능에는 출처와 한계를 함께 표시합니다. 확인되지 않은 내용은 확인되지 않았다고 안내하고, 정보가 바뀌면 확인일과 변경 내용을 갱신합니다.'],
    ['03', '서비스 이용 안내', '제품을 탐색하고 내 제품으로 등록하세요. 개봉일을 입력하고 사용 상태를 관리할 수 있습니다. 기록은 이 브라우저에만 저장됩니다.'],
    ['04', '계정 관리', '회원가입 없이 제품 정보를 확인하고 사용 기록을 관리할 수 있습니다. 기록은 현재 사용하는 브라우저에 저장됩니다.'],
    ['05', '정보 상태와 문의', '현재 공개되지 않았거나 확인 가능한 자료가 없는 정보는 그 이유와 확인 가능한 범위를 함께 안내합니다. 문의: ztheng@inha.edu'],
    ['06', '개인정보·기록 관리', '제품 사용 기록은 현재 브라우저에 저장되며, 내 제품에서 개별 기록을 삭제할 수 있습니다. 질문 입력 내용은 전송되거나 저장되지 않습니다. 서비스 이용과 개인정보 관련 문의는 안내된 이메일로 보내 주세요.'],
  ].map(([n, a, b]) => `<details><summary><span class="number">${n}</span>${a}</summary><p>${b}</p></details>`).join('')}</div></section>`;
}

function persist() {
  localStorage.setItem('transparency-products', JSON.stringify(saved));
  render();
}
function bindProductLinks(root = document) {
  root.querySelectorAll('[data-id]').forEach(e => e.onclick = () => {
    selected = products.find(p => p.id == e.dataset.id);
    tab = '성분·함량';
    const url = new URL(window.location.href);
    url.searchParams.set('product', selected.slug);
    window.history.pushState({}, '', `${url.pathname}${url.search}`);
    render();
    window.scrollTo(0, 0);
  });
}
function bindSearchReset() {
  const reset = document.querySelector('#reset-search');
  if (reset) reset.onclick = () => {
    query = '';
    filter = '전체';
    render();
    document.querySelector('#search').focus();
  };
}
function refreshSearchResults(value) {
  query = value;
  const list = matchingProducts();
  const results = document.querySelector('.cards');
  // Preserve the input element, its native IME session, focus and caret.
  results.innerHTML = productResults(list);
  document.querySelector('.result-count').textContent = `${String(list.length).padStart(2, '0')} PRODUCTS`;
  bindProductLinks(results);
  bindSearchReset();
}
function bind() {
  document.querySelector('#theme-toggle')?.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('transparency-theme', theme);
    render();
    document.querySelector('#theme-toggle')?.focus();
  });
  document.querySelectorAll('[data-page]').forEach(e => e.onclick = () => { page = e.dataset.page; selected = null; const url = new URL(window.location.href); url.searchParams.delete('product'); window.history.pushState({}, '', `${url.pathname}${url.search}`); render(); window.scrollTo(0, 0); });
  bindProductLinks();
  document.querySelectorAll('[data-filter]').forEach(e => e.onclick = () => { filter = e.dataset.filter; render(); });
  document.querySelectorAll('[data-tab]').forEach(e => e.onclick = () => { tab = e.dataset.tab; render(); document.querySelector(`[data-tab="${tab}"]`).focus(); });
  document.querySelector('.tabs')?.addEventListener('keydown', e => {
    const tabs = [...document.querySelectorAll('[data-tab]')];
    let index = tabs.indexOf(document.activeElement);
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || index < 0) return;
    e.preventDefault();
    index = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[index].click();
  });
  const input = document.querySelector('#search');
  if (input) {
    let composing = false;
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', e => {
      composing = false;
      refreshSearchResults(e.target.value);
    });
    input.oninput = e => {
      if (!composing && !e.isComposing) refreshSearchResults(e.target.value);
    };
  }
  const questionInput = document.querySelector('#ai-question');
  if (questionInput) questionInput.oninput = e => {
    questionDraft = e.target.value;
    document.querySelector('#question-count').textContent = `${questionDraft.length} / 500`;
  };
  bindSearchReset();
  document.querySelector('#back')?.addEventListener('click', () => { selected = null; page = '제품 탐색'; const url = new URL(window.location.href); url.searchParams.delete('product'); window.history.pushState({}, '', `${url.pathname}${url.search}`); render(); });
  document.querySelector('#register')?.addEventListener('click', () => { if (!saved.some(s => s.id === selected.id)) saved.push({ id: selected.id, date: '', done: false }); selected = null; page = '내 제품'; const url = new URL(window.location.href); url.searchParams.delete('product'); window.history.pushState({}, '', `${url.pathname}${url.search}`); persist(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-date]').forEach(e => e.onchange = () => { saved[e.dataset.date].date = e.value; persist(); });
  document.querySelectorAll('[data-done]').forEach(e => e.onclick = () => { saved[e.dataset.done].done = !saved[e.dataset.done].done; persist(); });
  document.querySelectorAll('[data-delete]').forEach(e => e.onclick = () => { if (window.confirm('등록한 제품과 사용 기록을 삭제할까요?')) { saved.splice(+e.dataset.delete, 1); persist(); } });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') document.body.classList.add('keyboard-navigation');
});
document.addEventListener('pointerdown', () => document.body.classList.remove('keyboard-navigation'));
window.addEventListener('popstate', () => {
  const slug = new URLSearchParams(window.location.search).get('product');
  selected = products.find(product => product.slug === slug) || null;
  if (selected) page = '제품 탐색';
  render();
});
render();
