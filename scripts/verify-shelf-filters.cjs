// Optional browser check: install Playwright and Chromium before running.
const path = require('node:path');
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({root:path.resolve(__dirname,'..'),logLevel:'error',server:{host:'127.0.0.1',port:0}}); await server.listen();
 const url=`http://127.0.0.1:${server.httpServer.address().port}/`;
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader']}); const results=[];
 try {for(const width of [320,390,1440]) for(const theme of ['light','dark']){
   const ctx=await browser.newContext({viewport:{width,height:width===320?568:width===390?844:900},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'});
   await ctx.addInitScript(theme=>{localStorage.setItem('transparency-theme',theme);localStorage.setItem('transparency-catalog-version','2026-10-27-three-concepts');localStorage.setItem('transparency-products',JSON.stringify([{id:1,date:'2026-03-10',done:false},{id:2,date:'',done:false},{id:3,date:'',done:true}]));},theme);
   const page=await ctx.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message)); await page.goto(url,{waitUntil:'domcontentloaded'}); await page.locator('nav [data-page="내 제품"]').click();
   const choose=async(id)=>{await page.locator(`.shelf-summary [data-shelf-filter="${id}"]`).click();assert.equal(await page.locator(`.shelf-summary [data-shelf-filter="${id}"]`).getAttribute('aria-pressed'),'true')};
   const rows=()=>page.locator('.my-row'); const check=async(id,name)=>{await choose(id);assert.equal(await rows().count(),1);assert((await rows().innerText()).includes(name));};
   assert.equal(await rows().count(),3); await check('active','세럼 S.1'); await check('unopened','토너 T.1'); await check('done','크림 C.1');
   assert((await rows().innerText()).includes('미개봉으로 변경')); await rows().locator('[data-done="2"]').click(); assert.equal(await rows().count(),0); assert((await page.locator('.my-list').innerText()).includes('사용 완료 제품이 없습니다'));
   let data=await page.evaluate(()=>JSON.parse(localStorage.getItem('transparency-products'))); assert.equal(data[2].done,false);assert.equal(data[1].done,false);
   await choose('unopened'); assert.equal(await rows().count(),2); await page.locator('[data-calendar-trigger="1"]').click();
   assert(await page.locator('[data-calendar-day]').count()); await page.locator('[data-calendar-day]').first().click(); data=await page.evaluate(()=>JSON.parse(localStorage.getItem('transparency-products'))); assert(data[1].date);assert.equal(data[2].date,'');
   await choose('active'); assert.equal(await rows().count(),2); await page.locator('[data-done="1"]').click(); data=await page.evaluate(()=>JSON.parse(localStorage.getItem('transparency-products')));assert(data[1].done);assert(!data[0].done);
   await choose('done'); assert((await rows().innerText()).includes('토너 T.1')); page.once('dialog',dialog=>dialog.accept()); await page.locator('[data-delete="1"]').click(); data=await page.evaluate(()=>JSON.parse(localStorage.getItem('transparency-products')));assert.equal(data.length,2);assert(!data.some(item=>item.id===2));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width); assert.deepEqual(errors,[]); results.push({width,theme,passed:true}); await ctx.close();
 } console.log(JSON.stringify({passed:true,results})); } finally {await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
