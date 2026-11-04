// Foreground-only contrast. The colour field itself is never brightened.
const selector = [
  'header > .logo', 'nav button:not(.active)',
  '.site-hero-title', '[data-site-source-plane] [data-landing-line]',
  '.site-hero-eyebrow', '.site-hero-bottom > p',
  '.section-head .eyebrow', '.section-head h2', '.section-head .text-btn',
  '.principles .principle-title', '.principles h2', '.principles p', '.principles .number',
  '.page-title', '.page-intro', '.page-section > .eyebrow', '.result-count', '.catalog-order-note p',
  '.catalog-order-note > span', '.detail-copy > .eyebrow', '.detail-copy > p',
  '.product-specs dt', '.product-specs dd', '.detail-rating > span', '.detail-rating > strong', '.detail-rating > small',
  '.purchase-page-head p', '.purchase-page-head .eyebrow',
  '.concern-page-intro > h1', '.concern-page-intro > p', '.concern-page-intro > .eyebrow',
  '.concern-search-meta > p', '.concern-search-meta > output', '.concern-scene-caption',
].join(',');
const readingSurface = '.about-banner, .text-btn, .purchase-panel, .info, .product, .product-qr, .empty';
function inkBounds(element, document) {
  const walker = document.createTreeWalker(element, document.defaultView.NodeFilter.SHOW_TEXT);
  const range = document.createRange(), rects = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim() || node.parentElement.closest('[data-language-plane="ja"],svg,[aria-hidden="true"]')) continue;
    range.selectNodeContents(node);
    rects.push(...[...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0));
  }
  range.detach?.();
  if (!rects.length) return element.getBoundingClientRect();
  const left = Math.min(...rects.map(rect=>rect.left)), top = Math.min(...rects.map(rect=>rect.top));
  const right = Math.max(...rects.map(rect=>rect.right)), bottom = Math.max(...rects.map(rect=>rect.bottom));
  return { left, top, right, bottom, width: right-left, height: bottom-top };
}
const luminance = rgb => {
  const c = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
};

// A small, static colour map mirrors the CSS fallback when WebGL is unavailable.
// It contains only gradients, never a capture of page content.
function fallbackSampler(document, palette) {
  let cache = null, aspect = 0;
  return points => {
    const nextAspect = document.defaultView.innerHeight / document.documentElement.clientWidth;
    if (!cache || aspect !== nextAspect) {
      aspect = nextAspect;
      const canvas = document.createElement('canvas');
      canvas.width = 160; canvas.height = Math.max(1, Math.round(160 * aspect));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return null;
      const w = canvas.width, h = canvas.height;
      const white = palette.white || '#f8faff', blue = palette.blue || '#3574e8', black = palette.black || '#030811';
      const extent = (w + h) / 4;
      const base = context.createLinearGradient(w/2-extent, h/2-extent, w/2+extent, h/2+extent);
      [[0,white],[.34,blue],[.62,black],[.88,blue],[1,white]].forEach(([at,color])=>base.addColorStop(at,color));
      context.fillStyle = base; context.fillRect(0,0,w,h);
      for (const [x,y,stop,color] of [[0,.02,.12,white],[.74,.20,.18,black]]) {
        context.save(); context.translate(x*w,y*h);
        context.scale(Math.max(x,1-x)*w*Math.SQRT2, Math.max(y,1-y)*h*Math.SQRT2);
        const radial = context.createRadialGradient(0,0,0,0,0,1);
        radial.addColorStop(0,color); radial.addColorStop(stop,color);
        radial.addColorStop(color === white ? .55 : .63, 'transparent');
        context.fillStyle = radial; context.fillRect(-3,-3,6,6); context.restore();
      }
      cache = { w, h, pixels: context.getImageData(0,0,w,h).data };
    }
    return points.map(([x,y]) => {
      const index = (Math.min(cache.h-1,Math.floor(y*cache.h))*cache.w+Math.min(cache.w-1,Math.floor(x*cache.w)))*4;
      return [cache.pixels[index]/255,cache.pixels[index+1]/255,cache.pixels[index+2]/255];
    });
  };
}

export function createBackdropInk(document, palette = {}) {
  const view = document.defaultView, managed = new Map();
  const fallback = fallbackSampler(document, palette);
  let previous = -Infinity;
  function update(renderer, force = false) {
    const now = view.performance.now();
    if (!force && now - previous < 160) return;
    previous = now;
    for (const element of managed.keys()) if (!element.isConnected) managed.delete(element);
    const width = document.documentElement.clientWidth, height = view.innerHeight;
    const entries = [];
    for (const element of document.querySelectorAll(selector)) {
      const rect = inkBounds(element, document);
      if (rect.width < 2 || rect.height < 2 || rect.bottom <= 0 || rect.top >= height || element.closest('[data-language-plane="ja"]')) continue;
      const coords = [[.08, .5], [.5, .5], [.92, .5], [.5, .2], [.5, .8]];
      entries.push({ element, alpha: element.closest(readingSurface) ? .70 : element.closest('header,nav') ? .20 : 0, points: coords.map(([x,y]) => [Math.max(0, Math.min(1, (rect.left + rect.width*x)/width)), Math.max(0, Math.min(1, (rect.top + rect.height*y)/height))]) });
    }
    const points = entries.flatMap(entry => entry.points);
    const colors = renderer?.sample ? renderer.sample(points) : fallback(points);
    if (!colors) return;
    let changed = false, offset = 0;
    for (const { element, alpha } of entries) {
      const values = colors.slice(offset, offset += 5).map(rgb => luminance(rgb.map(v => v * (1-alpha) + alpha)));
      const darkScore = (Math.min(...values)+.05)/(.012+.05);
      const lightScore = (1+.05)/(Math.max(...values)+.05);
      const last = managed.get(element);
      let light = lightScore > darkScore;
      if (last && Math.abs(lightScore-darkScore) < .45) light = last.light;
      if (last?.light === light) continue;
      managed.set(element, { light });
      element.setAttribute('data-backdrop-ink', '');
      element.style.setProperty('--backdrop-ink', light ? '#ffffff' : '#151d27');
      const plane = element.closest('[data-site-source-plane]');
      if (plane) {
        const index = [...plane.children].indexOf(element);
        const translated = plane.parentElement.querySelector('[data-language-plane="ja"]')?.children[index];
        if (translated) {
          translated.setAttribute('data-backdrop-ink', '');
          translated.style.setProperty('--backdrop-ink', light ? '#ffffff' : '#151d27');
        }
      }
      changed = true;
    }
    if (changed) document.dispatchEvent(new view.Event('site-backdrop-ink'));
  }
  function dispose() {
    for (const element of document.querySelectorAll('[data-backdrop-ink]')) {
      element.removeAttribute('data-backdrop-ink'); element.style.removeProperty('--backdrop-ink');
    }
    managed.clear();
  }
  return { update, dispose };
}
