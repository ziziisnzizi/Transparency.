// Original procedural artwork. Only the supplied decorative canvas is drawn;
// this renderer has no events, animation loop, textures, DOM capture or I/O.
const DEFAULTS = {
  palette: { black: '#030407', orange: '#ad593a', teal: '#c2dbd5', cobalt: '#244bc3', navy: '#111c42' },
  timeScale: .07, rotation: -.55, distortion: .65, grain: .035,
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
uniform vec3 orange;
uniform vec3 teal;
uniform vec3 cobalt;
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
 // The pointer changes field parameters; it never merely translates the art.
 float seed=pointer.y*.95+sin(t*.37)*.21;
 float displacement=(pointer.x+1.)*2.5;
 float amount=distortion*(.15+displacement*.17);
 vec2 base=(uv-.5)*vec2(max(aspect,.55),1.)*1.37;
 base+=vec2(seed*.73,-seed*1.31);
 vec2 first=vec2(
  latticeNoise(base+vec2(t*.21,-t*.16)),
  latticeNoise(base+vec2(4.93-t*.13,7.17+t*.19))
 )*2.-1.;
 vec2 second=vec2(
  latticeNoise(base*1.14+first*1.67+vec2(9.21+t*.12,2.73)),
  latticeNoise(base*1.14+first*1.67+vec2(-3.67,11.83-t*.15))
 )*2.-1.;
 vec2 warped=uv+(first*.42+second*.58)*amount*.54;

 // A moving, bending diagonal colour field creates broad atmospheric bands.
 float angle=rotation+sin(t*.46)*.34+sin(t*.91)*.08;
 vec2 bandPoint=rotatePoint((warped-.5)*vec2(.95,1.05),angle);
 float band=.5+bandPoint.x*.94+sin(t*.58)*.15;
 vec3 color=mix(orange,teal,smoothstep(.10,.51,band));
 color=mix(color,cobalt,smoothstep(.53,.88,band));
 color=mix(color,navy,smoothstep(.87,1.12,band));

 // This deep negative space travels from the centre towards either edge even
 // with a stationary pointer. Noise bends its boundary into an uneven cloud.
 vec2 pocketCentre=vec2(.50+sin(t*.82)*.53,.48+sin(t*.61+.15)*.28);
 vec2 pocketSize=vec2(.60+sin(t*.47)*.10,.45+cos(t*.53)*.055);
 vec2 pocketPoint=uv+first*.075+second*.055-pocketCentre;
 pocketPoint=rotatePoint(pocketPoint,rotation*.45+t*.13);
 float distanceToPocket=length(pocketPoint/pocketSize);
 float pocket=1.-smoothstep(.20,1.12,distanceToPocket);
 pocket=smoothstep(.025,.98,pocket);
 color=mix(color,ink,pocket*.985);

 // Screen-space grain is stable in CSS-pixel units: no time, pointer or field
 // seed enters this hash, so autonomous motion never animates the grain.
 vec2 pixel=floor(gl_FragCoord.xy*viewport/resolution);
 float grain=(latticeHash(pixel+vec2(31.7,19.3))-.5)*grainStrength;
 gl_FragColor=vec4(clamp(color+vec3(grain),0.,1.),1.);
}`;

export function createLandingBackground(canvas, background = {}) {
  const source = background && typeof background === 'object' ? background : {};
  const palette = source.palette && typeof source.palette === 'object' ? source.palette : {};
  const settings = {
    timeScale: clamp(finite(source.timeScale, DEFAULTS.timeScale), 0, 1),
    rotation: finite(source.rotation, DEFAULTS.rotation),
    distortion: clamp(finite(source.distortion, DEFAULTS.distortion), 0, 2),
    grain: clamp(finite(source.grain, DEFAULTS.grain), 0, .15),
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
    const names = ['resolution', 'viewport', 'pointer', 'clock', 'timeScale', 'rotation', 'distortion', 'grainStrength', 'ink', 'orange', 'teal', 'cobalt', 'navy'];
    const uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
    for (const [uniform, key] of [['ink', 'black'], ['orange', 'orange'], ['teal', 'teal'], ['cobalt', 'cobalt'], ['navy', 'navy']]) {
      gl.uniform3fv(uniforms[uniform], rgb(palette[key], DEFAULTS.palette[key]));
    }
    gl.uniform1f(uniforms.timeScale, settings.timeScale);
    gl.uniform1f(uniforms.rotation, settings.rotation);
    gl.uniform1f(uniforms.distortion, settings.distortion);
    gl.uniform1f(uniforms.grainStrength, settings.grain);
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
      render({ time = 0, pointer = { x: 0, y: 0 } } = {}) {
        if (disposed || gl.isContextLost()) return;
        gl.useProgram(program);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.viewport, width, height);
        gl.uniform2f(uniforms.pointer, clamp(finite(pointer?.x, 0), -1, 1), clamp(finite(pointer?.y, 0), -1, 1));
        gl.uniform1f(uniforms.clock, Math.max(0, finite(time, 0)));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      dispose,
    };
  } catch { dispose(); return null; }
}
