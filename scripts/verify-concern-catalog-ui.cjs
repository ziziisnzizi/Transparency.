// Optional browser check: npm install --no-save playwright. Requests are mocked.
const { strict: assert } = require('node:assert');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
    const base = `http://127.0.0.1:${server.httpServer.address().port}/?view=concerns`;
    const checks = [];
    for (const [width, theme] of [[390, 'light'], [1440, 'dark']]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(value => localStorage.setItem('transparency-theme', value), theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/concern-ai', route => route.fulfill({ status: 503, body: '{}' }).catch(() => {}));
      await page.route('**/api/concern-news?*', route => route.fulfill({ status: 503, body: '{}' }).catch(() => {}));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      async function search(query) {
        await page.locator('#concern-query').fill(query);
        await page.locator('#concern-query').press('Enter');
        await page.locator('.concern-search-loading').waitFor();
        await page.locator('#concern-results').waitFor({ timeout: 8000 });
        assert((await page.locator('.concern-query-context').innerText()).includes(query));
      }
      for (const query of ['피부에 좁쌀 여드름이 생겼어', '글리세린에 알레르기가 있어요', '무향이고 알코올 없는 제품으로 추천해줘']) {
        await search(query);
        const catalog = page.locator('.concern-catalog');
        assert.equal(await catalog.locator('.concern-product').count(), 3);
        const copy = await catalog.innerText();
        assert.match(copy, /일반 정보/);
        assert.match(copy, /적합하다고 확인한 결과는 아니/);
        assert.match(copy, /알레르기 성분이 포함된 제품은 사용하지/);
        assert.doesNotMatch(copy, /먼저 살펴볼 제품|고민과 가까운 선택|연결해서 볼 이유/);
        assert(await page.evaluate(() => Boolean(document.querySelector('.concern-result-heading').compareDocumentPosition(document.querySelector('.concern-catalog')) & Node.DOCUMENT_POSITION_FOLLOWING)));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      await page.locator('.concern-catalog [data-concern-product]').first().click();
      await page.getByRole('tab', { name: '성분·함량' }).waitFor();
      assert.equal(await page.getByRole('tab', { name: '성분·함량' }).getAttribute('aria-selected'), 'true');
      assert.match(await page.locator('#detail-panel').innerText(), /전성분/);
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await search('세안 후 피부가 당겨요');
      assert.equal(await page.locator('.concern-catalog').count(), 0);
      assert.match(await page.locator('.concern-products').innerText(), /고민과 가까운 선택/);
      assert.deepEqual(errors, []);
      checks.push({ width, theme, passed: true });
      await context.close();
    }
    console.log(JSON.stringify({ passed: true, checks, ingredientNavigation: true }));
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
