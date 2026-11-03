import { liquidScene } from './liquid-scene.js';

const vertex = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
uniform vec2 resolution;
uniform vec2 viewport;
uniform vec4 searchRect;
uniform vec4 buttonRect;
uniform vec2 pointer;
uniform float clock;
uniform float dark;
uniform float focus;
uniform float press;
uniform float refractionStrength;
uniform vec3 ripples[4];
uniform int rippleCount;
${liquidScene}

float capsule(vec2 p,vec4 rect){
 vec2 q=abs(p-rect.xy)-vec2(max(rect.z*.5-rect.w*.5,0.),0.);
 return length(max(q,0.))+min(max(q.x,q.y),0.)-rect.w*.5;
}
// A curved optical surface, not a colour painted around the control.
vec4 surface(vec2 p,vec4 rect,float curvature){
 float d=capsule(p,rect);
 float radius=rect.w*.5;
 float depth=clamp(-d,0.,radius);
 vec2 center=clamp(p-rect.xy,-vec2(max(rect.z*.5-radius,0.),0.),vec2(max(rect.z*.5-radius,0.),0.));
 vec2 radial=p-rect.xy-center;
 vec2 n=radial/max(length(radial),.001);
 float slope=clamp(1.-depth/max(radius,1.),0.,1.);
 float height=sqrt(max(1.-slope*slope,.001));
 vec3 normal=normalize(vec3(n*slope,max(height,.04)));
 vec3 ray=refract(vec3(0.,0.,-1.),normal,1./1.46);
 float thickness=radius*(1.2+focus*.13+press*.2)*height*curvature;
 vec2 offset=ray.xy/max(abs(ray.z),.12)*thickness;
 float fringe=pow(slope,5.)*2.6*curvature;
 return vec4(offset,n*fringe);
}
vec3 reflections(vec2 p,vec4 rect,vec3 color,float strength){
 float d=capsule(p,rect);
 vec2 q=p-rect.xy;
 vec2 nearest=clamp(q,-vec2(max(rect.z*.5-rect.w*.5,0.),0.),vec2(max(rect.z*.5-rect.w*.5,0.),0.));
 vec2 n=normalize(q-nearest+vec2(.0001));
 vec2 light=normalize(vec2(-.55+pointer.x*.5,.85-pointer.y*.25));
 float lighting=dot(n,light);
 float white=exp(-abs(d+1.2)*1.15)*(.25+.75*max(lighting,0.));
 float shade=exp(-abs(d+3.6)*.7)*(.12+.17*max(-lighting,0.));
 color=mix(color,vec3(dark>.5?.02:.10),shade*strength);
 color=mix(color,vec3(1.),white*.8*strength);
 float soft=exp(-abs(d+7.)*.18)*max(lighting,0.);
 color+=soft*(dark>.5?.035:.025)*strength;
 // A broad spectral studio reflection fades into the clear face. Its colour
 // changes smoothly with position/light rather than forming a painted rainbow rim.
 float across=clamp(q.x/max(rect.z,1.)+.5+pointer.x*.12,0.,1.);
 vec3 cyan=vec3(.43,.84,.91);
 vec3 lavender=vec3(.72,.62,.88);
 vec3 champagne=vec3(.97,.80,.57);
 vec3 spectral=mix(mix(cyan,lavender,smoothstep(.08,.58,across)),champagne,smoothstep(.50,.98,across));
 float inward=max(-d,0.);
 float sheen=exp(-abs(inward-8.)/13.)*(.28+.72*max(lighting,0.));
 float face=exp(-pow((q.y-rect.w*.18)/max(rect.w*.23,1.),2.))*.25;
 float colourWeight=(sheen+face)*(dark>.5?.24:.28)*strength;
 color=mix(color,spectral,clamp(colourWeight,0.,.32));
 return clamp(color,0.,1.);
}
void main(){
 vec2 p=gl_FragCoord.xy/resolution*viewport;
 vec3 color=scene(p);
 float barDistance=capsule(p,searchRect);
 float buttonDistance=capsule(p,buttonRect);
 if(barDistance<1.){
  float mask=1.-smoothstep(-.7,.8,barDistance);
  vec4 optical=surface(p,searchRect,1.);
  float second=1.-smoothstep(-.7,.8,buttonDistance);
  if(buttonDistance<1.)optical+=surface(p,buttonRect,1.3)*second;
  optical*=refractionStrength;
  // All three channels sample the same moving scene at separately displaced positions.
  vec3 glass=vec3(scene(p+optical.xy+optical.zw).r,scene(p+optical.xy).g,scene(p+optical.xy-optical.zw).b);
  float top=clamp((p.y-searchRect.y)/max(searchRect.w,1.)+.5,0.,1.);
  glass=mix(glass,vec3(dark>.5?.09:.98),.025+top*.02);
  glass=reflections(p,searchRect,glass,1.);
  if(buttonDistance<1.)glass=reflections(p,buttonRect,glass,.95);
  color=mix(color,glass,mask);
 }
 // The decorative field blends into the page; the native input is above this canvas.
 float alpha=smoothstep(0.,.12,p.y/viewport.y)*(1.-smoothstep(.78,1.,p.y/viewport.y));
 gl_FragColor=vec4(color,alpha);
}`;

export function createLiquidLensRenderer(original, { dark = false } = {}) {
  const canvas = original.cloneNode();
  let gl, program, buffer, vertexShader, fragmentShader, disposed = false;
  const release = () => {
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
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS) || !gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) { release(); return null; }
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { release(); return null; }
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    const names = ['resolution','viewport','searchRect','buttonRect','pointer','clock','dark','focus','press','refractionStrength','ripples[0]','rippleCount'];
    const uniforms = Object.fromEntries(names.map(name => [name,gl.getUniformLocation(program,name)]));
    gl.uniform1f(uniforms.dark, Number(dark));
    gl.uniform1f(uniforms.refractionStrength, 1);
    original.replaceWith(canvas);
    let cssWidth = 1, cssHeight = 1;
    return {
      canvas,
      resize(width, height, scale, { search, button }) {
        cssWidth=width;cssHeight=height;
        const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
        if(canvas.width!==w)canvas.width=w;
        if(canvas.height!==h)canvas.height=h;
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.uniform2f(uniforms.viewport,width,height);
        gl.uniform4f(uniforms.searchRect,...search);
        gl.uniform4f(uniforms.buttonRect,...button);
      },
      render({time,pointer,focus,press=0,ripples=[],hidden=false}) {
        if(disposed||gl.isContextLost())return;
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        if(hidden)return;
        gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
        gl.uniform2f(uniforms.viewport,cssWidth,cssHeight);
        gl.uniform2f(uniforms.pointer,pointer.x,-pointer.y);
        gl.uniform1f(uniforms.clock,time);
        gl.uniform1f(uniforms.focus,focus);
        gl.uniform1f(uniforms.press,press);
        gl.uniform1i(uniforms.rippleCount,Math.min(4,ripples.length));
        const values=new Float32Array(12);
        ripples.slice(-4).forEach((r,i)=>values.set([r.x,1-r.y,r.started],i*3));
        gl.uniform3fv(uniforms['ripples[0]'],values);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      },
      dispose: release,
    };
  } catch { release();return null; }
}
