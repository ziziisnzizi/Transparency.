// Optional exports/visual validation, using the cloud's installed Playwright.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../public/design/mobile');

(async () => {
  const design = JSON.parse(fs.readFileSync(path.join(root, 'screens.json'), 'utf8'));
  const flows = JSON.parse(fs.readFileSync(path.join(root, 'flow-index.json'), 'utf8')).flows;
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', { '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png' }[path.extname(filename)] || 'application/octet-stream');
    fs.createReadStream(filename).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: design.width, height: design.height }, deviceScaleFactor: 2 });
    const overflow = [];
    for (const screen of design.screens) {
      const svg = fs.readFileSync(path.join(root, 'screens', `${screen.id}.svg`), 'utf8');
      await page.setContent(`<style>body{margin:0}svg{display:block}</style>${svg}`);
      await page.evaluate(() => document.fonts.ready);
      const bad = await page.locator('text').evaluateAll(elements => elements.flatMap(el => {
        const b = el.getBBox();
        return b.x < -1 || b.y < -1 || b.x + b.width > 391 || b.y + b.height > 845 ? [{ text: el.textContent, x: b.x, y: b.y, width: b.width, height: b.height }] : [];
      }));
      if (bad.length) overflow.push({ screen: screen.id, texts: bad });
      await page.screenshot({ path: path.join(root, 'screens', `${screen.id}.png`) });
    }
    if (overflow.length) throw Error('Text outside mobile frames: ' + JSON.stringify(overflow));
    const board = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    const boardSvg = fs.readFileSync(path.join(root, 'wireframes-board.svg'), 'utf8');
    const viewBox = boardSvg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const box = { width: viewBox[2], height: viewBox[3] };
    const boardHeight = Math.ceil(box.height * (1200 / box.width));
    await board.setViewportSize({ width: 1200, height: boardHeight });
    await board.setContent(`<style>body{margin:0}svg{display:block;width:1200px;height:auto}</style>${boardSvg}`);
    await board.evaluate(() => document.fonts.ready);
    await board.screenshot({ path: path.join(root, 'wireframes-board.png'), fullPage: true });
    const print = await browser.newPage();
    const sheets = design.screens.map(s => `<section class="sheet"><h1>${s.id} · ${s.title}</h1><p>${s.note}</p><div class="phone">${fs.readFileSync(path.join(root, 'screens', `${s.id}.svg`), 'utf8')}</div></section>`).join('');
    await print.setContent(`<style>@page{size:145mm 290mm;margin:10mm}body{margin:0;font:12px 'Noto Sans CJK KR',sans-serif}.sheet{height:268mm;break-after:page}.sheet:last-child{break-after:auto}h1{font-size:16px;margin:0 0 8px}p{font-size:10px;margin:0 0 12px}.phone>svg{display:block;width:110mm;height:auto}</style>${sheets}`);
    await print.evaluate(() => document.fonts.ready);
    await print.pdf({ path: path.join(root, 'mobile-wireframes.pdf'), printBackground: true, preferCSSPageSize: true });
    const diagramSheets = flows.map(f => `<section><h1>${f.id} · ${f.title}</h1><p>${f.description}</p><div class="diagram">${fs.readFileSync(path.join(root, f.svg), 'utf8').replace(/<\?xml[\s\S]*?\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->/g, '')}</div></section>`).join('');
    await print.setContent(`<style>@page{size:A3 landscape;margin:12mm}body{margin:0;font:13px 'Noto Sans CJK KR',sans-serif}section{height:267mm;break-after:page;display:flex;flex-direction:column}section:last-child{break-after:auto}h1{font-size:20px;margin:0 0 8px}p{font-size:12px;margin:0 0 15px}.diagram{height:225mm}.diagram>svg{display:block;width:100%;height:100%}</style>${diagramSheets}`);
    await print.evaluate(() => document.fonts.ready);
    await print.pdf({ path: path.join(root, 'flowcharts.pdf'), printBackground: true, preferCSSPageSize: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/');
    await page.locator('article img').first().evaluate(el => el.decode());
    const links = await page.locator('a[download]').evaluateAll(elements => elements.map(el => el.getAttribute('href')));
    const missing = links.filter(href => !fs.existsSync(path.join(root, href)));
    if (missing.length) throw Error('Missing download files: ' + missing.join(', '));
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (horizontalOverflow) throw Error('Download gallery overflows mobile width');
    console.log(`Exported ${design.screens.length} mobile 2x PNGs, a board preview, ${design.screens.length}-page wireframe PDF and ${flows.length}-page flow PDF. No text outside mobile artboards; gallery links valid.`);
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
