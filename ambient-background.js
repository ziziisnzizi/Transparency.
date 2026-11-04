import { createSiteBackground } from './site-background.js';
import { siteEffectsConfig } from './site-effects-config.js';
import { createBackdropInk } from './backdrop-ink.js';
import { createBackgroundMotion, stepBackgroundMotion } from './background-motion.js';

const mounted = new WeakMap();
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// One global decorative surface survives every app render. Pointer listeners are
// passive; foreground HTML, native scrolling, text and product images stay intact.
export function mountAmbientBackground(document = globalThis.document) {
  mounted.get(document)?.();
  const view = document.defaultView;
  const config = siteEffectsConfig.background || {};
  const ink = createBackdropInk(document);
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
  let width = 1, height = 1;
  const pointer = { x: 0, y: 0, active: 0, trailX: 0, trailY: 0, vx: 0, vy: 0 }, target = { x: 0, y: 0, active: 0 };
  const inertia = { x: 0, y: 0 };
  let history = createBackgroundMotion();
  const pendingFlows = [];
  let lastTouch = null, scrollY = view.scrollY || 0, scrollIgnoreUntil = 0;
  const cleanups = [];
  const hidden = () => transparency.matches || contrast.matches || forcedColors.matches;
  const still = () => motion.matches || hidden();
  const active = () => !disposed && layer.isConnected && !document.hidden;
  const listen = (element, name, callback, options) => {
    element.addEventListener(name, callback, options);
    cleanups.push(() => element.removeEventListener(name, callback, options));
  };
  layer.dataset.renderer = 'css';
  layer.dataset.scene = 'shared';
  document.body.dataset.siteArt = 'shared';
  for (const [name, color] of Object.entries(config.palette || {})) {
    if (typeof color === 'string' && /^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(color)) layer.style.setProperty(`--site-bg-${name}`, color);
  }

  function measure() {
    width = Math.max(1, document.documentElement.clientWidth);
    height = Math.max(1, view.innerHeight);
    // The renderer budgets its fluid field separately from the native-pixel
    // grain output. Passing an already capped ratio would enlarge the grain.
    if (renderer?.resize(width, height, view.devicePixelRatio || 1) === false) {
      renderer.dispose(); renderer = null; failed = true;
      layer.dataset.renderer = 'css';
    }
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
    layer.style.setProperty('--ambient-shift-x', `${(pointer.x * pointer.active * 24 + history.x * 70 + Math.sin(history.phase) * 36).toFixed(2)}px`);
    layer.style.setProperty('--ambient-shift-y', `${(pointer.y * pointer.active * 18 + history.y * 60).toFixed(2)}px`);
    renderer?.render({ time: still() ? Number(config.staticTime) || 3.4 : time, pointer, history });
    ink.update(renderer, still());
  }
  function tick(stamp) {
    frame = 0;
    if (!active()) return;
    // Some engines deliver preference changes after the next animation tick.
    // Read the live value here so a newly static scene is also neutral/paused.
    if (still()) { sync(); return; }
    if (!previous || stamp - previous >= 1000 / 30) {
      const elapsed = previous ? Math.min((stamp - previous) / 1000, .15) : 1 / 30;
      previous = stamp;
      time += Math.min(elapsed, .1) * (coarse.matches ? clamp(Number(config.mobileFlowMultiplier) || 2, 1, 3) : 1);
      const followRate = clamp(Number(config.followRate) || 7.5, 1, 30);
      const response = 1 - Math.exp(-elapsed * followRate);
      const trailResponse = 1 - Math.exp(-elapsed * clamp(Number(config.trailRate) || 2.6, 1, 20));
      const velocityResponse = 1 - Math.exp(-elapsed * clamp(Number(config.velocityRate) || 5.5, 1, 25));
      const activityResponse = 1 - Math.exp(-elapsed * Math.max(followRate, target.active ? 10 : 6));
      const oldX = pointer.x, oldY = pointer.y;
      pointer.x += (target.x - pointer.x) * response;
      pointer.y += (target.y - pointer.y) * response;
      pointer.active += (target.active - pointer.active) * activityResponse;
      inertia.x += (pointer.x - inertia.x) * trailResponse;
      inertia.y += (pointer.y - inertia.y) * trailResponse;
      // Most of the field leads with the cursor; a smaller slow tail supplies
      // follow-through without delaying the entire composition or oscillating.
      pointer.trailX = pointer.x * .70 + inertia.x * .30;
      pointer.trailY = pointer.y * .70 + inertia.y * .30;
      const settledX = Math.abs(target.x - pointer.x) * width * .5 < .20;
      const settledY = Math.abs(target.y - pointer.y) * height * .5 < .20;
      const vx = settledX ? 0 : clamp((pointer.x - oldX) / Math.max(elapsed, .001), -1.8, 1.8);
      const vy = settledY ? 0 : clamp((pointer.y - oldY) / Math.max(elapsed, .001), -1.8, 1.8);
      pointer.vx += (vx - pointer.vx) * velocityResponse;
      pointer.vy += (vy - pointer.vy) * velocityResponse;
      if (settledX && Math.abs(pointer.vx) < .002) pointer.vx = 0;
      if (settledY && Math.abs(pointer.vy) < .002) pointer.vy = 0;
      // Preserve event order: a fast closed path must not cancel merely because
      // its endpoint returns before the next animation frame.
      if (pendingFlows.length) {
        const slice = elapsed / pendingFlows.length;
        const distance = pendingFlows.reduce((sum, movement) => sum + Math.hypot(movement.dx, movement.dy), 0);
        const strength = Math.min(1, .35 / Math.max(distance, .001));
        for (const movement of pendingFlows) history = stepBackgroundMotion(history, {
          ...movement, dx: movement.dx * strength, dy: movement.dy * strength,
        }, slice, config);
        pendingFlows.length = 0;
      } else history = stepBackgroundMotion(history, {}, elapsed, config);
      paint();
    }
    const settling = Math.abs(target.x - pointer.x) + Math.abs(target.y - pointer.y) + Math.abs(target.active - pointer.active) + Math.abs(pointer.x - inertia.x) + Math.abs(pointer.y - inertia.y) + Math.abs(pointer.vx) + Math.abs(pointer.vy) > .002;
    if (!still() && (renderer || settling)) frame = view.requestAnimationFrame(tick);
  }
  function schedule() { if (!frame && active() && !still()) frame = view.requestAnimationFrame(tick); }
  function sync() {
    view.cancelAnimationFrame(frame); frame = 0; previous = 0;
    layer.dataset.paused = String(!active() || still());
    if (still()) {
      target.x = target.y = target.active = pointer.x = pointer.y = pointer.active = pointer.trailX = pointer.trailY = pointer.vx = pointer.vy = inertia.x = inertia.y = 0;
      history = createBackgroundMotion(); pendingFlows.length = 0; lastTouch = null;
    }
    if (active()) { paint(); schedule(); }
  }
  const point = event => {
    if (!active() || still() || coarse.matches || event.pointerType === 'touch') return;
    const x = clamp(event.clientX / width * 2 - 1, -1, 1);
    const y = clamp(event.clientY / height * 2 - 1, -1, 1);
    // Ignore subpixel device chatter so a resting mouse does not twitch the field.
    if (target.active && Math.hypot((x - target.x) * width * .5, (y - target.y) * height * .5) < .45) return;
    if (target.active) queueFlow(x, y, x - target.x, y - target.y);
    target.x = x;
    target.y = y;
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
  function queueFlow(x, y, dx, dy) {
    if (!active() || still()) return;
    pendingFlows.push({ x: clamp(x, -1, 1), y: clamp(y, -1, 1), dx: clamp(dx, -.30, .30), dy: clamp(dy, -.30, .30), active: 1 });
    if (pendingFlows.length > 64) pendingFlows.shift();
    schedule();
  }
  listen(view, 'touchstart', event => {
    lastTouch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  listen(view, 'touchmove', event => {
    if (event.touches.length !== 1) { lastTouch = null; return; }
    const touch = event.touches[0];
    if (lastTouch) {
      const gain = clamp(Number(config.touchFlowGain) || .70, 0, 2);
      queueFlow(touch.clientX / width * 2 - 1, touch.clientY / height * 2 - 1,
        clamp((touch.clientX - lastTouch.x) / width * 2, -.20, .20) * gain,
        clamp((touch.clientY - lastTouch.y) / height * 2, -.20, .20) * gain);
    }
    lastTouch = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  listen(view, 'touchend', () => { lastTouch = null; }, { passive: true });
  listen(view, 'touchcancel', () => { lastTouch = null; }, { passive: true });
  function seedScroll() {
    scrollY = view.scrollY || 0;
    scrollIgnoreUntil = view.performance.now() + 220;
  }
  listen(view, 'scroll', () => {
    ink.update(renderer);
    const next = view.scrollY || 0, delta = next - scrollY;
    scrollY = next;
    // A route's first scroll position is seeded, not injected as a gesture.
    // A later first physical wheel tick still responds instead of being lost.
    if (view.performance.now() < scrollIgnoreUntil || Math.abs(delta) > Math.max(height * .85, 480)) return;
    const gain = clamp(Number(config.scrollFlowGain) || .60, 0, 2);
    queueFlow(pointer.x, pointer.y, 0, clamp(delta / height, -.12, .12) * gain);
  }, { passive: true });
  listen(document, 'site-content-ready', () => { seedScroll(); ink.update(renderer, true); });
  listen(view, 'popstate', seedScroll);
  for (const preference of [motion, transparency, contrast, forcedColors]) listen(preference, 'change', sync);
  listen(coarse, 'change', () => { if (coarse.matches) target.active = pointer.active = 0; sync(); });
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
    cleanups.forEach(cleanup => cleanup()); size.disconnect();
    ink.dispose(); renderer?.dispose(); renderer = null; history = createBackgroundMotion(); pendingFlows.length = 0;
    canvas.width = canvas.height = 1; layer.remove(); delete document.body.dataset.siteArt;
    if (mounted.get(document) === dispose) mounted.delete(document);
  }
  mounted.set(document, dispose); sync();
  return dispose;
}
