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
      let estimateCalls = 0;
      const renderer = {
        estimate() { estimateCalls++; throw new Error('Text color must not depend on the background'); },
        sample() { throw new Error('Text color must not read the GPU background'); },
      };
      const source = document.querySelector('[data-site-source-plane] [data-landing-line]');
      const clone = document.querySelector('[data-language-plane="ja"] span');
      const small = document.querySelector('#app > p');
      const state = () => ({ source: source.hasAttribute('data-ink-inverse'), clone: clone.hasAttribute('data-ink-inverse'), small: small.hasAttribute('data-ink-inverse'), halo: source.hasAttribute('data-ink-halo'), card: document.querySelector('.product p').hasAttribute('data-backdrop-ink'), color: getComputedStyle(source).color, cloneColor: getComputedStyle(clone).color, smallColor: getComputedStyle(small).color });
      ink.update(renderer, true);
      const onNavy = state();
      ink.update(renderer, true);
      const onWhite = state();
      document.documentElement.dataset.theme = 'dark';
      ink.update(renderer, true);
      const dark = state();
      ink.dispose();
      return { onNavy, onWhite, dark, estimateCalls };
    });
    for (const view of [result.onNavy, result.onWhite, result.dark]) {
      assert.equal(view.source, false);
      assert.equal(view.clone, false);
      assert.equal(view.small, false);
      assert.equal(view.halo, false);
      assert.equal(view.card, false);
    }
    for (const view of [result.onNavy, result.onWhite]) {
      assert.equal(view.color, 'rgb(23, 23, 23)');
      assert.equal(view.cloneColor, 'rgb(23, 23, 23)');
      assert.equal(view.smallColor, 'rgb(23, 23, 23)');
    }
    assert.equal(result.dark.color, 'rgb(247, 251, 255)');
    assert.equal(result.dark.cloneColor, 'rgb(247, 251, 255)');
    assert.equal(result.dark.smallColor, 'rgb(247, 251, 255)');
    assert.equal(result.estimateCalls, 0);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, result }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
