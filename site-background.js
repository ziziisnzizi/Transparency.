// Original procedural artwork. Only the supplied decorative canvas is drawn;
// this renderer has no events, animation loop, DOM/image capture or I/O.
const DEFAULTS = {
  palette: { white: '#f7fbff', sky: '#acdfff', blue: '#3574e8', navy: '#10244f', black: '#030811' },
  timeScale: .12, rotation: -.55, distortion: .68, grain: .045, grainCellSize: 1.3, pointerRadius: 1.05, pointerPush: .38,
  maxPixelRatio: 1.5, pixelBudget: 1800000,
  outputMaxPixelRatio: 3, outputPixelBudget: 8400000,
};
const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function rgb(value, fallback) {
  let hex = typeof value === 'string' ? value.trim().replace(/^#/, '') : '';
  if (/^[\da-f]{3}$/i.test(hex)) hex = [...hex].map(channel => channel + channel).join('');
  if (!/^[\da-f]{6}$/i.test(hex)) hex = fallback.slice(1);
  return [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

const vertexSource = `
attribute vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;

const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 resolution;
uniform vec2 viewport;
uniform vec2 pointer;
uniform vec2 pointerTrail;
uniform vec2 pointerVelocity;
uniform vec4 motionHistory;
uniform float clock;
uniform float timeScale;
uniform float rotation;
uniform float distortion;
uniform vec3 ink;
uniform vec3 white;
uniform vec3 sky;
uniform vec3 blue;
uniform float pointerActive;
uniform float pointerRadius;
uniform float pointerPush;
uniform vec3 navy;

float latticeHash(vec2 cell){
 vec2 q=fract(cell*vec2(.07173,.10917)+vec2(.413,.173));
 q+=dot(q,q.yx+vec2(19.19,23.73));
 return fract(q.x*q.y*(q.x+q.y));
}
float latticeNoise(vec2 p){
 vec2 cell=floor(p);
 vec2 f=fract(p);
 vec2 u=f*f*(3.-2.*f);
 float a=latticeHash(cell);
 float b=latticeHash(cell+vec2(1.,0.));
 float c=latticeHash(cell+vec2(0.,1.));
 float d=latticeHash(cell+vec2(1.,1.));
 return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
vec2 rotatePoint(vec2 p,float angle){
 float c=cos(angle),s=sin(angle);
 return vec2(c*p.x-s*p.y,s*p.x+c*p.y);
}
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 float aspect=viewport.x/max(viewport.y,1.);
 float t=clock*timeScale;
 vec2 memory=motionHistory.xy;
 float circulation=motionHistory.z;
 float memoryWave=sin(motionHistory.w);
 float memoryTurn=cos(motionHistory.w)-1.;
 // The supplied reference bends the whole colour field, rather than making
 // a small cursor bubble. A slower trail and velocity create a broad inertial sweep.
 vec2 drag=vec2(pointerTrail.x,-pointerTrail.y)*pointerActive;
 vec2 velocity=vec2(pointerVelocity.x,-pointerVelocity.y)*pointerActive;
 float gesture=clamp(pointerPush/.30,0.,2.);
 float seed=sin(t*.23)*.13+drag.y*.42*gesture+memory.y*.65+circulation*.24+memoryWave*.18;
 float amount=distortion*.52;
 vec2 cursor=vec2(pointer.x*.5+.5,.5-pointer.y*.5);
 vec2 delta=(uv-cursor)*vec2(aspect,1.);
 float radius=max(pointerRadius,.025);
 // Long-range attraction/repulsion bends overlapping streams across the whole
 // viewport. There is no hard influence disc or tiny cursor bubble.
 float distanceToPointer=length(delta);
 float influence=1./(1.+dot(delta,delta)/(radius*radius*1.8));
 vec2 radial=delta/max(distanceToPointer+.25,.25);
 vec2 tangent=vec2(-delta.y,delta.x)/max(distanceToPointer+.40,.40);
 float curl=clamp(velocity.x*.22-velocity.y*.16+drag.x*.12,-.7,.7);
 vec2 gravity=(radial*.48+tangent*curl*.24)*influence*pointerPush*pointerActive;
 vec2 pushed=uv-gravity/vec2(max(aspect,.25),1.);
 vec2 centre=uv-.5;
 pushed+=memory*.20*(1.-dot(centre,centre)*.30)+vec2(-centre.y,centre.x)*circulation*.12;
 vec2 base=(pushed-.5)*vec2(clamp(aspect,.65,1.7),1.)*.80;
 base+=vec2(seed*.73,-seed*1.31);
 vec2 first=vec2(
  latticeNoise(base+vec2(t*.16,-t*.12)),
  latticeNoise(base+vec2(4.93-t*.10,7.17+t*.15))
 )*2.-1.;
 vec2 second=vec2(
  latticeNoise(base*1.08+first*1.15+vec2(9.21+t*.12,2.73)),
  latticeNoise(base*1.08+first*1.15+vec2(-3.67,11.83-t*.14))
 )*2.-1.;
 vec2 warped=pushed+(first*.42+second*.58)*amount*.30;

 // A cohesive S-shaped diagonal fold. Whole-field bend and tilt respond to the
 // pointer; the autonomous phase continues when the pointer stops moving.
 float angle=rotation+sin(t*.25)*.20+(drag.x*.30+velocity.x*.025)*gesture+circulation*.34+memoryWave*.10;
 vec2 bandPoint=rotatePoint((warped-.5)*vec2(.96,1.04),angle);
 float curve=bandPoint.y+sin(bandPoint.x*2.6+t*.32+drag.y*.50*gesture)*(.17+drag.x*.035*gesture);
 curve+=sin(t*.50)*.22+(drag.x*.18+drag.y*.22+velocity.y*.025)*gesture;
 curve+=memory.y*.18+memoryWave*.16+memoryTurn*.055;
 float band=.5+curve;
 float shoulder=exp(-pow((curve-.04)/.17,2.));
 float crest=exp(-pow((curve-.075)/.10,2.));
 // Broad white and saturated blue streams share one continuous global canvas.
 float secondCurve=bandPoint.y*.90-bandPoint.x*.24+cos(bandPoint.x*1.9-t*.26+drag.x*.42)*.22-.31+(drag.y*.075-drag.x*.10)*gesture;
 secondCurve+=memory.x*.16-circulation*.10+memoryWave*.12;
 float firstStream=exp(-pow((curve-.015)/.27,2.));
 float secondStream=exp(-pow((secondCurve+.11)/.37,2.));
 vec3 color=mix(white,sky,clamp(firstStream*.68+secondStream*.42,0.,.94));
 color=mix(color,blue,clamp(firstStream*.38+secondStream*.55+firstStream*secondStream*.15,0.,.94));
 color=mix(color,white,crest*.92);

 // Cursor position changes occupied area, not merely the angle of a pale
 // wash. At one end the black retreats offscreen; at the other it dominates
 // the centre/right. The shared composition keeps moving between gestures.
 float dominance=clamp(.50+drag.x*.56*gesture+drag.y*.12*gesture+sin(t*.27)*.14+memory.x*.18+circulation*.10+memoryWave*.12,0.,1.);
 vec2 rightCentre=vec2(mix(1.36,.59,dominance)+sin(t*.39)*.045,.52+cos(t*.26)*.07+drag.y*.10);
 vec2 topCentre=vec2(.28+sin(t*.31)*.12+drag.x*.12,mix(1.36,1.10,dominance)+drag.y*.07);
 vec2 rightSize=vec2(mix(.52,.72,dominance),mix(.46,.66,dominance));
 vec2 topSize=vec2(mix(.64,.84,dominance),mix(.34,.48,dominance));
 vec2 lobePoint=warped+first*.025;
 vec2 rightShape=rotatePoint(lobePoint-rightCentre,-.12+drag.y*.12)/rightSize;
 vec2 topShape=rotatePoint(lobePoint-topCentre,.12+drag.x*.10)/topSize;
 float rightLobe=1.-smoothstep(.35,1.10,length(rightShape));
 float topLobe=1.-smoothstep(.35,1.10,length(topShape));
 float pocket=max(rightLobe,topLobe);
 color=mix(color,ink,pocket*.999);
 // No exposure lift, whitening veil or page/theme-dependent palette. Native
 // foreground glass and local scrims provide legibility above the artwork.

 // Render only the smooth colour field here. Grain belongs to the final,
 // high-resolution pass, so a lower scene budget never enlarges its pixels.
 gl_FragColor=vec4(clamp(color,0.,1.),1.);
}`;

const compositeSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D field;
uniform vec2 resolution;
uniform float grainStrength;
uniform float grainCellSize;
float filmHash(vec2 cell){
 vec2 q=fract(cell*vec2(.07173,.10917)+vec2(.413,.173));
 q+=dot(q,q.yx+vec2(19.19,23.73));
 return fract(q.x*q.y*(q.x+q.y));
}
void main(){
 vec3 color=texture2D(field,gl_FragCoord.xy/resolution).rgb;
 // Slightly enlarged final-output grain cells, independent of scene resolution.
 // The hash is static: no time or pointer input can make the texture shimmer.
 vec2 pixel=floor(gl_FragCoord.xy/max(grainCellSize,.5));
 float grain=(filmHash(pixel+vec2(31.7,19.3))-.5)*grainStrength;
 vec3 finalColor=clamp(color+vec3(grain),0.,1.);
 gl_FragColor=vec4(finalColor,1.);
}`;

export function createSiteBackground(canvas, background = {}) {
  const source = background && typeof background === 'object' ? background : {};
  const palette = source.palette && typeof source.palette === 'object' ? source.palette : {};
  const settings = {
    timeScale: clamp(finite(source.timeScale, DEFAULTS.timeScale), 0, 1),
    rotation: finite(source.rotation, DEFAULTS.rotation),
    distortion: clamp(finite(source.distortion, DEFAULTS.distortion), 0, 2),
    grain: clamp(finite(source.grain, DEFAULTS.grain), 0, .20),
    grainCellSize: clamp(finite(source.grainCellSize, DEFAULTS.grainCellSize), .5, 4),
    pointerRadius: clamp(finite(source.pointerRadius, DEFAULTS.pointerRadius), .04, 1.5),
    pointerPush: clamp(finite(source.pointerPush, DEFAULTS.pointerPush), 0, .6),
    maxPixelRatio: clamp(finite(source.maxPixelRatio, DEFAULTS.maxPixelRatio), .5, 3),
    pixelBudget: clamp(finite(source.pixelBudget, DEFAULTS.pixelBudget), 100000, 8000000),
    outputMaxPixelRatio: clamp(finite(source.outputMaxPixelRatio, DEFAULTS.outputMaxPixelRatio), 1, 3),
    outputPixelBudget: clamp(finite(source.outputPixelBudget, DEFAULTS.outputPixelBudget), 100000, 16000000),
  };
  let gl, buffer, texture, framebuffer, disposed = false;
  let width = 1, height = 1, fieldWidth = 1, fieldHeight = 1;
  const shaders = [], programs = [];
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (gl) {
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      if (texture) gl.deleteTexture(texture);
      if (buffer) gl.deleteBuffer(buffer);
      programs.forEach(program => gl.deleteProgram(program));
      shaders.forEach(shader => gl.deleteShader(shader));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    canvas.width = canvas.height = 1;
  }
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const compile = (type, text) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Background shader allocation failed');
      shaders.push(shader);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Background shader compilation failed');
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const link = fragment => {
      const program = gl.createProgram();
      if (!program) throw new Error('Background program allocation failed');
      programs.push(program);
      gl.attachShader(program, vertex);
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Background program linking failed');
      return { program, attribute: gl.getAttribLocation(program, 'position') };
    };
    const scene = link(fragmentSource), composite = link(compositeSource);
    buffer = gl.createBuffer(); texture = gl.createTexture(); framebuffer = gl.createFramebuffer();
    if (!buffer || !texture || !framebuffer) throw new Error('Background target allocation failed');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    function bindQuad(pass) {
      gl.useProgram(pass.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(pass.attribute);
      gl.vertexAttribPointer(pass.attribute, 2, gl.FLOAT, false, 0, 0);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    function allocateField(w, h) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (complete) { fieldWidth = w; fieldHeight = h; }
      return complete;
    }
    if (!allocateField(1, 1)) throw new Error('Background framebuffer unavailable');
    const names = ['resolution', 'viewport', 'pointer', 'pointerTrail', 'pointerVelocity', 'motionHistory', 'clock', 'timeScale', 'rotation', 'distortion', 'ink', 'white', 'sky', 'blue', 'navy', 'pointerActive', 'pointerRadius', 'pointerPush'];
    const uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(scene.program, name)]));
    const finalUniforms = Object.fromEntries(['field', 'resolution', 'grainStrength', 'grainCellSize'].map(name => [name, gl.getUniformLocation(composite.program, name)]));
    bindQuad(scene);
    for (const [uniform, key] of [['ink', 'black'], ['white', 'white'], ['sky', 'sky'], ['blue', 'blue'], ['navy', 'navy']]) gl.uniform3fv(uniforms[uniform], rgb(palette[key], DEFAULTS.palette[key]));
    for (const [uniform, value] of [['timeScale', settings.timeScale], ['rotation', settings.rotation], ['distortion', settings.distortion], ['pointerRadius', settings.pointerRadius], ['pointerPush', settings.pointerPush]]) gl.uniform1f(uniforms[uniform], value);
    bindQuad(composite);
    gl.uniform1i(finalUniforms.field, 0);
    gl.uniform1f(finalUniforms.grainStrength, settings.grain);
    gl.uniform1f(finalUniforms.grainCellSize, settings.grainCellSize);
    const viewportLimit = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const maxWidth = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), viewportLimit[0]);
    const maxHeight = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), viewportLimit[1]);
    return {
      canvas,
      resize(nextWidth, nextHeight, dpr = 1) {
        if (disposed || gl.isContextLost()) return false;
        width = Math.max(1, finite(nextWidth, 1)); height = Math.max(1, finite(nextHeight, 1));
        const requested = Math.max(.25, finite(dpr, 1));
        const hardwareRatio = Math.min(maxWidth / width, maxHeight / height);
        const outputRatio = Math.min(requested, settings.outputMaxPixelRatio, Math.sqrt(settings.outputPixelBudget / (width * height)), hardwareRatio);
        const fieldRatio = Math.min(requested, settings.maxPixelRatio, Math.sqrt(settings.pixelBudget / (width * height)), hardwareRatio, outputRatio);
        const nextWidthPixels = Math.max(1, Math.floor(width * outputRatio)), nextHeightPixels = Math.max(1, Math.floor(height * outputRatio));
        const nextFieldWidth = Math.max(1, Math.floor(width * fieldRatio)), nextFieldHeight = Math.max(1, Math.floor(height * fieldRatio));
        if (canvas.width !== nextWidthPixels) canvas.width = nextWidthPixels;
        if (canvas.height !== nextHeightPixels) canvas.height = nextHeightPixels;
        if ((nextFieldWidth !== fieldWidth || nextFieldHeight !== fieldHeight) && !allocateField(nextFieldWidth, nextFieldHeight)) return false;
        return true;
      },
      render({ time = 0, pointer = { x: 0, y: 0, active: 0 }, history = {}, dark = false, poster = false } = {}) {
        if (disposed || gl.isContextLost()) return;
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.viewport(0, 0, fieldWidth, fieldHeight);
        // Never sample from the texture currently attached to the draw target.
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
        bindQuad(scene);
        gl.uniform2f(uniforms.resolution, fieldWidth, fieldHeight);
        gl.uniform2f(uniforms.viewport, width, height);
        gl.uniform2f(uniforms.pointer, clamp(finite(pointer?.x, 0), -1, 1), clamp(finite(pointer?.y, 0), -1, 1));
        gl.uniform2f(uniforms.pointerTrail, clamp(finite(pointer?.trailX, finite(pointer?.x, 0)), -1, 1), clamp(finite(pointer?.trailY, finite(pointer?.y, 0)), -1, 1));
        gl.uniform2f(uniforms.pointerVelocity, clamp(finite(pointer?.vx, 0), -2.5, 2.5), clamp(finite(pointer?.vy, 0), -2.5, 2.5));
        gl.uniform4f(uniforms.motionHistory, clamp(finite(history?.x, 0), -.55, .55), -clamp(finite(history?.y, 0), -.55, .55), clamp(finite(history?.spin, 0), -1.1, 1.1), clamp(finite(history?.phase, 0), -Math.PI, Math.PI));
        gl.uniform1f(uniforms.clock, Math.max(0, finite(time, 0)));
        gl.uniform1f(uniforms.pointerActive, clamp(finite(pointer?.active, 0), 0, 1));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        bindQuad(composite);
        gl.uniform2f(finalUniforms.resolution, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      sample(points) {
        if (disposed || gl.isContextLost()) return null;
        const previous = gl.getParameter(gl.FRAMEBUFFER_BINDING);
        const pixel = new Uint8Array(4), colors = [];
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        for (const [x, y] of points) {
          const sx = Math.min(fieldWidth - 1, Math.max(0, Math.floor(x * fieldWidth)));
          const sy = Math.min(fieldHeight - 1, Math.max(0, Math.floor((1 - y) * fieldHeight)));
          gl.readPixels(sx, sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          colors.push([pixel[0] / 255, pixel[1] / 255, pixel[2] / 255]);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
        return colors;
      },
      dispose,
    };
  } catch { dispose(); return null; }
}
