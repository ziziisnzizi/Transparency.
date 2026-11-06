import { analyzeConcern, CONCERN_QUERY_LIMIT, validateConcernQuery } from './lib/concern-search.js';
import { getConcernTopic } from './lib/concern-topics.js';
import { getWrittenReviews } from './reviews.js';
import { renderResearchDetail } from './evidence.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const list = value => Array.isArray(value) ? value : [];
const suggestions = ['세안 후 피부가 당겨요', '가벼운 제형을 찾고 싶어요', '세럼의 끈적임이 아쉬워요'];
const researchHosts = new Set(['doi.org', 'pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov', 'koreascience.kr', 'www.kci.go.kr', 'kci.go.kr']);
const bindings = new WeakSet();
const state = { draft: '', result: null, error: '', fromProductSlug: null, pendingSeed: null, version: 0, loading: false, searchTimer: null, composing: false, newsVersion: 0, news: null, newsController: null, aiVersion: 0, ai: null, aiController: null, expandedResearch: false, expandedLimitations: new Set() };

function safeUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(url.hostname) || /^(?:\d+\.)+\d+$/.test(url.hostname) || /\.(?:local|localhost|internal)$/i.test(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}

// Check the browser-parsed widget as well as the server allowlist before mounting it.
// A template is inert; only validated nodes are ever attached to the shadow root.
function suggestionFragment(html) {
  if (typeof html !== 'string' || !html.trim() || new TextEncoder().encode(html).length > 48 * 1024 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(html)) return null;
  const template = document.createElement('template');
  template.innerHTML = html;
  const tags = new Set(['div', 'span', 'a', 'style', 'svg', 'path', 'circle']);
  const common = new Set(['class', 'aria-label', 'aria-hidden', 'role', 'dir', 'lang', 'title']);
  const graphic = new Set(['viewbox', 'width', 'height', 'fill', 'stroke', 'fill-rule', 'clip-rule', 'd', 'cx', 'cy', 'r', 'xmlns']);
  const googleLink = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
        ((['google.com', 'www.google.com'].includes(url.hostname) && url.pathname === '/search') ||
         (url.hostname === 'vertexaisearch.cloud.google.com' && url.pathname.startsWith('/grounding-api-redirect/')));
    } catch { return false; }
  };
  const safeStyle = value => {
    if (value.length > 20000 || /[\\/'"<>\u0000-\u001f]/.test(value.replace(/[\r\n\t]/g, '')) || !/^[a-zA-Z0-9#.,%(){}:;@+\s_-]*$/.test(value)) return false;
    if (/(?:url|image-set|expression|binding|behavior|javascript|:host|::slotted|:has)\s*[:(]/i.test(value) || /(?:position\s*:\s*(?:fixed|sticky)|z-index\s*:)/i.test(value)) return false;
    return !value.replace(/@media\s*\(\s*prefers-color-scheme\s*:\s*(?:light|dark)\s*\)/gi, '').includes('@');
  };
  let count = 0, links = 0;
  function visit(node, insideStyle = false) {
    if (++count > 250) return false;
    if (node.nodeType === Node.TEXT_NODE) return insideStyle ? safeStyle(node.data) : !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(node.data);
    if (node.nodeType !== Node.ELEMENT_NODE || insideStyle) return false;
    const name = node.localName.toLowerCase();
    if (!tags.has(name)) return false;
    if (name === 'style' && node.attributes.length) return false;
    for (const { name: rawName, value } of node.attributes) {
      const attr = rawName.toLowerCase();
      if (common.has(attr)) { if (!/^[\p{L}\p{N}\s_.,:;!?()/-]{0,300}$/u.test(value)) return false; }
      else if (name === 'a' && attr === 'href') { if (!googleLink(value)) return false; }
      else if (name === 'a' && attr === 'target') { if (value !== '_blank') return false; }
      else if (name === 'a' && attr === 'rel') { if (!/^(?:noopener|noreferrer)(?:\s+(?:noopener|noreferrer))*$/i.test(value)) return false; }
      else if (['svg', 'path', 'circle'].includes(name) && graphic.has(attr)) {
        if (attr === 'xmlns') { if (value !== 'http://www.w3.org/2000/svg') return false; }
        else if (attr === 'd') { if (value.length > 10000 || !/^[\dEe+.,\sMmZzLlHhVvCcSsQqTtAa-]+$/.test(value)) return false; }
        else if (['fill', 'stroke'].includes(attr)) { if (!/^(?:none|currentColor|#[\da-f]{3,8})$/i.test(value)) return false; }
        else if (['fill-rule', 'clip-rule'].includes(attr)) { if (!/^(?:evenodd|nonzero)$/.test(value)) return false; }
        else if (!/^[\d.,\s-]{1,80}$/.test(value)) return false;
      } else return false;
    }
    if (name === 'a') { if (!googleLink(node.getAttribute('href'))) return false; links++; }
    return Array.from(node.childNodes).every(child => visit(child, name === 'style'));
  }
  return Array.from(template.content.childNodes).every(node => visit(node)) && links > 0 && links <= 5 ? template.content : null;
}

function mountAiSuggestions(root = document) {
  const host = root.querySelector('[data-concern-ai-suggestions]');
  if (!host || state.ai?.status !== 'ok') return;
  const fragment = suggestionFragment(state.ai.searchSuggestions);
  if (!fragment) return;
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  shadow.replaceChildren(fragment);
}

function researchUrl(value) {
  const url = safeUrl(value);
  return url && researchHosts.has(new URL(url).hostname) ? url : '';
}

function newsSearchUrl(topic) {
  return `https://news.google.com/search?q=${encodeURIComponent(topic.newsQuery)}&hl=ko&gl=KR&ceid=KR%3Ako`;
}

function displayDate(value, fallback = '발행일 미표시') {
  if (!value || !Number.isFinite(Date.parse(value))) return fallback;
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

function validArticle(article) {
  if (!article || typeof article.title !== 'string' || !article.title.trim() || typeof article.sourceName !== 'string' || !article.sourceName.trim()) return null;
  const url = safeUrl(article.url);
  const sourceUrl = safeUrl(article.sourceUrl);
  if (!url || !sourceUrl) return null;
  const targetHost = new URL(url).hostname.replace(/^www\./, '');
  const sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, '');
  if (targetHost !== 'news.google.com' && targetHost !== sourceHost && !targetHost.endsWith(`.${sourceHost}`)) return null;
  return { ...article, url, sourceUrl };
}

function searchForm() {
  return `<form class="concern-search-form" data-concern-form role="search" aria-label="내 고민 검색" novalidate>
    <div class="concern-search-bar"><span class="concern-search-icon" aria-hidden="true"></span><input id="concern-query" name="concern" type="search" maxlength="${CONCERN_QUERY_LIMIT}" value="${escape(state.draft)}" placeholder="어떤 피부 고민이 있나요?" aria-label="피부 고민 검색" aria-describedby="concern-search-hint concern-search-error" ${state.error ? 'aria-invalid="true"' : ''} autocomplete="off" enterkeyhint="search"><button type="submit" aria-label="고민 검색하기"><span aria-hidden="true">↗</span></button></div>
    <div class="concern-search-meta"><p id="concern-search-hint">AI 웹 자료 검색을 위해 입력 문장이 Gemini와 Google 검색에 전달됩니다. Google은 질문과 답변을 최대 30일 보관할 수 있습니다. 이름·연락처 등 민감한 정보는 적지 마세요.</p><output for="concern-query" data-concern-count>${state.draft.length}/${CONCERN_QUERY_LIMIT}</output></div>
    <p class="concern-search-error" id="concern-search-error" role="alert" ${state.error ? '' : 'hidden'}>${escape(state.error)}</p>
  </form>`;
}

function paperCard(paper) {
  const url = researchUrl(paper.url);
  return `<article class="concern-paper"><div class="concern-card-meta"><span>${escape(paper.studyType)}</span><span>${escape(paper.year)}</span><span>${escape(paper.originLabel)}</span></div><h4>${escape(paper.koreanTitle)}</h4><p>${escape(paper.summary)}</p><div class="concern-paper-actions"><button type="button" data-concern-paper="${escape(paper.id)}">연구 자세히 보기 <span aria-hidden="true">↗</span></button>${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(paper.koreanTitle)} 원문·초록, 새 창">원문·초록 <span aria-hidden="true">↗</span></a>` : ''}</div></article>`;
}

function findings(result) {
  const papers = list(result.research);
  const notes = list(result.findings).filter(note => !list(result.precautions).includes(note.text));
  const links = list(result.externalLinks).map(link => ({ ...link, url: safeUrl(link.url) })).filter(link => link.url);
  if (!notes.length && !list(result.precautions).length && !links.length) return '';
  return `<section class="concern-section concern-findings" aria-labelledby="concern-findings-heading"><div class="concern-section-head"><span class="eyebrow">01 / WHAT WE CAN CHECK</span><h3 id="concern-findings-heading">${notes.length ? '먼저, 확인할 수 있는 근거.' : '지금 확인할 점부터.'}</h3></div>
    ${notes.length ? `<div class="concern-findings-grid">${notes.map(note => `<article class="concern-finding ${note.kind === 'limits' ? 'concern-finding-limit' : ''}"><span class="concern-finding-kind">${note.kind === 'observed' ? '연구에서 관찰' : note.kind === 'limits' ? '해석의 한계' : '함께 볼 맥락'}</span><h4>${escape(note.title)}</h4><p>${escape(note.text)}</p>${list(note.paperIds).length ? `<div class="concern-citations">${list(note.paperIds).map(id => { const index = papers.findIndex(paper => paper.id === id); return index < 0 ? '' : `<button type="button" data-concern-paper="${escape(id)}" aria-label="관련 연구: ${escape(papers[index].koreanTitle)}">연구 ${index + 1} ↗</button>`; }).join('')}</div>` : ''}</article>`).join('')}</div>` : ''}
    ${list(result.precautions).length ? `<div class="concern-precautions"><h4>함께 확인해 주세요.</h4><ul>${result.precautions.map(text => `<li>${escape(text)}</li>`).join('')}</ul></div>` : ''}
    ${links.length ? `<div class="concern-context-links">${links.map(link => `<a href="${escape(link.url)}" target="_blank" rel="noopener noreferrer">${escape(link.label)} <span aria-hidden="true">↗</span><span class="sr-only"> (새 창)</span></a>`).join('')}</div>` : ''}
  </section>`;
}

function newsContent() {
  const topic = getConcernTopic(state.result?.newsTopic);
  if (!topic) return '';
  const news = state.news;
  const articles = list(news?.articles);
  const loading = news?.status === 'loading';
  return `<div class="concern-section-head"><span class="eyebrow">05 / OUTSIDE THE FORMULA</span><h3>관련 기사·해설</h3><p>주제에 맞춰 검토한 외부 자료를 연결합니다. 제품 효과를 입증하는 자료와는 구분해 읽어 주세요.</p></div>
    <div class="concern-news-state" role="status" aria-live="polite"><span class="concern-quiet-tag">출처 확인 자료</span><span>${loading ? '관련 자료를 불러오고 있습니다.' : articles.length ? `${articles.length}개 자료` : '관련 자료를 지금 연결하지 못했습니다.'}</span></div>
    ${loading ? '<div class="concern-news-loading"><span class="concern-loading-dot" aria-hidden="true"></span><p>확인할 수 있는 출처를 연결합니다.</p><button type="button" data-concern-news-cancel>불러오기 취소</button></div>' : articles.length ? `<div class="concern-news-grid">${articles.map(article => `<article class="concern-news-card"><div class="concern-card-meta"><span>${article.kind === 'news' ? '외부 보도' : '안내·해설'}</span><span>${escape(displayDate(article.publishedAt))}</span></div><h4><a href="${escape(article.url)}" target="_blank" rel="noopener noreferrer">${escape(article.title)} <span aria-hidden="true">↗</span><span class="sr-only"> (새 창)</span></a></h4><a class="concern-source-name" href="${escape(article.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(article.sourceName)}<span class="sr-only"> (매체·기관, 새 창)</span></a></article>`).join('')}</div>` : `<div class="concern-news-unavailable"><p>${escape(news?.notice || '연결 상태를 확인한 뒤 다시 불러오거나 외부 뉴스 검색에서 주제를 살펴볼 수 있습니다.')}</p><button type="button" data-concern-news-retry>자료 다시 불러오기 ↗</button></div>`}
    <div class="concern-news-footer">${news?.checkedAt && Number.isFinite(Date.parse(news.checkedAt)) ? `<span>자료 확인일 ${escape(displayDate(news.checkedAt, ''))}</span>` : '<span></span>'}<a href="${escape(newsSearchUrl(topic))}" target="_blank" rel="noopener noreferrer">뉴스에서 더 찾아보기 <span aria-hidden="true">↗</span><span class="sr-only"> (새 창)</span></a></div>`;
}

function aiContent() {
  const ai = state.ai || { status: 'idle' };
  const sources = list(ai.sources);
  return `<div class="concern-section-head"><span class="eyebrow">03 / AI WEB SEARCH</span><h3 id="concern-ai-heading">AI와 함께 웹 자료 살펴보기</h3><p>검색한 자료를 Gemini가 정리합니다. 출처와 작성 시점을 직접 확인해 주세요.</p></div>
    ${ai.status === 'loading' ? '<div class="concern-ai-state" role="status" aria-live="polite"><span class="concern-loading-dot" aria-hidden="true"></span><p>관련 웹 자료를 찾고 내용을 정리하고 있습니다.</p><button type="button" data-concern-ai-cancel>요청 중단</button></div>' : ai.status === 'ok' ? `<div class="concern-ai-answer"><div class="concern-ai-label">${ai.sourceMode === 'research' ? '공개 연구자료 검색 기반 AI 요약' : 'Google 웹 검색 기반 AI 요약'}</div>${ai.sourceMode === 'research' ? '<p class="concern-ai-origin">Europe PMC에서 찾은 공개 연구자료를 바탕으로 정리합니다.</p>' : ''}<p>${escape(ai.answer)}</p>${ai.sourceMode === 'google' ? '<div class="concern-ai-suggestions" data-concern-ai-suggestions aria-label="Google 검색 제안"></div>' : ''}<div class="concern-ai-sources"><h4>${ai.sourceMode === 'research' ? '참고한 공개 연구자료' : '참고한 웹 자료'}</h4><ul>${sources.map(source => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title)} <span aria-hidden="true">↗</span><span class="sr-only"> (새 창)</span></a></li>`).join('')}</ul></div><p class="concern-ai-limit">AI의 요약은 오류가 있을 수 있으며, 진단이나 제품의 효과를 입증하는 결과가 아닙니다.</p></div>` : `<div class="concern-ai-state concern-ai-unavailable" role="status" aria-live="polite"><p>${escape(ai.status === 'idle' ? 'AI 웹 자료 검색은 질문 내용을 Gemini와 Google 검색에 전달합니다.' : ai.message || '지금 AI 웹 자료를 확인하지 못했습니다. 기존 자료와 제품 정보는 계속 볼 수 있습니다.')}</p><button type="button" data-concern-ai-retry>${ai.status === 'idle' ? 'AI 웹 자료 확인하기' : 'AI 웹 자료 다시 찾기'} <span aria-hidden="true">↗</span></button></div>`}`;
}

function productCatalog(result) {
  const products = list(result.catalog).filter(product => product?.slug);
  if (!products.length) return '';
  return `<section class="concern-section concern-products concern-catalog" aria-labelledby="concern-products-heading"><div class="concern-section-head"><span class="eyebrow">04 / OUR PRODUCTS</span><h3 id="concern-products-heading">자사 제품 정보 살펴보기</h3><p>아래는 제품의 일반 정보입니다. 질문하신 조건에 맞거나 피부에 적합하다고 확인한 결과는 아니며, 질환의 치료 효과를 의미하지 않습니다. 알려진 알레르기 성분이 포함된 제품은 사용하지 마시고 전성분을 확인해 주세요.</p></div><div class="concern-product-grid concern-catalog-grid">${products.map(product => `<article class="concern-product"><span class="concern-choice-label">제품 정보</span><div class="concern-product-head"><div><span>${escape(product.type)} · ${escape(product.volume)}</span><h4>${escape(product.name)}</h4></div>${product.image ? `<img src="${escape(product.image)}" alt="" width="72" height="88" loading="lazy">` : ''}</div><dl><div><dt>제형</dt><dd>${escape(product.texture)}</dd></div><div><dt>주요 성분·함량</dt><dd>${escape(product.ingredient)}</dd></div></dl><div class="concern-product-actions"><button type="button" data-concern-product="${escape(product.slug)}">제품 정보·전성분 확인 <span aria-hidden="true">↗</span></button></div></article>`).join('')}</div></section>`;
}

function recommendations(result) {
  const entries = result.status === 'matched' ? list(result.recommendations).filter(entry => entry.product?.slug) : [];
  if (!entries.length) return productCatalog(result);
  const primary = entries.find(entry => entry.primary) || entries[0];
  const secondary = entries.find(entry => entry !== primary);
  return `<section class="concern-section concern-products" aria-labelledby="concern-products-heading"><div class="concern-section-head"><span class="eyebrow">04 / A CLOSER CHOICE</span><h3 id="concern-products-heading">고민과 가까운 선택</h3><p>확인한 성분의 역할과 제형을 기준으로 살펴보세요. 나에게 맞는지는 실제 사용 조건에 따라 다를 수 있습니다.</p></div><div class="concern-product-grid">${[primary, secondary].filter(Boolean).map((entry, index) => {
    const product = entry.product;
    const reviews = list(entry.reviewInsights);
    return `<article class="concern-product"><span class="concern-choice-label">${index === 0 ? '먼저 살펴볼 제품' : '함께 비교할 제품'}</span><div class="concern-product-head"><div><span>${escape(product.type)} · ${escape(product.volume)}</span><h4>${escape(product.name)}</h4></div>${product.image ? `<img src="${escape(product.image)}" alt="" width="72" height="88" loading="lazy">` : ''}</div><p class="concern-product-role">${escape(product.desc)}</p><dl><div><dt>제형</dt><dd>${escape(product.texture)}</dd></div><div><dt>주요 성분·함량</dt><dd>${escape(product.ingredient)}</dd></div></dl><div class="concern-product-reasons"><h5>연결해서 볼 이유</h5><ul>${list(entry.reasons).map(text => `<li>${escape(text)}</li>`).join('')}</ul></div>${list(entry.limitations).length ? `<details class="concern-product-limits" data-concern-limitations="${escape(product.slug)}" ${state.expandedLimitations.has(product.slug) ? 'open' : ''}><summary>확인할 점과 적용 한계 <span aria-hidden="true">＋</span></summary><ul>${entry.limitations.map(text => `<li>${escape(text)}</li>`).join('')}</ul></details>` : ''}${reviews.length ? `<div class="concern-written-reviews"><h5>이 브라우저에 작성한 경험에서</h5>${reviews.slice(0, 2).map(review => `<blockquote><p>${escape(review.body)}</p><p class="concern-review-meta">작성한 리뷰 · ${Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5 ? `${review.rating}/5점` : '별점 미확인'}</p></blockquote>`).join('')}</div>` : ''}<div class="concern-product-actions"><button type="button" data-concern-product="${escape(product.slug)}">제품 자세히 보기 <span aria-hidden="true">↗</span></button><button type="button" data-concern-review="${escape(product.slug)}">사용자 리뷰 보기 <span aria-hidden="true">↗</span></button></div></article>`;
  }).join('')}</div><p class="concern-review-basis">${result.reviewBasis?.usedCount > 0 ? `이 브라우저에 직접 작성한 리뷰 ${Number(result.reviewBasis.usedCount)}개를 함께 참고했습니다. 해당 경험은 다른 사용자의 결과를 보장하지 않습니다.` : '제품 연결은 공개된 성분과 제형을 기준으로 합니다.'}</p></section>`;
}

function results() {
  const result = state.result;
  if (!result || state.loading) return '';
  const papers = list(result.research);
  const topic = getConcernTopic(result.newsTopic);
  return `<div class="concern-results" id="concern-results"><div class="concern-result-heading"><p class="concern-query-context">“${escape(result.query)}”에서 살펴본 내용</p><h2 id="concern-result-heading" tabindex="-1">${escape(result.title)}</h2><p>${escape(result.summary)}</p>${list(result.topics).length ? `<div class="concern-topic-tags" aria-label="살펴볼 주제">${result.topics.map(item => `<span>${escape(item.label)}</span>`).join('')}</div>` : ''}</div>
    ${findings(result)}
    ${papers.length ? `<section class="concern-section concern-research" aria-labelledby="concern-research-heading"><div class="concern-section-head"><span class="eyebrow">02 / READ THE RESEARCH</span><h3 id="concern-research-heading">근거를 직접 살펴보세요.</h3><p>원문의 대상·시험 조건·결과·한계를 함께 살펴보세요.</p></div><div class="concern-paper-grid">${papers.slice(0, 3).map(paperCard).join('')}</div>${papers.length > 3 ? `<details class="concern-more-research" data-concern-more-research ${state.expandedResearch ? 'open' : ''}><summary>관련 연구 ${papers.length - 3}편 더 보기 <span aria-hidden="true">＋</span></summary><div class="concern-paper-grid">${papers.slice(3).map(paperCard).join('')}</div></details>` : ''}</section>` : ''}
    <section class="concern-section concern-ai" id="concern-ai" aria-labelledby="concern-ai-heading">${aiContent()}</section>
    ${recommendations(result)}
    ${topic ? `<section class="concern-section concern-news" id="concern-news" aria-label="관련 기사·해설">${newsContent()}</section>` : ''}
  </div>`;
}

function pageContent() {
  const hasResult = !!state.result;
  const loading = state.loading ? `<div class="concern-search-loading" role="status" aria-live="polite" tabindex="-1"><div class="concern-search-droplet" aria-hidden="true"><span class="concern-search-droplet-core"></span><span class="concern-search-droplet-ring"></span></div><p>고민을 살펴보고 있어요.</p><span>관련 자료와 제품 정보를 확인합니다.</span></div>` : '';
  return `<div class="concern-visual-stage"><div class="concern-page-intro"><span class="eyebrow">YOUR QUESTIONS, IN THE CLEAR.</span><h1>${hasResult ? '내 고민, 확인할 수 있는 것부터.' : '<span class="concern-heading-line">지금, 피부에</span><span class="concern-heading-line"><span>무엇이</span> <span>궁금한가요?</span></span>'}</h1>${hasResult ? '' : '<p>고민을 남겨 주세요.<br>관련 연구와 확인할 점부터 함께 살펴봅니다.</p>'}</div><div class="concern-search-area">${searchForm()}${hasResult ? '' : `<div class="concern-suggestions" aria-label="이렇게 검색해 보세요">${suggestions.map(text => `<button type="button" data-concern-suggestion="${escape(text)}">${escape(text)} <span aria-hidden="true">↗</span></button>`).join('')}</div>`}</div>${hasResult ? '' : '<div class="concern-scene-caption"><span>INGREDIENTS. EVIDENCE. ROUTINE.</span><span>성분부터 사용법까지, 투명하게.</span></div>'}</div>${loading}${results()}<div class="product-evidence concern-dialog-host"><dialog class="evidence-dialog concern-research-dialog" aria-labelledby="product-evidence-concern-research-dialog-title"><div class="evidence-dialog-content" data-concern-dialog-content></div></dialog></div>`;
}

export function renderConcerns() {
  return `<section class="concerns-page ${state.result ? 'has-results' : 'is-empty'}" id="concerns-page" aria-label="내 고민">${pageContent()}</section>`;
}

function refresh(focusHeading = false) {
  const root = document.getElementById('concerns-page');
  if (!root) return;
  root.dispatchEvent(new Event('concern-before-refresh'));
  root.classList.toggle('has-results', !!state.result);
  root.classList.toggle('is-empty', !state.result);
  root.innerHTML = pageContent();
  mountAiSuggestions(root);
  if (focusHeading) {
    root.querySelector('#concern-result-heading')?.focus({ preventScroll: true });
    root.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}

function refreshNews() {
  const target = document.getElementById('concern-news');
  if (target) target.innerHTML = newsContent();
}

function refreshAi() {
  const target = document.getElementById('concern-ai');
  if (target) {
    target.innerHTML = aiContent();
    mountAiSuggestions(target);
  }
}

function abortAi() {
  state.aiVersion += 1;
  state.aiController?.abort();
  state.aiController = null;
}

async function loadAi() {
  if (!state.result?.query) return;
  const query = state.result.query;
  abortAi();
  const version = state.version;
  const aiVersion = state.aiVersion;
  const controller = new AbortController();
  state.aiController = controller;
  state.ai = { status: 'loading' };
  refreshAi();
  const timeout = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch('/api/concern-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('웹 자료 검색 응답을 확인하지 못했습니다.');
    const raw = await response.text();
    if (raw.length > 100000) throw new Error('웹 자료 검색 응답이 너무 큽니다.');
    const data = JSON.parse(raw);
    const sources = list(data.sources).map(source => ({
      title: typeof source?.title === 'string' && source.title.length <= 300 ? source.title : '',
      url: safeUrl(source?.url),
    }));
    if (data.status !== 'ok' || typeof data.answer !== 'string' || !data.answer.trim() || data.answer.length > 8000 || !sources.length || sources.length > 20 || sources.some(source => !source.title.trim() || !source.url) || !['research', 'google'].includes(data.sourceMode) || (data.sourceMode === 'google' && !suggestionFragment(data.searchSuggestions))) throw new Error('출처가 있는 웹 자료를 확인하지 못했습니다.');
    if (state.version !== version || state.aiVersion !== aiVersion) return;
    state.ai = { status: 'ok', sourceMode: data.sourceMode, answer: data.answer, sources, searchSuggestions: data.sourceMode === 'google' ? data.searchSuggestions : null };
  } catch {
    if (state.version !== version || state.aiVersion !== aiVersion) return;
    state.ai = { status: 'unavailable', message: '지금 AI 웹 자료를 확인하지 못했습니다. 기존 자료와 제품 정보는 계속 볼 수 있습니다.' };
  } finally {
    clearTimeout(timeout);
    if (state.version === version && state.aiVersion === aiVersion) {
      state.aiController = null;
      refreshAi();
    }
  }
}

function abortNews() {
  state.newsVersion += 1;
  state.newsController?.abort();
  state.newsController = null;
}

async function loadNews() {
  const topic = getConcernTopic(state.result?.newsTopic);
  if (!topic) return;
  abortNews();
  const version = state.version;
  const newsVersion = state.newsVersion;
  const controller = new AbortController();
  state.newsController = controller;
  state.news = { status: 'loading', articles: [] };
  refreshNews();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/concern-news?topic=${encodeURIComponent(topic.id)}`, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error('자료 연결에 응답이 없습니다.');
    const raw = await response.text();
    if (raw.length > 150000) throw new Error('자료 응답을 확인하지 못했습니다.');
    const news = JSON.parse(raw);
    if (news.topic !== topic.id || !['curated', 'unavailable'].includes(news.status)) throw new Error('자료 응답을 확인하지 못했습니다.');
    if (state.version !== version || state.newsVersion !== newsVersion) return;
    const articles = list(news.articles).map(validArticle).filter(Boolean).slice(0, 6);
    state.news = { status: news.status, articles: news.status === 'unavailable' ? [] : articles, checkedAt: news.checkedAt || null, notice: typeof news.notice === 'string' ? news.notice : '' };
  } catch {
    if (state.version !== version || state.newsVersion !== newsVersion) return;
    state.news = { status: 'unavailable', articles: [], notice: '외부 자료를 지금 연결하지 못했습니다. 다시 불러오거나 뉴스 검색에서 주제를 살펴보세요.' };
  } finally {
    clearTimeout(timeout);
    if (state.version === version && state.newsVersion === newsVersion) {
      state.newsController = null;
      refreshNews();
    }
  }
}

function search(query, fromProductSlug = state.fromProductSlug, { askAi = true } = {}) {
  const validation = validateConcernQuery(query);
  state.draft = String(query ?? '');
  state.error = validation.error || '';
  if (state.error) {
    // An invalid replacement search must not be overwritten by an older timer.
    if (state.loading) {
      clearTimeout(state.searchTimer);
      state.searchTimer = null;
      state.loading = false;
      state.version += 1;
      abortNews();
      abortAi();
      state.result = null;
      state.news = null;
      state.ai = null;
      refresh();
    }
    const input = document.getElementById('concern-query');
    const message = document.getElementById('concern-search-error');
    if (message) { message.textContent = state.error; message.hidden = false; }
    input?.setAttribute('aria-invalid', 'true');
    input?.focus();
    return;
  }
  abortNews();
  abortAi();
  clearTimeout(state.searchTimer);
  state.version += 1;
  const version = state.version;
  state.loading = true;
  state.news = null;
  state.ai = { status: askAi ? 'loading' : 'idle' };
  state.expandedResearch = false;
  state.expandedLimitations.clear();
  state.fromProductSlug = fromProductSlug || null;
  try {
    state.result = analyzeConcern(validation.query, { reviews: getWrittenReviews(), fromProductSlug: state.fromProductSlug });
    state.draft = validation.query;
    const topic = getConcernTopic(state.result?.newsTopic);
    if (topic) state.news = { status: 'loading', articles: [] };
    refresh();
    const root = document.getElementById('concerns-page');
    root?.querySelector('.concern-search-loading')?.focus({ preventScroll: true });
    root?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (topic) void loadNews();
    if (askAi) void loadAi();
    // Keep the search animation visible briefly while both requests run in
    // parallel. Never block the basic answer on the slower AI request.
    const reveal = () => {
      if (state.version !== version) return;
      if (state.composing) { state.searchTimer = setTimeout(reveal, 100); return; }
      state.searchTimer = null;
      state.loading = false;
      const previous = document.getElementById('concern-query');
      const editing = previous && document.activeElement === previous;
      const start = editing ? previous.selectionStart : null;
      const end = editing ? previous.selectionEnd : null;
      refresh(!editing);
      if (editing) {
        const input = document.getElementById('concern-query');
        input?.focus({ preventScroll: true });
        if (start !== null && end !== null) input?.setSelectionRange(start, end);
      }
    };
    state.searchTimer = setTimeout(reveal, 1200);
  } catch {
    clearTimeout(state.searchTimer);
    state.searchTimer = null;
    state.loading = false;
    state.result = null;
    state.error = '입력하신 내용을 지금 살펴보지 못했습니다. 잠시 후 다시 검색해 주세요.';
    refresh();
  }
}

export function seedConcernSearch(query, { fromProductSlug } = {}) {
  abortNews();
  abortAi();
  clearTimeout(state.searchTimer);
  state.searchTimer = null;
  state.loading = false;
  state.composing = false;
  state.version += 1;
  state.draft = String(query ?? '').slice(0, CONCERN_QUERY_LIMIT);
  state.error = '';
  state.result = null;
  state.news = null;
  state.ai = null;
  state.expandedResearch = false;
  state.expandedLimitations.clear();
  state.fromProductSlug = fromProductSlug || null;
  state.pendingSeed = { query: state.draft, fromProductSlug: state.fromProductSlug };
}

export function bindConcerns(callbacks = {}) {
  mountAiSuggestions();
  const root = document.getElementById('concerns-page');
  if (!root || bindings.has(root)) return;
  bindings.add(root);
  let composing = false;
  let dialog = null;
  let trigger = null;
  let releaseScroll = null;

  function closeDialog(restoreFocus = true) {
    const current = dialog;
    dialog = null;
    if (current?.open) current.close();
    releaseScroll?.();
    releaseScroll = null;
    if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
    trigger = null;
  }

  function openPaper(id, button) {
    const paper = list(state.result?.research).find(item => item.id === id);
    if (!paper) return;
    closeDialog(false);
    dialog = root.querySelector('.concern-research-dialog');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    dialog.querySelector('[data-concern-dialog-content]').innerHTML = renderResearchDetail(paper);
    trigger = button;
    dialog.showModal();
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

  root.addEventListener('concern-before-refresh', () => closeDialog(false));
  root.addEventListener('compositionstart', event => { if (event.target.id === 'concern-query') { composing = true; state.composing = true; } });
  root.addEventListener('compositionend', event => { if (event.target.id === 'concern-query') { composing = false; state.composing = false; } });
  root.addEventListener('keydown', event => { if (event.target.id === 'concern-query' && event.key === 'Enter' && (composing || event.isComposing || event.keyCode === 229)) event.preventDefault(); });
  root.addEventListener('input', event => {
    if (event.target.id !== 'concern-query') return;
    state.draft = event.target.value;
    state.error = '';
    root.querySelector('[data-concern-count]').textContent = `${state.draft.length}/${CONCERN_QUERY_LIMIT}`;
    root.querySelector('#concern-search-error').hidden = true;
    event.target.removeAttribute('aria-invalid');
  });
  root.addEventListener('submit', event => {
    if (!event.target.matches('[data-concern-form]')) return;
    event.preventDefault();
    if (!composing) search(root.querySelector('#concern-query').value);
  });
  root.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-evidence-close]')) return closeDialog();
    if (target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog();
      return;
    }
    const suggestion = target.closest('[data-concern-suggestion]');
    if (suggestion) return search(suggestion.dataset.concernSuggestion, null);
    const paper = target.closest('[data-concern-paper]');
    if (paper) return openPaper(paper.dataset.concernPaper, paper);
    if (target.closest('[data-concern-news-cancel]')) {
      abortNews();
      state.news = { status: 'unavailable', articles: [], notice: '자료 연결을 취소했습니다. 다시 불러올 수 있습니다.' };
      return refreshNews();
    }
    if (target.closest('[data-concern-news-retry]')) return void loadNews();
    if (target.closest('[data-concern-ai-cancel]')) {
      abortAi();
      state.ai = { status: 'unavailable', message: 'AI 웹 자료 검색을 취소했습니다. 필요하면 다시 검색할 수 있습니다.' };
      refreshAi();
      if (event.detail === 0) root.querySelector('[data-concern-ai-retry]')?.focus({ preventScroll: true });
      return;
    }
    if (target.closest('[data-concern-ai-retry]')) {
      void loadAi();
      if (event.detail === 0) root.querySelector('[data-concern-ai-cancel]')?.focus({ preventScroll: true });
      return;
    }
    const product = target.closest('[data-concern-product]');
    if (product) return callbacks.onProduct?.(product.dataset.concernProduct);
    const review = target.closest('[data-concern-review]');
    if (review) return callbacks.onReview?.(review.dataset.concernReview);
    const evidence = target.closest('[data-concern-evidence]');
    if (evidence) return callbacks.onEvidence?.(evidence.dataset.concernEvidence);
  });
  root.addEventListener('cancel', event => {
    if (event.target === dialog) { event.preventDefault(); closeDialog(); }
  }, true);
  root.addEventListener('close', event => { if (event.target === dialog) closeDialog(); }, true);
  root.addEventListener('toggle', event => {
    const detail = event.target;
    if (!(detail instanceof HTMLDetailsElement) || !detail.isConnected) return;
    if (detail.hasAttribute('data-concern-more-research')) state.expandedResearch = detail.open;
    if (detail.hasAttribute('data-concern-limitations')) {
      if (detail.open) state.expandedLimitations.add(detail.dataset.concernLimitations);
      else state.expandedLimitations.delete(detail.dataset.concernLimitations);
    }
  }, true);
  const observer = new MutationObserver(() => {
    if (root.isConnected) return;
    closeDialog(false);
    clearTimeout(state.searchTimer);
    state.searchTimer = null;
    state.loading = false;
    state.composing = false;
    state.version += 1;
    if (state.newsController) abortNews();
    if (state.aiController) {
      abortAi();
    }
    // Do not retain a generated web result after leaving this page.
    state.ai = state.result ? { status: 'idle' } : null;
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  if (state.pendingSeed) {
    const seed = state.pendingSeed;
    state.pendingSeed = null;
    // A review-origin question can contain a locally written review. Show the
    // disclosure first and require an explicit click before sending it out.
    search(seed.query, seed.fromProductSlug, { askAi: false });
  }
}
