// Optional browser check: install Playwright and Chromium before running.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({root:path.resolve(__dirname,'..'),logLevel:'error',server:{host:'127.0.0.1',port:0}});await server.listen();
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader']});
 const url=`http://127.0.0.1:${server.httpServer.address().port}/`;
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900}, reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.__lensDraws=[];const old=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__lensDraws.push(text);return old.call(this,text,...args)}});
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('.brand-statement h2')?.dataset.siteLensEn);
  const home=[['.brand-statement h2','Beyond what you see.\nClearly.'],['.bottom-grid > div:nth-child(1) h2','Everything you need,\nin your hands.'],['.bottom-grid > div:nth-child(2) h2','My products.\nMy way to use them.']];
  const titleCheck=async(sel,en)=>{const head=page.locator(sel);await head.waitFor();assert.equal(await head.getAttribute('data-site-lens-en'),en);assert.equal(await head.locator('[data-site-source-plane]').getAttribute('aria-hidden'),'false');assert.equal(await head.locator('[data-language-plane="ja"]').getAttribute('aria-hidden'),'true');await head.scrollIntoViewIfNeeded();const line=head.locator('[data-site-source-plane] [data-landing-line]').first();await page.evaluate(()=>window.__lensDraws=[]);await line.hover({force:true});await page.waitForFunction(sel=>{const source=document.querySelector(sel)?.querySelector('[data-site-source-plane]');return source&&source.style.maskImage.includes('radial-gradient')&&document.querySelector('[data-site-wide-text-canvas]')?.dataset.siteWideKind==='translated-heading'},sel,{timeout:10000});for(const line of en.split('\n')) assert((await page.evaluate(()=>window.__lensDraws)).includes(line),`${sel}: target drawing missing: ${line}`);};
  for(const [sel,en] of home) await titleCheck(sel,en);
  await page.goto(`${url}?product=serum-s1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#detail-panel h2')?.dataset.siteLensEn);
  const tabs=[['성분·함량',"What's inside, and how much."],['효능·근거','Ingredient research, made clear.'],['사용 안내','From first use to the last drop.'],['질문하기','Every question, out in the open.'],['사용자 리뷰','Real experiences come first.']];
  for(const [tab,en] of tabs){await page.getByRole('tab',{name:tab}).click();await page.waitForFunction(en=>document.querySelector('#detail-panel h2')?.dataset.siteLensEn===en,en);await titleCheck('#detail-panel h2',en);}
  assert.deepEqual(errors,[]);
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await mobile.goto(`${url}?product=serum-s1`,{waitUntil:'domcontentloaded'});await mobile.waitForFunction(()=>document.querySelector('#detail-panel h2')?.dataset.siteLensEn);assert.equal(await mobile.evaluate(()=>document.body.dataset.siteWideLens),'native');assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth),390);
  console.log(JSON.stringify({passed:true,home:home.length,tabs:tabs.length,mobile:true}));
 }finally{await browser.close();await server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
