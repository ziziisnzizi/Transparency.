const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;

const fragmentSource = `
precision highp float;
varying vec2 uv;
uniform sampler2D englishTexture;
uniform sampler2D japaneseTexture;
uniform vec2 viewport;
uniform vec2 center;
uniform vec3 paper;
uniform float radius;
uniform float rimWidth;
uniform float refraction;
uniform float rgbOffset;
uniform float fringeOpacity;
uniform float opacity;
uniform float reveal;
uniform float overlayOnly;

vec4 at(sampler2D image,vec2 p){
 if(p.x<0.||p.y<0.||p.x>viewport.x||p.y>viewport.y)return vec4(0.);
 return texture2D(image,vec2(p.x/viewport.x,1.-p.y/viewport.y));
}
vec4 dispersed(sampler2D image,vec2 p,vec2 split){
 vec4 warmFar=at(image,p+split),warmNear=at(image,p+split*.5);
 vec4 coolFar=at(image,p-split),coolNear=at(image,p-split*.5),g=at(image,p);
 float warm=max(warmFar.a,warmNear.a),cool=max(coolFar.a,coolNear.a);
 float a=max(max(warm,g.a),cool);
 // Retain the sharp original text. Outward bands progress from red to yellow
 // on one side and blue to cyan on the other, without mixing into magenta.
 float wing=max(0.,a-g.a)*clamp(fringeOpacity,0.,1.);
 float yellow=max(warmFar.a-warmNear.a,0.)/max(warm,.0001);
 float cyan=max(coolFar.a-coolNear.a,0.)/max(cool,.0001);
 vec3 hue=warm>=cool?vec3(1.,yellow,0.):vec3(0.,cyan,1.);
 return vec4(g.rgb+hue*wing,g.a+wing);
}
void main(){
 vec2 p=vec2(uv.x,1.-uv.y)*viewport;
 vec4 english=at(englishTexture,p);
 vec2 delta=p-center;
 float distance=length(delta);
 if(opacity<.0001||distance>=radius+.6){gl_FragColor=mix(english,vec4(0.),overlayOnly);return;}
 vec2 normal=delta/max(distance,.001);
 float progress=clamp((distance-(radius-rimWidth))/max(rimWidth,.1),0.,1.);
 float annulus=sin(progress*3.14159265359);
 float radial=clamp(distance/max(radius,.1),0.,1.);
 float strength=min(abs(refraction)/7.,1.);
 // A shallow convex lens magnifies without blur and meets the native text at
 // its boundary. Channel separation is nearly absent at the centre and grows
 // cubically towards the perimeter, rather than forming a coloured outline.
 float convex=.10*strength*pow(1.-radial*radial,2.);
 vec2 warped=center+delta*(1.-convex)+normal*refraction*annulus;
 vec2 split=normal*rgbOffset*strength*pow(radial,3.);
 vec4 en=dispersed(englishTexture,warped,split);
 vec4 ja=dispersed(japaneseTexture,warped,split);
 float circle=1.-smoothstep(radius-.6,radius+.6,distance);
 vec4 inside=mix(en,ja,clamp(reveal,0.,1.));
 float mask=circle*clamp(opacity,0.,1.);
 gl_FragColor=mix(mix(english,inside,mask),inside*mask,overlayOnly);
}`;

export function createLandingLensRenderer(original) {
  const canvas = original.cloneNode();
  let gl, program, buffer, vertex, fragment;
  let textures = [], disposed = false, installed = false;
  const cleanup = () => {
    if (!gl || disposed) return;
    disposed = true;
    textures.forEach(texture => gl.deleteTexture(texture));
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return null;
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }
    vertex = compile(gl.VERTEX_SHADER, vertexSource);
    fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!gl.getShaderParameter(vertex, gl.COMPILE_STATUS) || !gl.getShaderParameter(fragment, gl.COMPILE_STATUS)) { cleanup(); return null; }
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { cleanup(); return null; }
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const names = ['englishTexture','japaneseTexture','viewport','center','paper','radius','rimWidth','refraction','rgbOffset','fringeOpacity','overlayOnly','opacity','reveal'];
    const uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
    gl.uniform1i(uniforms.englishTexture, 0);
    gl.uniform1i(uniforms.japaneseTexture, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    return {
      canvas,
      maxTextureSize,
      upload(images, width, height, pixelRatio, background) {
        if (disposed || gl.isContextLost() || images.length !== 2) return false;
        const next = [];
        try {
          images.forEach((image, index) => {
            const texture = gl.createTexture();
            next.push(texture);
            gl.activeTexture(gl.TEXTURE0 + index);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          });
          if (gl.getError() !== gl.NO_ERROR) throw new Error('Texture upload failed');
          textures.forEach(texture => gl.deleteTexture(texture));
          textures = next;
          canvas.width = Math.max(1, Math.ceil(width * pixelRatio));
          canvas.height = Math.max(1, Math.ceil(height * pixelRatio));
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform2f(uniforms.viewport, width, height);
          gl.uniform3fv(uniforms.paper, background);
          if (!installed) { original.replaceWith(canvas); installed = true; }
          return true;
        } catch {
          next.forEach(texture => gl.deleteTexture(texture));
          return false;
        }
      },
      render({ x, y, radius, rimWidth, refraction, rgbOffset, fringeOpacity = .70, overlayOnly = 0, opacity, reveal }) {
        if (disposed || !textures.length || gl.isContextLost()) return;
        gl.uniform2f(uniforms.center, x, y);
        for (const [name, value] of Object.entries({ radius, rimWidth, refraction, rgbOffset, fringeOpacity, overlayOnly, opacity, reveal })) gl.uniform1f(uniforms[name], value);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      dispose: cleanup,
    };
  } catch {
    cleanup();
    return null;
  }
}
