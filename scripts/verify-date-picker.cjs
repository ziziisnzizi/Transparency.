// Optional real-browser check: npm install --no-save playwright && npx playwright install chromium
const { strict: assert } = require('node:assert');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Install optional verification tools: npm install --no-save playwright && npx playwright install chromium'); process.exit(1); }
const root = path.resolve(__dirname, '..');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'] }).catch(async error => { await server.close(); throw error; });
  const observations = [];
  try {
    for (const width of [320, 390, 1440]) for (const dark of [false, true]) {
      const height = width === 320 ? 568 : width === 390 ? 844 : 900;
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500, reducedMotion: 'reduce' });
      await context.addInitScript(({ dark }) => {
        if (!localStorage.getItem('transparency-products')) localStorage.setItem('transparency-products', JSON.stringify([{ id: 3, date: '2026-10-01', done: false }, { id: 2, date: '', done: false }]));
        localStorage.setItem('transparency-catalog-version', '2026-10-27-three-concepts');
        localStorage.setItem('transparency-theme', dark ? 'dark' : 'light');
      }, { dark });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.locator('nav [data-page="내 제품"]').click();
      const trigger = page.locator('[data-calendar-trigger="0"]');
      const dialog = page.getByRole('dialog', { name: '개봉일 선택' });
      await trigger.click(); await dialog.waitFor();
      const rect = await dialog.boundingBox();
      assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height, 'Calendar is within the viewport');
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
      await dialog.getByRole('button', { name: '이전 달' }).click();
      assert(await dialog.getByText('2026년 9월').isVisible());
      await dialog.locator('[data-calendar-day="2026-09-15"]').click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('transparency-products'))[0].date), '2026-09-15');
      assert.match(await trigger.innerText(), /2026\. 09\. 15/);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.calendarTrigger), '0');
      await trigger.click(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('transparency-products'))[0].date), '2026-09-16');
      await trigger.click(); await page.keyboard.press('Escape');
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.calendarTrigger), '0');
      await trigger.click(); await page.mouse.click(2, 2);
      assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
      await trigger.click(); await dialog.getByRole('button', { name: '지우기' }).click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('transparency-products'))[0].date), '');
      assert.equal((await page.locator('.my-row').first().locator('.status-badge').innerText()).trim(), '미개봉');
      await trigger.click(); await dialog.getByRole('button', { name: '오늘', exact: true }).click();
      const date = await page.evaluate(() => JSON.parse(localStorage.getItem('transparency-products'))[0].date);
      assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('nav [data-page="내 제품"]').click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('transparency-products'))[0].date), date);
      if (width < 500) {
        await page.locator('[data-calendar-trigger="0"]').click();
        await page.evaluate(() => { const spacer = document.createElement('div'); spacer.style.height = `${innerHeight * 2}px`; document.body.append(spacer); window.scrollTo(0, document.documentElement.scrollHeight); });
        await page.waitForFunction(() => !document.querySelector('.calendar-popover'), null, { timeout: 5000 });
        assert.equal(await page.locator('[data-calendar-trigger="0"]').getAttribute('aria-expanded'), 'false');
      }
      await page.locator('[data-calendar-trigger="0"]').click();
      // Route change while the calendar is open must dispose its detached popup.
      await page.locator('header .logo').evaluate(element => element.click());
      assert.equal(await page.locator('.calendar-popover').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      assert.deepEqual(errors, []);
      observations.push({ width, height, theme: dark ? 'dark' : 'light', passed: true });
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 320, height: 320 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('transparency-products', JSON.stringify([{ id: 3, date: '2021-05-31', done: false }]));
      localStorage.setItem('transparency-catalog-version', '2026-10-27-three-concepts');
    });
    const page = await context.newPage(); await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('nav [data-page="내 제품"]').click(); await page.locator('[data-calendar-trigger="0"]').click();
    const popup = page.locator('.calendar-popover'), rect = await popup.boundingBox();
    assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 320 && rect.y + rect.height <= 320);
    const visibleFocus = await page.evaluate(() => {
      const panel = document.querySelector('.calendar-popover').getBoundingClientRect(), focused = document.activeElement.getBoundingClientRect();
      return focused.top >= panel.top && focused.bottom <= panel.bottom;
    });
    assert(visibleFocus, 'Selected day stays visible in a short viewport');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('transparency-products'))[0].date), '2021-06-01');
    observations.push({ width: 320, height: 320, passed: true }); await context.close();
    console.log(JSON.stringify({ passed: true, observations }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
