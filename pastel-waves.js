const vertex = `attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
uniform vec2 resolution;
uniform vec2 viewport;
uniform vec2 pointer;
uniform float clock;
uniform float dark;
uniform float concernsScene;
uniform vec3 ripples[4];
uniform int rippleCount;

float softBand(float distance,float width){
 float d=distance/width;
 return exp(-d*d);
}

// Broad, slowly morphing light pools for the empty concern-search hero.
// Uneven overlapping clouds keep the scene organic, with a quiet reading centre.
vec3 concernAtmosphere(vec2 uv,float aspect){
 float t=clock*.10;
 float mobile=1.-smoothstep(.85,1.18,aspect);
 vec2 p=uv-pointer*vec2(.050,.040);
 p+=vec2(sin(uv.y*4.2+t*.73),sin(uv.x*3.6-t*.61))*.038;
 vec2 drift=vec2(sin(t*.78),cos(t*.63))*vec2(.068,.057);
 vec2 upper=(p-(vec2(.98,.98)+drift))/vec2(.76,.64);
 float sky=exp(-dot(upper,upper)*1.8);
 vec2 left=(p-(vec2(-.15,.49)-drift*.6))/vec2(.69,.59);
 float cyan=exp(-dot(left,left)*1.65);
 vec2 lower=(p-(vec2(.66,-.17)+drift*.65))/vec2(.82,.54);
 float daylight=exp(-dot(lower,lower)*1.65);
 vec3 ink=vec3(.012,.025,.040);
 vec3 color=mix(ink,vec3(.32,.68,.91),sky*.94);
 color=mix(color,vec3(.27,.61,.77),cyan*.83);
 color=mix(color,vec3(.84,.95,1.),daylight*.88);
 // A dark mid-right cutout separates the upper sky arc from the icy lower glow.
 vec2 cutout=(p-(vec2(.78,.51)+drift*.34))/vec2(.42,.40);
 float depth=exp(-dot(cutout,cutout)*2.1);
 color=mix(color,vec3(.006,.013,.023),depth*.94);
 vec2 reading=(p-vec2(.43,mix(.61,.65,mobile)))/vec2(.49,.31);
 float readingShade=exp(-dot(reading,reading)*1.8)*.32;
 return mix(color,ink,readingShade);
}

void main(){
 vec2 uv=gl_FragCoord.xy/resolution;
 float aspect=viewport.x/max(viewport.y,1.);
 if(concernsScene>.5){
  gl_FragColor=vec4(clamp(concernAtmosphere(uv,aspect),0.,1.),1.);
  return;
 }
 vec2 p=vec2(uv.x*aspect,uv.y);
 // Move the decorative field by a few CSS pixels, never the HTML above it.
 p-=pointer*vec2(22.,16.)/max(viewport.y,1.);
 float t=clock*.075;
 float slope=p.x*.12;
 float first=.16+slope+.070*sin(p.x*1.55+t)+.023*sin(p.x*3.1-t*.6);
 float second=.53+slope+.075*sin(p.x*1.20-t*.8+1.1);
 float third=.90+slope+.055*sin(p.x*1.8+t*.65+2.7);
 float d1=p.y-first;
 float d2=p.y-second;
 float d3=p.y-third;

 vec3 low=mix(vec3(.955),vec3(.028),dark);
 vec3 high=mix(vec3(1.),vec3(.065),dark);
 float wash=clamp(uv.y*.72+uv.x*.18,0.,1.);
 vec3 color=mix(low,high,wash);
 vec3 foldTone=mix(vec3(.88),vec3(.085),dark);
 vec3 ice=mix(vec3(1.),vec3(.14),dark);

 // Three broad, differently curved water folds replace the repeated grey ribs.
 float body1=softBand(d1,.145);
 float body2=softBand(d2,.180);
 float body3=softBand(d3,.150);
 color=mix(color,foldTone,body1*.28+body2*.16+body3*.10);
 float rim1=softBand(d1+.075,.034);
 float rim2=softBand(d2+.090,.043);
 float rim3=softBand(d3+.065,.035);
 float reflection=clamp(rim1*.50+rim2*.56+rim3*.38,0.,.7);
 color=mix(color,ice,reflection);
 // An airy white pool keeps the centre quiet behind reading and form fields.
 vec2 pool=(uv-vec2(.56,.59))*vec2(.88,1.);
 float daylight=exp(-dot(pool,pool)*5.5);
 color=mix(color,mix(vec3(.985),vec3(.045),dark),daylight*.22);

 // Taps add a broad, fading disturbance with no coloured rings or UI distortion.
 for(int i=0;i<4;i++){
  if(i>=rippleCount)break;
  float age=clock-ripples[i].z;
  if(age>=0.&&age<3.){
   vec2 delta=(uv-ripples[i].xy)*vec2(aspect,1.);
   float front=length(delta)-age*.13;
   float pulse=exp(-front*front/.0018)*exp(-age*1.35);
   color=mix(color,ice,pulse*(dark>.5?.045:.085));
  }
 }
 gl_FragColor=vec4(clamp(color,0.,1.),1.);
}`;

// This is a full-screen decorative gradient, with no page sampling, textures,
// optical refraction or foreground interaction layer.
export function createPastelWaveRenderer(original, { dark = false, scene = 'default' } = {}) {
  const canvas=original.cloneNode();
  let gl,program,buffer,vertexShader,fragmentShader,disposed=false;
  const dispose=()=>{
    if(!gl||disposed)return;
    disposed=true;
    if(buffer)gl.deleteBuffer(buffer);
    if(program)gl.deleteProgram(program);
    if(vertexShader)gl.deleteShader(vertexShader);
    if(fragmentShader)gl.deleteShader(fragmentShader);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  try{
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,depth:false,stencil:false,powerPreference:'low-power'});
    if(!gl)return null;
    const compile=(type,source)=>{
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);gl.compileShader(shader);
      return shader;
    };
    vertexShader=compile(gl.VERTEX_SHADER,vertex);
    fragmentShader=compile(gl.FRAGMENT_SHADER,fragment);
    if(!gl.getShaderParameter(vertexShader,gl.COMPILE_STATUS)||!gl.getShaderParameter(fragmentShader,gl.COMPILE_STATUS)){dispose();return null;}
    program=gl.createProgram();gl.attachShader(program,vertexShader);gl.attachShader(program,fragmentShader);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){dispose();return null;}
    gl.useProgram(program);
    buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const attribute=gl.getAttribLocation(program,'position');
    gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
    const names=['resolution','viewport','pointer','clock','dark','concernsScene','ripples[0]','rippleCount'];
    const uniforms=Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]));
    const rippleValues=new Float32Array(12);
    let width=1,height=1;
    original.replaceWith(canvas);
    return{
      canvas,
      resize(nextWidth,nextHeight,scale){
        if(disposed||gl.isContextLost())return;
        width=Math.max(1,nextWidth);height=Math.max(1,nextHeight);
        const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
        if(canvas.width!==w)canvas.width=w;
        if(canvas.height!==h)canvas.height=h;
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.uniform2f(uniforms.viewport,width,height);
      },
      render({time=0,pointer={x:0,y:0},ripples=[],dark:nextDark=dark,scene:nextScene=scene,hidden=false}={}){
        if(disposed||gl.isContextLost())return;
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        if(hidden)return;
        gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
        gl.uniform2f(uniforms.viewport,width,height);
        gl.uniform2f(uniforms.pointer,pointer.x,-pointer.y);
        gl.uniform1f(uniforms.clock,time);gl.uniform1f(uniforms.dark,Number(nextDark));
        gl.uniform1f(uniforms.concernsScene,Number(nextScene==='concerns'));
        const current=ripples.slice(-4);rippleValues.fill(0);
        current.forEach((r,i)=>rippleValues.set([r.x,1-r.y,r.started],i*3));
        gl.uniform3fv(uniforms['ripples[0]'],rippleValues);gl.uniform1i(uniforms.rippleCount,current.length);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      },
      dispose,
    };
  }catch{dispose();return null;}
}
