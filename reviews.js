import { MOCK_PRODUCT_REVIEWS } from './review-mocks.js';

export const REVIEW_STORAGE_KEY = 'transparency-reviews';

const drafts = new Map();
const feedback = new Map();
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const compareReviews = (a, b) => a.rating - b.rating || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id);
const validSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;

export function normalizeReviews(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap(review => {
    if (!review || typeof review !== 'object' || !validSlug(review.productSlug) || typeof review.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(review.id)) return [];
    if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5 || typeof review.body !== 'string') return [];
    const body = review.body.trim();
    const timestamp = typeof review.createdAt === 'string' ? Date.parse(review.createdAt) : NaN;
    const key = `${review.productSlug}/${review.id}`;
    if (body.length < 10 || body.length > 1000 || !Number.isFinite(timestamp) || seen.has(key)) return [];
    seen.add(key);
    return [{ id: review.id, productSlug: review.productSlug, rating: review.rating, body, createdAt: new Date(timestamp).toISOString() }];
  });
}

function readReviewState() {
  try {
    const storage = globalThis.localStorage;
    if (!storage) throw new Error('Storage unavailable');
    const raw = storage.getItem(REVIEW_STORAGE_KEY);
    if (raw === null) return { reviews: [], error: '' };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Invalid review storage');
    return { reviews: normalizeReviews(parsed), error: '' };
  } catch {
    return { reviews: [], error: '저장된 리뷰를 불러오지 못했습니다. 브라우저의 저장 공간과 개인정보 보호 설정을 확인해 주세요.' };
  }
}

export function sortProductReviews(reviews, productSlug) {
  return normalizeReviews(reviews)
    .filter(review => review.productSlug === productSlug)
    .sort(compareReviews);
}

export function getProductReviewFeed(productSlug, userReviews = readReviewState().reviews) {
  const written = sortProductReviews(userReviews, productSlug).map(review => ({ ...review, source: 'user' }));
  const examples = sortProductReviews(MOCK_PRODUCT_REVIEWS, productSlug).map(review => ({ ...review, source: 'example' }));
  return [...written, ...examples].sort(compareReviews);
}

export function getReviewSummary(productSlug) {
  const reviews = readReviewState().reviews.filter(review => review.productSlug === productSlug);
  const exampleCount = sortProductReviews(MOCK_PRODUCT_REVIEWS, productSlug).length;
  return {
    count: reviews.length + exampleCount,
    average: reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length * 10) / 10 : null,
    writtenCount: reviews.length,
    exampleCount,
  };
}

function reviewDate(value) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).format(new Date(value));
}

function renderReviewEntry(review) {
  const isExample = review.source === 'example';
  const sourceAttribute = isExample ? `data-example-review="${escape(review.id)}"` : `data-review-id="${escape(review.id)}"`;
  const metadata = isExample ? '' : `<time datetime="${escape(review.createdAt)}">${escape(reviewDate(review.createdAt))}</time>`;
  const actions = isExample ? '' : `<div class="review-entry-foot"><span>이 브라우저에서 작성한 리뷰</span><button type="button" class="review-delete" data-review-delete="${escape(review.id)}" aria-label="${review.rating}점 리뷰 삭제">삭제</button></div>`;
  return `<li><article class="review-entry" data-review-source="${review.source}" ${sourceAttribute}><div class="review-entry-head"><span class="review-stars" aria-label="5점 만점에 ${review.rating}점"><span aria-hidden="true">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span><strong>${review.rating}.0</strong></span>${metadata}</div><p class="review-body">${escape(review.body)}</p>${actions}</article></li>`;
}

export function renderProductReviews(product) {
  const state = readReviewState();
  const reviews = getProductReviewFeed(product.slug, state.reviews);
  const exampleCount = reviews.filter(review => review.source === 'example').length;
  const summary = getReviewSummary(product.slug);
  const draft = drafts.get(product.slug) || { rating: '', body: '' };
  const message = feedback.get(product.slug);
  const prefix = `reviews-${product.slug}`;
  return `<section class="product-reviews" id="${escape(prefix)}" aria-labelledby="${escape(prefix)}-heading">
    <div class="review-heading"><div><span class="eyebrow">05 / USER REVIEWS</span><h2 id="${escape(prefix)}-heading" tabindex="-1">사용자의 경험을 먼저 봅니다.</h2></div><div class="review-summary" aria-label="전체 리뷰 ${summary.count}개, 작성 ${summary.writtenCount}개, 예시 ${summary.exampleCount}개, ${summary.average === null ? '직접 작성한 별점 없음' : `작성 리뷰 평균 ${summary.average.toFixed(1)}점`}"><strong>${summary.average === null ? '—' : summary.average.toFixed(1)}</strong><span>전체 ${summary.count}개 리뷰</span><small>작성 ${summary.writtenCount} · 예시 ${summary.exampleCount}</small><small>별점은 작성 리뷰 기준</small></div></div>
    <div class="review-order-note"><strong>★ 별점 낮은 순</strong><p>${escape(product.name)}에 남긴 리뷰를 낮은 별점부터 보여드립니다. 불편한 경험을 먼저 듣고, 개선에 반영하겠습니다.</p></div>
    ${state.error ? `<p class="review-load-error" role="alert">${escape(state.error)}</p>` : ''}
    ${exampleCount ? '<p class="review-source-note">전체 리뷰 수에는 화면 구성을 위해 작성한 글이 포함됩니다. 해당 글은 실제 구매 후기가 아니며, 평균 별점은 직접 작성한 리뷰만 반영합니다.</p>' : ''}
    <ol class="review-list" aria-label="${escape(product.name)} 리뷰, 별점 낮은 순">${reviews.map(renderReviewEntry).join('') || '<li class="review-empty"><h3>아직 등록된 리뷰가 없습니다.</h3><p>사용하며 느낀 점을 가장 먼저 남겨 주세요.</p></li>'}</ol>
    <form class="review-form" novalidate aria-describedby="${escape(prefix)}-storage">
      <h3>사용 경험을 들려주세요.</h3>
      <fieldset class="review-rating-options" aria-describedby="${escape(prefix)}-rating-help ${escape(prefix)}-feedback"><legend>별점 선택 <span>필수</span></legend><p id="${escape(prefix)}-rating-help">1점은 아쉬웠어요, 5점은 만족했어요.</p><div class="review-rating-grid">${[1, 2, 3, 4, 5].map(rating => `<label><input type="radio" name="review-rating" value="${rating}" required ${String(draft.rating) === String(rating) ? 'checked' : ''}><span><b aria-hidden="true">★</b> ${rating}점</span></label>`).join('')}</div></fieldset>
      <label class="review-body-label" for="${escape(prefix)}-body">리뷰 내용 <span>필수</span></label>
      <p class="review-input-hint" id="${escape(prefix)}-body-help">좋았던 점과 불편했던 점을 10~1,000자로 작성해 주세요.</p>
      <textarea id="${escape(prefix)}-body" name="review-body" rows="5" minlength="10" maxlength="1000" required aria-describedby="${escape(prefix)}-body-help ${escape(prefix)}-feedback" placeholder="사용감, 제형, 용기에서 느낀 점을 들려주세요.">${escape(draft.body)}</textarea>
      <div class="review-form-meta"><p id="${escape(prefix)}-storage">리뷰는 현재 브라우저에 저장되며 다른 기기와 공유되지 않습니다.</p><output for="${escape(prefix)}-body" aria-live="off">${draft.body.length} / 1000</output></div>
      <p class="review-feedback ${message?.tone === 'error' ? 'review-feedback-error' : ''}" id="${escape(prefix)}-feedback" role="${message?.tone === 'error' ? 'alert' : 'status'}" ${message ? '' : 'hidden'}>${message ? escape(message.text) : ''}</p>
      <button class="review-submit" type="submit">리뷰 남기기 <span aria-hidden="true">↗</span></button>
    </form>
  </section>`;
}

export function bindProductReviews(product, onUpdate) {
  const prefix = `reviews-${product.slug}`;
  const root = document.getElementById(prefix);
  const form = root?.querySelector('.review-form');
  if (!form) return;
  const body = form.elements.namedItem('review-body');

  function clearFeedback() {
    feedback.delete(product.slug);
    const message = root.querySelector('.review-feedback');
    message.hidden = true;
    message.textContent = '';
    form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
  }

  function showError(text, field) {
    feedback.set(product.slug, { tone: 'error', text });
    const message = root.querySelector('.review-feedback');
    message.textContent = text;
    message.hidden = false;
    message.classList.add('review-feedback-error');
    message.setAttribute('role', 'alert');
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }

  function save(reviews) {
    try {
      globalThis.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews));
      return true;
    } catch {
      showError('리뷰를 저장하지 못했습니다. 브라우저의 저장 공간과 개인정보 보호 설정을 확인한 뒤 다시 시도해 주세요.');
      return false;
    }
  }

  function refresh(text) {
    feedback.set(product.slug, { tone: 'success', text });
    onUpdate();
    const updated = document.getElementById(prefix);
    updated?.querySelector('h2')?.focus({ preventScroll: true });
  }

  form.addEventListener('input', () => {
    clearFeedback();
    const rating = form.querySelector('input[name="review-rating"]:checked')?.value || '';
    drafts.set(product.slug, { rating, body: body.value });
    form.querySelector('output').textContent = `${body.value.length} / 1000`;
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    clearFeedback();
    const rating = Number(form.querySelector('input[name="review-rating"]:checked')?.value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return showError('별점을 1~5점 중에서 선택해 주세요.', form.querySelector('input[name="review-rating"]'));
    const text = body.value.trim();
    if (text.length < 10 || text.length > 1000) return showError('리뷰 내용을 10~1,000자로 작성해 주세요.', body);
    const state = readReviewState();
    if (state.error) return showError(state.error);
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const review = { id, productSlug: product.slug, rating, body: text, createdAt: new Date().toISOString() };
    if (!save([...state.reviews, review])) return;
    drafts.delete(product.slug);
    refresh('리뷰가 저장되었습니다. 낮은 별점순 목록에서 확인할 수 있습니다.');
  });

  root.querySelectorAll('[data-review-delete]').forEach(button => button.addEventListener('click', () => {
    const state = readReviewState();
    if (state.error) return showError(state.error);
    const remaining = state.reviews.filter(review => !(review.productSlug === product.slug && review.id === button.dataset.reviewDelete));
    if (remaining.length === state.reviews.length) return;
    if (save(remaining)) refresh('리뷰가 삭제되었습니다.');
  }));
}
