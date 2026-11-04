const mounted = new WeakMap();
const clamp = value => Math.max(0, Math.min(1, value));

// A decorative measuring scale follows native document scrolling. It never
// changes scroll behaviour, takes focus, or intercepts pointer events.
export function mountScrollPosition(document = globalThis.document) {
  if (!document?.body) return () => {};
  mounted.get(document)?.();
  const view = document.defaultView;
  const scale = document.createElement('div');
  scale.className = 'scroll-position';
  scale.dataset.scrollPosition = '';
  scale.dataset.siteWideUi = '';
  scale.setAttribute('role', 'progressbar');
  scale.setAttribute('aria-label', '현재 페이지 스크롤 위치');
  scale.setAttribute('aria-orientation', 'vertical');
  scale.setAttribute('aria-valuemin', '0');
  scale.setAttribute('aria-valuemax', '100');
  scale.setAttribute('aria-valuenow', '0');
  scale.hidden = true;
  for (let index = 0; index <= 30; index++) {
    const tick = document.createElement('span');
    tick.className = `scroll-position-tick${index % 5 === 0 ? ' is-major' : ''}`;
    tick.style.setProperty('--tick-position', index / 30);
    tick.setAttribute('aria-hidden', 'true');
    scale.appendChild(tick);
  }
  const marker = document.createElement('span');
  marker.className = 'scroll-position-marker';
  marker.dataset.scrollPositionMarker = '';
  marker.setAttribute('aria-hidden', 'true');
  scale.appendChild(marker);
  document.body.appendChild(scale);

  let frame = 0, disposed = false, previous = -1, percent = -1;
  const cleanups = [];
  const listen = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    cleanups.push(() => target.removeEventListener(type, callback, options));
  };
  function update() {
    frame = 0;
    if (disposed) return;
    const scroller = document.scrollingElement || document.documentElement;
    const viewport = document.documentElement.clientHeight || view.innerHeight;
    const distance = Math.max(0, scroller.scrollHeight - viewport);
    const progress = distance > 1 ? clamp((view.scrollY ?? scroller.scrollTop) / distance) : 0;
    scale.hidden = distance <= 1;
    if (progress !== previous) {
      previous = progress;
      scale.style.setProperty('--scroll-position', progress);
      scale.dataset.progress = progress.toFixed(4);
    }
    const rounded = Math.round(progress * 100);
    if (rounded !== percent) {
      percent = rounded;
      scale.setAttribute('aria-valuenow', String(rounded));
    }
  }
  function schedule() {
    if (!disposed && !frame) frame = view.requestAnimationFrame(update);
  }
  listen(view, 'scroll', schedule, { passive: true });
  listen(view, 'resize', schedule, { passive: true });
  listen(document, 'site-content-ready', schedule);
  listen(document, 'load', schedule, { passive: true, capture: true });
  if (document.fonts) {
    listen(document.fonts, 'loadingdone', schedule);
    document.fonts.ready.then(schedule);
  }
  const observer = new view.ResizeObserver(schedule);
  observer.observe(document.documentElement);
  observer.observe(document.body);
  function dispose() {
    if (disposed) return;
    disposed = true;
    view.cancelAnimationFrame(frame);
    observer.disconnect();
    cleanups.forEach(cleanup => cleanup());
    scale.remove();
    if (mounted.get(document) === dispose) mounted.delete(document);
  }
  mounted.set(document, dispose);
  update();
  return dispose;
}
