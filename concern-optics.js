// Decorative optics only: no input text, network, storage or device sensors.
import { createPrismRenderer } from './concern-prism.js';
const mounted = new WeakMap();
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function mountConcernOptics(root, { forceCanvas = false } = {}) {
  mounted.get(root)?.();
  const stage = root.querySelector('.concern-visual-stage');
  const water = root.querySelector('.concern-water');
  let canvas = root.querySelector('[data-concern-optics]');
  if (!stage || !water || !canvas) return () => {};

  const dark = document.documentElement.dataset.theme === 'dark';
  const renderer = forceCanvas ? null : createPrismRenderer(canvas, { dark, compact: root.classList.contains('has-results') });
  if (renderer) canvas = renderer.canvas;
  let context;
  if (!renderer) {
    try { context = canvas.getContext('2d', { alpha: true }); } catch { /* CSS material remains. */ }
  }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  const forcedColors = matchMedia('(forced-colors: active)');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const interval = 1000 / 30;
  let disposed = false, frame = 0, previous = 0, time = 0, onScreen = true;
  let width = 1, height = 1, scale = 1, bounds = null, dirtyLight = true;
  let pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  let focus = 0, focusTarget = 0;
  const ripples = [];
  const cleanups = [];
  const listen = (element, event, callback, options) => {
    element.addEventListener(event, callback, options);
    cleanups.push(() => element.removeEventListener(event, callback, options));
  };
  const reduced = () => motion.matches || transparency.matches || forcedColors.matches;
  const visible = () => !disposed && root.isConnected && onScreen && !document.hidden;

  function measure() {
    if (disposed) return;
    const rect = water.getBoundingClientRect();
    bounds = stage.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    scale = Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.5, Math.sqrt(1100000 / (width * height)));
    if (renderer) renderer.resize(width, height, scale);
    else {
      if (canvas.width !== Math.round(width * scale)) canvas.width = Math.round(width * scale);
      if (canvas.height !== Math.round(height * scale)) canvas.height = Math.round(height * scale);
    }
    paint();
  }

  function waves(phase, strength = 1) {
    const ctx = context;
    ctx.lineWidth = .65;
    for (let i = 0; i < 9; i++) {
      const y = height * (.08 + i * .112);
      const drift = Math.sin(phase * .22 + i * .46) * height * .055;
      const gradient = ctx.createLinearGradient(0, y, width, y);
      gradient.addColorStop(0, 'rgba(150,160,170,0)');
      gradient.addColorStop(.35, dark ? `rgba(205,222,237,${.065 * strength})` : `rgba(83,103,118,${.09 * strength})`);
      gradient.addColorStop(.65, dark ? `rgba(240,248,255,${.16 * strength})` : `rgba(255,255,255,${.75 * strength})`);
      gradient.addColorStop(1, 'rgba(150,160,170,0)');
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-width * .1, y + drift);
      ctx.bezierCurveTo(width * .22, y - height * .18, width * .61, y + height * .14 + drift, width * 1.1, y - height * .12);
      ctx.stroke();
    }
  }

  function material(path, phase, strength = 1) {
    const ctx = context;
    const fill = ctx.createLinearGradient(width * .14, height * .1, width * .78, height * .88);
    fill.addColorStop(0, dark ? 'rgba(220,235,247,.09)' : 'rgba(255,255,255,.11)');
    fill.addColorStop(.25, dark ? 'rgba(225,240,255,.025)' : 'rgba(255,255,255,.025)');
    fill.addColorStop(.55, dark ? 'rgba(5,9,15,.12)' : 'rgba(120,136,149,.035)');
    fill.addColorStop(.81, dark ? 'rgba(242,249,255,.13)' : 'rgba(255,255,255,.30)');
    fill.addColorStop(1, dark ? 'rgba(210,228,242,.025)' : 'rgba(255,255,255,.025)');
    ctx.save();
    ctx.globalAlpha = strength;
    ctx.fillStyle = fill;
    ctx.fill(path);
    // Offset the scene inside the lens to suggest refraction at the material edge.
    ctx.save();
    ctx.clip(path);
    ctx.lineWidth = 10;
    ctx.strokeStyle = dark ? 'rgba(242,249,255,.045)' : 'rgba(255,255,255,.16)';
    ctx.stroke(path);
    ctx.translate(14 + pointer.x * 8, -12 + pointer.y * 6);
    waves(phase + .75, 1.5);
    ctx.restore();

    const rim = ctx.createLinearGradient(width * .07, height * .08, width * .93, height * .85);
    rim.addColorStop(0, 'rgba(255,255,255,.05)');
    rim.addColorStop(.2, dark ? 'rgba(240,249,255,.7)' : 'rgba(255,255,255,.95)');
    rim.addColorStop(.42, 'rgba(255,255,255,.06)');
    rim.addColorStop(.7, dark ? 'rgba(240,249,255,.1)' : 'rgba(129,146,160,.2)');
    rim.addColorStop(.9, 'rgba(255,255,255,.65)');
    rim.addColorStop(1, 'rgba(255,255,255,.05)');
    // Three adjacent spectral strokes keep colour at the optical edges.
    ctx.lineWidth = 1.15;
    ctx.translate(-1.8, .5);
    ctx.strokeStyle = dark ? 'rgba(103,225,249,.38)' : 'rgba(40,179,206,.32)';
    ctx.stroke(path);
    ctx.translate(3.6, -.9);
    ctx.strokeStyle = dark ? 'rgba(221,162,255,.36)' : 'rgba(198,115,210,.28)';
    ctx.stroke(path);
    ctx.translate(-1.8, .4);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rim;
    ctx.stroke(path);
    ctx.restore();
  }

  function paint() {
    if (disposed) return;
    if (dirtyLight) {
      const x = reduced() ? 50 : 50 + target.x * 37;
      const y = reduced() ? 45 : 45 + target.y * 32;
      root.style.setProperty('--concern-light-x', `${x.toFixed(1)}%`);
      root.style.setProperty('--concern-light-y', `${y.toFixed(1)}%`);
      root.style.setProperty('--concern-glass-angle', `${(145 + target.x * 25 - target.y * 14).toFixed(1)}deg`);
      root.style.setProperty('--concern-offset-x', `${(target.x * 42).toFixed(1)}px`);
      root.style.setProperty('--concern-offset-y', `${(target.y * 28).toFixed(1)}px`);
      dirtyLight = false;
    }
    if (renderer) {
      renderer.render({ time: motion.matches ? 3.5 : time, pointer, focus, ripples, hidden: transparency.matches || forcedColors.matches });
      return;
    }
    if (!context) return;
    const ctx = context;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (transparency.matches || forcedColors.matches) return;
    const phase = motion.matches ? 3.5 : time;
    ctx.save();
    ctx.translate(pointer.x * 18, pointer.y * 11);
    waves(phase);

    // Broad transparent ribbons drift under the search lens, never over its text.
    for (let i = 0; i < 2; i++) {
      const drift = Math.sin(phase * .19 + i * 2.4) * height * .045;
      const y = height * (i ? .45 : .7) + drift;
      const thickness = height * (i ? .12 : .20);
      const path = new Path2D();
      path.moveTo(-width * .12, y);
      path.bezierCurveTo(width * .16, y - height * .44, width * .56, y + height * .2, width * 1.13, y - height * .32);
      path.lineTo(width * 1.13, y - height * .32 + thickness);
      path.bezierCurveTo(width * .58, y + height * .16 + thickness, width * .15, y - height * .4 + thickness, -width * .12, y + thickness);
      path.closePath();
      material(path, phase, i ? .48 : .82);
    }
    const orb = new Path2D();
    const radius = Math.min(width * .24, height * .3);
    orb.ellipse(width * .8 + Math.cos(phase * .13) * 13, height * .35 + Math.sin(phase * .17) * 13, radius, radius * .88, -.35, 0, Math.PI * 2);
    material(orb, phase, .6);

    const lightX = width * (.49 + pointer.x * .19);
    const lightY = height * (.57 + pointer.y * .14);
    const light = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, width * .48);
    light.addColorStop(0, dark ? `rgba(222,235,255,${.022 + focus * .025})` : `rgba(255,255,255,${.12 + focus * .1})`);
    light.addColorStop(.45, dark ? 'rgba(137,202,224,.008)' : 'rgba(225,241,249,.025)');
    light.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    for (const ripple of ripples) {
      const age = time - ripple.started;
      if (age > 2.4) continue;
      const radius = 15 + age * Math.min(width, height) * .23;
      const alpha = Math.pow(1 - age / 2.4, 2) * .36;
      for (let channel = 0; channel < 3; channel++) {
        ctx.beginPath();
        ctx.ellipse(ripple.x * width + channel - 1, ripple.y * height, radius + channel * 1.4, radius * .55, -.12, 0, Math.PI * 2);
        ctx.strokeStyle = channel === 0 ? `rgba(90,214,238,${alpha})` : channel === 1 ? `rgba(255,255,255,${alpha})` : `rgba(219,157,244,${alpha})`;
        ctx.lineWidth = .8;
        ctx.stroke();
      }
    }
  }

  function tick(stamp) {
    frame = 0;
    if (!visible()) return;
    if (!previous || stamp - previous >= interval) {
      const elapsed = previous ? Math.min((stamp - previous) / 1000, .25) : 1 / 30;
      const delta = Math.min(elapsed, .1);
      previous = stamp;
      if (!reduced()) {
        time += delta;
        // Pointer response stays immediate even when a slower GPU draws fewer frames.
        const response = 1 - Math.exp(-elapsed * 18);
        pointer.x += (target.x - pointer.x) * response;
        pointer.y += (target.y - pointer.y) * response;
        focus += (focusTarget - focus) * (1 - Math.exp(-elapsed * 10));
        while (ripples.length && time - ripples[0].started > 2.4) ripples.shift();
      }
      paint();
    }
    if ((context || renderer) && !reduced()) frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (!frame && visible()) frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
    water.dataset.opticsPaused = String(!visible() || reduced());
    if (reduced()) {
      target = { x: 0, y: 0 };
      pointer = { x: 0, y: 0 };
      ripples.length = 0;
      dirtyLight = true;
    }
    if (visible()) { paint(); if (!reduced()) schedule(); }
  }

  listen(window, 'pointermove', event => {
    if (reduced() || !visible()) return;
    target.x = clamp(event.clientX / innerWidth * 2 - 1, -1, 1);
    target.y = clamp(event.clientY / innerHeight * 2 - 1, -1, 1);
    dirtyLight = true;
    schedule();
  }, { passive: true });
  function resetPointer() {
    target = { x: 0, y: 0 };
    dirtyLight = true;
    schedule();
  }
  listen(document.documentElement, 'pointerleave', resetPointer, { passive: true });
  listen(window, 'pointercancel', resetPointer, { passive: true });
  listen(window, 'pointerup', event => { if (event.pointerType !== 'mouse') resetPointer(); }, { passive: true });
  listen(window, 'pointerdown', event => {
    if (reduced() || !visible() || event.button > 0) return;
    const rect = water.getBoundingClientRect();
    ripples.push({ x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1), started: time });
    if (ripples.length > 4) ripples.shift();
    schedule();
  }, { passive: true });
  listen(stage, 'focusin', () => { focusTarget = 1; schedule(); });
  listen(stage, 'focusout', event => { if (!stage.contains(event.relatedTarget)) focusTarget = 0; });
  listen(window, 'scroll', () => { bounds = stage.getBoundingClientRect(); }, { passive: true });
  listen(document, 'visibilitychange', sync);
  for (const preference of [motion, transparency, forcedColors]) listen(preference, 'change', sync);
  const resize = new ResizeObserver(measure);
  resize.observe(water);
  const intersection = new IntersectionObserver(entries => { onScreen = entries[0].isIntersecting; sync(); });
  intersection.observe(stage);
  if (renderer) listen(canvas, 'webglcontextlost', event => {
    event.preventDefault();
    const replacement = canvas.cloneNode();
    canvas.replaceWith(replacement);
    dispose();
    if (root.isConnected) mountConcernOptics(root, { forceCanvas: true });
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    resize.disconnect();
    intersection.disconnect();
    cleanups.forEach(cleanup => cleanup());
    ripples.length = 0;
    renderer?.dispose();
    // Release the backing surface when this search view is removed/replaced.
    canvas.width = canvas.height = 1;
    if (mounted.get(root) === dispose) mounted.delete(root);
  }
  const removal = new MutationObserver(() => { if (!root.isConnected || !canvas.isConnected) { dispose(); removal.disconnect(); } });
  removal.observe(root.ownerDocument.body, { childList: true, subtree: true });
  cleanups.push(() => removal.disconnect());
  listen(root, 'concern-before-refresh', dispose);
  mounted.set(root, dispose);
  water.dataset.optics = renderer ? 'webgl' : context ? 'canvas' : 'css';
  measure();
  sync();
  return dispose;
}
