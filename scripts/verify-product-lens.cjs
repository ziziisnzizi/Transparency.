// Browser-level product/texture lens check. Playwright is optional; a Vite
// server is started automatically unless SITE_URL points to an existing app.
const assert = require('node:assert/strict');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Install optional Playwright to run this check.'); process.exit(1); }
const path = require('node:path');
const externalUrl = process.env.SITE_URL;

async function compareInsideAndOutside(page, before, after) {
  return page.evaluate(async ({before, after}) => {
    async function pixels(data) {
      const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
      const canvas = document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      return {width:image.width,height:image.height,data:ctx.getImageData(0,0,image.width,image.height).data};
    }
    const a=await pixels(before),b=await pixels(after);
    if(a.width!==b.width||a.height!==b.height)throw new Error('Screenshot sizes changed');
    let inner=0,innerN=0,outerChanged=0,outerN=0;
    for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
      const index=(y*a.width+x)*4, distance=Math.hypot(x-a.width/2,y-a.height/2);
      const delta=Math.max(...[0,1,2].map(c=>Math.abs(a.data[index+c]-b.data[index+c])));
      if(distance<80){inner+=delta;innerN++;}
      if(distance>105){outerChanged+=delta>12;outerN++;}
    }
    return {innerMean:inner/innerN,outerChanged:outerChanged/outerN};
  }, {before:before.toString('base64'),after:after.toString('base64')});
}

(async()=>{
  let server, url=externalUrl;
  if (!url) {
    const { createServer } = await import('vite');
    server = await createServer({ root: path.resolve(__dirname, '..'), logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
    await server.listen();
    url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  }
  let browser;
  try { browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--enable-webgl','--enable-unsafe-swiftshader']}); }
  catch(error) { await server?.close(); throw error; }
  const results={};
  try {
    const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'domcontentloaded'});
    const visual=page.locator('.product .product-visual').first();
    await visual.scrollIntoViewIfNeeded();
    await visual.locator('.product-packshot').evaluate(image=>image.decode());
    await visual.locator('.product-texture').evaluate(image=>image.decode());
    await page.mouse.move(5,200);await page.waitForTimeout(150);
    const before=await visual.screenshot();
    const rect=await visual.boundingBox();
    await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.waitForTimeout(150);
    const state=await visual.evaluate(e=>({active:e.hasAttribute('data-product-lens'),mask:getComputedStyle(e.querySelector('.product-packshot')).maskImage,clip:getComputedStyle(e.querySelector('.product-texture')).clipPath,opacity:getComputedStyle(e.querySelector('.product-texture')).opacity}));
    assert(state.active&&state.mask.includes('radial-gradient')&&state.clip.startsWith('circle')&&state.opacity==='1');
    results.pixelDifference=await compareInsideAndOutside(page,before,await visual.screenshot());
    assert(results.pixelDifference.innerMean>5,'Texture should visibly replace the packshot inside the circle');
    assert(results.pixelDifference.outerChanged<.003,'Packshot outside the lens should remain unchanged');
    await page.mouse.move(5,200);await page.waitForTimeout(150);
    assert.equal(await visual.getAttribute('data-product-lens'),null);
    await page.locator('nav [data-page="제품 탐색"]').click();
    const cards=page.locator('.product .product-visual');assert.equal(await cards.count(),3);
    for(let i=0;i<3;i++){
      const item=cards.nth(i);await item.scrollIntoViewIfNeeded();await item.locator('.product-texture').evaluate(image=>image.decode());
      const box=await item.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(100);
      assert.equal(await item.getAttribute('data-product-lens'),'');
    }
    const second=cards.nth(1),box=await second.boundingBox();await page.mouse.click(box.x+40,box.y+40);
    const detail=page.locator('.detail-image .product-visual');await detail.waitFor();await detail.locator('.product-texture').evaluate(image=>image.decode());
    const detailBox=await detail.boundingBox();await page.mouse.move(detailBox.x+detailBox.width/2,detailBox.y+detailBox.height/2);await page.waitForTimeout(100);
    assert.equal(await detail.getAttribute('data-product-lens'),'');assert.deepEqual(errors,[]);
    results.desktop={home:true,allCatalogProducts:true,detailNavigation:true};await context.close();

    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const touch=await mobile.newPage();await touch.goto(url,{waitUntil:'domcontentloaded'});
    const mv=touch.locator('.product .product-visual').first();await mv.scrollIntoViewIfNeeded();await touch.evaluate(()=>window.scrollBy(0,-180));await touch.waitForTimeout(150);
    const toggle=mv.locator('.texture-toggle');assert(await toggle.isVisible());await toggle.click({timeout:5000});
    assert.equal(await mv.getAttribute('data-image-view'),'texture');assert.equal(await mv.getAttribute('data-product-lens'),null);
    await toggle.click({timeout:5000});assert.equal(await mv.getAttribute('data-image-view'),'product');
    results.mobile={textureToggle:true};await mobile.close();

    const animated=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
    const moving=await animated.newPage();await moving.goto(url,{waitUntil:'domcontentloaded'});
    const movingVisual=moving.locator('.product .product-visual').first();await movingVisual.scrollIntoViewIfNeeded();
    await movingVisual.locator('.product-texture').evaluate(image=>image.decode());
    const movingBox=await movingVisual.boundingBox(),movingY=movingBox.y+movingBox.height/2;
    await moving.mouse.move(movingBox.x+movingBox.width/2-65,movingY);await moving.waitForTimeout(400);
    await moving.mouse.move(movingBox.x+movingBox.width/2+65,movingY);await moving.waitForTimeout(40);
    const alignment=await movingVisual.evaluate(e=>{
      const box=e.getBoundingClientRect(),rim=document.querySelector('[data-site-wide-text-rim]').getBoundingClientRect();
      return {maskX:box.left+parseFloat(e.style.getPropertyValue('--product-lens-x')),rimX:rim.left+rim.width/2};
    });
    assert(Math.abs(alignment.maskX-alignment.rimX)<1,'The mask must follow the same smoothed position as the glass');
    results.animated={glassAligned:true};await animated.close();

    const fallback=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await fallback.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        return type==='webgl'||type==='experimental-webgl'?null:original.call(this,type,...args);
      };
    });
    const native=await fallback.newPage();await native.goto(url,{waitUntil:'domcontentloaded'});
    await native.waitForFunction(()=>document.body.dataset.siteWideLens==='native');
    const fallbackVisual=native.locator('.product .product-visual').first();await fallbackVisual.scrollIntoViewIfNeeded();
    const fallbackToggle=fallbackVisual.locator('.texture-toggle');assert(await fallbackToggle.isVisible());
    await fallbackToggle.click({timeout:5000});assert.equal(await fallbackVisual.getAttribute('data-image-view'),'texture');
    await fallbackToggle.click({timeout:5000});assert.equal(await fallbackVisual.getAttribute('data-image-view'),'product');
    const fallbackBox=await fallbackVisual.boundingBox();await native.mouse.click(fallbackBox.x+40,fallbackBox.y+fallbackBox.height/2);
    await native.locator('.detail-image .product-visual').waitFor();
    results.fallback={textureToggle:true,detailNavigation:true};await fallback.close();

    const delayed=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const loading=await delayed.newPage();
    let releaseTextures;
    const textureGate=new Promise(resolve=>{releaseTextures=resolve;});
    await loading.route('**/images/textures/**',async route=>{await textureGate;await route.continue();});
    await loading.goto(url,{waitUntil:'domcontentloaded'});
    const delayedVisual=loading.locator('.product .product-visual').first();await delayedVisual.scrollIntoViewIfNeeded();
    const delayedBox=await delayedVisual.boundingBox();await loading.mouse.move(delayedBox.x+delayedBox.width/2,delayedBox.y+delayedBox.height/2);
    assert.equal(await delayedVisual.getAttribute('data-product-lens'),null,'Do not hide the packshot while its texture is still loading');
    releaseTextures();
    await loading.waitForFunction(()=>document.querySelector('.product .product-visual')?.hasAttribute('data-product-lens'),null,{timeout:6000});
    const initial=await delayedVisual.evaluate(e=>({scrollY:window.scrollY,maskY:parseFloat(e.style.getPropertyValue('--product-lens-y'))}));
    await loading.evaluate(()=>window.scrollBy(0,80));
    await loading.waitForFunction(y=>window.scrollY>y+10,initial.scrollY,{timeout:5000});
    await loading.waitForFunction(previous=>{
      const visual=document.querySelector('.product .product-visual'),rim=document.querySelector('[data-site-wide-text-rim]');
      if(!visual?.hasAttribute('data-product-lens')||!rim||rim.hidden)return false;
      const maskY=parseFloat(visual.style.getPropertyValue('--product-lens-y'));
      const visualRect=visual.getBoundingClientRect(),rimRect=rim.getBoundingClientRect();
      return Math.abs(maskY-previous)>10&&Math.abs(visualRect.top+maskY-(rimRect.top+rimRect.height/2))<1;
    },initial.maskY,{timeout:5000});
    await loading.evaluate(()=>document.documentElement.dispatchEvent(new PointerEvent('pointerleave')));await loading.waitForTimeout(150);
    assert.equal(await delayedVisual.getAttribute('data-product-lens'),null);
    const newBox=await delayedVisual.boundingBox();await loading.mouse.move(newBox.x+newBox.width/2,newBox.y+newBox.height/2);await loading.waitForTimeout(150);
    assert.equal(await delayedVisual.getAttribute('data-product-lens'),'');
    results.delayedTexture={appearsWithoutMovingPointer:true,scrollAlignment:true,leaveAndReentry:true};await delayed.close();
    console.log(JSON.stringify({passed:true,...results}));
  } finally { await browser.close(); await server?.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
