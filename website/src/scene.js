// A source-image wind field: one texture, no substituted art or duplicated character layers.
const vertex = `
attribute vec2 position;
varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision highp float;
uniform sampler2D plate;
uniform float time;
uniform vec2 sourceSize;
varying vec2 uv;
float ellipse(vec2 p,vec2 c,vec2 r){return 1.-smoothstep(.65,1.,length((p-c)/r));}
void main(){
  vec2 p=vec2(uv.x,1.-uv.y);
  vec3 col=texture2D(plate,vec2(p.x,1.-p.y)).rgb;
  float phase=time*6.2831853/24.;
  vec2 delta=vec2(0.);

  // Green/yellow plants only, below the hill crest. Skin, shirt and teal robot are excluded.
  float hill=smoothstep(.39+.49*p.x,.48+.49*p.x,p.y);
  float green=smoothstep(.012,.10,col.g-col.r)*smoothstep(.06,.19,col.g-col.b);
  float flower=smoothstep(.20,.45,min(col.r,col.g)-col.b)*smoothstep(.40,.65,col.g);
  float boy=ellipse(p,vec2(.24,.635),vec2(.19,.18));
  float robot=ellipse(p,vec2(.318,.642),vec2(.085,.135));
  float plants=max(green,flower)*hill*(1.-boy)*(1.-robot);
  float depth=smoothstep(.49,1.,p.y);
  float gust=sin(phase*4.-p.x*20.+p.y*12.)*.60+sin(phase*7.-p.x*39.-p.y*17.)*.26+sin(phase*3.+p.x*65.)*.14;
  float blades=.62+.38*sin(p.x*290.+p.y*170.);
  delta.x+=plants*depth*(2.+5.*depth)*gust*blades;
  delta.y+=plants*depth*1.4*sin(phase*4.-p.x*20.+p.y*12.+.8);

  // Independently phased hair tufts; the warm face and ear are excluded by source colour.
  float hairArea=ellipse(p,vec2(.133,.539),vec2(.057,.103));
  float darkHair=1.-smoothstep(.24,.43,max(col.r,max(col.g,col.b)));
  float hair=hairArea*darkHair*(1.-smoothstep(.54,.625,p.y));
  float hairWind=sin(phase*5.+p.x*85.)*.72+sin(phase*9.+p.y*33.)*.28;
  delta.x+=hair*3.6*hairWind;
  delta.y+=hair*1.3*sin(phase*5.+p.x*85.+.5);

  // A small cloth ripple, with the body contour and hands anchored.
  float shirt=ellipse(p,vec2(.205,.643),vec2(.065,.038))*smoothstep(.50,.74,min(col.r,col.g))*smoothstep(-.04,.02,col.b-col.r+.13);
  delta.x+=shirt*.9*sin(phase*4.+p.x*100.);
  delta.y+=shirt*.65*sin(phase*4.+p.x*100.+.7);

  // Broad, slow sky drift. A broad sky mask transports cloud edges as well as their interiors.
  float sky=(1.-smoothstep(.38,.65,p.y))*(1.-boy)*(1.-robot);
  float cloudDrift=sin(phase)*5.5;
  delta.x+=sky*cloudDrift;
  delta.y+=sky*.55*sin(phase*2.+p.x*3.);

  // Only antenna tips/stalks sway. The robot's eyes, face, chest and body stay fixed.
  float antennaLeft=ellipse(p,vec2(.258,.541),vec2(.017,.029));
  float antennaRight=ellipse(p,vec2(.307,.526),vec2(.014,.029));
  delta.x+=antennaLeft*1.7*sin(phase*3.+.3)+antennaRight*1.45*sin(phase*3.+.95);
  delta.y+=antennaLeft*.45*sin(phase*3.+1.3)+antennaRight*.4*sin(phase*3.+1.95);

  vec2 samplePoint=clamp(p+delta/sourceSize,vec2(.0003),vec2(.9997));
  gl_FragColor=texture2D(plate,vec2(samplePoint.x,1.-samplePoint.y));
}`;

export async function createScene(canvas, poster, button) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const label = button.querySelector('.motion-label');
  let userPaused = false;
  let inView = true;
  let raf = 0;
  let elapsed = 0;
  let last = 0;
  let accumulated = 0;
  let gl;
  let program;
  let timeLocation;
  let failed = false;
  let frames = 0;
  const saveData = navigator.connection?.saveData;

  function updateButton() {
    const staticOnly = reduced.matches || failed || saveData;
    button.disabled = Boolean(staticOnly);
    button.setAttribute('aria-pressed', String(userPaused || staticOnly));
    const text = reduced.matches ? 'Reduced motion' : staticOnly ? 'Still scene' : userPaused ? 'Play scene' : 'Pause scene';
    label.textContent = text;
    button.setAttribute('aria-label', staticOnly ? text : `${userPaused ? 'Play' : 'Pause'} environmental motion`);
  }
  function fallback() {
    failed = true;
    stop();
    canvas.classList.remove('is-ready');
    canvas.dataset.state = 'static';
    updateButton();
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    accumulated = 0;
  }
  function paint() {
    gl.uniform1f(timeLocation, elapsed % 24);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    frames++;
    canvas.dataset.frames = String(frames);
  }
  function frame(now) {
    if (!last) last = now;
    const step = now - last;
    elapsed += Math.min(step, 80) / 1000;
    accumulated += step;
    last = now;
    if (accumulated >= 1000 / 30) {
      paint();
      accumulated %= 1000 / 30;
    }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    updateButton();
    if (!gl || failed) return;
    const running = !userPaused && !reduced.matches && !saveData && inView && !document.hidden;
    canvas.dataset.state = running ? 'running' : 'paused';
    if (reduced.matches) canvas.classList.remove('is-ready');
    else canvas.classList.add('is-ready');
    if (running && !raf) raf = requestAnimationFrame(frame);
    else if (!running) stop();
  }
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('Scene shader unavailable');
    return result;
  }
  function resize() {
    if (!gl || failed) return;
    const bounds = canvas.getBoundingClientRect();
    // Bound GPU work on student laptops and phones; a still poster loads independently.
    const width = Math.min(1672, Math.round(bounds.width * Math.min(devicePixelRatio, 1.25)));
    canvas.width = width;
    canvas.height = Math.round(width * poster.naturalHeight / poster.naturalWidth);
    gl.viewport(0, 0, canvas.width, canvas.height);
    paint();
  }
  async function init() {
    if (gl || failed || reduced.matches || saveData) { sync(); return; }
    try {
      await poster.decode();
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
      if (!gl) throw new Error('WebGL unavailable');
      const vs = shader(gl.VERTEX_SHADER, vertex);
      const fs = shader(gl.FRAGMENT_SHADER, fragment);
      program = gl.createProgram();
      gl.attachShader(program, vs);gl.attachShader(program, fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Scene program unavailable');
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, poster);
      gl.uniform1i(gl.getUniformLocation(program, 'plate'), 0);
      gl.uniform2f(gl.getUniformLocation(program, 'sourceSize'), poster.naturalWidth, poster.naturalHeight);
      timeLocation = gl.getUniformLocation(program, 'time');
      resize();sync();
    } catch { fallback(); }
  }
  button.addEventListener('click', () => { userPaused = !userPaused;sync(); });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', sync);
  reduced.addEventListener('change', () => { if (!reduced.matches && !gl) init(); else sync(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault();fallback(); });
  const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting;sync(); }, { rootMargin: '0px', threshold: 0 });
  observer.observe(canvas.parentElement);
  const sizes = new ResizeObserver(resize);
  sizes.observe(canvas.parentElement);
  updateButton();
  // Let the headline entrance and first content paint finish before compiling scene shaders.
  setTimeout(() => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => init(), { timeout: 800 });
    else init();
  }, 1400);
}
