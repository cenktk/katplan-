/* 3D sahne, gezinti modu ve window.View3D API'si.
 * <script type="module"> olarak yüklenir. Klasik betiğin globallerini (WALLS, state, select ...) kullanır.
 * Mobilya modelleri window.Models3D.buildFurniture(f, opts) ile gelir (yoksa kutu yer tutucu). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/* ------------------------------------------------------------------ yardımcılar */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const isEn = () => /^en/i.test(document.documentElement.lang || '');
const L = (t, e) => (typeof window.tr === 'function' ? window.tr(t, e) : (isEn() ? e : t));
const coarse = () => { try { return matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Klasik betik globalleri (const/let ile tanımlı olsalar da çıplak ad ile erişilir)
const gState = () => (typeof state !== 'undefined' ? state : window.state) || { furniture: [], rooms: {}, demolished: [], measures: [] };
const gUi = () => (typeof ui !== 'undefined' ? ui : window.ui) || {};
const gView = () => (typeof view !== 'undefined' ? view : window.view);
const gWalls = () => (typeof WALLS !== 'undefined' ? WALLS : window.WALLS) || [];
const gWins = () => (typeof WINS !== 'undefined' ? WINS : window.WINS) || [];
const gDoors = () => (typeof DOORS !== 'undefined' ? DOORS : window.DOORS) || [];
const gSlides = () => (typeof SLIDES !== 'undefined' ? SLIDES : window.SLIDES) || [];
const gRooms = () => (typeof ROOMS !== 'undefined' ? ROOMS : window.ROOMS) || [];
const gMats = () => (typeof MATS !== 'undefined' ? MATS : window.MATS);
const gNamesEn = () => (typeof NAMES_EN !== 'undefined' ? NAMES_EN : window.NAMES_EN) || {};
const gOX = () => (typeof OX !== 'undefined' ? OX : window.OX) || 0;
const gOY = () => (typeof OY !== 'undefined' ? OY : window.OY) || 0;
const gH = () => { const h = (typeof H !== 'undefined' ? H : window.H); return typeof h === 'number' ? (h > 20 ? h / 1000 : h) : 2.8; };
const call = (name, ...a) => { const f = window[name]; return typeof f === 'function' ? f(...a) : undefined; };

const X = mm => (mm - gOX()) / 1000;
const Z = mm => (mm - gOY()) / 1000;
const toMmX = x => x * 1000 + gOX();
const toMmY = z => z * 1000 + gOY();

function nm(name) {
  if (typeof window.nm === 'function') return window.nm(name);
  return isEn() ? (gNamesEn()[name] || name) : name;
}
function roomName(r) {
  const st = gState();
  const n = (st.rooms && st.rooms[r.id] && st.rooms[r.id].name) || r.name;
  return nm(n);
}
function roomMat(r) {
  const st = gState();
  return (st.rooms && st.rooms[r.id] && st.rooms[r.id].mat) || r.mat;
}
function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2 / 1e6;
}
function matInfo(key) {
  const M = gMats();
  if (!M) return null;
  if (Array.isArray(M)) return M.find(m => m && (m.key === key || m.id === key)) || null;
  return M[key] || null;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shade(hex, k) {
  const c = new THREE.Color(hex);
  return '#' + new THREE.Color(clamp(c.r * k, 0, 1), clamp(c.g * k, 0, 1), clamp(c.b * k, 0, 1)).getHexString();
}
function fmtHour(h) {
  let hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  if (mm === 60) { hh++; mm = 0; }
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

/* ------------------------------------------------------------------ durum */
const opt = { cut: 2.8, furn: true, labels: true, night: false, hour: 10 };
let inited = false, active = false, busyAnim = false;
let mode = 'orbit';            // 'orbit' | 'walk'
let touchWalk = false, locked = false;
let grow = 1, furnGrow = 1;
let modelsReady = !!(window.Models3D && window.Models3D.buildFurniture);
let renderer, labelRenderer, scene, camera, controls, plc, sun, hemi, ground, envTex;
let mainEl, hostEl;
let floorsG, archUp, archPick, archDeco, walkG, furnG, labelsG, lampG;
let doors = [], colliders = [], furnMap = new Map(), labelObjs = [], lamps = [];
let sigArch = '', sigFurn = '', sigLabel = '', sigList = '';
let boxHelper = null, boxHelperId = null;
let raf = 0, lastT = 0;
const anims = [];
let flyAnim = null, flying = false;
let activeRoomBtn = null;
const envMats = new Set();
const matCache = new Map();
const texCache = new Map();
const floorMatCache = new Map();
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3();

/* ------------------------------------------------------------------ malzemeler */
function needsEnv(m) { return (m.metalness || 0) > 0 || (m.roughness !== undefined && m.roughness < 0.4); }
function envBase(m) { return (m.metalness || 0) > 0.5 ? 1 : 0.5; }
function applyEnv(m) {
  if (!envTex || !needsEnv(m)) return;
  m.envMap = envTex;
  m.userData._envBase = m.userData._envBase || envBase(m);
  m.envMapIntensity = m.userData._envBase * (opt.night ? 0.15 : 1);
  envMats.add(m);
}
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o));
    applyEnv(m);
    matCache.set(key, m);
  }
  return m;
}

/* ---- zemin dokuları (§6.7) */
const FLOOR_DEF = {
  wood:     { w: 1024, h: 205, sx: 1.8, sy: 0.36, base: '#d6b58a', rough: .55, kind: 'plank' },
  walnut:   { w: 1024, h: 205, sx: 1.8, sy: 0.36, base: '#9a6f4b', rough: .5, kind: 'plank' },
  tile800:  { w: 512, h: 512, sx: .8, sy: .8, base: '#ebe6dd', rough: .3, kind: 'tile', grout: '#cfc6b7' },
  tile600:  { w: 512, h: 512, sx: .6, sy: .6, base: '#dfe3e0', rough: .35, kind: 'tile', grout: '#bfc6c1' },
  antislip: { w: 512, h: 512, sx: .3, sy: .3, base: '#d3d8d4', rough: .8, kind: 'tile', grout: '#aab2ac' },
  marble:   { w: 512, h: 512, sx: 1.2, sy: 1.2, base: '#f2efe9', rough: .18, kind: 'marble', grout: '#d9d2c4' },
  terrazzo: { w: 512, h: 512, sx: .5, sy: .5, base: '#e6dfd3', rough: .4, kind: 'terrazzo' },
  carpet:   { w: 512, h: 512, sx: .3, sy: .3, base: '#c6bfd2', rough: 1, kind: 'carpet' },
};
const FLOOR_ALIAS = { laminat: 'wood', parke: 'walnut', seramik: 'tile600', granit: 'terrazzo', 'dis-seramik': 'antislip' };

function makeFloorTexture(key, d) {
  const cv = document.createElement('canvas');
  cv.width = d.w; cv.height = d.h;
  const c = cv.getContext('2d');
  const rnd = mulberry32(key.length * 977 + 13);
  c.fillStyle = d.base; c.fillRect(0, 0, d.w, d.h);
  const speck = (n, amax) => {
    for (let i = 0; i < n; i++) { c.fillStyle = 'rgba(0,0,0,' + (rnd() * amax).toFixed(3) + ')'; c.fillRect(rnd() * d.w, rnd() * d.h, 2, 2); }
  };
  if (d.kind === 'plank') {
    const rows = 2, rh = d.h / rows;
    for (let r = 0; r < rows; r++) {
      const j = r === 0 ? d.w * 2 / 3 : d.w / 3;
      [[0, j], [j, d.w]].forEach(([a, b]) => {
        c.fillStyle = shade(d.base, 0.90 + rnd() * 0.20);
        c.fillRect(a, r * rh, b - a, rh);
      });
      c.fillStyle = shade(d.base, 0.62); c.fillRect(j - 1.5, r * rh, 3, rh);
    }
    for (let k = 0; k < 7; k++) {
      const y0 = rnd() * d.h;
      c.beginPath();
      for (let x = 0; x <= d.w; x += 8) { const y = y0 + Math.sin(x * 0.02 + k) * 2.5; x === 0 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.strokeStyle = shade(d.base, 0.8); c.globalAlpha = 0.35; c.lineWidth = 1.2; c.stroke(); c.globalAlpha = 1;
    }
    c.fillStyle = shade(d.base, 0.55);
    for (let r = 0; r < rows; r++) c.fillRect(0, r * rh - 1.25, d.w, 2.5);
  } else if (d.kind === 'tile' || d.kind === 'marble') {
    if (d.kind === 'marble') {
      for (let i = 0; i < 6; i++) {
        c.beginPath(); c.moveTo(rnd() * d.w, rnd() * d.h);
        c.bezierCurveTo(rnd() * d.w, rnd() * d.h, rnd() * d.w, rnd() * d.h, rnd() * d.w, rnd() * d.h);
        c.lineWidth = 1 + rnd() * 3; c.strokeStyle = 'rgba(160,150,135,.35)'; c.stroke();
      }
    }
    c.fillStyle = d.grout; c.fillRect(0, 0, d.w, 3); c.fillRect(0, 0, 3, d.h);
    if (d.kind === 'tile') speck(1500, 0.04);
  } else if (d.kind === 'terrazzo') {
    const cols = ['#b9a58c', '#8fa3a0', '#c9b7a2', '#a88f76', '#7e8a86'];
    for (let i = 0; i < 160; i++) {
      c.beginPath(); c.arc(rnd() * d.w, rnd() * d.h, 2 + rnd() * 7, 0, Math.PI * 2);
      c.fillStyle = cols[i % cols.length]; c.fill();
    }
  } else if (d.kind === 'carpet') {
    speck(2600, 0.09);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / d.sx, 1 / d.sy);
  t.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
  return t;
}
function floorMat(key) {
  let m = floorMatCache.get(key);
  if (m) return m;
  const k = FLOOR_DEF[key] ? key : (FLOOR_ALIAS[key] || key);
  const d = FLOOR_DEF[k];
  if (d) {
    let t = texCache.get(k);
    if (!t) { t = makeFloorTexture(k, d); texCache.set(k, t); }
    m = new THREE.MeshStandardMaterial({ map: t, roughness: d.rough });
  } else {
    const mi = matInfo(key);
    m = new THREE.MeshStandardMaterial({ color: (mi && (mi.sw || mi.color)) || '#dddddd', roughness: 0.6 });
  }
  applyEnv(m);
  floorMatCache.set(key, m);
  return m;
}

/* ------------------------------------------------------------------ sahne kurulumu */
function init() {
  if (inited) return;
  mainEl = $('#stage') || $('main');
  hostEl = $('#view3d');
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.touchAction = 'none';
  hostEl.prepend(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  const le = labelRenderer.domElement;
  le.style.position = 'absolute'; le.style.inset = '0'; le.style.pointerEvents = 'none';
  hostEl.appendChild(le);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f4ee);
  camera = new THREE.PerspectiveCamera(45, 1, 0.05, 300);
  camera.position.set(5, 15.5, 10);

  // ortam haritası (yalnız metal/parlak malzemelere tek tek verilir)
  const pm = new THREE.PMREMGenerator(renderer);
  envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();

  hemi = new THREE.HemisphereLight(0xfff8ee, 0xb9a88f, 1.1);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  const ss = coarse() ? 2048 : 4096;
  sun.shadow.mapSize.set(ss, ss);
  const sc = sun.shadow.camera;
  sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 60;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);

  ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0xf2eee7, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.015; ground.receiveShadow = true;
  scene.add(ground);

  floorsG = new THREE.Group(); archUp = new THREE.Group(); walkG = new THREE.Group();
  furnG = new THREE.Group(); labelsG = new THREE.Group(); lampG = new THREE.Group();
  archPick = new THREE.Group(); archDeco = new THREE.Group();
  archUp.add(archPick, archDeco, lampG, walkG);
  scene.add(floorsG, archUp, furnG, labelsG);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 1.5; controls.maxDistance = 45;
  controls.enabled = false;

  plc = new PointerLockControls(camera, document.body);
  plc.addEventListener('lock', onLock);
  plc.addEventListener('unlock', onUnlock);
  document.addEventListener('pointerlockerror', () => { if (mode === 'walk' && !touchWalk) startTouchWalk(); });

  new ResizeObserver(resize).observe(mainEl);
  bindCanvas();
  inited = true;
  resize();
  applyLight();
  window.addEventListener('models3d-ready', () => { modelsReady = true; if (inited) { sigFurn = ''; if (active) sync(); } });
}

function resize() {
  if (!renderer || !mainEl) return;
  const w = mainEl.clientWidth, h = mainEl.clientHeight;
  if (w < 2 || h < 2) return;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ ışık / gökyüzü / gece */
function applyLight() {
  if (!inited) return;
  const night = opt.night;
  const t = (opt.hour - 6) / 12;
  const az = Math.PI * (0.15 + 0.7 * t);
  const el = Math.sin(Math.PI * t) * 1.05 + 0.15;
  const warm = 1 - Math.sin(Math.PI * t);
  sun.position.set(Math.cos(az) * 18, Math.sin(el) * 20 + 3, -Math.sin(az) * 10 + 8);
  sun.color.setHSL(0.09, 0.5 + warm * 0.4, 0.92 - warm * 0.12);
  sun.intensity = night ? 0.05 : 1.4 + Math.sin(Math.PI * t) * 1.6;
  hemi.intensity = night ? 0.12 : 1.1;
  scene.background.set(night ? 0x1c2130 : 0xf7f4ee);
  ground.material.color.set(night ? 0x2a2e38 : 0xf2eee7);
  renderer.toneMappingExposure = night ? 1.25 : 1.05;
  applyLamps();
  envMats.forEach(m => { m.envMapIntensity = (m.userData._envBase || 0.5) * (night ? 0.15 : 1); });
  const sv = $('#sunVal'); if (sv) sv.textContent = fmtHour(opt.hour);
}
function applyLamps() {
  const on = grow > 0.99;
  lamps.forEach(l => {
    l.light.intensity = on && opt.night ? 6 : 0;
    l.disc.material.emissiveIntensity = opt.night ? 2 : 0.3;
    l.disc.visible = on && opt.cut >= gH() - 1e-6;
  });
}
function applyGrow() {
  if (!inited) return;
  archUp.scale.y = Math.max(grow, 0.001);
  furnG.scale.y = Math.max(furnGrow, 0.001);
  applyLamps();
}

/* ------------------------------------------------------------------ mimari */
function disposeGroup(g) {
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (g.children.length) g.remove(g.children[0]);
}
const wallMats = () => { const w = mat('#f4f1eb', { roughness: 0.92 }), c = mat('#34312d', { roughness: 0.9 }); return [w, w, c, w, w, w]; };
const noRay = () => {};

function addBox(parent, x0, z0, x1, z1, y0, y1, mats, shadow = true) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.Mesh(g, mats);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}
const R = a => [X(a[0]), Z(a[1]), X(a[2]), Z(a[3])];

function buildArch() {
  disposeGroup(floorsG); disposeGroup(archPick); disposeGroup(archDeco); disposeGroup(lampG); disposeGroup(walkG);
  doors = []; colliders = []; lamps = [];
  const st = gState();
  const dem = new Set(st.demolished || []);
  const cut = opt.cut, CH = gH();
  const wm = wallMats();
  const glass = mat('#cfe6ef', {});
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ef, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const frameMat = mat('#5d6166', { roughness: 0.5, metalness: 0.4 });
  const sillMat = mat('#d8d0c0', { roughness: 0.3 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x6f675b });
  const baseMat = mat('#8b7f6e', { roughness: 0.6 });
  void glass;

  // ---- duvarlar
  gWalls().forEach((w, i) => {
    if (dem.has('w' + i)) return;
    const [x0, z0, x1, z1] = R(w);
    const h = w[4] === 'low' ? Math.min(1, cut) : cut;
    addBox(archPick, x0, z0, x1, z1, 0, h, wm);
    colliders.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
    // gezinti yardımcıları
    const bg = new THREE.BoxGeometry(x1 - x0, h, z1 - z0);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(bg), edgeMat);
    e.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); e.raycast = noRay; walkG.add(e);
    bg.dispose();
    const bh = Math.min(0.12, h);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.02, bh, z1 - z0 + 0.02), baseMat);
    sb.position.set((x0 + x1) / 2, bh / 2, (z0 + z1) / 2); sb.raycast = noRay; walkG.add(sb);
  });

  // ---- pencereler
  gWins().forEach((wn, i) => {
    const rect = Array.isArray(wn) ? wn : wn.rect;
    const [x0, z0, x1, z1] = R(rect);
    const sillV = (Array.isArray(wn) ? wn[4] : wn.sill);
    const topV = (Array.isArray(wn) ? wn[5] : wn.top);
    const sill = typeof sillV === 'number' ? (sillV > 20 ? sillV / 1000 : sillV) : (i === 0 ? 1.4 : 0.9);
    const head = typeof topV === 'number' ? (topV > 20 ? topV / 1000 : topV) : 2.4;
    colliders.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
    if (sill > 0) addBox(archPick, x0, z0, x1, z1, 0, Math.min(sill, cut), wm);
    if (cut > head) addBox(archPick, x0, z0, x1, z1, head, cut, wm);
    const top = Math.min(head, cut);
    if (top - sill < 0.06) return;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const horiz = (x1 - x0) >= (z1 - z0);
    const len = horiz ? x1 - x0 : z1 - z0;
    const gm = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.01, top - sill, horiz ? 0.01 : len), glassMat);
    gm.position.set(cx, (sill + top) / 2, cz); gm.raycast = noRay; archDeco.add(gm);
    const n = Math.max(1, Math.round(len / 0.9));
    for (let k = 0; k <= n; k++) {
      const off = -len / 2 + k * len / n;
      const mm = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 0.04 : 0.06, top - sill, horiz ? 0.06 : 0.04), frameMat);
      mm.position.set(cx + (horiz ? off : 0), (sill + top) / 2, cz + (horiz ? 0 : off));
      mm.castShadow = true; mm.raycast = noRay; archDeco.add(mm);
    }
    [sill + 0.02, top - 0.02].forEach(y => {
      const rm = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.06, 0.04, horiz ? 0.06 : len), frameMat);
      rm.position.set(cx, y, cz); rm.castShadow = true; rm.raycast = noRay; archDeco.add(rm);
    });
  });

  // ---- sürgülü kapılar
  gSlides().forEach(s => {
    const [x0, z0, x1, z1] = R(s.rect);
    const horiz = (x1 - x0) >= (z1 - z0);
    const len = horiz ? x1 - x0 : z1 - z0;
    const hh = Math.min(s.v ? 2.4 : 2.1, cut);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const pl = len * 0.55;
    // eşik
    addBox(archDeco, x0, z0, x1, z1, 0, 0.012, sillMat, false).raycast = noRay;
    const lint = s.v ? 2.4 : 2.1;
    if (cut > lint) addBox(archPick, x0, z0, x1, z1, lint, cut, wm);
    if (hh < 0.1) return;
    [[-1, -len / 2 + pl / 2], [1, len / 2 - pl / 2]].forEach(([sgn, along]) => {
      const gm = new THREE.Mesh(new THREE.BoxGeometry(horiz ? pl : 0.02, hh, horiz ? 0.02 : pl), glassMat);
      gm.position.set(cx + (horiz ? along : sgn * 0.02), hh / 2, cz + (horiz ? sgn * 0.02 : along));
      gm.raycast = noRay; archDeco.add(gm);
      [0.025, hh - 0.025].forEach(y => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(horiz ? pl : 0.04, 0.05, horiz ? 0.04 : pl), frameMat);
        r.position.set(gm.position.x, y, gm.position.z); r.raycast = noRay; r.castShadow = true; archDeco.add(r);
      });
      [-1, 1].forEach(e => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, hh, 0.04), frameMat);
        p.position.set(gm.position.x + (horiz ? e * (pl / 2 - 0.02) : 0), hh / 2, gm.position.z + (horiz ? 0 : e * (pl / 2 - 0.02)));
        p.raycast = noRay; p.castShadow = true; archDeco.add(p);
      });
    });
  });

  // ---- menteşeli kapılar
  const ang = v => Math.atan2(-v[1], v[0]);
  gDoors().forEach(d => {
    const [x0, z0, x1, z1] = R(d.rect);
    addBox(archDeco, x0, z0, x1, z1, 0, 0.012, sillMat, false).raycast = noRay;
    if (cut > 2.1) addBox(archPick, x0, z0, x1, z1, 2.1, cut, wm);
    const len = d.len / 1000;
    const dh = Math.min(2.05, cut);
    const pivot = new THREE.Group();
    pivot.position.set(X(d.h[0]), 0, Z(d.h[1]));
    const lm = mat(d.entry ? '#6b4f3a' : '#efe6d8', { roughness: 0.5 });
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(len, dh, 0.04), lm);
    leaf.position.set(len / 2, dh / 2, 0); leaf.castShadow = true; leaf.receiveShadow = true;
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), mat('#cfd2d4', { metalness: 0.9, roughness: 0.25 }));
    handle.scale.set(1, 1, 2.2);
    handle.position.set(len - 0.07, Math.min(1, dh - 0.05), 0); handle.castShadow = true;
    pivot.add(leaf, handle);
    archPick.add(pivot);
    const ac = ang(d.c);
    let ao = ang(d.o);
    let df = ao - ac; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
    ao = ac + df;
    const od = { pivot, leaf, closed: ac, open: ao, isOpen: true, cur: ao, len, entry: !!d.entry, d };
    leaf.userData.door = od; handle.userData.door = od;
    pivot.rotation.y = od.cur;
    doors.push(od);
  });

  // ---- zeminler, cumba platformları, tavan, lambalar
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 1 });
  const sideMat = mat('#e9e4da', {});
  gRooms().forEach(r => {
    const fm = floorMat(roomMat(r));
    const shp = new THREE.Shape(r.poly.map(p => new THREE.Vector2(X(p[0]), -Z(p[1]))));
    if (r.counted === false) {
      const g = new THREE.ExtrudeGeometry(shp, { depth: 0.45, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, [fm, sideMat]);
      m.castShadow = true; m.receiveShadow = true; m.userData.roomId = r.id;
      archPick.add(m);
      return;
    }
    const g = new THREE.ShapeGeometry(shp);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, fm);
    m.receiveShadow = true; m.userData.roomId = r.id;
    floorsG.add(m);
    if (r.outdoor) return;
    // tavan
    const shc = new THREE.Shape(r.poly.map(p => new THREE.Vector2(X(p[0]), Z(p[1]))));
    const cg = new THREE.ShapeGeometry(shc);
    cg.rotateX(Math.PI / 2);
    const cm = new THREE.Mesh(cg, ceilMat);
    cm.position.y = CH; cm.visible = cut >= CH - 1e-6; cm.raycast = noRay;
    archDeco.add(cm);
    if (r.at) {
      const light = new THREE.PointLight(0xffd9a8, 0, 7, 1.6);
      light.position.set(X(r.at[0]), CH - 0.25, Z(r.at[1]));
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 32),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 0.3 }));
      disc.position.set(X(r.at[0]), CH - 0.012, Z(r.at[1])); disc.raycast = noRay;
      lampG.add(light, disc);
      lamps.push({ light, disc });
    }
  });
  walkG.visible = mode === 'walk';
  applyGrow();
  applyLight();
}

/* ------------------------------------------------------------------ mobilya */
function disposeFurn() {
  furnG.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (furnG.children.length) furnG.remove(furnG.children[0]);
  furnMap.clear();
}
function placeholder(f) {
  const col = f.color || (typeof typeColor === 'function' ? typeColor(f.type) : '#b8a890');
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(f.w / 1000, 0.5, f.d / 1000), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
  m.position.y = 0.25; m.castShadow = true; m.receiveShadow = true;
  g.add(m);
  return g;
}
function buildFurn() {
  disposeFurn();
  const M3 = window.Models3D;
  gState().furniture.forEach(f => {
    let g = null;
    if (M3 && typeof M3.buildFurniture === 'function') {
      try { g = M3.buildFurniture(f, { cut: opt.cut, night: opt.night }); } catch (e) { console.error('buildFurniture', f.type, e); }
    }
    if (!g) g = placeholder(f);
    g.position.set(X(f.cx), 0, Z(f.cy));
    g.rotation.y = -f.rot * Math.PI / 180;
    g.userData.fid = f.id;
    g.traverse(o => {
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mm => {
        if ((mm.isMeshStandardMaterial || mm.isMeshPhysicalMaterial) && !mm.userData._envDone) {
          mm.userData._envDone = true;
          if (needsEnv(mm)) { if (!mm.envMap) mm.envMap = envTex; mm.userData._envBase = envBase(mm); mm.envMapIntensity = mm.userData._envBase * (opt.night ? 0.15 : 1); envMats.add(mm); }
        }
      });
    });
    furnG.add(g);
    furnMap.set(f.id, g);
  });
  furnG.visible = opt.furn;
  boxHelperId = null;
}
function updateBoxHelper() {
  const u = gUi();
  const id = u.sel && u.sel.kind === 'furn' && opt.furn && active ? u.sel.id : null;
  if (id !== boxHelperId) {
    if (boxHelper) { scene.remove(boxHelper); boxHelper.geometry.dispose(); boxHelper = null; }
    boxHelperId = id;
    const g = id && furnMap.get(id);
    if (g) { boxHelper = new THREE.BoxHelper(g, 0xb5653a); scene.add(boxHelper); }
  }
  if (boxHelper) { boxHelper.visible = furnG.visible; boxHelper.update(); }
}

/* ------------------------------------------------------------------ etiketler ve oda listesi */
function buildLabels() {
  labelObjs.forEach(o => { labelsG.remove(o); if (o.element.parentNode) o.element.parentNode.removeChild(o.element); });
  labelObjs = [];
  gRooms().forEach(r => {
    if (!r.at || r.counted === false) return;
    const el = document.createElement('div');
    el.className = 'rlabel';
    const nmSpan = document.createElement('span'); nmSpan.textContent = roomName(r);
    const sm = document.createElement('small'); sm.textContent = polyArea(r.poly).toFixed(1) + 'm²';
    el.append(nmSpan, sm);
    const o = new CSS2DObject(el);
    o.position.set(X(r.at[0]), opt.cut + 0.15, Z(r.at[1]));
    labelsG.add(o);
    labelObjs.push(o);
  });
  setLabelsVisible(labelsShouldShow());
}
const labelsShouldShow = () => opt.labels && active && !busyAnim && mode !== 'walk';
function setLabelsVisible(v) {
  labelObjs.forEach(o => { o.visible = v; o.element.style.display = v ? '' : 'none'; });
}
function buildRoomList() {
  const box = $('#roomList');
  if (!box) return;
  box.textContent = '';
  const mk = (id, name, area) => {
    const b = document.createElement('button');
    b.dataset.room = id;
    const s = document.createElement('span'); s.textContent = name;
    const sm = document.createElement('small'); sm.textContent = area.toFixed(2) + ' m²';
    b.append(s, document.createTextNode(''), sm);
    b.addEventListener('click', () => { if (id === '__all') flyToAll(); else flyToRoom(id); });
    box.appendChild(b);
    return b;
  };
  let total = 0;
  gRooms().forEach(r => { if (r.counted === false) return; const a = polyArea(r.poly); total += a; mk(r.id, roomName(r), a); });
  mk('__all', L('Tüm daire', 'Whole home'), total);
  if (activeRoomBtn) markRoomBtn(activeRoomBtn);
}
function markRoomBtn(id) {
  activeRoomBtn = id;
  $$('#roomList button').forEach(b => b.classList.toggle('on', b.dataset.room === id));
}

/* ------------------------------------------------------------------ senkron */
function sync(force) {
  if (!inited || (!active && !force)) return;
  const st = gState();
  const rooms = gRooms();
  const aSig = JSON.stringify([opt.cut, st.demolished, rooms.map(r => roomMat(r))]);
  if (aSig !== sigArch) { sigArch = aSig; buildArch(); sigLabel = ''; }
  const fSig = JSON.stringify([st.furniture, modelsReady, !!(window.Models3D && window.Models3D.buildFurniture)]);
  if (fSig !== sigFurn) { sigFurn = fSig; buildFurn(); }
  const lSig = JSON.stringify([isEn(), opt.cut, rooms.map(r => roomName(r))]);
  if (lSig !== sigLabel) { sigLabel = lSig; buildLabels(); }
  if (lSig !== sigList) { sigList = lSig; buildRoomList(); }
  furnG.visible = opt.furn;
}

/* ------------------------------------------------------------------ kamera pozları ve uçuş */
function planPose() {
  const v = gView();
  const w = mainEl.clientWidth, h = mainEl.clientHeight;
  let tx = 0, tz = 0, visH = 14;
  if (v && v.s) {
    tx = X(v.x0 + w / (2 * v.s)); tz = Z(v.y0 + h / (2 * v.s));
    visH = h / v.s / 1000;
  }
  const dist = visH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return { target: new THREE.Vector3(tx, 0, tz), pos: new THREE.Vector3(tx, dist, tz + 0.0001), dist };
}
function isoFrom(pp) {
  const d = clamp(pp.dist, 5, 30);
  return { target: pp.target.clone(), pos: pp.target.clone().add(new THREE.Vector3(0.3, 0.82, 0.49).normalize().multiplyScalar(d)) };
}
const isoWhole = () => ({ target: new THREE.Vector3(0, 0, 0), pos: new THREE.Vector3(5.5, 15.5, 10) });
const topWhole = () => ({ target: new THREE.Vector3(0, 0, 0), pos: new THREE.Vector3(0, 19, 0.0001) });

function slerpPose(a, b, t) {
  // hedefe göre küresel interpolasyon: yarıçap ve phi doğrusal, theta en kısa yoldan
  const target = a.target.clone().lerp(b.target, t);
  const sa = new THREE.Spherical().setFromVector3(a.pos.clone().sub(a.target));
  const sb = new THREE.Spherical().setFromVector3(b.pos.clone().sub(b.target));
  let dth = sb.theta - sa.theta;
  while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
  const s = new THREE.Spherical(sa.radius + (sb.radius - sa.radius) * t, sa.phi + (sb.phi - sa.phi) * t, sa.theta + dth * t);
  const pos = new THREE.Vector3().setFromSpherical(s).add(target);
  return { target, pos };
}
function setPose(p) {
  camera.position.copy(p.pos);
  controls.target.copy(p.target);
  camera.lookAt(p.target);
}
function curPose() { return { target: controls.target.clone(), pos: camera.position.clone() }; }

function flyTo(pose, dur = 900) {
  if (!inited) return Promise.resolve();
  if (mode === 'walk') return Promise.resolve();
  const from = curPose();
  if (flyAnim) { flyAnim.cancel = true; }
  const a = { cancel: false };
  flyAnim = a; flying = true; controls.enabled = false;
  return new Promise(res => {
    runAnim(dur, t => setPose(slerpPose(from, pose, ease(t))), () => {
      if (flyAnim === a) { flyAnim = null; flying = false; if (!busyAnim && mode === 'orbit') { controls.enabled = true; controls.update(); } }
      res();
    }, a);
  });
}
function runAnim(dur, fn, done, token) {
  anims.push({ t0: performance.now(), dur, fn, done, token });
  ensureLoop();
}
function roomBox(r) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  r.poly.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  return { x0, y0, x1, y1 };
}
function flyToRoom(id) {
  if (!inited) init();
  const r = gRooms().find(q => q.id === id);
  if (!r) return Promise.resolve();
  markRoomBtn(id);
  if (mode === 'walk') setMode('orbit');
  const b = roomBox(r);
  const size = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 1000;
  const dist = size * 1.3 + 2.2;
  const target = new THREE.Vector3(X((b.x0 + b.x1) / 2), 0.6, Z((b.y0 + b.y1) / 2));
  const dir = new THREE.Vector3(camera.position.x - controls.target.x, 0, camera.position.z - controls.target.z);
  if (dir.length() < 0.05) dir.set(0.6, 0, 0.8);
  dir.normalize();
  const pos = target.clone().addScaledVector(dir, dist * 0.7); pos.y = dist * 1.05;
  return flyTo({ target, pos });
}
function flyToAll() {
  markRoomBtn('__all');
  if (mode === 'walk') setMode('orbit');
  return flyTo(isoWhole());
}

/* ------------------------------------------------------------------ döngü */
function ensureLoop() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
function frame(now) {
  raf = 0;
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    if (a.token && a.token.cancel) { anims.splice(i, 1); continue; }
    const t = clamp((now - a.t0) / a.dur, 0, 1);
    a.fn(t);
    if (t >= 1) { anims.splice(i, 1); a.done && a.done(); }
  }
  if (inited) {
    for (const d of doors) {
      const tg = d.isOpen ? d.open : d.closed;
      if (Math.abs(tg - d.cur) > 1e-4) { d.cur += (tg - d.cur) * Math.min(1, dt * 6); d.pivot.rotation.y = d.cur; }
    }
    if (mode === 'walk') walkStep(dt);
    else if (controls.enabled && !flying) controls.update();
    updateBoxHelper();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  if (active || anims.length) raf = requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ 2D <-> 3D geçişi */
function setClasses(on) {
  const seg = $('#viewSeg');
  document.body.classList.toggle('m3d', on);
  if (seg) seg.classList.toggle('is3d', on);
}
async function enter() {
  if (active || busyAnim) return;
  init();
  busyAnim = true;
  document.body.classList.add('busy');
  if (mode === 'walk') setMode('orbit');
  active = true;
  sigArch = sigFurn = sigLabel = sigList = '';
  sync(true);
  grow = furnGrow = 0; applyGrow();
  resize();
  const pp = planPose();
  setPose(pp);
  controls.enabled = false;
  setLabelsVisible(false);
  mainEl.classList.add('animating');
  setTip(true);
  ensureLoop();
  renderer.render(scene, camera);
  setClasses(true);
  mainEl.classList.add('is3d');
  updateHint();
  await sleep(420);
  const iso = isoFrom(pp);
  await new Promise(res => runAnim(1700, t => {
    setPose(slerpPose(pp, iso, ease(clamp(t / 0.85, 0, 1))));
    grow = ease(clamp((t - 0.1) / 0.55, 0, 1));
    furnGrow = ease(clamp((t - 0.45) / 0.5, 0, 1));
    applyGrow();
  }, res));
  grow = furnGrow = 1; applyGrow();
  controls.target.copy(iso.target); camera.position.copy(iso.pos); controls.update();
  controls.enabled = true;
  busyAnim = false;
  setLabelsVisible(labelsShouldShow());
  mainEl.classList.remove('animating');
  document.body.classList.remove('busy');
  updateHint();
}
async function exit() {
  if (!active || busyAnim) return;
  busyAnim = true;
  document.body.classList.add('busy');
  if (mode === 'walk') leaveWalk(true);
  setLabelsVisible(false);
  controls.enabled = false;
  if (flyAnim) { flyAnim.cancel = true; flyAnim = null; flying = false; }
  mainEl.classList.add('animating');
  setClasses(false);
  setTip(false);
  const from = curPose();
  const pp = planPose();
  await new Promise(res => runAnim(1300, t => {
    setPose(slerpPose(from, pp, ease(clamp((t - 0.1) / 0.9, 0, 1))));
    furnGrow = 1 - ease(clamp(t / 0.45, 0, 1));
    grow = 1 - ease(clamp((t - 0.2) / 0.6, 0, 1));
    applyGrow();
  }, res));
  mainEl.classList.remove('is3d');
  await sleep(450);
  active = false;
  grow = furnGrow = 1; applyGrow();
  busyAnim = false;
  mainEl.classList.remove('animating');
  document.body.classList.remove('busy');
  updateHint();
}
function setTip(in3d) {
  const t = $('#tip'); if (!t) return;
  if (in3d) t.textContent = coarse()
    ? L('Tek parmak döndürür · iki parmak yakınlaştırır / kaydırır · düzenlemek için mobilyaya veya zemine dokunun · kapıya dokunarak aç/kapat', '1 finger orbits · 2 fingers zoom / pan · tap furniture or floor to edit · tap doors to open')
    : L('3D sahne plan ile anlık senkron · sağ paneldeki değişiklikler hemen uygulanır · T: 2D', '3D stays in sync with the plan · panel edits apply instantly · T for 2D');
  else t.textContent = coarse()
    ? L('Kitaplıktan dokunun veya sürükleyin · tek parmak kaydırır · iki parmak yakınlaştırır · seçince alt çubuktan döndür / kopyala / sil', 'Tap or drag from the library · 1 finger pans · pinch zooms · bottom bar rotates / duplicates / deletes')
    : L('Soldaki mobilyayı plana sürükleyin · tekerlek yakınlaştırır · boşluğu sürükleyerek kaydırın · T: 3D', 'Drag furniture onto the plan · scroll to zoom · drag empty space to pan · T for 3D');
}
function updateHint() {
  const h = $('#hint3d'); if (!h) return;
  let s;
  if (mode === 'walk') s = touchWalk || coarse()
    ? L('Sol alttaki joystick ile yürü · ekranı sürükleyerek bak · kapıya dokunarak aç/kapat', 'Joystick moves · drag to look · tap doors to open')
    : L('WASD: yürü · fare: bak · Shift: hızlı yürü · E: kapı aç/kapat · Esc: duraklat', 'WASD moves · mouse looks · Shift runs · E opens doors · Esc pauses');
  else s = coarse()
    ? L('Tek parmak döndürür · iki parmak yakınlaştırır / kaydırır · seçili mobilyayı sürükleyip yerleştirin · kapıya dokunarak aç/kapat', '1 finger orbits · 2 fingers zoom / pan · select furniture to drag it · tap doors to open')
    : L('Sol tuş: döndür · sağ tuş: kaydır · tekerlek: yakınlaştır · seçili mobilyayı sürükleyip yerleştir · kapıya tıklayarak aç/kapat', 'Left-drag orbits · right-drag pans · scroll zooms · select furniture to drag it · click doors to open');
  h.textContent = s;
  // gezinti kaplaması metinleri
  const o1 = $('#wo1'), o2 = $('#wo2'), o3 = $('#wo3'), ttl = $('#walkOverlay h3');
  if (o1 && o2 && o3) {
    const tc = coarse();
    if (ttl) ttl.textContent = L('Gezinti modu', 'Walk mode');
    o1.textContent = tc ? L('Başlamak için dokunun (giriş kapısından girilir)', 'Tap to start at the front door') : L('Başlamak için tıklayın (giriş kapısından girilir)', 'Click to start at the front door');
    if (tc) {
      o2.textContent = L('Sol alttaki joystick ile yürü · ekranı sürükleyerek bak', 'Joystick moves · drag on screen to look');
      o3.textContent = L('Kapıya dokunarak aç/kapat · «Gezintiden çık» ile kuşbakışına dön', 'Tap doors to open · "Exit walk" returns to orbit');
    } else {
      o2.innerHTML = L('<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> yürü · fare: bak · <kbd>Shift</kbd> hızlı', '<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move · mouse looks · <kbd>Shift</kbd> runs');
      o3.innerHTML = L('<kbd>E</kbd> önündeki kapıyı aç/kapat · <kbd>Esc</kbd> duraklat', '<kbd>E</kbd> opens the door ahead · <kbd>Esc</kbd> pauses');
    }
  }
}

/* ------------------------------------------------------------------ seçenekler (kesit, gece, saat ...) */
function syncChips() {
  $$('[data-cut]').forEach(b => b.classList.toggle('on', Math.abs(parseFloat(b.dataset.cut) - opt.cut) < 1e-6));
  const tg = { furn: opt.furn, labels: opt.labels, night: opt.night };
  $$('[data-t]').forEach(b => { if (b.dataset.t in tg) b.classList.toggle('on', !!tg[b.dataset.t]); });
  $$('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
}
function setCut(v) {
  if (mode === 'walk') return;
  v = parseFloat(v);
  if (!(v > 0) || v === opt.cut) { syncChips(); return; }
  opt.cut = v; syncChips();
  if (inited) sync(true);
}
function setNight(on) { opt.night = !!on; syncChips(); applyLight(); }
function setFurn(on) {
  opt.furn = !!on; syncChips();
  if (inited) furnG.visible = opt.furn;
  const u = gUi();
  if (!opt.furn && u.sel && u.sel.kind === 'furn') doSelect(null);
}
function setLabels(on) { opt.labels = !!on; syncChips(); if (inited) setLabelsVisible(labelsShouldShow()); }
function setHour(h) {
  opt.hour = clamp(parseFloat(h) || 10, 7, 18);
  const s = $('#sun'); if (s && parseFloat(s.value) !== opt.hour) s.value = opt.hour;
  applyLight();
}

/* ------------------------------------------------------------------ seçim köprüsü (klasik betik) */
function doSelect(kind, id) {
  if (typeof window.select !== 'function') return;
  if (!kind) window.select(null);
  else if (window.select.length >= 2) window.select(kind, id);
  else window.select({ kind, id });
}

/* ------------------------------------------------------------------ ışın / tıklama / sürükleme */
function setRay(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
  return raycaster;
}
function pickRoots() {
  const roots = [];
  if (furnG.visible) roots.push(furnG);
  roots.push(archPick, floorsG);
  return roots;
}
function ownerOf(o) {
  while (o) {
    if (o.userData && o.userData.fid) return { furn: o.userData.fid };
    if (o.userData && o.userData.door) return { door: o.userData.door };
    if (o.userData && o.userData.roomId) return { room: o.userData.roomId };
    o = o.parent;
  }
  return {};
}
function pickAt(cx, cy) {
  setRay(cx, cy);
  const hits = raycaster.intersectObjects(pickRoots(), true);
  for (const h of hits) {
    if (h.object.material && h.object.material.transparent) continue;
    const o = ownerOf(h.object);
    return Object.assign({ point: h.point, dist: h.distance }, o);
  }
  return null;
}
/** ekran noktasının zemin (y=0) karşılığı, mm; duvara çarparsa duvar vuruş noktası */
function groundPointAt(cx, cy) {
  if (!inited || !active) return null;
  setRay(cx, cy);
  const ray = raycaster.ray;
  let gd = null;
  if (ray.direction.y < -1e-6) { const d = -ray.origin.y / ray.direction.y; if (d > 0 && d <= 60) gd = d; }
  const hits = raycaster.intersectObject(archPick, true);
  for (const h of hits) {
    if (h.object.material && h.object.material.transparent) continue;
    if (gd === null || h.distance < gd) { return { x: Math.round(toMmX(h.point.x)), y: Math.round(toMmY(h.point.z)), wall: true }; }
    break;
  }
  if (gd === null) return null;
  const p = ray.at(gd, tmpV);
  return { x: Math.round(toMmX(p.x)), y: Math.round(toMmY(p.z)), wall: false };
}
function groundAtPlane(cx, cy) {
  setRay(cx, cy);
  const ray = raycaster.ray;
  if (ray.direction.y > -1e-6) return null;
  const d = -ray.origin.y / ray.direction.y;
  if (d <= 0 || d > 80) return null;
  return ray.at(d, new THREE.Vector3());
}
/** ekran merkezinin zemin karşılığı, mm */
function screenCenterGround() {
  if (!inited) return null;
  const r = renderer.domElement.getBoundingClientRect();
  return groundPointAt(r.left + r.width / 2, r.top + r.height / 2);
}
/** verilen ekran noktasında 1 mm'nin kaç piksel olduğu (hayalet ölçeği için) */
function pxPerMm(cx, cy) {
  const p = groundAtPlane(cx, cy);
  if (!p) return null;
  const r = renderer.domElement.getBoundingClientRect();
  const a = p.clone().project(camera);
  const b = p.clone().add(new THREE.Vector3(1, 0, 0)).project(camera);
  const dx = (b.x - a.x) * r.width / 2, dy = (b.y - a.y) * r.height / 2;
  return Math.hypot(dx, dy) / 1000;
}

// 2D'deki snapMove yoksa kullanılacak yedek (10 mm ızgara + duvara yapışma)
function snapFallback(f, x, y) {
  const s = (gView() && gView().s) || 0.06;
  const th = 10 / s;
  const rad = f.rot * Math.PI / 180, c = Math.abs(Math.cos(rad)), sn = Math.abs(Math.sin(rad));
  const hw = f.w / 2 * c + f.d / 2 * sn, hh = f.w / 2 * sn + f.d / 2 * c;
  let bx = null, by = null, bdx = th, bdy = th;
  const dem = new Set(gState().demolished || []);
  const T = [];
  gWalls().forEach((w, i) => { if (!dem.has('w' + i)) T.push(w); });
  gWins().forEach(w => T.push(Array.isArray(w) ? w : w.rect));
  T.forEach(t => {
    const [tx0, ty0, tx1, ty1] = t;
    if (y + hh > ty0 - th && y - hh < ty1 + th) [tx0 - hw, tx1 + hw].forEach(cx => { const d = Math.abs(cx - x); if (d < bdx) { bdx = d; bx = cx; } });
    if (x + hw > tx0 - th && x - hw < tx1 + th) [ty0 - hh, ty1 + hh].forEach(cy => { const d = Math.abs(cy - y); if (d < bdy) { bdy = d; by = cy; } });
  });
  const snapOn = !gUi().layers || gUi().layers.snap !== false;
  return { x: snapOn && bx !== null ? Math.round(bx) : Math.round(x / 10) * 10, y: snapOn && by !== null ? Math.round(by) : Math.round(y / 10) * 10 };
}
function snapPos(f, x, y) {
  if (typeof window.snapMove === 'function') {
    const r = window.snapMove(f, x, y);
    if (r) return Array.isArray(r) ? { x: r[0], y: r[1] } : r;
  }
  return snapFallback(f, x, y);
}

let ptr = null; // { id, x, y, thr, drag, furnId, grab:{dx,dz}, moved, startCx, startCy }
function bindCanvas() {
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', onDown, true);
  cv.addEventListener('pointermove', onMove, true);
  cv.addEventListener('pointerup', onUp, true);
  cv.addEventListener('pointercancel', onCancel, true);
  cv.addEventListener('contextmenu', e => e.preventDefault());
}
function onDown(e) {
  if (!active || busyAnim) return;
  call('closeDrawers');
  if (mode === 'walk') return walkDown(e);
  if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, thr: e.pointerType === 'touch' ? 9 : 4, drag: false, furnId: null };
  const u = gUi();
  if (u.sel && u.sel.kind === 'furn' && furnG.visible && !flying) {
    setRay(e.clientX, e.clientY);
    const hits = raycaster.intersectObjects(pickRoots(), true).filter(h => !(h.object.material && h.object.material.transparent));
    const o = hits.length ? ownerOf(hits[0].object) : {};
    if (o.furn === u.sel.id) {
      const f = call('getF', u.sel.id) || gState().furniture.find(q => q.id === u.sel.id);
      const gp = groundAtPlane(e.clientX, e.clientY);
      if (f && gp) {
        ptr.furnId = f.id;
        ptr.grab = { dx: X(f.cx) - gp.x, dz: Z(f.cy) - gp.z };
        controls.enabled = false;
      }
    }
  }
}
function onMove(e) {
  if (mode === 'walk') return walkMove(e);
  if (!ptr || e.pointerId !== ptr.id) return;
  if (!ptr.drag && Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y) > ptr.thr) {
    ptr.drag = true;
    if (ptr.furnId) {
      ptr.f = call('getF', ptr.furnId) || gState().furniture.find(q => q.id === ptr.furnId);
      call('snap');
      ptr.moved = false;
      renderer.domElement.style.cursor = 'grabbing';
      try { renderer.domElement.setPointerCapture(e.pointerId); } catch (er) { /* yok say */ }
    }
  }
  if (ptr.drag && ptr.furnId && ptr.f) {
    const gp = groundAtPlane(e.clientX, e.clientY);
    if (!gp) return;
    const nx = toMmX(gp.x + ptr.grab.dx), ny = toMmY(gp.z + ptr.grab.dz);
    const s = snapPos(ptr.f, nx, ny);
    const g = furnMap.get(ptr.furnId);
    if (g) g.position.set(X(s.x), 0, Z(s.y));
    ptr.nx = s.x; ptr.ny = s.y; ptr.moved = true;
    e.stopPropagation();
  }
}
function onUp(e) {
  if (mode === 'walk') return walkUp(e);
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = ptr; ptr = null;
  renderer.domElement.style.cursor = '';
  try { renderer.domElement.releasePointerCapture(e.pointerId); } catch (er) { /* yok say */ }
  if (!busyAnim && !flying && mode === 'orbit') controls.enabled = true;
  if (p.drag) {
    if (p.furnId && p.moved && p.f) {
      p.f.cx = p.nx; p.f.cy = p.ny;
      call('commit');
    }
    return;
  }
  if (busyAnim) return;
  const hit = pickAt(e.clientX, e.clientY);
  if (hit && hit.door) { hit.door.isOpen = !hit.door.isOpen; return; }
  if (hit && hit.furn) return doSelect('furn', hit.furn);
  if (hit && hit.room) return doSelect('room', hit.room);
  doSelect(null);
}
function onCancel(e) {
  if (mode === 'walk') return walkUp(e, true);
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = ptr; ptr = null;
  if (p.drag && p.furnId) { sigFurn = ''; sync(); }
  if (!busyAnim && !flying && mode === 'orbit') controls.enabled = true;
}

/* ------------------------------------------------------------------ gezinti modu */
const keys = new Set();
const joyV = { x: 0, y: 0 };
let yaw = 0, pitch = 0;
let joyId = null, lookP = null;

function setDisp(el, v) { if (el) el.style.display = v; }
function entryDoorPose() {
  const ds = gDoors();
  const d = ds.find(q => q.entry) || ds[0];
  if (!d) return { x: 0, z: 0, fx: 1, fz: 0 };
  const [x0, z0, x1, z1] = R(d.rect);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const horiz = (x1 - x0) >= (z1 - z0);
  // duvar normali; daire içine (plan merkezine) bakan yön
  let nx = horiz ? 0 : 1, nz = horiz ? 1 : 0;
  if (nx * (0 - cx) + nz * (0 - cz) < 0) { nx = -nx; nz = -nz; }
  return { x: cx - nx * 0.4, z: cz - nz * 0.4, fx: nx, fz: nz };
}
function setMode(m) {
  if (!inited && m === 'walk') init();
  if (m === mode) { syncChips(); return; }
  if (m === 'walk') {
    if (!active || busyAnim) { syncChips(); return; }
    doSelect(null);
    if (opt.cut < gH() - 1e-6) { opt.cut = gH(); sync(true); }
    controls.enabled = false;
    if (flyAnim) { flyAnim.cancel = true; flyAnim = null; flying = false; }
    mode = 'walk'; touchWalk = false; locked = false;
    const p = entryDoorPose();
    camera.position.set(p.x, 1.6, p.z);
    yaw = Math.atan2(-p.fx, -p.fz); pitch = 0;
    camera.rotation.set(0, yaw, 0, 'YXZ');
    walkG.visible = true;
    setLabelsVisible(false);
    setDisp($('#walkOverlay'), 'flex');
    setDisp($('#cross'), 'none'); setDisp($('#joy'), 'none'); setDisp($('#walkExit'), 'none');
    syncChips(); updateHint();
  } else {
    leaveWalk(false);
  }
}
function leaveWalk(keepPose) {
  if (mode !== 'walk') { mode = 'orbit'; syncChips(); return; }
  if (locked) { try { plc.unlock(); } catch (e) { /* yok say */ } }
  mode = 'orbit'; touchWalk = false; locked = false;
  walkG.visible = false;
  keys.clear(); joyV.x = joyV.y = 0; joyId = null; lookP = null;
  setDisp($('#walkOverlay'), 'none'); setDisp($('#cross'), 'none'); setDisp($('#joy'), 'none'); setDisp($('#walkExit'), 'none');
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const tg = camera.position.clone().addScaledVector(dir, 3); tg.y = Math.max(0, tg.y);
  controls.target.copy(tg);
  camera.position.y = Math.max(camera.position.y, 1.6);
  camera.lookAt(tg);
  if (!keepPose && !busyAnim) controls.enabled = true;
  if (!busyAnim) setLabelsVisible(labelsShouldShow());
  syncChips(); updateHint();
}
function onLock() {
  locked = true;
  setDisp($('#walkOverlay'), 'none'); setDisp($('#cross'), 'block');
}
function onUnlock() {
  locked = false;
  setDisp($('#cross'), 'none');
  if (mode === 'walk' && !touchWalk) setDisp($('#walkOverlay'), 'flex');
}
function startTouchWalk() {
  if (mode !== 'walk') return;
  touchWalk = true;
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  yaw = e.y; pitch = e.x;
  setDisp($('#walkOverlay'), 'none'); setDisp($('#cross'), 'none');
  setDisp($('#joy'), 'block'); setDisp($('#walkExit'), 'block');
  updateHint();
}
function overlayClick() {
  if (mode !== 'walk') return;
  if (coarse()) return startTouchWalk();
  try {
    const p = plc.lock();
    if (p && p.catch) p.catch(() => startTouchWalk());
  } catch (e) { startTouchWalk(); }
}
function blocked(x, z) {
  const r = 0.22;
  for (const c of colliders) if (x > c[0] - r && x < c[2] + r && z > c[1] - r && z < c[3] + r) return true;
  for (const d of doors) {
    const dx = Math.cos(d.cur) * 0.9, dz = -Math.sin(d.cur) * 0.9;
    const px = d.pivot.position.x, pz = d.pivot.position.z;
    const t = clamp(((x - px) * dx + (z - pz) * dz) / (dx * dx + dz * dz), 0, 1);
    if (Math.hypot(x - (px + dx * t), z - (pz + dz * t)) < r * 0.8) return true;
  }
  return false;
}
function walkStep(dt) {
  camera.position.y = 1.6;
  const canMove = touchWalk || locked;
  if (touchWalk) camera.rotation.set(pitch, yaw, 0, 'YXZ');
  if (!canMove) return;
  let f = 0, s = 0;
  if (keys.has('w') || keys.has('arrowup')) f += 1;
  if (keys.has('s') || keys.has('arrowdown')) f -= 1;
  if (keys.has('d') || keys.has('arrowright')) s += 1;
  if (keys.has('a') || keys.has('arrowleft')) s -= 1;
  let speed = keys.has('shift') ? 2.6 : 1.4;
  let mag = 1;
  if (f === 0 && s === 0) {
    const jl = Math.hypot(joyV.x, joyV.y);
    if (jl < 0.05) return;
    f = -joyV.y; s = joyV.x; mag = Math.min(1, jl); speed = 1.4 * mag;
    const n = Math.hypot(f, s) || 1; f /= n; s /= n;
  } else {
    const n = Math.hypot(f, s); f /= n; s /= n;
  }
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0;
  if (dir.lengthSq() < 1e-8) return;
  dir.normalize();
  const rx = -dir.z, rz = dir.x;
  const mx = (dir.x * f + rx * s) * speed * dt, mz = (dir.z * f + rz * s) * speed * dt;
  const p = camera.position;
  if (!blocked(p.x + mx, p.z)) p.x += mx;
  if (!blocked(p.x, p.z + mz)) p.z += mz;
}
function walkDown(e) {
  if (!touchWalk) return;
  if (lookP) return;
  lookP = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
  try { renderer.domElement.setPointerCapture(e.pointerId); } catch (er) { /* yok say */ }
}
function walkMove(e) {
  if (!lookP || e.pointerId !== lookP.id) return;
  yaw += (e.clientX - lookP.x) * 0.005;
  pitch = clamp(pitch + (e.clientY - lookP.y) * 0.005, -1.35, 1.35);
  lookP.x = e.clientX; lookP.y = e.clientY;
}
function walkUp(e, cancel) {
  if (!lookP || e.pointerId !== lookP.id) return;
  const p = lookP; lookP = null; ptr = null;
  if (!cancel && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= 9) toggleDoorAt(e.clientX, e.clientY, 3.5);
}
function toggleDoorAt(cx, cy, maxD) {
  setRay(cx, cy);
  const hits = raycaster.intersectObject(archPick, true);
  for (const h of hits) {
    if (h.object.material && h.object.material.transparent) continue;
    const o = ownerOf(h.object);
    if (o.door && h.distance <= maxD) o.door.isOpen = !o.door.isOpen;
    return;
  }
}
function bindWalkUI() {
  const ov = $('#walkOverlay'); if (ov) ov.addEventListener('click', overlayClick);
  const ex = $('#walkExit');
  if (ex) ex.addEventListener('click', () => { setMode('orbit'); flyTo(isoWhole()); });
  const joy = $('#joy');
  if (joy) {
    const knob = $('#joyKnob') || joy.firstElementChild;
    const upd = e => {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 50) { dx = dx / l * 50; dy = dy / l * 50; }
      joyV.x = dx / 50; joyV.y = dy / 50;
      if (knob) knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };
    joy.addEventListener('pointerdown', e => {
      if (joyId !== null) return;
      joyId = e.pointerId; e.preventDefault(); e.stopPropagation();
      try { joy.setPointerCapture(e.pointerId); } catch (er) { /* yok say */ }
      upd(e);
    });
    joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) { e.preventDefault(); upd(e); } });
    const end = e => {
      if (e.pointerId !== joyId) return;
      joyId = null; joyV.x = joyV.y = 0;
      if (knob) knob.style.transform = '';
    };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
  }
  window.addEventListener('keydown', e => {
    if (mode !== 'walk' || !active) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const k = e.key.toLowerCase();
    if (k === 'e') {
      const r = renderer.domElement.getBoundingClientRect();
      toggleDoorAt(r.left + r.width / 2, r.top + r.height / 2, 2.5);
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
      keys.add(k);
      if (k.startsWith('arrow')) e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); });
  window.addEventListener('blur', () => keys.clear());
}

/* ------------------------------------------------------------------ üst bar bağlantıları */
function bindHeader() {
  $$('[data-mode]').forEach(b => b.addEventListener('click', () => { if (!active) return; setMode(b.dataset.mode); }));
  $$('[data-cut]').forEach(b => b.addEventListener('click', () => setCut(b.dataset.cut)));
  $$('[data-t]').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.t;
    if (t === 'night') setNight(!opt.night);
    else if (t === 'furn') setFurn(!opt.furn);
    else if (t === 'labels') setLabels(!opt.labels);
  }));
  const sun_ = $('#sun');
  if (sun_) { opt.hour = parseFloat(sun_.value) || 10; sun_.addEventListener('input', () => setHour(sun_.value)); }
  const vi = $('#vIso'), vt = $('#vTop');
  const toOrbit = () => { if (mode === 'walk') setMode('orbit'); };
  if (vi) vi.addEventListener('click', () => { if (!active) return; toOrbit(); markRoomBtn(null); flyTo(isoWhole()); });
  if (vt) vt.addEventListener('click', () => { if (!active) return; toOrbit(); markRoomBtn(null); flyTo(topWhole()); });
  // ilk durumu DOM'dan oku
  const c = $('[data-cut].on'); if (c) opt.cut = parseFloat(c.dataset.cut) || 2.8;
  $$('[data-t]').forEach(b => {
    const on = b.classList.contains('on');
    if (b.dataset.t === 'night') opt.night = on; else if (b.dataset.t === 'furn') opt.furn = on; else if (b.dataset.t === 'labels') opt.labels = on;
  });
  bindWalkUI();
  new MutationObserver(() => { if (!inited) return; sigLabel = sigList = ''; if (active) { sync(); } updateHint(); if (active) setTip(true); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}

/* ------------------------------------------------------------------ dışa aktarma */
function toDataURL() {
  if (!inited) return null;
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}
function exportPNG(name) {
  const url = toDataURL();
  if (!url) return null;
  const a = document.createElement('a');
  a.href = url; a.download = name || (L('kat-plani-tasarimi', 'floor-plan-design') + '-3D.png');
  document.body.appendChild(a); a.click(); a.remove();
  return url;
}

/* ------------------------------------------------------------------ genel API */
const API = {
  enter, exit,
  toggle() { return active && !busyAnim ? exit() : enter(); },
  sync, resize,
  refresh() { sigLabel = sigList = ''; if (inited && active) sync(); updateHint(); },
  setMode, setCut, setNight, setFurn, setLabels, setHour,
  flyToRoom, flyToAll, flyIso() { return flyTo(isoWhole()); }, flyTop() { return flyTo(topWhole()); },
  groundPointAt, screenCenterGround, pxPerMm,
  toDataURL, exportPNG,
  walking: () => active && mode === 'walk',
  isWalking: () => active && mode === 'walk',
  isActive: () => active,
  isBusy: () => busyAnim,
  get active() { return active; },
  get busy() { return busyAnim; },
  get mode() { return mode; },
  get opt() { return opt; },
  get ready() { return true; },
  get renderer() { return renderer; },
  get scene() { return scene; },
  get camera() { return camera; },
  init,
};
window.View3D = API;

bindHeader();
syncChips();
window.dispatchEvent(new Event('view3d-ready'));
