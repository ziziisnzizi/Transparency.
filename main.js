const products = [
  {
    id: 1,
    name: '세럼 S.1',
    en: 'Transparency. Serum S.1',
    type: '수분 세럼',
    kind: 'serum',
    volume: '30 mL',
    ingredient: '글리세린 5.0% · 판테놀 1.0% · 소듐하이알루로네이트 0.1%',
    searchTerms: '세럼 수분 보습 글리세린 판테놀 소듐하이알루로네이트 히알루론산',
    desc: '필요한 수분, 확인할 수 있는 성분.',
    longDesc: '일상적인 수분 관리를 위해 기획한 기초 세럼입니다. 각 성분의 역할과 배합 기준을 공개하고, 용기 눈금으로 남은 양을 확인하는 것을 목표로 합니다.',
    texture: '투명 수용성 젤',
    ingredients: [
      ['글리세린 5.0%', '보습', '수분감과 사용감을 함께 검토하기 위한 개발 목표값입니다.'],
      ['판테놀 1.0%', '피부 컨디셔닝 · 보습', '일상적인 수분 관리 콘셉트에 맞춘 개발 목표값입니다.'],
      ['소듐하이알루로네이트 0.1%', '보습', '제형의 점도와 발림성을 함께 검토하기 위한 개발 목표값입니다.'],
    ],
    amount: '약 0.5 mL',
    routine: '세안 → 토너 T.1 → 세럼 S.1 → 크림 C.1',
    status: '개발 콘셉트 · 판매 전',
  },
  {
    id: 2,
    name: '토너 T.1',
    en: 'Transparency. Toner T.1',
    type: '수분 토너',
    kind: 'toner',
    volume: '150 mL',
    ingredient: '글리세린 3.0% · 판테놀 0.5% · 베타글루칸 0.1%',
    searchTerms: '토너 수분 보습 글리세린 판테놀 베타글루칸 스킨',
    desc: '세안 다음 단계, 필요한 수분만.',
    longDesc: '세안 후 피부를 촉촉하게 정돈하는 첫 단계로 기획한 수분 토너입니다. 가볍게 흡수되는 사용감과 다음 제품을 바르기 편한 마무리를 목표로 합니다.',
    texture: '투명 워터 제형',
    ingredients: [
      ['글리세린 3.0%', '보습', '끈적임을 줄이면서 기본적인 수분감을 검토하기 위한 임시 목표값입니다.'],
      ['판테놀 0.5%', '피부 컨디셔닝 · 보습', '매일 사용하는 토너의 편안한 사용감을 검토하기 위한 임시 목표값입니다.'],
      ['베타글루칸 0.1%', '피부 컨디셔닝', '제형 안정성과 발림성을 함께 확인하기 위한 임시 목표값입니다.'],
    ],
    amount: '손바닥에 1~2회 덜어낼 양',
    routine: '세안 → 토너 T.1 → 세럼 S.1 → 크림 C.1',
    status: '가상 개발 콘셉트 · 검증 전',
  },
  {
    id: 3,
    name: '크림 C.1',
    en: 'Transparency. Cream C.1',
    type: '보습 크림',
    kind: 'cream',
    volume: '50 mL',
    ingredient: '글리세린 5.0% · 스쿠알란 3.0% · 세라마이드 NP 0.05%',
    searchTerms: '크림 보습 장벽 글리세린 스쿠알란 세라마이드',
    desc: '수분이 머무는 마지막 단계.',
    longDesc: '수분 관리 루틴의 마지막 단계에서 피부를 부드럽게 감싸는 보습 크림으로 기획했습니다. 수분감과 유분감의 균형을 검토하는 개발 콘셉트입니다.',
    texture: '흰색 크림 제형',
    ingredients: [
      ['글리세린 5.0%', '보습', '크림의 기본 수분감을 검토하기 위한 임시 목표값입니다.'],
      ['스쿠알란 3.0%', '에몰리언트', '부드러운 발림성과 마무리감을 검토하기 위한 임시 목표값입니다.'],
      ['세라마이드 NP 0.05%', '피부 컨디셔닝', '제형 내 분산과 사용감을 함께 검토하기 위한 임시 목표값입니다.'],
    ],
    amount: '완두콩 1개 정도의 양',
    routine: '세안 → 토너 T.1 → 세럼 S.1 → 크림 C.1',
    status: '가상 개발 콘셉트 · 검증 전',
  },
];
let page = '홈', query = '', filter = '전체', selected = null, tab = '성분·함량', questionDraft = '';
let saved = JSON.parse(localStorage.getItem('transparency-products') || '[]');
const catalogVersion = '2026-10-27-three-concepts';
if (localStorage.getItem('transparency-catalog-version') !== catalogVersion) {
  saved = saved.filter(item => item.id === 1);
  localStorage.setItem('transparency-products', JSON.stringify(saved));
  localStorage.setItem('transparency-catalog-version', catalogVersion);
}
const arrow = '<span aria-hidden="true">↗</span>';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function bottle(p) {
  if (p.kind === 'serum') return '<div class="bottle-scene flask-scene"><img src="/images/transparency-glass.svg" alt="투명한 플라스크형 세럼 S.1 콘셉트 일러스트" loading="lazy"></div>';
  return `<div class="bottle-scene" aria-hidden="true"><div class="bottle ${p.kind}"><div class="cap"></div><div class="label"><strong>Transparency.</strong><span>${p.en.replaceAll(' ', '<br>')}</span><small>${p.ingredient}<br>${p.volume}</small></div><div class="graduations"><i></i><i></i><i></i></div></div></div>`;
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
    <header><button class="logo" data-page="홈" aria-label="Transparency. 홈">Transparency.</button>

      <button class="account" data-page="내 제품">MY PRODUCTS ${arrow}</button>
    </header>
      <nav aria-label="주요 메뉴">${['홈', '제품 탐색', '내 제품', '더보기'].map(x => `<button ${!selected && page === x ? 'aria-current="page"' : ''} class="${page === x ? 'active' : ''}" data-page="${x}"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[x]}</svg><span>${x}</span></button>`).join('')}</nav>
    <main id="content" tabindex="-1">${selected ? detail() : page === '홈' ? home() : page === '제품 탐색' ? explore() : page === '내 제품' ? my() : more()}</main>
    <footer><div><button class="logo" data-page="홈">Transparency.</button><p>성분에 장난 없이.</p></div><div class="footer-links"><button data-page="더보기">브랜드 소개 ${arrow}</button><a href="mailto:ztheng@inha.edu">ztheng@inha.edu</a></div><small>© 2026 Transparency. All rights reserved.<br>모든 제품은 판매 전 개발 콘셉트입니다.</small></footer>`;
  bind();
}

function home() {
  return `<section class="hero" aria-labelledby="hero-title">
    <img class="campaign-image" src="/images/transparency-campaign.png" alt="흑백의 빛과 그림자 속 투명한 플라스크형 세럼 용기, 흰색 패키지와 유리 오브제" fetchpriority="high" width="1536" height="1024">
    <div class="hero-copy"><div class="eyebrow"><i></i> NOTHING TO HIDE.</div><h1 id="hero-title">가릴 것이<br>없으니까.</h1><div class="hero-brand">Transparency.</div><p>궁금했던 성분부터,<br>나에게 맞는 사용법까지.</p><button class="dark" data-page="제품 탐색">제품 살펴보기 ${arrow}</button></div>
    <div class="hero-bottom"><span>극도의 투명함, 손안에서.</span><span>BRAND CONCEPT — 01</span></div>
  </section>
  <section class="principles" aria-label="정보 공개 원칙"><div class="principle-title">성분에<br>장난 없이.</div><div><span class="number">01 / INGREDIENTS</span><h2>무엇을 담았는지.</h2><p>성분과 함량을 확인하세요.</p></div><div><span class="number">02 / EVIDENCE</span><h2>어디까지 확인됐는지.</h2><p>근거와 그 한계까지 살펴보세요.</p></div><div><span class="number">03 / YOUR ROUTINE</span><h2>어떻게 사용하는지.</h2><p>첫 사용부터 마지막 한 방울까지.</p></div></section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">THE FORMULAS</div><h2>궁금했던 성분부터.</h2></div><button data-page="제품 탐색" class="text-btn">모든 제품 보기 ${arrow}</button></div><div class="cards">${products.map(card).join('')}</div></section>
  <section class="brand-statement"><span class="eyebrow">THE TRANSPARENCY STANDARD</span><h2>보이는 것, 그 너머까지.<br>투명하게.</h2><p>성분, 함량, 근거, 그리고 사용법.<br>제품을 이해하는 데 필요한 정보를 한곳에서.</p><button data-page="더보기" class="text-btn">우리의 정보 공개 원칙 ${arrow}</button><div class="glass-orb" aria-hidden="true"></div></section>
  <section class="bottom-grid"><div><span class="eyebrow">KNOW YOUR PRODUCT</span><h2>손안에서 확인하는<br>제품의 모든 것.</h2><p>제품명과 성분명으로 궁금한 정보를 찾아보세요.</p><button data-page="제품 탐색" class="text-btn">제품 검색하기 ${arrow}</button><span class="panel-number" aria-hidden="true">01</span></div><div><span class="eyebrow">MY PRODUCTS</span><h2>나의 제품.<br>나에게 맞는 사용법.</h2><p>개봉일과 사용 상태를 기록하고 확인하세요.</p><button data-page="내 제품" class="text-btn">내 제품 관리하기 ${arrow}</button><span class="panel-number" aria-hidden="true">02</span></div></section>`;
}

function card(p) {
  return `<button class="product" data-id="${p.id}" aria-label="${p.name} 상세 보기"><div class="product-image">${bottle(p)}<span class="badge">${p.type}</span><span class="round-arrow" aria-hidden="true">↗</span></div><div class="product-meta"><span>${p.en}</span><span>${p.volume}</span></div><h3>${p.name}</h3><p>${p.ingredient}<span>성분 확인 ${arrow}</span></p><span class="concept-status">${p.status}</span></button>`;
}

function productResults(list) {
  return list.map(card).join('') || '<div class="empty"><span class="eyebrow">NO RESULTS</span><h2>일치하는 제품이 없어요.</h2><p>다른 검색어로 찾아보거나 필터를 초기화해 보세요.</p><button class="text-btn" id="reset-search">검색·필터 초기화 ↗</button></div>';
}

function matchingProducts() {
  const term = query.trim().toLocaleLowerCase('ko-KR');
  return products.filter(p => (filter === '전체' || filter === p.type) && `${p.name} ${p.en} ${p.ingredient} ${p.searchTerms}`.toLocaleLowerCase('ko-KR').includes(term));
}

function explore() {
  const list = matchingProducts();
  return `<section class="section page-section"><div class="eyebrow">EXPLORE / THE FORMULAS</div><h1 class="page-title">성분에 장난 없이.</h1><p class="page-intro">궁금했던 성분부터, 제품의 근거와 사용법까지.</p><div class="search-field"><label class="sr-only" for="search">제품명 또는 성분명</label><input id="search" type="search" placeholder="제품명 또는 성분명으로 검색" value="${escape(query)}"><span aria-hidden="true">⌕</span></div><div class="explore-toolbar"><div class="filters" aria-label="제품 종류 필터">${['전체', ...products.map(product => product.type)].map(x => `<button data-filter="${x}" aria-pressed="${filter === x}" class="${filter === x ? 'chosen' : ''}">${x}</button>`).join('')}</div><span class="result-count">${String(list.length).padStart(2, '0')} PRODUCTS</span></div><div class="cards">${productResults(list)}</div></section>`;
}

function legacyDetail() {
  const p = selected;
  const contents = {
    '성분·함량': `<span class="eyebrow">01 / INGREDIENTS</span><h2>무엇을, 얼마나 담았는지.</h2><div class="ingredient-list"><article><div class="ingredient-row"><h3>글리세린 5.0%</h3><span>보습</span></div><p>수분감과 사용감을 함께 검토하기 위한 개발 목표값입니다.</p></article><article><div class="ingredient-row"><h3>판테놀 1.0%</h3><span>피부 컨디셔닝 · 보습</span></div><p>일상적인 수분 관리 콘셉트에 맞춘 개발 목표값입니다.</p></article><article><div class="ingredient-row"><h3>소듐하이알루로네이트 0.1%</h3><span>보습</span></div><p>제형의 점도와 발림성을 함께 검토하기 위한 개발 목표값입니다.</p></article></div><div class="info-note"><strong>가상 설계안 · 검증 전</strong><br>처방과 전성분은 확정되지 않았습니다. 실제 원료가 혼합물인 경우 원료 투입량과 유효 성분 함량을 구분해 다시 산정합니다.</div><p class="data-date">정보 확인일 2026.10.27</p>`,
    '효능·근거': `<span class="eyebrow">02 / EVIDENCE</span><h2>성분 연구와 완제품 결과를 구분합니다.</h2><div class="evidence-status"><strong>완제품 시험 자료 없음</strong><p>세럼 S.1의 보습 효과와 지속시간을 확인할 수 있는 완제품 시험 자료는 없습니다.</p></div><div class="research-grid"><article><span class="number">REFERENCE 01</span><h3>나이아신아마이드</h3><p>피부 장벽과 피부 톤에 관해 연구된 성분입니다. 피부 장벽을 구성하는 지질의 생성과 멜라노솜 전달 과정에 관여하는 것으로 보고되었습니다. 일부 인체 연구에서는 나이아신아마이드를 함유한 제형을 일정 기간 사용했을 때 색소침착, 잔주름, 탄력의 개선이 관찰되었습니다.</p><small>참고 연구: Tanno 외(2000), Hakozaki 외(2002), Bissett 외(2005)</small><div class="reference-note">현재 S.1 개발 검토 성분 목록에는 포함되어 있지 않은 참고 성분 연구입니다.</div></article><article><span class="number">REFERENCE 02</span><h3>히알루론산</h3><p>수분을 붙잡는 특성을 가진 보습 성분입니다. 여성 76명을 대상으로 한 연구에서는 히알루론산 0.1% 크림을 60일간 사용했을 때 대조 크림보다 피부 수분과 탄력이 개선되었습니다. 일부 분자량에서는 주름 깊이 감소도 관찰되었으며, 결과는 원료의 분자량과 제형에 따라 달라질 수 있습니다.</p><small>참고 연구: Pavicic 외(2011)</small><div class="reference-note">S.1의 소듐하이알루로네이트 또는 완제품 시험 결과와 동일한 자료가 아닙니다.</div></article></div><div class="info-note"><strong>연구 적용 범위</strong><br>위 내용은 해당 성분 또는 성분을 함유한 연구용 제형에 관한 자료입니다. 세럼 S.1의 완제품 시험 결과가 아니며, 실제 제품의 효과는 함량·원료 특성·배합·사용 조건에 따라 달라질 수 있습니다.</div><p class="data-date">자료 확인일 2026.10.27</p>`,
    '사용 안내': `<span class="eyebrow">03 / HOW TO USE</span><h2>첫 사용부터, 마지막 한 방울까지.</h2><div class="guide-grid"><div><span class="number">01 / ROUTINE</span><h3>세안 → 토너 → 세럼 S.1 → 크림</h3><p>약 0.5 mL를 얼굴에 부드럽게 펴 바릅니다. 하루 1~2회 사용을 가정한 임시 기준입니다.</p></div><div><span class="number">02 / STORAGE</span><h3>직사광선과 고온을 피해 보관</h3><p>뚜껑을 닫아 보관하고 스포이트 끝이 피부나 다른 표면에 닿지 않도록 사용합니다.</p></div><div><span class="number">03 / REMAINING</span><h3>5 mL 간격 눈금으로 확인</h3><p>용기를 평평한 곳에 세우고 내용물 높이를 눈금과 비교하세요. 실제 사용량과 용기 내부 잔류량에 따라 차이가 있을 수 있습니다.</p></div><div><span class="number">04 / DISPOSAL</span><h3>부품별 재질 확인 후 분리</h3><p>내용물을 최대한 사용한 뒤 병과 스포이트 캡, 라벨을 분리합니다. 지역 수거 기준을 함께 확인해 주세요.</p></div></div><div class="info-note">사용량·사용 횟수·사용기간은 화면용 임시 설정이며 제품 검증 후 확정합니다.</div>`,
    '질문하기': `<span class="eyebrow">04 / QUESTIONS</span><h2>궁금한 것은, 남김없이.</h2><div class="question-compose"><label for="ai-question">Transparency.에게 물어보기</label><p>세럼 S.1의 성분, 함량, 사용법에 대해 궁금한 내용을 입력해 보세요.</p><textarea id="ai-question" maxlength="500" rows="5" placeholder="예: 판테놀을 왜 넣었나요?">${escape(questionDraft)}</textarea><div class="question-meta"><span>현재는 텍스트 입력만 가능합니다. 질문은 전송되거나 저장되지 않습니다.</span><output id="question-count" for="ai-question">${questionDraft.length} / 500</output></div></div><h3 class="faq-title">자주 묻는 질문</h3>${[['어떤 피부 타입을 위한 제품인가요?','일상적인 수분 관리를 원하는 사용자를 위해 기획했습니다. 특정 피부 타입 적합성 시험은 진행하지 않았습니다.'],['1회 사용량은 얼마인가요?','현재는 0.5 mL를 기준으로 화면을 구성했습니다. 실제 권장량과 스포이트 토출량은 검증 전입니다.'],['민감한 피부도 사용할 수 있나요?','민감성 피부 대상 시험 자료가 없어 적합성을 확답하기 어렵습니다.'],['개봉 후 언제까지 사용하나요?','현재 앱에는 6개월을 임시로 설정했습니다. 안정성·보존력 검토 후 확정합니다.']].map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}<div class="info-note">AI 답변과 전송 기능은 준비 중입니다. 등록된 자료에서 확인할 수 없는 내용은 추측하지 않습니다.</div>`,
  };
  return `<section class="section page-section"><button id="back" class="text-btn">← 제품 목록</button><div class="detail-top"><div class="detail-image">${bottle(p)}<span class="image-caption">TRANSPARENCY. / PRODUCT CONCEPT</span></div><div class="detail-copy"><div class="eyebrow">${p.en.toUpperCase()}</div><h1 class="page-title">${p.name}</h1><p class="page-intro">${p.desc}</p><p>세럼 S.1은 일상적인 수분 관리를 위해 기획한 기초 세럼입니다. 각 성분의 역할과 배합 기준을 공개하고, 용기 눈금으로 남은 양을 확인하는 것을 목표로 합니다.</p><dl class="product-specs"><div><dt>상태</dt><dd>${p.status}</dd></div><div><dt>핵심 성분</dt><dd>${p.ingredient}</dd></div><div><dt>종류 · 용량</dt><dd>${p.type} · ${p.volume}</dd></div><div><dt>제형 · 향</dt><dd>투명 수용성 젤 · 향료 무첨가 목표</dd></div></dl><button class="dark" id="register">내 제품에 추가 <span aria-hidden="true">＋</span></button><p class="muted">가상 설계안 · 처방, 제형, 패키지는 검증 및 확정 전입니다.</p></div></div><div class="tabs" role="tablist" aria-label="제품 정보">${Object.keys(contents).map(t => `<button id="tab-${t}" role="tab" aria-controls="detail-panel" aria-selected="${tab === t}" data-tab="${t}" class="${tab === t ? 'chosen' : ''}">${t}</button>`).join('')}</div><div class="info" id="detail-panel" role="tabpanel" aria-labelledby="tab-${tab}">${contents[tab]}</div></section>`;
}

function ingredientContent(p) {
  return `<span class="eyebrow">01 / INGREDIENTS</span><h2>무엇을, 얼마나 담았는지.</h2><div class="ingredient-list">${p.ingredients.map(([name, role, reason]) => `<article><div class="ingredient-row"><h3>${name}</h3><span>${role}</span></div><p>${reason}</p></article>`).join('')}</div><div class="info-note"><strong>가상 설계안 · 검증 전</strong><br>처방과 전성분은 확정되지 않았습니다. 표시 함량은 실제 제조 처방이나 효능이 입증된 수치가 아닌 개발 목표값입니다.</div><p class="data-date">정보 확인일 2026.10.27</p>`;
}

function evidenceContent(p) {
  if (p.id !== 1) return `<span class="eyebrow">02 / EVIDENCE</span><h2>확인된 만큼만, 정확하게.</h2><div class="evidence-status"><strong>등록된 완제품 시험·성분 연구 없음</strong><p>${p.name}은 가상 개발 콘셉트입니다. 현재 표시할 수 있는 시험 결과나 제품에 직접 적용할 수 있는 연구 자료가 없습니다.</p></div><div class="info-note">성분의 일반적인 역할을 제품 효능으로 확대하지 않습니다. 자료가 확보되면 시험 조건·결과·한계·출처를 함께 등록합니다.</div><p class="data-date">자료 확인일 2026.10.27</p>`;
  return `<span class="eyebrow">02 / EVIDENCE</span><h2>성분 연구와 완제품 결과를 구분합니다.</h2><div class="evidence-status"><strong>완제품 시험 자료 없음</strong><p>세럼 S.1의 보습 효과와 지속시간을 확인할 수 있는 완제품 시험 자료는 없습니다.</p></div><div class="research-grid"><article><span class="number">REFERENCE 01</span><h3>나이아신아마이드</h3><p>피부 장벽과 피부 톤에 관해 연구된 성분입니다. 피부 장벽을 구성하는 지질의 생성과 멜라노솜 전달 과정에 관여하는 것으로 보고되었습니다. 일부 인체 연구에서는 나이아신아마이드를 함유한 제형을 일정 기간 사용했을 때 색소침착, 잔주름, 탄력의 개선이 관찰되었습니다.</p><small>참고 연구: Tanno 외(2000), Hakozaki 외(2002), Bissett 외(2005)</small><div class="reference-note">현재 S.1 개발 검토 성분 목록에는 포함되어 있지 않은 참고 성분 연구입니다.</div></article><article><span class="number">REFERENCE 02</span><h3>히알루론산</h3><p>수분을 붙잡는 특성을 가진 보습 성분입니다. 여성 76명을 대상으로 한 연구에서는 히알루론산 0.1% 크림을 60일간 사용했을 때 대조 크림보다 피부 수분과 탄력이 개선되었습니다. 일부 분자량에서는 주름 깊이 감소도 관찰되었으며, 결과는 원료의 분자량과 제형에 따라 달라질 수 있습니다.</p><small>참고 연구: Pavicic 외(2011)</small><div class="reference-note">S.1의 소듐하이알루로네이트 또는 완제품 시험 결과와 동일한 자료가 아닙니다.</div></article></div><div class="info-note"><strong>연구 적용 범위</strong><br>위 내용은 해당 성분 또는 성분을 함유한 연구용 제형에 관한 자료입니다. 세럼 S.1의 완제품 시험 결과가 아니며, 실제 제품의 효과는 함량·원료 특성·배합·사용 조건에 따라 달라질 수 있습니다.</div><p class="data-date">자료 확인일 2026.10.27</p>`;
}

function usageContent(p) {
  const packageGuide = p.kind === 'cream' ? '용기와 뚜껑의 재질을 확인해 분리합니다.' : p.kind === 'toner' ? '용기와 캡, 라벨을 분리합니다.' : '병과 스포이트 캡, 라벨을 분리합니다.';
  return `<span class="eyebrow">03 / HOW TO USE</span><h2>첫 사용부터, 마지막 한 방울까지.</h2><div class="guide-grid"><div><span class="number">01 / ROUTINE</span><h3>${p.routine}</h3><p>${p.amount}을 얼굴에 부드럽게 펴 바릅니다. 하루 1~2회 사용을 가정한 임시 기준입니다.</p></div><div><span class="number">02 / STORAGE</span><h3>직사광선과 고온을 피해 보관</h3><p>사용 후 입구를 깨끗하게 유지하고 뚜껑을 닫아 보관합니다.</p></div><div><span class="number">03 / REMAINING</span><h3>용기에서 남은 양을 직접 확인</h3><p>투명 용기의 내용물 높이를 기준으로 확인합니다. 실제 사용량과 내부 잔류량에 따라 차이가 있을 수 있습니다.</p></div><div><span class="number">04 / DISPOSAL</span><h3>부품별 재질 확인 후 분리</h3><p>내용물을 최대한 사용한 뒤 ${packageGuide} 지역 수거 기준을 함께 확인해 주세요.</p></div></div><div class="info-note">사용량·사용 횟수·사용기간은 화면용 임시 설정이며 제품 검증 후 확정합니다.</div>`;
}

function questionContent(p) {
  const faqs = [['어떤 피부 타입을 위한 제품인가요?', '일상적인 수분 관리를 원하는 사용자를 위해 기획했습니다. 특정 피부 타입 적합성 시험은 진행하지 않았습니다.'], ['1회 사용량은 얼마인가요?', `${p.amount}을 기준으로 화면을 구성했습니다. 실제 권장량은 검증 전입니다.`], ['민감한 피부도 사용할 수 있나요?', '민감성 피부 대상 시험 자료가 없어 적합성을 확답하기 어렵습니다.'], ['개봉 후 언제까지 사용하나요?', '현재 앱에는 6개월을 임시로 설정했습니다. 안정성·보존력 검토 후 확정합니다.']];
  return `<span class="eyebrow">04 / QUESTIONS</span><h2>궁금한 것은, 남김없이.</h2><div class="question-compose"><label for="ai-question">Transparency.에게 물어보기</label><p>${p.name}의 성분, 함량, 사용법에 대해 궁금한 내용을 입력해 보세요.</p><textarea id="ai-question" maxlength="500" rows="5" placeholder="예: ${p.ingredients[0][0].split(' ')[0]}을 왜 넣었나요?">${escape(questionDraft)}</textarea><div class="question-meta"><span>현재는 텍스트 입력만 가능합니다. 질문은 전송되거나 저장되지 않습니다.</span><output id="question-count" for="ai-question">${questionDraft.length} / 500</output></div></div><h3 class="faq-title">자주 묻는 질문</h3>${faqs.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}<div class="info-note">AI 답변과 전송 기능은 준비 중입니다. 등록된 자료에서 확인할 수 없는 내용은 추측하지 않습니다.</div>`;
}

function detail() {
  const p = selected;
  const contents = { '성분·함량': ingredientContent(p), '효능·근거': evidenceContent(p), '사용 안내': usageContent(p), '질문하기': questionContent(p) };
  return `<section class="section page-section"><button id="back" class="text-btn">← 제품 목록</button><div class="detail-top"><div class="detail-image">${bottle(p)}<span class="image-caption">TRANSPARENCY. / PRODUCT CONCEPT</span></div><div class="detail-copy"><div class="eyebrow">${p.en.toUpperCase()}</div><h1 class="page-title">${p.name}</h1><p class="page-intro">${p.desc}</p><p>${p.longDesc}</p><dl class="product-specs"><div><dt>상태</dt><dd>${p.status}</dd></div><div><dt>핵심 성분</dt><dd>${p.ingredient}</dd></div><div><dt>종류 · 용량</dt><dd>${p.type} · ${p.volume}</dd></div><div><dt>제형 · 향</dt><dd>${p.texture} · 향료 무첨가 목표</dd></div></dl><button class="dark" id="register">내 제품에 추가 <span aria-hidden="true">＋</span></button><p class="muted">가상 설계안 · 처방, 제형, 패키지는 검증 및 확정 전입니다.</p></div></div><div class="tabs" role="tablist" aria-label="제품 정보">${Object.keys(contents).map(t => `<button id="tab-${t}" role="tab" aria-controls="detail-panel" aria-selected="${tab === t}" data-tab="${t}" class="${tab === t ? 'chosen' : ''}">${t}</button>`).join('')}</div><div class="info" id="detail-panel" role="tabpanel" aria-labelledby="tab-${tab}">${contents[tab]}</div></section>`;
}

function my() {
  return `<section class="section page-section"><div class="eyebrow">MY PRODUCTS</div><div class="section-head"><div><h1 class="page-title">나의 제품.<br>나의 사용 기록.</h1><p class="page-intro">개봉일부터 마지막 한 방울까지, 한눈에.</p></div><button class="dark" data-page="제품 탐색">제품 등록하기 <span aria-hidden="true">＋</span></button></div><div class="shelf-summary"><span>전체 <strong>${saved.length}</strong></span><span>사용 중 <strong>${saved.filter(s => !s.done && s.date).length}</strong></span><span>미개봉 <strong>${saved.filter(s => !s.done && !s.date).length}</strong></span><span>사용 완료 <strong>${saved.filter(s => s.done).length}</strong></span></div><div class="my-list">${saved.map((s, i) => {
    const p = products.find(p => p.id === s.id);
    return `<article class="my-row"><button class="my-product-image" data-id="${p.id}" aria-label="${p.name} 정보 보기">${bottle(p)}</button><div class="my-product-copy"><span class="status-badge">${s.done ? '사용 완료' : s.date ? '사용 중' : '미개봉'}</span><h2>${p.name}</h2><span class="product-english">${p.en} / ${p.volume}</span><label class="date-label">개봉일 <input aria-label="${p.name} 개봉일" type="date" data-date="${i}" value="${escape(s.date || '')}"></label><span class="date-hint">개봉일을 비워두면 미개봉으로 기록됩니다.</span></div><div class="my-actions"><button data-done="${i}">${s.done ? '사용 중으로 변경' : '사용 완료'} ${arrow}</button><button data-delete="${i}" class="delete-btn">등록 삭제</button></div></article>`;
  }).join('') || '<div class="empty"><div class="empty-mark" aria-hidden="true">＋</div><span class="eyebrow">YOUR DAILY RECORD</span><h2>첫 제품을 등록해 보세요.</h2><p>개봉일부터 사용 완료까지,<br>나의 제품을 투명하게 기록하세요.</p><button data-page="제품 탐색" class="text-btn">등록할 제품 찾기 ↗</button></div>'}</div><p class="storage-note">제품 기록은 현재 사용 중인 브라우저에 저장됩니다.</p></section>`;
}

function more() {
  return `<section class="section page-section"><div class="about-banner"><span class="eyebrow">ABOUT TRANSPARENCY.</span><h1 class="page-title">가릴 것이 없으니까.</h1><div class="about-logo">Transparency.</div><p>궁금했던 성분부터, 나에게 맞는 사용법까지.<br>극도의 투명함, 손안에서.</p><div class="glass-orb" aria-hidden="true"></div></div><div class="about-list">${[
    ['01', '브랜드 철학', '알고 선택하고, 납득하며 사용하고, 끝까지 확인하는 것. Transparency.가 생각하는 투명함입니다.'],
    ['02', '정보 공개 원칙', '성분의 역할과 함량 기준을 설명합니다. 효능에는 출처와 한계를 함께 표시합니다. 확인되지 않은 내용은 확인되지 않았다고 안내하고, 정보가 바뀌면 확인일과 변경 내용을 갱신합니다.'],
    ['03', '서비스 이용 안내', '제품을 탐색하고 내 제품으로 등록하세요. 개봉일을 입력하고 사용 상태를 관리할 수 있습니다. 기록은 이 브라우저에만 저장됩니다.'],
    ['04', '계정 관리', '현재는 로그인 없이 사용하는 프로토타입입니다. 계정과 기기 간 동기화는 준비 중입니다.'],
    ['05', '정보 상태와 문의', '현재 공개되지 않았거나 확인 가능한 자료가 없는 정보는 그 이유와 확인 가능한 범위를 함께 안내합니다. 문의: ztheng@inha.edu'],
    ['06', '약관·개인정보 처리방침', '현재는 서비스 구현을 위한 임시 정책입니다. 앱의 제품 기록은 이 브라우저에 저장되며 내 제품에서 삭제할 수 있습니다. 정식 약관은 출시 전 실제 운영 방식에 맞춰 제공합니다.'],
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
  document.querySelectorAll('[data-page]').forEach(e => e.onclick = () => { page = e.dataset.page; selected = null; render(); window.scrollTo(0, 0); });
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
  document.querySelector('#back')?.addEventListener('click', () => { selected = null; page = '제품 탐색'; render(); });
  document.querySelector('#register')?.addEventListener('click', () => { if (!saved.some(s => s.id === selected.id)) saved.push({ id: selected.id, date: '', done: false }); selected = null; page = '내 제품'; persist(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-date]').forEach(e => e.onchange = () => { saved[e.dataset.date].date = e.value; persist(); });
  document.querySelectorAll('[data-done]').forEach(e => e.onclick = () => { saved[e.dataset.done].done = !saved[e.dataset.done].done; persist(); });
  document.querySelectorAll('[data-delete]').forEach(e => e.onclick = () => { if (window.confirm('등록한 제품과 사용 기록을 삭제할까요?')) { saved.splice(+e.dataset.delete, 1); persist(); } });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') document.body.classList.add('keyboard-navigation');
});
document.addEventListener('pointerdown', () => document.body.classList.remove('keyboard-navigation'));
render();
