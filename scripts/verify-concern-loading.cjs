// Optional integration check: npm install --no-save playwright && npx playwright install chromium.
// Web responses are mocked: no questions are sent to an external service.
const { strict: assert } = require('node:assert');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--enable-webgl', '--enable-unsafe-swiftshader'] });

    async function setup(options) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      page.setDefaultNavigationTimeout(30000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/concern-news?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'unavailable', articles: [] }) }).catch(() => {}));
      return { context, page, errors };
    }
    const responseFor = query => ({ status: 'ok', sourceMode: 'research', answer: query.includes('가벼운') ? '두 번째 질문의 AI 답변' : '첫 번째 질문의 AI 답변', sources: [{ title: '공개 연구 논문', url: 'https://pubmed.ncbi.nlm.nih.gov/123/' }] });
    async function submit(page, question) {
      const input = page.locator('#concern-query');
      await input.fill(question);
      await input.press('Enter', { noWaitAfter: true });
    }

    // Fast API responses should not skip the initial droplet state on mobile.
    const mobile = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await mobile.page.route('**/api/concern-ai', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(responseFor('첫 번째 질문')) }).catch(() => {}));
    await mobile.page.goto(`${base}?view=concerns`, { waitUntil: 'domcontentloaded' });
    await submit(mobile.page, '세안 후 피부가 당겨요');
    const mobileLoading = mobile.page.locator('.concern-search-loading[role="status"]');
    await mobileLoading.waitFor({ state: 'visible', timeout: 2000 });
    assert.match(await mobileLoading.innerText(), /찾|확인|살펴/);
    assert.equal(await mobile.page.locator('#concern-results').count(), 0, 'The answer should not appear before loading');
    assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal overflow on mobile');
    await mobile.page.locator('#concern-results').waitFor({ state: 'visible', timeout: 6000 });
    assert.equal(await mobileLoading.count(), 0, 'Loading should end when results appear');
    assert.match(await mobile.page.locator('.concern-query-context').innerText(), /세안 후 피부가 당겨요/);
    await mobile.page.locator('.concern-ai-answer').waitFor({ timeout: 6000 });
    assert.deepEqual(mobile.errors, []);
    await mobile.context.close();

    // When a second search starts before the first finishes, neither the first
    // timer nor its delayed response may replace the second result.
    const race = await setup({ viewport: { width: 1440, height: 900 } });
    let requestCount = 0;
    await race.page.route('**/api/concern-ai', async route => {
      const request = route.request().postDataJSON();
      const number = ++requestCount;
      await new Promise(resolve => setTimeout(resolve, number === 1 ? 2100 : 100));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(responseFor(request.query)) }).catch(() => {});
    });
    await race.page.goto(`${base}?view=concerns`, { waitUntil: 'domcontentloaded' });
    await submit(race.page, '세안 후 피부가 당겨요');
    await race.page.locator('.concern-search-loading[role="status"]').waitFor();
    await submit(race.page, '가벼운 제형을 찾고 싶어요');
    await race.page.locator('#concern-results').waitFor({ timeout: 6000 });
    assert.match(await race.page.locator('.concern-query-context').innerText(), /가벼운 제형을 찾고 싶어요/);
    await race.page.locator('.concern-ai-answer').waitFor({ timeout: 6000 });
    await race.page.waitForTimeout(2200);
    assert.match(await race.page.locator('.concern-query-context').innerText(), /가벼운 제형을 찾고 싶어요/);
    assert.match(await race.page.locator('.concern-ai-answer').innerText(), /두 번째 질문/);
    assert.deepEqual(race.errors, []);
    await race.context.close();

    // Reduced-motion users still receive a status and result; leaving during
    // loading must not navigate back or insert an old result on the new page.
    const reduced = await setup({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await reduced.page.route('**/api/concern-ai', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(responseFor('첫 번째 질문')) }).catch(() => {}));
    await reduced.page.goto(`${base}?view=concerns`, { waitUntil: 'domcontentloaded' });
    await submit(reduced.page, '피부 보습이 궁금해요');
    await reduced.page.locator('.concern-search-loading[role="status"]').waitFor({ timeout: 2000 });
    for (const selector of ['.concern-search-droplet-core', '.concern-search-droplet-ring']) {
      assert.equal(await reduced.page.locator(selector).evaluate(element => getComputedStyle(element).animationName), 'none', 'Reduced motion should stop droplet animation');
    }
    await reduced.page.locator('#concern-results').waitFor({ timeout: 6000 });
    assert.match(await reduced.page.locator('.concern-query-context').innerText(), /피부 보습이 궁금해요/);
    await submit(reduced.page, '세안 후 피부가 당겨요');
    await reduced.page.locator('.concern-search-loading[role="status"]').waitFor({ timeout: 2000 });
    await submit(reduced.page, '');
    await reduced.page.locator('#concern-search-error').waitFor({ state: 'visible' });
    await reduced.page.waitForTimeout(1400);
    assert.equal(await reduced.page.locator('#concern-results').count(), 0, 'An invalid replacement must cancel the older result');
    await submit(reduced.page, '세안 후 피부가 당겨요');
    await reduced.page.locator('.concern-search-loading[role="status"]').waitFor({ timeout: 2000 });
    await reduced.page.locator('nav[aria-label="주요 메뉴"] [data-page="홈"]').click({ noWaitAfter: true });
    await reduced.page.waitForTimeout(1800);
    assert.equal(await reduced.page.locator('.concern-search-loading:visible').count(), 0);
    assert.equal(await reduced.page.locator('#concern-results:visible').count(), 0);
    assert.equal(await reduced.page.locator('#hero-title').count(), 1, 'Leaving search should keep the user on home');
    assert.deepEqual(reduced.errors, []);
    await reduced.context.close();

    console.log(JSON.stringify({ passed: true, mobile: true, fastResponse: true, race: true, navigation: true, reducedMotion: true }));
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
