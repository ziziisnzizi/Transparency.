// Optional browser check: npm install --no-save playwright && npx playwright install chromium
const { strict: assert } = require('node:assert');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Install optional Playwright to run this check.'); process.exit(1); }
const cases = [
  { slug: 'toner-t1', lot: 'A1103', count: 14, first: '정제수', unique: '베타글루칸', step: '세안 후 1~2번 흔듭니다.', noStep: '토출 안정성' },
  { slug: 'serum-s1', lot: 'A2943', count: 15, first: '정제수', unique: '병풀추출물', step: '스포이드로 적당량(2~3방울)을 덜어 얼굴 전체에 부드럽게 펴 바릅니다.', extra: '토출 안정성' },
  { slug: 'cream-c1', lot: 'A8294', count: 23, first: '정제수', unique: '세테아릴알코올', step: '토너와 세럼 사용 후, 뚜껑을 열어 손가락으로 한 번 덜어냅니다.', noStep: '토출 안정성' },
];
(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  let browser;
  try { browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--enable-webgl', '--enable-unsafe-swiftshader'] }); }
  catch (error) { await server.close(); throw error; }
  const results = [];
  try {
    for (const width of [320, 390, 1440]) for (const dark of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : width === 390 ? 844 : 900 }, isMobile: width < 500, hasTouch: width < 500, reducedMotion: 'reduce' });
      await context.addInitScript(({ dark }) => {
        localStorage.setItem('transparency-products', JSON.stringify([{ id: 1, date: '2024-02-29', done: false }]));
        localStorage.setItem('transparency-catalog-version', '2026-10-27-three-concepts');
        localStorage.setItem('transparency-theme', dark ? 'dark' : 'light');
      }, { dark });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const item of cases) {
        await page.goto(`${url}?product=${item.slug}`, { waitUntil: 'domcontentloaded' });
        const ingredient = page.locator('.product-ingredients-text');
        await ingredient.waitFor();
        const names = (await ingredient.innerText()).split(', ').map(value => value.trim());
        assert.equal(names.length, item.count, `${item.slug} ingredient count`);
        assert(names[0].startsWith(`${item.first} `)); assert(names.some(name => name.startsWith(`${item.unique} `)));
        await page.getByRole('tab', { name: '사용 안내' }).click();
        const panel = page.locator('#detail-panel');
        assert((await panel.innerText()).includes(item.step), `${item.slug} directions`);
        const disclosure = page.locator('.product-disclosure');
        const text = await disclosure.innerText();
        for (const expected of [`LOT ${item.lot}`, '2027.12.17', '개봉 후 12개월', '특정 제조분', '용기에 표시된 내용을 우선']) assert(text.includes(expected), `${item.slug}: ${expected}`);
        assert(!(await page.locator('body').innerText()).includes('080-532-4132'));
        assert(!(await page.locator('body').innerText()).includes('서울 용산구 한강대로 100'));
        await disclosure.locator('summary').click();
        const stability = await disclosure.locator('.product-stability-body').innerText();
        for (const expected of ['pH 안정성', '미생물 안정성', '용기 적합성', '기관·조건·보고서', '별개']) assert(stability.includes(expected));
        if (item.extra) assert(stability.includes(item.extra)); if (item.noStep) assert(!stability.includes(item.noStep));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      }
      await page.locator('nav [data-page="제품 탐색"]').click();
      const search = page.locator('#search');
      for (const [term, expected] of [['병풀추출물', '세럼 S.1'], ['세테아릴알코올', '크림 C.1']]) {
        await search.fill(term); await page.waitForFunction(name => document.querySelector('.cards')?.innerText.includes(name), expected);
        assert.equal(await page.locator('.cards .product').count(), 1); assert((await page.locator('.cards').innerText()).includes(expected));
      }
      await page.locator('nav [data-page="내 제품"]').click();
      assert((await page.locator('.product-opening-period').innerText()).includes('2025.02.28'));
      assert((await page.locator('.product-opening-period').innerText()).includes('용기에 표시된 실제 사용기한'));
      await page.locator('[data-calendar-trigger="0"]').click();
      await page.locator('[data-calendar-day="2024-02-28"]').click();
      assert((await page.locator('.product-opening-period').innerText()).includes('2025.02.28'));
      assert.deepEqual(errors, []);
      results.push({ width, theme: dark ? 'dark' : 'light', products: 3, passed: true });
      await context.close();
    }
    console.log(JSON.stringify({ passed: true, results }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
