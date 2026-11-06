// Optional: install Playwright and a Chromium binary before running.
// Verifies that the CPU estimate matches the actual scene framebuffer without
// requiring synchronous GPU readback during normal application rendering.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const { createServer } = await import('vite');
  const server = await createServer({
    root: path.resolve(__dirname, '..'), logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ['--no-sandbox', '--enable-webgl', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
    const cases = await page.evaluate(async () => {
      const { createSiteBackground } = await import('/site-background.js');
      const { siteEffectsConfig } = await import('/site-effects-config.js');
      const canvas = document.createElement('canvas');
      const renderer = createSiteBackground(canvas, siteEffectsConfig.background);
      if (!renderer) throw new Error('WebGL background unavailable');
      const points = [];
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) points.push([(x + .5) / 10, (y + .5) / 10]);
      if (renderer.estimate(points) !== null) throw new Error('Unrendered background must not estimate');
      const output = [];
      const frames = [
        { pointer: { active: 0 } },
        { pointer: { x: .5, y: -.3, trailX: -.2, trailY: .3, vx: 1.1, vy: -1.2, active: 1 }, history: { x: .15, y: -.2, spin: .4, phase: .6 } },
      ];
      for (const [width, height] of [[400, 280], [320, 640], [1440, 900]]) {
        renderer.resize(width, height, 1);
        for (const time of [0, 5, 50, 140]) for (const frame of frames) {
          renderer.render({ time, ...frame });
          const estimated = renderer.estimate(points);
          // sample is only used as a verification oracle, never by the app.
          const sampled = renderer.sample(points);
          const differences = estimated.map((color, i) => Math.max(...color.map((value, channel) => Math.abs(value - sampled[i][channel])))).sort((a, b) => a - b);
          output.push({ width, height, time, pointerActive: frame.pointer.active, mean: differences.reduce((sum, value) => sum + value, 0) / differences.length, p95: differences[95], max: differences[99] });
        }
      }
      renderer.render({ dark: true });
      if (renderer.estimate(points) !== null) throw new Error('Dark mode must use its own contrast strategy');
      renderer.dispose();
      if (renderer.estimate(points) !== null) throw new Error('Disposed renderer must not estimate');
      return output;
    });
    assert.deepEqual(errors, []);
    for (const item of cases) {
      assert(item.mean < .01, `mean RGB error too large: ${JSON.stringify(item)}`);
      assert(item.p95 < .02, `95th percentile RGB error too large: ${JSON.stringify(item)}`);
      assert(item.max < .04, `maximum RGB error too large: ${JSON.stringify(item)}`);
    }
    console.log(JSON.stringify({ passed: true, cases: cases.length, sampledPoints: cases.length * 100, maxError: Math.max(...cases.map(item => item.max)), maxP95: Math.max(...cases.map(item => item.p95)) }));
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
