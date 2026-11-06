// Optional browser check: install Playwright and Chromium before running.
const { strict: assert } = require('node:assert');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--enable-webgl', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const width of [320, 390, 1440]) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : width === 390 ? 844 : 900 }, isMobile: width < 500, hasTouch: width < 500, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('transparency-theme', theme), theme);
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const item of [
        { slug: 'serum-s1', amount: '병풀추출물 1.0%', count: 15, research: '병풀추출물', paper: 'bikiaris-2025-centella-serums' },
        { slug: 'toner-t1', amount: '소듐하이알루로네이트 0.05%', count: 14, research: '프로판다이올', paper: 'pinto-2024-polyol-hydration' },
        { slug: 'cream-c1', amount: '세라마이드엔피 0.1%', count: 23, research: '알란토인', paper: 'saucedo-acuna-2023-allantoin-hydrogel' },
      ]) {
        await page.goto(`${base}?product=${item.slug}`, { waitUntil: 'domcontentloaded' });
        assert((await page.locator('.product-ingredients-text').innerText()).includes(item.amount));
        await page.getByRole('tab', { name: '효능·근거' }).click();
        const list = page.locator('.evidence-all-ingredients');
        await list.locator('summary').click();
        assert.equal(await list.locator('li').count(), item.count);
        assert((await list.innerText()).includes('검색 결과는 아직 개별 검토하지 않은 자료'));
        const row = list.locator('li').filter({ has: page.getByText(item.research, { exact: true }) });
        assert.equal(await row.count(), 1);
        const link = row.getByRole('link', { name: /PubMed 검색/ });
        assert.match(await link.getAttribute('href'), /^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\?/);
        await row.getByRole('button', { name: /검토한 연구/ }).click();
        const button = page.locator(`[data-evidence-paper="${item.paper}"]`);
        await button.click();
        const dialog = page.locator('.evidence-dialog');
        assert(await dialog.isVisible());
        assert((await dialog.innerText()).includes('완제품'));
        assert((await dialog.innerText()).includes('2026.11.06'));
        assert.match(await dialog.locator('a').last().getAttribute('href'), /^https:\/\//);
        await dialog.getByRole('button', { name: /닫기/ }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      }
      assert.deepEqual(errors, []);
      results.push({ width, theme, passed: true });
      await context.close();
    }
    console.log(JSON.stringify({ passed: true, results }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
