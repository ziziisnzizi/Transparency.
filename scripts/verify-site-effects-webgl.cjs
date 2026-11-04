// Opt-in Korean-source / English-lens WebGL verification against raw references.
// All requests are fulfilled in memory; no dev server or external site is used.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  console.error('Optional browser verification requires: npm install --no-save playwright && npx playwright install chromium');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const output = process.env.SITE_EFFECTS_QA_OUTPUT || path.join(require('node:os').tmpdir(), 'transparency-site-effects-webgl.json');
const names = ['landing-lens-renderer.js', 'site-background.js', 'site-effects-config.js'];

(async () => {
  const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, await fs.readFile(path.join(root, name), 'utf8')])));
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'] });
  let result;
  try {
    const context = await browser.newContext({ viewport: { width: 400, height: 280 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/qa-empty') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff}canvas{display:block}</style><body></body>' });
      const source = sources[url.pathname.slice(1)];
      if (source) return route.fulfill({ contentType: 'application/javascript', body: source });
      return route.abort();
    });
    await page.goto('http://127.0.0.1:4199/qa-empty');
    result = await page.evaluate(async () => {
      const ledger = { created: {}, deleted: {} };
      const live = new WeakSet();
      const kinds = ['Texture', 'Buffer', 'Program', 'Shader', 'Framebuffer', 'Renderbuffer'];
      for (const kind of kinds) {
        ledger.created[kind] = ledger.deleted[kind] = 0;
        for (const prefix of ['create', 'delete']) {
          const name = prefix + kind;
          const original = WebGLRenderingContext.prototype[name];
          WebGLRenderingContext.prototype[name] = function (...args) {
            const value = original.apply(this, args);
            if (prefix === 'create' && value) { ledger.created[kind]++; live.add(value); }
            if (prefix === 'delete' && args[0] && live.has(args[0])) { ledger.deleted[kind]++; live.delete(args[0]); }
            return value;
          };
        }
      }
      const { createLandingLensRenderer } = await import('/landing-lens-renderer.js');
      const { createSiteBackground } = await import('/site-background.js');
      const { siteEffectsConfig } = await import('/site-effects-config.js');
      const width = 240, height = 160, ratio = 2;
      const pw = width * ratio, ph = height * ratio;
      const point = { x: 120, y: 80, radius: 50, rimWidth: 6, refraction: 7, rgbOffset: siteEffectsConfig.lens.rgbOffset, fringeOpacity: siteEffectsConfig.lens.fringeOpacity, opacity: 1, reveal: 1 };
      const paper = [1, 1, 1];
      function texture(language) {
        const canvas = document.createElement('canvas');
        canvas.width = pw; canvas.height = ph;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.scale(ratio, ratio);
        ctx.fillStyle = 'rgba(30, 40, 55, 0.92)';
        ctx.font = '700 23px sans-serif';
        ctx.fillText(language === 'ko' ? '한국어' : 'ENGLISH', language === 'ko' ? 52 : 76, language === 'ko' ? 60 : 105);
        // Language-exclusive, pixel-aligned strokes cross both center and rim.
        ctx.fillRect(language === 'ko' ? 103 : 132, 26, 3, 108);
        ctx.fillRect(58, language === 'ko' ? 72 : 88, 124, 2);
        const raw = ctx.getImageData(0, 0, pw, ph).data;
        const premultiplied = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i += 4) {
          for (let c = 0; c < 3; c++) premultiplied[i + c] = Math.round(raw[i + c] * raw[i + 3] / 255);
          premultiplied[i + 3] = raw[i + 3];
        }
        return { canvas, pixels: premultiplied };
      }
      function read(gl, w, h) {
        const raw = new Uint8Array(w * h * 4), out = new Uint8Array(raw.length);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
        for (let y = 0; y < h; y++) out.set(raw.subarray((h - y - 1) * w * 4, (h - y) * w * 4), y * w * 4);
        return out;
      }
      const radial = i => Math.hypot(((i / 4) % pw + .5) / ratio - point.x, (Math.floor(i / 4 / pw) + .5) / ratio - point.y);
      const core = i => radial(i) <= point.radius - point.rimWidth - .75;
      const outside = i => radial(i) >= point.radius + 1;
      const opticalRegion = i => radial(i) <= point.radius + 1;
      function difference(a, b, select = () => true) {
        let count = 0, sum = 0, max = 0;
        const errors = [];
        for (let i = 0; i < a.length; i += 4) if (select(i)) {
          let peak = 0;
          for (let c = 0; c < 4; c++) { const d = Math.abs(a[i + c] - b[i + c]); peak = Math.max(peak, d); sum += d; }
          errors.push(peak); max = Math.max(max, peak); count++;
        }
        errors.sort((a, b) => a - b);
        return { pixels: count, maxRGBA: max, meanChannel: sum / Math.max(1, count * 4), p99RGBA: errors[Math.floor((errors.length - 1) * .99)] || 0 };
      }
      function energy(a, b, chromatic = false) {
        let total = 0, confined = 0, significant = 0, outsideSignificant = 0, maxSignal = 0;
        for (let i = 0; i < a.length; i += 4) {
          const delta = [];
          // Composite independently over white so alpha changes do not masquerade as RGB separation.
          for (let c = 0; c < 3; c++) delta.push(a[i + c] - a[i + 3] - b[i + c] + b[i + 3]);
          const signal = chromatic ? Math.max(...delta) - Math.min(...delta) : Math.max(...delta.map(Math.abs));
          const e = Math.max(0, signal - 2) ** 2;
          total += e;
          if (opticalRegion(i)) confined += e;
          if (signal > 3) { significant++; if (!opticalRegion(i)) outsideSignificant++; }
          maxSignal = Math.max(maxSignal, signal);
        }
        return { significantPixels: significant, outsideSignificantPixels: outsideSignificant, maxSignal, confinedEnergyFraction: total ? confined / total : 0, energy: total };
      }
      const native = texture('ko'), translated = texture('en');
      const original = document.createElement('canvas'); document.body.append(original);
      const renderer = createLandingLensRenderer(original);
      if (!renderer) throw new Error('Actual lens WebGL renderer unavailable');
      if (!renderer.upload([native.canvas, translated.canvas], width, height, ratio, paper)) throw new Error('Actual lens upload failed');
      const gl = renderer.canvas.getContext('webgl');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const implementation = { vendor: gl.getParameter(gl.VENDOR), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) };
      const capture = changes => { renderer.render({ ...point, ...changes }); return read(gl, pw, ph); };
      const lens = capture({});
      const overlay = capture({overlayOnly:1});
      const unwarped = capture({ refraction: 0, rgbOffset: 0 });
      const noRefraction = capture({ refraction: 0 });
      const noRgb = capture({ rgbOffset: 0 });
      const revealZero = capture({ reveal: 0 });
      renderer.upload([translated.canvas,translated.canvas],width,height,ratio,paper);
      const englishOptical = capture({ reveal: 0 });
      renderer.upload([native.canvas,native.canvas],width,height,ratio,paper);
      const koreanOptical = capture({ reveal: 1 });
      const opacityZero = capture({ opacity: 0 });
      const ideal = new Uint8Array(native.pixels.length);
      const smooth = value => { const x = Math.min(1, Math.max(0, value)); return x * x * (3 - 2 * x); };
      for (let i = 0; i < ideal.length; i += 4) {
        const mask = 1 - smooth((radial(i) - (point.radius - .6)) / 1.2);
        for (let c = 0; c < 4; c++) ideal[i + c] = Math.round(native.pixels[i + c] * (1 - mask) + translated.pixels[i + c] * mask);
      }
      const nativeOnly = i => core(i) && native.pixels[i + 3] > 220 && translated.pixels[i + 3] === 0;
      const translatedOnly = i => core(i) && translated.pixels[i + 3] > 220 && native.pixels[i + 3] === 0;
      const zero = new Uint8Array(lens.length);
      const metrics = {
        outsideKorean: difference(lens, native.pixels, outside),
        overlayOutside: difference(overlay,new Uint8Array(overlay.length),outside),
        deepCoreEnglish: difference(lens, englishOptical, core),
        koreanExclusiveRemoved: difference(unwarped, zero, nativeOnly),
        englishExclusivePresent: difference(unwarped, translated.pixels, translatedOnly),
        revealZeroKorean: difference(revealZero, koreanOptical, core),
        opacityZeroKorean: difference(opacityZero, native.pixels),
        independentUnwarpedReference: difference(unwarped, ideal),
        noRefractionRgbDifference: difference(noRefraction, unwarped),
        distortionAgainstIndependentIdeal: energy(lens, ideal),
        warpOnly: energy(noRgb, unwarped),
        rgbOnly: energy(lens, noRgb, true),

        glError: gl.getError(),
      };
      // Measure actual channel centroids on isolated white strokes at increasing
      // radii. This is an optical measurement, independent of the shader formula.
      const radialDispersion = [];
      let softFringes={pixels:0,minRatio:1,maxRatio:0,maxGreen:0,redPixels:0,bluePixels:0}, smallerSpread=0;
      for (const fraction of [0,.4,.72,.92]) {
        const stroke = document.createElement('canvas'); stroke.width=pw;stroke.height=ph;
        const ctx=stroke.getContext('2d');ctx.fillStyle='#fff';
        ctx.fillRect((point.x+fraction*point.radius-1)*ratio,0,2*ratio,ph);
        renderer.upload([stroke,stroke],width,height,ratio,[0,0,0]);
        const pixels=capture({rimWidth:.1,reveal:0});
        const totals=[0,0,0],weighted=[0,0,0],row=Math.floor(ph/2);
        for(let x=0;x<pw;x++)for(let c=0;c<3;c++){
          const value=pixels[(row*pw+x)*4+c];totals[c]+=value;weighted[c]+=(x+.5)*value;
        }
        const centroids=weighted.map((sum,c)=>sum/Math.max(totals[c],1)/ratio);
        radialDispersion.push({fraction,centroids,spread:Math.abs(centroids[2]-centroids[0]),greenWidth:totals[1]/255/ratio});
        if(fraction===.72){
          const base=capture({rimWidth:.1,reveal:0,fringeOpacity:0}),opaque=capture({rimWidth:.1,reveal:0,fringeOpacity:1});
          const noSplit=capture({rimWidth:.1,reveal:0,rgbOffset:0});
          metrics.fringeOffMatchesSharpCarrier=difference(base,noSplit);
          for(let i=0;i<pixels.length;i+=4)if(radial(i)<point.radius-2&&base[i+3]===0&&opaque[i+3]>=250){const value=pixels[i+3]/opaque[i+3];softFringes.pixels++;softFringes.minRatio=Math.min(softFringes.minRatio,value);softFringes.maxRatio=Math.max(softFringes.maxRatio,value);softFringes.maxGreen=Math.max(softFringes.maxGreen,pixels[i+1]);if(pixels[i]>pixels[i+2]*1.5&&pixels[i]>30)softFringes.redPixels++;if(pixels[i+2]>pixels[i]*1.5&&pixels[i+2]>30)softFringes.bluePixels++;}
        }
        if(fraction===.92){
          const smaller=capture({rimWidth:.1,reveal:0,rgbOffset:2}),sum=[0,0,0],weighted=[0,0,0];
          for(let x=0;x<pw;x++)for(let c=0;c<3;c++){const v=smaller[(row*pw+x)*4+c];sum[c]+=v;weighted[c]+=(x+.5)*v;}
          smallerSpread=Math.abs(weighted[2]/sum[2]-weighted[0]/sum[0])/ratio;
        }
      }
      metrics.radialDispersion=radialDispersion;metrics.softFringes=softFringes;metrics.smallerOffsetSpread=smallerSpread;
      renderer.dispose();
      const lensDisposed = { contextLost: gl.isContextLost(), created: { ...ledger.created }, deleted: { ...ledger.deleted } };

      const backgroundCanvas = document.createElement('canvas'); document.body.append(backgroundCanvas);
      const background = createSiteBackground(backgroundCanvas, siteEffectsConfig.background);
      if (!background) throw new Error('Actual background WebGL renderer unavailable');
      background.resize(360, 240, 1);
      const backgroundGl = backgroundCanvas.getContext('webgl');
      const times = [0, 5, 20, 45];
      const frames = times.map(time => { background.render({ time, pointer: { x: 0, y: 0 }, poster: true }); return read(backgroundGl, 360, 240); });
      const backgroundMovement = times.slice(1).map((time, index) => {
        const frame = frames[index + 1];
        let sum = 0, changed = 0;
        for (let i = 0; i < frame.length; i += 4) {
          let peak = 0;
          for (let c = 0; c < 3; c++) { const delta = Math.abs(frame[i + c] - frames[0][i + c]); sum += delta; peak = Math.max(peak, delta); }
          if (peak > 12) changed++;
        }
        return { from: 0, to: time, meanRGBDelta: sum / (360 * 240 * 3), fractionChangingOver12: changed / (360 * 240) };
      });
      background.render({ time: 20, pointer: { x: 0, y: 0 }, poster: true });
      const backgroundRepeat = difference(read(backgroundGl, 360, 240), frames[2]);
      const backgroundError = backgroundGl.getError();
      background.dispose();
      const resourcesReleased = kinds.every(kind => ledger.created[kind] === ledger.deleted[kind]);
      const checks = {
        outsideKoreanUnchanged: metrics.outsideKorean.maxRGBA <= 1,
        overlayTransparentOutsideLens:metrics.overlayOutside.maxRGBA===0,
        separatedColoursFullyOpaque:softFringes.pixels>5&&softFringes.minRatio>.995&&softFringes.maxRatio<=1,
        fringesAreRedAndBlue:softFringes.maxGreen===0&&softFringes.redPixels>5&&softFringes.bluePixels>5,
        fringeOpacityZeroRestoresCarrier:metrics.fringeOffMatchesSharpCarrier.maxRGBA<=1,
        coloursExtendFurtherThanTwoPixels:radialDispersion.at(-1).spread>smallerSpread+.10,
        independentReferenceAligned: metrics.independentUnwarpedReference.maxRGBA <= 2,
        sufficientExclusiveStrokes: metrics.koreanExclusiveRemoved.pixels >= 400 && metrics.englishExclusivePresent.pixels >= 400,
        koreanRemovedInCore: metrics.koreanExclusiveRemoved.maxRGBA <= 1,
        englishPresentInCore: metrics.englishExclusivePresent.maxRGBA <= 1,
        englishOpticalCoreMatches: metrics.deepCoreEnglish.maxRGBA <= 1,
        centralDispersionMinimal: radialDispersion[0].spread < .05,
        dispersionGrowsTowardsPerimeter: radialDispersion.every((sample,index)=>!index||sample.spread>radialDispersion[index-1].spread+.08),
        outerDispersionVisible: radialDispersion.at(-1).spread > 1.5,
        convexCentreMagnifies: radialDispersion[0].greenWidth > 2.10 && radialDispersion[0].greenWidth < 2.5,
        noDispersionWithoutRefraction: metrics.noRefractionRgbDifference.maxRGBA === 0,
        revealZeroRestoresKorean: metrics.revealZeroKorean.maxRGBA <= 1,
        opacityZeroRestoresKorean: metrics.opacityZeroKorean.maxRGBA <= 1,
        distortedRingPresent: metrics.distortionAgainstIndependentIdeal.significantPixels > 100,
        warpedRingPresent: metrics.warpOnly.significantPixels > 100,
        rgbRingPresent: metrics.rgbOnly.significantPixels > 50 && metrics.rgbOnly.maxSignal > 10,
        distortionConfinedToLensAndAA: metrics.distortionAgainstIndependentIdeal.confinedEnergyFraction >= .999 && metrics.distortionAgainstIndependentIdeal.outsideSignificantPixels === 0,
        warpConfinedToLensAndAA: metrics.warpOnly.confinedEnergyFraction >= .999 && metrics.warpOnly.outsideSignificantPixels === 0,
        rgbConfinedToLensAndAA: metrics.rgbOnly.confinedEnergyFraction >= .999 && metrics.rgbOnly.outsideSignificantPixels === 0,
        autonomousBackgroundMovement: backgroundMovement.every(item => item.meanRGBDelta > 3 && item.fractionChangingOver12 > .05) && backgroundMovement[2].fractionChangingOver12 > .25,
        deterministicBackground: backgroundRepeat.maxRGBA === 0,
        noGlErrors: metrics.glError === 0 && backgroundError === 0,
        resourcesReleased,
        contextsDisposed: lensDisposed.contextLost && backgroundGl.isContextLost(),
      };
      return { fixture: { cssSize: [width, height], pixelRatio: ratio, nativeLanguage: 'ko', lensLanguage: 'en', nativeText: '한국어', lensText: 'ENGLISH', parameters: point, opticalRadius: point.radius + 1, dispersionReference: 'Measured RGB stroke centroids at normalized radii 0, .4, .72 and .92; centre magnification measured from integrated green stroke width', reference: 'Raw independent Canvas2D pixels, explicitly premultiplied; no shader-derived oracle', backgroundSize: [360, 240], backgroundPointer: [0, 0], backgroundTimes: times }, implementation, metrics, backgroundMovement, backgroundRepeat, disposal: { lens: lensDisposed, allCreated: ledger.created, allDeleted: ledger.deleted, backgroundContextLost: backgroundGl.isContextLost() }, checks, passed: Object.values(checks).every(Boolean) };
    });
    result.pageErrors = errors;
    if (errors.length) result.passed = false;
    await context.close();
  } finally {
    await browser.close();
  }
  result.sources = Object.fromEntries(names.map(name => [name, crypto.createHash('sha256').update(sources[name]).digest('hex')]));
  await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, artifact: output, checks: result.checks, implementation: result.implementation, backgroundMovement: result.backgroundMovement }));
  if (!result.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
