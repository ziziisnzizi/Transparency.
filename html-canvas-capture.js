import { toSvg } from 'html-to-image';

const MAX_PIXELS = 8000000;
const CAPTURE_TIMEOUT = 7000;
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

// html-to-image clones computed styles, but rounds font sizes down. Restore the
// exact source size and freeze captured animations in the detached SVG only.
function prepareClone(original, clone, { viewport, overlay, scrollX, scrollY }) {
  if (!(original instanceof Element) || !clone?.style) return;
  const style = getComputedStyle(original);
  clone.style.fontSize = style.fontSize;
  clone.style.animation = 'none';
  clone.style.transition = 'none';
  if (original instanceof HTMLInputElement && ['password', 'hidden'].includes(original.type)) {
    clone.setAttribute('value', original.type === 'password' ? '•'.repeat(Math.min(original.value.length, 64)) : '');
  }
  const originals = [...original.children].filter(included);
  const clones = [...clone.children].slice(0, originals.length);
  originals.forEach((child, index) => prepareClone(child, clones[index], { viewport, overlay, scrollX, scrollY }));
  if (!viewport || !['fixed', 'sticky'].includes(style.position)) return;
  const rect = original.getBoundingClientRect();
  if (!rect.width || !rect.height || !clone.parentNode) return;
  // Extract positioned copies from the translated document. Their native viewport
  // coordinates preserve fixed navigation and the current position of stickies.
  const placeholder = clone.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  placeholder.style.cssText = `visibility:hidden;pointer-events:none;box-sizing:border-box;width:${rect.width}px;height:${style.position === 'fixed' ? 0 : rect.height}px;margin:${style.margin};flex:${style.flex};grid-area:${style.gridArea}`;
  if (style.position === 'fixed') placeholder.style.display = 'none';
  clone.replaceWith(placeholder);
  Object.assign(clone.style, {
    position: 'absolute', left: `${rect.left}px`, top: `${rect.top}px`,
    right: 'auto', bottom: 'auto', width: `${rect.width}px`, height: `${rect.height}px`,
    margin: '0', transform: 'none', transformOrigin: '0 0',
  });
  if (original instanceof HTMLDialogElement && original.open) clone.style.zIndex = '2147483000';
  overlay.appendChild(clone);
}

async function renderSnapshot(element, options, snapshot, controller) {
  const url = await toSvg(element, options);
  if (controller.signal.aborted) throw new Error('HTML capture cancelled');
  const xml = new DOMParser().parseFromString(decodeURIComponent(url.slice(url.indexOf(',') + 1)), 'image/svg+xml');
  if (xml.querySelector('parsererror')) throw new Error('HTML capture unavailable');
  const foreign = xml.querySelector('foreignObject');
  const clone = foreign?.firstElementChild;
  if (!clone) throw new Error('HTML capture unavailable');
  const ns = 'http://www.w3.org/1999/xhtml';
  const wrapper = xml.createElementNS(ns, 'div');
  const overlay = xml.createElementNS(ns, 'div');
  wrapper.style.cssText = `position:relative;overflow:hidden;width:${snapshot.width}px;height:${snapshot.height}px;margin:0;padding:0;isolation:isolate`;
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  prepareClone(element, clone, { ...snapshot, overlay });
  if (snapshot.viewport) {
    clone.style.height = `${snapshot.documentHeight}px`;
    clone.style.minHeight = `${snapshot.documentHeight}px`;
    clone.style.position = 'absolute';
    clone.style.top = '0';clone.style.left = '0';
    clone.style.transform = `translate(${-snapshot.scrollX}px, ${-snapshot.scrollY}px)`;
    clone.style.transformOrigin = '0 0';
    clone.style.overflow = 'visible';
  }
  clone.replaceWith(wrapper);
  wrapper.appendChild(clone);wrapper.appendChild(overlay);
  // Keep CSS coordinates in viewBox units while giving the SVG image a true
  // high-resolution intrinsic bitmap size before Canvas draws it.
  xml.documentElement.setAttribute('width', String(Math.max(1, Math.round(snapshot.width * snapshot.pixelRatio))));
  xml.documentElement.setAttribute('height', String(Math.max(1, Math.round(snapshot.height * snapshot.pixelRatio))));
  const svg = new XMLSerializer().serializeToString(xml.documentElement);
  const image = new Image();
  const loading = new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('HTML capture unavailable'));
    controller.signal.addEventListener('abort', () => {
      image.src = '';reject(new Error('HTML capture cancelled'));
    }, { once: true });
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  await loading;
  if (controller.signal.aborted) throw new Error('HTML capture cancelled');
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(snapshot.width * snapshot.pixelRatio));
  canvas.height = Math.max(1, Math.round(snapshot.height * snapshot.pixelRatio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('HTML capture unavailable');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.onload = image.onerror = null;
  return canvas;
}

// Capture the real styled HTML subtree. The source DOM remains the interactive,
// accessible page; this detached visual copy is only a local WebGL texture.
export function createHtmlCanvasCapture(element, { onCanvas, onError, viewport = false, maxTextureSize = 8192 } = {}) {
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
          const width = viewport ? document.documentElement.clientWidth : Math.ceil(bounds.width);
          const height = viewport ? innerHeight : Math.ceil(bounds.height);
          if (width < 1 || height < 1) {
            processed = version;settle(version, false);continue;
          }
          const textureLimit = Number.isFinite(maxTextureSize) && maxTextureSize > 0 ? maxTextureSize : 8192;
          const ratio = Math.min(3, Math.max(2, devicePixelRatio || 1), Math.sqrt(MAX_PIXELS / (width * height)), textureLimit / width, textureLimit / height);
          const snapshot = { width, height, pixelRatio: ratio, viewport,
            scrollX: window.scrollX, scrollY: window.scrollY, documentHeight: Math.max(bounds.height, element.scrollHeight) };
          const controller = new AbortController();
          activeController = controller;
          const rendering = renderSnapshot(element, {
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
          }, snapshot, controller);
          // SVG-image decoding cannot be interrupted after it begins. Release any late canvas
          // after a timeout/dispose instead of forwarding it to an obsolete view.
          rendering.then(lateCanvas => {
            if (controller.signal.aborted || disposed || version !== requested) releaseCanvas(lateCanvas);
          }, () => {});
          canvas = await bounded(rendering, CAPTURE_TIMEOUT, () => controller.abort());
          activeController = null;
          const current = element.getBoundingClientRect();
          const changedSize = viewport
            ? document.documentElement.clientWidth !== width || innerHeight !== height || Math.abs(window.scrollX - snapshot.scrollX) > .75 || Math.abs(window.scrollY - snapshot.scrollY) > .75 || Math.abs(Math.max(current.height, element.scrollHeight) - snapshot.documentHeight) > .75
            : Math.abs(current.width - bounds.width) > .75 || Math.abs(current.height - bounds.height) > .75;
          processed = version;
          if (disposed || !element.isConnected || version !== requested || changedSize || controller.signal.aborted) {
            releaseCanvas(canvas);canvas = null;settle(version, false);continue;
          }
          if (typeof onCanvas === 'function') onCanvas(canvas, snapshot);
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
