import { toCanvas } from 'html-to-image';

const MAX_PIXELS = 1400000;
const CAPTURE_TIMEOUT = 4500;
const TRANSPARENT_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const EXCLUDED = '[data-concern-optics], [data-html-lens-layer], [data-html-lens-exclude], .concern-water, script, style, noscript';

const releaseCanvas = canvas => {
  if (canvas) canvas.width = canvas.height = 1;
};

function sameOriginResource(value, origin) {
  if (!value) return true;
  try {
    const url = new URL(value, location.href);
    return url.protocol === 'data:' || url.protocol === 'blob:' || url.origin === origin;
  } catch { return false; }
}

function included(node) {
  if (!(node instanceof Element)) return true;
  if (node.matches(EXCLUDED)) return false;
  if (node instanceof HTMLImageElement) return sameOriginResource(node.currentSrc || node.src, location.origin);
  if (node instanceof SVGImageElement) return sameOriginResource(node.href.baseVal, location.origin);
  return true;
}

// Capture the real styled HTML subtree. The source DOM remains the interactive,
// accessible page; this detached visual copy is only a local WebGL texture.
export function createHtmlCanvasCapture(element, { onCanvas, onError } = {}) {
  let disposed = false, working = false, scheduled = false;
  let requested = 0, processed = 0;
  let activeController = null;
  const waiters = new Map();
  const timers = new Map();

  function settle(version, value) {
    waiters.get(version)?.(value);
    waiters.delete(version);
  }

  function bounded(promise, milliseconds, onTimeout) {
    if (disposed) return Promise.reject(new Error('HTML capture disposed'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        onTimeout?.();
        reject(new Error('HTML capture timed out'));
      }, milliseconds);
      timers.set(timer, () => reject(new Error('HTML capture disposed')));
      Promise.resolve(promise).then(value => {
        clearTimeout(timer);timers.delete(timer);resolve(value);
      }, error => {
        clearTimeout(timer);timers.delete(timer);reject(error);
      });
    });
  }

  async function ready() {
    // Wait briefly for already requested page resources; do not issue any font
    // stylesheet/font request of our own, or keep an initial capture waiting.
    if (document.fonts?.status === 'loading') {
      await bounded(document.fonts.ready, 650).catch(() => {});
    }
    if (disposed || !element.isConnected) return;
    const images = [...element.querySelectorAll('img')].filter(image => included(image) && !image.closest(EXCLUDED));
    const decoding = images.map(image => {
      if (image.complete) return Promise.resolve();
      if (typeof image.decode === 'function') return image.decode().catch(() => {});
      return Promise.resolve();
    });
    if (decoding.length) await bounded(Promise.all(decoding), 900).catch(() => {});
  }

  async function run() {
    scheduled = false;
    if (working || disposed) return;
    working = true;
    try {
      while (!disposed && processed < requested) {
        const version = requested;
        let canvas = null;
        try {
          await ready();
          if (disposed || !element.isConnected || version !== requested) {
            processed = version;settle(version, false);continue;
          }
          const bounds = element.getBoundingClientRect();
          const width = Math.ceil(bounds.width), height = Math.ceil(bounds.height);
          if (width < 1 || height < 1) {
            processed = version;settle(version, false);continue;
          }
          const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(MAX_PIXELS / (width * height)));
          const controller = new AbortController();
          activeController = controller;
          const rendering = toCanvas(element, {
            width,
            height,
            canvasWidth: width,
            canvasHeight: height,
            pixelRatio: ratio,
            backgroundColor: 'transparent',
            skipFonts: true,
            // Font CSS is deliberately not downloaded/embedded. The clone uses
            // computed font families and locally available/system fallbacks.
            fontEmbedCSS: '',
            cacheBust: false,
            filter: included,
            imagePlaceholder: TRANSPARENT_IMAGE,
            onImageErrorHandler: () => {},
            fetchRequestInit: { mode: 'same-origin', credentials: 'same-origin', signal: controller.signal },
            style: { background: 'transparent', backgroundColor: 'transparent', margin: '0', transform: 'none' },
          });
          // toCanvas cannot cancel its SVG-image decode. Release any late canvas
          // after a timeout/dispose instead of forwarding it to an obsolete view.
          rendering.then(lateCanvas => {
            if (controller.signal.aborted || disposed || version !== requested) releaseCanvas(lateCanvas);
          }, () => {});
          canvas = await bounded(rendering, CAPTURE_TIMEOUT, () => controller.abort());
          activeController = null;
          const current = element.getBoundingClientRect();
          const changedSize = Math.abs(current.width - bounds.width) > .75 || Math.abs(current.height - bounds.height) > .75;
          processed = version;
          if (disposed || !element.isConnected || version !== requested || changedSize || controller.signal.aborted) {
            releaseCanvas(canvas);canvas = null;settle(version, false);continue;
          }
          if (typeof onCanvas === 'function') onCanvas(canvas);
          else releaseCanvas(canvas);
          canvas = null;
          settle(version, true);
        } catch {
          activeController = null;
          releaseCanvas(canvas);
          processed = version;
          settle(version, false);
          // Never forward serialized HTML, data URLs, or question content in an
          // error/log. Failure leaves the ordinary HTML interface fully usable.
          if (!disposed && version === requested && typeof onError === 'function') {
            try { onError(new Error('HTML capture is unavailable')); } catch { /* Optional callback. */ }
          }
        }
      }
    } finally {
      working = false;
      if (!disposed && processed < requested && !scheduled) {
        scheduled = true;queueMicrotask(run);
      }
    }
  }

  function capture() {
    if (disposed || !element?.isConnected) return Promise.resolve(false);
    const version = ++requested;
    // Only the most recent request may publish. Calls in the same turn coalesce,
    // while an in-flight render finishes without interrupting image-cache loads.
    for (const old of waiters.keys()) settle(old, false);
    const result = new Promise(resolve => waiters.set(version, resolve));
    if (!working && !scheduled) { scheduled = true;queueMicrotask(run); }
    return result;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    activeController?.abort();activeController = null;
    for (const [timer, reject] of timers) { clearTimeout(timer);reject(); }
    timers.clear();
    for (const version of waiters.keys()) settle(version, false);
  }

  return { capture, dispose };
}
