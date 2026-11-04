// Original procedural artwork. Only the supplied decorative canvas is drawn;
// this renderer has no events, animation loop, textures, DOM capture or I/O.
const DEFAULTS = {
  palette: { white: '#f7fbff', sky: '#acdfff', blue: '#3574e8', navy: '#10244f', black: '#030811' },
  timeScale: .16, rotation: -.55, distortion: .65, grain: .10, pointerRadius: .46, pointerPush: .30,
  maxPixelRatio: 1.5, pixelBudget: 1800000,
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
uniform float clock;
uniform float timeScale;
uniform float rotation;
uniform float distortion;
uniform float grainStrength;
uniform vec3 ink;
uniform vec3 white;
uniform vec3 sky;
uniform vec3 blue;
uniform float dark;
uniform float poster;
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
 // Autonomous field evolution remains independent of the pointer. Cursor
 // movement affects only its bounded local repulsion footprint below.
 float seed=sin(t*.52)*.32;
 float amount=distortion*.90;
 // Local repulsion acts only on the decorative colour field, never the DOM.
 vec2 cursor=vec2(pointer.x*.5+.5,.5-pointer.y*.5);
 vec2 delta=(uv-cursor)*vec2(aspect,1.);
 float radius=max(pointerRadius,.025);
 float distanceToPointer=length(delta);
 float influence=1.-smoothstep(0.,radius,distanceToPointer);
 vec2 radial=delta/max(distanceToPointer+.035,.035);
 vec2 pushed=uv-radial/vec2(max(aspect,.25),1.)*influence*pointerPush*pointerActive;
 vec2 base=(pushed-.5)*vec2(max(aspect,.55),1.)*1.37;
 base+=vec2(seed*.73,-seed*1.31);
 vec2 first=vec2(
  latticeNoise(base+vec2(t*.36,-t*.27)),
  latticeNoise(base+vec2(4.93-t*.23,7.17+t*.31))
 )*2.-1.;
 vec2 second=vec2(
  latticeNoise(base*1.14+first*1.67+vec2(9.21+t*.22,2.73)),
  latticeNoise(base*1.14+first*1.67+vec2(-3.67,11.83-t*.25))
 )*2.-1.;
 vec2 warped=pushed+(first*.42+second*.58)*amount*.64;

 // A moving, bending diagonal colour field creates broad atmospheric bands.
 float angle=rotation+sin(t*.46)*.46+sin(t*.91)*.10;
 vec2 bandPoint=rotatePoint((warped-.5)*vec2(.95,1.05),angle);
 float band=.5+bandPoint.x*.94+sin(t*.78)*.30;
 vec3 color=mix(white,sky,smoothstep(.10,.51,band));
 color=mix(color,blue,smoothstep(.53,.88,band));
 color=mix(color,navy,smoothstep(.87,1.12,band));

 // This deep negative space travels from the centre towards either edge even
 // with a stationary pointer. Noise bends its boundary into an uneven cloud.
 vec2 pocketCentre=vec2(.50+sin(t*.96)*.58,.48+sin(t*.73+.15)*.30);
 vec2 pocketSize=vec2(.60+sin(t*.47)*.10,.45+cos(t*.53)*.055);
 vec2 pocketPoint=pushed+first*.075+second*.055-pocketCentre;
 pocketPoint=rotatePoint(pocketPoint,rotation*.45+t*.13);
 float distanceToPocket=length(pocketPoint/pocketSize);
 float pocket=1.-smoothstep(.20,1.12,distanceToPocket);
 pocket=smoothstep(.025,.98,pocket);
 color=mix(color,ink,pocket*.985);
 // Larger moving blue/white folds remain visible on reading pages. A light
 // floor and dark ceiling protect native text while retaining hue variation.
 float crest=1.-smoothstep(.045,.24,abs(band-.46));
 vec3 lightPage=mix(white,mix(sky,blue,smoothstep(.32,.94,band)),.12+smoothstep(.12,.86,band)*.46);
 lightPage=mix(lightPage,white,crest*.48);
 lightPage=mix(lightPage,navy,pocket*.11);
 vec3 lightLinear=pow(max(lightPage,vec3(0.)),vec3(2.2));
 vec3 whiteLinear=pow(white,vec3(2.2));
 float lightLuma=dot(lightLinear,vec3(.2126,.7152,.0722));
 float whiteLuma=dot(whiteLinear,vec3(.2126,.7152,.0722));
 float lift=clamp((.78-lightLuma)/max(whiteLuma-lightLuma,.001),0.,1.);
 lightPage=pow(mix(lightLinear,whiteLinear,lift),vec3(1./2.2));
 vec3 darkPage=mix(ink,mix(navy,blue,.70),.38+smoothstep(.10,.88,band)*.34);
 darkPage=mix(darkPage,sky,crest*.085);
 darkPage=mix(darkPage,ink,pocket*.64);
 float darkLuma=dot(pow(max(darkPage,vec3(0.)),vec3(2.2)),vec3(.2126,.7152,.0722));
 darkPage*=pow(min(1.,.095/max(darkLuma,.001)),1./2.2);
 color=mix(mix(lightPage,darkPage,dark),color,poster);

 // Static one-output-pixel grain stays visible behind native glass panels.
 // No clock, field seed or pointer enters its hash.
 vec2 pixel=floor(gl_FragCoord.xy);
 float grain=(latticeHash(pixel+vec2(31.7,19.3))-.5)*grainStrength;
 gl_FragColor=vec4(clamp(color+vec3(grain),0.,1.),1.);
}`;

export function createSiteBackground(canvas, background = {}) {
  const source = background && typeof background === 'object' ? background : {};
  const palette = source.palette && typeof source.palette === 'object' ? source.palette : {};
  const settings = {
    timeScale: clamp(finite(source.timeScale, DEFAULTS.timeScale), 0, 1),
    rotation: finite(source.rotation, DEFAULTS.rotation),
    distortion: clamp(finite(source.distortion, DEFAULTS.distortion), 0, 2),
    grain: clamp(finite(source.grain, DEFAULTS.grain), 0, .20),
    pointerRadius: clamp(finite(source.pointerRadius, DEFAULTS.pointerRadius), .04, 1),
    pointerPush: clamp(finite(source.pointerPush, DEFAULTS.pointerPush), 0, .6),
    maxPixelRatio: clamp(finite(source.maxPixelRatio, DEFAULTS.maxPixelRatio), .5, 3),
    pixelBudget: clamp(finite(source.pixelBudget, DEFAULTS.pixelBudget), 100000, 8000000),
  };
  let gl, program, buffer, vertexShader, fragmentShader, disposed = false;
  let width = 1, height = 1;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (gl) {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    canvas.width = canvas.height = 1;
  }
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const compile = (type, text) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      return shader;
    };
    vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
    fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS) || !gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      dispose(); return null;
    }
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { dispose(); return null; }
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    const names = ['resolution', 'viewport', 'pointer', 'clock', 'timeScale', 'rotation', 'distortion', 'grainStrength', 'ink', 'white', 'sky', 'blue', 'navy', 'dark', 'poster', 'pointerActive', 'pointerRadius', 'pointerPush'];
    const uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
    for (const [uniform, key] of [['ink', 'black'], ['white', 'white'], ['sky', 'sky'], ['blue', 'blue'], ['navy', 'navy']]) {
      gl.uniform3fv(uniforms[uniform], rgb(palette[key], DEFAULTS.palette[key]));
    }
    gl.uniform1f(uniforms.timeScale, settings.timeScale);
    gl.uniform1f(uniforms.rotation, settings.rotation);
    gl.uniform1f(uniforms.distortion, settings.distortion);
    gl.uniform1f(uniforms.grainStrength, settings.grain);
    gl.uniform1f(uniforms.pointerRadius, settings.pointerRadius);
    gl.uniform1f(uniforms.pointerPush, settings.pointerPush);
    return {
      canvas,
      resize(nextWidth, nextHeight, dpr = 1) {
        if (disposed || gl.isContextLost()) return;
        width = Math.max(1, finite(nextWidth, 1));
        height = Math.max(1, finite(nextHeight, 1));
        const ratio = Math.min(Math.max(.25, finite(dpr, 1)), settings.maxPixelRatio, Math.sqrt(settings.pixelBudget / (width * height)));
        const nextW = Math.max(1, Math.floor(width * ratio));
        const nextH = Math.max(1, Math.floor(height * ratio));
        if (canvas.width !== nextW) canvas.width = nextW;
        if (canvas.height !== nextH) canvas.height = nextH;
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      render({ time = 0, pointer = { x: 0, y: 0, active: 0 }, dark = false, poster = false } = {}) {
        if (disposed || gl.isContextLost()) return;
        gl.useProgram(program);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.viewport, width, height);
        gl.uniform2f(uniforms.pointer, clamp(finite(pointer?.x, 0), -1, 1), clamp(finite(pointer?.y, 0), -1, 1));
        gl.uniform1f(uniforms.clock, Math.max(0, finite(time, 0)));
        gl.uniform1f(uniforms.dark, Number(Boolean(dark)));
        gl.uniform1f(uniforms.poster, Number(Boolean(poster)));
        gl.uniform1f(uniforms.pointerActive, clamp(finite(pointer?.active, 0), 0, 1));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      dispose,
    };
  } catch { dispose(); return null; }
}
