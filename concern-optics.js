import { createWaterRenderer } from './concern-water.js';

// Only the decorative background is animated. Native HTML is never captured,
// displaced, magnified or sampled by this renderer.
const mounted = new WeakMap();
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function mountConcernOptics(root, { forceCanvas = false } = {}) {
  mounted.get(root)?.();
  const stage = root.querySelector('.concern-visual-stage');
  const water = root.querySelector('.concern-water');
  const bar = root.querySelector('.concern-search-bar');
  let canvas = root.querySelector('[data-concern-optics]');
  if (!stage || !water || !bar || !canvas) return () => {};
  const dark = document.documentElement.dataset.theme === 'dark';
  const renderer = forceCanvas ? null : createWaterRenderer(canvas, { dark });
  if (renderer) canvas = renderer.canvas;
  let context;
  if (!renderer) { try { context = canvas.getContext('2d', { alpha: true }); } catch { /* CSS background fallback. */ } }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const forcedColors = matchMedia('(forced-colors: active)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  let disposed = false, frame = 0, previous = 0, time = 0, onScreen = true;
  let width = 1, height = 1, scale = 1, geometryDirty = true, lightDirty = true;
  const pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  const ripples = [], cleanups = [];
  const reduced = () => motion.matches || transparency.matches || forcedColors.matches;
  const visible = () => !disposed && root.isConnected && onScreen && !document.hidden;
  const listen = (element, event, callback, options) => {
    element.addEventListener(event, callback, options);
    cleanups.push(() => element.removeEventListener(event, callback, options));
  };

  function measure() {
    const sceneWidth = `${document.documentElement.clientWidth}px`;
    if (root.style.getPropertyValue('--concern-scene-width') !== sceneWidth) root.style.setProperty('--concern-scene-width', sceneWidth);
    const rect = water.getBoundingClientRect(), search = bar.getBoundingClientRect();
    width = Math.max(1, rect.width);height = Math.max(1, rect.height);
    scale = Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.5, Math.sqrt(950000 / (width * height)));
    if (renderer) renderer.resize(width, height, scale, { search: [search.left-rect.left+search.width/2,rect.bottom-search.top-search.height/2,search.width,search.height] });
    else {
      const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
      if(canvas.width!==w)canvas.width=w;
      if(canvas.height!==h)canvas.height=h;
    }
    geometryDirty=false;
  }

  function paintFallback(phase) {
    if (!context) return;
    const ctx=context;
    ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
    if(transparency.matches||forcedColors.matches)return;
    ctx.save();ctx.translate(pointer.x*28,pointer.y*16);
    for(let i=0;i<7;i++) {
      const y=height*(.12+i*.13)+Math.sin(phase*.22+i*.6)*16;
      const gradient=ctx.createLinearGradient(0,y-25,width,y+90);
      gradient.addColorStop(0,'rgba(255,255,255,0)');
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
    if(disposed)return;
    if(geometryDirty)measure();
    if(lightDirty){
      root.style.setProperty('--concern-light-x',`${(50+target.x*35).toFixed(1)}%`);
      root.style.setProperty('--concern-light-y',`${(45+target.y*30).toFixed(1)}%`);
      root.style.setProperty('--concern-offset-x',`${(target.x*30).toFixed(1)}px`);
      root.style.setProperty('--concern-offset-y',`${(target.y*18).toFixed(1)}px`);
      lightDirty=false;
    }
    const phase=motion.matches?1.8:time;
    if(renderer)renderer.render({time:phase,pointer,ripples,hidden:transparency.matches||forcedColors.matches});
    else paintFallback(phase);
  }
  function tick(stamp){
    frame=0;
    if(!visible())return;
    if(!previous||stamp-previous>=1000/30){
      const elapsed=previous?Math.min((stamp-previous)/1000,.25):1/30;
      previous=stamp;time+=Math.min(elapsed,.1);
      const response=1-Math.exp(-elapsed*15);
      pointer.x+=(target.x-pointer.x)*response;pointer.y+=(target.y-pointer.y)*response;
      while(ripples.length&&time-ripples[0].started>3)ripples.shift();
      paint();
    }
    if((renderer||context)&&!reduced())frame=requestAnimationFrame(tick);
  }
  function schedule(){if(!frame&&visible())frame=requestAnimationFrame(tick);}
  function sync(){
    cancelAnimationFrame(frame);frame=0;previous=0;
    water.dataset.opticsPaused=String(!visible()||reduced());
    if(reduced()){target.x=target.y=pointer.x=pointer.y=0;ripples.length=0;lightDirty=true;}
    if(visible()){paint();if((renderer||context)&&!reduced())schedule();}
  }
  listen(window,'pointermove',event=>{
    if(reduced()||!visible())return;
    target.x=clamp(event.clientX/innerWidth*2-1,-1,1);target.y=clamp(event.clientY/innerHeight*2-1,-1,1);
    lightDirty=true;schedule();
  },{passive:true});
  listen(window,'pointerdown',event=>{
    if(reduced()||!visible()||event.button>0||!stage.contains(event.target))return;
    const rect=water.getBoundingClientRect();
    ripples.push({x:clamp((event.clientX-rect.left)/rect.width,0,1),y:clamp((event.clientY-rect.top)/rect.height,0,1),started:time});
    if(ripples.length>4)ripples.shift();schedule();
  },{passive:true});
  listen(document.documentElement,'pointerleave',()=>{target.x=target.y=0;lightDirty=true;schedule();},{passive:true});
  listen(window,'scroll',()=>{geometryDirty=true;},{passive:true});
  listen(window,'resize',()=>{geometryDirty=true;schedule();},{passive:true});
  listen(document,'visibilitychange',sync);
  for(const preference of [motion,transparency,forcedColors])listen(preference,'change',()=>{geometryDirty=true;sync();});
  const resize=new ResizeObserver(()=>{geometryDirty=true;if(visible()){paint();schedule();}});
  resize.observe(water);resize.observe(bar);
  const intersection=new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;sync();});
  intersection.observe(stage);
  if(renderer)listen(canvas,'webglcontextlost',event=>{
    event.preventDefault();const replacement=canvas.cloneNode();canvas.replaceWith(replacement);dispose();
    if(root.isConnected)mountConcernOptics(root,{forceCanvas:true});
  });
  function dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);frame=0;
    resize.disconnect();intersection.disconnect();cleanups.forEach(cleanup=>cleanup());ripples.length=0;renderer?.dispose();canvas.width=canvas.height=1;
    if(mounted.get(root)===dispose)mounted.delete(root);
  }
  const removal=new MutationObserver(()=>{if(!root.isConnected||!canvas.isConnected)dispose();});
  removal.observe(document.body,{childList:true,subtree:true});cleanups.push(()=>removal.disconnect());
  listen(root,'concern-before-refresh',dispose);
  document.fonts?.ready.then(()=>{if(!disposed){geometryDirty=true;if(visible()){paint();schedule();}}});
  mounted.set(root,dispose);water.dataset.optics=renderer?'water':context?'canvas':'css';sync();
  return dispose;
}
