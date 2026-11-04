// Contrast text with the active light or dark moving colour field.
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
// Foreground follows the active theme. Existing reading panels and
// selected controls keep their own ink so their content remains readable.
const readingSurface = '.about-banner, .text-btn, .purchase-panel, .info, .product, .product-qr, .empty';

export function createBackdropInk(document) {
  const view = document.defaultView, managed = new Set();
  let previous = -Infinity;
  function update(_renderer, force = false) {
    const now = view.performance.now();
    if (!force && now - previous < 160) return;
    previous = now;
    for (const element of managed) if (!element.isConnected) managed.delete(element);
    let changed = false;
    const color = document.documentElement.dataset.theme === 'dark' ? '#f7fbff' : '#171717';
    function black(element) {
      if (!element || (managed.has(element) && element.style.getPropertyValue('--backdrop-ink') === color)) return;
      managed.add(element);
      element.setAttribute('data-backdrop-ink', '');
      element.style.setProperty('--backdrop-ink', color);
      changed = true;
    }
    for (const element of document.querySelectorAll(selector)) {
      if (element.closest(readingSurface) || element.closest('[data-language-plane="ja"]')) continue;
      black(element);
      const plane = element.closest('[data-site-source-plane]');
      if (plane) {
        const index = [...plane.children].indexOf(element);
        black(plane.parentElement.querySelector('[data-language-plane="ja"]')?.children[index]);
      }
    }
    if (changed) document.dispatchEvent(new view.Event('site-backdrop-ink'));
  }
  function dispose() {
    for (const element of managed) {
      element.removeAttribute('data-backdrop-ink');
      element.style.removeProperty('--backdrop-ink');
    }
    managed.clear();
  }
  return { update, dispose };
}
