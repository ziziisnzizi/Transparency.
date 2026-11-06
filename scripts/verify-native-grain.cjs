// Opt-in real-WebGL verification of physical grain size across field budgets and DPR.
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Install optional verification tools: npm install --no-save playwright && npx playwright install chromium'); process.exit(1); }
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const artifact = process.env.SITE_GRAIN_QA_OUTPUT || path.join(require('node:os').tmpdir(), 'transparency-native-grain.json');

(async () => {
  const names = ['site-background.js', 'site-effects-config.js'];
  const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, await fs.readFile(`${root}/${name}`, 'utf8')])));
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'] });
  let result;
  try {
    const context = await browser.newContext({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/*', route => {
      const name = new URL(route.request().url()).pathname.slice(1);
      if (name === 'qa-empty') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' });
      return sources[name] ? route.fulfill({ contentType: 'application/javascript', body: sources[name] }) : route.abort();
    });
    await page.goto('http://127.0.0.1:4199/qa-empty');
    result = await page.evaluate(async () => {
      const { createSiteBackground } = await import('/site-background.js');
      const { siteEffectsConfig } = await import('/site-effects-config.js');
      const config = siteEffectsConfig.background || {}, W = 640, H = 400;
      const state = { time: 3, pointer: { x: 0, y: 0, active: 0 } };
      const expectedCellSize = 1.3;
      const types = ['Shader', 'Program', 'Buffer', 'Texture', 'Framebuffer', 'Renderbuffer'];
      const ledger = { created: {}, deleted: {} }, live = new WeakSet();
      const contexts = new WeakMap();
      const info = gl => { if (!contexts.has(gl)) contexts.set(gl, { draws: [], allocations: [], textures: new WeakMap() }); return contexts.get(gl); };
      for (const type of types) {
        ledger.created[type] = ledger.deleted[type] = 0;
        for (const prefix of ['create', 'delete']) {
          const native = WebGLRenderingContext.prototype[prefix + type];
          WebGLRenderingContext.prototype[prefix + type] = function (...args) {
            const value = native.apply(this, args);
            if (prefix === 'create' && value) { ledger.created[type]++; live.add(value); }
            if (prefix === 'delete' && args[0] && live.has(args[0])) { ledger.deleted[type]++; live.delete(args[0]); }
            return value;
          };
        }
      }
      const nativeTexImage = WebGLRenderingContext.prototype.texImage2D;
      WebGLRenderingContext.prototype.texImage2D = function (...args) {
        const value = nativeTexImage.apply(this, args);
        if (args.length === 9 && Number.isFinite(args[3]) && Number.isFinite(args[4])) {
          const size = [args[3], args[4]], texture = this.getParameter(this.TEXTURE_BINDING_2D);
          if (texture) info(this).textures.set(texture, size);
          info(this).allocations.push(size);
        }
        return value;
      };
      const nativeDraw = WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays = function (...args) {
        const framebuffer = this.getParameter(this.FRAMEBUFFER_BINDING);
        let attachedSize = null;
        if (framebuffer) {
          const texture = this.getFramebufferAttachmentParameter(this.FRAMEBUFFER, this.COLOR_ATTACHMENT0, this.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME);
          attachedSize = texture ? info(this).textures.get(texture) || null : null;
        }
        info(this).draws.push({ target: framebuffer ? 'fieldFBO' : 'default', viewport: Array.from(this.getParameter(this.VIEWPORT)), attachedSize });
        return nativeDraw.apply(this, args);
      };
      let implementation;
      function capture(dpr, budget, grain) {
        const canvas = document.createElement('canvas'); document.body.append(canvas);
        const renderer = createSiteBackground(canvas, { ...config, grain, maxPixelRatio: 1.5, pixelBudget: budget, outputMaxPixelRatio: 3, outputPixelBudget: 8400000 });
        if (!renderer) throw new Error('Actual two-pass WebGL renderer unavailable');
        const gl = canvas.getContext('webgl');
        if (!implementation) { const debug = gl.getExtension('WEBGL_debug_renderer_info'); implementation = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER); }
        const resized = renderer.resize(W, H, dpr);
        renderer.render(state);
        const output = [canvas.width, canvas.height], defaultBound = gl.getParameter(gl.FRAMEBUFFER_BINDING) === null;
        if (!defaultBound) throw new Error('Final framebuffer is not the native default target');
        const pixels = new Uint8Array(output[0] * output[1] * 4);
        // Preserve bottom-left GL origin: equal physical crops then share hash coordinates across DPR.
        gl.readPixels(0, 0, output[0], output[1], gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const facts = { dpr, budget, grain, output, resized, defaultBound, allocations: info(gl).allocations, draws: info(gl).draws, glError: gl.getError() };
        renderer.dispose(); facts.contextDisposed = gl.isContextLost(); canvas.remove();
        return { facts, pixels };
      }
      function residual(on, off) {
        const count = on.pixels.length / 4, values = new Int8Array(count), valid = new Uint8Array(count);
        let samples = 0, sum = 0, squares = 0, absolute = 0, maxChannelSpread = 0;
        for (let p = 0; p < count; p++) {
          const i = p * 4;
          // White-dominant fields often clip blue; retain a stable red-channel
          // sample and compare any other channels that remain unclamped.
          if (off.pixels[i] < 12 || off.pixels[i] > 243) continue;
          const channels = [0, 1, 2].filter(c => off.pixels[i+c] >= 12 && off.pixels[i+c] <= 243);
          const d = channels.map(c => on.pixels[i + c] - off.pixels[i + c]);
          valid[p] = 1; values[p] = d[0]; samples++; sum += d[0]; squares += d[0] ** 2; absolute += Math.abs(d[0]); maxChannelSpread = Math.max(maxChannelSpread, Math.max(...d) - Math.min(...d));
        }
        const mean = sum / Math.max(1, samples);
        return { width: on.facts.output[0], height: on.facts.output[1], values, valid, stats: { samples, mean, standardDeviation: Math.sqrt(squares / Math.max(1, samples) - mean ** 2), meanAbsolute: absolute / Math.max(1, samples), maxChannelSpread } };
      }
      function paired(a, b, dx = 0, dy = 0, crop = null) {
        let n = 0, sa = 0, sb = 0, aa = 0, bb = 0, ab = 0, sumError = 0, maxError = 0;
        const errors = [];
        const width = Math.min(a.width, b.width, crop?.[0] ?? Infinity), height = Math.min(a.height, b.height, crop?.[1] ?? Infinity);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          if (x + dx < 0 || y + dy < 0 || x + dx >= width || y + dy >= height) continue;
          const ai = y * a.width + x, bi = (y + dy) * b.width + x + dx;
          if (!a.valid[ai] || !b.valid[bi]) continue;
          const av = a.values[ai], bv = b.values[bi], error = Math.abs(av - bv);
          n++; sa += av; sb += bv; aa += av * av; bb += bv * bv; ab += av * bv; sumError += error; maxError = Math.max(maxError, error); errors.push(error);
        }
        errors.sort((a, b) => a - b);
        const denominator = Math.sqrt(Math.max(0, (aa - sa * sa / Math.max(1, n)) * (bb - sb * sb / Math.max(1, n))));
        return { samples: n, correlation: denominator ? (ab - sa * sb / n) / denominator : 0, meanAbsoluteError: sumError / Math.max(1, n), p99Error: errors[Math.floor((errors.length - 1) * .99)] || 0, maxError };
      }
      function autocorrelation(image) {
        return Object.fromEntries([1, 2, 4, 8].map(lag => [lag, { x: paired(image, image, lag, 0).correlation, y: paired(image, image, 0, lag).correlation }]));
      }
      const entries = {}, runs = [], checks = {};
      const expectedStd = (config.grain ?? .045) * 255 / Math.sqrt(12);
      for (const dpr of [1, 2]) for (const [name, budget] of [['low', 100000], ['high', 1800000]]) {
        const off = capture(dpr, budget, 0), on = capture(dpr, budget, config.grain ?? .045);
        const image = residual(on, off), id = `dpr${dpr}_${name}`;
        image.autocorrelation = autocorrelation(image); entries[id] = image; runs.push({ id, off: off.facts, on: on.facts, grain: image.stats, autocorrelation: image.autocorrelation });
        const fieldDraws = on.facts.draws.filter(draw => draw.target === 'fieldFBO');
        const field = fieldDraws.at(-1)?.attachedSize;
        checks[`${id}NativeOutput`] = on.facts.output[0] === W * dpr && on.facts.output[1] === H * dpr && off.facts.output.join() === on.facts.output.join();
        checks[`${id}RealFieldFBO`] = field?.[0] > 1 && field?.[1] > 1 && fieldDraws.at(-1).viewport.slice(2).join() === field.join();
        checks[`${id}CalibratedVisibleGrain`] = image.stats.samples > 10000 && image.stats.standardDeviation >= Math.max(1, expectedStd * .7) && image.stats.standardDeviation <= expectedStd * 1.3 + .5 && image.stats.meanAbsolute > .75 && image.stats.maxChannelSpread <= 1;
        // floor(gl_FragCoord / 1.3) repeats some adjacent physical pixels.
        // That intended cell size gives ~23% lag-1 correlation, while pairs
        // separated by two or more output pixels should be independent.
        checks[`${id}FinePhysicalGrain`] = ['x', 'y'].every(axis => image.autocorrelation[1][axis] > .10 && image.autocorrelation[1][axis] < .35 && [2, 4, 8].every(lag => Math.abs(image.autocorrelation[lag][axis]) < .06));
      }
      const comparisons = {};
      for (const dpr of [1, 2]) {
        const low = entries[`dpr${dpr}_low`], high = entries[`dpr${dpr}_high`], key = `sameDpr${dpr}AcrossSceneBudgets`;
        comparisons[key] = paired(low, high);
        const lowRun = runs.find(run => run.id === `dpr${dpr}_low`), highRun = runs.find(run => run.id === `dpr${dpr}_high`);
        const lowField = lowRun.on.draws.find(draw => draw.target === 'fieldFBO').attachedSize, highField = highRun.on.draws.find(draw => draw.target === 'fieldFBO').attachedSize;
        checks[`dpr${dpr}FieldBudgetActuallyChangesFBO`] = lowField.join() !== highField.join();
        checks[key] = comparisons[key].samples > 10000 && comparisons[key].p99Error <= 1 && comparisons[key].maxError <= 2 && comparisons[key].correlation > .9;
        const maxAutocorrelationDifference = Math.max(...[1, 2, 4, 8].flatMap(lag => ['x', 'y'].map(axis => Math.abs(low.autocorrelation[lag][axis] - high.autocorrelation[lag][axis]))));
        comparisons[`${key}AutocorrelationDifference`] = maxAutocorrelationDifference;
        checks[`dpr${dpr}PhysicalScaleStableAcrossBudgets`] = maxAutocorrelationDifference < .05;
      }
      for (const budget of ['low', 'high']) {
        const key = `${budget}BudgetAcrossDprPhysicalCrop`;
        // Use the full common physical extent at the same GL origin. A small
        // bottom-left crop can be entirely clipped in a broad black/white field,
        // leaving no unclamped pairs; no alignment search or resampling is used.
        comparisons[key] = paired(entries[`dpr1_${budget}`], entries[`dpr2_${budget}`], 0, 0, [W, H]);
        // The lighter 70% white palette clips more channels in the shared
        // physical crop. Hundreds of overlapping unclamped pairs still give a
        // meaningful correlation without weakening the signal/error limits.
        checks[key] = comparisons[key].samples > 512 && comparisons[key].p99Error <= 1 && comparisons[key].maxError <= 2 && comparisons[key].correlation > .9;
      }
      checks.configuredPhysicalGrainSize = Math.abs(config.grainCellSize - expectedCellSize) < .001;
      checks.noGLErrors = runs.every(run => run.on.glError === 0 && run.off.glError === 0);
      checks.allContextsDisposed = runs.every(run => run.on.contextDisposed && run.off.contextDisposed);
      checks.allGLResourcesDeleted = types.every(type => ledger.created[type] === ledger.deleted[type]);
      return { fixture: { cssSize: [W, H], requestedDpr: [1, 2], sceneBudgets: [100000, 1800000], sceneMaxPixelRatio: 1.5, outputMaxPixelRatio: 3, outputPixelBudget: 8400000, state, grain: config.grain ?? .045, grainCellSize: config.grainCellSize, expectedPhysicalCellSize: expectedCellSize, expectedStandardDeviation: expectedStd, crop: { physicalSize: [W, H], origin: 'Full common physical extent at bottom-left raw readPixels, matching native gl_FragCoord hash coordinates without resampling or alignment search' }, exclusions: 'One continuous field with no legacy scene flags; red must be 12..243; other channels contribute only when unclamped' }, implementation, runs, comparisons, ledger, checks, passed: Object.values(checks).every(Boolean) };
    });
    result.pageErrors = pageErrors; if (pageErrors.length) result.passed = false;
    await context.close();
  } finally { await browser.close(); }
  result.sourceHashes = Object.fromEntries(names.map(name => [name, crypto.createHash('sha256').update(sources[name]).digest('hex')]));
  await fs.writeFile(artifact, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, artifact, checks: result.checks, implementation: result.implementation }));
  if (!result.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
