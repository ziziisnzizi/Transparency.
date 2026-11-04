import { createSiteBackground } from './site-background.js';
import { siteEffectsConfig } from './site-effects-config.js';

const mounted = new WeakMap();
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// One global decorative surface survives every app render. Pointer listeners are
// passive; foreground HTML, native scrolling, text and product images stay intact.
export function mountAmbientBackground(document = globalThis.document) {
  mounted.get(document)?.();
  const view = document.defaultView;
  const config = siteEffectsConfig.background || {};
  const layer = document.createElement('div');
  layer.className = 'ambient-background';
  layer.setAttribute('data-ambient-background', '');
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="ambient-wave-fallback"></div><canvas class="ambient-wave-canvas" data-ambient-wave-canvas></canvas>';
  document.body.append(layer);
  const canvas = layer.querySelector('canvas');
  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = view.matchMedia('(prefers-reduced-transparency: reduce)');
  const contrast = view.matchMedia('(prefers-contrast: more)');
  const forcedColors = view.matchMedia('(forced-colors: active)');
  const coarse = view.matchMedia('(pointer: coarse)');
  let renderer = null, failed = false, disposed = false;
  let frame = 0, previous = 0, time = 0, geometryDirty = true;
  let width = 1, height = 1, poster = false;
  const pointer = { x: 0, y: 0, active: 0 }, target = { x: 0, y: 0, active: 0 };
  const posters = new Map(), cleanups = [];
  const hidden = () => transparency.matches || contrast.matches || forcedColors.matches;
  const still = () => motion.matches || hidden();
  const active = () => !disposed && layer.isConnected && !document.hidden;
  const listen = (element, name, callback, options) => {
    element.addEventListener(name, callback, options);
    cleanups.push(() => element.removeEventListener(name, callback, options));
  };
  layer.dataset.renderer = 'css';
  for (const [name, color] of Object.entries(config.palette || {})) {
    if (typeof color === 'string' && /^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(color)) layer.style.setProperty(`--site-bg-${name}`, color);
  }

  function measure() {
    width = Math.max(1, document.documentElement.clientWidth);
    height = Math.max(1, view.innerHeight);
    const maxRatio = Math.max(.5, Number(config.maxPixelRatio) || 1.5);
    const budget = Math.max(100000, Number(config.pixelBudget) || 1800000);
    const scale = Math.min(view.devicePixelRatio || 1, coarse.matches ? Math.min(1.25, maxRatio) : maxRatio, Math.sqrt(budget / (width * height)));
    renderer?.resize(width, height, scale);
    geometryDirty = false;
  }
  function paint() {
    if (!active()) return;
    layer.dataset.suppressed = String(hidden());
    // High-contrast/opaque modes use the CSS solid surface without any GL work.
    if (hidden()) return;
    if (!renderer && !failed) {
      renderer = createSiteBackground(canvas, config);
      failed = !renderer;
      layer.dataset.renderer = renderer ? 'webgl' : 'css';
      geometryDirty = true;
    }
    if (geometryDirty) measure();
    layer.style.setProperty('--ambient-shift-x', `${(pointer.x * pointer.active * 24).toFixed(2)}px`);
    layer.style.setProperty('--ambient-shift-y', `${(pointer.y * pointer.active * 18).toFixed(2)}px`);
    renderer?.render({ time: still() ? Number(config.staticTime) || 3.4 : time, pointer,
      dark: document.documentElement.dataset.theme === 'dark', poster });
  }
  function tick(stamp) {
    frame = 0;
    if (!active()) return;
    if (!previous || stamp - previous >= 1000 / 30) {
      const elapsed = previous ? Math.min((stamp - previous) / 1000, .15) : 1 / 30;
      previous = stamp;
      time += Math.min(elapsed, .1);
      const response = 1 - Math.exp(-elapsed * (Number(config.followRate) || 7));
      pointer.x += (target.x - pointer.x) * response;
      pointer.y += (target.y - pointer.y) * response;
      pointer.active += (target.active - pointer.active) * response;
      paint();
    }
    const settling = Math.abs(target.x - pointer.x) + Math.abs(target.y - pointer.y) + Math.abs(target.active - pointer.active) > .002;
    if (!still() && (renderer || settling)) frame = view.requestAnimationFrame(tick);
  }
  function schedule() { if (!frame && active() && !still()) frame = view.requestAnimationFrame(tick); }
  function sync() {
    view.cancelAnimationFrame(frame); frame = 0; previous = 0;
    layer.dataset.paused = String(!active() || still());
    if (still()) { target.x = target.y = target.active = pointer.x = pointer.y = pointer.active = 0; }
    if (active()) { paint(); schedule(); }
  }
  function updatePoster() {
    const next = Boolean(document.querySelector('.concerns-page.is-empty')) || [...posters.values()].some(Boolean);
    const changed = next !== poster;
    poster = next;
    layer.dataset.scene = poster ? 'poster' : 'page';
    document.body.dataset.siteArt = poster ? 'poster' : 'page';
    if (changed) sync();
  }
  const intersection = new view.IntersectionObserver(entries => {
    for (const entry of entries) if (posters.has(entry.target)) posters.set(entry.target, entry.isIntersecting && entry.intersectionRatio > 0);
    updatePoster();
  }, { threshold: [0, .01] });
  function scanPosters() {
    const current = new Set(document.querySelectorAll('[data-site-poster]'));
    for (const element of posters.keys()) if (!current.has(element)) { intersection.unobserve(element); posters.delete(element); }
    for (const element of current) if (!posters.has(element)) {
      const bounds = element.getBoundingClientRect();
      posters.set(element, bounds.bottom > 0 && bounds.top < view.innerHeight && bounds.width > 0 && bounds.height > 0);
      intersection.observe(element);
    }
    updatePoster();
  }
  const point = event => {
    if (!active() || still() || coarse.matches || event.pointerType === 'touch') return;
    target.x = clamp(event.clientX / width * 2 - 1, -1, 1);
    target.y = clamp(event.clientY / height * 2 - 1, -1, 1);
    target.active = 1;
    schedule();
  };
  const recenter = () => { target.active = 0; schedule(); };
  listen(view, 'pointermove', point, { passive: true });
  listen(view, 'pointerdown', event => { if (event.button <= 0) point(event); }, { passive: true });
  listen(document.documentElement, 'pointerleave', recenter, { passive: true });
  listen(view, 'pointercancel', recenter, { passive: true });
  listen(view, 'blur', recenter);
  listen(view, 'resize', () => { geometryDirty = true; if (active()) paint(); schedule(); }, { passive: true });
  listen(document, 'visibilitychange', sync);
  for (const preference of [motion, transparency, contrast, forcedColors]) listen(preference, 'change', sync);
  listen(coarse, 'change', () => { if (coarse.matches) target.active = pointer.active = 0; sync(); });
  const theme = new view.MutationObserver(sync);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const scenes = new view.MutationObserver(scanPosters);
  scenes.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  const size = new view.ResizeObserver(() => { geometryDirty = true; if (active()) paint(); schedule(); });
  size.observe(document.documentElement);
  listen(canvas, 'webglcontextlost', event => {
    if (disposed) return;
    event.preventDefault(); const previousRenderer = renderer; renderer = null; failed = true;
    previousRenderer?.dispose(); canvas.width = canvas.height = 1;
    layer.dataset.renderer = 'css'; sync();
  });

  function dispose() {
    if (disposed) return;
    disposed = true; view.cancelAnimationFrame(frame); frame = 0;
    cleanups.forEach(cleanup => cleanup()); theme.disconnect(); scenes.disconnect(); size.disconnect(); intersection.disconnect();
    renderer?.dispose(); renderer = null; posters.clear();
    canvas.width = canvas.height = 1; layer.remove(); delete document.body.dataset.siteArt;
    if (mounted.get(document) === dispose) mounted.delete(document);
  }
  mounted.set(document, dispose); scanPosters(); sync();
  return dispose;
}
