// Optional integration check: npm install --no-save playwright && npx playwright install chromium.
// Provider responses are mocked; no user data or search queries leave the browser.
const { strict: assert } = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const safeSuggestions = process.env.CONCERN_AI_SUGGESTION_FIXTURE ? fs.readFileSync(process.env.CONCERN_AI_SUGGESTION_FIXTURE, 'utf8') : '<div><a href="https://www.google.com/search?q=skin" target="_blank">Google 검색</a></div>';

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--enable-webgl', '--enable-unsafe-swiftshader'] });
    const results = [];
    for (const width of [320, 390, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : width === 390 ? 844 : 900 }, isMobile: width < 500, hasTouch: width < 500, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('transparency-theme', theme), theme);
      const page = await context.newPage();
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/concern-news?*', async route => {
        const topic = new URL(route.request().url()).searchParams.get('topic');
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ topic, status: 'unavailable', articles: [] }) });
      });
      await page.route('**/api/concern-ai', async route => {
        const body = route.request().postDataJSON();
        requests.push(body);
        // Keep the AI request pending after the initial search animation so
        // the separate cancellation state is observable.
        await new Promise(resolve => setTimeout(resolve, 4000));
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', sourceMode: 'google', answer: '검증용 웹 자료 요약입니다. <img src=x onerror="window.__unsafe=1">', sources: [{ title: '신뢰할 수 있는 출처', url: 'https://pubmed.ncbi.nlm.nih.gov/123/' }], searchQueries: ['skin hydration'], searchSuggestions: safeSuggestions }) }).catch(() => {});
      });
      await page.goto(`${base}?view=concerns`, { waitUntil: 'domcontentloaded' });
      const hint = await page.locator('#concern-search-hint').innerText();
      assert.match(hint, /Gemini/); assert.match(hint, /Google/); assert.match(hint, /위키백과/); assert.match(hint, /30일/); assert.match(hint, /민감/);
      await page.locator('#concern-query').fill('세안 후 피부가 당겨요');
      await page.locator('[data-concern-form] button[type="submit"]').click({ noWaitAfter: true });
      await page.locator('[data-concern-ai-cancel]').waitFor();
      assert.equal(requests.length, 1); assert.deepEqual(requests[0], { query: '세안 후 피부가 당겨요' });
      await page.locator('.concern-ai-answer').waitFor();
      assert((await page.locator('.concern-ai-answer').innerText()).includes('검증용 웹 자료 요약입니다.'));
      assert.equal(await page.locator('.concern-ai-answer img').count(), 0, 'AI output must remain text');
      assert.equal(await page.evaluate(() => window.__unsafe), undefined);
      const sources = page.locator('.concern-ai-sources a');
      assert.equal(await sources.count(), 1, 'The grounded source must be displayed');
      assert.equal(await sources.first().getAttribute('href'), 'https://pubmed.ncbi.nlm.nih.gov/123/');
      assert.equal(await sources.first().getAttribute('rel'), 'noopener noreferrer');
      assert.equal(await page.evaluate(() => !!document.querySelector('[data-concern-ai-suggestions]')?.shadowRoot?.querySelector('a')), true, 'Google search suggestions must be displayed');
      assert.match(await page.locator('.concern-ai-label').innerText(), /Google 웹 검색 기반 AI 요약/);
      assert.equal(await page.evaluate(() => {
        const baseResult = document.querySelector('.concern-result-heading');
        const ai = document.querySelector('#concern-ai');
        const product = document.querySelector('.concern-products');
        return !!(baseResult && ai && product && (baseResult.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING) && (ai.compareDocumentPosition(product) & Node.DOCUMENT_POSITION_FOLLOWING));
      }), true, 'Base answer, AI results, then brand recommendation');
      assert((await page.locator('.concern-products').innerText()).includes('세럼 S.1'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.deepEqual(errors, []);
      results.push({ width, theme, passed: true });
      await context.close();
    }

    // Cancellation, retry, and an out-of-order first answer must not replace
    // the most recently submitted concern.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    let calls = 0;
    await page.route('**/api/concern-news?*', async route => {
      const topic = new URL(route.request().url()).searchParams.get('topic');
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ topic, status: 'unavailable', articles: [] }) });
    });
    await page.route('**/api/concern-ai', async route => {
      const body = route.request().postDataJSON(); calls++;
      const currentCall = calls;
      await new Promise(resolve => setTimeout(resolve, currentCall === 1 || currentCall === 3 ? 4000 : 100));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', sourceMode: 'google', answer: body.query.includes('당겨요') ? '당김에 대한 결과' : '현재 질문의 결과', sources: [{ title: '관련 원문', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' }], searchQueries: [], searchSuggestions: safeSuggestions }) }).catch(() => {});
    });
    await page.goto(`${base}?view=concerns`, { waitUntil: 'domcontentloaded' });
    await page.locator('#concern-query').fill('세안 후 피부가 당겨요');
    await page.locator('[data-concern-form] button[type="submit"]').click({ noWaitAfter: true });
    await page.locator('[data-concern-ai-cancel]').click({ noWaitAfter: true });
    assert((await page.locator('#concern-ai').innerText()).includes('취소'));
    await page.locator('[data-concern-ai-retry]').click();
    await page.locator('.concern-ai-answer').waitFor();
    assert((await page.locator('.concern-ai-answer').innerText()).includes('당김에 대한 결과'));
    await page.locator('#concern-query').fill('세안 후 피부가 당겨요');
    await page.locator('[data-concern-form] button[type="submit"]').click({ noWaitAfter: true });
    await page.locator('[data-concern-ai-cancel]').waitFor();
    await page.locator('#concern-query').fill('가벼운 제형을 찾고 싶어요');
    await page.locator('[data-concern-form] button[type="submit"]').click({ noWaitAfter: true });
    await page.locator('.concern-ai-answer').waitFor();
    assert((await page.locator('.concern-ai-answer').innerText()).includes('현재 질문의 결과'));
    await page.waitForTimeout(4100);
    assert(!(await page.locator('#concern-ai').innerText()).includes('당김에 대한 결과'));
    assert.equal(calls, 4);
    await context.close();

    // Even a compromised API response cannot inject scripts through the Google
    // suggestions block. The entire generated response must be withheld.
    const hostile = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const hostilePage = await hostile.newPage();
    await hostilePage.route('**/api/concern-ai', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', sourceMode: 'google', answer: '표시되면 안 되는 결과', sources: [{ title: '원문', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' }], searchQueries: [], searchSuggestions: '<div><img src=x onerror="window.__suggestionUnsafe=1"><a href="https://www.google.com/search?q=skin">Google 검색</a></div>' }) }));
    await hostilePage.route('**/api/concern-news?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'unavailable', articles: [] }) }));
    await hostilePage.goto(`${base}?view=concerns`, { waitUntil: 'domcontentloaded' });
    await hostilePage.locator('#concern-query').fill('세안 후 피부가 당겨요');
    await hostilePage.locator('[data-concern-form] button[type="submit"]').click({ noWaitAfter: true });
    await hostilePage.locator('[data-concern-ai-retry]').waitFor();
    assert(!(await hostilePage.locator('#concern-ai').innerText()).includes('표시되면 안 되는 결과'));
    assert.equal(await hostilePage.evaluate(() => window.__suggestionUnsafe), undefined);
    await hostilePage.unroute('**/api/concern-ai');
    await hostilePage.route('**/api/concern-ai', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', sourceMode: 'google', answer: '안전하지 않은 출처의 결과', sources: [{ title: '위험한 주소', url: 'javascript:alert(1)' }], searchQueries: [], searchSuggestions: safeSuggestions }) }));
    await hostilePage.locator('#concern-query').fill('피부가 건조해요');
    await hostilePage.locator('[data-concern-form] button[type="submit"]').click({ noWaitAfter: true });
    await hostilePage.locator('[data-concern-ai-retry]').waitFor();
    assert(!(await hostilePage.locator('#concern-ai').innerText()).includes('안전하지 않은 출처의 결과'));
    await hostile.close();

    // Research fallback has its own provenance and must never masquerade as
    // Google search; each mode must provide the evidence it promises.
    const modesContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const modesPage = await modesContext.newPage();
    let response = { status: 'ok', sourceMode: 'research', answer: '공개 연구자료 요약', sources: [{ title: '공개 연구 논문', url: 'https://europepmc.org/article/MED/123' }], searchQueries: [] };
    let responseStatus = 200;
    await modesPage.route('**/api/concern-ai', route => route.fulfill({ status: responseStatus, contentType: 'application/json', body: JSON.stringify(response) }));
    await modesPage.route('**/api/concern-news?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'unavailable', articles: [] }) }));
    await modesPage.goto(`${base}?view=concerns`, { waitUntil: 'domcontentloaded' });
    const submitModeQuestion = async query => {
      await modesPage.locator('#concern-query').fill(query);
      await modesPage.locator('[data-concern-form] button[type="submit"]').click({ noWaitAfter: true });
      await modesPage.locator('.concern-search-loading').waitFor();
    };
    await submitModeQuestion('피부가 건조해요');
    await modesPage.locator('.concern-ai-answer').waitFor();
    assert.match(await modesPage.locator('.concern-ai-label').innerText(), /공개 연구자료 검색 기반 AI 요약/);
    assert.match(await modesPage.locator('#concern-ai').innerText(), /Europe PMC에서 찾은 공개 연구자료/);
    assert.equal(await modesPage.locator('.concern-ai-sources a').first().getAttribute('href'), 'https://europepmc.org/article/MED/123');
    assert.equal(await modesPage.locator('[data-concern-ai-suggestions]').count(), 0);
    assert.equal(await modesPage.evaluate(() => document.documentElement.scrollWidth), 390);
    response = { status: 'ok', sourceMode: 'research', answer: '출처 없는 결과', sources: [] };
    await submitModeQuestion('피부가 당겨요');
    await modesPage.locator('[data-concern-ai-retry]').waitFor();
    assert(!(await modesPage.locator('#concern-ai').innerText()).includes('출처 없는 결과'));
    response = { status: 'ok', sourceMode: 'google', answer: '제안 없는 결과', sources: [{ title: '원문', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' }] };
    await submitModeQuestion('보습이 궁금해요');
    await modesPage.locator('[data-concern-ai-retry]').waitFor();
    assert(!(await modesPage.locator('#concern-ai').innerText()).includes('제안 없는 결과'));
    response = { status: 'ok', sourceMode: 'research', answer: '위험한 링크 결과', sources: [{ title: '위험', url: 'javascript:alert(1)' }] };
    await submitModeQuestion('건조함이 궁금해요');
    await modesPage.locator('[data-concern-ai-retry]').waitFor();
    assert(!(await modesPage.locator('#concern-ai').innerText()).includes('위험한 링크 결과'));
    response = { status: 'ok', sourceMode: 'wikipedia', answer: '위키백과 자료 요약', sources: [{ title: '사랑', url: 'https://ko.wikipedia.org/wiki/%EC%82%AC%EB%9E%91' }] };
    await submitModeQuestion('사랑이 뭐야?');
    await modesPage.locator('.concern-ai-answer').waitFor();
    assert.match(await modesPage.locator('.concern-ai-label').innerText(), /위키백과 자료 기반 Gemini 요약/);
    assert.match(await modesPage.locator('#concern-ai').innerText(), /한국어 위키백과 기여자/);
    assert.equal(await modesPage.locator('.concern-ai-attribution a').getAttribute('href'), 'https://creativecommons.org/licenses/by-sa/4.0/');
    assert.equal(await modesPage.locator('.concern-ai-sources li a').getAttribute('href'), 'https://ko.wikipedia.org/wiki/%EC%82%AC%EB%9E%91');
    assert.equal(await modesPage.locator('[data-concern-ai-suggestions]').count(), 0);
    response = { status: 'ok', sourceMode: 'wikipedia', answer: '가짜 위키백과 결과', sources: [{ title: '원문', url: 'https://example.com/wiki/%EC%82%AC%EB%9E%91' }] };
    await submitModeQuestion('사랑이 뭐야?');
    await modesPage.locator('[data-concern-ai-retry]').waitFor();
    assert(!(await modesPage.locator('#concern-ai').innerText()).includes('가짜 위키백과 결과'));
    responseStatus = 503;
    response = { status: 'unavailable', reason: 'wikipedia_no_sources' };
    await submitModeQuestion('알 수 없는 질문');
    await modesPage.locator('[data-concern-ai-retry]').waitFor();
    assert.match(await modesPage.locator('#concern-ai').innerText(), /관련된 자료를 확인하지 못했습니다/);
    responseStatus = 429;
    response = { status: 'unavailable' };
    await submitModeQuestion('검색 제한 테스트');
    await modesPage.locator('[data-concern-ai-retry]').waitFor();
    assert.match(await modesPage.locator('#concern-ai').innerText(), /요청이 많습니다/);
    await modesContext.close();

    // A locally written review must first show the external-transfer notice;
    // only the explicit AI search button may transmit it.
    const reviewContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const review = await reviewContext.newPage(); let reviewCalls = 0;
    await review.route('**/api/concern-ai', async route => { reviewCalls++; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ status: 'unavailable' }) }); });
    await review.route('**/api/concern-news?*', async route => {
      const topic = new URL(route.request().url()).searchParams.get('topic');
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ topic, status: 'unavailable', articles: [] }) });
    });
    await review.goto(`${base}?product=toner-t1`, { waitUntil: 'domcontentloaded' });
    await review.getByRole('tab', { name: '사용자 리뷰' }).click();
    await review.locator('[data-review-concern]').first().click();
    await review.locator('#concern-ai [data-concern-ai-retry]').waitFor();
    assert.equal(reviewCalls, 0, 'Review-origin question must not be sent before explicit click');
    assert.match(await review.locator('#concern-ai').innerText(), /Gemini.*Google.*위키백과/s);
    await review.locator('#concern-ai [data-concern-ai-retry]').click();
    await review.waitForFunction(() => document.querySelector('#concern-ai')?.innerText.includes('확인하지 못했습니다'));
    assert.equal(reviewCalls, 1);
    assert(await review.locator('.concern-result-heading').isVisible());
    await reviewContext.close();

    console.log(JSON.stringify({ passed: true, layouts: results, staleResponse: true, cancellation: true, unsafeContent: true, suggestionsSafety: true, researchFallback: true, wikipediaFallback: true, failureReasons: true, reviewConsent: true }));
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
