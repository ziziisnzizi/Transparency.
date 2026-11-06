// Optional browser check: install Playwright and Chromium before running.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async () => {
      document.documentElement.dataset.theme = 'light';
      document.body.innerHTML = '<div id="app"><h1 class="page-title"><span data-site-source-plane><span data-landing-line>큰 글자 대비 테스트</span></span><span data-language-plane="ja"><span>English contrast</span></span></h1><p class="page-intro">작은 본문 가독성을 확인합니다.</p><article class="product"><p class="page-intro">제품 카드 내부</p></article></div>';
      const { createBackdropInk } = await import('/backdrop-ink.js');
      const ink = createBackdropInk(document);
      let color = [.02, .05, .12], estimateCalls = 0;
      const renderer = {
        estimate(points) { estimateCalls++; return points.map(() => color); },
        sample() { throw new Error('GPU readback must not be used for contrast'); },
      };
      const source = document.querySelector('[data-site-source-plane] [data-landing-line]');
      const clone = document.querySelector('[data-language-plane="ja"] span');
      const small = document.querySelector('#app > p');
      const state = () => ({ source: source.hasAttribute('data-ink-inverse'), clone: clone.hasAttribute('data-ink-inverse'), small: small.hasAttribute('data-ink-inverse'), card: document.querySelector('.product p').hasAttribute('data-backdrop-ink'), color: getComputedStyle(source).color });
      ink.update(renderer, true);
      const onNavy = state();
      color = [1, 1, 1];
      ink.update(renderer, true);
      const onWhite = state();
      document.documentElement.dataset.theme = 'dark';
      color = [0, 0, 0];
      const callsBeforeDark = estimateCalls;
      ink.update(renderer, true);
      const dark = { inverse: source.hasAttribute('data-ink-inverse'), halo: source.hasAttribute('data-ink-halo'), estimateCallsBefore: callsBeforeDark, estimateCallsAfter: estimateCalls };
      ink.dispose();
      return { onNavy, onWhite, dark, estimateCalls };
    });
    assert.equal(result.onNavy.source, true);
    assert.equal(result.onNavy.clone, true);
    assert.equal(result.onNavy.small, true);
    assert.equal(result.onNavy.card, false);
    assert.equal(result.onNavy.color, 'rgb(255, 255, 255)');
    assert.equal(result.onWhite.source, false);
    assert.equal(result.onWhite.clone, false);
    assert.equal(result.onWhite.small, false);
    assert.equal(result.onWhite.color, 'rgb(23, 23, 23)');
    assert.equal(result.dark.inverse, false);
    assert.equal(result.dark.halo, false);
    assert.equal(result.dark.estimateCallsBefore, result.dark.estimateCallsAfter);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, result }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
