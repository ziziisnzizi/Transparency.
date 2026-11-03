import { createLiquidLensRenderer } from './concern-lens.js';
import { createHtmlCanvasCapture } from './html-canvas-capture.js';

// HTML snapshots stay in this browser's memory/GPU; native controls stay active.
const mounted = new WeakMap();
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
let htmlLensEnabled = true;

export function mountConcernOptics(root, { forceCanvas = false } = {}) {
  mounted.get(root)?.();
  const stage = root.querySelector('.concern-visual-stage');
  const water = root.querySelector('.concern-water');
  const bar = root.querySelector('.concern-search-bar');
  const button = bar?.querySelector('button');
  let canvas = root.querySelector('[data-concern-optics]');
  if (!stage || !water || !bar || !button || !canvas) return () => {};
  const dark = document.documentElement.dataset.theme === 'dark';
  const renderer = forceCanvas ? null : createLiquidLensRenderer(canvas, { dark });
  if (renderer) canvas = renderer.canvas;
  let htmlCanvas = stage.querySelector('[data-html-lens-canvas]');
  const htmlLayer = stage.querySelector('[data-html-lens-layer]');
  const htmlRenderer = renderer && htmlCanvas ? createLiquidLensRenderer(htmlCanvas, { dark, overlay: true }) : null;
  if (htmlRenderer) htmlCanvas = htmlRenderer.canvas;
  // A viewport layer escapes the hero's stacking context and follows the whole
  // concern page, including the header, research, product cards and footer.
  if (htmlRenderer && htmlLayer) document.body.append(htmlLayer);
  const lensControl = stage.querySelector('[data-html-lens-control]');
  let context;
  if (!renderer) { try { context = canvas.getContext('2d', { alpha: true }); } catch { /* CSS fallback. */ } }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const forcedColors = matchMedia('(forced-colors: active)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  let disposed = false, frame = 0, previous = 0, time = 0, onScreen = true;
  let width = 1, height = 1, scale = 1, geometryDirty = true, lightDirty = true;
  let viewWidth = 1, viewHeight = 1, lensScale = 2, lensSize = 1;
  let lensGeometry = null, scrolling = false, scrollTimer = 0;
  let focus = 0, focusTarget = 0, press = 0, pressTarget = 0;
  let captureController = null, captureTimer = 0, htmlReady = false, htmlOpacity = 0;
  let capturing = false, captureEpoch = 0;
  let inputFocused = false, composing = false, orbFollowing = false, orbInitialized = false;
  let waterBounds = null, orbRadius = 1;
  const orbPosition = { x: 0, y: 0 }, orbTarget = { x: 0, y: 0 }, orbOrigin = { x: 0, y: 0 };
  const pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  const ripples = [], cleanups = [];
  const reduced = () => motion.matches || transparency.matches || forcedColors.matches;
  const visible = () => !disposed && root.isConnected && !document.hidden;
  const lensShown = () => htmlReady && htmlLensEnabled && !inputFocused && !composing && !scrolling && !document.querySelector('dialog[open]');
  const listen = (element, event, callback, options) => {
    element.addEventListener(event, callback, options);
    cleanups.push(() => element.removeEventListener(event, callback, options));
  };

  function requestCapture(delay = 160) {
    if (!captureController || disposed || !htmlLensEnabled || !visible() || inputFocused || composing || transparency.matches || forcedColors.matches) return;
    htmlReady = false;
    clearTimeout(captureTimer);
    captureTimer = setTimeout(() => {
      captureTimer = 0;
      if (!disposed && visible()) {
        // Leave rendering time for the high-density SVG raster on busy devices.
        // A settled snapshot is reused while the lens moves; never capture per frame.
        capturing=true;cancelAnimationFrame(frame);frame=0;
        const epoch=++captureEpoch;
        void captureController.capture().finally(()=>{
          if(disposed||epoch!==captureEpoch)return;
          capturing=false;sync();
        });
      }
    }, delay);
  }
  function updateControl() {
    if (!lensControl) return;
    lensControl.setAttribute('aria-pressed', String(htmlLensEnabled));
    const label = `유리 렌즈 ${htmlLensEnabled ? '끄기' : '켜기'}`;
    lensControl.setAttribute('aria-label', label);
    lensControl.querySelector('[data-html-lens-control-text]').textContent = label;
  }

  function measure() {
    if (disposed) return;
    // Match the visible viewport, excluding its scrollbar; never expose a capped
    // canvas edge or introduce horizontal scrolling on a wide desktop display.
    const sceneWidth = `${document.documentElement.clientWidth}px`;
    if (root.style.getPropertyValue('--concern-scene-width') !== sceneWidth) {
      root.style.setProperty('--concern-scene-width', sceneWidth);
    }
    const rect = water.getBoundingClientRect();
    waterBounds = rect;
    width = Math.max(1, rect.width);height = Math.max(1, rect.height);
    scale = Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.5, Math.sqrt(950000 / (width * height)));
    const local = element => {
      const b = element.getBoundingClientRect();
      return [b.left - rect.left + b.width / 2, rect.bottom - b.top - b.height / 2, b.width, b.height];
    };
    const geometry = { search: local(bar), button: local(button) };
    if (renderer) renderer.resize(width, height, scale, geometry);
    else {
      const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
      if(canvas.width!==w)canvas.width=w;
      if(canvas.height!==h)canvas.height=h;
    }
    viewWidth = Math.max(1, document.documentElement.clientWidth);
    viewHeight = Math.max(1, innerHeight);
    // The small foreground is independent of the low-cost animated backdrop.
    orbRadius = coarse ? 20 : 24;
    lensSize = orbRadius * 2 + 8;
    lensScale = Math.min(3, Math.max(2, devicePixelRatio || 1));
    const title = stage.querySelector('h1').getBoundingClientRect();
    orbOrigin.x = clamp(title.left + title.width * .53, orbRadius + 6, viewWidth - orbRadius - 6);
    orbOrigin.y = clamp(viewHeight - title.top - title.height * .28, orbRadius + 6, viewHeight - orbRadius - 6);
    if (!orbFollowing) { orbTarget.x = orbOrigin.x; orbTarget.y = orbOrigin.y; }
    if (!orbInitialized) { orbPosition.x = orbTarget.x; orbPosition.y = orbTarget.y; orbInitialized = true; }
    orbTarget.x = clamp(orbTarget.x, orbRadius + 6, viewWidth - orbRadius - 6);
    orbTarget.y = clamp(orbTarget.y, orbRadius + 6, viewHeight - orbRadius - 6);
    lensGeometry = { ...geometry, html: [viewWidth/2,viewHeight/2,viewWidth,viewHeight], sceneRect: [rect.left,viewHeight-rect.bottom,width,height], drawRect: lensRect() };
    htmlRenderer?.resize(viewWidth,viewHeight,lensScale,lensGeometry);
    if (htmlCanvas) { htmlCanvas.style.width=`${lensSize}px`;htmlCanvas.style.height=`${lensSize}px`; }
    geometryDirty = false;
  }

  function lensRect() {
    const left=Math.round((orbPosition.x-lensSize/2)*lensScale)/lensScale;
    const top=Math.round((viewHeight-orbPosition.y-lensSize/2)*lensScale)/lensScale;
    if(htmlCanvas)htmlCanvas.style.transform=`translate3d(${left}px,${top}px,0)`;
    return [left,viewHeight-top-lensSize,lensSize,lensSize];
  }

  function paintFallback(phase) {
    if (!context) return;
    const ctx = context;
    ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
    if (transparency.matches || forcedColors.matches) return;
    ctx.save();ctx.translate(pointer.x*28,pointer.y*16);
    for(let i=0;i<7;i++) {
      const y=height*(.12+i*.13)+Math.sin(phase*.22+i*.6)*16;
      const gradient=ctx.createLinearGradient(0,y-25,width,y+90);
      gradient.addColorStop(0,dark?'rgba(255,255,255,0)':'rgba(255,255,255,0)');
      gradient.addColorStop(.4,dark?'rgba(153,171,190,.05)':'rgba(116,129,144,.11)');
      gradient.addColorStop(.5,dark?'rgba(211,227,240,.23)':'rgba(255,255,255,.85)');
      gradient.addColorStop(.58,dark?'rgba(0,0,0,.25)':'rgba(105,122,140,.1)');
      gradient.addColorStop(1,'rgba(255,255,255,0)');
      ctx.beginPath();ctx.moveTo(-100,y+50);
      ctx.bezierCurveTo(width*.18,y-130,width*.58,y+120,width+100,y-65);
      ctx.lineTo(width+100,y+40);
      ctx.bezierCurveTo(width*.6,y+220,width*.2,y-45,-100,y+140);
      ctx.closePath();ctx.fillStyle=gradient;ctx.fill();
    }
    ctx.restore();
  }

  function paint() {
    if (disposed) return;
    if (geometryDirty) measure();
    if (lightDirty) {
      root.style.setProperty('--concern-light-x',`${(50+target.x*35).toFixed(1)}%`);
      root.style.setProperty('--concern-light-y',`${(45+target.y*30).toFixed(1)}%`);
      root.style.setProperty('--concern-offset-x',`${(target.x*30).toFixed(1)}px`);
      root.style.setProperty('--concern-offset-y',`${(target.y*18).toFixed(1)}px`);
      lightDirty=false;
    }
    if(capturing)return;
    const phase = motion.matches ? 1.8 : time;
    if (onScreen) {
      if (renderer) renderer.render({time:phase,pointer,focus,press,ripples,hidden:transparency.matches||forcedColors.matches});
      else paintFallback(phase);
    }
    if (motion.matches) htmlOpacity = lensShown() ? 1 : 0;
    htmlRenderer?.render({time:phase,pointer,focus,press,ripples,orb:[orbPosition.x,orbPosition.y,orbRadius*(1+press*.035),htmlOpacity],drawRect:lensRect(),hidden:transparency.matches||forcedColors.matches});
  }

  function tick(stamp) {
    frame=0;
    if(!visible()||capturing)return;
    if(!previous||stamp-previous>=1000/30) {
      const elapsed=previous?Math.min((stamp-previous)/1000,.25):1/30;
      previous=stamp;
      if(!reduced()) {
        time+=Math.min(elapsed,.1);
        const response=1-Math.exp(-elapsed*15);
        pointer.x+=(target.x-pointer.x)*response;pointer.y+=(target.y-pointer.y)*response;
        focus+=(focusTarget-focus)*(1-Math.exp(-elapsed*8));
        press+=(pressTarget-press)*(1-Math.exp(-elapsed*18));
        const orbResponse=1-Math.exp(-elapsed*13);
        orbPosition.x+=(orbTarget.x-orbPosition.x)*orbResponse;
        orbPosition.y+=(orbTarget.y-orbPosition.y)*orbResponse;
        const shown=lensShown();
        htmlOpacity+=((shown?1:0)-htmlOpacity)*(1-Math.exp(-elapsed*25));
        while(ripples.length&&time-ripples[0].started>3)ripples.shift();
      }
      paint();
    }
    if((onScreen&&(renderer||context)||htmlRenderer&&htmlLensEnabled&&(htmlReady||htmlOpacity>.002))&&!reduced())frame=requestAnimationFrame(tick);
  }
  function schedule(){if(!frame&&visible()&&!capturing)frame=requestAnimationFrame(tick);}
  function sync(){
    cancelAnimationFrame(frame);frame=0;previous=0;
    water.dataset.opticsPaused=String(!visible()||!onScreen||reduced());
    if(reduced()){target.x=target.y=pointer.x=pointer.y=0;press=pressTarget=0;ripples.length=0;lightDirty=true;orbFollowing=false;orbTarget.x=orbPosition.x=orbOrigin.x;orbTarget.y=orbPosition.y=orbOrigin.y;}
    if(visible()){paint();if(!reduced())schedule();}
  }
  function reset(recenter = true){target.x=target.y=0;pressTarget=0;lightDirty=true;if(recenter){orbFollowing=false;orbTarget.x=orbOrigin.x;orbTarget.y=orbOrigin.y;}schedule();}
  function followOrb(event) {
    if (!htmlRenderer || event.target.closest?.('[data-html-lens-control]')) return;
    orbFollowing = true;
    orbTarget.x = clamp(event.clientX,orbRadius+6,viewWidth-orbRadius-6);
    orbTarget.y = clamp(viewHeight-event.clientY,orbRadius+6,viewHeight-orbRadius-6);
  }
  listen(window,'pointermove',event=>{
    if(reduced()||!visible())return;
    target.x=clamp(event.clientX/innerWidth*2-1,-1,1);target.y=clamp(event.clientY/innerHeight*2-1,-1,1);
    followOrb(event);
    lightDirty=true;schedule();
  },{passive:true});
  listen(window,'pointerdown',event=>{
    if(reduced()||!visible()||event.button>0)return;
    followOrb(event);
    const rect=waterBounds;
    if(rect&&stage.contains(event.target))ripples.push({x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1),started:time});
    if(ripples.length>4)ripples.shift();
    pressTarget=1;schedule();
  },{passive:true});
  listen(window,'pointerup',event=>{pressTarget=0;if(event.pointerType!=='mouse')reset(false);},{passive:true});
  listen(window,'pointercancel',()=>reset(),{passive:true});
  listen(document.documentElement,'pointerleave',()=>reset(),{passive:true});
  listen(stage,'focusin',event=>{focusTarget=1;inputFocused=event.target.id==='concern-query';schedule();});
  listen(stage,'focusout',event=>{if(!stage.contains(event.relatedTarget))focusTarget=0;if(event.target.id==='concern-query'){inputFocused=false;requestCapture(0);}});
  listen(stage,'input',()=>requestCapture(250));
  listen(stage,'compositionstart',()=>{composing=true;htmlOpacity=0;paint();});
  listen(stage,'compositionend',()=>{composing=false;requestCapture(80);});
  listen(window,'scroll',()=>{
    geometryDirty=true;scrolling=true;htmlReady=false;htmlOpacity=0;
    clearTimeout(captureTimer);clearTimeout(scrollTimer);paint();
    scrollTimer=setTimeout(()=>{scrolling=false;requestCapture(0);schedule();},140);
  },{passive:true});
  listen(window,'resize',()=>{geometryDirty=true;requestCapture(180);schedule();},{passive:true});
  listen(document,'visibilitychange',sync);
  for(const preference of [motion,transparency,forcedColors])listen(preference,'change',()=>{geometryDirty=true;requestCapture(0);sync();});
  const resize=new ResizeObserver(()=>{geometryDirty=true;if(visible()){paint();requestCapture();schedule();}});
  resize.observe(water);resize.observe(bar);resize.observe(button);resize.observe(root);
  const intersection=new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;if(onScreen&&!htmlReady)requestCapture();sync();});
  intersection.observe(stage);
  if(renderer)listen(canvas,'webglcontextlost',event=>{
    event.preventDefault();const replacement=canvas.cloneNode();canvas.replaceWith(replacement);dispose();
    if(root.isConnected)mountConcernOptics(root,{forceCanvas:true});
  });
  if(htmlRenderer)listen(htmlCanvas,'webglcontextlost',event=>{event.preventDefault();htmlReady=false;htmlOpacity=0;captureController?.dispose();root.dataset.htmlLens='fallback';htmlRenderer.dispose();});
  if(lensControl)listen(lensControl,'click',()=>{htmlLensEnabled=!htmlLensEnabled;updateControl();if(htmlLensEnabled)requestCapture(0);else{clearTimeout(captureTimer);htmlOpacity=0;}paint();schedule();});
  function dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);frame=0;
    clearTimeout(captureTimer);clearTimeout(scrollTimer);captureController?.dispose();
    resize.disconnect();intersection.disconnect();cleanups.forEach(cleanup=>cleanup());ripples.length=0;renderer?.dispose();htmlRenderer?.dispose();
    canvas.width=canvas.height=1;
    if(htmlCanvas)htmlCanvas.width=htmlCanvas.height=1;
    if(htmlRenderer)htmlLayer?.remove();
    if(mounted.get(root)===dispose)mounted.delete(root);
  }
  const removal=new MutationObserver(()=>{if(!root.isConnected||!canvas.isConnected)dispose();});
  removal.observe(document.body,{childList:true,subtree:true});cleanups.push(()=>removal.disconnect());
  const content=new MutationObserver(()=>{if(visible()){requestCapture();schedule();}});
  content.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','aria-expanded']});
  cleanups.push(()=>content.disconnect());
  listen(root,'concern-before-refresh',dispose);
  document.fonts?.ready.then(()=>{if(!disposed){geometryDirty=true;paint();requestCapture(0);}});
  if(htmlRenderer)captureController=createHtmlCanvasCapture(document.body,{
    viewport:true,
    maxTextureSize:htmlRenderer.maxTextureSize,
    onCanvas:source=>{if(!disposed){htmlReady=htmlRenderer.setHtml(source);root.dataset.htmlLens=htmlReady?'ready':'fallback';paint();schedule();}source.width=source.height=1;},
    onError:()=>{htmlReady=false;htmlOpacity=0;root.dataset.htmlLens='fallback';paint();},
  });
  mounted.set(root,dispose);water.dataset.optics=renderer?'webgl':context?'canvas':'css';root.dataset.htmlLens=htmlRenderer?'pending':'fallback';updateControl();sync();requestCapture(0);
  return dispose;
}
