// Opt-in actual-WebGL observations of the broad, inertial background field.
// Requests are fulfilled from source in memory; no application server is used.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Install optional verification tools: npm install --no-save playwright && npx playwright install chromium'); process.exit(1); }
const root = path.resolve(__dirname, '..');
const artifact = process.env.SITE_BACKGROUND_QA_OUTPUT || path.join(require('node:os').tmpdir(), 'transparency-background-interaction.json');

(async () => {
  const names = ['site-background.js', 'site-effects-config.js', 'background-motion.js'];
  const sources = Object.fromEntries(await Promise.all(names.map(async name => [name, await fs.readFile(path.join(root, name), 'utf8')])));
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'] });
  let result;
  try {
    const context = await browser.newContext({ viewport: { width: 360, height: 240 }, deviceScaleFactor: 1 });
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
      const { createBackgroundMotion, stepBackgroundMotion } = await import('/background-motion.js');
      const settings = siteEffectsConfig.background || {};
      const W = 360, H = 240, clock = 3, times = [0, 1, 3, 5];
      const pointer = (x, y, extra = {}) => ({ x, y, active: 1, trailX: x, trailY: y, vx: 0, vy: 0, ...extra });
      const neutral = pointer(0, 0, { active: 0 });
      const left = pointer(-.7, -.35), right = pointer(.7, .35);
      const up = pointer(0, -.7), down = pointer(0, .7);
      const moving = pointer(.7, .35, { trailX: -.45, trailY: -.2, vx: 1.8, vy: .9 });
      const velocityOnly = pointer(.7, .35, { vx: 1.8, vy: .9 });
      const modes = { shared: {} };
      const legacyModes = { poster: { poster: true, dark: false }, lightPage: { poster: false, dark: false }, darkPage: { poster: false, dark: true }, mixedLegacyFlags: { poster: true, dark: true } };
      const ledger = { created: {}, deleted: {} }, live = new WeakSet();
      for (const type of ['Buffer', 'Program', 'Shader', 'Texture', 'Framebuffer', 'Renderbuffer']) {
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
      function fixture(config) {
        const canvas = document.createElement('canvas'); document.body.append(canvas);
        const renderer = createSiteBackground(canvas, config);
        if (!renderer) throw new Error('Actual background WebGL renderer unavailable');
        renderer.resize(W, H, 1);
        const gl = canvas.getContext('webgl');
        return { renderer, gl, capture(options) {
          renderer.render({ time: clock, pointer: neutral, ...options });
          const raw = new Uint8Array(W * H * 4), output = new Uint8Array(raw.length);
          gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
          for (let y = 0; y < H; y++) output.set(raw.subarray((H - y - 1) * W * 4, (H - y) * W * 4), y * W * 4);
          return output;
        } };
      }
      function difference(a, b) {
        let sum = 0, squares = 0, max = 0, over2 = 0, over8 = 0, over12 = 0;
        const peaks = [], thirds = Array.from({ length: 3 }, () => ({ sum: 0, pixels: 0, over2: 0 }));
        for (let i = 0; i < a.length; i += 4) {
          let peak = 0, pixelSum = 0;
          for (let c = 0; c < 3; c++) { const d = Math.abs(a[i + c] - b[i + c]); sum += d; squares += d * d; pixelSum += d; peak = Math.max(peak, d); }
          peaks.push(peak); max = Math.max(max, peak); if (peak > 2) over2++; if (peak > 8) over8++; if (peak > 12) over12++;
          const third = thirds[Math.min(2, Math.floor(((i / 4) % W) / (W / 3)))];
          third.sum += pixelSum; third.pixels++; if (peak > 2) third.over2++;
        }
        peaks.sort((a, b) => a - b);
        return { meanRGBDelta: sum / (W * H * 3), rmsRGBDelta: Math.sqrt(squares / (W * H * 3)), maxRGBDelta: max, p99PixelDelta: peaks[Math.floor(peaks.length * .99)], fractionOver2: over2 / (W * H), fractionOver8: over8 / (W * H), fractionOver12: over12 / (W * H), verticalThirds: thirds.map(part => ({ meanRGBDelta: part.sum / (part.pixels * 3), fractionOver2: part.over2 / part.pixels })) };
      }
      function registration(reference, changed) {
        const minimumOverlap = .4;
        const sampleStep = 8;
        // With at least 40% overlap, no valid shift can exceed 60% of either
        // dimension. Search that entire feasible region, not a smaller window.
        const maxShiftX = Math.floor((1 - minimumOverlap) * W);
        const maxShiftY = Math.floor((1 - minimumOverlap) * H);
        const unshiftedPixelDelta = new Uint16Array(W * H);
        for (let i = 0; i < reference.length; i += 4) unshiftedPixelDelta[i / 4] = Math.abs(changed[i] - reference[i]) + Math.abs(changed[i + 1] - reference[i + 1]) + Math.abs(changed[i + 2] - reference[i + 2]);
        function error(dx, dy) {
          let sum = 0, unshiftedSum = 0, samples = 0;
          // Evaluate all pixels shared by the translated images. The unshifted
          // control uses that exact overlap, and at least 40% must remain visible.
          const x0 = Math.max(0, -dx), x1 = Math.min(W, W - dx);
          const y0 = Math.max(0, -dy), y1 = Math.min(H, H - dy);
          const overlapFraction = (x1 - x0) * (y1 - y0) / (W * H);
          if (overlapFraction < minimumOverlap) return null;
          for (let y = y0; y < y1; y += sampleStep) for (let x = x0; x < x1; x += sampleStep) {
            const a = (y * W + x) * 4, b = ((y + dy) * W + x + dx) * 4;
            sum += Math.abs(changed[a] - reference[b]) + Math.abs(changed[a + 1] - reference[b + 1]) + Math.abs(changed[a + 2] - reference[b + 2]);
            unshiftedSum += unshiftedPixelDelta[a / 4];
            samples++;
          }
          return { meanRGBDelta: sum / (samples * 3), unshiftedMeanOnSameOverlap: unshiftedSum / (samples * 3), overlapFraction, samples, dx, dy };
        }
        const unshifted = error(0, 0);
        const fraction = candidate => candidate.meanRGBDelta / Math.max(.001, candidate.unshiftedMeanOnSameOverlap);
        let best = unshifted, minimumFractionPose = unshifted, admissibleTranslations = 0;
        // Exhaustive integer translations; pixel errors use the declared sparse
        // grid. Track both minima because the control varies with image overlap.
        for (let dy = -maxShiftY; dy <= maxShiftY; dy++) for (let dx = -maxShiftX; dx <= maxShiftX; dx++) {
          const candidate = error(dx, dy);
          if (!candidate) continue;
          admissibleTranslations++;
          if (candidate.meanRGBDelta < best.meanRGBDelta) best = candidate;
          if (fraction(candidate) < fraction(minimumFractionPose)) minimumFractionPose = candidate;
        }
        const atSearchBoundary = Math.abs(best.dx) === maxShiftX || Math.abs(best.dy) === maxShiftY;
        const atMinimumOverlapBoundary = (W - Math.abs(best.dx) - 1) * (H - Math.abs(best.dy)) / (W * H) < minimumOverlap || (W - Math.abs(best.dx)) * (H - Math.abs(best.dy) - 1) / (W * H) < minimumOverlap;
        return { unshifted, best, atSearchBoundary, atMinimumOverlapBoundary, residualFraction: fraction(minimumFractionPose), minimumFractionPose, residualFractionAtBestMAE: fraction(best), search: { x: [-maxShiftX, maxShiftX], y: [-maxShiftY, maxShiftY], minimumOverlap, translationStep: 1, exhaustiveIntegerTranslations: true, admissibleTranslations, sampleStep, interpretation: 'Every admissible integer translation, with RGB error measured on an 8px grid within its overlap. Natural domain boundaries are metadata.' } };
      }
      const linear = value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
      const luminance = rgb => .2126 * linear(rgb[0]) + .7152 * linear(rgb[1]) + .0722 * linear(rgb[2]);
      const spectrum = { minRelativeLuminance: 1, maxRelativeLuminance: 0, sampledPixels: 0 };
      const palette = { pixels: 0, nearWhite: 0, nearBlack: 0, nearIce: 0, blue: 0, warm: 0 };
      function paletteStats(pixels) {
        const result = { pixels: pixels.length / 4, nearWhite: 0, nearBlack: 0, nearIce: 0, blue: 0, warm: 0, minRelativeLuminance: 1, maxRelativeLuminance: 0 };
        for (let i = 0; i < pixels.length; i += 4) {
          const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]], [r, g, b] = rgb;
          const value = luminance(rgb);
          result.minRelativeLuminance = Math.min(result.minRelativeLuminance, value);
          result.maxRelativeLuminance = Math.max(result.maxRelativeLuminance, value);
          if (Math.min(...rgb) > 224 && Math.max(...rgb) - Math.min(...rgb) < 32) result.nearWhite++;
          if (value < .025 && Math.max(...rgb) - Math.min(...rgb) < 40) result.nearBlack++;
          if(r>200&&g>220&&b>240&&b-r>24&&b-r<48&&b-g>8&&b-g<25)result.nearIce++;
          if (b > 130 && b - r > 55 && b - g > 20) result.blue++;
          if (r - b > 8) result.warm++;
        }
        for (const key of ['nearWhite', 'nearBlack', 'nearIce', 'blue', 'warm']) result[`${key}Fraction`] = result[key] / Math.max(1, result.pixels);
        return result;
      }
      function observe(pixels) {
        const stats = paletteStats(pixels);
        for (const key of ['pixels', 'nearWhite', 'nearBlack', 'nearIce', 'blue', 'warm']) palette[key] += stats[key];
        spectrum.minRelativeLuminance = Math.min(spectrum.minRelativeLuminance, stats.minRelativeLuminance);
        spectrum.maxRelativeLuminance = Math.max(spectrum.maxRelativeLuminance, stats.maxRelativeLuminance);
        spectrum.sampledPixels += stats.pixels;
      }
      const normal = fixture(settings), checks = {}, observations = {};
      const extension = normal.gl.getExtension('WEBGL_debug_renderer_info');
      const implementation = { renderer: normal.gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : normal.gl.RENDERER), version: normal.gl.getParameter(normal.gl.VERSION) };
      for (const [name, mode] of Object.entries(modes)) {
        const frames = times.map(time => { const frame = normal.capture({ ...mode, time }); observe(frame); return frame; });
        const autonomous = times.slice(1).map((time, index) => ({ time, ...difference(frames[index + 1], frames[0]) }));
        const fixed = normal.capture(mode), parked = normal.capture({ ...mode, pointer: pointer(.7, -.4, { active: 0, trailX: -.5, trailY: .5, vx: 2, vy: -2 }) });
        const repeats = difference(normal.capture(mode), fixed), inactiveCoordinates = difference(parked, fixed);
        const adjacent = times.map(time => ({ time, ...difference(normal.capture({ ...mode, time: time + 1 / 30 }), frames[times.indexOf(time)]) }));
        for (const pose of [left, right, moving]) observe(normal.capture({ ...mode, pointer: pose }));
        observations[name] = { autonomous, repeats, inactiveCoordinates, adjacent };
        checks[`${name}StationaryAutoFlowAtSampledTimes`] = autonomous.every(frame => frame.meanRGBDelta > .1 && frame.fractionOver2 > .01);
        checks[`${name}ExactRepeat`] = repeats.maxRGBDelta === 0;
        checks[`${name}InactiveCoordinatesNeutral`] = inactiveCoordinates.maxRGBDelta === 0;
        checks[`${name}BoundedSampledAdjacentFrames`] = adjacent.every(frame => frame.meanRGBDelta < 4 && frame.p99PixelDelta < 24);
      }
      const legacyInvariance = [
        { time: 0, pointer: neutral }, { time: clock, pointer: right }, { time: 5, pointer: moving },
      ].map(state => {
        const reference = normal.capture(state);
        return { state, variants: Object.fromEntries(Object.entries(legacyModes).map(([name, flags]) => [name, difference(normal.capture({ ...state, ...flags }), reference)])) };
      });
      checks.legacySceneFlagsKeepSharedOutput = legacyInvariance.every(state => Object.values(state.variants).every(diff => diff.maxRGBDelta === 0));
      const grainStates = [{ time: 3, pointer: neutral }, { time: 5, pointer: neutral }, { time: 3, pointer: right }];
      const withGrain = grainStates.map(options => normal.capture(options));
      const normalError = normal.gl.getError(); normal.renderer.dispose();
      const normalDisposed = normal.gl.isContextLost();

      // Grain-free frames prevent fixed screen noise from manufacturing a false
      // residual when testing whether the composition merely translates.
      const field = fixture({ ...settings, grain: 0 }), shape = {};
      for (const [name, mode] of Object.entries(modes)) {
        const a = field.capture({ ...mode, pointer: left }), b = field.capture({ ...mode, pointer: right });
        const horizontal = difference(b, a);
        const upFrame = field.capture({ ...mode, pointer: up }), downFrame = field.capture({ ...mode, pointer: down });
        const vertical = difference(downFrame, upFrame);
        const coverage = { left: paletteStats(a), right: paletteStats(b), up: paletteStats(upFrame), down: paletteStats(downFrame) };
        const iceCoverageDelta = coverage.right.nearIceFraction - coverage.left.nearIceFraction;
        const bestTranslation = registration(a, b);
        const settled = field.capture({ ...mode, pointer: right });
        const trailResponse = difference(field.capture({ ...mode, pointer: moving }), settled);
        const velocityResponse = difference(field.capture({ ...mode, pointer: velocityOnly }), settled);
        shape[name] = { horizontal, vertical, bestTranslation, trailResponse, velocityResponse, coverage, iceCoverageDelta };
        checks[`${name}PointerMateriallyChangesIceArea`] = iceCoverageDelta >= .20 && coverage.right.nearIceFraction > .40;
        const minimum = 1;
        checks[`${name}DirectionChangesRenderedField`] = horizontal.meanRGBDelta > minimum && vertical.meanRGBDelta > minimum;
        checks[`${name}BroadResponseAcrossViewport`] = horizontal.verticalThirds.every(part => part.meanRGBDelta > minimum / 2);
        checks[`${name}ShapeChangesBeyondBestTranslation`] = bestTranslation.best.meanRGBDelta > minimum / 2 && bestTranslation.residualFraction > .15;
        checks[`${name}TrailAndVelocityAffectSameEndpoint`] = trailResponse.meanRGBDelta > minimum / 2 && velocityResponse.meanRGBDelta > .01;
      }
      // Identical final kinematics and clock isolate actual path memory from
      // endpoint, pointer lag, velocity, grain or the autonomous time field.
      function closedPathHistory(direction) {
        let history = createBackgroundMotion(), previous = { x: 0, y: 0 };
        function advance(x, y) {
          history = stepBackgroundMotion(history, { x, y, dx: x - previous.x, dy: y - previous.y, active: 1 }, 1 / 60, settings);
          previous = { x, y };
        }
        advance(.68, 0);
        for (let i = 1; i <= 120; i++) {
          const angle = direction * i / 120 * Math.PI * 2;
          advance(.68 * Math.cos(angle), .52 * Math.sin(angle));
        }
        advance(0, 0);
        for (let i = 0; i < 12; i++) advance(0, 0);
        return history;
      }
      const sharedHistoryPointer = pointer(0, 0);
      const forwardHistory = closedPathHistory(1), reverseHistory = closedPathHistory(-1), replayHistory = closedPathHistory(1);
      const historyFrame = history => field.capture({ time: clock, pointer: sharedHistoryPointer, history });
      const forwardFrame = historyFrame(forwardHistory), reverseFrame = historyFrame(reverseHistory);
      const differentPaths = difference(forwardFrame, reverseFrame);
      const replayPixels = difference(forwardFrame, historyFrame(replayHistory));
      const neutralHistoryFrame = historyFrame(createBackgroundMotion());
      historyFrame(reverseHistory);
      const omittedResetsHistory = difference(neutralHistoryFrame, field.capture({ time: clock, pointer: sharedHistoryPointer }));
      const historyObservation = { time: clock, pointer: sharedHistoryPointer, path: { ellipseRadii: [.68, .52], loopSteps: 120, settleSteps: 12, secondsPerStep: 1 / 60, sameEndpoint: [0, 0] }, states: { forward: forwardHistory, reverse: reverseHistory, replay: replayHistory }, differentPaths, replayPixels, omittedResetsHistory };
      checks.pathMemoryChangesPixelsWithIdenticalInstantInputs = differentPaths.meanRGBDelta > 1 && differentPaths.fractionOver2 > .05;
      checks.pathMemoryReplayIsDeterministic = JSON.stringify(forwardHistory) === JSON.stringify(replayHistory) && replayPixels.maxRGBDelta === 0;
      checks.omittedHistoryRestoresNeutralField = omittedResetsHistory.maxRGBDelta === 0;
      const withoutGrain = grainStates.map(options => field.capture(options));
      const grain = { samples: 0, sum: 0, squares: 0, absolute: 0, over2: 0, maxChannelSpread: 0, maxStateResidualDifference: 0 };
      for (let i = 0; i < withGrain[0].length; i += 4) {
        // Ice blue can clip the blue channel. Compare at least two channels
        // that remain unclamped in every state, preserving the achromatic test.
        const channels=[0,1,2].filter(c=>withoutGrain.every(frame=>frame[i+c]>=16&&frame[i+c]<=239));
        if(channels.length<2)continue;
        const residuals = withGrain.map((frame, state) => channels.map(c => frame[i + c] - withoutGrain[state][i + c]));
        const d = residuals[0][0]; grain.samples++; grain.sum += d; grain.squares += d * d; grain.absolute += Math.abs(d); if (Math.abs(d) > 2) grain.over2++;
        for (const residual of residuals) grain.maxChannelSpread = Math.max(grain.maxChannelSpread, Math.max(...residual) - Math.min(...residual));
        for (let state = 1; state < residuals.length; state++) for (let c = 0; c < channels.length; c++) grain.maxStateResidualDifference = Math.max(grain.maxStateResidualDifference, Math.abs(residuals[state][c] - residuals[0][c]));
      }
      grain.mean = grain.sum / Math.max(1, grain.samples); grain.standardDeviation = Math.sqrt(grain.squares / Math.max(1, grain.samples) - grain.mean ** 2); grain.meanAbsolute = grain.absolute / Math.max(1, grain.samples); grain.fractionOver2 = grain.over2 / Math.max(1, grain.samples);
      grain.configuredAmplitude = settings.grain;
      grain.expectedStandardDeviation = grain.configuredAmplitude * 255 / Math.sqrt(12);
      // Difference of two quantized framebuffer values adds a small error to
      // the continuous uniform-noise model. Visibility remains an independent gate.
      grain.standardDeviationTolerance = Math.max(.65, grain.expectedStandardDeviation * .2);
      for (const key of ['nearWhite', 'nearBlack', 'nearIce', 'blue', 'warm']) palette[`${key}Fraction`] = palette[key] / Math.max(1, palette.pixels);
      const fieldError = field.gl.getError(); field.renderer.dispose();
      checks.sampledWhiteIceBluePalette = palette.nearWhiteFraction > .01 && palette.nearIceFraction > .10 && palette.nearBlackFraction === 0 && palette.blueFraction > .05 && palette.warmFraction < .001;
      checks.sampledLightReadableLuminanceRange = spectrum.minRelativeLuminance > .20 && spectrum.maxRelativeLuminance > .85 && spectrum.maxRelativeLuminance-spectrum.minRelativeLuminance>.25;
      checks.visibleAchromaticGrain = grain.samples > 1000 && Math.abs(grain.standardDeviation - grain.expectedStandardDeviation) <= grain.standardDeviationTolerance && grain.standardDeviation > 1 && grain.meanAbsolute > 1 && grain.fractionOver2 > .1 && grain.maxChannelSpread <= 1;
      checks.grainIsStaticAcrossTimeAndPointer = grain.maxStateResidualDifference <= 1;
      checks.noGLErrors = normalError === 0 && fieldError === 0;
      checks.contextsDisposed = normalDisposed && field.gl.isContextLost();
      checks.resourcesReleased = Object.keys(ledger.created).every(type => ledger.created[type] === ledger.deleted[type]);
      return { fixture: { size: [W, H], fixedClock: clock, times, adjacentInterval: 1 / 30, paletteThresholds: { nearBlack: 'relative luminance < .025 and RGB spread < 40', nearWhite: 'all RGB channels > 224 and spread < 32', cobalt: 'B > 130, B-R > 55, B-G > 20', minimumIcePointerAreaChange: .20, ice: 'R > 200, G > 220, B > 240; B-R 24..48 and B-G 8..25' }, pointers: { neutral, left, right, up, down, moving, velocityOnly }, interpretation: 'Sampled framebuffer observations only; no all-time contrast, motion, or flash-safety guarantee. Legacy scene flags must be identical for the one continuous scene. Foreground contrast over local UI surfaces requires application verification. Controller event wiring and inertial decay require application verification.' }, implementation, legacyInvariance, observations, shape, historyObservation, palette, grain, spectrum, ledger, checks, passed: Object.values(checks).every(Boolean) };
    });
    result.pageErrors = pageErrors;
    if (pageErrors.length) result.passed = false;
    await context.close();
  } finally { await browser.close(); }
  result.sourceHashes = Object.fromEntries(names.map(name => [name, crypto.createHash('sha256').update(sources[name]).digest('hex')]));
  await fs.writeFile(artifact, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, artifact, checks: result.checks, implementation: result.implementation }));
  if (!result.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
