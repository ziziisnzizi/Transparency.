import { liquidScene } from './liquid-scene.js';

const vertex = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
uniform vec2 resolution;
uniform vec2 viewport;
uniform vec2 pointer;
uniform float clock;
uniform float dark;
uniform vec4 searchRect;
uniform vec3 ripples[4];
uniform int rippleCount;
${liquidScene}
void main(){
 vec2 p=gl_FragCoord.xy/resolution*viewport;
 float alpha=smoothstep(0.,.12,p.y/viewport.y)*(1.-smoothstep(.78,1.,p.y/viewport.y));
 gl_FragColor=vec4(scene(p),alpha);
}`;

// Decorative water only: the HTML interface is never sampled or distorted.
export function createWaterRenderer(original, { dark = false } = {}) {
  const canvas = original.cloneNode();
  let gl, program, buffer, vertexShader, fragmentShader, disposed = false;
  const dispose = () => {
    if (!gl || disposed) return;
    disposed = true;
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    vertexShader = compile(gl.VERTEX_SHADER, vertex);
    fragmentShader = compile(gl.FRAGMENT_SHADER, fragment);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS) || !gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) { dispose(); return null; }
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { dispose(); return null; }
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    const names = ['resolution','viewport','pointer','clock','dark','searchRect','ripples[0]','rippleCount'];
    const uniforms = Object.fromEntries(names.map(name => [name,gl.getUniformLocation(program,name)]));
    const rippleValues = new Float32Array(12);
    let cssWidth = 1, cssHeight = 1;
    gl.uniform1f(uniforms.dark, Number(dark));
    original.replaceWith(canvas);
    return {
      canvas,
      resize(width, height, scale, { search }) {
        if (disposed || gl.isContextLost()) return;
        cssWidth = Math.max(width,1); cssHeight = Math.max(height,1);
        const w = Math.max(1,Math.round(cssWidth*scale)), h = Math.max(1,Math.round(cssHeight*scale));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.uniform2f(uniforms.viewport,cssWidth,cssHeight);
        gl.uniform4f(uniforms.searchRect,...search);
      },
      render({ time, pointer, ripples = [], hidden = false }) {
        if (disposed || gl.isContextLost()) return;
        gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
        if (hidden) return;
        gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
        gl.uniform2f(uniforms.viewport,cssWidth,cssHeight);
        gl.uniform2f(uniforms.pointer,pointer.x,-pointer.y);
        gl.uniform1f(uniforms.clock,time);
        const current = ripples.slice(-4);
        rippleValues.fill(0);
        current.forEach((r,i) => rippleValues.set([r.x,1-r.y,r.started],i*3));
        gl.uniform3fv(uniforms['ripples[0]'],rippleValues);
        gl.uniform1i(uniforms.rippleCount,current.length);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      },
      dispose,
    };
  } catch { dispose(); return null; }
}
