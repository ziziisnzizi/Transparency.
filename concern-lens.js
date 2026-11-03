import { liquidScene } from './liquid-scene.js';

const vertex = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const sceneSource = liquidScene.replace(/\bviewport\b/g, 'sceneViewport');
const fragment = `
precision highp float;
uniform vec2 resolution;
uniform vec2 viewport;
uniform vec2 sceneViewport;
uniform vec4 sceneRect;
uniform vec2 drawOrigin;
uniform vec2 drawSize;
uniform vec4 searchRect;
uniform vec4 buttonRect;
uniform vec2 pointer;
uniform float clock;
uniform float dark;
uniform float focus;
uniform float press;
uniform float refractionStrength;
uniform float overlayPass;
uniform float htmlReady;
uniform sampler2D htmlTexture;
uniform vec4 htmlRect;
uniform vec4 orb;
uniform float cursorShape;
uniform vec4 cursorRect;
uniform vec3 ripples[4];
uniform int rippleCount;
${sceneSource}

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
vec3 waterAt(vec2 p){
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
 return color;
}
vec3 backgroundAt(vec2 p){
 if(overlayPass<.5)return waterAt(p);
 vec3 base=mix(vec3(.910,.914,.922),vec3(.028,.031,.036),dark);
 vec2 local=p-sceneRect.xy;
 if(local.x<0.||local.y<0.||local.x>sceneRect.z||local.y>sceneRect.w)return base;
 // The source water canvas fades at its own top/bottom, independently of
 // the viewport-sized HTML texture and the small foreground drawing tile.
 float fade=smoothstep(0.,.12,local.y/sceneViewport.y)*(1.-smoothstep(.78,1.,local.y/sceneViewport.y));
 return mix(base,waterAt(local),fade);
}
vec3 pageAt(vec2 p){
 vec2 uv=(p-htmlRect.xy)/max(htmlRect.zw,vec2(1.))+.5;
 vec4 html=vec4(0.);
 if(uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.)html=texture2D(htmlTexture,uv);
 // A full-page snapshot already contains its opaque page surface. Avoid
 // recomputing the procedural scene three times under an opaque HTML pixel.
 if(html.a>=.999)return html.rgb;
 return mix(backgroundAt(p),html.rgb,html.a);
}
vec2 sphereSample(vec2 local,float ior){
 // Trace an orthographic camera ray through both spherical interfaces.
 // Snell refraction, the far-surface ray intersection and the final page
 // plane projection replace the previous hand-tuned radial scale.
 vec3 front=vec3(local,sqrt(max(1.-dot(local,local),.000001)));
 vec3 inside=refract(vec3(0.,0.,-1.),front,1./ior);
 float distance=-2.*dot(front,inside);
 vec3 exitPoint=normalize(front+inside*distance);
 vec3 outgoing=refract(inside,-exitPoint,ior);
 float projection=max(exitPoint.z+1.18,0.)/max(-outgoing.z,.08);
 return orb.xy+(exitPoint.xy+outgoing.xy*projection)*orb.z;
}
void arrowEdge(vec2 p,vec2 a,vec2 b,inout float distanceSquared,inout bool inside){
 vec2 edge=b-a;
 vec2 relative=p-a;
 vec2 nearest=relative-edge*clamp(dot(relative,edge)/max(dot(edge,edge),.001),0.,1.);
 distanceSquared=min(distanceSquared,dot(nearest,nearest));
 if((a.y>p.y)!=(b.y>p.y)){
  float crossing=a.x+(b.x-a.x)*(p.y-a.y)/(b.y-a.y);
  if(p.x<crossing)inside=!inside;
 }
}
float arrowDistance(vec2 p){
 // A seven-edge pointer, expressed in top-origin logical CSS coordinates.
 // This signed contour drives both the silhouette and its curved glass bevel.
 vec2 q=vec2(p.x-cursorRect.x,cursorRect.y+cursorRect.w-p.y)*vec2(38.,56.)/cursorRect.zw;
 float nearest=100000.;
 bool inside=false;
 arrowEdge(q,vec2(0.,0.),vec2(0.,47.),nearest,inside);
 arrowEdge(q,vec2(0.,47.),vec2(11.,36.),nearest,inside);
 arrowEdge(q,vec2(11.,36.),vec2(21.,56.),nearest,inside);
 arrowEdge(q,vec2(21.,56.),vec2(30.,51.),nearest,inside);
 arrowEdge(q,vec2(30.,51.),vec2(20.,32.),nearest,inside);
 arrowEdge(q,vec2(20.,32.),vec2(38.,32.),nearest,inside);
 arrowEdge(q,vec2(38.,32.),vec2(0.,0.),nearest,inside);
 return sqrt(nearest)*(inside?-1.:1.)*min(cursorRect.z/38.,cursorRect.w/56.);
}
vec2 arrowSample(vec2 p,vec3 normal,float depth,float ior){
 vec3 ray=refract(vec3(0.,0.,-1.),normal,1./ior);
 vec2 center=cursorRect.xy+cursorRect.zw*.5;
 float thickness=min(3.+depth*1.8,14.);
 return center+(p-center)*.94+ray.xy/max(-ray.z,.12)*thickness;
}
vec4 glassArrow(vec2 p){
 float distance=arrowDistance(p);
 float aa=max(drawSize.x/resolution.x*.5,.2);
 if(distance>aa)return vec4(0.);
 float depth=max(-distance,0.);
 vec2 gradient=vec2(arrowDistance(p+vec2(.4,0.))-arrowDistance(p-vec2(.4,0.)),arrowDistance(p+vec2(0.,.4))-arrowDistance(p-vec2(0.,.4)));
 vec2 direction=normalize(gradient+vec2(.00001));
 float slope=1.-smoothstep(0.,6.,depth);
 vec3 normal=normalize(vec3(direction*slope,sqrt(max(1.-slope*slope,.001))));
 // The three wavelengths follow slightly different refracted rays through
 // the bevel; the captured text/images remain the material beneath the pointer.
 vec3 color=vec3(pageAt(arrowSample(p,normal,depth,1.28)).r,pageAt(arrowSample(p,normal,depth,1.32)).g,pageAt(arrowSample(p,normal,depth,1.36)).b);
 vec2 light=normalize(vec2(-.55+pointer.x*.2,.85));
 float facing=.3+.7*max(dot(direction,light),0.);
 float rim=exp(-abs(distance+.6)*1.8);
 float shade=exp(-abs(distance+1.9)*.95);
 color=mix(color,vec3(dark>.5?.015:.12),shade*.20);
 color=mix(color,vec3(1.),rim*facing*.85);
 float across=clamp((p.x-cursorRect.x)/cursorRect.z+pointer.x*.12,0.,1.);
 vec3 spectral=mix(mix(vec3(.50,.85,.94),vec3(.76,.65,.93),smoothstep(.05,.60,across)),vec3(.98,.84,.65),smoothstep(.55,.98,across));
 color=mix(color,spectral,exp(-abs(distance+1.2)*1.3)*facing*.18);
 float shine=pow(max(dot(normal,normalize(vec3(-.55,.8,1.4))),0.),28.);
 color=mix(color,vec3(1.),shine*.18);
 float alpha=(1.-smoothstep(-aa,aa,distance))*orb.w;
 return vec4(clamp(color,0.,1.),alpha);
}
void main(){
 // The background covers its scene; the foreground only rasterizes a small,
 // high-density lens tile while retaining full-viewport sampling coordinates.
 vec2 p=drawOrigin+gl_FragCoord.xy/resolution*drawSize;
 if(overlayPass>.5){
  if(htmlReady<.5||orb.w<.002){gl_FragColor=vec4(0.);return;}
  if(cursorShape>.5){gl_FragColor=glassArrow(p);return;}
  vec2 local=(p-orb.xy)/max(orb.z,1.);
  float radius=length(local);
  if(radius>=1.){gl_FragColor=vec4(0.);return;}
  float dome=sqrt(max(1.-radius*radius,.000001));
  vec2 direction=local/max(radius,.001);
  float dispersion=.004*smoothstep(.15,.95,radius);
  vec3 glass=vec3(pageAt(sphereSample(local,1.15-dispersion)).r,pageAt(sphereSample(local,1.15)).g,pageAt(sphereSample(local,1.15+dispersion)).b);
  vec3 normal=normalize(vec3(local,dome));
  vec3 light=normalize(vec3(-.6+pointer.x*.2,.85,1.3));
  float specular=pow(max(dot(normal,light),0.),24.);
  float softbox=exp(-pow((local.x+.38)/.6,2.)-pow((local.y-.60)/.22,2.));
  glass=mix(glass,vec3(1.),specular*.2+softbox*.13);
  float edge=exp(-abs(radius-.989)*orb.z/1.1);
  float inner=exp(-abs(radius-.976)*orb.z/1.25);
  float facing=.25+.75*max(dot(direction,normalize(vec2(-.5,.85))),0.);
  glass=mix(glass,vec3(dark>.5?.025:.12),inner*.22);
  glass=mix(glass,vec3(1.),edge*facing*.85);
  float alpha=(1.-smoothstep(1.-1.5/orb.z,1.,radius))*orb.w;
  gl_FragColor=vec4(clamp(glass,0.,1.),alpha);return;
 }
 vec3 color=backgroundAt(p);
 // The decorative field blends into the page; the native input is above this canvas.
 float alpha=smoothstep(0.,.12,p.y/viewport.y)*(1.-smoothstep(.78,1.,p.y/viewport.y));
 gl_FragColor=vec4(color,alpha);
}`;

export function createLiquidLensRenderer(original, { dark = false, overlay = false } = {}) {
  const canvas = original.cloneNode();
  let gl, program, buffer, texture, vertexShader, fragmentShader, disposed = false;
  const release = () => {
    if (!gl || disposed) return;
    disposed = true;
    if (buffer) gl.deleteBuffer(buffer);
    if (texture) gl.deleteTexture(texture);
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
    const names = ['resolution','viewport','sceneViewport','sceneRect','drawOrigin','drawSize','searchRect','buttonRect','pointer','clock','dark','focus','press','refractionStrength','ripples[0]','rippleCount','overlayPass','htmlReady','htmlTexture','htmlRect','orb','cursorShape','cursorRect'];
    const uniforms = Object.fromEntries(names.map(name => [name,gl.getUniformLocation(program,name)]));
    gl.uniform1f(uniforms.dark, Number(dark));
    gl.uniform1f(uniforms.refractionStrength, 1);
    gl.uniform1f(uniforms.overlayPass, Number(overlay));
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));
    gl.uniform1i(uniforms.htmlTexture,0);gl.uniform1f(uniforms.htmlReady,0);
    original.replaceWith(canvas);
    let cssWidth = 1, cssHeight = 1;
    let drawing = [0,0,1,1];
    const setDrawRect = rect => {
      drawing = rect || [0,0,cssWidth,cssHeight];
      gl.uniform2f(uniforms.drawOrigin,drawing[0],drawing[1]);
      gl.uniform2f(uniforms.drawSize,drawing[2],drawing[3]);
    };
    const setSceneRect = rect => {
      const scene=overlay&&rect?rect:[0,0,cssWidth,cssHeight];
      gl.uniform4f(uniforms.sceneRect,...scene);
      gl.uniform2f(uniforms.sceneViewport,Math.max(scene[2],1),Math.max(scene[3],1));
    };
    return {
      canvas,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      resize(width, height, scale, { search, button, html, drawRect, sceneRect }) {
        if(disposed||gl.isContextLost())return;
        cssWidth=width;cssHeight=height;
        const rect=overlay&&drawRect?drawRect:[0,0,width,height];
        const w=Math.max(1,Math.round(rect[2]*scale)),h=Math.max(1,Math.round(rect[3]*scale));
        if(canvas.width!==w)canvas.width=w;
        if(canvas.height!==h)canvas.height=h;
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.uniform2f(uniforms.viewport,width,height);
        setDrawRect(rect);
        setSceneRect(sceneRect);
        gl.uniform4f(uniforms.searchRect,...search);
        gl.uniform4f(uniforms.buttonRect,...button);
        if(html)gl.uniform4f(uniforms.htmlRect,...html);
      },
      setHtml(source) {
        if(disposed||gl.isContextLost())return false;
        if(source.width>gl.getParameter(gl.MAX_TEXTURE_SIZE)||source.height>gl.getParameter(gl.MAX_TEXTURE_SIZE))return false;
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
        gl.uniform1f(uniforms.htmlReady,1);
        return true;
      },
      render({time,pointer,focus,press=0,ripples=[],hidden=false,orb=[0,0,1,0],drawRect,sceneRect,cursorRect=null}) {
        if(disposed||gl.isContextLost())return;
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        if(hidden)return;
        gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
        gl.uniform2f(uniforms.viewport,cssWidth,cssHeight);
        if(overlay&&drawRect)setDrawRect(drawRect);
        if(overlay&&sceneRect)setSceneRect(sceneRect);
        gl.uniform2f(uniforms.pointer,pointer.x,-pointer.y);
        gl.uniform1f(uniforms.clock,time);
        gl.uniform1f(uniforms.focus,focus);
        gl.uniform1f(uniforms.press,press);
        gl.uniform4f(uniforms.orb,...orb);
        gl.uniform1f(uniforms.cursorShape,Number(Boolean(cursorRect)));
        if(cursorRect)gl.uniform4f(uniforms.cursorRect,...cursorRect);
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
