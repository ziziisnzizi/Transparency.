// Isolated real-WebGL checks for bounded, outward pointer repulsion and grain.
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Install optional verification tools: npm install --no-save playwright && npx playwright install chromium'); process.exit(1); }
const root = require('node:path').resolve(__dirname, '..');
const artifact = process.env.SITE_REPULSION_QA_OUTPUT || require('node:path').join(require('node:os').tmpdir(), 'transparency-pointer-repulsion.json');

(async () => {
  const names = ['site-background.js', 'site-effects-config.js'];
  const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, await fs.readFile(`${root}/${name}`, 'utf8')])));
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'] });
  let result;
  try {
    const context = await browser.newContext({ viewport: { width: 360, height: 240 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/qa-empty') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body></body>' });
      const source = sources[pathname.slice(1)];
      return source ? route.fulfill({ contentType: 'application/javascript', body: source }) : route.abort();
    });
    await page.goto('http://127.0.0.1:4199/qa-empty');
    result = await page.evaluate(async () => {
      const { createSiteBackground } = await import('/site-background.js');
      const { siteEffectsConfig } = await import('/site-effects-config.js');
      const settings = siteEffectsConfig.background || {};
      const W = 360, H = 240, time = 8;
      const radius = settings.pointerRadius ?? .32, push = settings.pointerPush ?? .20;
      const center = { x: 0, y: 0, active: 1 }, off = { x: .45, y: -.2, active: 1 };
      const inactive = { x: 0, y: 0, active: 0 }, parked = { ...off, active: 0 };
      const inside = (i, pointer) => {
        const x = (i / 4) % W + .5, y = Math.floor(i / 4 / W) + .5;
        return Math.hypot(x - (pointer.x + 1) * W / 2, y - (pointer.y + 1) * H / 2) <= radius * H + 1;
      };
      function compare(a, b, region = () => true) {
        let pixels = 0, maxRGB = 0, sum = 0, changed = 0, energy = 0, regionEnergy = 0, outsideMax = 0, outsideChanged = 0;
        for (let i = 0; i < a.length; i += 4) {
          let peak = 0, e = 0;
          for (let c = 0; c < 3; c++) { const d = Math.abs(a[i + c] - b[i + c]); peak = Math.max(peak, d); sum += d; e += d * d; }
          pixels++; maxRGB = Math.max(maxRGB, peak); if (peak > 2) changed++;
          energy += e;
          if (region(i)) regionEnergy += e;
          else { outsideMax = Math.max(outsideMax, peak); if (peak > 2) outsideChanged++; }
        }
        return { pixels, maxRGB, meanRGBDelta: sum / (pixels * 3), fractionChangingOver2: changed / pixels, significantPixels: changed, outsideMaxRGB: outsideMax, outsideSignificantPixels: outsideChanged, confinedEnergyFraction: energy ? regionEnergy / energy : 0 };
      }
      const counters = { created: {}, deleted: {} }, live = new WeakSet();
      for (const type of ['Buffer', 'Program', 'Shader', 'Texture']) {
        counters.created[type] = counters.deleted[type] = 0;
        for (const prefix of ['create', 'delete']) {
          const original = WebGLRenderingContext.prototype[prefix + type];
          WebGLRenderingContext.prototype[prefix + type] = function (...args) {
            const value = original.apply(this, args);
            if (prefix === 'create' && value) { counters.created[type]++; live.add(value); }
            if (prefix === 'delete' && args[0] && live.has(args[0])) { counters.deleted[type]++; live.delete(args[0]); }
            return value;
          };
        }
      }
      function fixture(config) {
        const canvas = document.createElement('canvas'); document.body.append(canvas);
        const renderer = createSiteBackground(canvas, config);
        if (!renderer) throw new Error('Actual site background WebGL unavailable');
        renderer.resize(W, H, 1);
        const gl = canvas.getContext('webgl');
        return { renderer, gl, capture(options) {
          renderer.render({ time, pointer: inactive, ...options });
          const raw = new Uint8Array(W * H * 4), pixels = new Uint8Array(raw.length);
          gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
          for (let y = 0; y < H; y++) pixels.set(raw.subarray((H - y - 1) * W * 4, (H - y) * W * 4), y * W * 4);
          return pixels;
        } };
      }
      const normal = fixture(settings);
      const debug = normal.gl.getExtension('WEBGL_debug_renderer_info');
      const implementation = { renderer: normal.gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : normal.gl.RENDERER), version: normal.gl.getParameter(normal.gl.VERSION) };
      const modes = {}, checks = {};
      for (const [name, mode] of [['lightPage', { dark: false, poster: false }], ['darkPage', { dark: true, poster: false }], ['poster', { dark: false, poster: true }]]) {
        const neutral = normal.capture(mode), offInactive = normal.capture({ ...mode, pointer: parked });
        const atCenter = normal.capture({ ...mode, pointer: center }), atOff = normal.capture({ ...mode, pointer: off });
        const base = normal.capture({ ...mode, time: 0, pointer: parked });
        const movement = [5, 20, 45].map(t => ({ time: t, ...compare(normal.capture({ ...mode, time: t, pointer: parked }), base) }));
        const repeat = compare(normal.capture({ ...mode, pointer: off }), atOff);
        const coordinateInactive = compare(offInactive, neutral);
        const local = compare(atOff, neutral, i => inside(i, off));
        const moved = compare(atOff, atCenter, i => inside(i, center) || inside(i, off));
        modes[name] = { coordinateInactive, local, moved, movement, repeat };
        checks[`${name}ParkedCoordinatesDoNotChangeField`] = coordinateInactive.maxRGB === 0;
        checks[`${name}PointerEffectIsLocal`] = local.outsideMaxRGB === 0 && local.confinedEnergyFraction >= .999 && local.significantPixels > 100;
        checks[`${name}MovingPointerChangesOnlyTwoLocalDisks`] = moved.outsideMaxRGB === 0 && moved.significantPixels > 100;
        checks[`${name}AutonomousMotion`] = movement.every(frame => frame.meanRGBDelta > .1 && frame.fractionChangingOver2 > .01);
        checks[`${name}DeterministicFixedState`] = repeat.maxRGB === 0;
      }
      const palette = { samples: 0, nearWhite: 0, nearBlack: 0, blue: 0, warm: 0, minLuminance: 255, maxLuminance: 0 };
      for (const t of [0, 5, 20, 45]) {
        const pixels = normal.capture({ time: t, poster: true, pointer: parked });
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], lum = .2126 * r + .7152 * g + .0722 * b;
          palette.samples++; palette.minLuminance = Math.min(palette.minLuminance, lum); palette.maxLuminance = Math.max(palette.maxLuminance, lum);
          if (r > 180 && g > 195 && b > 210 && Math.max(r, g, b) - Math.min(r, g, b) < 70) palette.nearWhite++;
          if (lum < 35 && Math.max(r, g, b) - Math.min(r, g, b) < 35) palette.nearBlack++;
          if (b - r > 35 && b - g > 12 && b > 70) palette.blue++;
          if (r - b > 8) palette.warm++;
        }
      }
      for (const key of ['nearWhite', 'nearBlack', 'blue', 'warm']) palette[`${key}Fraction`] = palette[key] / palette.samples;
      checks.actualWhiteBlackBluePalette = palette.nearWhiteFraction > .005 && palette.nearBlackFraction > .02 && palette.blueFraction > .05 && palette.warmFraction < .001;
      const grainStates = [{ time, poster: true, pointer: parked }, { time: 20, poster: true, pointer: parked }, { time, poster: true, pointer: off }];
      const withGrain = grainStates.map(options => normal.capture(options));
      const firstError = normal.gl.getError(); normal.renderer.dispose();
      const firstDisposed = normal.gl.isContextLost();

      // A grain-free observation isolates color-field registration. The radial
      // sampling model is the agreed public effect contract, not shader output.
      const field = fixture({ ...settings, grain: 0 });
      const base = field.capture({ poster: true, pointer: parked });
      const active = field.capture({ poster: true, pointer: off });
      const withoutGrain = grainStates.map(options => field.capture(options));
      const grain = { samples: 0, sum: 0, sumSquared: 0, sumAbsolute: 0, significant: 0, maxChannelSpread: 0, maxTimeOrPointerResidualDifference: 0 };
      for (let i = 0; i < base.length; i += 4) {
        if (withoutGrain.some(frame => [0, 1, 2].some(c => frame[i + c] < 16 || frame[i + c] > 239))) continue;
        const residuals = withGrain.map((frame, state) => [0, 1, 2].map(c => frame[i + c] - withoutGrain[state][i + c]));
        const delta = residuals[0][0]; grain.samples++; grain.sum += delta; grain.sumSquared += delta * delta; grain.sumAbsolute += Math.abs(delta);
        if (Math.abs(delta) > 2) grain.significant++;
        for (const residual of residuals) grain.maxChannelSpread = Math.max(grain.maxChannelSpread, Math.max(...residual) - Math.min(...residual));
        for (let state = 1; state < residuals.length; state++) for (let c = 0; c < 3; c++) grain.maxTimeOrPointerResidualDifference = Math.max(grain.maxTimeOrPointerResidualDifference, Math.abs(residuals[state][c] - residuals[0][c]));
      }
      grain.mean = grain.sum / Math.max(1, grain.samples); grain.standardDeviation = Math.sqrt(grain.sumSquared / Math.max(1, grain.samples) - grain.mean ** 2); grain.meanAbsolute = grain.sumAbsolute / Math.max(1, grain.samples); grain.significantFraction = grain.significant / Math.max(1, grain.samples);
      checks.visibleAchromaticGrain = grain.samples > 1000 && grain.standardDeviation > 4 && grain.meanAbsolute > 3 && grain.significantFraction > .6 && grain.maxChannelSpread <= 1;
      checks.grainStaysFixedWhileFieldMoves = grain.maxTimeOrPointerResidualDifference <= 1;
      function sample(x, y, c) {
        const xx = Math.max(0, Math.min(W - 1, x)), yy = Math.max(0, Math.min(H - 1, y));
        const x0 = Math.floor(xx), y0 = Math.floor(yy), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
        const fx = xx - x0, fy = yy - y0;
        return base[(y0 * W + x0) * 4 + c] * (1 - fx) * (1 - fy) + base[(y0 * W + x1) * 4 + c] * fx * (1 - fy) + base[(y1 * W + x0) * 4 + c] * (1 - fx) * fy + base[(y1 * W + x1) * 4 + c] * fx * fy;
      }
      const radial = { samples: 0, outwardMAE: 0, inwardMAE: 0, tangentMAE: 0, unshiftedMAE: 0 };
      for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
        const dx = (x + .5 - (off.x + 1) * W / 2) / H, dy = (y + .5 - (off.y + 1) * H / 2) / H;
        const distance = Math.hypot(dx, dy), q = Math.max(0, Math.min(1, distance / radius));
        if (q < .1 || q > .9) continue;
        const influence = 1 - q * q * (3 - 2 * q);
        const sx = dx / (distance + .035) * influence * push * H, sy = dy / (distance + .035) * influence * push * H;
        const i = (y * W + x) * 4;
        if (Math.max(...[0, 1, 2].map(c => Math.abs(active[i + c] - base[i + c]))) <= 3) continue;
        for (let c = 0; c < 3; c++) {
          // Visible outward repulsion samples the original field inward.
          radial.outwardMAE += Math.abs(active[i + c] - sample(x - sx, y - sy, c));
          radial.inwardMAE += Math.abs(active[i + c] - sample(x + sx, y + sy, c));
          radial.tangentMAE += Math.abs(active[i + c] - sample(x - sy, y + sx, c));
          radial.unshiftedMAE += Math.abs(active[i + c] - base[i + c]);
        }
        radial.samples++;
      }
      for (const name of ['outwardMAE', 'inwardMAE', 'tangentMAE', 'unshiftedMAE']) radial[name] /= Math.max(1, radial.samples * 3);
      checks.radialOutwardColorFieldRegistration = radial.samples > 100 && radial.outwardMAE < 1 && radial.outwardMAE < radial.unshiftedMAE * .2 && radial.outwardMAE < radial.inwardMAE * .2 && radial.outwardMAE < radial.tangentMAE * .2;
      const secondError = field.gl.getError(); field.renderer.dispose();
      checks.noGlErrors = firstError === 0 && secondError === 0;
      checks.contextsDisposed = firstDisposed && field.gl.isContextLost();
      checks.resourcesReleased = Object.keys(counters.created).every(type => counters.created[type] === counters.deleted[type]);
      return { fixture: { size: [W, H], time, radiusInHeightUnits: radius, pushInHeightUnits: push, offcenter: off, outsideAllowanceCSS: 1, timeSamples: [0, 5, 20, 45], outwardMeans: 'Visible field moves outward; baseline sampled at inward radial UV' }, implementation, modes, radial, palette, grain, counters, checks, passed: Object.values(checks).every(Boolean) };
    });
    result.pageErrors = pageErrors;
    if (pageErrors.length) result.passed = false;
    await context.close();
  } finally { await browser.close(); }
  result.sources = Object.fromEntries(names.map(name => [name, crypto.createHash('sha256').update(sources[name]).digest('hex')]));
  await fs.writeFile(artifact, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, artifact, checks: result.checks, radial: result.radial, implementation: result.implementation }));
  if (!result.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
