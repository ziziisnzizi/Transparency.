import {
  getProductResearch,
  getResearchIngredients,
  getInformationCoverage,
  INFORMATION_CHECKS,
  RESEARCH_CHECKED_AT,
} from './evidence-data.js';

const states = new Map();
const bindings = new WeakMap();
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const valueText = value => Array.isArray(value) ? value.map(item => String(item ?? '')).join(', ') : String(value ?? '');
const sourceHosts = new Set([
  'doi.org', 'pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov',
  'www.kci.go.kr', 'kci.go.kr', 'scienceon.kisti.re.kr',
  'koreascience.kr', 'www.koreascience.or.kr', 'koreascience.or.kr',
  'www.dbpia.co.kr', 'dbpia.co.kr', 'www.riss.kr', 'riss.kr',
  'link.springer.com', 'onlinelibrary.wiley.com', 'academic.oup.com',
  'www.sciencedirect.com', 'sciencedirect.com', 'journals.sagepub.com',
  'www.tandfonline.com', 'tandfonline.com', 'www.mdpi.com', 'mdpi.com',
  'www.nature.com', 'nature.com', 'www.frontiersin.org', 'frontiersin.org',
]);

function sourceUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && sourceHosts.has(url.hostname) ? url.href : '';
  } catch {
    return '';
  }
}

function idFor(product) {
  return `product-evidence-${String(product.slug ?? product.id ?? 'product').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100)}`;
}

function productData(product) {
  const research = getProductResearch(product.slug);
  const ingredients = getResearchIngredients(product.slug);
  return {
    papers: Array.isArray(research) ? research : [],
    ingredients: Array.isArray(ingredients) ? ingredients : [],
  };
}

function stateFor(product, ingredients) {
  const key = String(product.slug ?? product.id ?? 'product');
  if (!states.has(key)) states.set(key, { ingredient: 'all', origin: 'all', methodsOpen: false });
  const state = states.get(key);
  if (state.ingredient !== 'all' && !ingredients.some(ingredient => ingredient.id === state.ingredient)) state.ingredient = 'all';
  if (!['all', 'domestic', 'international'].includes(state.origin)) state.origin = 'all';
  return state;
}

function coverageFor(papers) {
  const coverage = getInformationCoverage(papers);
  const percent = typeof coverage?.percent === 'number' && Number.isFinite(coverage.percent) ? Math.max(0, Math.min(100, coverage.percent)) : null;
  return {
    percent: papers.length ? percent : null,
    confirmed: Number.isInteger(coverage?.confirmed) && coverage.confirmed >= 0 ? coverage.confirmed : 0,
    total: Number.isInteger(coverage?.total) && coverage.total >= 0 ? coverage.total : 0,
  };
}

function metricCards(ingredients, papers) {
  return ingredients.map(ingredient => {
    const connected = papers.filter(paper => Array.isArray(paper.ingredientIds) && paper.ingredientIds.includes(ingredient.id));
    const coverage = coverageFor(connected);
    const known = coverage.percent !== null;
    const studyTypes = ['인체시험', '체외시험', '문헌고찰'].map(type => ({ type, count: connected.filter(paper => paper.studyType === type).length })).filter(item => item.count);
    return `<article class="evidence-ingredient">
      <div class="evidence-ingredient-head"><h3>${escape(ingredient.name)}</h3><span>${escape(ingredient.concentration)}</span></div>
      <p class="evidence-metric-label">${known ? '연구 정보 확인율' : '확인 자료 없음'}</p>
      <div class="evidence-metric"><strong>${known ? escape(coverage.percent) : '—'}</strong>${known ? '<span>%</span>' : ''}</div>
      <div class="evidence-meter" aria-hidden="true"><span style="width:${known ? coverage.percent : 0}%"></span></div>
      <p class="evidence-metric-count">${known ? `정보 ${coverage.confirmed}/${coverage.total}개 항목 확인 · 논문 ${connected.length}편` : '현재 확인한 연결 논문이 없습니다.'}</p>
      ${studyTypes.length ? `<p class="evidence-study-types">${studyTypes.map(item => `${escape(item.type)} ${item.count}편`).join(' · ')}</p>` : ''}
      <p class="evidence-metric-limit">효과·안전성 보장률이 아닙니다.</p>
    </article>`;
  }).join('');
}

function methods(state, papers) {
  const coverage = coverageFor(papers);
  return `<details class="evidence-methods" data-evidence-methods ${state.methodsOpen ? 'open' : ''}>
    <summary><span>연구 정보 확인율은 어떻게 계산하나요?</span><span class="evidence-expand" aria-hidden="true">＋</span></summary>
    <div class="evidence-methods-body">
      <p>논문마다 아래 6개 항목의 정보가 확인되는지 살펴봅니다. 각 항목의 비중은 같으며, 미확인 항목은 확인 수에 포함하지 않습니다.</p>
      <ol>${INFORMATION_CHECKS.map(check => `<li><strong>${escape(check.label)}</strong><span>${escape(check.description)}</span></li>`).join('')}</ol>
      <p class="evidence-equation">확인율 = 확인한 항목 수 ÷ (연결 논문 수 × 6) × 100</p>
      <p>예를 들어 성분에 연결된 논문이 2편이면 총 12개 항목을 확인합니다. 현재 이 제품에 연결된 전체 논문에서는 ${coverage.total ? `${coverage.confirmed}/${coverage.total}개 항목을 확인했습니다.` : '확인할 자료가 없습니다.'}</p>
      <p class="evidence-methods-limit"><strong>정보의 기재·확인 범위를 나타냅니다.</strong> 연구의 질, 효과의 크기, 제품에 효과가 있을 확률을 점수로 매기지 않습니다. 인체시험·체외시험·문헌고찰은 대상과 방법이 달라 이 비율로 서로의 우수성을 비교할 수 없습니다.</p>
    </div>
  </details>`;
}

function filterButton(attribute, value, label, selected) {
  return `<button type="button" ${attribute}="${escape(value)}" aria-pressed="${selected}">${escape(label)}</button>`;
}

function filters(state, ingredients) {
  return `<div class="evidence-filters" aria-label="연구 목록 필터">
    <div class="evidence-filter-group"><span>성분</span><div role="group" aria-label="성분별 연구 보기">${filterButton('data-evidence-ingredient', 'all', '전체 성분', state.ingredient === 'all')}${ingredients.map(ingredient => filterButton('data-evidence-ingredient', ingredient.id, ingredient.name, state.ingredient === ingredient.id)).join('')}</div></div>
    <div class="evidence-filter-group"><span>연구 구분</span><div role="group" aria-label="국내·해외 연구 보기">${filterButton('data-evidence-origin', 'all', '전체 연구', state.origin === 'all')}${filterButton('data-evidence-origin', 'domestic', '국내 연구', state.origin === 'domestic')}${filterButton('data-evidence-origin', 'international', '해외 연구', state.origin === 'international')}</div></div>
    <p class="evidence-filter-note">분류는 각 논문에 표시된 연구진·학술지 정보를 참고하며, 연구의 질을 구분하는 기준은 아닙니다. 필터는 아래 논문 목록에만 적용됩니다.</p>
  </div>`;
}

function paperCard(paper) {
  return `<article class="evidence-paper">
    <div class="evidence-paper-meta"><span>${escape(paper.originLabel)}</span><span>${escape(paper.studyType)}</span><span>${escape(paper.year)}</span></div>
    <h3>${escape(paper.koreanTitle)}</h3>
    <p class="evidence-paper-summary">${escape(paper.summary)}</p>
    <p class="evidence-paper-journal">${escape(paper.journal)}</p>
    <button type="button" class="evidence-paper-open" data-evidence-paper="${escape(paper.id)}"><span>연구 자세히 보기</span><span aria-hidden="true">↗</span></button>
  </article>`;
}

function selectedPapers(state, papers) {
  return papers.filter(paper => (state.ingredient === 'all' || paper.ingredientIds?.includes(state.ingredient)) && (state.origin === 'all' || paper.origin === state.origin));
}

function content(product, state, data) {
  const papers = selectedPapers(state, data.papers);
  return `<div class="evidence-heading"><span class="eyebrow">02 / EVIDENCE</span><h2 id="${idFor(product)}-heading">성분 연구, 확인한 만큼 투명하게.</h2><p>담긴 성분에 관한 연구의 내용과 한계를 한국어로 살펴보세요.</p></div>
    <div class="evidence-finished-note"><strong>공개된 완제품 시험 자료가 없습니다.</strong><p>아래 자료는 성분 또는 연구용 제형에 관한 연구입니다. ${escape(product.name)}의 완제품 효과를 입증한 결과가 아니며, 함량·원료 특성·배합·사용 조건에 따라 적용 범위가 달라집니다.</p></div>
    <div class="evidence-ingredient-grid" aria-label="성분별 연구 정보 확인율">${metricCards(data.ingredients, data.papers)}</div>
    ${methods(state, data.papers)}
    <div class="evidence-list-heading"><h3>연결된 연구 살펴보기</h3><p>제목을 한국어로 안내하고 원문 서지 정보를 함께 제공합니다.</p></div>
    ${filters(state, data.ingredients)}
    <div class="evidence-results-status" role="status" aria-live="polite" aria-atomic="true">전체 ${data.papers.length}편 중 ${papers.length}편 표시</div>
    ${papers.length ? `<div class="evidence-paper-grid">${papers.map(paperCard).join('')}</div>` : '<div class="evidence-empty"><h3>이 조건에 맞는 연구가 없습니다.</h3><p>다른 성분이나 연구 구분을 선택해 보세요.</p><button type="button" data-evidence-reset>필터 초기화 <span aria-hidden="true">↗</span></button></div>'}
    <p class="evidence-checked-date">자료 확인일 ${escape(RESEARCH_CHECKED_AT)}</p>
    <dialog class="evidence-dialog" aria-labelledby="${idFor(product)}-dialog-title"><div class="evidence-dialog-content" data-evidence-dialog-content></div></dialog>`;
}

function listItems(values) {
  const entries = Array.isArray(values) ? values : values ? [values] : [];
  return entries.length ? `<ul>${entries.map(value => `<li>${escape(value)}</li>`).join('')}</ul>` : '<p>현재 확인한 자료에 포함되어 있지 않습니다.</p>';
}

function detailContent(product, paper) {
  const url = sourceUrl(paper.url);
  const authors = valueText(paper.authors);
  return `<div class="evidence-dialog-top"><span>연구 상세</span><button type="button" class="evidence-dialog-close" data-evidence-close autofocus>닫기 <span aria-hidden="true">×</span></button></div>
    <div class="evidence-paper-meta"><span>${escape(paper.originLabel)}</span><span>${escape(paper.studyType)}</span><span>${escape(paper.year)}</span><span>${escape(paper.access)}</span></div>
    <h2 id="${idFor(product)}-dialog-title" tabindex="-1">${escape(paper.koreanTitle)}</h2>
    <p class="evidence-detail-summary">${escape(paper.summary)}</p>
    <section class="evidence-detail-section" aria-label="연구 방법"><h3>어떻게 연구했나요?</h3><dl><div><dt>연구 유형</dt><dd>${escape(paper.studyType)}${paper.designDetails ? `<br>${escape(paper.designDetails)}` : ''}</dd></div><div><dt>대상·표본 또는 모델</dt><dd>${escape(paper.population || '현재 확인한 자료에 포함되어 있지 않습니다.')}</dd></div><div><dt>농도·사용 조건</dt><dd>${escape(paper.intervention || '현재 확인한 자료에 포함되어 있지 않습니다.')}</dd></div><div><dt>비교·대조 조건</dt><dd>${escape(paper.comparator || '현재 확인한 자료에 포함되어 있지 않습니다.')}</dd></div></dl></section>
    <section class="evidence-detail-section"><h3>어떤 결과를 관찰했나요?</h3>${listItems(paper.results)}</section>
    <section class="evidence-detail-section evidence-detail-limit"><h3>어디까지 해석할 수 있나요?</h3>${listItems(paper.limitations)}</section>
    <section class="evidence-detail-section evidence-detail-scope"><h3>${escape(product.name)}에 적용할 때</h3><p>${escape(paper.productScope || '성분 연구를 이 제품의 완제품 시험 결과로 해석할 수 없습니다.')}</p></section>
    <section class="evidence-detail-section"><h3>확인된 연구 정보</h3><ul class="evidence-check-list">${INFORMATION_CHECKS.map(check => `<li><span>${escape(check.label)}</span><strong>${paper.checks?.[check.key] === true ? '확인됨' : '미확인'}</strong></li>`).join('')}</ul>${paper.verificationNote ? `<p class="evidence-verification-note">${escape(paper.verificationNote)}</p>` : ''}<p class="evidence-detail-metric-note">항목 확인은 연구의 우수성이나 효과·안전성을 보장하지 않습니다.</p></section>
    <section class="evidence-detail-section evidence-original"><h3>원문 서지 정보</h3><p class="evidence-original-title" lang="${paper.language === 'ko' ? 'ko' : 'en'}">${escape(paper.originalTitle)}</p><p>${escape(authors)}${authors ? ' · ' : ''}${escape(paper.year)}<br>${escape(paper.journal)}</p>${paper.doi ? `<p>DOI: ${escape(paper.doi)}</p>` : ''}${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${paper.access === '원문 공개' ? '원문 보기' : '초록 보기'} <span aria-hidden="true">↗</span><span class="sr-only"> (새 창)</span></a>` : '<p>현재 확인 가능한 원문 링크가 없습니다.</p>'}<p class="evidence-checked-date">자료 확인일 ${escape(RESEARCH_CHECKED_AT)}</p></section>`;
}

export function renderResearchDetail(paper) {
  return detailContent({ slug: 'concern-research', name: '제품' }, {
    ...paper,
    productScope: `${paper.applicationNote || ''} 현재 공개된 Transparency. 완제품 시험 결과는 없습니다. 성분이나 연구용 제형의 결과가 제품의 효과·안전성을 보장하지 않습니다.`,
  });
}

export function renderProductEvidence(product) {
  const data = productData(product);
  const state = stateFor(product, data.ingredients);
  return `<section class="product-evidence" id="${idFor(product)}" aria-labelledby="${idFor(product)}-heading">${content(product, state, data)}</section>`;
}

export function bindProductEvidence(product) {
  const root = document.getElementById(idFor(product));
  if (!root || bindings.has(root)) return;
  const data = productData(product);
  const state = stateFor(product, data.ingredients);
  let activeDialog = null;
  let trigger = null;
  let releaseScroll = null;
  let observer = null;

  function unlockScroll() {
    releaseScroll?.();
    releaseScroll = null;
  }

  function closeDialog(restoreFocus = true) {
    const dialog = activeDialog;
    activeDialog = null;
    if (dialog?.open) dialog.close();
    unlockScroll();
    if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  }

  function openDialog(paper, button) {
    closeDialog(false);
    const dialog = root.querySelector('.evidence-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    dialog.querySelector('[data-evidence-dialog-content]').innerHTML = detailContent(product, paper);
    trigger = button;
    activeDialog = dialog;
    try {
      dialog.showModal();
    } catch {
      activeDialog = null;
      trigger = null;
      return;
    }
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    releaseScroll = () => {
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = bodyOverflow;
      if (document.documentElement.style.overflow === 'hidden') document.documentElement.style.overflow = htmlOverflow;
    };
    dialog.scrollTop = 0;
    dialog.querySelector('[data-evidence-close]')?.focus({ preventScroll: true });
  }

  function refresh(attribute, selected) {
    state.methodsOpen = root.querySelector('[data-evidence-methods]')?.open || false;
    closeDialog(false);
    root.innerHTML = content(product, state, data);
    const focus = Array.from(root.querySelectorAll(`[${attribute}]`)).find(button => button.getAttribute(attribute) === selected);
    focus?.focus({ preventScroll: true });
  }

  root.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-evidence-close]')) return closeDialog();
    const dialog = target.closest('.evidence-dialog');
    if (dialog && target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
      return;
    }
    const paperButton = target.closest('[data-evidence-paper]');
    if (paperButton) {
      const paper = data.papers.find(item => item.id === paperButton.dataset.evidencePaper);
      if (paper) openDialog(paper, paperButton);
      return;
    }
    const ingredient = target.closest('[data-evidence-ingredient]');
    if (ingredient) {
      state.ingredient = ingredient.dataset.evidenceIngredient;
      refresh('data-evidence-ingredient', state.ingredient);
      return;
    }
    const origin = target.closest('[data-evidence-origin]');
    if (origin) {
      state.origin = origin.dataset.evidenceOrigin;
      refresh('data-evidence-origin', state.origin);
      return;
    }
    if (target.closest('[data-evidence-reset]')) {
      state.ingredient = 'all';
      state.origin = 'all';
      refresh('data-evidence-ingredient', 'all');
    }
  });

  root.addEventListener('toggle', event => {
    if (event.target instanceof HTMLDetailsElement && event.target.hasAttribute('data-evidence-methods') && event.target.isConnected) state.methodsOpen = event.target.open;
  }, true);
  root.addEventListener('close', event => {
    if (event.target === activeDialog) closeDialog();
  }, true);
  root.addEventListener('cancel', event => {
    if (event.target === activeDialog) {
      event.preventDefault();
      closeDialog();
    }
  }, true);

  observer = new MutationObserver(() => {
    if (root.isConnected) return;
    closeDialog(false);
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  bindings.set(root, { close: closeDialog });
}
