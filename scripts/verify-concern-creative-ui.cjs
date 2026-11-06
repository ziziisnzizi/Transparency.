// Optional browser check: npm install --no-save playwright. All API replies are mocked.
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
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
    async function setup(width, theme, handler) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: 'reduce' });
      await context.addInitScript(value => localStorage.setItem('transparency-theme', value), theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/concern-ai', route => route.fulfill({ status: 503, body: '{}' }).catch(() => {}));
      await page.route('**/api/concern-news?*', route => route.fulfill({ status: 503, body: '{}' }).catch(() => {}));
      await page.route('**/api/concern-creative', handler);
      await page.goto(`${base}?view=concerns`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return { context, page, errors };
    }
    async function search(page, query) {
      await page.locator('#concern-query').fill(query);
      await page.locator('#concern-query').press('Enter', { noWaitAfter: true });
      await page.locator('#concern-results').waitFor({ timeout: 10000 });
      assert.match(await page.locator('.concern-query-context').innerText(), new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    const success = message => ({ status: 'ok', productSlug: 'toner-t1', message });
    const layouts = [];
    for (const [width, theme] of [[390, 'light'], [1440, 'dark']]) {
      const requests = [];
      const t = await setup(width, theme, async route => {
        requests.push(route.request().postDataJSON());
        await new Promise(resolve => setTimeout(resolve, 1800));
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(success('사랑은 투명한 토너와 닮았어요. <img src=x onerror="window.__unsafe=1">')) }).catch(() => {});
      });
      await search(t.page, '사랑이 뭐야?');
      await t.page.locator('.concern-creative-message').waitFor({ timeout: 10000 });
      assert.match(await t.page.locator('.concern-creative-message').innerText(), /사랑은 투명한 토너/);
      assert.equal(await t.page.locator('.concern-creative-message img').count(), 0, 'Generated text must remain text');
      assert.equal(await t.page.evaluate(() => window.__unsafe), undefined);
      assert.deepEqual(requests, [{ query: '사랑이 뭐야?' }]);
      assert.equal(await t.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(t.errors, []);
      layouts.push({ width, theme, passed: true });
      await t.context.close();
    }

    // An invalid product slug or unavailable service never renders generated text;
    // retry can recover using a verified known product.
    let calls = 0;
    const retry = await setup(1440, 'light', async route => {
      calls++;
      const data = calls === 1 ? { status: 'ok', productSlug: 'unknown-product', message: '표시하면 안 되는 제품' } : success('검증된 제품 연결');
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }).catch(() => {});
    });
    await search(retry.page, '사랑이 뭐야?');
    await retry.page.locator('[data-concern-creative-retry]').waitFor({ timeout: 10000 });
    assert(!(await retry.page.locator('#concern-creative').innerText()).includes('표시하면 안 되는 제품'));
    await retry.page.locator('[data-concern-creative-retry]').click();
    await retry.page.locator('.concern-creative-message').waitFor({ timeout: 10000 });
    assert.match(await retry.page.locator('.concern-creative-message').innerText(), /검증된 제품 연결/);
    assert.equal(calls, 2);
    await retry.context.close();

    // A late first response must never replace a newer question's creative result.
    let raceCalls = 0;
    const race = await setup(1440, 'light', async route => {
      const query = route.request().postDataJSON().query;
      raceCalls++;
      await new Promise(resolve => setTimeout(resolve, query.includes('사랑') ? 2500 : 50));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(success(query.includes('사랑') ? '이전 질문 연결' : '현재 질문 연결')) }).catch(() => {});
    });
    await race.page.locator('#concern-query').fill('사랑이 뭐야?');
    await race.page.locator('#concern-query').press('Enter', { noWaitAfter: true });
    await race.page.locator('.concern-search-loading').waitFor();
    await race.page.locator('#concern-query').fill('행복은 뭐야?');
    await race.page.locator('#concern-query').press('Enter', { noWaitAfter: true });
    await race.page.locator('.concern-creative-message').waitFor({ timeout: 10000 });
    await race.page.waitForTimeout(2600);
    assert.match(await race.page.locator('.concern-creative-message').innerText(), /현재 질문 연결/);
    assert.equal(raceCalls, 2);
    await race.context.close();

    // Even a compromised service response must not produce a playful product
    // recommendation for a medical or allergy question.
    const care = await setup(390, 'light', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(success('피부에 사용하세요.')) }).catch(() => {}));
    for (const question of ['피부에 좁쌀 여드름이 생겼어요', '글리세린에 알레르기가 있어요']) {
      await search(care.page, question);
      await care.page.waitForTimeout(1000);
      assert.equal(await care.page.locator('.concern-creative-message').count(), 0);
      assert.match(await care.page.locator('.concern-result-heading').innerText(), /피부 상태|확인/);
      assert.equal(await care.page.locator('.concern-catalog .concern-product').count(), 3);
      assert.match(await care.page.locator('.concern-catalog').innerText(), /저자극·알레르기 관련 인증이나 시험 자료는 확인되지 않았습니다/);
    }
    await care.context.close();

    // Server-side safety can identify a concern not recognized by local rules.
    const serverCare = await setup(1440, 'dark', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'caution' }) }).catch(() => {}));
    await serverCare.page.locator('#concern-query').fill('이것에 대해 알려줘');
    await serverCare.page.locator('#concern-query').press('Enter', { noWaitAfter: true });
    await serverCare.page.locator('.concern-sensitive-notice').waitFor({ timeout: 10000 });
    assert.equal(await serverCare.page.locator('.concern-creative-message').count(), 0);
    assert.equal(await serverCare.page.locator('.concern-products').count(), 0);
    await serverCare.context.close();

    // Navigating away while Gemini is pending must not reinsert the response.
    const away = await setup(1440, 'light', async route => {
      await new Promise(resolve => setTimeout(resolve, 2200));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(success('떠난 뒤의 응답')) }).catch(() => {});
    });
    await away.page.locator('#concern-query').fill('사랑이 뭐야?');
    await away.page.locator('#concern-query').press('Enter', { noWaitAfter: true });
    await away.page.locator('.concern-search-loading').waitFor();
    await away.page.locator('nav[aria-label="주요 메뉴"] [data-page="홈"]').click({ noWaitAfter: true });
    await away.page.waitForTimeout(2500);
    assert.equal(await away.page.locator('#hero-title').count(), 1);
    assert.equal(await away.page.locator('.concern-creative-message:visible').count(), 0);
    await away.context.close();

    // A crisis request must show support information and omit brand promotion;
    // the raw question is not sent to either AI endpoint or the news service.
    let sensitiveCreative = 0;
    const sensitive = await setup(390, 'light', route => { sensitiveCreative++; return route.fulfill({ status: 503, body: '{}' }).catch(() => {}); });
    let sensitiveWeb = 0, sensitiveNews = 0;
    await sensitive.page.unroute('**/api/concern-ai');
    await sensitive.page.unroute('**/api/concern-news?*');
    await sensitive.page.route('**/api/concern-ai', route => { sensitiveWeb++; return route.fulfill({ status: 503, body: '{}' }).catch(() => {}); });
    await sensitive.page.route('**/api/concern-news?*', route => { sensitiveNews++; return route.fulfill({ status: 503, body: '{}' }).catch(() => {}); });
    await sensitive.page.locator('#concern-query').fill('죽고 싶어요');
    await sensitive.page.locator('#concern-query').press('Enter', { noWaitAfter: true });
    await sensitive.page.locator('.concern-sensitive-notice').waitFor({ timeout: 10000 });
    assert.match(await sensitive.page.locator('.concern-sensitive-notice').innerText(), /가까운 사람/);
    assert.match(await sensitive.page.locator('.concern-sensitive-notice').innerText(), /긴급/);
    for (const selector of ['#concern-creative', '#concern-ai', '.concern-products', '#concern-news']) assert.equal(await sensitive.page.locator(selector).count(), 0, selector);
    assert.equal(sensitiveCreative, 0);
    assert.equal(sensitiveWeb, 0);
    assert.equal(sensitiveNews, 0);
    await sensitive.context.close();

    // Review text must not be transmitted before a separate explicit request.
    let reviewCalls = 0;
    const review = await setup(1440, 'light', route => { reviewCalls++; return route.fulfill({ status: 503, body: '{}' }).catch(() => {}); });
    await review.page.goto(`${base}?product=toner-t1`, { waitUntil: 'domcontentloaded' });
    await review.page.getByRole('tab', { name: '사용자 리뷰' }).click();
    await review.page.locator('[data-review-concern]').first().click();
    await review.page.locator('[data-concern-creative-retry]').waitFor({ timeout: 10000 });
    assert.equal(reviewCalls, 0);
    await review.page.locator('[data-concern-creative-retry]').click();
    await review.page.waitForFunction(() => document.querySelector('#concern-creative') && !document.querySelector('.concern-creative-message'), null, { timeout: 10000 });
    assert.equal(reviewCalls, 1);
    await review.context.close();
    console.log(JSON.stringify({ passed: true, layouts, validation: true, retry: true, race: true, care: true, navigation: true, sensitive: true, reviewConsent: true }));
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
