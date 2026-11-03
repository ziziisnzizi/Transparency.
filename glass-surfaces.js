// Native backdrop refraction: each transparent surface samples the live pixels
// behind it. Maps contain only optical normals, never page text or screenshots.
const SVG_NS = 'http://www.w3.org/2000/svg';
const EXCLUDED = '[data-glass-definitions], [data-glass-plane], [data-glass-clip], [data-html-lens-layer], .concern-water';
const SELECTOR = [
  'header', 'nav', '.filters', '.tabs',
  'nav button.active', '.filters button.chosen', '.tabs button.chosen',
  '.hero-copy', '.hero-bottom>span', '.principles>div:not(:first-child)',
  '.product', '.product-image', '.bottle-scene', '.bottom-grid>div',
  '.detail-image', '.info', '.info-note', '.my-row', '.my-product-image',
  '.shelf-summary', '.empty', '.empty-mark', '.about-banner', '.about-list',
  'footer', '.product-qr', '.ingredient-list article', '.research-grid article',
  '.evidence-status', '.product-reviews .review-entry', '.product-reviews .review-form',
  '.product-reviews .review-empty', '.product-questions', '.question-compose',
  '.product-questions .question-message', '.product-questions .question-sources li',
  '.purchase-page .purchase-panel', '.purchase-page .purchase-payment-state',
  '.purchase-page .purchase-quantity-control', '.purchase-page .purchase-choice-body',
  '.product-evidence .evidence-ingredient', '.product-evidence .evidence-paper',
  '.product-evidence .evidence-finished-note', '.product-evidence .evidence-methods',
  '.product-evidence .evidence-detail-limit', '.product-evidence .evidence-detail-scope',
  '.product-evidence .evidence-dialog', '.product-evidence .evidence-dialog-top',
  '.concerns-page .concern-finding', '.concerns-page .concern-paper',
  '.concerns-page .concern-news-card', '.concerns-page .concern-product',
  '.concerns-page .concern-precautions', '.concerns-page .concern-suggestions>button',
  '.concerns-page .concern-lens-control',
  '.concerns-page .concern-topic-tags>span', '.concerns-page .concern-quiet-tag',
  '.concerns-page .concern-more-research>summary',
  '.account', '.theme-toggle', '.text-btn', '.badge', '.status-badge', '.round-arrow',
  '.texture-toggle', '.my-actions button', '.qr-downloads a',
  '.product-questions .question-mode', '.product-questions .question-suggestions button',
  '.product-questions .question-cancel', '.product-reviews .review-rating-grid label>span',
  '.product-evidence .evidence-paper-meta>span', '.product-evidence .evidence-filter-group button',
  '.product-evidence .evidence-original a',
  '.dark', '.product-reviews .review-submit', '.product-questions .question-send',
  '.purchase-page .purchase-submit', '.brand-statement',
].join(',');

const mounted = new WeakMap();
let nextFilter = 0;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function svgElement(document, name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function radiusValue(value, width, height) {
  const number = Number.parseFloat(value) || 0;
  return clamp(value.includes('%') ? number / 100 * Math.min(width, height) : number, 0, Math.min(width, height) / 2);
}

function opticalMap(document, width, height, radii, pad, bevel) {
  const fullWidth = width + pad * 2, fullHeight = height + pad * 2;
  // This is a slowly varying normal field, not a raster of the page. Limit the
  // map's working pixels while the browser samples the backdrop at native DPR.
  const ratio = Math.min(1.5, 1024 / fullWidth, 768 / fullHeight, Math.sqrt(300000 / (fullWidth * fullHeight)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(fullWidth * ratio));
  canvas.height = Math.max(1, Math.ceil(fullHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Optical map unavailable');
  const pixels = context.createImageData(canvas.width, canvas.height);
  const xScale = fullWidth / canvas.width, yScale = fullHeight / canvas.height;
  for (let y = 0; y < canvas.height; y++) {
    const py = (y + .5) * yScale - pad - height / 2;
    for (let x = 0; x < canvas.width; x++) {
      const px = (x + .5) * xScale - pad - width / 2;
      const radius = radii[py < 0 ? (px < 0 ? 0 : 1) : (px < 0 ? 3 : 2)];
      const qx = Math.abs(px) - width / 2 + radius;
      const qy = Math.abs(py) - height / 2 + radius;
      const ax = Math.max(qx, 0), ay = Math.max(qy, 0);
      const length = Math.hypot(ax, ay);
      const distance = length + Math.min(Math.max(qx, qy), 0) - radius;
      let nx = 0, ny = 0;
      if (length > .0001) { nx = ax / length * Math.sign(px); ny = ay / length * Math.sign(py); }
      else if (qx > qy) nx = Math.sign(px);
      else ny = Math.sign(py);
      const depth = -distance;
      const bend = depth > 0 && depth < bevel ? Math.sin(Math.PI * depth / bevel) ** .9 : 0;
      const index = (y * canvas.width + x) * 4;
      pixels.data[index] = Math.round(127.5 + nx * bend * 122);
      pixels.data[index + 1] = Math.round(127.5 + ny * bend * 122);
      pixels.data[index + 2] = 128;
      pixels.data[index + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL('image/png');
  canvas.width = canvas.height = 1;
  return url;
}

function makeFilter(document, defs, geometry) {
  const { width, height, radii, pad, bevel, strength, blur } = geometry;
  const id = `transparency-backdrop-${++nextFilter}`;
  const fullWidth = width + pad * 2, fullHeight = height + pad * 2;
  const filter = svgElement(document, 'filter', {
    id, x: 0, y: 0, width: fullWidth, height: fullHeight,
    filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  });
  filter.append(svgElement(document, 'feImage', {
    href: opticalMap(document, width, height, radii, pad, bevel),
    x: 0, y: 0, width: fullWidth, height: fullHeight,
    preserveAspectRatio: 'none', result: 'optical-normal',
  }));
  filter.append(svgElement(document, 'feGaussianBlur', {
    in: 'SourceGraphic', stdDeviation: blur, result: 'frosted-backdrop',
  }));
  for (const [channel, factor, values] of [
    ['red', 1.045, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
    ['green', 1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
    ['blue', .955, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0'],
  ]) {
    filter.append(svgElement(document, 'feDisplacementMap', {
      in: 'frosted-backdrop', in2: 'optical-normal', scale: strength * factor,
      xChannelSelector: 'R', yChannelSelector: 'G', result: `${channel}-ray`,
    }));
    filter.append(svgElement(document, 'feColorMatrix', {
      in: `${channel}-ray`, type: 'matrix', values, result: channel,
    }));
  }
  filter.append(svgElement(document, 'feBlend', { in: 'red', in2: 'green', mode: 'screen', result: 'red-green' }));
  filter.append(svgElement(document, 'feBlend', { in: 'red-green', in2: 'blue', mode: 'screen' }));
  defs.append(filter);
  return { id, node: filter, refs: 0 };
}

export function mountGlassSurfaces(scope = document) {
  mounted.get(scope)?.();
  const document = scope.nodeType === 9 ? scope : scope.ownerDocument;
  const view = document.defaultView;
  // SVG backdrop URL filters are verified in Chromium. Other engines keep the
  // existing translucent/blur material instead of risking an empty backdrop.
  const chromium = !!view.chrome || /(?:Chrome|Chromium|Edg)\//.test(view.navigator.userAgent);
  if (!chromium || !view.CSS?.supports('backdrop-filter', 'url("#transparency-backdrop-test")')) return () => {};
  const host = svgElement(document, 'svg', { 'aria-hidden': 'true', focusable: 'false', 'data-glass-definitions': '', 'data-html-lens-exclude': '', width: 0, height: 0 });
  host.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:0;height:0;overflow:hidden;pointer-events:none';
  const defs = svgElement(document, 'defs');host.append(defs);document.body.append(host);
  const targets = new Map(), filters = new Map(), dirty = new Set();
  const preferences = ['(prefers-reduced-transparency: reduce)', '(forced-colors: active)', '(prefers-contrast: more)'].map(query => view.matchMedia(query));
  let disposed = false, scheduled = 0;
  const enabled = () => !disposed && !document.hidden && !preferences.some(preference => preference.matches);

  function detach(record) {
    record.element.removeAttribute('data-glass-refraction');
    record.element.removeAttribute('data-glass-position');
    record.element.style.removeProperty('--glass-refraction-filter');
    record.clip?.remove();record.clip = null;record.plane = null;
    if (record.key) {
      const filter = filters.get(record.key);
      if (filter && --filter.refs <= 0) { filter.node.remove();filters.delete(record.key); }
    }
    record.key = '';
  }

  function update(record) {
    if (!record.element.isConnected || !enabled() || !record.visible) return detach(record);
    const element = record.element;
    // Recheck the author's responsive positioning, not our previous helper
    // attribute (a mobile static panel can become sticky on a wide viewport).
    element.removeAttribute('data-glass-position');
    const style = view.getComputedStyle(element);
    const useRelative = style.position === 'static';
    const rect = element.getBoundingClientRect();
    const styledWidth = style.boxSizing === 'border-box' ? Number.parseFloat(style.width) : 0;
    const styledHeight = style.boxSizing === 'border-box' ? Number.parseFloat(style.height) : 0;
    const width = Math.round((styledWidth || element.offsetWidth || rect.width) * 2) / 2;
    const height = Math.round((styledHeight || element.offsetHeight || rect.height) * 2) / 2;
    if (width < 8 || height < 8 || style.display === 'none' || style.visibility === 'hidden') return detach(record);
    const radii = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(value => radiusValue(value, width, height));
    const bevel = Math.min(21, Math.max(5, Math.min(width, height) * .28));
    const strength = Math.min(29, Math.max(6, bevel * 1.35));
    const pad = Math.ceil(strength + 8);
    const blur = element.matches('header, nav, .filters, .tabs') ? .9 : 1.25;
    const key = [width, height, element.clientWidth, element.clientHeight, ...radii.map(value => Math.round(value * 2) / 2), pad, bevel.toFixed(2), strength.toFixed(2), blur].join(':');
    if (record.key === key && record.plane?.isConnected) {
      if (useRelative) element.setAttribute('data-glass-position', 'relative');
      return;
    }
    detach(record);
    let filter = filters.get(key);
    if (!filter) { filter = makeFilter(document, defs, { width, height, radii, pad, bevel, strength, blur });filters.set(key, filter); }
    filter.refs++;record.key = key;
    const clip = document.createElement('span');
    clip.setAttribute('aria-hidden', 'true');clip.setAttribute('data-glass-clip', '');clip.setAttribute('data-html-lens-exclude', '');
    const plane = document.createElement('span');
    plane.setAttribute('aria-hidden', 'true');plane.setAttribute('data-glass-plane', '');plane.setAttribute('data-html-lens-exclude', '');
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0, borderTop = Number.parseFloat(style.borderTopWidth) || 0;
    Object.assign(clip.style, {
      position: 'absolute', left: '0', top: '0',
      width: `${element.clientWidth}px`, height: `${element.clientHeight}px`,
      overflow: 'clip', pointerEvents: 'none', zIndex: '-1',
      borderRadius: radii.map(value => `${Math.max(0,value-Math.max(borderLeft,borderTop))}px`).join(' '),
      transform: `translate3d(${element.scrollLeft}px,${element.scrollTop}px,0)`,
    });
    Object.assign(plane.style, {
      position: 'absolute', pointerEvents: 'none', zIndex: '-1',
      left: `${-pad - borderLeft}px`, top: `${-pad - borderTop}px`,
      width: `${width + pad * 2}px`, height: `${height + pad * 2}px`,
      clipPath: `inset(${pad}px round ${radii.map(value => `${value}px`).join(' ')})`,
      backdropFilter: `url("#${filter.id}")`, webkitBackdropFilter: `url("#${filter.id}")`,
    });
    element.style.setProperty('--glass-refraction-filter', `url("#${filter.id}")`);
    if (useRelative) element.setAttribute('data-glass-position', 'relative');
    element.setAttribute('data-glass-refraction', '');
    clip.append(plane);element.prepend(clip);record.clip = clip;record.plane = plane;
  }

  function flush() {
    scheduled = 0;
    if (disposed) return;
    for (const record of dirty) { try { update(record); } catch { detach(record); } }
    dirty.clear();
  }
  function enqueue(record) {
    dirty.add(record);
    if (!scheduled && !disposed) scheduled = view.requestAnimationFrame(flush);
  }
  const resize = new view.ResizeObserver(entries => entries.forEach(entry => { const record = targets.get(entry.target);if (record) enqueue(record); }));
  const intersection = new view.IntersectionObserver(entries => entries.forEach(entry => {
    const record = targets.get(entry.target);
    if (record) { record.visible = entry.isIntersecting;enqueue(record); }
  }), { rootMargin: '120px' });

  function scan() {
    if (disposed) return;
    const current = new Set(scope.querySelectorAll(SELECTOR));
    for (const [element, record] of targets) if (!current.has(element) || !element.isConnected) {
      detach(record);resize.unobserve(element);intersection.unobserve(element);element.removeEventListener('scroll',record.scroll);dirty.delete(record);targets.delete(element);
    }
    for (const element of current) {
      if (targets.has(element) || element.closest(EXCLUDED)) continue;
      const bounds = element.getBoundingClientRect();
      const record = { element, plane: null, clip: null, key: '', visible: bounds.bottom > -120 && bounds.top < view.innerHeight + 120 && bounds.right > -120 && bounds.left < view.innerWidth + 120 };
      record.scroll = () => { if(record.clip)record.clip.style.transform=`translate3d(${element.scrollLeft}px,${element.scrollTop}px,0)`; };
      element.addEventListener('scroll',record.scroll,{passive:true});
      targets.set(element, record);resize.observe(element);intersection.observe(element);enqueue(record);
    }
  }
  const ownMutation = record => record.target instanceof view.Element && !!record.target.closest('[data-glass-definitions], [data-glass-plane], [data-glass-clip]') || [...record.addedNodes, ...record.removedNodes].every(node => node.nodeType === 1 && node.matches('[data-glass-plane], [data-glass-clip], [data-glass-definitions]'));
  const mutations = new view.MutationObserver(records => { if (records.some(record => !ownMutation(record))) scan(); });
  mutations.observe(scope.nodeType === 9 ? document.body : scope, { childList: true, subtree: true });
  const refresh = () => {
    if (!enabled()) {
      view.cancelAnimationFrame(scheduled);scheduled = 0;dirty.clear();targets.forEach(detach);
      return;
    }
    targets.forEach(enqueue);scan();
  };
  for (const preference of preferences) preference.addEventListener('change', refresh);
  document.addEventListener('visibilitychange', refresh);
  // A dialog can enter the top layer without changing its child nodes.
  document.addEventListener('toggle', refresh, true);
  scan();

  function dispose() {
    if (disposed) return;
    disposed = true;view.cancelAnimationFrame(scheduled);scheduled = 0;
    mutations.disconnect();resize.disconnect();intersection.disconnect();
    for (const preference of preferences) preference.removeEventListener('change', refresh);
    document.removeEventListener('visibilitychange', refresh);document.removeEventListener('toggle', refresh, true);
    targets.forEach(record=>{record.element.removeEventListener('scroll',record.scroll);detach(record);});targets.clear();dirty.clear();filters.clear();host.remove();
    if (mounted.get(scope) === dispose) mounted.delete(scope);
  }
  mounted.set(scope, dispose);
  return dispose;
}
