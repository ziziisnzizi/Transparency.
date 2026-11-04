import { createLandingBackground } from './landing-background.js';
import { mountLandingTextLens } from './landing-text-lens.js';

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));

// The browser owns scrolling, links and focus. These canvases only decorate it.
export function mountLanding(root, config) {
  const hero = root?.querySelector('[data-landing-hero]');
  if (!hero) return () => {};
  const document = root.ownerDocument;
  const view = document.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = view.matchMedia('(pointer: coarse)');
  const canvas = hero.querySelector('[data-landing-background]');
  const settings = config.background || {};
  const cleanups = [];
  let renderer = null;
  try { renderer = createLandingBackground(canvas, settings); } catch { /* Native static gradient remains. */ }
  const drawingCanvas = renderer?.canvas || canvas;
  hero.dataset.background = renderer ? 'webgl' : 'fallback';
  drawingCanvas.hidden = !renderer;
  let disposed = false, visible = true, frame = 0, progressFrame = 0;
  let previous = 0, time = 0, width = 1, height = 1;
  const pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  const active = () => !disposed && visible && !document.hidden && !!renderer;
  const listen = (element, type, handler, options) => {
    element.addEventListener(type, handler, options);
    cleanups.push(() => element.removeEventListener(type, handler, options));
  };

  function paint() {
    renderer?.render({
      time: reduced.matches ? (settings.staticTime ?? 3.4) : time,
      pointer: reduced.matches ? { x: 0, y: 0 } : pointer,
    });
  }
  function measure() {
    if (disposed) return;
    width = Math.max(1, hero.clientWidth);
    height = Math.max(1, hero.clientHeight);
    const dpr = Math.min(view.devicePixelRatio || 1,
      coarse.matches ? Math.min(settings.maxPixelRatio || 1.5, 1.25) : settings.maxPixelRatio || 1.5,
      Math.sqrt((settings.pixelBudget || 1800000) / (width * height)));
    renderer?.resize(width, height, dpr);
    if (active()) paint();
    queueProgress();
  }
  function tick(stamp) {
    frame = 0;
    if (!active()) return;
    // Some browsers update matches before delivering the media-query event.
    if (reduced.matches) { sync(); return; }
    if (!previous || stamp - previous >= 1000 / 30) {
      const dt = previous ? clamp((stamp - previous) / 1000, 0, .15) : 1 / 30;
      previous = stamp;
      time += dt;
      const response = 1 - Math.exp(-dt * (settings.followRate || 6));
      pointer.x += (target.x - pointer.x) * response;
      pointer.y += (target.y - pointer.y) * response;
      paint();
    }
    frame = view.requestAnimationFrame(tick);
  }
  function sync() {
    view.cancelAnimationFrame(frame); frame = 0; previous = 0;
    hero.dataset.motion = reduced.matches ? 'reduced' : 'full';
    if (reduced.matches) target.x = target.y = pointer.x = pointer.y = 0;
    if (!active()) return;
    paint();
    if (!reduced.matches) frame = view.requestAnimationFrame(tick);
  }
  function updateProgress() {
    progressFrame = 0;
    if (disposed) return;
    const sections = root.querySelectorAll('[data-landing-work]');
    const track = root.querySelector('[data-landing-progress]');
    if (!sections.length || !track) return;
    const scroll = view.scrollY;
    const start = sections[0].getBoundingClientRect().top + scroll - view.innerHeight * .3;
    const end = sections[sections.length - 1].getBoundingClientRect().bottom + scroll - view.innerHeight * .85;
    const progress = clamp((scroll - start) / Math.max(1, end - start));
    root.style.setProperty('--landing-progress', progress.toFixed(5));
    track.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    track.dataset.visible = String(scroll >= start - view.innerHeight * .3 && scroll <= end + view.innerHeight * .8);
  }
  function queueProgress() {
    if (!disposed && !progressFrame) progressFrame = view.requestAnimationFrame(updateProgress);
  }

  listen(hero, 'pointermove', event => {
    if (disposed || reduced.matches || coarse.matches) return;
    const rect = hero.getBoundingClientRect();
    target.x = clamp((event.clientX - rect.left) / width * 2 - 1, -1, 1);
    target.y = clamp((event.clientY - rect.top) / height * 2 - 1, -1, 1);
  }, { passive: true });
  listen(hero, 'pointerleave', () => { target.x = target.y = 0; }, { passive: true });
  listen(view, 'blur', () => { target.x = target.y = 0; });
  listen(view, 'focus', sync);
  listen(view, 'scroll', queueProgress, { passive: true });
  listen(view, 'resize', measure, { passive: true });
  listen(document, 'visibilitychange', sync);
  listen(reduced, 'change', sync);
  listen(coarse, 'change', measure);
  listen(drawingCanvas, 'webglcontextlost', event => {
    event.preventDefault();
    if (disposed) return;
    view.cancelAnimationFrame(frame); frame = 0;
    const old = renderer; renderer = null;
    hero.dataset.background = 'fallback';
    drawingCanvas.hidden = true;
    old?.dispose();
  });
  const size = new view.ResizeObserver(measure);
  size.observe(hero);
  const intersection = new view.IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    sync();
  });
  intersection.observe(hero);
  const disposeLens = mountLandingTextLens(hero, config.lens);
  measure(); sync(); queueProgress();
  return () => {
    if (disposed) return;
    disposed = true;
    view.cancelAnimationFrame(frame); view.cancelAnimationFrame(progressFrame);
    cleanups.forEach(cleanup => cleanup());
    size.disconnect(); intersection.disconnect();
    disposeLens(); renderer?.dispose(); renderer = null;
    drawingCanvas.width = drawingCanvas.height = 1;
  };
}
