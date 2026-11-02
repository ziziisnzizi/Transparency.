const states = new Map();
const allowedSections = new Set(['제품 정보', '성분·함량', '효능·근거', '사용 안내']);
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
let capabilities = null;
let capabilitiesRequest = null;

function stateFor(product) {
  if (!states.has(product.slug)) states.set(product.slug, { draft: '', messages: [], pending: false, error: '', canRetry: false, notice: '', lastQuestion: '', version: 0, controller: null, callbacks: {} });
  return states.get(product.slug);
}

function rootId(product) { return `questions-${product.slug}`; }

function modeInformation() {
  if (capabilities?.aiAvailable) return { label: 'Gemini AI', text: '제품 자료를 바탕으로 답변하고, 확인할 수 있는 근거를 함께 보여드립니다.' };
  if (capabilities?.mode === 'reference') return { label: '제품 자료 답변', text: '지금은 등록된 제품 자료로 안내합니다. Gemini 답변은 연결 후 사용할 수 있습니다.' };
  if (capabilities?.mode === 'unavailable') return { label: '연결 확인 필요', text: '현재 연결 상태를 확인할 수 없습니다. 질문을 보내 다시 시도해 주세요.' };
  return { label: '연결 확인 중', text: '성분, 사용 순서, 공개된 연구 자료에서 궁금한 점을 찾아보세요.' };
}

function referenceReason(reason) {
  if (reason === 'missing_key') return 'Gemini가 연결되지 않아 등록된 제품 자료로 안내했습니다.';
  if (reason === 'provider_unavailable') return 'Gemini 연결이 원활하지 않아 등록된 제품 자료로 안내했습니다.';
  if (reason === 'no_match') return '등록된 자료에서 확인할 수 있는 범위를 안내합니다.';
  return '등록된 제품 자료를 기준으로 안내합니다.';
}

function safeSources(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap(source => {
    if (!source || typeof source.id !== 'string' || typeof source.title !== 'string' || !allowedSections.has(source.section)) return [];
    return [{ id: source.id.slice(0, 100), title: source.title.slice(0, 120), section: source.section, excerpt: typeof source.excerpt === 'string' ? source.excerpt.slice(0, 700) : '' }];
  });
}

function renderMessage(message, index) {
  if (message.role === 'user') return `<li class="question-message question-user" data-question-role="user"><span class="question-message-label">나의 질문</span><p class="question-message-text">${escape(message.text)}</p></li>`;
  return `<li class="question-message question-answer" data-question-role="assistant"><div class="question-answer-head"><span class="question-message-label">${message.mode === 'ai' ? 'Gemini 답변' : '제품 자료 답변'}</span><span class="question-answer-origin">${message.mode === 'ai' ? 'AI가 작성한 답변' : '등록 자료에서 확인'}</span></div><p class="question-message-text">${escape(message.text)}</p>${message.mode === 'reference' ? `<p class="question-answer-note">${escape(referenceReason(message.reason))}</p>` : '<p class="question-answer-note">AI 답변은 정확하지 않을 수 있습니다. 아래 근거와 제품 표기를 함께 확인하세요.</p>'}${message.sources.length ? `<div class="question-sources"><span class="question-sources-title">답변의 근거</span><ul>${message.sources.map((source, sourceIndex) => `<li><button type="button" class="question-source" data-question-message="${index}" data-question-source="${sourceIndex}"><span>${escape(source.title)}</span><small>${escape(source.section)} ↗</small></button>${source.excerpt ? `<p>${escape(source.excerpt)}</p>` : ''}</li>`).join('')}</ul></div>` : ''}</li>`;
}

export function renderProductQuestions(product) {
  const state = stateFor(product);
  const info = modeInformation();
  const prefix = rootId(product);
  const ingredient = product.ingredients?.[0]?.[0]?.split(' ')[0] || '주요 성분';
  const suggestions = [`${ingredient}의 역할이 궁금해요.`, '어떤 순서와 양으로 사용하나요?', '제품 효능의 근거를 확인하고 싶어요.'];
  return `<section class="product-questions" id="${escape(prefix)}" aria-labelledby="${escape(prefix)}-heading">
    <div class="question-heading"><div><span class="eyebrow">ASK TRANSPARENCY.</span><h3 id="${escape(prefix)}-heading">Transparency.에게 물어보기</h3><p>${escape(product.name)}의 성분부터 사용법까지, 궁금한 내용을 남겨 주세요.</p></div><span class="question-mode" data-question-mode>${escape(info.label)}</span></div>
    <p class="question-mode-help" data-question-mode-help>${escape(info.text)}</p>
    <div class="question-suggestions" aria-label="추천 질문">${suggestions.map(question => `<button type="button" data-question-suggestion="${escape(question)}" ${state.pending ? 'disabled' : ''}>${escape(question)} <span aria-hidden="true">↗</span></button>`).join('')}</div>
    <div class="question-history-head"><span>질문과 답변</span>${state.messages.length || state.pending ? '<button type="button" class="question-clear">대화 지우기</button>' : ''}</div>
    <div class="question-log" role="log" aria-label="${escape(product.name)} 질문과 답변" aria-live="polite" aria-relevant="additions" aria-busy="${state.pending}"><ol>${state.messages.map(renderMessage).join('') || '<li class="question-welcome"><p>성분과 함량, 사용 순서, 연구 자료의 범위까지.<br>궁금한 점을 질문해 보세요.</p></li>'}${state.pending ? '<li class="question-pending" role="status"><span class="question-loading-dot" aria-hidden="true"></span>답변을 준비하고 있습니다.</li>' : ''}</ol></div>
    ${state.error ? `<div class="question-error" role="alert"><p>${escape(state.error)}</p>${state.canRetry ? '<button type="button" class="question-retry">다시 시도</button>' : ''}</div>` : ''}
    ${state.notice ? `<p class="question-notice" role="status">${escape(state.notice)}</p>` : ''}
    <form class="question-form" novalidate aria-describedby="${escape(prefix)}-privacy"><label for="ai-question-${escape(product.slug)}">질문 작성</label><textarea id="ai-question-${escape(product.slug)}" name="question" rows="4" maxlength="500" aria-describedby="${escape(prefix)}-count ${escape(prefix)}-keyboard" placeholder="예: 이 제품을 토너 다음에 사용하면 되나요?" ${state.pending ? 'disabled' : ''}>${escape(state.draft)}</textarea><div class="question-input-meta"><span id="${escape(prefix)}-keyboard">Enter로 보내기 · Shift+Enter로 줄바꿈</span><output id="${escape(prefix)}-count" for="ai-question-${escape(product.slug)}">${state.draft.length} / 500</output></div><div class="question-form-actions"><p id="${escape(prefix)}-privacy">답변을 위해 질문과 제품 자료가 서버로 전송됩니다. Gemini 연결 시 AI 서비스로 전달되며, 대화는 이 브라우저의 저장소에 보관하지 않습니다.</p>${state.pending ? '<button class="question-cancel" type="button">요청 취소</button>' : '<button class="question-send" type="submit">질문 보내기 <span aria-hidden="true">↗</span></button>'}</div></form>
  </section>`;
}

function updateMode(root) {
  if (!root?.isConnected) return;
  const info = modeInformation();
  root.querySelector('[data-question-mode]').textContent = info.label;
  root.querySelector('[data-question-mode-help]').textContent = info.text;
}

function loadCapabilities() {
  if (!capabilitiesRequest) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    capabilitiesRequest = fetch('/api/ask', { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Capability request failed');
        const result = await response.json();
        if (typeof result.aiAvailable !== 'boolean') throw new Error('Invalid capability response');
        capabilities = { aiAvailable: result.aiAvailable, mode: result.aiAvailable ? 'ai' : 'reference' };
      })
      .catch(() => { capabilities = { aiAvailable: false, mode: 'unavailable' }; })
      .finally(() => clearTimeout(timeout));
  }
  return capabilitiesRequest;
}

function refresh(product, focus = false) {
  const state = stateFor(product);
  if (!document.getElementById(rootId(product))) return;
  if (typeof state.callbacks.onRender === 'function') state.callbacks.onRender();
  else {
    document.getElementById(rootId(product)).outerHTML = renderProductQuestions(product);
    bindProductQuestions(product, state.callbacks);
  }
  const root = document.getElementById(rootId(product));
  const log = root?.querySelector('.question-log');
  if (log) log.scrollTop = log.scrollHeight;
  if (focus) root?.querySelector('textarea')?.focus({ preventScroll: true });
}

function trimTranscript(state) {
  state.messages = state.messages.slice(-20);
  while (state.messages[0]?.role === 'assistant') state.messages.shift();
}

async function sendQuestion(product, question, retry = false) {
  const state = stateFor(product);
  if (state.pending) return;
  const text = String(question).trim();
  if (!text || text.length > 500) {
    state.canRetry = false;
    state.error = text ? '질문은 500자 이내로 작성해 주세요.' : '궁금한 내용을 입력해 주세요.';
    refresh(product, true);
    return;
  }
  state.error = '';
  state.canRetry = false;
  state.notice = '';
  state.pending = true;
  state.draft = '';
  state.lastQuestion = text;
  if (!retry || state.messages.at(-1)?.role !== 'user' || state.messages.at(-1).text !== text) state.messages.push({ role: 'user', text });
  trimTranscript(state);
  const version = ++state.version;
  const controller = new AbortController();
  state.controller = controller;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 55000);
  refresh(product);
  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ productSlug: product.slug, question: text }),
      signal: controller.signal,
    });
    if (response.status === 429) throw new Error('질문이 많아 잠시 쉬고 있습니다. 조금 후 다시 시도해 주세요.');
    if (!response.ok) throw new Error(response.status === 400 ? '질문 내용과 길이를 확인한 뒤 다시 보내 주세요.' : '답변 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    const raw = await response.text();
    if (raw.length > 100000) throw new Error('답변을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.');
    let result;
    try { result = JSON.parse(raw); } catch { throw new Error('답변을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    if (typeof result.answer !== 'string' || !result.answer.trim() || result.answer.length > 12000 || !['ai', 'reference'].includes(result.mode)) throw new Error('답변 형식을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    if (state.version !== version) return;
    state.messages.push({ role: 'assistant', text: result.answer.trim(), sources: safeSources(result.sources), mode: result.mode, reason: result.reason });
    if (result.mode === 'ai') capabilities = { aiAvailable: true, mode: 'ai' };
    else if (result.reason === 'missing_key') capabilities = { aiAvailable: false, mode: 'reference' };
    trimTranscript(state);
  } catch (error) {
    if (state.version !== version) return;
    state.canRetry = true;
    state.error = timedOut ? '답변이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.' : error.name === 'AbortError' ? '답변 요청을 취소했습니다.' : error.name === 'TypeError' ? '네트워크에 연결하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.' : error.message || '답변을 받지 못했습니다. 잠시 후 다시 시도해 주세요.';
  } finally {
    clearTimeout(timeout);
    if (state.version === version) {
      state.pending = false;
      state.controller = null;
      refresh(product, true);
    }
  }
}

export function bindProductQuestions(product, callbacks = {}) {
  const state = stateFor(product);
  state.callbacks = callbacks;
  const root = document.getElementById(rootId(product));
  if (!root || root.dataset.questionsBound === 'true') return;
  root.dataset.questionsBound = 'true';
  const form = root.querySelector('.question-form');
  const input = form.elements.namedItem('question');
  let composing = false;
  loadCapabilities().then(() => updateMode(root));

  input.addEventListener('input', () => {
    state.draft = input.value;
    root.querySelector('output').textContent = `${input.value.length} / 500`;
    if (state.error) {
      state.error = '';
      state.canRetry = false;
      root.querySelector('.question-error')?.remove();
    }
  });
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; state.draft = input.value; root.querySelector('output').textContent = `${input.value.length} / 500`; });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', event => { event.preventDefault(); if (!composing) sendQuestion(product, input.value); });
  root.querySelectorAll('[data-question-suggestion]').forEach(button => button.addEventListener('click', () => sendQuestion(product, button.dataset.questionSuggestion)));
  root.querySelector('.question-retry')?.addEventListener('click', () => sendQuestion(product, state.lastQuestion, true));
  root.querySelector('.question-cancel')?.addEventListener('click', () => {
    ++state.version;
    state.controller?.abort();
    state.controller = null;
    state.pending = false;
    state.error = '';
    state.canRetry = false;
    state.draft = state.lastQuestion;
    state.notice = '요청을 취소했습니다. 질문을 수정해 다시 보내 주세요.';
    refresh(product, true);
  });
  root.querySelector('.question-clear')?.addEventListener('click', () => {
    ++state.version;
    state.controller?.abort();
    state.controller = null;
    state.pending = false;
    state.messages = [];
    state.draft = '';
    state.lastQuestion = '';
    state.error = '';
    state.canRetry = false;
    state.notice = '대화를 지웠습니다.';
    refresh(product, true);
  });
  root.querySelectorAll('[data-question-source]').forEach(button => button.addEventListener('click', () => {
    const source = state.messages[Number(button.dataset.questionMessage)]?.sources?.[Number(button.dataset.questionSource)];
    if (source) state.callbacks.onSource?.(source);
  }));
}
