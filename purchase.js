const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const money = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const quantityFor = value => Math.min(99, Math.max(1, Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 1));
const quantities = new Map();
const details = { name: '', phone: '', postcode: '', address: '', addressDetail: '', email: '', deliveryNote: '' };
let activeSlug = null;
let stage = 'edit';
let errors = {};

export function formatPurchasePrice(amount, pendingText = '가격 안내 예정') {
  return money(amount) ? `${new Intl.NumberFormat('ko-KR').format(amount)}원` : pendingText;
}

export function calculatePurchaseTotals(price, quantity, pricing = {}) {
  const normalizedQuantity = quantityFor(quantity);
  const unitPrice = money(price) ? price : null;
  const rawSubtotal = unitPrice === null ? null : unitPrice * normalizedQuantity;
  const subtotal = money(rawSubtotal) ? rawSubtotal : null;
  const threshold = money(pricing.freeShippingThreshold) ? pricing.freeShippingThreshold : null;
  const baseShipping = money(pricing.shippingFee) ? pricing.shippingFee : null;
  let shippingFee = baseShipping;
  if (threshold !== null) {
    shippingFee = subtotal === null ? null : subtotal >= threshold ? 0 : baseShipping;
  }
  const rawTotal = subtotal === null || shippingFee === null ? null : subtotal + shippingFee;
  return { quantity: normalizedQuantity, unitPrice, subtotal, shippingFee, total: money(rawTotal) ? rawTotal : null };
}

export function validatePurchaseDetails(value) {
  const result = {};
  const text = name => typeof value?.[name] === 'string' ? value[name].trim() : '';
  if (!text('name') || text('name').length > 50) result.name = '받는 분의 이름을 1~50자로 입력해 주세요.';
  if (!/^0\d{8,10}$/.test(text('phone').replace(/[\s()-]/g, ''))) result.phone = '연락 가능한 전화번호를 확인해 주세요.';
  if (!/^\d{5}$/.test(text('postcode'))) result.postcode = '5자리 우편번호를 입력해 주세요.';
  if (text('address').length < 5 || text('address').length > 200) result.address = '기본 주소를 5~200자로 입력해 주세요.';
  if (text('addressDetail').length > 100) result.addressDetail = '상세 주소는 100자 이내로 입력해 주세요.';
  if (text('email') && (text('email').length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text('email')))) result.email = '이메일 주소를 확인해 주세요.';
  if (text('deliveryNote').length > 200) result.deliveryNote = '배송 요청사항은 200자 이내로 입력해 주세요.';
  return result;
}

function currentProduct(products, selectedSlug) {
  const product = products.find(item => item.slug === selectedSlug) || products[0];
  if (product && activeSlug !== product.slug) {
    activeSlug = product.slug;
    stage = 'edit';
    errors = {};
  }
  return product;
}

function shippingField(name, label, { type = 'text', autocomplete = '', required = false, max = 100, inputmode = '', full = false, placeholder = '' } = {}) {
  return `<div class="purchase-field ${full ? 'purchase-field-wide' : ''}"><label for="purchase-${name}">${label}<span>${required ? '필수' : '선택'}</span></label><input id="purchase-${name}" name="${name}" type="${type}" value="${escape(details[name])}" maxlength="${max}" ${required ? 'required' : ''} ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${inputmode ? `inputmode="${inputmode}"` : ''} ${placeholder ? `placeholder="${escape(placeholder)}"` : ''} aria-describedby="purchase-${name}-error" ${errors[name] ? 'aria-invalid="true"' : ''}><p class="purchase-field-error" id="purchase-${name}-error" role="alert" ${errors[name] ? '' : 'hidden'}>${escape(errors[name] || '')}</p></div>`;
}

function renderAmounts(product, quantity, pricing) {
  const totals = calculatePurchaseTotals(product.price, quantity, pricing);
  return `<dl class="purchase-totals" aria-live="polite" aria-atomic="true"><div><dt>상품 금액</dt><dd data-purchase-amount="subtotal">${formatPurchasePrice(totals.subtotal)}</dd></div><div><dt>배송비</dt><dd data-purchase-amount="shippingFee">${formatPurchasePrice(totals.shippingFee, '배송비 안내 예정')}</dd></div><div class="purchase-total"><dt>총 주문 금액</dt><dd data-purchase-amount="total">${formatPurchasePrice(totals.total, '금액 확인 후 안내')}</dd></div></dl>`;
}

function renderSummary(product, quantity, pricing, reviewing) {
  const threshold = money(pricing.freeShippingThreshold) ? pricing.freeShippingThreshold : null;
  return `<aside class="purchase-summary purchase-panel" aria-labelledby="purchase-summary-title"><span class="eyebrow">YOUR SELECTION</span><h2 id="purchase-summary-title">주문 상품</h2><div class="purchase-summary-product"><img src="${escape(product.image)}" alt="${escape(product.name)}" width="${product.imageWidth || 1024}" height="${product.imageHeight || 1536}"><div><span class="purchase-summary-type">${escape(product.type)} · ${escape(product.volume)}</span><h3>${escape(product.name)}</h3><p>${formatPurchasePrice(product.price)}</p><span class="purchase-summary-quantity">수량 <b data-purchase-quantity>${quantity}</b>개</span></div></div>${renderAmounts(product, quantity, pricing)}${threshold !== null ? `<p class="purchase-shipping-note">상품 금액 ${formatPurchasePrice(threshold)} 이상 배송비 무료</p>` : '<p class="purchase-shipping-note">배송비는 확정된 금액을 기준으로 안내합니다.</p>'}${reviewing ? '<div class="purchase-payment-state" role="status"><strong>결제·주문 접수 안내</strong><p>주문 내용을 확인했습니다. 현재 결제와 주문 접수는 제공되지 않으며, 입력한 정보는 전송되지 않습니다.</p></div><button class="purchase-submit" type="button" disabled>결제 서비스 연결 전</button>' : '<button class="purchase-submit" type="submit" form="purchase-form">주문 내용 확인 <span aria-hidden="true">↗</span></button><p class="purchase-payment-note">다음 단계에서 선택한 상품과 배송 정보를 확인합니다. 결제나 주문 접수는 진행되지 않습니다.</p>'}</aside>`;
}

export function renderPurchase(products, selectedSlug, pricing = {}) {
  const product = currentProduct(products, selectedSlug);
  if (!product) return '<section class="section page-section purchase-page"><h1 class="page-title">구매할 제품을 선택해 주세요.</h1></section>';
  const quantity = quantities.get(product.slug) || 1;
  const reviewing = stage === 'review';
  const shipping = reviewing ? `<section class="purchase-panel purchase-shipping-review" aria-labelledby="purchase-shipping-title"><div class="purchase-panel-head"><div><span class="eyebrow">02 / DELIVERY</span><h2 id="purchase-shipping-title">배송 정보</h2></div><button type="button" class="purchase-link" data-purchase-edit>수정하기 ↗</button></div><dl><div><dt>받는 분</dt><dd>${escape(details.name)}</dd></div><div><dt>연락처</dt><dd>${escape(details.phone)}</dd></div><div><dt>배송지</dt><dd>(${escape(details.postcode)}) ${escape(details.address)}${details.addressDetail ? `<br>${escape(details.addressDetail)}` : ''}</dd></div>${details.email ? `<div><dt>이메일</dt><dd>${escape(details.email)}</dd></div>` : ''}${details.deliveryNote ? `<div><dt>요청사항</dt><dd>${escape(details.deliveryNote)}</dd></div>` : ''}</dl><p class="purchase-data-note">배송 정보는 이 화면에서만 확인할 수 있으며, 서버로 전송하거나 사이트 저장소에 보관하지 않습니다.</p></section>` : `<section class="purchase-panel" aria-labelledby="purchase-shipping-title"><span class="eyebrow">02 / DELIVERY</span><h2 id="purchase-shipping-title">배송 정보</h2><div class="purchase-fields">${shippingField('name', '받는 분', { required: true, max: 50, autocomplete: 'shipping name' })}${shippingField('phone', '연락처', { type: 'tel', required: true, max: 20, inputmode: 'tel', autocomplete: 'shipping tel', placeholder: '010-0000-0000' })}${shippingField('postcode', '우편번호', { required: true, max: 5, inputmode: 'numeric', autocomplete: 'shipping postal-code', placeholder: '5자리 우편번호' })}${shippingField('email', '이메일', { type: 'email', max: 254, autocomplete: 'email', placeholder: 'name@example.com' })}${shippingField('address', '기본 주소', { required: true, max: 200, full: true, autocomplete: 'shipping address-line1', placeholder: '도로명 또는 지번 주소' })}${shippingField('addressDetail', '상세 주소', { max: 100, full: true, autocomplete: 'shipping address-line2', placeholder: '동·호수 등 상세 주소' })}<div class="purchase-field purchase-field-wide"><label for="purchase-deliveryNote">배송 요청사항 <span>선택</span></label><textarea id="purchase-deliveryNote" name="deliveryNote" rows="3" maxlength="200" aria-describedby="purchase-deliveryNote-error" placeholder="배송 시 참고할 내용을 입력해 주세요.">${escape(details.deliveryNote)}</textarea><p class="purchase-field-error" id="purchase-deliveryNote-error" role="alert" ${errors.deliveryNote ? '' : 'hidden'}>${escape(errors.deliveryNote || '')}</p></div></div><p class="purchase-data-note">입력한 배송 정보는 이 화면에서만 유지되며, 서버로 전송하거나 사이트 저장소에 보관하지 않습니다.</p></section>`;
  const selection = reviewing ? `<section class="purchase-panel purchase-selection-review"><span class="eyebrow">01 / THE FORMULA</span><div class="purchase-panel-head"><h2>선택한 제품</h2><button type="button" class="purchase-link" data-purchase-edit>수정하기 ↗</button></div><div class="purchase-selected-row"><div><span class="eyebrow">${escape(product.routineStep)}</span><h3>${escape(product.name)} · ${escape(product.volume)}</h3><p>${escape(product.desc)}</p></div><strong>${quantity}개</strong></div><button type="button" class="purchase-link" data-purchase-detail>성분·사용법 확인 ↗</button></section>` : `<section class="purchase-panel" aria-labelledby="purchase-selection-title"><span class="eyebrow">01 / THE FORMULA</span><h2 id="purchase-selection-title">나의 루틴 선택</h2><fieldset class="purchase-product-options"><legend class="sr-only">구매할 제품</legend><div class="purchase-product-grid">${products.map(item => `<label class="purchase-choice"><input type="radio" name="purchase-product" value="${escape(item.slug)}" ${item.slug === product.slug ? 'checked' : ''}><span class="purchase-choice-body"><img src="${escape(item.image)}" alt="" width="${item.imageWidth || 1024}" height="${item.imageHeight || 1536}"><span class="purchase-choice-kind">${escape(item.type)}</span><strong>${escape(item.name)}</strong><span class="purchase-choice-volume">${escape(item.volume)}</span><span class="purchase-choice-price">${formatPurchasePrice(item.price)}</span></span></label>`).join('')}</div></fieldset><div class="purchase-quantity-row"><div><span class="purchase-selected-name">${escape(product.name)}</span><label for="purchase-quantity">수량</label></div><div class="purchase-quantity-control"><button type="button" data-purchase-quantity-change="-1" aria-label="수량 줄이기" ${quantity <= 1 ? 'disabled' : ''}>−</button><input id="purchase-quantity" name="quantity" type="number" min="1" max="99" step="1" inputmode="numeric" value="${quantity}" aria-describedby="purchase-quantity-help"><button type="button" data-purchase-quantity-change="1" aria-label="수량 늘리기" ${quantity >= 99 ? 'disabled' : ''}>＋</button></div></div><p class="purchase-quantity-help" id="purchase-quantity-help">1~99개까지 선택할 수 있습니다.</p><button type="button" class="purchase-link" data-purchase-detail>성분·사용법 확인 ↗</button></section>`;
  return `<section class="section page-section purchase-page"><button type="button" class="purchase-back" data-purchase-back>← 제품으로 돌아가기</button><div class="purchase-page-head"><div><span class="eyebrow">TRANSPARENCY. / SHOP</span><h1 class="page-title" tabindex="-1">${reviewing ? '주문 내용을<br>확인하세요.' : '나의 루틴을<br>선택하세요.'}</h1><p>${reviewing ? '선택한 제품과 배송 정보를 마지막으로 살펴보세요.' : '토너부터 크림까지. 필요한 제품을 필요한 만큼.'}</p></div><ol class="purchase-progress" aria-label="구매 단계"><li ${!reviewing ? 'aria-current="step"' : ''}><b>01</b><span>제품·배송 정보</span></li><li ${reviewing ? 'aria-current="step"' : ''}><b>02</b><span>주문 내용 확인</span></li></ol></div>${reviewing ? `<div class="purchase-grid"><div class="purchase-content">${selection}${shipping}</div>${renderSummary(product, quantity, pricing, true)}</div>` : `<form id="purchase-form" class="purchase-grid" novalidate><div class="purchase-content">${selection}${shipping}</div>${renderSummary(product, quantity, pricing, false)}</form>`}</section>`;
}

export function bindPurchase(products, selectedSlug, callbacks = {}, pricing = {}) {
  const root = document.querySelector('.purchase-page');
  const product = currentProduct(products, selectedSlug);
  if (!root || !product) return;
  const rerender = () => callbacks.onRender?.();
  root.querySelector('[data-purchase-back]')?.addEventListener('click', () => callbacks.onBack?.());
  root.querySelectorAll('[data-purchase-detail]').forEach(button => button.addEventListener('click', () => callbacks.onDetail?.(product.slug)));
  root.querySelectorAll('[data-purchase-edit]').forEach(button => button.addEventListener('click', () => { stage = 'edit'; errors = {}; rerender(); document.querySelector('#purchase-name')?.focus(); }));
  root.querySelectorAll('input[name="purchase-product"]').forEach(input => input.addEventListener('change', () => { stage = 'edit'; errors = {}; callbacks.onProductChange?.(input.value); }));

  function updateAmounts(quantity) {
    const totals = calculatePurchaseTotals(product.price, quantity, pricing);
    root.querySelectorAll('[data-purchase-amount]').forEach(element => {
      const key = element.dataset.purchaseAmount;
      element.textContent = formatPurchasePrice(totals[key], key === 'shippingFee' ? '배송비 안내 예정' : key === 'total' ? '금액 확인 후 안내' : '가격 안내 예정');
    });
    root.querySelectorAll('[data-purchase-quantity]').forEach(element => { element.textContent = totals.quantity; });
    root.querySelectorAll('[data-purchase-quantity-change]').forEach(button => { button.disabled = Number(button.dataset.purchaseQuantityChange) < 0 ? totals.quantity <= 1 : totals.quantity >= 99; });
  }

  const quantityInput = root.querySelector('#purchase-quantity');
  quantityInput?.addEventListener('input', () => {
    if (Number.isInteger(Number(quantityInput.value)) && Number(quantityInput.value) >= 1 && Number(quantityInput.value) <= 99) {
      quantities.set(product.slug, Number(quantityInput.value));
      updateAmounts(Number(quantityInput.value));
    }
  });
  quantityInput?.addEventListener('blur', () => {
    const quantity = quantityFor(quantityInput.value);
    quantities.set(product.slug, quantity);
    quantityInput.value = quantity;
    updateAmounts(quantity);
  });
  root.querySelectorAll('[data-purchase-quantity-change]').forEach(button => button.addEventListener('click', () => {
    const quantity = quantityFor((quantities.get(product.slug) || 1) + Number(button.dataset.purchaseQuantityChange));
    quantities.set(product.slug, quantity);
    if (quantityInput) quantityInput.value = quantity;
    updateAmounts(quantity);
  }));

  const form = root.querySelector('#purchase-form');
  form?.addEventListener('input', event => {
    const field = event.target;
    if (!Object.hasOwn(details, field.name)) return;
    details[field.name] = field.value;
    delete errors[field.name];
    field.removeAttribute('aria-invalid');
    const error = root.querySelector(`#purchase-${field.name}-error`);
    if (error) { error.hidden = true; error.textContent = ''; }
  });
  form?.addEventListener('submit', event => {
    event.preventDefault();
    for (const name of Object.keys(details)) details[name] = String(form.elements.namedItem(name)?.value ?? details[name]).trim();
    quantities.set(product.slug, quantityFor(quantityInput?.value));
    errors = validatePurchaseDetails(details);
    if (Object.keys(errors).length) {
      rerender();
      document.querySelector(`#purchase-${Object.keys(errors)[0]}`)?.focus();
      return;
    }
    stage = 'review';
    rerender();
    document.querySelector('.purchase-page .page-title')?.focus();
  });
}
