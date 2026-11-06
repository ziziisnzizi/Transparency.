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
  const luminance = ([r, g, b]) => {
    const linear = value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    return .2126 * linear(r) + .7152 * linear(g) + .0722 * linear(b);
  };
  function update(renderer, force = false) {
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
    const visible = [];
    for (const element of document.querySelectorAll(selector)) {
      if (element.closest(readingSurface) || element.closest('[data-language-plane="ja"]')) continue;
      black(element);
      if (!element.querySelector('[data-site-source-plane]')) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const textRects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
        range.detach?.();
        const rects = (textRects.length ? textRects : [element.getBoundingClientRect()]).filter(rect =>
          rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < view.innerHeight && rect.right > 0 && rect.left < view.innerWidth);
        if (rects.length) visible.push({ element, rects });
      }
      const plane = element.closest('[data-site-source-plane]');
      if (plane) {
        const index = [...plane.children].indexOf(element);
        black(plane.parentElement.querySelector('[data-language-plane="ja"]')?.children[index]);
      }
    }
    // Estimate from the same procedural field on the CPU: no GPU readback.
    // Sample text bounds instead of empty grid columns, so short labels do
    // not change colour when an unrelated dark area moves behind the row.
    const darkMode = document.documentElement.dataset.theme === 'dark';
    const points = [], slices = [];
    if (!darkMode && renderer?.estimate) {
      const width = Math.max(1, view.innerWidth), height = Math.max(1, view.innerHeight);
      for (const { element, rects } of visible) {
        const start = points.length;
        for (const rect of rects) {
          const fractions = rect.width > 100 ? [.03, .25, .5, .75, .97] : [.1, .5, .9];
          for (const fraction of fractions) points.push([
            Math.min(1, Math.max(0, (rect.left + rect.width * fraction) / width)),
            Math.min(1, Math.max(0, (rect.top + rect.height * .5) / height)),
          ]);
        }
        slices.push({ element, start, end: points.length });
      }
    }
    const colors = points.length ? renderer.estimate(points) : null;
    for (const element of managed) {
      if (element.closest('[data-language-plane="ja"]')) continue;
      const slice = slices.find(item => item.element === element);
      const values = colors && slice ? colors.slice(slice.start, slice.end).map(luminance) : [];
      const wasInverse = element.hasAttribute('data-ink-inverse');
      const wasHalo = element.hasAttribute('data-ink-halo');
      // The nav has a light glass layer over the canvas; only respond to very
      // dark samples there. Hysteresis prevents flicker near moving boundaries.
      const header = Boolean(element.closest('header, nav'));
      const threshold = (header ? .035 : .15) + (wasInverse ? .05 : 0);
      const darkFraction = values.length ? values.filter(value => value < threshold).length / values.length : 0;
      const inverse = !darkMode && values.length > 0 && darkFraction >= (wasInverse ? .33 : .4);
      const halo = !darkMode && !inverse && values.some(value => value < (header ? .05 : .20) + (wasHalo ? .04 : 0));
      if (inverse !== wasInverse) { element.toggleAttribute('data-ink-inverse', inverse); changed = true; }
      if (halo !== wasHalo) { element.toggleAttribute('data-ink-halo', halo); changed = true; }
    }
    // Translation is painted on a second plane at the same location. Mirror
    // the contrast choice to keep the original and lens text consistent.
    for (const element of managed) {
      if (element.closest('[data-language-plane="ja"]')) continue;
      const plane = element.closest('[data-site-source-plane]');
      if (!plane) continue;
      const counterpart = plane.parentElement.querySelector('[data-language-plane="ja"]')?.children[[...plane.children].indexOf(element)];
      for (const name of ['data-ink-inverse', 'data-ink-halo']) if (counterpart && counterpart.hasAttribute(name) !== element.hasAttribute(name)) {
        counterpart.toggleAttribute(name, element.hasAttribute(name)); changed = true;
      }
    }
    if (changed) document.dispatchEvent(new view.Event('site-backdrop-ink'));
  }
  function dispose() {
    for (const element of managed) {
      element.removeAttribute('data-backdrop-ink');
      element.removeAttribute('data-ink-inverse');
      element.removeAttribute('data-ink-halo');
      element.style.removeProperty('--backdrop-ink');
    }
    managed.clear();
  }
  return { update, dispose };
}
