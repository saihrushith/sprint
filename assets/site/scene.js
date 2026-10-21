/* ==========================================================================
   SPRINT OVERSEAS — WebGL stage
   One fixed canvas. Every object is modelled here (no external models) and
   glued to invisible DOM "anchors" (.anchor) so layout stays responsive:
   an object glides between anchors as the page scrolls past them.
   ========================================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';

const SO = window.SO || (window.SO = { frameHooks: [], pointer: { x: 0, y: 0 }, route: 0, processP: 0, velocity: 0 });
SO.frameHooks = SO.frameHooks || [];
const setLoad = (v) => SO.setLoad && SO.setLoad(v);
const ready = () => { SO.readyAt = performance.now(); window.dispatchEvent(new Event('so:scene-ready')); };

const canvas = document.getElementById('stage');
const small = Math.min(window.innerWidth, window.innerHeight) < 700;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  canvas.remove();
  ready();
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.6 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.setClearColor(0x000000, 0);
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 0, 20);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

scene.add(new THREE.HemisphereLight(0x9cc0e8, 0x071a33, 0.7));
const key = new THREE.DirectionalLight(0xfff3e8, 2.4); key.position.set(6, 7, 9); scene.add(key);
const rim = new THREE.DirectionalLight(0xff8a45, 2.2); rim.position.set(-7, 3, -5); scene.add(rim);
const fill = new THREE.DirectionalLight(0x5b8abc, 0.9); fill.position.set(-5, -4, 7); scene.add(fill);

setLoad(30);

/* ---------- helpers ---------- */
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const bump = (p, a, b, c, d) => sstep(a, b, p) * (1 - sstep(c, d, p));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const C = { navy: '#0b2545', ink: '#071a33', o: '#f96d1f', o6: '#e0550e', gold: '#e3b76c', paper: '#fbf8f1' };
const F = { d: '"Space Grotesk", "Segoe UI", sans-serif', m: '"IBM Plex Mono", Consolas, monospace', b: '"Inter", "Segoe UI", sans-serif' };

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat, opts.repeat); }
  return t;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function noise(ctx, w, h, n, a, light = true) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = (Math.random() > .5) === light ? `rgba(255,255,255,${Math.random() * a})` : `rgba(0,0,0,${Math.random() * a})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
function spaced(ctx, text, x, y, sp, align = 'center') {
  const chars = [...text]; let total = 0;
  chars.forEach((ch) => { total += ctx.measureText(ch).width + sp; }); total -= sp;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const saved = ctx.textAlign; ctx.textAlign = 'left';
  chars.forEach((ch) => { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; });
  ctx.textAlign = saved;
}
function latLon(lat, lon, r = 1) {
  const phi = (90 - lat) * DEG, th = (lon + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}
function taperTube(curve, seg, radial, rFn) {
  const frames = curve.computeFrenetFrames(seg, false);
  const pos = [], tA = [], idx = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg; curve.getPointAt(t, P);
    const N = frames.normals[i], B = frames.binormals[i], r = rFn(t);
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2, s = Math.sin(v), c = -Math.cos(v);
      pos.push(P.x + r * (c * N.x + s * B.x), P.y + r * (c * N.y + s * B.y), P.z + r * (c * N.z + s * B.z));
      tA.push(t);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = (radial + 1) * i + j, b = (radial + 1) * (i + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tA, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const trailMat = (color, base = 0.0, len = 0.35) => new THREE.ShaderMaterial({
  uniforms: { uHead: { value: 1 }, uLen: { value: len }, uBase: { value: base }, uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 } },
  vertexShader: 'attribute float aT; varying float vT; void main(){ vT=aT; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform float uHead,uLen,uBase,uOpacity; uniform vec3 uColor; varying float vT;
    void main(){ float a = smoothstep(uHead-uLen, uHead, vT) * step(vT, uHead); a = max(a, uBase);
      a *= smoothstep(0.0, 0.03, vT); gl_FragColor = vec4(uColor*(0.7+a*1.3), a*uOpacity); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
});
const glowTex = canvasTex(128, 128, (ctx) => {
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,200,160,.55)'); g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
});

/* ==========================================================================
   MODELS
   ========================================================================== */

/* ---------- Airliner ---------- */
const jetMats = (() => {
  const livery = canvasTex(1024, 512, (ctx, w, h) => {
    // u = around the fuselage, v = tail(0) → nose(1). Sides at u≈0/1 and u≈.5, top at u≈.75.
    ctx.fillStyle = '#f5f7fa'; ctx.fillRect(0, 0, w, h);
    const band = (u, col, hh) => { ctx.fillStyle = col; ctx.fillRect(u * w - hh / 2, 0, hh, h); };
    // belly navy
    const gb = ctx.createLinearGradient(0.1 * w, 0, 0.4 * w, 0);
    gb.addColorStop(0, 'rgba(11,37,69,0)'); gb.addColorStop(.25, '#0b2545'); gb.addColorStop(.75, '#0b2545'); gb.addColorStop(1, 'rgba(11,37,69,0)');
    ctx.fillStyle = gb; ctx.fillRect(0.1 * w, 0, 0.3 * w, h);
    band(.445, C.o, 16); band(.055, C.o, 16); band(.425, '#0b2545', 6); band(.075, '#0b2545', 6);
    // windows along the cabin
    ctx.fillStyle = '#1b2a3d';
    for (const u of [.53, .97]) {
      for (let v = .22; v < .86; v += .018) { rr(ctx, u * w - 7, h - v * h - 5, 14, 10, 4); ctx.fill(); }
      // doors
      ctx.strokeStyle = 'rgba(27,42,61,.35)'; ctx.lineWidth = 2;
      for (const v of [.2, .88]) { rr(ctx, u * w - 16, h - v * h - 14, 32, 28, 6); ctx.stroke(); }
    }
    // cockpit
    ctx.fillStyle = '#121d2b';
    for (const u of [.57, .63, .87, .93]) { rr(ctx, u * w - 16, h - .955 * h - 8, 32, 16, 5); ctx.fill(); }
    // nose cone tint
    const gn = ctx.createLinearGradient(0, h * .03, 0, 0); gn.addColorStop(0, 'rgba(11,37,69,0)'); gn.addColorStop(1, '#0b2545');
    ctx.fillStyle = gn; ctx.fillRect(0, 0, w, h * .03);
  });
  return {
    body: new THREE.MeshPhysicalMaterial({ map: livery, roughness: .28, metalness: .05, clearcoat: 1, clearcoatRoughness: .12 }),
    wing: new THREE.MeshPhysicalMaterial({ color: 0xdfe5ec, roughness: .32, metalness: .35, clearcoat: .6 }),
    fin: new THREE.MeshPhysicalMaterial({ color: C.o, roughness: .3, metalness: .05, clearcoat: 1, clearcoatRoughness: .15 }),
    engine: new THREE.MeshPhysicalMaterial({ color: 0xcfd6df, roughness: .25, metalness: .7, clearcoat: .8 }),
    intake: new THREE.MeshStandardMaterial({ color: 0x0b1522, roughness: .6, metalness: .4 }),
    navy: new THREE.MeshPhysicalMaterial({ color: C.navy, roughness: .3, clearcoat: 1 }),
  };
})();
function buildJet() {
  const g = new THREE.Group();
  const prof = [[0, 0.02], [0.08, .14], [.25, .22], [.6, .27], [1.0, .29], [2.6, .29], [3.2, .27], [3.55, .22], [3.8, .15], [3.95, .07], [4.0, 0]]
    .map(([y, r]) => new THREE.Vector2(r, y)); // y from tail (0) to nose (4)
  // tail is slightly upswept: lift the first points
  const body = new THREE.LatheGeometry(prof, 48);
  const pa = body.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const y = pa.getY(i);
    if (y < 1.1) pa.setX(i, pa.getX(i) + Math.pow((1.1 - y) / 1.1, 2) * -0.16); // x is "down" after rotation → upsweep
  }
  body.computeVertexNormals();
  body.rotateZ(-Math.PI / 2); body.translate(-2, 0, 0);
  g.add(new THREE.Mesh(body, jetMats.body));

  const ext = (pts, depth, bevel = .02) => {
    const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
    geo.translate(0, 0, -depth / 2);
    return geo;
  };
  // main wings (shape in x/span plane → rotate flat)
  const wingL = ext([[.55, 0], [-.55, 0], [-1.05, 2.05], [-.8, 2.1]], .035);
  wingL.rotateX(Math.PI / 2);
  const wingR = wingL.clone(); wingR.scale(1, 1, -1);
  const wl = new THREE.Mesh(wingL, jetMats.wing); wl.position.set(.25, -.13, .18); wl.rotation.x = -.06;
  const wr = new THREE.Mesh(wingR, jetMats.wing); wr.position.set(.25, -.13, -.18); wr.rotation.x = .06;
  // wingtip fins (orange)
  const tipG = ext([[0, 0], [-.22, 0], [-.3, .32], [-.18, .32]], .02, .01);
  const tl = new THREE.Mesh(tipG, jetMats.fin); tl.position.set(-.55, -.02, 2.25);
  const tr = tl.clone(); tr.position.z = -2.25;
  // stabilisers
  const stabL = ext([[.0, 0], [-.55, 0], [-.85, .8], [-.62, .82]], .025);
  stabL.rotateX(Math.PI / 2);
  const stabR = stabL.clone(); stabR.scale(1, 1, -1);
  const sl = new THREE.Mesh(stabL, jetMats.wing); sl.position.set(-1.45, .12, .08);
  const sr = new THREE.Mesh(stabR, jetMats.wing); sr.position.set(-1.45, .12, -.08);
  // vertical fin
  const finG = ext([[-1.05, .15], [-1.85, .15], [-2.1, 1.25], [-1.78, 1.25]], .04);
  const fin = new THREE.Mesh(finG, jetMats.fin);
  g.add(wl, wr, tl, tr, sl, sr, fin);
  // engines
  for (const z of [.8, -.8]) {
    const eg = new THREE.Group();
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(.15, .12, .62, 32, 1, true), jetMats.engine); nac.rotation.z = Math.PI / 2;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(.145, .018, 12, 32), jetMats.engine); lip.rotation.y = Math.PI / 2; lip.position.x = .31;
    const fan = new THREE.Mesh(new THREE.CircleGeometry(.14, 32), jetMats.intake); fan.rotation.y = Math.PI / 2; fan.position.x = .28;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.05, .12, 16), jetMats.engine); cone.rotation.z = -Math.PI / 2; cone.position.x = .32;
    const exh = new THREE.Mesh(new THREE.ConeGeometry(.1, .2, 24, 1, true), jetMats.intake); exh.rotation.z = Math.PI / 2; exh.position.x = -.38;
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(.45, .14, .03), jetMats.wing); pylon.position.set(-.02, .14, 0);
    eg.add(nac, lip, fan, cone, exh, pylon);
    eg.position.set(.42, -.36, z);
    g.add(eg);
  }
  g.scale.setScalar(.25); // nose-to-tail length 1
  const wrap = new THREE.Group(); wrap.add(g);
  return wrap;
}

/* ---------- Globe ---------- */
function buildGlobe(maskImg) {
  const root = new THREE.Group();
  const tilt = new THREE.Group(), spin = new THREE.Group();
  root.add(tilt); tilt.add(spin);

  const W = small ? 1024 : 2048, H = W / 2;
  const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
  const mctx = mc.getContext('2d'); mctx.drawImage(maskImg, 0, 0, W, H);
  const md = mctx.getImageData(0, 0, W, H).data;
  const land = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) land[i] = md[i * 4] < 128 ? 1 : 0;

  const col = document.createElement('canvas'); col.width = W; col.height = H;
  const cctx = col.getContext('2d');
  const img = cctx.createImageData(W, H), d = img.data;
  const rough = document.createElement('canvas'); rough.width = W; rough.height = H;
  const rctx = rough.getContext('2d'); const rimg = rctx.createImageData(W, H), rd = rimg.data;
  const s = W / 2048;
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180;
    const polar = Math.abs(lat) / 90;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4;
      const L = land[i];
      let coast = 0;
      if (L) {
        const k = Math.max(1, Math.round(2 * s));
        if (!land[i - k] || !land[i + k] || !land[i - W * k] || !land[i + W * k]) coast = 1;
      }
      let r, g, b;
      if (L) {
        const n = (Math.sin(x * .021) * Math.cos(y * .027) + 1) * 3;
        r = 30 + n; g = 68 + n; b = 112 + n;
        if (coast) { r = 128; g = 172; b = 222; }
        if (polar > .78) { r += 40; g += 40; b += 40; }
      } else {
        r = 8 + polar * 6; g = 27 + polar * 8; b = 54 + polar * 10;
        const lonLine = (x % Math.round(W / 36)) === 0, latLine = (y % Math.round(H / 18)) === 0;
        if (lonLine || latLine) { r += 18; g += 30; b += 46; }
      }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      const rv = L ? 200 : 70; rd[o] = rd[o + 1] = rd[o + 2] = rv; rd[o + 3] = 255;
    }
  }
  cctx.putImageData(img, 0, 0); rctx.putImageData(rimg, 0, 0);
  const map = new THREE.CanvasTexture(col); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = MAX_ANISO;
  const rmap = new THREE.CanvasTexture(rough); rmap.colorSpace = THREE.NoColorSpace;
  const bmap = new THREE.CanvasTexture(mc); bmap.colorSpace = THREE.NoColorSpace;

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, small ? 72 : 110, small ? 48 : 80),
    new THREE.MeshPhysicalMaterial({ map, roughnessMap: rmap, roughness: 1, metalness: .05, bumpMap: bmap, bumpScale: -1.4, clearcoat: .3, clearcoatRoughness: .5, envMapIntensity: .32 })
  );
  spin.add(earth);

  // fresnel rim + outer atmosphere
  const fres = new THREE.ShaderMaterial({
    uniforms: { c1: { value: new THREE.Color('#8fc0ff') }, c2: { value: new THREE.Color(C.o) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 c1,c2; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.0-max(dot(vN,vV),0.0),3.4); vec3 c=mix(c1,c2,smoothstep(0.2,1.0,vN.x*0.6+vN.y*0.6)*0.6); gl_FragColor=vec4(c*f*0.75, f); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  tilt.add(new THREE.Mesh(new THREE.SphereGeometry(1.003, 64, 48), fres));
  const atmo = new THREE.ShaderMaterial({
    uniforms: { c1: { value: new THREE.Color('#3a7fd0') }, c2: { value: new THREE.Color('#ff7a2e') } },
    vertexShader: 'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 c1,c2; varying vec3 vN; void main(){ float i=pow(max(0.0,0.66-dot(vN,vec3(0.0,0.0,1.0))),3.0); vec3 c=mix(c1,c2,smoothstep(0.1,0.9,vN.x*0.6+vN.y*0.6)*0.55); gl_FragColor=vec4(c,1.0)*i*0.85; }',
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  root.add(new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 48), atmo));

  // routes: Indian consulate cities → US gateways
  const IN = { HYD: [17.385, 78.4867], BOM: [19.076, 72.8777], DEL: [28.6139, 77.209], MAA: [13.0827, 80.2707], CCU: [22.5726, 88.3639] };
  const US = { NYC: [40.7128, -74.006], SFO: [37.7749, -122.4194], CHI: [41.8781, -87.6298], IAH: [29.7604, -95.3698], BOS: [42.3601, -71.0589], DFW: [32.7767, -96.797], SEA: [47.6062, -122.3321], ATL: [33.749, -84.388] };
  const pairs = [['HYD', 'NYC', 1], ['HYD', 'SFO', 1], ['BOM', 'CHI'], ['DEL', 'BOS'], ['MAA', 'IAH'], ['CCU', 'SEA'], ['HYD', 'DFW'], ['DEL', 'ATL']];
  const arcs = [];
  const miniJet = buildJet();
  pairs.forEach(([a, b, plane], k) => {
    const va = latLon(...IN[a]), vb = latLon(...US[b]);
    const ang = va.angleTo(vb), alt = .1 + ang * .1;
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const v = new THREE.Vector3().copy(va).lerp(vb, t);
      // slerp on unit sphere
      const q = new THREE.Quaternion().setFromUnitVectors(va.clone().normalize(), vb.clone().normalize());
      const qt = new THREE.Quaternion().slerp(q, t);
      v.copy(va).applyQuaternion(qt).setLength(1.004 + Math.sin(Math.PI * t) * alt);
      pts.push(v);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const base = new THREE.Mesh(taperTube(curve, 120, 6, () => .0035), trailMat(C.o, .16, 1));
    const lit = new THREE.Mesh(taperTube(curve, 160, 8, (t) => .004 + .006 * Math.sin(Math.PI * t)), trailMat('#ffb27f', 0, .32));
    spin.add(base, lit);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    head.scale.setScalar(.09); spin.add(head);
    let jet = null;
    if (plane) { jet = miniJet.clone(); jet.scale.setScalar(.075); spin.add(jet); }
    arcs.push({ curve, lit, head, jet, speed: .07 + (k % 3) * .015, phase: k * .37 });
  });
  // city markers
  const ringGeo = new THREE.RingGeometry(.012, .02, 32);
  const markers = [];
  [...Object.values(IN), ...Object.values(US)].forEach(([la, lo], i) => {
    const p = latLon(la, lo, 1.003);
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: i < 5 ? C.o : 0x9cc8ff, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.position.copy(p); m.lookAt(p.clone().multiplyScalar(2)); spin.add(m);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(.007, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    dot.position.copy(p.clone().multiplyScalar(1.0005)); dot.lookAt(p.clone().multiplyScalar(2)); spin.add(dot);
    markers.push({ m, phase: i * .7 });
  });

  // logo swoosh orbit with arrowhead
  const orbit = new THREE.Group();
  const ring = [];
  for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 1.55; ring.push(new THREE.Vector3(Math.cos(a) * 1.34, 0, Math.sin(a) * 1.34)); }
  const ringCurve = new THREE.CatmullRomCurve3(ring);
  const sw = new THREE.Mesh(taperTube(ringCurve, 220, 10, (t) => .001 + .019 * Math.pow(t, 1.6)), trailMat(C.o, 0, 1.0));
  sw.material.uniforms.uHead.value = 1.0;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.045, .14, 24), new THREE.MeshBasicMaterial({ color: '#ff8a3d', toneMapped: false }));
  const tp = ringCurve.getPointAt(1), tt = ringCurve.getTangentAt(1);
  tip.position.copy(tp).addScaledVector(tt, .05);
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tt);
  orbit.add(sw, tip);
  orbit.rotation.set(1.22, 0, -.38);
  root.add(orbit);

  // face the HYD→NYC corridor
  const mid = latLon(...IN.HYD).add(latLon(...US.NYC)).normalize();
  const baseY = Math.atan2(-mid.x, mid.z) - .25;
  const zA = -mid.x * Math.sin(baseY) + mid.z * Math.cos(baseY);
  const baseX = Math.atan2(mid.y, zA) * .5;
  tilt.rotation.set(baseX, 0, .12);

  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  return {
    obj: root, w: 2, h: 2,
    update(t, s) {
      spin.rotation.y = baseY + Math.sin(t * .07) * .45 + (s.scrollSpin || 0);
      orbit.rotation.y = -t * .35;
      arcs.forEach((a) => {
        const h = ((t * a.speed + a.phase) % 1.45);
        a.lit.material.uniforms.uHead.value = h;
        const hp = Math.min(h, 1);
        a.curve.getPointAt(hp, tmp);
        a.head.position.copy(tmp);
        a.head.material.opacity = h > 1 ? Math.max(0, 1 - (h - 1) * 5) : sstep(0, .05, h);
        if (a.jet) {
          a.jet.visible = h < 1.02;
          a.jet.position.copy(tmp);
          a.curve.getPointAt(Math.min(hp + .01, 1), tmp2);
          a.jet.up.copy(tmp).normalize();
          a.jet.lookAt(tmp2);
          a.jet.rotateY(-Math.PI / 2);
        }
      });
      markers.forEach((mk) => {
        const k = ((t * .6 + mk.phase) % 1);
        mk.m.scale.setScalar(1 + k * 2.2);
        mk.m.material.opacity = (1 - k) * .9;
      });
    },
  };
}

/* ---------- Passport ---------- */
function buildPassport() {
  const W = 1.25, H = 1.76, CT = .028, PT = .1;
  const g = new THREE.Group();
  const coverArt = (ctx, w, h, mode) => {
    // mode: 'color' | 'metal' | 'rough'
    if (mode === 'color') {
      const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#11305a'); gr.addColorStop(1, '#091d3b');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); noise(ctx, w, h, 26000, .07);
    } else { ctx.fillStyle = mode === 'metal' ? '#000' : '#a8a8a8'; ctx.fillRect(0, 0, w, h); }
    const ink = mode === 'color' ? C.gold : mode === 'metal' ? '#fff' : '#3a3a3a';
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.textAlign = 'center';
    ctx.font = `600 34px ${F.m}`; spaced(ctx, 'SPRINT OVERSEAS', w / 2, 190, 12);
    ctx.font = `500 22px ${F.m}`; spaced(ctx, 'TRAVEL DOCUMENT', w / 2, 236, 10);
    // emblem: globe + swoosh
    const cx = w / 2, cy = h * .45, R = 210;
    ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 4;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(k) * 52 + 1, R, 0, 0, Math.PI * 2); ctx.stroke(); }
    for (let k = -2; k <= 2; k++) { const yy = cy + k * 75; const rr2 = Math.sqrt(Math.max(0, R * R - (k * 75) ** 2)); ctx.beginPath(); ctx.moveTo(cx - rr2, yy); ctx.lineTo(cx + rr2, yy); ctx.stroke(); }
    ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(cx, cy + 10, R * 1.45, R * .42, -.32, Math.PI * .92, Math.PI * 2.08); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + R * 1.28, cy - R * .62); ctx.lineTo(cx + R * 1.5, cy - R * .72); ctx.lineTo(cx + R * 1.36, cy - R * .48); ctx.closePath(); ctx.fill();
    ctx.font = `700 96px ${F.d}`; spaced(ctx, 'PASSPORT', w / 2, h * .79, 18);
    // e-passport chip mark
    ctx.lineWidth = 6; const cw = 92, ch = 58, cxx = w / 2 - cw / 2, cyy = h * .86;
    rr(ctx, cxx, cyy, cw, ch, 10); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, cyy + ch / 2, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cxx, cyy + ch / 2); ctx.lineTo(w / 2 - 17, cyy + ch / 2); ctx.moveTo(w / 2 + 17, cyy + ch / 2); ctx.lineTo(cxx + cw, cyy + ch / 2); ctx.stroke();
  };
  const cw = 1024, ch = 1442;
  const coverMap = canvasTex(cw, ch, (c, w, h) => coverArt(c, w, h, 'color'));
  const coverMetal = canvasTex(cw, ch, (c, w, h) => coverArt(c, w, h, 'metal'), { data: true });
  const coverRough = canvasTex(cw, ch, (c, w, h) => coverArt(c, w, h, 'rough'), { data: true });
  const grain = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); noise(c, w, h, 9000, .5); }, { data: true, repeat: 6 });
  const coverOut = new THREE.MeshPhysicalMaterial({ map: coverMap, metalnessMap: coverMetal, metalness: 1, roughnessMap: coverRough, roughness: 1, bumpMap: grain, bumpScale: .6, clearcoat: .25, clearcoatRoughness: .6 });
  const leather = new THREE.MeshPhysicalMaterial({ color: '#0c2648', roughness: .62, bumpMap: grain, bumpScale: .6, clearcoat: .2 });

  const guilloche = (ctx, w, h, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = 1.4;
    for (let k = 0; k < 46; k++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const y = k * (h / 44) + Math.sin(x * .012 + k * .45) * 22 + Math.sin(x * .031 - k * .2) * 9;
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  };
  const innerCover = canvasTex(cw, ch, (ctx, w, h) => {
    ctx.fillStyle = '#eef3f8'; ctx.fillRect(0, 0, w, h);
    guilloche(ctx, w, h, 'rgba(58,109,168,.18)');
    ctx.fillStyle = 'rgba(11,37,69,.08)'; ctx.font = `700 160px ${F.d}`; ctx.textAlign = 'center';
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 5); ctx.fillText('SPRINT', 0, 0); ctx.restore();
    ctx.fillStyle = 'rgba(11,37,69,.5)'; ctx.font = `500 22px ${F.m}`; spaced(ctx, 'SO-WEB-26', w / 2, h - 80, 8);
  });
  const visaPage = canvasTex(cw, ch, (ctx, w, h) => {
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
    guilloche(ctx, w, h, 'rgba(58,109,168,.16)');
    const rad = ctx.createRadialGradient(w * .7, h * .35, 20, w * .7, h * .35, 520); rad.addColorStop(0, 'rgba(249,109,31,.10)'); rad.addColorStop(1, 'rgba(249,109,31,0)');
    ctx.fillStyle = rad; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0b2545'; ctx.textAlign = 'left';
    ctx.font = `700 120px ${F.d}`; spaced(ctx, 'VISA', 70, 170, 14, 'left');
    ctx.font = `500 24px ${F.m}`; ctx.fillStyle = '#3a6da8'; spaced(ctx, 'B1/B2 · F-1 · NONIMMIGRANT', 74, 220, 5, 'left');
    ctx.fillStyle = '#e0550e'; ctx.fillRect(70, 250, 884, 5);
    // photo
    ctx.fillStyle = '#dfe7f0'; rr(ctx, 70, 300, 300, 380, 16); ctx.fill();
    ctx.fillStyle = '#9fb3c9'; ctx.beginPath(); ctx.arc(220, 450, 78, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(220, 660, 140, 110, 0, Math.PI, 0); ctx.fill();
    // fields
    const rows = [['SURNAME', 'TRAVELLER'], ['GIVEN NAMES', 'SPRINT CLIENT'], ['VISA TYPE / CLASS', 'B1/B2'], ['ENTRIES', 'M'], ['ANNOTATION', 'FILE BY SPRINT OVERSEAS']];
    rows.forEach(([k, v], i) => {
      const y = 330 + i * 76;
      ctx.fillStyle = '#5b7393'; ctx.font = `500 20px ${F.m}`; spaced(ctx, k, 410, y, 3, 'left');
      ctx.fillStyle = '#0b2545'; ctx.font = `600 34px ${F.d}`; ctx.fillText(v, 410, y + 38);
    });
    ctx.strokeStyle = 'rgba(11,37,69,.15)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(410, 382 + i * 76); ctx.lineTo(954, 382 + i * 76); ctx.stroke(); }
    // MRZ
    ctx.fillStyle = '#0b2545'; ctx.font = `500 40px ${F.m}`;
    ctx.fillText('V<SO<TRAVELLER<<SPRINT<CLIENT<<<<<<<', 70, h - 150);
    ctx.fillText('SO2026B1B2<<<<<<<<<<HYD<<<<<<<<<<<<<', 70, h - 92);
  });
  const edge = canvasTex(64, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f2ede1'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { ctx.fillStyle = `rgba(120,110,90,${.08 + Math.random() * .1})`; ctx.fillRect(0, y, w, 1); }
  });
  edge.wrapS = edge.wrapT = THREE.RepeatWrapping;
  const edgeMat = new THREE.MeshStandardMaterial({ map: edge, roughness: .9 });
  const pageMat = new THREE.MeshStandardMaterial({ map: visaPage, roughness: .9, color: 0xd2d2d2 });
  const innerMat = new THREE.MeshStandardMaterial({ map: innerCover, roughness: .9, color: 0xaab2bc });

  const back = new THREE.Mesh(new RoundedBoxGeometry(W, H, CT, 3, .012), leather);
  back.position.z = -(PT / 2 + CT / 2);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(W - .05, H - .06, PT), [edgeMat, edgeMat, edgeMat, edgeMat, pageMat, edgeMat]);
  pages.position.x = .015;
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(PT / 2 + CT, PT / 2 + CT, H, 24, 1, true, Math.PI, Math.PI), leather);
  spine.position.x = -W / 2 + .01;
  const pivot = new THREE.Group(); pivot.position.set(-W / 2, 0, PT / 2 + CT / 2);
  const front = new THREE.Mesh(new RoundedBoxGeometry(W, H, CT, 3, .012), [leather, leather, leather, leather, coverOut, innerMat]);
  front.position.x = W / 2;
  pivot.add(front);
  // stamp
  const stampTex = canvasTex(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = ctx.fillStyle = '#e0550e';
    ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, 236, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 214, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `600 34px ${F.m}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ringText = 'SPRINT OVERSEAS • VISA DESK • HYD • ';
    [...ringText].forEach((chr, i, arr) => { ctx.save(); ctx.rotate((i / arr.length) * Math.PI * 2); ctx.fillText(chr, 0, -183); ctx.restore(); });
    ctx.save(); ctx.rotate(-.18);
    ctx.fillRect(-250, -54, 500, 108);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.font = `700 84px ${F.d}`; ctx.fillText('APPROVED', 0, 6);
    ctx.restore();
    ctx.font = `700 28px ${F.m}`; ctx.fillText('★ ★ ★', 0, 98); ctx.fillText('SINCE 2021', 0, -96);
    // ink wear
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5200; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * .8})`; ctx.fillRect(Math.random() * w - w / 2, Math.random() * h - h / 2, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  });
  const stamp = new THREE.Mesh(new THREE.PlaneGeometry(.78, .78), new THREE.MeshBasicMaterial({ map: stampTex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  stamp.position.set(.2, -.38, PT / 2 + .004);
  g.add(back, pages, spine, pivot, stamp);

  return {
    obj: g, w: W, h: H,
    update(t, s) {
      const open = clamp(s.open || 0, 0, 1);
      pivot.rotation.y = -open * Math.PI * .96;
      const st = clamp(s.stamp || 0, 0, 1);
      const e = easeOut(st);
      stamp.material.opacity = sstep(0, .35, st) * .92;
      stamp.scale.setScalar(1 + (1 - e) * 1.6);
      stamp.rotation.z = -.22 + (1 - e) * .5;
      stamp.visible = st > .001 && open > .5;
    },
  };
}

/* ---------- Boarding pass ---------- */
function buildPass() {
  const W = 2.2, H = .86, T = .014;
  const front = canvasTex(2048, 800, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    const stubX = w * .72;
    ctx.fillStyle = '#0b2545'; ctx.fillRect(0, 0, stubX, 130);
    ctx.fillStyle = '#fff'; ctx.font = `700 50px ${F.d}`; ctx.textAlign = 'left'; spaced(ctx, 'BOARDING PASS', 70, 84, 8, 'left');
    ctx.font = `500 26px ${F.m}`; ctx.fillStyle = '#fb8a4b'; spaced(ctx, 'SPRINT OVERSEAS', stubX - 70, 82, 6, 'right');
    // route
    ctx.fillStyle = '#0b2545'; ctx.font = `700 170px ${F.d}`; ctx.fillText('HYD', 70, 360);
    ctx.textAlign = 'right'; ctx.fillText('JFK', stubX - 70, 360);
    ctx.textAlign = 'left'; ctx.font = `500 26px ${F.m}`; ctx.fillStyle = '#5b7393';
    spaced(ctx, 'HYDERABAD', 74, 410, 5, 'left'); spaced(ctx, 'NEW YORK', stubX - 74, 410, 5, 'right');
    // dashed path + plane
    ctx.strokeStyle = '#f96d1f'; ctx.lineWidth = 5; ctx.setLineDash([16, 14]);
    ctx.beginPath(); ctx.moveTo(470, 300); ctx.quadraticCurveTo(stubX / 2 + 70, 190, stubX - 470, 300); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(stubX / 2 + 70, 240); ctx.fillStyle = '#f96d1f';
    ctx.beginPath(); ctx.moveTo(44, 0); ctx.lineTo(-30, -10); ctx.lineTo(-40, -46); ctx.lineTo(-52, -46); ctx.lineTo(-44, -8); ctx.lineTo(-74, -6); ctx.lineTo(-84, -22); ctx.lineTo(-92, -22); ctx.lineTo(-88, 0);
    ctx.lineTo(-92, 22); ctx.lineTo(-84, 22); ctx.lineTo(-74, 6); ctx.lineTo(-44, 8); ctx.lineTo(-52, 46); ctx.lineTo(-40, 46); ctx.lineTo(-30, 10); ctx.closePath(); ctx.fill(); ctx.restore();
    // fields
    const fields = [['PASSENGER', 'YOU'], ['FLIGHT', 'SO 26'], ['VISA', 'B1/B2'], ['GATE', 'F-1'], ['SEAT', '1A']];
    const fw = (stubX - 140) / fields.length;
    ctx.strokeStyle = '#e3eaf2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(70, 480); ctx.lineTo(stubX - 70, 480); ctx.stroke();
    fields.forEach(([k, v], i) => {
      const x = 70 + i * fw;
      ctx.fillStyle = '#5b7393'; ctx.font = `500 24px ${F.m}`; spaced(ctx, k, x, 540, 4, 'left');
      ctx.fillStyle = '#0b2545'; ctx.font = `700 62px ${F.d}`; ctx.fillText(v, x, 618);
    });
    ctx.fillStyle = '#f96d1f'; ctx.fillRect(70, 680, stubX - 140, 8);
    ctx.fillStyle = '#5b7393'; ctx.font = `500 22px ${F.m}`; spaced(ctx, 'DOCUMENTED · FILED · INTERVIEW-PREPPED', 70, 740, 4, 'left');
    // stub
    const sg = ctx.createLinearGradient(stubX, 0, w, h); sg.addColorStop(0, '#f96d1f'); sg.addColorStop(1, '#e0550e');
    ctx.fillStyle = sg; ctx.fillRect(stubX, 0, w - stubX, h);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 5; ctx.setLineDash([14, 14]);
    ctx.beginPath(); ctx.moveTo(stubX, 20); ctx.lineTo(stubX, h - 20); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.font = `700 92px ${F.d}`; ctx.fillText('HYD', stubX + 60, 190); ctx.fillText('JFK', stubX + 60, 300);
    ctx.font = `500 24px ${F.m}`; spaced(ctx, 'SEAT 1A · ZONE 1', stubX + 64, 360, 4, 'left');
    for (let x = stubX + 60, i = 0; x < w - 60; i++) { const bw = [3, 6, 2, 9, 4][i % 5]; ctx.fillRect(x, 430, bw, 300); x += bw + [5, 3, 7, 4, 6][i % 5]; }
  });
  const backT = canvasTex(1024, 400, (ctx, w, h) => {
    ctx.fillStyle = '#0b2545'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(249,109,31,.5)'; ctx.lineWidth = 2;
    for (let i = -10; i < 30; i++) { ctx.beginPath(); ctx.moveTo(i * 50, 0); ctx.lineTo(i * 50 + 300, h); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.font = `700 64px ${F.d}`; ctx.textAlign = 'center'; spaced(ctx, 'SPRINT OVERSEAS', w / 2, h / 2 + 22, 10);
  });
  const edgeM = new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: .6 });
  const card = new THREE.Mesh(new RoundedBoxGeometry(W, H, T, 2, .007), [edgeM, edgeM, edgeM, edgeM,
    new THREE.MeshPhysicalMaterial({ map: front, roughness: .42, clearcoat: .6, clearcoatRoughness: .25 }),
    new THREE.MeshPhysicalMaterial({ map: backT, roughness: .5, clearcoat: .4 })]);
  const g = new THREE.Group(); g.add(card);
  return { obj: g, w: W, h: H, update() {} };
}

/* ---------- Mortarboard + diploma ---------- */
function buildCap() {
  const g = new THREE.Group();
  const fabric = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { c.fillStyle = `rgba(0,0,0,${.1 + Math.random() * .15})`; c.fillRect(0, y, w, 1); } }, { data: true, repeat: 4 });
  const cloth = new THREE.MeshPhysicalMaterial({ color: '#0e2240', roughness: .78, bumpMap: fabric, bumpScale: .8, sheen: .6, sheenColor: new THREE.Color('#5b8abc'), sheenRoughness: .5 });
  const orange = new THREE.MeshPhysicalMaterial({ color: C.o, roughness: .45, sheen: .5, sheenColor: new THREE.Color('#ffd2b3') });
  const board = new THREE.Mesh(new RoundedBoxGeometry(1.55, .055, 1.55, 3, .018), cloth); board.rotation.y = Math.PI / 4;
  const skull = new THREE.Mesh(new THREE.CylinderGeometry(.52, .6, .46, 48), cloth); skull.position.y = -.25;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.605, .61, .07, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: '#163759', roughness: .5, side: THREE.DoubleSide })); band.position.y = -.44;
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .045, 24), orange); btn.position.y = .05;
  const cordCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .06, 0), new THREE.Vector3(.35, .05, .2), new THREE.Vector3(.72, .035, .42), new THREE.Vector3(.86, -.05, .5), new THREE.Vector3(.88, -.32, .52)]);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 48, .013, 8), orange);
  const tassel = new THREE.Group();
  const knot = new THREE.Mesh(new THREE.SphereGeometry(.04, 16, 12), orange);
  const fringe = new THREE.Mesh(new THREE.CylinderGeometry(.035, .075, .26, 24, 4), orange); fringe.position.y = -.15;
  tassel.add(knot, fringe); tassel.position.set(.88, -.34, .52);
  const cap = new THREE.Group(); cap.add(board, skull, band, btn, cord, tassel);
  cap.rotation.set(.32, 0, -.12); cap.position.y = .22;
  // diploma
  const paper = new THREE.MeshPhysicalMaterial({ color: '#f6f1e6', roughness: .8 });
  const dip = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, 1.25, 32), paper);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(.07, .028, 10, 24, Math.PI * 1.5), paper); curl.position.y = .63; curl.rotation.y = Math.PI / 2;
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(.118, .022, 12, 40), orange); ribbon.rotation.x = Math.PI / 2;
  const bowL = new THREE.Mesh(new THREE.TorusGeometry(.07, .018, 10, 24), orange); bowL.position.set(.0, .02, .14); bowL.rotation.set(0, .5, .6);
  const bowR = bowL.clone(); bowR.rotation.set(0, -.5, -.6); bowR.position.set(0, -.02, .14);
  dip.add(roll, curl, ribbon, bowL, bowR);
  dip.rotation.set(.2, .3, 1.15); dip.position.set(-.05, -.62, .45);
  g.add(cap, dip);
  return { obj: g, w: 2, h: 1.8, update(t) { tassel.rotation.z = Math.sin(t * 1.6) * .12; tassel.rotation.x = Math.cos(t * 1.3) * .08; } };
}

/* ---------- DS-160 sheets ---------- */
function buildDocs() {
  const W = .92, H = 1.18;
  const sheet = (variant) => canvasTex(1024, 1312, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0b2545'; ctx.fillRect(0, 0, w, 150);
    ctx.fillStyle = '#fff'; ctx.font = `700 76px ${F.d}`; ctx.textAlign = 'left'; ctx.fillText('DS-160', 60, 100);
    ctx.font = `500 22px ${F.m}`; ctx.fillStyle = '#fb8a4b'; spaced(ctx, 'ONLINE NONIMMIGRANT VISA APPLICATION', w - 60, 96, 2, 'right');
    ctx.fillStyle = '#dfe7f0'; rr(ctx, w - 260, 200, 200, 250, 12); ctx.fill();
    ctx.fillStyle = '#9fb3c9'; ctx.beginPath(); ctx.arc(w - 160, 300, 52, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(w - 160, 440, 90, 70, 0, Math.PI, 0); ctx.fill();
    const labels = variant === 0 ? ['SURNAME', 'GIVEN NAMES', 'DATE OF BIRTH', 'PASSPORT NUMBER', 'PURPOSE OF TRIP', 'INTENDED ARRIVAL', 'US POINT OF CONTACT', 'EMPLOYER / SCHOOL']
      : ['PREVIOUS US TRAVEL', 'FAMILY INFORMATION', 'WORK / EDUCATION', 'SECURITY & BACKGROUND', 'TRAVEL COMPANIONS', 'ADDRESS', 'PHONE', 'EMAIL'];
    labels.forEach((l, i) => {
      const y = 220 + i * 118, fw = i < 3 ? w - 400 : w - 120;
      ctx.fillStyle = '#5b7393'; ctx.font = `500 22px ${F.m}`; spaced(ctx, l, 60, y, 3, 'left');
      ctx.strokeStyle = '#d5dfeb'; ctx.lineWidth = 3; rr(ctx, 60, y + 16, fw, 62, 10); ctx.stroke();
      ctx.fillStyle = '#c9d6e4'; ctx.fillRect(84, y + 40, fw * (.3 + ((i * 37) % 40) / 100), 14);
      // QC tick
      ctx.strokeStyle = '#f96d1f'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      const tx = 60 + fw - 46, ty = y + 47;
      ctx.beginPath(); ctx.moveTo(tx - 14, ty); ctx.lineTo(tx - 4, ty + 11); ctx.lineTo(tx + 16, ty - 13); ctx.stroke();
    });
    ctx.save(); ctx.translate(w - 230, h - 120); ctx.rotate(-.12);
    ctx.strokeStyle = '#e0550e'; ctx.fillStyle = '#e0550e'; ctx.lineWidth = 6; rr(ctx, -150, -52, 300, 104, 14); ctx.stroke();
    ctx.font = `700 46px ${F.d}`; ctx.textAlign = 'center'; ctx.fillText('QC ✓✓✓', 0, 16); ctx.restore();
  });
  const g = new THREE.Group();
  const sheets = [];
  const plain = new THREE.MeshStandardMaterial({ color: '#f3f5f8', roughness: .9 });
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.PlaneGeometry(W, H, 12, 12);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k); p.setZ(k, -.05 * Math.pow(x / (W / 2), 2) + .02 * Math.sin(y * 2.4 + i)); }
    geo.computeVertexNormals();
    const s = new THREE.Group();
    const fm = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: sheet(i === 2 ? 0 : 1), roughness: .9, color: 0xd6d6d6, side: THREE.FrontSide }));
    const bm = new THREE.Mesh(geo, plain); bm.material = plain.clone(); bm.material.side = THREE.BackSide;
    s.add(fm, bm);
    s.position.z = i * .03;
    g.add(s); sheets.push(s);
  }
  // paperclip
  const cp = [new THREE.Vector3(.02, -.1, 0), new THREE.Vector3(.02, .17, 0), new THREE.Vector3(.07, .22, 0), new THREE.Vector3(.12, .17, 0), new THREE.Vector3(.12, -.17, 0), new THREE.Vector3(.07, -.23, 0), new THREE.Vector3(-.01, -.2, 0), new THREE.Vector3(-.03, .1, 0)];
  const clip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 80, .009, 8), new THREE.MeshPhysicalMaterial({ color: 0xd9e0e8, metalness: 1, roughness: .18 }));
  clip.position.set(-W / 2 + .16, H / 2 - .1, .09);
  g.add(clip);
  return {
    obj: g, w: 1.25, h: 1.3,
    update(t, s) {
      const sp = s.spread == null ? 1 : s.spread;
      sheets[0].rotation.z = -.2 * sp; sheets[0].position.set(-.16 * sp, -.04 * sp, 0);
      sheets[1].rotation.z = .12 * sp; sheets[1].position.set(.14 * sp, .02 * sp, .03);
      sheets[2].rotation.z = -.02 * sp; sheets[2].position.set(0, .03 * sp, .06);
      sheets.forEach((sh, i) => { sh.position.y += Math.sin(t * 1.1 + i) * .012; });
    },
  };
}

/* ---------- Flip calendar ---------- */
function buildCalendar() {
  const W = 1.3, H = 1.46, D = .22;
  const page = (hi) => canvasTex(900, 840, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f96d1f'; ctx.fillRect(0, 0, w, 150);
    ctx.fillStyle = '#fff'; ctx.font = `600 30px ${F.m}`; ctx.textAlign = 'left'; spaced(ctx, 'EARLIEST DATE', 50, 70, 6, 'left');
    ctx.font = `700 46px ${F.d}`; ctx.fillText('Consulate slot', 50, 124);
    ctx.font = `500 22px ${F.m}`; ctx.fillStyle = '#5b7393';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((dname, i) => ctx.fillText(dname, 64 + i * 118, 205));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
      const n = r * 7 + c + 1; if (n > 31) continue;
      const x = 50 + c * 118, y = 230 + r * 112;
      const on = n === hi;
      if (on) { ctx.fillStyle = '#0b2545'; rr(ctx, x - 4, y - 4, 100, 96, 18); ctx.fill(); }
      ctx.fillStyle = on ? '#fff' : n < hi ? '#c3cfdc' : '#0b2545';
      ctx.font = `${on ? 700 : 500} 40px ${F.d}`; ctx.fillText(String(n), x + 18, y + 56);
      if (n < hi) { ctx.strokeStyle = '#d7e0ea'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 14, y + 70); ctx.lineTo(x + 76, y + 18); ctx.stroke(); }
      if (on) { ctx.fillStyle = '#f96d1f'; ctx.beginPath(); ctx.arc(x + 84, y + 4, 20, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 75, y + 4); ctx.lineTo(x + 82, y + 11); ctx.lineTo(x + 94, y - 4); ctx.stroke(); }
    }
  });
  const pages = [page(9), page(12), page(16)];
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, .05), new THREE.MeshPhysicalMaterial({ color: C.navy, roughness: .35, clearcoat: 1, clearcoatRoughness: .2 }));
  const pw = W - .12, ph = H - .22;
  const under = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: pages[1], roughness: .9, color: 0xd6d6d6 }));
  under.position.set(0, -.06, D / 2 + .002);
  const pivot = new THREE.Group(); pivot.position.set(0, -.06 + ph / 2, D / 2 + .006);
  const topF = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: pages[0], roughness: .9, color: 0xd6d6d6 }));
  const topB = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ color: '#eef2f6', roughness: .9, side: THREE.BackSide }));
  topF.position.y = topB.position.y = -ph / 2;
  pivot.add(topF, topB);
  const ringM = new THREE.MeshPhysicalMaterial({ color: 0xdfe5ec, metalness: 1, roughness: .2 });
  const rings = [-.36, -.12, .12, .36].map((x) => { const r = new THREE.Mesh(new THREE.TorusGeometry(.06, .014, 10, 28), ringM); r.position.set(x, ph / 2 - .02, D / 2 + .01); r.rotation.y = Math.PI / 2; return r; });
  const g = new THREE.Group(); g.add(body, under, pivot, ...rings);
  let cur = 0, lastCycle = -1;
  return {
    obj: g, w: W, h: H,
    update(t) {
      const period = 2.8, cyc = Math.floor(t / period), k = (t % period) / period;
      if (cyc !== lastCycle) {
        lastCycle = cyc; cur = (cur + 1) % 3;
        topF.material.map = pages[cur]; under.material.map = pages[(cur + 1) % 3];
        topF.material.needsUpdate = under.material.needsUpdate = true;
      }
      const f = sstep(.55, .95, k);
      pivot.rotation.x = -f * Math.PI * .98;
      pivot.visible = f < .99;
    },
  };
}

/* ==========================================================================
   STAGE — anchors, placements, choreography
   ========================================================================== */
const items = {};
SO.items = items;
function addItem(name, model) {
  const root = new THREE.Group(), inner = new THREE.Group();
  root.add(inner); inner.add(model.obj); scene.add(root);
  root.visible = false;
  items[name] = { name, root, inner, model, placements: [], presence: 0 };
  return items[name];
}

const anchorCache = new Map();
function anchorRect(id) {
  let a = anchorCache.get(id);
  if (!a) { a = { el: document.getElementById(id), r: null, frame: -1 }; anchorCache.set(id, a); }
  return a;
}

let frameNo = 0, vw = 1, vh = 1, upp = 1;
function resize() {
  vw = canvas.clientWidth || window.innerWidth; vh = canvas.clientHeight || window.innerHeight;
  renderer.setSize(vw, vh, false);
  camera.aspect = vw / vh; camera.updateProjectionMatrix();
  upp = (2 * Math.tan((camera.fov * DEG) / 2) * camera.position.z) / vh;
}
window.addEventListener('resize', resize);

const P = () => SO.processP || 0;
const routeGate = (i) => () => (SO.route === i ? 1 : 0);

function definePlacements() {
  const it = items;
  it.globe.placements = [
    { a: 'a-hero-globe', fill: .78, intro: true },
    { a: 'a-cta-globe', fill: .86 },
    { a: 'a-process', fill: .7, dx: 0, dy: .02, z: -2, gate: () => 1 - sstep(.3, .85, P()) },
  ];
  it.passport.placements = [
    { a: 'a-hero-passport', fill: .92, rot: [.42, .62, -.28], params: { open: 0, stamp: 0 }, intro: true, float: 1 },
    { a: 'a-about-passport', fill: .74, dx: .26, rot: [.32, .1, .04], params: { open: 1, stamp: 1 }, float: 1 },
    {
      a: 'a-process', fill: .62, float: .6,
      dyn: () => {
        const p = P();
        const toCenter = sstep(.4, 1.2, p), toSide = sstep(3.3, 3.9, p);
        return {
          dx: lerp(lerp(.24, .1 + sstep(1.55, 2.2, p) * .16, toCenter), .02, toSide), dy: lerp(lerp(-.16, 0, toCenter), -.16, toSide),
          fill: lerp(lerp(.42, .6, toCenter), .44, toSide),
          rot: [lerp(.3, .22, toCenter), lerp(.7, .08, sstep(1.4, 2.2, p)), lerp(-.15, .03, toCenter)],
          params: { open: sstep(1.55, 2.2, p), stamp: sstep(2.3, 2.75, p) },
        };
      },
    },
  ];
  it.pass.placements = [
    { a: 'a-hero-pass', fill: .95, rot: [-.35, -.42, .16], intro: true, float: 1, fit: 'w' },
    { a: 'a-route', fill: .9, rot: [-.25, -.5, .12], gate: routeGate(0), float: 1, fit: 'w', dy: .08 },
    { a: 'a-process', fill: .56, fit: 'w', dx: .26, dy: -.3, z: 1, rot: [-.3, -.55, .2], float: 1, gate: () => bump(P(), 2.55, 3.05, 4.6, 5) },
  ];
  it.jet.placements = [
    { a: 'a-route', fill: .55, fit: 'w', dx: -.12, dy: -.3, z: 1.5, rot: [-.32, .42, .2], gate: routeGate(0), float: 1, params: { fly: 1 } },
    {
      a: 'a-process', fit: 'w', gate: () => sstep(3.25, 3.75, P()),
      dyn: () => {
        const k = sstep(3.25, 4, P());
        return { dx: lerp(-.55, .1, k), dy: lerp(-.5, .26, k), fill: lerp(.45, .72, k), z: 1.5, rot: [lerp(-.1, -.3, k), lerp(.8, .45, k), lerp(.5, .26, k)], params: { fly: 1 } };
      },
    },
  ];
  it.cap.placements = [{ a: 'a-route', fill: .8, rot: [.2, -.3, 0], gate: routeGate(1), float: 1 }];
  it.docs.placements = [
    { a: 'a-route', fill: .86, rot: [.1, -.35, 0], gate: routeGate(2), float: 1, params: { spread: 1 } },
    { a: 'a-process', fill: .6, dx: -.24, dy: .08, z: -1, rot: [.12, .35, 0], float: 1, gate: () => bump(P(), .45, .95, 2.05, 2.5), dyn: () => ({ params: { spread: sstep(.6, 1.3, P()) } }) },
  ];
  it.cal.placements = [
    { a: 'a-route', fill: .8, rot: [.12, -.4, 0], gate: routeGate(3), float: 1 },
    { a: 'a-process', fill: .44, dx: .3, dy: .2, z: -.6, rot: [.15, -.45, .05], float: 1, gate: () => bump(P(), 1.6, 2.05, 2.85, 3.3) },
  ];
  Object.values(items).forEach((item) => item.placements.forEach((pl) => { pl.g = pl.gate ? pl.gate() : 1; }));
}

const tmpV = new THREE.Vector3();
let intro = 0, introStart = -1, clockT = 0, last = performance.now(), scrollSpin = 0, lastScroll = window.scrollY;

function updateItem(item, t, dt) {
  let wSum = 0, pres = 0;
  let x = 0, y = 0, z = 0, sc = 0, rx = 0, ry = 0, rz = 0, fl = 0;
  const params = {};
  const pw = {};
  for (const pl of item.placements) {
    const a = anchorRect(pl.a);
    if (!a.el) continue;
    if (a.frame !== frameNo) { a.r = a.el.getBoundingClientRect(); a.frame = frameNo; }
    const r = a.r;
    if (!r.width || !r.height) continue;
    const cy = r.top + r.height / 2, cx = r.left + r.width / 2;
    const range = vh / 2 + r.height / 2;
    const v = clamp(1 - Math.abs(cy - vh / 2) / range, 0, 1);
    const target = pl.gate ? pl.gate() : 1;
    pl.g += (target - pl.g) * Math.min(1, dt * (pl.gate && pl.a === 'a-route' ? 5 : 9));
    let presence = sstep(0, .22, v) * pl.g;
    if (pl.intro) presence *= intro;
    const w = Math.pow(v, 3) * pl.g + 1e-6 * presence;
    if (presence < .0005) continue;
    const d = pl.dyn ? pl.dyn() : {};
    const dx = d.dx ?? pl.dx ?? 0, dy = d.dy ?? pl.dy ?? 0, fill = d.fill ?? pl.fill ?? .9, rot = d.rot ?? pl.rot ?? [0, 0, 0];
    const ax = (cx + dx * r.width - vw / 2) * upp, ay = -(cy - dy * r.height - vh / 2) * upp;
    const fitW = (r.width * upp) / item.model.w, fitH = (r.height * upp) / item.model.h;
    const s = (pl.fit === 'w' ? fitW : Math.min(fitW, fitH)) * fill;
    x += ax * w; y += ay * w; z += (d.z ?? pl.z ?? 0) * w; sc += s * w;
    rx += rot[0] * w; ry += rot[1] * w; rz += rot[2] * w; fl += (pl.float || 0) * w;
    const pp = { ...(pl.params || {}), ...(d.params || {}) };
    for (const k in pp) { params[k] = (params[k] || 0) + pp[k] * w; pw[k] = (pw[k] || 0) + w; }
    wSum += w; pres = Math.max(pres, presence);
  }
  item.presence += (pres - item.presence) * Math.min(1, dt * 10);
  if (item.presence < .002 || wSum <= 0) { item.root.visible = false; return false; }
  x /= wSum; y /= wSum; z /= wSum; sc /= wSum; rx /= wSum; ry /= wSum; rz /= wSum; fl /= wSum;
  for (const k in params) params[k] /= pw[k];
  const e = easeOut(clamp(item.presence, 0, 1));
  item.root.visible = true;
  item.root.position.set(x, y + fl * Math.sin(t * .9 + item.name.length) * .06 * sc, z);
  item.root.scale.setScalar(Math.max(.0001, sc * (.35 + .65 * e)));
  const px = SO.pointer.x || 0, py = SO.pointer.y || 0;
  item.root.rotation.set(
    rx - py * .14 + fl * Math.sin(t * .7 + 1) * .05,
    ry + px * .22 + (1 - e) * 1.1 + fl * Math.sin(t * .5) * .08,
    rz + fl * Math.cos(t * .6) * .03
  );
  params.scrollSpin = scrollSpin;
  item.model.update(t, params);
  if (item.name === 'jet') {
    // flying pose: gentle bank + pitch
    item.inner.rotation.set(Math.sin(t * .8) * .08, 0, Math.sin(t * .6) * .05 + .05);
  }
  return true;
}

function frame() {
  const now = performance.now();
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!reduced) clockT += dt;
  frameNo++;
  if (introStart < 0 && document.body.classList.contains('is-loaded')) introStart = now;
  intro = introStart < 0 ? 0 : easeOut(clamp((now - introStart - 250) / 1600, 0, 1));
  const sy = window.scrollY; const dv = sy - lastScroll; lastScroll = sy;
  scrollSpin += reduced ? 0 : dv * .0006;
  let any = false;
  for (const k in items) any = updateItem(items[k], clockT, dt) || any;
  if (any || frameNo < 3) renderer.render(scene, camera);
  else if (frameNo % 30 === 0) renderer.clear();
}

/* ---------- boot ---------- */
async function boot() {
  resize();
  const fontsReady = document.fonts ? Promise.race([
    Promise.all([
      document.fonts.load(`700 40px ${F.d}`), document.fonts.load(`600 40px ${F.d}`),
      document.fonts.load(`500 20px ${F.m}`), document.fonts.load(`600 20px ${F.m}`),
    ]),
    new Promise((r) => setTimeout(r, 1800)),
  ]) : Promise.resolve();
  const maskP = new Promise((res) => {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = 'assets/3d/earth-water.png';
  });
  await fontsReady;
  setLoad(55);
  addItem('passport', buildPassport());
  addItem('pass', buildPass());
  addItem('jet', { obj: buildJet(), w: 1.05, h: .55, update() {} });
  addItem('cap', buildCap());
  addItem('docs', buildDocs());
  addItem('cal', buildCalendar());
  setLoad(75);
  const mask = await maskP;
  if (mask) addItem('globe', buildGlobe(mask));
  else {
    const fallback = { obj: new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshPhysicalMaterial({ color: '#163759', roughness: .4, clearcoat: .5 })), w: 2, h: 2, update() {} };
    addItem('globe', fallback);
  }
  definePlacements();
  setLoad(90);
  // warm up every object once so shaders compile before the first scroll
  Object.values(items).forEach((i) => { i.root.visible = true; i.root.scale.setScalar(.0001); });
  try { renderer.compile(scene, camera); renderer.render(scene, camera); } catch (e) { /* noop */ }
  Object.values(items).forEach((i) => { i.root.visible = false; });
  SO.frameHooks.push(frame); // driven by app.js's single frame clock
  canvas.classList.add('is-ready');
  ready();
}
boot().catch((e) => { console.error(e); ready(); });
