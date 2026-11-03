// Local analytic ray tracing: three refracted rays split the studio scene into RGB.
// No scene images, dependencies, user text or external requests are involved.
const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float clock;
uniform float dark;
uniform float mobile;
uniform float compact;
uniform float focus;
uniform float pulse;
uniform sampler2D studio;
uniform vec3 ripples[4];
uniform int rippleCount;

mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
mat3 inverseRotation(mat3 m){return mat3(vec3(m[0].x,m[1].x,m[2].x),vec3(m[0].y,m[1].y,m[2].y),vec3(m[0].z,m[1].z,m[2].z));}
vec2 box(vec3 o,vec3 d,float size){vec3 q=1./d;vec3 a=(-vec3(size)-o)*q,b=(vec3(size)-o)*q;vec3 lo=min(a,b),hi=max(a,b);return vec2(max(max(lo.x,lo.y),lo.z),min(min(hi.x,hi.y),hi.z));}
vec3 normalAt(vec3 p){vec3 a=abs(p);if(a.x>a.y&&a.x>a.z)return vec3(sign(p.x),0.,0.);if(a.y>a.z)return vec3(0.,sign(p.y),0.);return vec3(0.,0.,sign(p.z));}
vec3 spectrum(float h){return clamp(abs(fract(h+vec3(0.,.666667,.333333))*6.-3.)-1.,0.,1.);}
vec3 environment(vec3 d){
 float strip=smoothstep(.48,.56,sin(d.x*5.+d.y*3.+d.z*1.5));
 vec3 c=mix(vec3(.015,.02,.03),vec3(.96,.98,1.),strip);
 float softbox=pow(max(dot(d,normalize(vec3(-.7,1.,1.))),0.),18.);
 c+=softbox*.7;
 float highlight=pow(abs(sin(d.y*3.5-d.x*2.1+clock*.07)),25.);
 return mix(c,spectrum(d.x*.35+d.y*.3+clock*.012)*1.3,highlight*.8);
}
float channel(vec3 o,vec3 d,vec3 n,float size,float ior,mat3 back,int component){
 vec3 inside=refract(d,n,1./ior);
 vec3 start=o+inside*.001;
 vec2 leave=box(start,inside,size);
 vec3 end=start+inside*leave.y;
 vec3 exitNormal=normalAt(end);
 vec3 outgoing=refract(inside,-exitNormal,ior);
 if(dot(outgoing,outgoing)<.01){
  inside=reflect(inside,exitNormal);
  start=end+inside*.001;
  leave=box(start,inside,size);
  end=start+inside*leave.y;
  outgoing=refract(inside,-normalAt(end),ior);
 }
 if(dot(outgoing,outgoing)<.01)outgoing=reflect(inside,normalAt(end));
 vec3 worldEnd=back*end,worldRay=back*outgoing;
 float plane=(-3.8-worldEnd.z)/min(worldRay.z,-.08);
 vec2 uv=(worldEnd+worldRay*plane).xy*vec2(.19,-.19)+.5;
 vec3 printed=texture2D(studio,clamp(uv,.001,.999)).rgb;
 vec3 reflection=environment(worldRay);
 vec3 c=mix(printed,reflection,.22);
 if(component==0)return c.r;if(component==1)return c.g;return c.b;
}
void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 float aspect=resolution.x/resolution.y;
 vec2 center=mix(vec2(.765,.57),vec2(.56,.49),mobile);
 center+=pointer*vec2(.035,-.025);
 if(compact>.5)center=mix(vec2(.84,.55),vec2(.83,.53),mobile);
 vec2 screen=(uv-center)*vec2(aspect,1.)*2.;
 mat3 turn=rz(.38+sin(clock*.18)*.13-pointer.x*.2)*rx(-.32+pointer.y*.75+sin(clock*.22)*.10)*ry(.56+pointer.x*.95+sin(clock*.16)*.25+pulse*.3);
 mat3 back=inverseRotation(turn);
 vec3 origin=turn*vec3(0.,0.,5.);
 vec3 ray=turn*normalize(vec3(screen*1.5,-4.));
 float size=mix(.79,.59,mobile)*(1.-compact*.29)*(1.+pulse*.11+focus*.025);
 vec2 hit=box(origin,ray,size);
 vec3 color=vec3(0.);float alpha=0.;
 if(hit.y>max(hit.x,0.)){
  vec3 point=origin+ray*hit.x,n=normalAt(point);
  float dispersion=.11+pulse*.065+focus*.02;
  color=vec3(channel(point,ray,n,size,1.42,back,0),channel(point,ray,n,size,1.42+dispersion,back,1),channel(point,ray,n,size,1.42+dispersion*2.,back,2));
  float fresnel=.09+.72*pow(1.-abs(dot(-ray,n)),4.);
  color=mix(color,environment(back*reflect(ray,n)),fresnel);
  vec3 gaps=vec3(size)-abs(point);
  float edge=n.x!=0.?min(gaps.y,gaps.z):n.y!=0.?min(gaps.x,gaps.z):min(gaps.x,gaps.y);
  float bevel=1.-smoothstep(.003,.052,edge);
  float whiteEdge=1.-smoothstep(.001,.008,edge);
  vec3 spectral=spectrum(point.x*.47+point.y*.55+point.z*.29+clock*.018+pointer.x*.15);
  color=mix(color,spectral*.95+vec3(.08),bevel*.8);
  color=mix(color,vec3(1.),whiteEdge*.94);
  float faceLight=max(dot(n,normalize(turn*vec3(-.8,.9,1.))),0.);
  color*=.83+.23*faceLight;
  alpha=.97;
 }
 // Broad dispersed caustics follow taps; the prism itself also turns and expands.
 for(int i=0;i<4;i++){
  if(i>=rippleCount)break;
  float age=clock-ripples[i].z;
  if(age>=0.&&age<2.4){
   vec2 delta=(uv-ripples[i].xy)*vec2(aspect,1.);
   float dist=length(delta*vec2(1.,1.35));
   float radius=.02+age*.36;
   float fade=pow(1.-age/2.4,1.6);
   vec3 bands=exp(-abs(vec3(dist-radius)+vec3(-.011,0.,.011))*150.)*fade;
   float a=max(max(bands.r,bands.g),bands.b)*.85;
   color=mix(color,bands/max(max(bands.r,bands.g),bands.b+.001),a);
   alpha=max(alpha,a);
  }
 }
 gl_FragColor=vec4(clamp(color,0.,1.),alpha);
}`;

export function createPrismRenderer(original, { dark = false, compact = false } = {}) {
  // A separate candidate keeps the original available for Canvas2D on any failure.
  const canvas = original.cloneNode();
  let gl, program, buffer, texture, vertexShader, fragmentShader, disposed = false;
  const release = () => {
    if (!gl || disposed) return;
    disposed = true;
    if (texture) gl.deleteTexture(texture);
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
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

    const image = document.createElement('canvas');
    image.width = image.height = 1024;
    const ctx = image.getContext('2d');
    if (!ctx) { release(); return null; }
    ctx.fillStyle = dark ? '#060708' : '#f4f4f5';
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.fillStyle = dark ? '#fafaff' : '#08090c';
    ctx.save();
    ctx.translate(500, 560);
    ctx.rotate(-.29);
    ctx.font = '900 630px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('T.', 0, 200);
    ctx.restore();
    ctx.font = '700 42px Arial, sans-serif';
    ctx.fillText('Transparency.', 50, 145);
    ctx.fillText('NOTHING TO HIDE.', 400, 955);
    ctx.fillRect(0, 790, 1024, 26);
    ctx.fillRect(760, 0, 24, 1024);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    const uniforms = Object.fromEntries(['resolution', 'pointer', 'clock', 'dark', 'mobile', 'compact', 'focus', 'pulse', 'studio', 'rippleCount', 'ripples[0]'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.uniform1i(uniforms.studio, 0);
    gl.uniform1f(uniforms.dark, Number(dark));
    gl.uniform1f(uniforms.compact, Number(compact));
    original.replaceWith(canvas);
    let cssWidth = 1;
    return {
      canvas,
      resize(width, height, scale) {
        cssWidth = width;
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      render({ time, pointer, focus, ripples = [], hidden = false }) {
        if (disposed || gl.isContextLost()) return;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (hidden) return;
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform2f(uniforms.pointer, pointer.x, -pointer.y);
        gl.uniform1f(uniforms.clock, time);
        gl.uniform1f(uniforms.mobile, Number(cssWidth <= 750));
        gl.uniform1f(uniforms.focus, focus);
        const last = ripples[ripples.length - 1];
        const age = last ? time - last.started : 100;
        gl.uniform1f(uniforms.pulse, age < 2.4 ? Math.exp(-age * 1.35) : 0);
        gl.uniform1i(uniforms.rippleCount, Math.min(ripples.length, 4));
        const values = new Float32Array(12);
        ripples.slice(-4).forEach((ripple, index) => values.set([ripple.x, 1 - ripple.y, ripple.started], index * 3));
        gl.uniform3fv(uniforms['ripples[0]'], values);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      dispose: release,
    };
  } catch {
    release();
    return null;
  }
}
