import { mountLandingTextLens } from './landing-text-lens.js';

const mounted = new WeakMap();
const normalize = value => String(value ?? '').normalize('NFC').replace(/\s+/g, '');
const primarySelector = '#hero-title, .page-title, .concern-page-intro>h1';

function lineNodes(heading, document) {
  const source = heading.querySelector('[data-site-source-plane]') || heading;
  const authored = [...source.children].filter(child => child.matches('[data-site-hero-line], .concern-heading-line, [data-landing-line]'));
  if (authored.length && normalize(authored.map(line => line.textContent).join('')) === normalize(source.textContent)) return authored.map(line => line.cloneNode(true));
  const lines = [];
  let line = document.createElement('span');
  for (const child of source.childNodes) {
    if (child.nodeType === 1 && child.tagName === 'BR') {
      lines.push(line);
      line = document.createElement('span');
    } else if (!(child.nodeType === 1 && child.matches('[data-landing-text-canvas], [data-language-plane="ja"]'))) line.appendChild(child.cloneNode(true));
  }
  lines.push(line);
  return lines;
}

function signature(heading, document) {
  return lineNodes(heading, document).map(line => line.textContent.normalize('NFC')).join('\n');
}

function translations(heading, lines, config) {
  const explicit = heading.getAttribute('data-lens-ja');
  if (explicit) {
    try {
      const parsed = JSON.parse(explicit);
      if (Array.isArray(parsed) && parsed.every(line => typeof line === 'string')) return parsed;
      if (typeof parsed === 'string') return parsed.split(/\r?\n/);
    } catch { /* Ordinary text and literal newlines are also supported. */ }
    return explicit.split(/\r?\n/);
  }
  if (heading.id === 'hero-title' && heading.querySelector('[data-site-hero-line]') && Array.isArray(config.hero?.ja)) return config.hero.ja;
  const key = normalize(lines.map(line => line.textContent).join(''));
  const found = Object.entries(config.translations || {}).find(([source]) => normalize(source) === key)?.[1];
  if (Array.isArray(found)) return found.every(line => typeof line === 'string') ? found : null;
  return typeof found === 'string' ? found.split(/\r?\n/) : null;
}

function preserveAttribute(element, name) {
  const original = element.getAttribute(name);
  return () => original === null ? element.removeAttribute(name) : element.setAttribute(name, original);
}

export function mountSiteTextEffects(document, config = {}) {
  const main = document?.getElementById('content');
  if (!main) return () => {};
  mounted.get(main)?.();
  let active = null, disposed = false, queued = false;
  const previousSiteLens = main.getAttribute('data-site-lens');
  const previousSiteSource = main.getAttribute('data-site-lens-source');

  function mirrorMode() {
    main.dataset.siteLens = active && main.dataset.landingTextMode === 'webgl' ? 'active' : 'native';
    if (!active) delete main.dataset.siteLensSource;
  }

  function decorate(heading) {
    const lines = lineNodes(heading, document);
    const japaneseLines = translations(heading, lines, config);
    if (!japaneseLines?.length || !lines.some(line => normalize(line.textContent))) return null;
    const content = lines.map(line => line.textContent).join(' ');
    const sourceLanguage = heading.id === 'hero-title' && heading.querySelector('[data-site-hero-line]')
      ? 'en' : heading.lang || (/[\uac00-\ud7af]/.test(content) ? 'ko' : 'en');
    const nativeNodes = [...heading.childNodes];
    const originalSiteClass = heading.classList.contains('site-text-title');
    const restoreAttributes = ['data-site-text-region', 'data-landing-title', 'data-site-lens-ja'].map(name => preserveAttribute(heading, name));
    const source = document.createElement('span');
    source.dataset.languagePlane = 'en';
    source.dataset.siteSourcePlane = '';
    source.lang = sourceLanguage;
    source.setAttribute('aria-hidden', 'false');
    const translated = document.createElement('span');
    translated.dataset.languagePlane = 'ja';
    translated.lang = 'ja';
    translated.setAttribute('aria-hidden', 'true');
    translated.style.opacity = '0';
    lines.forEach(line => {
      line.dataset.landingLine = '';
      source.appendChild(line);
    });
    japaneseLines.forEach((copy, index) => {
      const line = lines[index] ? lines[index].cloneNode(false) : document.createElement('span');
      line.dataset.landingLine = '';
      line.textContent = copy;
      if (heading.id === 'hero-title' && !lines[index]) line.style.setProperty('--site-line-offset', `${Number(config.hero?.offsets?.[index]) || 0}%`);
      translated.appendChild(line);
    });
    const canvas = document.createElement('canvas');
    canvas.dataset.landingTextCanvas = '';
    canvas.setAttribute('aria-hidden', 'true');
    const rim = document.createElement('div');
    rim.dataset.landingLens = '';
    rim.dataset.siteLensRim = '';
    rim.setAttribute('aria-hidden', 'true');
    rim.hidden = true;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.landingLanguage = '';
    button.dataset.siteLanguage = '';
    button.className = 'site-language-toggle';
    button.setAttribute('aria-pressed', 'false');
    const label = document.createElement('span');
    label.dataset.languageLabel = '';
    label.textContent = '日本語';
    button.appendChild(label);
    heading.dataset.siteTextRegion = '';
    heading.dataset.landingTitle = '';
    heading.dataset.siteLensJa = japaneseLines.join('\n');
    heading.classList.add('site-text-title');
    heading.replaceChildren(source, translated, canvas);
    heading.after(button);
    main.appendChild(rim);
    const record = { heading, source, signature: signature(heading, document), dispose: null };

    // The shared renderer calls its default language English. Keep the service's
    // original Korean wording and native fallback action labels accurate.
    function syncLanguageButton() {
      const inJapanese = button.getAttribute('aria-pressed') === 'true';
      const targetLabel = inJapanese ? sourceLanguage === 'ko' ? '한국어' : 'English' : '日本語';
      const targetAria = inJapanese ? sourceLanguage === 'ko' ? '한국어 제목 보기' : 'Show English title' : '日本語のタイトルを表示';
      if (label.textContent !== targetLabel) label.textContent = targetLabel;
      if (button.getAttribute('aria-label') !== targetAria) button.setAttribute('aria-label', targetAria);
      button.lang = inJapanese ? sourceLanguage : 'ja';
    }
    const buttonObserver = new MutationObserver(syncLanguageButton);
    buttonObserver.observe(button, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-label'] });
    const foreground = getComputedStyle(heading).color;
    const components = foreground.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [23, 23, 23];
    const rgb = foreground.startsWith('color(') ? components : components.map(value => value / 255);
    const lightInk = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .55;
    const paperRGB = lightInk ? [.012, .025, .04] : [1, 1, 1];
    const disposeLens = mountLandingTextLens(main, { ...config.lens, paperRGB });
    syncLanguageButton();
    main.dataset.siteLensSource = sourceLanguage;
    record.dispose = replacement => {
      buttonObserver.disconnect();
      disposeLens();
      // A same-element copy update may have already replaced our source plane.
      // Do not overwrite that external update with the original title.
      if (heading.contains(source)) heading.replaceChildren(...(replacement || nativeNodes));
      button.remove();
      rim.remove();
      if (!originalSiteClass) heading.classList.remove('site-text-title');
      restoreAttributes.forEach(restore => restore());
    };
    return record;
  }

  function refresh() {
    queued = false;
    if (disposed) return;
    if (!main.isConnected) { dispose(); return; }
    const heading = main.querySelector(primarySelector);
    const currentSignature = heading ? signature(heading, document) : '';
    if (active && active.heading === heading && heading.contains(active.source) && active.signature === currentSignature) { mirrorMode(); return; }
    const replacement = active && active.heading === heading && heading.contains(active.source)
      ? [...active.source.childNodes].map(node => node.cloneNode(true)) : null;
    active?.dispose(replacement);
    active = null;
    if (heading?.isConnected) active = decorate(heading);
    mirrorMode();
  }
  function queueRefresh() {
    if (disposed || queued) return;
    queued = true;
    queueMicrotask(refresh);
  }
  const observer = new MutationObserver(queueRefresh);
  observer.observe(main, { childList: true, subtree: true, characterData: true });
  const stateObserver = new MutationObserver(mirrorMode);
  stateObserver.observe(main, { attributes: true, attributeFilter: ['data-landing-text-mode'] });
  const removal = new MutationObserver(() => { if (!main.isConnected) dispose(); });
  removal.observe(document.body, { childList: true, subtree: true });
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect(); stateObserver.disconnect(); removal.disconnect();
    active?.dispose();
    active = null;
    if (previousSiteLens === null) main.removeAttribute('data-site-lens'); else main.setAttribute('data-site-lens', previousSiteLens);
    if (previousSiteSource === null) main.removeAttribute('data-site-lens-source'); else main.setAttribute('data-site-lens-source', previousSiteSource);
    if (mounted.get(main) === dispose) mounted.delete(main);
  }
  mounted.set(main, dispose);
  refresh();
  return dispose;
}
