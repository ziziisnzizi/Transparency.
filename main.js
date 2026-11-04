import { renderProductQuestions, bindProductQuestions } from './questions.js';
import { renderProductEvidence, bindProductEvidence } from './evidence.js';
import { products, purchasePricing } from './products.js';
import { orderProductsByRoutine } from './catalog.js';
import { getReviewSummary, renderProductReviews, bindProductReviews, REVIEW_STORAGE_KEY } from './reviews.js';
import { renderPurchase, bindPurchase, formatPurchasePrice } from './purchase.js';
import { renderConcerns, bindConcerns, seedConcernSearch } from './concerns.js';
import { mountAmbientBackground } from './ambient-background.js';
import { siteEffectsConfig } from './site-effects-config.js';
import { mountSiteTextEffects } from './site-text-effects.js';



const navPages = ['홈', '제품 탐색', '내 고민', '내 제품', '더보기'];
const initialUrl = new URL(window.location.href);
// Old shared links now open the actual home, with the same service navigation.
if (initialUrl.searchParams.get('view') === 'landing') {
  initialUrl.searchParams.delete('view');
  window.history.replaceState({ page: '홈' }, '', `${initialUrl.pathname}${initialUrl.search}${initialUrl.hash}`);
}
const initialView = initialUrl.searchParams.get('view');
let disposeTextEffects = null, disposeAmbientBackground = null;
let page = initialView === 'concerns' ? '내 고민' : '홈', query = '', filter = '전체', selected = null, tab = '성분·함량';
let isPurchase = initialView === 'buy';
let theme = localStorage.getItem('transparency-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;
const requestedProduct = new URLSearchParams(window.location.search).get('product');
selected = initialView === 'concerns' ? null : products.find(product => product.slug === requestedProduct) || null;
if (isPurchase && !selected) selected = orderProductsByRoutine(products)[0];
if (selected) page = '제품 탐색';
let saved = JSON.parse(localStorage.getItem('transparency-products') || '[]');
const catalogVersion = '2026-10-27-three-concepts';
if (localStorage.getItem('transparency-catalog-version') !== catalogVersion) {
  saved = saved.filter(item => item.id === 1);
  localStorage.setItem('transparency-products', JSON.stringify(saved));
  localStorage.setItem('transparency-catalog-version', catalogVersion);
}
const arrow = '<span aria-hidden="true">↗</span>';
const logoMark = 'Transparency.';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const imageViews = new Map();

function bottle(p) {
  const view = imageViews.get(p.slug) || 'auto';
  const textureShown = view === 'texture';
  const action = textureShown ? '제품 보기' : '제형 보기';
  return `<div class="bottle-scene product-visual" data-product-visual="${p.slug}" data-image-view="${view}"><img class="product-packshot" src="${p.image}" alt="${p.name} 제품 이미지" aria-hidden="${textureShown}" width="${p.imageWidth}" height="${p.imageHeight}" loading="${selected?.id === p.id ? 'eager' : 'lazy'}" decoding="async"><img class="product-texture" src="${p.textureImage}" alt="${p.name} ${p.texture} 제형 이미지" aria-hidden="${!textureShown}" width="1536" height="1024" loading="lazy" decoding="async"><button type="button" class="texture-toggle" data-texture-toggle="${p.slug}" aria-label="${p.name} ${action}"><span aria-hidden="true">◐</span><span class="texture-toggle-label">${action}</span></button></div>`;
}

const navIcons = {
  '홈': '<path d="m3 10 9-7 9 7v10H5V10m4 10v-7h6v7"/>',
  '제품 탐색': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  '내 고민': '<path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1.5-6A8 8 0 1 1 21 11Z"/><path d="M9.5 8a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/>',
  '내 제품': '<rect x="5" y="6" width="14" height="15" rx="3"/><path d="M9 6V3h6v3m-6 6h6m-6 4h4"/>',
  '더보기': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};

function render() {
  disposeTextEffects?.(); disposeTextEffects = null;
  document.querySelector('#app').innerHTML = `
    <a class="skip-link" href="#content">본문으로 이동</a>
    <header><button class="logo" data-page="홈" aria-label="Transparency. 홈">${logoMark}</button>

      <div class="header-actions"><button class="theme-toggle" id="theme-toggle" type="button" aria-label="${theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}" aria-pressed="${theme === 'dark'}"><span aria-hidden="true">${theme === 'dark' ? '☀' : '☾'}</span></button><button class="account" data-page="내 제품">MY PRODUCTS ${arrow}</button></div>
    </header>
      <nav aria-label="주요 메뉴">${navPages.map(x => `<button ${!selected && page === x ? 'aria-current="page"' : ''} class="${page === x ? 'active' : ''}" data-page="${x}"><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[x]}</svg><span>${x}</span></button>`).join('')}</nav>
    <main id="content" tabindex="-1">${isPurchase ? renderPurchase(orderProductsByRoutine(products), selected?.slug, purchasePricing) : selected ? detail() : page === '홈' ? home() : page === '제품 탐색' ? explore() : page === '내 고민' ? renderConcerns() : page === '내 제품' ? my() : more()}</main>
    <footer><div><button class="logo" data-page="홈" aria-label="Transparency. 홈">${logoMark}</button><p>성분에 장난 없이.</p></div><div class="footer-links"><button data-buy="toner-t1">제품 구매 ${arrow}</button><button data-page="더보기">브랜드 소개 ${arrow}</button><a href="mailto:ztheng@inha.edu">ztheng@inha.edu</a></div><small>© 2026 Transparency. All rights reserved.<br>성분부터 사용법까지, 투명하게.</small></footer>`;
  bind();
  if (!disposeAmbientBackground) disposeAmbientBackground = mountAmbientBackground(document);
  disposeTextEffects = mountSiteTextEffects(document, siteEffectsConfig);
}

function home() {
  return `<section class="site-hero" data-site-poster aria-labelledby="hero-title">
    <div class="site-hero-content"><span class="site-hero-eyebrow">NOTHING TO HIDE.</span><h1 id="hero-title" class="site-hero-title" lang="ko">${siteEffectsConfig.hero.ko.map((line, index) => `<span data-site-hero-line style="--site-line-offset:${siteEffectsConfig.hero.offsets[index]}%">${escape(line)}</span>`).join('')}</h1><div class="site-hero-bottom"><p>가릴 것이 없으니까.<br>궁금했던 성분부터, 나에게 맞는 사용법까지.</p><button class="text-btn" data-page="제품 탐색">제품 살펴보기 ${arrow}</button></div></div>
  </section>
  <section class="principles" aria-label="정보 공개 원칙"><div class="principle-title">성분에<br>장난 없이.</div><div><span class="number">01 / INGREDIENTS</span><h2>무엇을 담았는지.</h2><p>성분과 함량을 확인하세요.</p></div><div><span class="number">02 / EVIDENCE</span><h2>어디까지 확인됐는지.</h2><p>근거와 그 한계까지 살펴보세요.</p></div><div><span class="number">03 / YOUR ROUTINE</span><h2>어떻게 사용하는지.</h2><p>첫 사용부터 마지막 한 방울까지.</p></div></section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">THE FORMULAS</div><h2>궁금했던 성분부터.</h2></div><button data-page="제품 탐색" class="text-btn">모든 제품 보기 ${arrow}</button></div><div class="cards">${orderProductsByRoutine(products).map(card).join('')}</div></section>
  <section class="brand-statement"><span class="eyebrow">THE TRANSPARENCY STANDARD</span><h2>보이는 것, 그 너머까지.<br>투명하게.</h2><p>성분, 함량, 근거, 그리고 사용법.<br>제품을 이해하는 데 필요한 정보를 한곳에서.</p><button data-page="더보기" class="text-btn">우리의 정보 공개 원칙 ${arrow}</button><div class="glass-orb" aria-hidden="true"></div></section>
  <section class="bottom-grid"><div><span class="eyebrow">KNOW YOUR PRODUCT</span><h2>손안에서 확인하는<br>제품의 모든 것.</h2><p>제품명과 성분명으로 궁금한 정보를 찾아보세요.</p><button data-page="제품 탐색" class="text-btn">제품 검색하기 ${arrow}</button><span class="panel-number" aria-hidden="true">01</span></div><div><span class="eyebrow">MY PRODUCTS</span><h2>나의 제품.<br>나에게 맞는 사용법.</h2><p>개봉일과 사용 상태를 기록하고 확인하세요.</p><button data-page="내 제품" class="text-btn">내 제품 관리하기 ${arrow}</button><span class="panel-number" aria-hidden="true">02</span></div></section>`;
}

function ratingSummary(p, isDetail = false) {
  const { count, average, writtenCount, exampleCount } = getReviewSummary(p.slug);
  const label = average === null ? '아직 평가 없음' : `평점 ${average.toFixed(1)}점`;
  const tag = isDetail ? 'button' : 'div';
  const attrs = isDetail ? 'type="button" id="show-reviews"' : '';
  return `<${tag} class="${isDetail ? 'detail-rating' : 'product-rating'}" ${attrs} aria-label="${p.name} ${label}, 전체 ${count}개 리뷰, 작성 ${writtenCount}개, 예시 ${exampleCount}개${isDetail ? ', 리뷰 보기' : ''}"><span aria-hidden="true">${average === null ? '☆' : '★'}</span>${average === null ? '<span class="rating-empty">아직 평가 없음</span>' : `<strong>${average.toFixed(1)}</strong>`}${isDetail ? `<span>전체 ${count}개 리뷰</span>` : `<small>전체 ${count}개 리뷰</small>`}<small class="review-count-context">작성 ${writtenCount} · 예시 ${exampleCount}</small></${tag}>`;
}

function card(p) {
  return `<article class="product"><button type="button" class="product-open" data-id="${p.id}" aria-label="${p.name} 상세 보기"></button><div class="product-image">${bottle(p)}<span class="badge">${p.type}</span><span class="round-arrow" aria-hidden="true">↗</span></div><div class="product-meta"><span>${p.en}</span><span>${p.volume}</span></div><h3>${p.name}</h3><div class="product-price">${formatPurchasePrice(p.price)}</div>${ratingSummary(p)}<p>${p.ingredient}<span>성분 확인 ${arrow}</span></p><span class="routine-step">${p.routineStep}</span></article>`;
}

function productResults(list) {
  return list.map(card).join('') || '<div class="empty"><span class="eyebrow">NO RESULTS</span><h2>일치하는 제품이 없어요.</h2><p>다른 검색어로 찾아보거나 필터를 초기화해 보세요.</p><button class="text-btn" id="reset-search">검색·필터 초기화 ↗</button></div>';
}

function matchingProducts() {
  const term = query.trim().toLocaleLowerCase('ko-KR');
  return orderProductsByRoutine(products.filter(p => (filter === '전체' || filter === p.type) && `${p.name} ${p.en} ${p.ingredient} ${p.searchTerms}`.toLocaleLowerCase('ko-KR').includes(term)));
}

function explore() {
  const list = matchingProducts();
  return `<section class="section page-section"><div class="eyebrow">EXPLORE / THE FORMULAS</div><h1 class="page-title">성분에 장난 없이.</h1><p class="page-intro">궁금했던 성분부터, 제품의 근거와 사용법까지.</p><div class="search-field"><label class="sr-only" for="search">제품명 또는 성분명</label><input id="search" type="search" placeholder="제품명 또는 성분명으로 검색" value="${escape(query)}"><span aria-hidden="true">⌕</span></div><div class="explore-toolbar"><div class="filters" aria-label="제품 종류 필터">${['전체', ...new Set(orderProductsByRoutine(products).map(product => product.type))].map(x => `<button data-filter="${x}" aria-pressed="${filter === x}" class="${filter === x ? 'chosen' : ''}">${x}</button>`).join('')}</div><span class="result-count">${String(list.length).padStart(2, '0')} PRODUCTS</span></div><div class="catalog-order-note"><span>사용 순서대로</span><p>STEP 01 토너 → STEP 02 세럼 → STEP 03 크림</p></div><div class="cards">${productResults(list)}</div></section>`;
}

function ingredientContent(p) {
  return `<span class="eyebrow">01 / INGREDIENTS</span><h2>무엇을, 얼마나 담았는지.</h2><div class="ingredient-list">${p.ingredients.map(([name, role, reason]) => `<article><div class="ingredient-row"><h3>${name}</h3><span>${role}</span></div><p>${reason}</p></article>`).join('')}</div><div class="info-note"><strong>성분표 읽는 법</strong><br>주요 성분의 함량과 역할을 함께 확인하세요. 전체 성분은 제품의 전성분 표기를 참고해 주세요. 성분의 함량만으로 제품의 효능을 판단하기는 어렵습니다.</div><p class="data-date">정보 확인일 2026.10.27</p>`;
}

function evidenceContent(p) {
  return renderProductEvidence(p);
}

function usageContent(p) {
  const packageGuide = p.kind === 'cream' ? '용기와 뚜껑의 재질을 확인해 분리합니다.' : p.kind === 'toner' ? '용기와 캡, 라벨을 분리합니다.' : '병과 스포이트 캡, 라벨을 분리합니다.';
  return `<span class="eyebrow">03 / HOW TO USE</span><h2>첫 사용부터, 마지막 한 방울까지.</h2><div class="guide-grid"><div><span class="number">01 / ROUTINE</span><h3>${p.routine}</h3><p>사용량 기준은 ${p.amount}입니다. 피부 상태와 사용감에 맞춰 양을 조절하고, 얼굴에 부드럽게 펴 바르세요.</p></div><div><span class="number">02 / STORAGE</span><h3>직사광선과 고온을 피해 보관</h3><p>사용 후 입구를 깨끗하게 유지하고 뚜껑을 닫아 보관합니다.</p></div><div><span class="number">03 / REMAINING</span><h3>용기에서 남은 양을 직접 확인</h3><p>투명 용기의 내용물 높이를 기준으로 확인합니다. 실제 사용량과 내부 잔류량에 따라 차이가 있을 수 있습니다.</p></div><div><span class="number">04 / DISPOSAL</span><h3>부품별 재질 확인 후 분리</h3><p>내용물을 최대한 사용한 뒤 ${packageGuide} 지역 수거 기준을 함께 확인해 주세요.</p></div></div><div class="info-note">사용 전 제품의 사용법과 주의사항을 확인하세요. 사용 중 피부에 이상이 생기면 사용을 멈추고 전문가와 상담하세요.</div>`;
}

function questionContent(p) {
  const faqs = [['어떤 피부 타입을 위한 제품인가요?', '매일의 수분 관리를 위한 제품입니다. 피부 타입과 현재 피부 상태에 맞춰 성분과 사용감을 확인해 주세요.'], ['1회 사용량은 얼마인가요?', `사용량 기준은 ${p.amount}입니다. 피부 상태와 함께 사용하는 제품에 맞춰 양을 조절해 주세요.`], ['민감한 피부도 사용할 수 있나요?', '피부 상태에 따라 사용감이 다를 수 있습니다. 민감성 피부 대상 시험 자료는 공개되어 있지 않으므로, 사용 전 성분을 확인하고 작은 부위에 먼저 사용해 보세요.'], ['개봉 후 언제까지 사용하나요?', '용기와 패키지에 표시된 사용기한 및 개봉 후 사용기간을 확인하세요. 내 제품에 개봉일을 기록해 관리할 수 있습니다.']];
  return `<span class="eyebrow">04 / QUESTIONS</span><h2>궁금한 것은, 남김없이.</h2>${renderProductQuestions(p)}<h3 class="faq-title">자주 묻는 질문</h3>${faqs.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}<div class="info-note">성분과 함량은 ‘성분·함량’, 자료의 출처와 적용 범위는 ‘효능·근거’에서 확인할 수 있습니다.</div>`;
}

function detail() {
  const p = selected;
  const contents = { '성분·함량': ingredientContent(p), '효능·근거': evidenceContent(p), '사용 안내': usageContent(p), '질문하기': questionContent(p), '사용자 리뷰': renderProductReviews(p) };
  return `<section class="section page-section"><button id="back" class="text-btn">← 제품 목록</button><div class="detail-top"><div class="detail-image">${bottle(p)}<span class="image-caption">TRANSPARENCY. / PRODUCT INFORMATION</span></div><div class="detail-copy"><div class="eyebrow">${p.en.toUpperCase()}</div><h1 class="page-title">${p.name}</h1><p class="detail-price">${formatPurchasePrice(p.price)}</p>${ratingSummary(p, true)}<p class="page-intro">${p.desc}</p><p>${p.longDesc}</p><dl class="product-specs"><div><dt>루틴 단계</dt><dd>${p.routineStep}</dd></div><div><dt>핵심 성분</dt><dd>${p.ingredient}</dd></div><div><dt>종류 · 용량</dt><dd>${p.type} · ${p.volume}</dd></div><div><dt>제형</dt><dd>${p.texture}</dd></div></dl><aside class="product-qr" aria-label="${p.name} 상세 페이지 QR"><img src="/images/qr/${p.slug}.svg" alt="${p.name} 상세 페이지로 연결되는 QR 코드" width="160" height="160"><div><span class="eyebrow">PRODUCT QR</span><h2>스캔해서 바로 확인.</h2><p>이 QR은 ${p.name} 상세 페이지로 직접 연결됩니다.</p><div class="qr-downloads"><a href="/images/qr/${p.slug}.svg" download="Transparency-${p.slug}-QR.svg">SVG</a><a href="/images/qr/${p.slug}.png" download="Transparency-${p.slug}-QR.png">PNG</a></div></div></aside><div class="detail-actions"><button class="dark" data-buy="${p.slug}">구매하기 ${arrow}</button><button class="text-btn" id="register">내 제품에 추가 <span aria-hidden="true">＋</span></button></div></div></div><div class="tabs" role="tablist" aria-label="제품 정보">${Object.keys(contents).map(t => `<button id="tab-${t}" role="tab" aria-controls="detail-panel" aria-selected="${tab === t}" data-tab="${t}" class="${tab === t ? 'chosen' : ''}">${t}</button>`).join('')}</div><div class="info" id="detail-panel" role="tabpanel" aria-labelledby="tab-${tab}">${contents[tab]}</div></section>`;
}

function my() {
  return `<section class="section page-section"><div class="eyebrow">MY PRODUCTS</div><div class="section-head"><div><h1 class="page-title">나의 제품.<br>나의 사용 기록.</h1><p class="page-intro">개봉일부터 마지막 한 방울까지, 한눈에.</p></div><button class="dark" data-page="제품 탐색">제품 등록하기 <span aria-hidden="true">＋</span></button></div><div class="shelf-summary"><span>전체 <strong>${saved.length}</strong></span><span>사용 중 <strong>${saved.filter(s => !s.done && s.date).length}</strong></span><span>미개봉 <strong>${saved.filter(s => !s.done && !s.date).length}</strong></span><span>사용 완료 <strong>${saved.filter(s => s.done).length}</strong></span></div><div class="my-list">${saved.map((s, i) => {
    const p = products.find(p => p.id === s.id);
    return `<article class="my-row"><div class="my-product-image"><button type="button" class="my-product-open" data-id="${p.id}" aria-label="${p.name} 정보 보기"></button>${bottle(p)}</div><div class="my-product-copy"><span class="status-badge">${s.done ? '사용 완료' : s.date ? '사용 중' : '미개봉'}</span><h2>${p.name}</h2><span class="product-english">${p.en} / ${p.volume}</span><label class="date-label">개봉일 <input aria-label="${p.name} 개봉일" type="date" data-date="${i}" value="${escape(s.date || '')}"></label><span class="date-hint">개봉일을 비워두면 미개봉으로 기록됩니다.</span></div><div class="my-actions"><button data-done="${i}">${s.done ? '사용 중으로 변경' : '사용 완료'} ${arrow}</button><button data-delete="${i}" class="delete-btn">등록 삭제</button></div></article>`;
  }).join('') || '<div class="empty"><div class="empty-mark" aria-hidden="true">＋</div><span class="eyebrow">YOUR DAILY RECORD</span><h2>첫 제품을 등록해 보세요.</h2><p>개봉일부터 사용 완료까지,<br>나의 제품을 투명하게 기록하세요.</p><button data-page="제품 탐색" class="text-btn">등록할 제품 찾기 ↗</button></div>'}</div><p class="storage-note">제품 기록은 현재 사용 중인 브라우저에 저장됩니다.</p></section>`;
}

function more() {
  return `<section class="section page-section"><div class="about-banner"><span class="eyebrow">ABOUT TRANSPARENCY.</span><h1 class="page-title">가릴 것이 없으니까.</h1><div class="about-logo">${logoMark}</div><p>궁금했던 성분부터, 나에게 맞는 사용법까지.<br>극도의 투명함, 손안에서.</p><div class="glass-orb" aria-hidden="true"></div></div><div class="about-list">${[
    ['01', '브랜드 철학', '알고 선택하고, 납득하며 사용하고, 끝까지 확인하는 것. Transparency.가 생각하는 투명함입니다.'],
    ['02', '정보 공개 원칙', '성분의 역할과 함량 기준을 설명합니다. 효능에는 출처와 한계를 함께 표시합니다. 확인되지 않은 내용은 확인되지 않았다고 안내하고, 정보가 바뀌면 확인일과 변경 내용을 갱신합니다.'],
    ['03', '서비스 이용 안내', '제품을 탐색하고 내 제품으로 등록하세요. 개봉일을 입력하고 사용 상태를 관리할 수 있습니다. 내 고민에서는 피부 고민과 사용감을 검색해 관련 연구와 외부 자료를 살펴보고, 공개된 성분·제형에 가까운 제품을 비교할 수 있습니다.'],
    ['04', '계정 관리', '회원가입 없이 제품 정보를 확인하고 사용 기록을 관리할 수 있습니다. 제품 사용 기록과 리뷰는 현재 사용하는 브라우저에 저장되며, 다른 기기와 공유되지 않습니다.'],
    ['05', '정보 상태와 문의', '현재 공개되지 않았거나 확인 가능한 자료가 없는 정보는 그 이유와 확인 가능한 범위를 함께 안내합니다. 문의: ztheng@inha.edu'],
    ['06', '개인정보·기록 관리', '제품 사용 기록과 리뷰는 현재 브라우저에 저장됩니다. 제품 기록은 내 제품에서, 리뷰는 해당 제품의 사용자 리뷰에서 삭제할 수 있습니다. 내 고민의 입력과 검색 결과는 현재 페이지 메모리에만 남으며, 새로고침하면 사라집니다. 외부 자료 연결에는 정해진 주제 코드만 서버로 전달하며 입력 문장과 리뷰를 전송하지 않습니다. 제품 상세의 AI 질문과 제품 자료는 답변 처리를 위해 서버로 전송되며, Gemini 연결 시 AI 서비스로 전달됩니다. 대화는 브라우저 저장소에 보관하지 않습니다. 서비스 이용과 개인정보 관련 문의는 안내된 이메일로 보내 주세요.'],
  ].map(([n, a, b]) => `<details><summary><span class="number">${n}</span>${a}</summary><p>${b}</p></details>`).join('')}</div></section>`;
}

function persist() {
  localStorage.setItem('transparency-products', JSON.stringify(saved));
  render();
}
function writeLocation() {
  const url = new URL(window.location.href);
  if (selected) url.searchParams.set('product', selected.slug);
  else url.searchParams.delete('product');
  if (isPurchase) url.searchParams.set('view', 'buy');
  else if (page === '내 고민') url.searchParams.set('view', 'concerns');
  else url.searchParams.delete('view');
  window.history.pushState({ page }, '', `${url.pathname}${url.search}`);
}

function openProduct(slug, purchase = false, detailTab = '성분·함량') {
  const product = products.find(item => item.slug === slug);
  if (!product) return;
  selected = product;
  page = '제품 탐색';
  isPurchase = purchase;
  if (!purchase) tab = detailTab;
  writeLocation();
  render();
  window.scrollTo(0, 0);
  if (!purchase && detailTab !== '성분·함량') {
    document.querySelector('#detail-panel')?.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -90);
  }
}

function openConcernSearch(query, options) {
  seedConcernSearch(query, options);
  selected = null;
  isPurchase = false;
  page = '내 고민';
  writeLocation();
  render();
  window.scrollTo(0, 0);
}

function bindProductLinks(root = document) {
  root.querySelectorAll('[data-id]').forEach(element => element.onclick = () => {
    const product = products.find(item => item.id == element.dataset.id);
    if (product) openProduct(product.slug);
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
  if (!isPurchase && !selected && page === '내 고민') bindConcerns({
    onProduct: slug => openProduct(slug),
    onReview: slug => openProduct(slug, false, '사용자 리뷰'),
    onEvidence: slug => openProduct(slug, false, '효능·근거'),
  });
  if (!isPurchase && selected && tab === '효능·근거') bindProductEvidence(selected);
  if (!isPurchase && selected && tab === '질문하기') bindProductQuestions(selected, {
    onRender: render,
    onSource: source => {
      if (source.section === '제품 정보') {
        document.querySelector('.detail-copy')?.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -90);
        return;
      }
      if (!['성분·함량', '효능·근거', '사용 안내'].includes(source.section)) return;
      tab = source.section;
      render();
      document.querySelector(`[data-tab="${tab}"]`)?.focus();
      document.querySelector('#detail-panel')?.scrollIntoView({ block: 'start' });
      window.scrollBy(0, -90);
    },
  });
  if (isPurchase) bindPurchase(orderProductsByRoutine(products), selected?.slug, {
    onProductChange: slug => openProduct(slug, true),
    onBack: () => openProduct(selected.slug),
    onDetail: slug => openProduct(slug),
    onRender: render,
  }, purchasePricing);
  document.querySelectorAll('[data-buy]').forEach(button => button.addEventListener('click', () => openProduct(button.dataset.buy, true)));
  if (!isPurchase && selected && tab === '사용자 리뷰') bindProductReviews(selected, render, { onConcern: openConcernSearch });
  document.querySelector('#show-reviews')?.addEventListener('click', () => {
    tab = '사용자 리뷰';
    render();
    document.querySelector('[data-tab="사용자 리뷰"]')?.focus();
  });
  document.querySelector('#theme-toggle')?.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('transparency-theme', theme);
    render();
    document.querySelector('#theme-toggle')?.focus();
  });
  document.querySelectorAll('[data-page]').forEach(e => e.onclick = () => { page = e.dataset.page; selected = null; isPurchase = false; writeLocation(); render(); window.scrollTo(0, 0); });
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
  document.querySelector('#back')?.addEventListener('click', () => { selected = null; page = '제품 탐색'; isPurchase = false; writeLocation(); render(); });
  document.querySelector('#register')?.addEventListener('click', () => { if (!saved.some(s => s.id === selected.id)) saved.push({ id: selected.id, date: '', done: false }); selected = null; page = '내 제품'; isPurchase = false; writeLocation(); persist(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-date]').forEach(e => e.onchange = () => { saved[e.dataset.date].date = e.value; persist(); });
  document.querySelectorAll('[data-done]').forEach(e => e.onclick = () => { saved[e.dataset.done].done = !saved[e.dataset.done].done; persist(); });
  document.querySelectorAll('[data-delete]').forEach(e => e.onclick = () => { if (window.confirm('등록한 제품과 사용 기록을 삭제할까요?')) { saved.splice(+e.dataset.delete, 1); persist(); } });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') document.body.classList.add('keyboard-navigation');
});
document.addEventListener('pointerdown', () => document.body.classList.remove('keyboard-navigation'));
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-texture-toggle]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const product = products.find(item => item.slug === button.dataset.textureToggle);
  if (!product) return;
  const view = button.closest('.product-visual').dataset.imageView === 'texture' ? 'product' : 'texture';
  imageViews.set(product.slug, view);
  document.querySelectorAll('[data-product-visual]').forEach(visual => {
    if (visual.dataset.productVisual !== product.slug) return;
    const textureShown = view === 'texture';
    visual.dataset.imageView = view;
    visual.querySelector('.product-packshot').setAttribute('aria-hidden', String(textureShown));
    visual.querySelector('.product-texture').setAttribute('aria-hidden', String(!textureShown));
    const toggle = visual.querySelector('.texture-toggle');
    const action = textureShown ? '제품 보기' : '제형 보기';
    toggle.querySelector('.texture-toggle-label').textContent = action;
    toggle.setAttribute('aria-label', `${product.name} ${action}`);
  });
});
window.addEventListener('storage', event => {
  if (event.key === REVIEW_STORAGE_KEY || event.key === null) render();
});
window.addEventListener('popstate', event => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'landing') {
    params.delete('view');
    window.history.replaceState({ page: '홈' }, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }
  isPurchase = params.get('view') === 'buy';
  selected = params.get('view') === 'concerns' ? null : products.find(product => product.slug === params.get('product')) || null;
  if (isPurchase && !selected) selected = orderProductsByRoutine(products)[0];
  page = selected ? '제품 탐색' : params.get('view') === 'concerns' ? '내 고민' : navPages.includes(event.state?.page) ? event.state.page : '홈';
  render();
});
render();
if (import.meta.hot) import.meta.hot.dispose(() => { disposeTextEffects?.(); disposeAmbientBackground?.(); });
