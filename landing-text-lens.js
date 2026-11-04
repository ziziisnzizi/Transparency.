import { createLandingLensRenderer } from './landing-lens-renderer.js';

const mounted = new WeakMap();
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function textStyle(context, line) {
  const style = getComputedStyle(line);
  context.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  context.direction = style.direction;
  if ('fontKerning' in context) context.fontKerning = style.fontKerning === 'none' ? 'none' : 'normal';
  if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
  context.fillStyle = style.color;
  return style;
}

function drawLine(context, line, titleRect) {
  const rect = line.getBoundingClientRect();
  const style = textStyle(context, line);
  let text = line.textContent.replace(/\s+/g, ' ').trim();
  if (style.textTransform === 'uppercase') text = text.toLocaleUpperCase();
  if (style.textTransform === 'lowercase') text = text.toLocaleLowerCase();
  if (style.textTransform === 'capitalize') text = text.replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase());
  const x = rect.left - titleRect.left + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.borderLeftWidth) || 0);
  // A zero-size inline baseline probe follows the browser's actual font metrics.
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;border:0;line-height:0;vertical-align:baseline;';
  line.appendChild(probe);
  const baseline = probe.getBoundingClientRect().top - titleRect.top;
  probe.remove();
  if ('letterSpacing' in context) context.fillText(text, x, baseline);
  else {
    const spacing = parseFloat(style.letterSpacing) || 0;
    const letters = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter(line.lang || undefined, { granularity: 'grapheme' }).segment(text)].map(part => part.segment)
      : Array.from(text);
    let prefix = '';
    letters.forEach((letter, index) => {
      const advance = context.measureText(prefix + letter).width - context.measureText(letter).width;
      context.fillText(letter, x + advance + spacing * index, baseline);
      prefix += letter;
    });
  }
}

function backgroundColor(element) {
  for (let node = element; node instanceof Element; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    const parts = color.match(/[\d.]+/g)?.map(Number);
    if (parts?.length >= 3 && (parts.length < 4 || parts[3] > .95)) return parts.slice(0, 3).map(value => value / 255);
  }
  return document.documentElement.dataset.theme === 'dark' ? [0,0,0] : [1,1,1];
}

export function mountLandingTextLens(hero, lens = {}) {
  mounted.get(hero)?.();
  const title = hero?.querySelector('[data-landing-title]');
  const english = title?.querySelector('[data-language-plane="en"]');
  const japanese = title?.querySelector('[data-language-plane="ja"]');
  let canvas = title?.querySelector('[data-landing-text-canvas]');
  const rim = hero?.querySelector('[data-landing-lens]');
  const button = hero?.querySelector('[data-landing-language]');
  if (!title || !english || !japanese || !canvas || !rim) return () => {};
  const options = lens.lens || lens;
  const paperOption = options.paperRGB ?? options.paper;
  const paperRGB = Array.isArray(paperOption) && paperOption.length === 3
    && paperOption.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1)
    ? [...paperOption] : null;
  const diameter = clamp(finite(options.diameter, 180), 140, 200);
  const radius = diameter / 2;
  const settings = {
    radius,
    rimWidth: clamp(finite(options.rimWidth, 10), 1, radius / 3),
    refraction: clamp(finite(options.refraction, 7), 0, 20),
    rgbOffset: clamp(finite(options.rgbOffset, 1.5), 0, 4),
  };
  const followRate = clamp(finite(options.followRate, 12), 1, 80);
  const fadeRate = clamp(finite(options.fadeRate, 10), 1, 80);
  const maxPixelRatio = clamp(finite(options.maxPixelRatio, 2.5), 1, 3);
  const pixelBudget = Math.max(250000, finite(options.pixelBudget, 4000000));
  const coarse = matchMedia('(pointer: coarse), (hover: none), (max-width: 750px)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const cleanups = [];
  const originalOpacity = [english.style.opacity, japanese.style.opacity];
  const originalRimStyle = rim.getAttribute('style');
  const originalRimHidden = rim.hidden;
  const originalCanvasHidden = canvas.hidden;
  const originalCanvasStyle = canvas.getAttribute('style');
  const originalButtonHidden = button?.hidden;
  const originalButtonDisplay = button?.style.display || '';
  const originalButtonPressed = button?.getAttribute('aria-pressed');
  const sourceLanguage = english.lang || 'ko';
  const targetLanguage = japanese.lang || 'en';
  let renderer = null, removeContextListener = null, disposed = false, failed = false;
  let ready = false, fontsReady = false, inViewport = true, insideHero = false;
  let frame = 0, previous = 0, layoutDirty = true, geometryDirty = true;
  let heroRect, titleRect, lineRects = [];
  let client = { x: 0, y: 0 }, target = { x: 0, y: 0 }, current = { x: 0, y: 0 };
  let opacity = 0, reveal = 0;
  let opacityTarget = 0, revealTarget = 0;
  const listen = (object, type, handler, options) => {
    object.addEventListener(type, handler, options);
    cleanups.push(() => object.removeEventListener(type, handler, options));
  };
  // Plane IDs are retained for renderer/CSS compatibility; language is explicit.
  english.lang = sourceLanguage;
  japanese.lang = targetLanguage;
  canvas.setAttribute('aria-hidden', 'true');
  rim.setAttribute('aria-hidden', 'true');
  rim.style.position = 'absolute';
  rim.style.left = rim.style.top = '0';
  rim.style.width = rim.style.height = `${diameter}px`;
  rim.style.pointerEvents = 'none';
  rim.style.opacity = '0';

  function nativeLanguage() {
    english.style.opacity = '1';
    japanese.style.opacity = '0';
    english.setAttribute('aria-hidden', 'false');
    japanese.setAttribute('aria-hidden', 'true');
    if (button) {
      button.hidden = true;
      button.style.display = 'none';
      button.setAttribute('aria-pressed', 'false');
    }
  }
  function releaseRenderer() {
    removeContextListener?.();
    removeContextListener = null;
    renderer?.dispose();
    renderer = null;
    ready = false;
  }
  function fallback() {
    canvas.hidden = true;
    canvas.style.opacity = '0';
    rim.hidden = true;
    rim.style.opacity = '0';
    hero.dataset.landingTextMode = 'native';
    nativeLanguage();
  }
  function geometry() {
    heroRect = hero.getBoundingClientRect();
    titleRect = title.getBoundingClientRect();
    lineRects = [...english.querySelectorAll('[data-landing-line]')].map(line => line.getBoundingClientRect());
    geometryDirty = false;
  }
  function updateTargets() {
    if (geometryDirty) geometry();
    target.x = client.x - heroRect.left;
    target.y = client.y - heroRect.top;
    const withinHero = insideHero && client.x >= heroRect.left && client.x <= heroRect.right && client.y >= heroRect.top && client.y <= heroRect.bottom;
    opacityTarget = withinHero && ready && !coarse.matches ? 1 : 0;
    revealTarget = opacityTarget && lineRects.some(rect => client.x >= rect.left && client.x <= rect.right && client.y >= rect.top && client.y <= rect.bottom) ? 1 : 0;
  }
  function rasterize(plane, ratio) {
    const image = document.createElement('canvas');
    image.width = Math.max(1, Math.ceil(titleRect.width * ratio));
    image.height = Math.max(1, Math.ceil(titleRect.height * ratio));
    const context = image.getContext('2d');
    if (!context) return null;
    context.scale(ratio, ratio);
    for (const line of plane.querySelectorAll('[data-landing-line]')) drawLine(context, line, titleRect);
    return image;
  }
  function rebuild() {
    layoutDirty = false;
    geometry();
    if (coarse.matches || failed || !fontsReady || titleRect.width < 1 || titleRect.height < 1) { fallback(); return; }
    if (!renderer) renderer = createLandingLensRenderer(canvas);
    if (!renderer) { failed = true; fallback(); return; }
    const ratio = Math.min(maxPixelRatio, Math.max(2, devicePixelRatio || 1), Math.sqrt(pixelBudget / (titleRect.width * titleRect.height)), renderer.maxTextureSize / titleRect.width, renderer.maxTextureSize / titleRect.height);
    const images = [rasterize(english, ratio), rasterize(japanese, ratio)];
    if (images.some(image => !image) || !renderer.upload(images, titleRect.width, titleRect.height, ratio, paperRGB || backgroundColor(hero))) {
      failed = true;
      releaseRenderer();
      fallback();
      return;
    }
    canvas = renderer.canvas;
    canvas.hidden = false;
    canvas.style.opacity = '1';
    canvas.dataset.landingTextRatio = ratio.toFixed(3);
    canvas.setAttribute('aria-hidden', 'true');
    if (!removeContextListener) {
      const lost = event => {
        event.preventDefault();
        failed = true;
        releaseRenderer();
        fallback();
        cancelAnimationFrame(frame);
        frame = 0;
      };
      canvas.addEventListener('webglcontextlost', lost);
      removeContextListener = () => canvas.removeEventListener('webglcontextlost', lost);
    }
    ready = true;
    nativeLanguage();
    english.style.opacity = japanese.style.opacity = '0';
    hero.dataset.landingTextMode = 'webgl';
    rim.hidden = false;
    if (button) { button.hidden = true; button.style.display = 'none'; }
    updateTargets();
  }
  function paint() {
    if (!ready) return;
    renderer.render({ ...settings, x: current.x - (titleRect.left - heroRect.left), y: current.y - (titleRect.top - heroRect.top), opacity, reveal });
    rim.style.transform = `translate3d(${(current.x - radius).toFixed(2)}px,${(current.y - radius).toFixed(2)}px,0)`;
    rim.style.opacity = opacity.toFixed(4);
  }
  function tick(stamp) {
    frame = 0;
    if (disposed || !hero.isConnected) { dispose(); return; }
    if (document.hidden || !inViewport) { previous = 0; return; }
    if (layoutDirty && fontsReady) rebuild();
    if (!ready) return;
    if (geometryDirty) { geometry(); updateTargets(); }
    const delta = previous ? Math.min((stamp - previous) / 1000, .15) : 1 / 60;
    previous = stamp;
    const follow = motion.matches ? 1 : 1 - Math.exp(-followRate * delta);
    const fade = motion.matches ? 1 : 1 - Math.exp(-fadeRate * delta);
    current.x += (target.x - current.x) * follow;
    current.y += (target.y - current.y) * follow;
    opacity += (opacityTarget - opacity) * fade;
    reveal += (revealTarget - reveal) * fade;
    if (Math.abs(opacity - opacityTarget) < .0001) opacity = opacityTarget;
    if (Math.abs(reveal - revealTarget) < .0001) reveal = revealTarget;
    paint();
    if (Math.abs(current.x - target.x) + Math.abs(current.y - target.y) > .02 || Math.abs(opacity - opacityTarget) > .0001 || Math.abs(reveal - revealTarget) > .0001 || layoutDirty) schedule();
    else previous = 0;
  }
  function schedule() {
    if (!disposed && !frame && !document.hidden && inViewport) frame = requestAnimationFrame(tick);
  }
  function invalidate() { layoutDirty = true; geometryDirty = true; schedule(); }
  function pointer(event) {
    if (coarse.matches || !ready) return;
    insideHero = true;
    client = { x: event.clientX, y: event.clientY };
    updateTargets();
    if (opacity < .001) current = { ...target };
    schedule();
  }
  listen(hero, 'pointerenter', pointer, { passive: true });
  listen(hero, 'pointermove', pointer, { passive: true });
  listen(hero, 'pointerleave', () => { insideHero = false; opacityTarget = revealTarget = 0; schedule(); }, { passive: true });
  listen(hero, 'pointercancel', () => { insideHero = false; opacityTarget = revealTarget = 0; schedule(); }, { passive: true });
  listen(window, 'scroll', () => { geometryDirty = true; if (ready) schedule(); }, { passive: true });
  listen(window, 'resize', invalidate, { passive: true });
  listen(document, 'visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (!document.hidden) { geometryDirty = true; schedule(); }
  });
  listen(motion, 'change', schedule);
  listen(coarse, 'change', () => { releaseRenderer(); failed = false; opacity = reveal = opacityTarget = revealTarget = 0; fallback(); invalidate(); });
  if (document.fonts) {
    listen(document.fonts, 'loadingdone', invalidate);
    document.fonts.ready.then(() => { if (!disposed) { fontsReady = true; invalidate(); } });
  } else fontsReady = true;
  const resize = new ResizeObserver(invalidate);
  resize.observe(title);
  resize.observe(hero);
  const intersection = new IntersectionObserver(entries => {
    inViewport = entries[0].isIntersecting;
    if (!inViewport) { cancelAnimationFrame(frame); frame = 0; previous = 0; insideHero = false; opacity = reveal = opacityTarget = revealTarget = 0; rim.style.opacity = '0'; }
    else { geometryDirty = true; schedule(); }
  });
  intersection.observe(hero);
  const removal = new MutationObserver(() => { if (!hero.isConnected) dispose(); });
  removal.observe(document.body, { childList: true, subtree: true });

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    cleanups.forEach(cleanup => cleanup());
    resize.disconnect(); intersection.disconnect(); removal.disconnect();
    releaseRenderer();
    english.style.opacity = originalOpacity[0];
    japanese.style.opacity = originalOpacity[1];
    english.setAttribute('aria-hidden', 'false'); japanese.setAttribute('aria-hidden', 'true');
    canvas.hidden = originalCanvasHidden;
    if (originalCanvasStyle === null) canvas.removeAttribute('style'); else canvas.setAttribute('style', originalCanvasStyle);
    canvas.width = canvas.height = 1;
    rim.hidden = originalRimHidden;
    if (originalRimStyle === null) rim.removeAttribute('style'); else rim.setAttribute('style', originalRimStyle);
    if (button) {
      button.hidden = originalButtonHidden;
      button.style.display = originalButtonDisplay;
      if (originalButtonPressed === null) button.removeAttribute('aria-pressed'); else button.setAttribute('aria-pressed', originalButtonPressed);
    }
    delete hero.dataset.landingTextMode;
    if (mounted.get(hero) === dispose) mounted.delete(hero);
  }
  mounted.set(hero, dispose);
  fallback();
  invalidate();
  return dispose;
}
