const products = [
  { id: 1, name: '데일리 밸런스 세럼', en: 'Daily Balance Serum', type: '세럼', ingredient: '나이아신아마이드 5%', desc: '무엇을, 얼마나 담았는지. 성분부터 살펴보세요.' },
  { id: 2, name: '베리어 컴포트 크림', en: 'Barrier Comfort Cream', type: '크림', ingredient: '세라마이드 NP 0.1%', desc: '피부에 닿는 성분과 사용법을 확인하세요.' },
  { id: 3, name: '젠틀 리셋 클렌저', en: 'Gentle Reset Cleanser', type: '클렌저', ingredient: '판테놀 1%', desc: '매일 사용하는 제품, 그 안쪽까지 알아보세요.' },
];
let page = '홈', query = '', filter = '전체', selected = null, tab = '성분·함량';
let saved = JSON.parse(localStorage.getItem('transparency-products') || '[]');
const arrow = '<span aria-hidden="true">↗</span>';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function bottle(p) {
  if (p.type === '세럼') return '<div class="bottle-scene flask-scene"><img src="/images/transparency-glass.svg" alt="투명한 플라스크형 세럼 용기 콘셉트 일러스트" loading="lazy"></div>';
  return `<div class="bottle-scene" aria-hidden="true"><div class="bottle ${p.type === '크림' ? 'jar' : 'cleanser'}"><div class="cap"></div><div class="label"><strong>Transparency.</strong><span>${p.en.replaceAll(' ', '<br>')}</span><small>${p.ingredient}<br>30 mL / 1.01 fl. oz.</small></div><div class="graduations"><i></i><i></i><i></i></div></div></div>`;
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
    <footer><div><button class="logo" data-page="홈">Transparency.</button><p>성분에 장난 없이.</p></div><div class="footer-links"><button data-page="더보기">브랜드 소개 ${arrow}</button><button data-page="더보기">이용 안내 · 개인정보</button></div><small>© 2026 Transparency.<br>프로토타입 · 제품 및 성분 수치는 예시입니다.</small></footer>`;
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
  return `<button class="product" data-id="${p.id}" aria-label="${p.name} 상세 보기"><div class="product-image">${bottle(p)}<span class="badge">${p.type}</span><span class="round-arrow" aria-hidden="true">↗</span></div><div class="product-meta"><span>${p.en}</span><span>30 mL</span></div><h3>${p.name}</h3><p>${p.ingredient}<span>성분 확인 ${arrow}</span></p></button>`;
}

function productResults(list) {
  return list.map(card).join('') || '<div class="empty"><span class="eyebrow">NO RESULTS</span><h2>일치하는 제품이 없어요.</h2><p>다른 검색어로 찾아보거나 필터를 초기화해 보세요.</p><button class="text-btn" id="reset-search">검색·필터 초기화 ↗</button></div>';
}

function matchingProducts() {
  return products.filter(p => (filter === '전체' || filter === p.type) && (p.name + p.ingredient).includes(query));
}

function explore() {
  const list = matchingProducts();
  return `<section class="section page-section"><div class="eyebrow">EXPLORE / THE FORMULAS</div><h1 class="page-title">성분에 장난 없이.</h1><p class="page-intro">궁금했던 성분부터, 제품의 근거와 사용법까지.</p><div class="search-field"><label class="sr-only" for="search">제품명 또는 성분명</label><input id="search" type="search" placeholder="제품명 또는 성분명으로 검색" value="${escape(query)}"><span aria-hidden="true">⌕</span></div><div class="explore-toolbar"><div class="filters" aria-label="제품 종류 필터">${['전체', '세럼', '크림', '클렌저'].map(x => `<button data-filter="${x}" aria-pressed="${filter === x}" class="${filter === x ? 'chosen' : ''}">${x}</button>`).join('')}</div><span class="result-count">${String(list.length).padStart(2, '0')} PRODUCTS</span></div><div class="cards">${productResults(list)}</div></section>`;
}

function detail() {
  const p = selected;
  const contents = {
    '성분·함량': `<span class="eyebrow">01 / INGREDIENTS</span><h2>무엇을, 얼마나 담았는지.</h2><div class="ingredient-row"><h3>${p.ingredient}</h3><span>핵심 성분 · 예시</span></div><p>핵심 성분과 함량을 확인하는 화면입니다. 실제 전성분과 함량 설정 이유는 출시 제품 자료가 연결되면 확인할 수 있습니다.</p><div class="info-note">현재 표시된 제품과 성분 수치는 프로토타입을 위한 예시입니다.</div>`,
    '효능·근거': '<span class="eyebrow">02 / EVIDENCE</span><h2>확인된 만큼만, 정확하게.</h2><p>현재는 데모 제품으로, 완제품 시험 결과나 검증된 연구 자료가 등록되지 않았습니다.</p><div class="info-note">등록된 근거 자료 없음 · 실제 제품의 효능을 보장하지 않습니다.</div>',
    '사용 안내': '<span class="eyebrow">03 / HOW TO USE</span><h2>첫 사용부터, 마지막 한 방울까지.</h2><div class="guide-grid"><div><span class="number">01</span><h3>사용 순서와 사용량</h3><p>제품 라벨의 사용법과 적정량을 확인하세요. 자극이 발생하면 사용을 중단하세요.</p></div><div><span class="number">02</span><h3>사용 후 분리배출</h3><p>용기의 재질 표기를 확인하고 내용물을 비운 뒤 지역 분리배출 기준을 따라주세요.</p></div></div>',
    '질문하기': '<span class="eyebrow">04 / QUESTIONS</span><h2>궁금한 것은, 남김없이.</h2><details><summary>개봉일은 어디에서 관리하나요?</summary><p>내 제품에 등록하면 개봉일과 사용 상태를 관리할 수 있습니다.</p></details><div class="info-note">AI 질문과 근거 검색은 준비 중입니다.</div>',
  };
  return `<section class="section page-section"><button id="back" class="text-btn">← 제품 목록</button><div class="detail-top"><div class="detail-image">${bottle(p)}<span class="image-caption">TRANSPARENCY. / PRODUCT CONCEPT</span></div><div class="detail-copy"><div class="eyebrow">${p.en.toUpperCase()}</div><h1 class="page-title">${p.name}</h1><p class="page-intro">${p.desc}</p><dl class="product-specs"><div><dt>핵심 성분</dt><dd>${p.ingredient}</dd></div><div><dt>종류 · 용량</dt><dd>${p.type} · 30 mL</dd></div></dl><button class="dark" id="register">내 제품에 추가 <span aria-hidden="true">＋</span></button><p class="muted">제품 정보와 이미지는 브랜드 콘셉트를 위한 예시입니다.</p></div></div><div class="tabs" role="tablist" aria-label="제품 정보">${Object.keys(contents).map(t => `<button id="tab-${t}" role="tab" aria-controls="detail-panel" aria-selected="${tab === t}" data-tab="${t}" class="${tab === t ? 'chosen' : ''}">${t}</button>`).join('')}</div><div class="info" id="detail-panel" role="tabpanel" aria-labelledby="tab-${tab}">${contents[tab]}</div></section>`;
}

function my() {
  return `<section class="section page-section"><div class="eyebrow">MY PRODUCTS</div><div class="section-head"><div><h1 class="page-title">나의 제품.<br>나의 사용 기록.</h1><p class="page-intro">개봉일부터 마지막 한 방울까지, 한눈에.</p></div><button class="dark" data-page="제품 탐색">제품 등록하기 <span aria-hidden="true">＋</span></button></div><div class="shelf-summary"><span>전체 <strong>${saved.length}</strong></span><span>사용 중 <strong>${saved.filter(s => !s.done && s.date).length}</strong></span><span>미개봉 <strong>${saved.filter(s => !s.done && !s.date).length}</strong></span><span>사용 완료 <strong>${saved.filter(s => s.done).length}</strong></span></div><div class="my-list">${saved.map((s, i) => {
    const p = products.find(p => p.id === s.id);
    return `<article class="my-row"><button class="my-product-image" data-id="${p.id}" aria-label="${p.name} 정보 보기">${bottle(p)}</button><div class="my-product-copy"><span class="status-badge">${s.done ? '사용 완료' : s.date ? '사용 중' : '미개봉'}</span><h2>${p.name}</h2><span class="product-english">${p.en} / 30 mL</span><label class="date-label">개봉일 <input aria-label="${p.name} 개봉일" type="date" data-date="${i}" value="${escape(s.date || '')}"></label><span class="date-hint">개봉일을 비워두면 미개봉으로 기록됩니다.</span></div><div class="my-actions"><button data-done="${i}">${s.done ? '사용 중으로 변경' : '사용 완료'} ${arrow}</button><button data-delete="${i}" class="delete-btn">등록 삭제</button></div></article>`;
  }).join('') || '<div class="empty"><div class="empty-mark" aria-hidden="true">＋</div><span class="eyebrow">YOUR DAILY RECORD</span><h2>첫 제품을 등록해 보세요.</h2><p>개봉일부터 사용 완료까지,<br>나의 제품을 투명하게 기록하세요.</p><button data-page="제품 탐색" class="text-btn">등록할 제품 찾기 ↗</button></div>'}</div><p class="storage-note">제품 기록은 현재 사용 중인 브라우저에 저장됩니다.</p></section>`;
}

function more() {
  return `<section class="section page-section"><div class="about-banner"><span class="eyebrow">ABOUT TRANSPARENCY.</span><h1 class="page-title">가릴 것이 없으니까.</h1><div class="about-logo">Transparency.</div><p>궁금했던 성분부터, 나에게 맞는 사용법까지.<br>극도의 투명함, 손안에서.</p><div class="glass-orb" aria-hidden="true"></div></div><div class="about-list">${[
    ['01', '브랜드 철학', '성분에 장난 없이. 무엇을 담았는지, 왜 그만큼 담았는지, 어떻게 사용하는지. 제품에 대한 궁금함을 확인할 수 있는 정보로 전합니다.'],
    ['02', '정보 공개 원칙', '성분·함량과 출처를 공개하고, 확인되지 않은 효능은 주장하지 않습니다. 확인할 수 없는 정보는 그 상태와 이유를 알립니다.'],
    ['03', '서비스 이용 안내', '제품을 탐색하고 내 제품으로 등록하세요. 개봉일을 입력하고 사용 상태를 관리할 수 있습니다. 기록은 이 브라우저에만 저장됩니다.'],
    ['04', '계정 관리', '현재는 로그인 없이 사용하는 프로토타입입니다. 계정과 기기 간 동기화는 준비 중입니다.'],
    ['05', '약관·개인정보 처리방침', '앱의 제품 기록 기능은 입력한 기록을 브라우저에 저장합니다. 내 제품에서 기록을 삭제할 수 있습니다. 정식 이용약관과 개인정보 처리방침은 서비스 출시 전 제공됩니다.'],
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
  bindSearchReset();
  document.querySelector('#back')?.addEventListener('click', () => { selected = null; page = '제품 탐색'; render(); });
  document.querySelector('#register')?.addEventListener('click', () => { if (!saved.some(s => s.id === selected.id)) saved.push({ id: selected.id, date: '', done: false }); selected = null; page = '내 제품'; persist(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-date]').forEach(e => e.onchange = () => { saved[e.dataset.date].date = e.value; persist(); });
  document.querySelectorAll('[data-done]').forEach(e => e.onclick = () => { saved[e.dataset.done].done = !saved[e.dataset.done].done; persist(); });
  document.querySelectorAll('[data-delete]').forEach(e => e.onclick = () => { if (window.confirm('등록한 제품과 사용 기록을 삭제할까요?')) { saved.splice(+e.dataset.delete, 1); persist(); } });
}
render();
