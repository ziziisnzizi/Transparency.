import { createLandingLensRenderer } from './landing-lens-renderer.js';
import { rasterizeTextLensPlane } from './landing-text-lens.js';

const mounted = new WeakMap();
const semantic = 'h1,h2,h3,h4,h5,h6,p,dt,dd,figcaption';
// Controls remain native even when their children are large, or when an
// invisible card-wide button sits over an otherwise eligible heading.
const forbidden = 'button,a,label,summary,nav,[role="button"],[role="link"],[role="navigation"],[role="menuitem"],input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),svg,canvas,script,style,code,pre,dialog[open],[popover],.sr-only,.visually-hidden,[data-site-wide-ui]';
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const within = (point, rect) => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
const separation = (point, rect) => Math.hypot(Math.max(rect.left-point.x,0,point.x-rect.right),Math.max(rect.top-point.y,0,point.y-rect.bottom));

function font(context, style) {
  context.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.textBaseline = 'alphabetic'; context.textAlign = 'left'; context.direction = style.direction;
  context.fillStyle = style.color;
  if ('letterSpacing' in context) context.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
  if ('fontKerning' in context) context.fontKerning = style.fontKerning === 'none' ? 'none' : 'normal';
}

function segments(text) {
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(undefined,{granularity:'word'}).segment(text)].map(part=>({text:part.segment,index:part.index}));
  return [...text.matchAll(/\s+|[^\s]+/g)].map(part=>({text:part[0],index:part.index}));
}

function visibleNode(node, minFontSize) {
  const parent = node.parentElement;
  if (!parent || !node.textContent.trim() || parent.closest(forbidden) || parent.closest('[data-language-plane="ja"],[aria-hidden="true"]')) return false;
  const style = getComputedStyle(parent);
  return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.fontSize) >= minFontSize;
}

function textNodes(element, document, minFontSize = 0) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = []; let characters = 0;
  for (let node=walker.nextNode();node;node=walker.nextNode()) {
    if (!visibleNode(node, minFontSize)) continue;
    nodes.push(node); characters += node.length;
    if (nodes.length > 120 || characters > 6000) return [];
  }
  return nodes;
}

function opacityFor(element) {
  let opacity = 1;
  for (let node=element;node instanceof Element;node=node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
  return opacity;
}

function staticRuns(element, document, minFontSize) {
  const nodes = textNodes(element,document,minFontSize), runs = [];
  const range = document.createRange();
  for (const node of nodes) {
    const style = getComputedStyle(node.parentElement);
    for (const part of segments(node.textContent)) {
      if (!part.text.trim()) continue;
      range.setStart(node,part.index); range.setEnd(node,part.index+part.text.length);
      const rects = [...range.getClientRects()].filter(rect=>rect.width>.01&&rect.height>1);
      const fragments = rects.length <= 1 ? [part] : Array.from(part.text).map((text,index)=>({text,index:part.index+Array.from(part.text).slice(0,index).join('').length}));
      for (const fragment of fragments) {
        range.setStart(node,fragment.index);range.setEnd(node,fragment.index+fragment.text.length);
        const rect=range.getBoundingClientRect();
        if (rect.width<=.01||rect.height<=1) continue;
        let copy=fragment.text;
        if(style.textTransform==='uppercase')copy=copy.toLocaleUpperCase();
        if(style.textTransform==='lowercase')copy=copy.toLocaleLowerCase();
        runs.push({copy,rect,style,opacity:opacityFor(node.parentElement)});
      }
    }
  }
  range.detach?.();
  if (!runs.length) return null;
  const left=Math.min(...runs.map(run=>run.rect.left))-12,top=Math.min(...runs.map(run=>run.rect.top))-12;
  const right=Math.max(...runs.map(run=>run.rect.right))+12,bottom=Math.max(...runs.map(run=>run.rect.bottom))+12;
  return {nodes,runs,bounds:{left,top,right,bottom,width:right-left,height:bottom-top}};
}

function rasterRuns(snapshot,ratio,document) {
  const image=document.createElement('canvas');
  image.width=Math.max(1,Math.ceil(snapshot.bounds.width*ratio));image.height=Math.max(1,Math.ceil(snapshot.bounds.height*ratio));
  const context=image.getContext('2d');if(!context)return null;
  context.scale(ratio,ratio);
  for(const run of snapshot.runs){
    font(context,run.style);context.globalAlpha=run.opacity;
    const metrics=context.measureText(run.copy);
    const ascent=metrics.fontBoundingBoxAscent??metrics.actualBoundingBoxAscent??parseFloat(run.style.fontSize)*.8;
    context.fillText(run.copy,run.rect.left-snapshot.bounds.left,run.rect.top-snapshot.bounds.top+ascent);
  }
  return image;
}

export function mountSiteWideTextLens(document,config={}) {
  mounted.get(document)?.();
  const view=document.defaultView,settings=config.lens||config;
  const diameter=clamp(number(settings.diameter,180),140,200),radius=diameter/2;
  const minFontSize=clamp(number(settings.minFontSize,16),12,32);
  const optical={radius,rimWidth:clamp(number(settings.rimWidth,10),1,radius/3),refraction:clamp(number(settings.refraction,7),0,20),rgbOffset:clamp(number(settings.rgbOffset,1.5),0,4)};
  const coarse=view.matchMedia('(pointer: coarse), (hover: none), (max-width: 750px), (forced-colors: active)');
  const motion=view.matchMedia('(prefers-reduced-motion: reduce)');
  const main=document.getElementById('content');
  let canvas=document.createElement('canvas');canvas.className='site-wide-text-canvas';canvas.dataset.siteWideTextCanvas='';canvas.dataset.siteWideUi='';canvas.setAttribute('aria-hidden','true');canvas.hidden=true;
  const rim=document.createElement('div');rim.className='site-wide-text-rim';rim.dataset.siteWideTextRim='';rim.dataset.siteWideUi='';rim.setAttribute('aria-hidden','true');rim.hidden=true;rim.style.width=rim.style.height=`${diameter}px`;
  document.body.append(canvas,rim);
  const owned=new WeakSet([canvas,rim]),cleanups=[];
  let renderer=null,active=null,disposed=false,failed=false,fontsReady=false;
  let frame=0,last=0,pointerPresent=false,dirtyPick=true;
  let target={x:0,y:0},current={x:0,y:0},opacity=0,reveal=0;
  const listen=(object,type,handler,options)=>{object.addEventListener(type,handler,options);cleanups.push(()=>object.removeEventListener(type,handler,options));};
  function mode(){const value=renderer&&!coarse.matches?'webgl':'native';document.body.dataset.siteWideLens=value;if(main)main.dataset.landingTextMode=value;}
  function releaseActive(){
    if(!active)return;
    if(active.primary)active.source.style.opacity=active.originalOpacity;
    else for(const item of active.hidden){if(item.wrapper.parentNode)item.wrapper.replaceWith(item.node);}
    active=null;canvas.hidden=true;reveal=0;
  }
  function releaseRenderer(){removeContext?.();removeContext=null;renderer?.dispose();renderer=null;}
  let removeContext=null;
  function ensureRenderer(){
    if(renderer)return true;if(failed||coarse.matches||!fontsReady)return false;
    renderer=createLandingLensRenderer(canvas);
    if(!renderer){failed=true;mode();return false;}
    mode();return true;
  }
  function eligible(element){
    if(!(element instanceof Element)||element.closest(forbidden)||element.closest('[data-language-plane="ja"],[aria-hidden="true"]'))return null;
    const primary=element.closest('[data-site-text-region][data-landing-title]');
    if(primary)return textNodes(primary,document,minFontSize).length?primary:null;
    const group=element.closest(semantic)||element.closest('span,li');
    if(!group||group.closest(forbidden)||!textNodes(group,document,minFontSize).length)return null;
    return group;
  }
  function pick(){
    const element=document.elementFromPoint(target.x,target.y);
    // This is a hard stop, rather than a search through lower paint layers:
    // hovering a nav/button or small text must not refract a heading behind it.
    if(!element||element.closest(forbidden)||element.closest('[data-language-plane="ja"],[aria-hidden="true"]')||parseFloat(getComputedStyle(element).fontSize)<minFontSize)return null;
    const group=eligible(element);
    if(group){
      if(active?.element===group)return group;
      const range=document.createRange();
      const hits=textNodes(group,document,minFontSize).some(node=>{
        range.selectNodeContents(node);
        return [...range.getClientRects()].some(rect=>rect.width>1&&rect.height>1&&within(target,rect));
      });range.detach?.();
      if(hits)return group;
    }
    return active&&active.element.isConnected&&separation(target,active.bounds)<radius?active.element:null;
  }
  function activate(element){
    if(element===active?.element)return;
    releaseActive();
    if(!element||!ensureRenderer())return;
    const source=element.querySelector('[data-site-source-plane]');
    const translated=element.querySelector('[data-language-plane="ja"]');
    // Mixed headings containing a small caption/control use the ordinary path
    // so those descendants retain native glyphs, opacity and interaction.
    const sourceNodes=source?textNodes(source,document):[];
    const primary=Boolean(source&&translated&&sourceNodes.length&&!source.querySelector(forbidden)&&sourceNodes.length===textNodes(source,document,minFontSize).length);
    const snapshot=primary?null:staticRuns(element,document,minFontSize);
    const titleRect=primary?element.getBoundingClientRect():null;
    const padding=Math.ceil(optical.refraction+optical.rgbOffset+3);
    const bounds=primary?{left:titleRect.left-padding,top:titleRect.top-padding,right:titleRect.right+padding,bottom:titleRect.bottom+padding,width:titleRect.width+padding*2,height:titleRect.height+padding*2}:snapshot?.bounds;
    if(!bounds||bounds.width<1||bounds.height<1)return;
    const ratio=Math.min(number(settings.maxPixelRatio,2.5),Math.max(2,view.devicePixelRatio||1),Math.sqrt(number(settings.pixelBudget,4000000)/(bounds.width*bounds.height)),renderer.maxTextureSize/bounds.width,renderer.maxTextureSize/bounds.height);
    const sourceImage=primary?rasterizeTextLensPlane(source,bounds,ratio):rasterRuns(snapshot,ratio,document);
    const targetImage=primary?rasterizeTextLensPlane(translated,bounds,ratio):sourceImage;
    const color=getComputedStyle(primary?element:snapshot.nodes[0].parentElement).color.match(/[\d.]+/g)?.slice(0,3).map(Number)||[23,23,23];
    const light=color[0]*.2126+color[1]*.7152+color[2]*.0722>140;
    if(!sourceImage||!targetImage||!renderer.upload([sourceImage,targetImage],bounds.width,bounds.height,ratio,light?[.012,.025,.04]:[1,1,1])){failed=true;releaseRenderer();mode();return;}
    if(canvas!==renderer.canvas){owned.add(renderer.canvas);canvas=renderer.canvas;canvas.dataset.siteWideTextCanvas='';canvas.dataset.siteWideUi='';}
    if(!removeContext){const lost=event=>{event.preventDefault();releaseActive();failed=true;releaseRenderer();rim.hidden=true;mode();};canvas.addEventListener('webglcontextlost',lost);removeContext=()=>canvas.removeEventListener('webglcontextlost',lost);}
    canvas.style.left=`${bounds.left}px`;canvas.style.top=`${bounds.top}px`;canvas.style.width=`${bounds.width}px`;canvas.style.height=`${bounds.height}px`;canvas.hidden=false;
    const hidden=[];
    if(primary){const originalOpacity=source.style.opacity;source.style.opacity='0';active={element,primary,source,originalOpacity,bounds,lines:[...source.querySelectorAll('[data-landing-line]')].map(line=>line.getBoundingClientRect())};}
    else {
      for(const node of snapshot.nodes){if(!node.parentNode)continue;const wrapper=document.createElement('span');wrapper.dataset.siteGlassHidden='';wrapper.style.cssText='all:unset;display:inline;font:inherit;letter-spacing:inherit;line-height:inherit;color:inherit;opacity:0;pointer-events:none;';owned.add(wrapper);owned.add(node);node.replaceWith(wrapper);wrapper.appendChild(node);hidden.push({node,wrapper});}
      active={element,primary:false,hidden,bounds,lines:[]};
    }
    canvas.dataset.siteWideKind=primary?'translated-heading':'original-text';canvas.dataset.siteWideRatio=ratio.toFixed(3);
  }
  function paint(){
    if(active)renderer.render({...optical,x:current.x-active.bounds.left,y:current.y-active.bounds.top,opacity,reveal:active.primary?reveal:0});
    rim.style.transform=`translate3d(${(current.x-radius).toFixed(2)}px,${(current.y-radius).toFixed(2)}px,0)`;rim.style.opacity=opacity.toFixed(4);
  }
  function tick(stamp){
    frame=0;if(disposed||document.hidden||coarse.matches)return;
    if(dirtyPick){dirtyPick=false;activate(pointerPresent?pick():null);}
    const delta=last?Math.min((stamp-last)/1000,.15):1/60;last=stamp;
    const follow=motion.matches?1:1-Math.exp(-number(settings.followRate,12)*delta),fade=motion.matches?1:1-Math.exp(-number(settings.fadeRate,10)*delta);
    const opacityTarget=pointerPresent&&renderer&&active?1:0;
    const revealTarget=pointerPresent&&active?.primary&&active.lines.some(rect=>within(target,rect))?1:0;
    current.x+=(target.x-current.x)*follow;current.y+=(target.y-current.y)*follow;opacity+=(opacityTarget-opacity)*fade;reveal+=(revealTarget-reveal)*fade;
    if(Math.abs(opacity-opacityTarget)<.0001)opacity=opacityTarget;if(Math.abs(reveal-revealTarget)<.0001)reveal=revealTarget;
    rim.hidden=!renderer||!active;paint();
    if(!opacity&&!pointerPresent)releaseActive();
    if(Math.abs(current.x-target.x)+Math.abs(current.y-target.y)>.02||Math.abs(opacity-opacityTarget)>.0001||Math.abs(reveal-revealTarget)>.0001)schedule();else last=0;
  }
  function schedule(){if(!disposed&&!frame&&!document.hidden&&!coarse.matches)frame=view.requestAnimationFrame(tick);}
  function invalidate(){releaseActive();dirtyPick=true;schedule();}
  listen(document,'pointermove',event=>{if(coarse.matches)return;pointerPresent=true;target={x:event.clientX,y:event.clientY};if(opacity<.001)current={...target};dirtyPick=true;schedule();},{passive:true});
  listen(document.documentElement,'pointerleave',()=>{pointerPresent=false;dirtyPick=true;schedule();},{passive:true});
  listen(document,'pointercancel',()=>{pointerPresent=false;dirtyPick=true;schedule();},{passive:true});
  listen(view,'scroll',invalidate,{passive:true,capture:true});listen(view,'resize',invalidate,{passive:true});
  listen(document,'site-backdrop-ink',invalidate);
  listen(document,'visibilitychange',()=>{view.cancelAnimationFrame(frame);frame=0;last=0;if(document.hidden){releaseActive();rim.hidden=true;}else invalidate();});
  listen(coarse,'change',()=>{view.cancelAnimationFrame(frame);frame=0;releaseActive();releaseRenderer();failed=false;opacity=reveal=0;rim.hidden=true;if(!coarse.matches)ensureRenderer();mode();dirtyPick=true;schedule();});
  listen(motion,'change',schedule);
  if(document.fonts){listen(document.fonts,'loadingdone',invalidate);document.fonts.ready.then(()=>{if(!disposed){fontsReady=true;ensureRenderer();dirtyPick=true;schedule();}});}else{fontsReady=true;ensureRenderer();}
  const observer=new MutationObserver(records=>{
    if(disposed)return;if(main&&!main.isConnected){dispose();return;}
    const external=records.some(record=>{
      if(record.type==='characterData')return active?.element.contains(record.target);
      const nodes=[...record.addedNodes,...record.removedNodes];
      const own=nodes.length&&nodes.every(node=>owned.has(node)||(node.nodeType===1&&node.hasAttribute('data-text-lens-probe')));
      return !own&&active&&(record.target===active.element||active.element.contains(record.target)||!active.element.isConnected);
    });
    if(external)invalidate();
  });observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  function dispose(){if(disposed)return;disposed=true;view.cancelAnimationFrame(frame);observer.disconnect();cleanups.forEach(cleanup=>cleanup());releaseActive();releaseRenderer();canvas.remove();rim.remove();delete document.body.dataset.siteWideLens;if(main)delete main.dataset.landingTextMode;if(mounted.get(document)===dispose)mounted.delete(document);}
  dispose.invalidate=invalidate;
  mounted.set(document,dispose);mode();return dispose;
}
