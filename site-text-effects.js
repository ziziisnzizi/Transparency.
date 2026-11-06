import { mountSiteWideTextLens } from './site-wide-text-lens.js';

const mounted = new WeakMap();
const normalize = value => String(value ?? '').normalize('NFC').replace(/\s+/g, '');
// Only headings with a configured translation are decorated. Include the
// section and product-tab headings as well as each page's main heading.
const primarySelector = '#hero-title, .page-title, .concern-page-intro>h1, h2';

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
  const explicit = heading.getAttribute('data-lens-en');
  if (explicit) {
    try {
      const parsed = JSON.parse(explicit);
      if (Array.isArray(parsed) && parsed.every(line => typeof line === 'string')) return parsed;
      if (typeof parsed === 'string') return parsed.split(/\r?\n/);
    } catch { /* Ordinary text and literal newlines are also supported. */ }
    return explicit.split(/\r?\n/);
  }
  if (heading.id === 'hero-title' && heading.querySelector('[data-site-hero-line]') && Array.isArray(config.hero?.en)) return config.hero.en;
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
  const active = new Map();
  let wide = null, disposed = false, queued = false;
  const previousSiteLens = main.getAttribute('data-site-lens');
  const previousSiteSource = main.getAttribute('data-site-lens-source');
  const previousSiteTarget = main.getAttribute('data-site-lens-target');

  function mirrorMode() {
    main.dataset.siteLens = active.size && main.dataset.landingTextMode === 'webgl' ? 'active' : 'native';
    if (!active.size) { delete main.dataset.siteLensSource; delete main.dataset.siteLensTarget; }
  }

  function decorate(heading) {
    const lines = lineNodes(heading, document);
    const englishLines = translations(heading, lines, config);
    if (!englishLines?.length || !lines.some(line => normalize(line.textContent))) return null;
    const content = lines.map(line => line.textContent).join(' ');
    const sourceLanguage = heading.id === 'hero-title' && heading.querySelector('[data-site-hero-line]')
      ? 'ko' : heading.lang || (/[\uac00-\ud7af]/.test(content) ? 'ko' : 'en');
    const nativeNodes = [...heading.childNodes];
    const originalSiteClass = heading.classList.contains('site-text-title');
    const restoreAttributes = ['data-site-text-region', 'data-landing-title', 'data-site-lens-en'].map(name => preserveAttribute(heading, name));
    const source = document.createElement('span');
    source.dataset.languagePlane = 'en';
    source.dataset.siteSourcePlane = '';
    source.lang = sourceLanguage;
    source.setAttribute('aria-hidden', 'false');
    const translated = document.createElement('span');
    translated.dataset.languagePlane = 'ja';
    // Legacy role ID "ja" remains only as a CSS/texture hook, never a language.
    translated.lang = 'en';
    translated.setAttribute('aria-hidden', 'true');
    translated.style.opacity = '0';
    lines.forEach(line => {
      line.dataset.landingLine = '';
      source.appendChild(line);
    });
    englishLines.forEach((copy, index) => {
      const line = lines[index] ? lines[index].cloneNode(false) : document.createElement('span');
      line.dataset.landingLine = '';
      line.textContent = copy;
      if (heading.id === 'hero-title' && !lines[index]) line.style.setProperty('--site-line-offset', `${Number(config.hero?.offsets?.[index]) || 0}%`);
      translated.appendChild(line);
    });
    heading.dataset.siteTextRegion = '';
    heading.dataset.landingTitle = '';
    heading.dataset.siteLensEn = englishLines.join('\n');
    heading.classList.add('site-text-title');
    heading.replaceChildren(source, translated);
    const record = { heading, source, signature: signature(heading, document), dispose: null };

    main.dataset.siteLensSource = sourceLanguage;
    main.dataset.siteLensTarget = 'en';
    const measurement = document.createElement('canvas').getContext('2d');
    const targetStyles = [...translated.children].map(line => ({ line, size: line.style.fontSize, spacing: line.style.letterSpacing, height: line.style.lineHeight }));
    function fitEnglishLines() {
      if (!measurement || !heading.isConnected) return;
      const parentStyle = getComputedStyle(heading);
      const width = heading.getBoundingClientRect().width - (parseFloat(parentStyle.paddingLeft) || 0) - (parseFloat(parentStyle.paddingRight) || 0);
      for (const original of targetStyles) {
        const line = original.line;
        line.style.fontSize = original.size;
        line.style.letterSpacing = original.spacing;
        line.style.lineHeight = original.height;
        line.style.whiteSpace = 'nowrap';
        const style = getComputedStyle(line);
        measurement.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const spacing = parseFloat(style.letterSpacing) || 0;
        if ('letterSpacing' in measurement) measurement.letterSpacing = `${spacing}px`;
        const copy = line.textContent;
        const textWidth = measurement.measureText(copy).width + ('letterSpacing' in measurement ? 0 : Math.max(0, [...copy].length - 1) * spacing);
        const available = Math.max(1, width - (parseFloat(style.marginLeft) || 0) - (parseFloat(style.marginRight) || 0));
        if (textWidth > available) {
          const scale = Math.max(.4, available / textWidth);
          line.style.fontSize = `${parseFloat(style.fontSize) * scale}px`;
          line.style.letterSpacing = `${spacing * scale}px`;
          line.style.lineHeight = style.lineHeight;
        }
      }
    }
    fitEnglishLines();
    const fitting = new ResizeObserver(fitEnglishLines);
    fitting.observe(heading);
    document.fonts?.addEventListener('loadingdone', fitEnglishLines);
    document.fonts?.ready.then(fitEnglishLines);
    record.dispose = replacement => {
      wide?.invalidate();
      fitting.disconnect();
      document.fonts?.removeEventListener('loadingdone', fitEnglishLines);
      // A same-element copy update may have already replaced our source plane.
      // Do not overwrite that external update with the original title.
      if (heading.contains(source)) heading.replaceChildren(...(replacement || nativeNodes));
      if (!originalSiteClass) heading.classList.remove('site-text-title');
      restoreAttributes.forEach(restore => restore());
    };
    return record;
  }

  function refresh() {
    queued = false;
    if (disposed) return;
    if (!main.isConnected) { dispose(); return; }
    const headings = [...main.querySelectorAll(primarySelector)];
    const candidates = new Set(headings);
    for (const [heading, record] of active) {
      if (candidates.has(heading) && heading.contains(record.source) && record.signature === signature(heading, document)) continue;
      const replacement = candidates.has(heading) && heading.contains(record.source)
        ? [...record.source.childNodes].map(node => node.cloneNode(true)) : null;
      record.dispose(replacement);
      active.delete(heading);
    }
    for (const heading of headings) {
      if (active.has(heading) || !heading.isConnected) continue;
      const record = decorate(heading);
      if (record) active.set(heading, record);
    }
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
    wide?.(); wide = null;
    for (const record of active.values()) record.dispose();
    active.clear();
    if (previousSiteLens === null) main.removeAttribute('data-site-lens'); else main.setAttribute('data-site-lens', previousSiteLens);
    if (previousSiteSource === null) main.removeAttribute('data-site-lens-source'); else main.setAttribute('data-site-lens-source', previousSiteSource);
    if (previousSiteTarget === null) main.removeAttribute('data-site-lens-target'); else main.setAttribute('data-site-lens-target', previousSiteTarget);
    if (mounted.get(main) === dispose) mounted.delete(main);
  }
  mounted.set(main, dispose);
  refresh();
  wide = mountSiteWideTextLens(document, config);
  mirrorMode();
  return dispose;
}
