// Optional browser regression check: Playwright + Chromium are required.
// In normal-motion mode inspect every painted frame while the glass enters,
// leaves, and moves between product cards. The complementary image layers
// must never escape the lens as opacity transitions are applied.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  const root = process.env.SITE_REPO_ROOT || path.resolve(__dirname, '..');
  const server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox', '--enable-webgl', '--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('nav [data-page="제품 탐색"]').click();
    await page.waitForFunction(() => document.body.dataset.siteWideLens === 'webgl');
    const cards = page.locator('.product .product-visual');
    assert.equal(await cards.count(), 3);
    await cards.first().scrollIntoViewIfNeeded();
    for (let i = 0; i < 2; i++) {
      await cards.nth(i).locator('.product-packshot').evaluate(image => image.decode());
      await cards.nth(i).locator('.product-texture').evaluate(image => image.decode());
    }
    const first = await cards.first().boundingBox();
    const second = await cards.nth(1).boundingBox();
    await page.mouse.move(8, 110);
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      window.__lensTransitionFrames = [];
      window.__lensTransitionProbe = true;
      const sample = () => {
        if (!window.__lensTransitionProbe) return;
        for (const visual of [...document.querySelectorAll('.product .product-visual')].slice(0, 2)) {
          const packshot = visual.querySelector('.product-packshot');
          const texture = visual.querySelector('.product-texture');
          const pack = getComputedStyle(packshot);
          const image = getComputedStyle(texture);
          window.__lensTransitionFrames.push({
            slug: visual.dataset.productVisual,
            view: visual.dataset.imageView,
            active: visual.hasAttribute('data-product-lens'),
            opacity: Number(image.opacity),
            expectedOpacity: Number(visual.style.getPropertyValue('--product-lens-opacity')),
            clip: image.clipPath,
            mask: pack.maskImage,
          });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    const center = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    const firstCenter = center(first), secondCenter = center(second);
    await page.mouse.move(firstCenter.x, firstCenter.y);
    await page.waitForFunction(() => document.querySelector('.product .product-visual')?.hasAttribute('data-product-lens'));
    await page.waitForTimeout(250);
    // Exit and immediately return, then cross between cards to stress both
    // removal and reacquisition while normal CSS transitions are enabled.
    await page.mouse.move(8, 110);
    await page.waitForFunction(() => !document.querySelector('.product .product-visual')?.hasAttribute('data-product-lens'));
    await page.waitForTimeout(50);
    await page.mouse.move(firstCenter.x, firstCenter.y);
    await page.waitForTimeout(120);
    await page.mouse.move(secondCenter.x, secondCenter.y, { steps: 4 });
    await page.waitForTimeout(300);
    await page.mouse.move(8, 110);
    await page.waitForTimeout(500);
    const frames = await page.evaluate(() => { window.__lensTransitionProbe = false; return window.__lensTransitionFrames; });
    assert(frames.length > 20, 'Expected normal-motion animation frames');
    assert(frames.some(frame => frame.slug === 'toner-t1' && frame.active && frame.opacity > .95), 'First product must reveal texture inside the glass');
    assert(frames.some(frame => frame.slug === 'serum-s1' && frame.active && frame.opacity > .5), 'Moving to another product must still reveal its texture');
    const leaked = frames.filter(frame => frame.view === 'auto' && !frame.active && frame.clip === 'none' && frame.opacity > .01);
    assert.deepEqual(leaked.slice(0, 5), [], `Texture remained visible outside the glass on ${leaked.length} frames`);
    const desynchronized = frames.filter(frame => frame.view === 'auto' && frame.active && (!frame.clip.startsWith('circle(') || !frame.mask.includes('radial-gradient') || Math.abs(frame.opacity - frame.expectedOpacity) > .03));
    assert.deepEqual(desynchronized.slice(0, 5), [], `Product and texture masks were not synchronized on ${desynchronized.length} frames`);
    assert.deepEqual(errors, []);
    await context.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    const touch = await mobile.newPage();
    await touch.goto(url, { waitUntil: 'domcontentloaded' });
    const mobileVisual = touch.locator('.product .product-visual').first();
    await mobileVisual.scrollIntoViewIfNeeded();
    const toggle = mobileVisual.locator('.texture-toggle');
    await toggle.click();
    assert.equal(await mobileVisual.getAttribute('data-image-view'), 'texture');
    await toggle.click();
    assert.equal(await mobileVisual.getAttribute('data-image-view'), 'product');
    await mobile.close();
    console.log(JSON.stringify({ passed: true, frames: frames.length, leaked: leaked.length, desynchronized: desynchronized.length, fastReentry: true, cardMovement: true, mobileToggle: true }));
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
