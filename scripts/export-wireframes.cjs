// Optional export tool: needs Playwright and a Chromium installation.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../docs/wireframes');
(async () => {
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const server = http.createServer((req, res) => {
    const filename = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    const mime = { '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8', '.png': 'image/png' };
    res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
    fs.createReadStream(filename).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 2310, height: 1000 } });
    await page.setContent(`<body style="margin:0"><img src="${base}/overview.svg" width="2310" height="4380" style="display:block"></body>`);
    await page.locator('img').evaluate(image => image.decode());
    await page.screenshot({ path: path.join(root, 'overview.png'), fullPage: true });
    await page.goto(base + '/print.html');
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    await page.pdf({ path: path.join(root, 'wireframes.pdf'), format: 'A3', landscape: true, printBackground: true, preferCSSPageSize: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const phone = await context.newPage();
    const overflow = [];
    for (let i = 1; i <= 20; i++) {
      const id = String(i).padStart(2, '0');
      await phone.setContent(`<body style="margin:0">${fs.readFileSync(path.join(root, 'screens', `${id}.svg`), 'utf8')}</body>`);
      const bad = await phone.locator('text').evaluateAll(elements => elements.map(el => ({ text: el.textContent, box: el.getBBox() })).filter(({ box }) => box.x < -1 || box.x + box.width > 391).map(({ text }) => text));
      if (bad.length) overflow.push({ screen: id, texts: bad });
      await phone.screenshot({ path: path.join(root, 'screens', `${id}.png`) });
    }
    if (overflow.length) throw new Error('Text overflow: ' + JSON.stringify(overflow));
    console.log('Exported overview PNG, 20 individual 2x PNGs, A3 PDF. All 20 screens have no horizontal text overflow.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
