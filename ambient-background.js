import { createPastelWaveRenderer } from './pastel-waves.js';

const mounted = new WeakMap();
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// One decorative background survives app navigation. It never samples, captures
// or distorts the HTML, and never intercepts a pointer or keyboard event.
export function mountAmbientBackground(document = globalThis.document) {
  mounted.get(document)?.();
  const view = document.defaultView;
  const layer = document.createElement('div');
  layer.className = 'ambient-background';
  layer.setAttribute('data-ambient-background', '');
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="ambient-wave-fallback"></div><canvas class="ambient-wave-canvas" data-ambient-wave-canvas></canvas>';
  document.body.append(layer);
  let canvas = layer.querySelector('canvas');
  let renderer = createPastelWaveRenderer(canvas, { dark: document.documentElement.dataset.theme === 'dark' });
  if (renderer) canvas = renderer.canvas;
  layer.dataset.renderer = renderer ? 'webgl' : 'css';
  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = view.matchMedia('(prefers-reduced-transparency: reduce)');
  const contrast = view.matchMedia('(prefers-contrast: more)');
  const forcedColors = view.matchMedia('(forced-colors: active)');
  const coarse = view.matchMedia('(pointer: coarse)').matches;
  let disposed = false, frame = 0, previous = 0, time = 0, geometryDirty = true;
  let width = 1, height = 1;
  const pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  const ripples = [], cleanups = [];
  const still = () => motion.matches || transparency.matches || contrast.matches || forcedColors.matches;
  const hidden = () => transparency.matches || contrast.matches || forcedColors.matches;
  const active = () => !disposed && layer.isConnected && !document.hidden;
  const listen = (element, name, callback, options) => {
    element.addEventListener(name, callback, options);
    cleanups.push(() => element.removeEventListener(name, callback, options));
  };

  function measure() {
    width = Math.max(1, document.documentElement.clientWidth);
    height = Math.max(1, view.innerHeight);
    const scale = Math.min(view.devicePixelRatio || 1, coarse ? 1.25 : 1.5, Math.sqrt(1200000 / (width * height)));
    renderer?.resize(width, height, scale);
    geometryDirty = false;
  }
  function paint() {
    if (disposed) return;
    if (geometryDirty) measure();
    layer.style.setProperty('--ambient-shift-x', `${(pointer.x * 22).toFixed(2)}px`);
    layer.style.setProperty('--ambient-shift-y', `${(pointer.y * 16).toFixed(2)}px`);
    renderer?.render({ time: still() ? 3.4 : time, pointer, ripples,
      dark: document.documentElement.dataset.theme === 'dark', hidden: hidden() });
  }
  function tick(stamp) {
    frame = 0;
    if (!active()) return;
    if (!previous || stamp - previous >= 1000 / 30) {
      const elapsed = previous ? Math.min((stamp - previous) / 1000, .15) : 1 / 30;
      previous = stamp;
      time += Math.min(elapsed, .1);
      const response = 1 - Math.exp(-elapsed * 7);
      pointer.x += (target.x - pointer.x) * response;
      pointer.y += (target.y - pointer.y) * response;
      while (ripples.length && time - ripples[0].started > 3) ripples.shift();
      paint();
    }
    const settling = Math.abs(target.x-pointer.x) + Math.abs(target.y-pointer.y) > .002;
    if (!still() && (renderer || settling)) frame = view.requestAnimationFrame(tick);
  }
  function schedule() { if (!frame && active() && !still()) frame = view.requestAnimationFrame(tick); }
  function sync() {
    view.cancelAnimationFrame(frame);frame = 0;previous = 0;
    layer.dataset.paused = String(!active() || still());
    if (still()) { target.x = target.y = pointer.x = pointer.y = 0;ripples.length = 0; }
    if (active()) { paint();schedule(); }
  }
  listen(view, 'pointermove', event => {
    if (!active() || still()) return;
    target.x = clamp(event.clientX / width * 2 - 1, -1, 1);
    target.y = clamp(event.clientY / height * 2 - 1, -1, 1);
    schedule();
  }, { passive: true });
  listen(view, 'pointerdown', event => {
    if (!active() || still() || event.button > 0) return;
    target.x = clamp(event.clientX / width * 2 - 1, -1, 1);
    target.y = clamp(event.clientY / height * 2 - 1, -1, 1);
    ripples.push({ x: clamp(event.clientX / width, 0, 1), y: clamp(event.clientY / height, 0, 1), started: time });
    if (ripples.length > 4) ripples.shift();
    schedule();
  }, { passive: true });
  const recenter = () => { target.x = target.y = 0;schedule(); };
  listen(document.documentElement, 'pointerleave', recenter, { passive: true });
  listen(view, 'blur', recenter);
  listen(view, 'resize', () => { geometryDirty = true;if(active())paint();schedule(); }, { passive: true });
  listen(document, 'visibilitychange', sync);
  for (const preference of [motion, transparency, contrast, forcedColors]) listen(preference, 'change', sync);
  const theme = new view.MutationObserver(sync);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const size = new view.ResizeObserver(() => { geometryDirty = true;if(active())paint();schedule(); });
  size.observe(document.documentElement);
  listen(canvas, 'webglcontextlost', event => {
    event.preventDefault();renderer?.dispose();renderer = null;
    canvas.width = canvas.height = 1;layer.dataset.renderer = 'css';sync();
  });

  function dispose() {
    if (disposed) return;
    disposed = true;view.cancelAnimationFrame(frame);frame = 0;
    cleanups.forEach(cleanup => cleanup());theme.disconnect();size.disconnect();
    renderer?.dispose();renderer = null;ripples.length = 0;
    canvas.width = canvas.height = 1;layer.remove();
    if (mounted.get(document) === dispose) mounted.delete(document);
  }
  mounted.set(document, dispose);sync();
  return dispose;
}
