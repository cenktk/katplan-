/* 3D mobilya modelleri — SPEC §7. window.Models3D = { buildFurniture, TYPES, disposeGroup, ... }
 * Yerel eksen: taban y=0, merkez (0,0), arka -z, ön +z; genişlik x = w/1000 m, derinlik z = d/1000 m. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;
const DS = THREE.DoubleSide;

/* ---------- önbellekler ---------- */
const GEO = new Map();
const SHARED = new Set();
function cg(key, fn) {
  let g = GEO.get(key);
  if (!g) { g = fn(); GEO.set(key, g); SHARED.add(g); }
  return g;
}
const q = v => Math.round(v * 10000) / 10000;
const pos = v => Math.max(v, 0.001);

const BOX = (w, h, d) => cg(`b${q(w)},${q(h)},${q(d)}`, () => new THREE.BoxGeometry(pos(w), pos(h), pos(d)));
const RBOX = (w, h, d, r) => {
  r = Math.min(r, Math.min(w, h, d) / 2 * 0.98);
  return cg(`r${q(w)},${q(h)},${q(d)},${q(r)}`, () => new RoundedBoxGeometry(pos(w), pos(h), pos(d), 3, Math.max(r, 0.0005)));
};
const CYL = (rt, rb, h, seg) => cg(`c${q(rt)},${q(rb)},${q(h)},${seg}`, () => new THREE.CylinderGeometry(rt, rb, pos(h), seg));
const LATHE = (pts, seg) => cg(`l${seg}:${pts.map(p => q(p[0]) + ',' + q(p[1])).join(';')}`,
  () => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(p[0], 0), p[1])), seg));
const SPH = () => cg('sph', () => new THREE.SphereGeometry(1, 18, 12));
const TORUS = (R, r) => cg(`t${q(R)},${q(r)}`, () => new THREE.TorusGeometry(R, r, 8, 32));

/* ---------- renk yardımcıları (sRGB bayt uzayında) ---------- */
function hexRGB(hex) {
  let s = String(hex || '#cccccc').trim();
  if (s[0] === '#') s = s.slice(1);
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  const n = parseInt(s, 16);
  if (isNaN(n)) return [204, 204, 204];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const darker = (hex, k) => toHex(hexRGB(hex).map(v => v * k));
const lighter = (hex, k) => toHex(hexRGB(hex).map(v => v + (255 - v) * k));

/* ---------- malzemeler ---------- */
const MATS = new Map();
const ENV = { map: null, k: 1 };
function applyEnv(m) {
  if (!m.userData.useEnv) return;
  m.envMap = ENV.map || null;
  m.envMapIntensity = m.userData.envBase * ENV.k;
  m.needsUpdate = true;
}
function mat(color, o = {}) {
  const key = color + '|' + JSON.stringify(o);
  let m = MATS.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
  if (m.metalness > 0 || m.roughness < 0.4) {
    m.userData.useEnv = true;
    m.userData.envBase = m.metalness > 0.5 ? 1 : 0.5;
    applyEnv(m);
  }
  MATS.set(key, m);
  return m;
}
function setEnvironment(map, k) {
  if (map !== undefined) ENV.map = map;
  if (k !== undefined) ENV.k = k;
  MATS.forEach(applyEnv);
}
const woodM = c => mat(c, { roughness: 0.55 });
const fabric = c => mat(c, { roughness: 0.96 });
const metal = () => mat('#cfd2d4', { metalness: 0.9, roughness: 0.25 });
const chrome = () => mat('#eef0f2', { metalness: 1, roughness: 0.08 });
const hwMat = () => mat('#b9b3a8', { metalness: 0.85, roughness: 0.3 });
const blackMetal = () => mat('#2b2b2d', { metalness: 0.6, roughness: 0.4 });
const mirrorM = () => mat('#dfeaee', { metalness: 0.55, roughness: 0.06 });
const ceramic = () => mat('#fbfbf9', { roughness: 0.12 });
const screenMat = glow => mat('#0b0e13', { roughness: 0.1, metalness: 0.3, emissive: glow, emissiveIntensity: 0.35 });
const glowMat = () => mat('#fff4dc', { emissive: '#ffdca0', emissiveIntensity: 0.5, side: DS, roughness: 0.6 });
const glassM = () => mat('#cfe6ef', { roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: DS });
const frameMat = () => mat('#5d6166', { roughness: 0.5, metalness: 0.4 });
const steel = () => mat('#d3d8dc', { metalness: 0.85, roughness: 0.3 });
const led = (c, i = 1) => mat(c, { emissive: c, emissiveIntensity: i, roughness: 0.4 });

/* ---------- tohumlu rastgelelik ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let RNG = mulberry32(1);
const R = () => RNG();

/* ---------- şekil yardımcıları ---------- */
function rrShape(w, d, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2, y = cy - d / 2;
  r = Math.max(0.001, Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3));
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* ---------- ilkel şekiller (g grubuna bağlı) ---------- */
function H(g) {
  const add = (geo, m, x = 0, y = 0, z = 0, noCast) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.castShadow = !(noCast || m.transparent);
    me.receiveShadow = true;
    g.add(me);
    return me;
  };
  const h = {
    add,
    box: (w, hh, d, m, x = 0, y = 0, z = 0) => add(BOX(w, hh, d), m, x, y + hh / 2, z),
    rbox: (w, hh, d, m, x = 0, y = 0, z = 0, r = 0.04) => add(RBOX(w, hh, d, r), m, x, y + hh / 2, z),
    cyl: (rt, rb, hh, m, x = 0, y = 0, z = 0, seg = 28) => add(CYL(rt, rb, hh, seg), m, x, y + hh / 2, z),
    cylX: (rt, rb, len, m, x, yc, zc, seg = 24) => { const me = add(CYL(rt, rb, len, seg), m, x, yc, zc); me.rotation.z = PI / 2; return me; },
    cylZ: (rt, rb, len, m, x, yc, zc, seg = 24) => { const me = add(CYL(rt, rb, len, seg), m, x, yc, zc); me.rotation.x = PI / 2; return me; },
    lathe: (pts, m, x = 0, y = 0, z = 0, seg = 40) => add(LATHE(pts, seg), m, x, y, z),
    blob: (rx, ry, rz, m, x = 0, y = 0, z = 0) => { const me = add(SPH(), m, x, y, z); me.scale.set(rx, ry, rz); return me; },
    ring: (Rr, r, m, x = 0, y = 0, z = 0) => { const me = add(TORUS(Rr, r), m, x, y, z); me.rotation.x = PI / 2; return me; },
    rod: (a, b, r0, m, r1) => {
      if (r1 === undefined) r1 = r0;
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const dir = vb.clone().sub(va), len = dir.length();
      const me = add(CYL(r1, r0, len, 10), m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return me;
    },
    tube: (pts, r, m) => {
      const key = `tube${r}:${pts.map(p => p.map(q).join(',')).join(';')}`;
      const geo = cg(key, () => new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'centripetal'), pts.length * 10, r, 8, false));
      return add(geo, m, 0, 0, 0);
    },
    shell: (w, d, hh, t, r, m, x = 0, y = 0, z = 0) => {
      const geo = cg(`sh${q(w)},${q(d)},${q(hh)},${q(t)},${q(r)}`, () => {
        const s = rrShape(w, d, r);
        s.holes.push(rrShape(w - 2 * t, d - 2 * t, Math.max(r - t, 0.01)));
        const e = new THREE.ExtrudeGeometry(s, { depth: hh, bevelEnabled: false, curveSegments: 8 });
        e.rotateX(-PI / 2);
        return e;
      });
      return add(geo, m, x, y, z);
    },
    slab: (w, d, hh, holes, m, x = 0, y = 0, z = 0) => {
      const key = `sl${q(w)},${q(d)},${q(hh)}:` + holes.map(o => [o.x, o.z, o.w, o.d, o.r].map(q).join(',')).join(';');
      const geo = cg(key, () => {
        const s = rrShape(w, d, 0.004);
        holes.forEach(o => s.holes.push(rrShape(o.w, o.d, o.r, o.x, -o.z)));
        const e = new THREE.ExtrudeGeometry(s, { depth: hh, bevelEnabled: false, curveSegments: 6 });
        e.rotateX(-PI / 2);
        return e;
      });
      return add(geo, m, x, y, z);
    },
    legs: (w, d, hh, m, inset, r) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        h.cyl(r, r * 0.7, hh, m, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), 12);
      }
    },
    sub: (x, y, z, ry = 0) => {
      const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = ry; g.add(s); return H(s);
    },
  };

  /* Kapak / çekmece paneli: bir bölgeyi nx x ny bölerek panel + kulp üretir. o.z = gövde ön yüzü */
  h.fronts = o => {
    const { x0, x1, y0, y1, z, nx, ny, m, hd = 'bar', hy } = o;
    const W = x1 - x0, HH = y1 - y0, pw = W / nx, ph = HH / ny;
    h.box(W, HH, 0.006, mat('#2a2724'), (x0 + x1) / 2, y0, z + 0.003);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const px0 = x0 + i * pw, py0 = y1 - (j + 1) * ph;
      const cx = px0 + pw / 2;
      h.rbox(pw - 0.005, ph - 0.005, 0.018, m, cx, py0 + 0.0025, z + 0.009, 0.003);
      const fz = z + 0.018;
      const drawer = ph < 0.4 && pw >= ph;
      if (hd === 'bar') {
        if (drawer) {
          const L = Math.min(0.3, pw * 0.45);
          h.box(L, 0.01, 0.01, hwMat(), cx, py0 + ph * 0.5 - 0.005, fz + 0.028);
          h.box(0.01, 0.01, 0.028, hwMat(), cx - L / 2 + 0.005, py0 + ph * 0.5 - 0.005, fz + 0.014);
          h.box(0.01, 0.01, 0.028, hwMat(), cx + L / 2 - 0.005, py0 + ph * 0.5 - 0.005, fz + 0.014);
        } else {
          const L = Math.min(0.45, ph * 0.35);
          const hx = nx === 1 ? px0 + pw - 0.045 : (i % 2 === 0 ? px0 + pw - 0.045 : px0 + 0.045);
          let hyy = hy !== undefined ? Math.max(py0 + L / 2 + 0.02, Math.min(py0 + ph - L / 2 - 0.02, hy)) : py0 + ph / 2;
          h.box(0.01, L, 0.01, hwMat(), hx, hyy - L / 2, fz + 0.028);
          h.box(0.01, 0.01, 0.028, hwMat(), hx, hyy - L / 2, fz + 0.014);
          h.box(0.01, 0.01, 0.028, hwMat(), hx, hyy + L / 2 - 0.01, fz + 0.014);
        }
      } else if (hd === 'knob') {
        const kx = drawer ? cx : (i % 2 === 0 ? px0 + pw - 0.05 : px0 + 0.05);
        const ky = drawer ? py0 + ph / 2 : py0 + ph * 0.5;
        h.cylZ(0.008, 0.008, 0.02, hwMat(), kx, ky, fz + 0.01, 12);
        h.blob(0.016, 0.016, 0.016, hwMat(), kx, ky, fz + 0.026);
      } else if (hd === 'edge') {
        h.box(pw - 0.03, 0.012, 0.012, mat('#3c3a37'), cx, py0 + ph - 0.03, fz - 0.004);
      }
    }
  };
  return h;
}

/* ---------- süs nesneleri ---------- */
function vase(h, x, y, z, o = {}) {
  const hh = o.h || 0.28, r = o.r || 0.07;
  h.lathe([[0, 0], [0.65 * r, 0], [r, 0.32 * hh], [0.92 * r, 0.62 * hh], [0.42 * r, 0.86 * hh], [0.5 * r, hh]],
    mat(o.color || '#e6dfd1', { roughness: 0.35, side: DS }), x, y, z, 24);
  if (o.flowers) {
    const cols = ['#f3e6d8', '#e8b4a0', '#f6d27a', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      const a = R() * PI * 2, tl = 0.2 + R() * 0.14, ph = 0.12 + R() * 0.38;
      const top = [x + Math.cos(a) * Math.sin(ph) * tl, y + hh + Math.cos(ph) * tl, z + Math.sin(a) * Math.sin(ph) * tl];
      h.rod([x, y + hh * 0.8, z], top, 0.0028, mat('#6f8f4a', { roughness: 0.8 }));
      h.blob(0.02, 0.02, 0.02, mat(cols[Math.floor(R() * 4)], { roughness: 0.8 }), top[0], top[1], top[2]);
    }
  }
}
function tableLamp(h, x, y, z, s = 1) {
  h.lathe([[0, 0], [0.06 * s, 0], [0.075 * s, 0.06 * s], [0.07 * s, 0.15 * s], [0.03 * s, 0.24 * s], [0.02 * s, 0.28 * s]],
    mat('#e9e2d4', { roughness: 0.15 }), x, y, z, 20);
  h.lathe([[0.1 * s, 0], [0.065 * s, 0.17 * s]], mat('#f6ecd9', { emissive: '#ffdca0', emissiveIntensity: 0.35, side: DS, roughness: 0.8 }),
    x, y + 0.26 * s, z, 24);
  h.blob(0.028 * s, 0.035 * s, 0.028 * s, glowMat(), x, y + 0.31 * s, z);
}
function plate(h, x, y, z, r = 0.115) {
  h.lathe([[0, 0.003], [0.55 * r, 0.003], [r * 0.95, 0.016], [r, 0.02], [r * 0.98, 0.02]], mat('#fbfaf6', { roughness: 0.15, side: DS }), x, y, z, 24);
}
function cup(h, x, y, z, s = 1, col = '#ffffff') {
  h.lathe([[0, 0], [0.026 * s, 0], [0.033 * s, 0.085 * s], [0.03 * s, 0.085 * s], [0.024 * s, 0.01 * s]], mat(col, { roughness: 0.15, side: DS }), x, y, z, 16);
}
function fruitBowl(h, x, y, z, n = 3, rr = 0.15) {
  h.lathe([[0, 0], [rr * 0.4, 0], [rr, 0.06], [rr * 1.02, 0.065], [rr * 0.95, 0.065], [rr * 0.35, 0.012]], mat('#e9e2d4', { roughness: 0.3, side: DS }), x, y, z, 24);
  const cols = ['#d9573b', '#e8b33c', '#8fb04a', '#c8462f'];
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2 + 0.5, rad = n > 1 ? rr * 0.38 : 0;
    h.blob(0.035, 0.033, 0.035, mat(cols[i % 4], { roughness: 0.6 }), x + Math.cos(a) * rad, y + 0.06, z + Math.sin(a) * rad);
  }
}
function bookStack(h, x, y, z, list) {
  let yy = y;
  list.forEach(([bw, bh, bd, col], i) => {
    const b = h.box(bw, bh, bd, mat(col, { roughness: 0.75 }), x + (R() - 0.5) * 0.02, yy, z);
    b.rotation.y = (R() - 0.5) * 0.4;
    yy += bh;
  });
  return yy;
}

/* ---------- tip tabloları ---------- */
const B = {};

/* ===== Yatak odası ===== */
B.bed = (h, w, d, c) => {
  const fr = woodM('#8d7258'), fab = fabric(c);
  const bz = -d / 2, fz = d / 2;
  h.box(w - 0.12, 0.06, d - 0.14, mat('#4a3e33'), 0, 0, 0.03);
  h.rbox(w, 0.24, d - 0.08, fr, 0, 0.06, 0.03);
  h.rbox(w, 1.08, 0.06, fr, 0, 0, bz + 0.03);
  const n = Math.max(3, Math.round(w / 0.28));
  const pnw = (w - 0.04) / n;
  for (let i = 0; i < n; i++) h.rbox(pnw - 0.006, 0.62, 0.06, fabric(darker(c, 0.8)), -w / 2 + 0.02 + pnw * (i + 0.5), 0.42, bz + 0.06, 0.02);
  h.rbox(w - 0.06, 0.22, d - 0.13, mat('#f6f3ee', { roughness: 0.9 }), 0, 0.3, 0, 0.07);
  const dd = (d - 0.13) * 0.66;
  const zc = fz - 0.06 - dd / 2;
  h.rbox(w + 0.02, 0.27, dd, fab, 0, 0.32, zc, 0.05);
  h.rbox(w + 0.024, 0.06, 0.22, mat('#fbfaf7', { roughness: 0.95 }), 0, 0.56, zc - dd / 2 + 0.11, 0.025);
  h.rbox(w + 0.05, 0.29, 0.42, fabric(darker(c, 0.62)), 0, 0.305, fz - 0.2, 0.05);
  const np = w >= 1.3 ? 2 : 1;
  const pw = Math.min(0.62, (w - 0.12) / np - 0.06);
  for (let i = 0; i < np; i++) {
    const px = np === 1 ? 0 : (i === 0 ? -1 : 1) * w / 4;
    const p = h.rbox(pw, 0.15, 0.42, mat('#ffffff', { roughness: 0.95 }), px, 0.53, bz + 0.34, 0.06);
    p.rotation.x = -0.28;
    const cs = h.rbox(pw * 0.62, 0.3, 0.1, fabric(i === 0 ? darker(c, 0.7) : '#efe7da'), px, 0.54, bz + 0.66, 0.045);
    cs.rotation.x = -0.3;
  }
};

B.crib = (h, w, d, c) => {
  const wd = woodM(c), bz = -d / 2;
  h.box(w, 0.04, d, wd, 0, 0.2, 0);
  h.rbox(w - 0.06, 0.1, d - 0.06, mat('#ffffff', { roughness: 0.95 }), 0, 0.24, 0, 0.03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    h.box(0.045, 0.95, 0.045, wd, sx * (w / 2 - 0.0225), 0, sz * (d / 2 - 0.0225));
    h.blob(0.03, 0.03, 0.03, wd, sx * (w / 2 - 0.0225), 0.97, sz * (d / 2 - 0.0225));
  }
  for (const yy of [0.86, 0.26]) {
    for (const sz of [-1, 1]) h.box(w - 0.09, 0.03, 0.025, wd, 0, yy, sz * (d / 2 - 0.0225));
    for (const sx of [-1, 1]) h.box(0.025, 0.03, d - 0.09, wd, sx * (w / 2 - 0.0225), yy, 0);
  }
  const sm = mat(darker(c, 0.95), { roughness: 0.55 });
  for (const sz of [-1, 1]) for (let x = -w / 2 + 0.075; x < w / 2 - 0.05; x += 0.075) h.cyl(0.009, 0.009, 0.6, sm, x, 0.27, sz * (d / 2 - 0.0225), 6);
  for (const sx of [-1, 1]) for (let z = -d / 2 + 0.075; z < d / 2 - 0.05; z += 0.075) h.cyl(0.009, 0.009, 0.6, sm, sx * (w / 2 - 0.0225), 0.27, z, 6);
  h.rbox(w * 0.5, 0.03, d - 0.12, fabric('#f3d9c9'), w * 0.2, 0.34, 0, 0.012);
  h.rbox(0.22, 0.05, 0.3, fabric('#ffffff'), -w * 0.36, 0.34, 0, 0.02);
  const bm = fabric('#c9a27a');
  h.blob(0.05, 0.055, 0.04, bm, -w * 0.05, 0.4, 0.05);
  h.blob(0.038, 0.038, 0.038, bm, -w * 0.05, 0.47, 0.05);
  h.blob(0.014, 0.014, 0.014, bm, -w * 0.05 - 0.028, 0.5, 0.05);
  h.blob(0.014, 0.014, 0.014, bm, -w * 0.05 + 0.028, 0.5, 0.05);
};

B.nightstand = (h, w, d, c) => {
  const bz = -d / 2;
  h.legs(w, d, 0.1, woodM('#5a4a3b'), 0.04, 0.015);
  h.rbox(w, 0.4, d - 0.02, woodM(c), 0, 0.1, 0, 0.02);
  h.fronts({ x0: -w / 2 + 0.02, x1: w / 2 - 0.02, y0: 0.115, y1: 0.485, z: (d - 0.02) / 2, nx: 1, ny: 2, m: woodM(darker(c, 0.96)), hd: 'bar' });
  tableLamp(h, -w * 0.2, 0.5, bz + 0.12, 0.8);
  bookStack(h, w * 0.2, 0.5, 0.02, [[0.16, 0.025, 0.22, '#2f5d62'], [0.15, 0.02, 0.2, '#e6dccd']]);
};

B.wardrobe = (h, w, d, c) => {
  h.box(w - 0.02, 0.08, d - 0.06, mat('#4a4641'), 0, 0, 0);
  h.box(w, 2.1, d - 0.02, woodM(c), 0, 0.08, 0);
  const n = Math.max(1, Math.round(w / 0.5));
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 0.1, y1: 2.16, z: (d - 0.02) / 2, nx: n, ny: 1, m: woodM(darker(c, 0.97)), hd: 'bar', hy: 1.05 });
  h.box(w, 0.02, d - 0.02, woodM(darker(c, 0.9)), 0, 2.18, 0);
};

B.dresser = (h, w, d, c) => {
  const bz = -d / 2, fz = d / 2;
  h.legs(w, d, 0.58, woodM('#5a4a3b'), 0.05, 0.02);
  h.box(w - 0.04, 0.14, d - 0.04, woodM(c), 0, 0.58, 0);
  h.fronts({ x0: -w / 2 + 0.03, x1: w / 2 - 0.03, y0: 0.59, y1: 0.715, z: (d - 0.04) / 2, nx: 2, ny: 1, m: woodM(darker(c, 0.97)), hd: 'knob' });
  h.rbox(w, 0.03, d, woodM(c), 0, 0.72, 0, 0.012);
  const Rm = Math.min(0.34, w * 0.3);
  const cy = 0.77 + Rm;
  h.add(cg(`tor${q(Rm)}`, () => new THREE.TorusGeometry(Rm, 0.018, 8, 40)), woodM(darker(c, 0.8)), 0, cy, bz + 0.07);
  h.add(cg(`circ${q(Rm)}`, () => new THREE.CircleGeometry(Rm - 0.005, 40)), mirrorM(), 0, cy, bz + 0.075);
  h.box(0.05, 0.06, 0.03, woodM(darker(c, 0.8)), 0, 0.75, bz + 0.07);
  const gc = ['#e8b4a0', '#cfe6ef', '#f6d27a'];
  for (let i = 0; i < 3; i++) h.cyl(0.02, 0.022, 0.06 + i * 0.03, mat(gc[i], { roughness: 0.1, transparent: true, opacity: 0.75 }), -w * 0.3 + i * 0.05, 0.75, bz + 0.15, 14);
  h.rbox(0.14, 0.07, 0.1, mat('#7a5a44', { roughness: 0.5 }), w * 0.28, 0.75, bz + 0.16, 0.012);
  const s = h.sub(0, 0, fz + 0.25);
  s.legs(0.34, 0.34, 0.4, woodM('#5a4a3b'), 0.03, 0.015);
  s.rbox(0.34, 0.08, 0.34, fabric('#e8ddd0'), 0, 0.4, 0, 0.035);
};

B.desk = (h, w, d, c) => {
  const bz = -d / 2, fz = d / 2;
  const bm = blackMetal();
  h.rbox(w, 0.025, d, woodM(c), 0, 0.72, 0, 0.008);
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.05);
    for (const sz of [-1, 1]) h.box(0.03, 0.72, 0.03, bm, x, 0, sz * (d / 2 - 0.05));
    h.box(0.03, 0.03, d - 0.1, bm, x, 0.08, 0);
    h.box(0.03, 0.03, d - 0.1, bm, x, 0.68, 0);
  }
  h.box(w - 0.1, 0.34, 0.012, woodM(darker(c, 0.9)), 0, 0.36, bz + 0.05);
  h.box(0.4, 0.09, d - 0.12, woodM(darker(c, 0.92)), w / 2 - 0.3, 0.6, 0);
  h.box(0.38, 0.07, 0.01, woodM(darker(c, 0.85)), w / 2 - 0.3, 0.61, fz - 0.06 + 0.005);
  const my = 0.745;
  h.cyl(0.09, 0.1, 0.012, bm, 0, my, bz + 0.2, 24);
  h.box(0.03, 0.2, 0.02, bm, 0, my, bz + 0.2 - 0.01);
  h.rbox(0.62, 0.37, 0.02, mat('#18181a', { roughness: 0.4, metalness: 0.3 }), 0, my + 0.06, bz + 0.2 + 0.01, 0.008);
  h.box(0.58, 0.33, 0.004, screenMat('#1f2b3a'), 0, my + 0.08, bz + 0.2 + 0.022);
  h.rbox(0.38, 0.015, 0.13, mat('#f4f4f4', { roughness: 0.5 }), 0, my, bz + d * 0.55, 0.006);
  h.rbox(0.06, 0.025, 0.1, mat('#f4f4f4', { roughness: 0.4 }), 0.28, my, bz + d * 0.55, 0.02);
  // masa lambası
  const lx = -w / 2 + 0.14, lz = bz + 0.14;
  h.cyl(0.07, 0.075, 0.012, bm, lx, my, lz, 20);
  h.tube([[lx, my + 0.01, lz], [lx, my + 0.24, lz], [lx + 0.08, my + 0.36, lz + 0.05]], 0.006, bm);
  const hd = h.cyl(0.02, 0.06, 0.1, mat('#e8e2d6', { roughness: 0.4 }), lx + 0.09, my + 0.28, lz + 0.05, 16);
  hd.rotation.z = -0.5;
  h.blob(0.022, 0.022, 0.022, glowMat(), lx + 0.115, my + 0.31, lz + 0.05);
  // kalemlik
  const px = w / 2 - 0.12;
  h.cyl(0.04, 0.038, 0.1, mat('#3b5566', { roughness: 0.5 }), px, my, bz + 0.12, 16);
  h.rod([px, my + 0.08, bz + 0.12], [px - 0.02, my + 0.2, bz + 0.1], 0.004, mat('#c65b3a'));
  h.rod([px, my + 0.08, bz + 0.12], [px + 0.02, my + 0.19, bz + 0.13], 0.004, mat('#2b2b2d'));
  // defter / mouse pad
  h.rbox(0.2, 0.02, 0.28, mat('#3b5566', { roughness: 0.7 }), -w * 0.32, my, fz - 0.24, 0.006);
  h.box(0.17, 0.004, 0.25, mat('#f2ece0'), -w * 0.32 + 0.01, my + 0.02, fz - 0.24);
};

B.chair = (h, w, d, c) => {
  const wd = woodM('#6b543f');
  const bz = -d / 2, fz = d / 2;
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.03);
    h.box(0.035, 0.44, 0.035, wd, x, 0, fz - 0.04);
    h.box(0.035, 0.86, 0.035, wd, x, 0, bz + 0.04);
    h.box(0.025, 0.03, d - 0.08, wd, x, 0.15, 0);
  }
  h.box(w - 0.08, 0.03, 0.025, wd, 0, 0.15, fz - 0.04);
  h.box(w - 0.08, 0.03, 0.025, wd, 0, 0.15, bz + 0.04);
  h.rbox(w - 0.02, 0.03, d - 0.05, wd, 0, 0.41, 0, 0.01);
  h.rbox(w - 0.04, 0.05, d - 0.08, fabric(c), 0, 0.44, 0.005, 0.02);
  const rb = h.rbox(w - 0.08, 0.15, 0.025, wd, 0, 0.62, bz + 0.05, 0.008);
  rb.rotation.x = -0.08;
  h.rbox(w - 0.06, 0.05, 0.03, wd, 0, 0.8, bz + 0.04, 0.01);
  for (const sx of [-0.09, 0.09]) h.box(0.02, 0.28, 0.02, wd, sx * (w / 0.45), 0.5, bz + 0.05);
};

B.bookshelf = (h, w, d, c) => {
  const bz = -d / 2, wd = woodM(c);
  const HT = 1.8, tk = 0.022;
  h.box(w, HT, 0.01, woodM(darker(c, 0.85)), 0, 0, bz + 0.005);
  for (const sx of [-1, 1]) h.box(tk, HT, d, wd, sx * (w / 2 - tk / 2), 0, 0);
  const ys = [0.03];
  for (let i = 1; i <= 4; i++) ys.push(0.03 + (HT - 0.03 - tk - 0.03) * i / 5);
  ys.push(HT - tk);
  ys.forEach(y => h.box(w - 2 * tk, tk, d - 0.01, wd, 0, y, 0.005));
  h.box(w - 2 * tk, 0.03, d - 0.01, wd, 0, 0, 0.005);
  const pal = ['#b88a6a', '#6f8f8a', '#d9c08c', '#9aa58c', '#a8675e', '#e6dccd', '#7d8ea3', '#c9bfae'];
  for (let s = 0; s < 5; s++) {
    const y0 = ys[s] + tk, y1 = ys[s + 1], gap = y1 - y0;
    const deco = R() < 0.55;
    const xEnd = w / 2 - tk - (deco ? 0.16 : 0.01);
    let x = -w / 2 + tk + 0.01;
    while (x < xEnd - 0.03) {
      if (R() < 0.07) { x += 0.04 + R() * 0.06; continue; }
      const bw = 0.018 + R() * 0.03, bh = Math.min(gap - 0.03, 0.17 + R() * 0.13), bd = d * (0.62 + R() * 0.22);
      if (x + bw > xEnd) break;
      const b = h.box(bw, bh, bd, mat(pal[Math.floor(R() * pal.length)], { roughness: 0.75 }), x + bw / 2, y0, bz + 0.01 + bd / 2);
      if (R() < 0.05) b.rotation.z = 0.15;
      x += bw + 0.002;
    }
    if (deco) {
      if (R() < 0.5) vase(h, w / 2 - tk - 0.09, y0, bz + d * 0.5, { h: 0.2, r: 0.045, color: pal[Math.floor(R() * 8)] });
      else bookStack(h, w / 2 - tk - 0.09, y0, bz + d * 0.5, [[0.16, 0.03, 0.2, pal[Math.floor(R() * 8)]], [0.15, 0.025, 0.19, pal[Math.floor(R() * 8)]], [0.14, 0.03, 0.18, pal[Math.floor(R() * 8)]]]);
    }
  }
};

B.baycushion = (h, w, d, c) => {
  const bz = -d / 2, fz = d / 2;
  h.rbox(w, 0.08, d, fabric(c), 0, 0.45, 0, 0.03);
  const a = h.rbox(w - 0.1, 0.34, 0.14, fabric('#ffffff'), 0, 0.53, bz + 0.12, 0.06);
  a.rotation.x = -0.25;
  const b = h.rbox(w - 0.1, 0.34, 0.14, fabric('#f0e6d6'), 0, 0.53, fz - 0.12, 0.06);
  b.rotation.x = 0.25;
  h.rbox(w * 0.8, 0.04, 0.3, fabric(darker(c, 0.85)), 0, 0.53, -0.1, 0.018);
  h.rbox(0.26, 0.02, 0.2, woodM('#8a6a4a'), 0, 0.53, 0.28, 0.008);
  cup(h, -0.05, 0.55, 0.28);
};

/* ===== Salon ===== */
function seatCushions(h, w, d, c, sofaLike) {
  const bz = -d / 2;
  const fb = fabric(c), fb2 = fabric(darker(c, 0.88));
  h.legs(w, d, 0.12, woodM('#3a3027'), 0.07, 0.018);
  h.rbox(w, 0.16, d, fb2, 0, 0.12, 0, 0.05);
  const bd = Math.min(0.2, d * 0.24), a = Math.min(0.18, w * 0.14);
  h.rbox(w, 0.73, bd, fb2, 0, 0.12, bz + bd / 2, 0.06);
  for (const sx of [-1, 1]) h.rbox(a, 0.5, d, fb2, sx * (w / 2 - a / 2), 0.12, 0, 0.06);
  const n = sofaLike ? (w > 2.2 ? 3 : 2) : 1;
  const cw = (w - 2 * a) / n, sd = d - bd - 0.02;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + a + cw * (i + 0.5);
    h.rbox(cw - 0.012, 0.15, sd, fb, x, 0.28, bz + bd + 0.01 + sd / 2, 0.05);
    const bk = h.rbox(cw - 0.03, 0.44, 0.16, fb, x, 0.42, bz + bd + 0.07, 0.06);
    bk.rotation.x = -0.16;
  }
  if (n > 1) {
    const p1 = h.rbox(0.42, 0.42, 0.12, fabric('#ece5d8'), -w / 2 + a + 0.26, 0.43, bz + bd + 0.2, 0.05);
    p1.rotation.set(-0.25, 0.2, 0.1);
    const p2 = h.rbox(0.42, 0.42, 0.12, fabric(darker(c, 0.7)), w / 2 - a - 0.26, 0.43, bz + bd + 0.2, 0.05);
    p2.rotation.set(-0.25, -0.3, -0.08);
  } else {
    const p = h.rbox(0.4, 0.26, 0.1, fabric('#ece5d8'), 0, 0.43, bz + bd + 0.2, 0.05);
    p.rotation.x = -0.35;
  }
}
B.sofa = (h, w, d, c) => seatCushions(h, w, d, c, true);
B.armchair = (h, w, d, c) => seatCushions(h, w, d, c, false);

B.cornersofa = (h, w, d, c) => {
  const bz = -d / 2, fz = d / 2;
  const fb = fabric(c), fb2 = fabric(darker(c, 0.88));
  const k = Math.min(0.95, d * 0.56, w * 0.4), b = 0.2;
  const wl = -w / 2;
  const lm = woodM('#3a3027');
  for (const [x, z] of [[wl + 0.08, bz + 0.08], [w / 2 - 0.08, bz + 0.08], [w / 2 - 0.08, bz + k - 0.08], [wl + k - 0.08, bz + k], [wl + 0.08, fz - 0.08], [wl + k - 0.08, fz - 0.08]])
    h.cyl(0.018, 0.013, 0.1, lm, x, 0, z, 12);
  h.rbox(w, 0.18, k, fb2, 0, 0.1, bz + k / 2, 0.05);
  h.rbox(k, 0.18, d - k + 0.02, fb2, wl + k / 2, 0.1, bz + k + (d - k) / 2 - 0.01, 0.05);
  h.rbox(w, 0.72, b, fb2, 0, 0.1, bz + b / 2, 0.06);
  h.rbox(b, 0.72, d, fb2, wl + b / 2, 0.1, 0, 0.06);
  h.rbox(0.2, 0.5, k, fb2, w / 2 - 0.1, 0.1, bz + k / 2, 0.06);
  h.rbox(k, 0.5, 0.2, fb2, wl + k / 2, 0.1, fz - 0.1, 0.06);
  const cw = (w - b - 0.2) / 2;
  for (let i = 0; i < 2; i++) {
    const x = wl + b + cw * (i + 0.5);
    h.rbox(cw - 0.012, 0.15, k - b - 0.02, fb, x, 0.28, bz + b + (k - b) / 2, 0.05);
    const bk = h.rbox(cw - 0.03, 0.44, 0.16, fb, x, 0.42, bz + b + 0.07, 0.06);
    bk.rotation.x = -0.16;
  }
  h.rbox(k - b - 0.02, 0.15, d - k - 0.22, fb, wl + b + (k - b) / 2, 0.28, bz + k + (d - k - 0.22) / 2 + 0.01, 0.05);
  const m = Math.max(1, Math.round((d - 0.2 - b - 0.18) / 0.75));
  const Ld = d - b - 0.2 - k * 0 - 0.02;
  const zs = bz + k, ze = fz - 0.22 - 0.02;
  const seg = (ze - zs) / Math.max(1, m);
  for (let i = 0; i < m; i++) {
    const bk = h.rbox(0.16, 0.44, seg - 0.03, fb, wl + b + 0.07, 0.42, zs + seg * (i + 0.5), 0.06);
    bk.rotation.z = 0.16;
  }
  const p1 = h.rbox(0.42, 0.42, 0.12, fabric('#ece5d8'), wl + b + 0.3, 0.43, bz + b + 0.15, 0.05);
  p1.rotation.set(-0.25, 0.25, 0.05);
  const p2 = h.rbox(0.4, 0.4, 0.12, fabric(darker(c, 0.7)), w / 2 - 0.4, 0.43, bz + b + 0.15, 0.05);
  p2.rotation.set(-0.25, -0.25, -0.05);
};

B.beanbag = (h, w, d, c) => {
  const fb = mat(c, { roughness: 0.95 });
  h.blob(w / 2, 0.3, d / 2, fb, 0, 0.3, 0);
  h.blob(w * 0.36, 0.26, d * 0.3, mat(darker(c, 0.94), { roughness: 0.95 }), 0, 0.42, -d * 0.16);
};

B.coffeetable = (h, w, d, c) => {
  const lm = woodM('#3a3027');
  h.legs(w, d, 0.365, lm, 0.08, 0.02);
  h.rbox(w, 0.035, d, mat(c, { roughness: 0.35 }), 0, 0.365, 0, 0.012);
  h.rbox(w - 0.12, 0.02, d - 0.12, woodM(darker(c, 0.9)), 0, 0.12, 0, 0.008);
  h.rbox(0.36, 0.015, 0.24, woodM('#8a6a4a'), -w * 0.1, 0.4, 0.02, 0.006);
  h.box(0.22, 0.03, 0.15, mat('#f2ece0'), -w * 0.1 - 0.03, 0.415, 0.02);
  cup(h, -w * 0.1 + 0.11, 0.415, 0.06, 1, '#f5f2ec');
  bookStack(h, w * 0.3, 0.4, -0.05, [[0.24, 0.012, 0.32, '#2f5d62'], [0.23, 0.012, 0.31, '#d9b36c']]);
  vase(h, w * 0.38, 0.4, 0.12, { h: 0.15, r: 0.04, color: '#d7ccb8' });
};

B.sidetable = (h, w, d, c) => {
  const r = Math.min(w, d) / 2;
  h.lathe([[0.55 * r, 0], [0.55 * r, 0.018], [0.2 * r, 0.03], [0.06 * r, 0.06], [0.05 * r, 0.3], [0.09 * r, 0.5], [0.05 * r, 0.51]], blackMetal(), 0, 0, 0, 28);
  h.cyl(r * 0.98, r * 0.98, 0.025, mat(c, { roughness: 0.35 }), 0, 0.52, 0, 40);
  h.rbox(0.16, 0.03, 0.22, mat('#3b5f8a', { roughness: 0.7 }), -r * 0.2, 0.545, 0.02, 0.006);
  vase(h, r * 0.4, 0.545, -r * 0.2, { h: 0.12, r: 0.035, color: '#ddd3bf' });
};

B.tvstand = (h, w, d, c) => {
  const bz = -d / 2;
  h.legs(w, d, 0.1, blackMetal(), 0.06, 0.016);
  h.rbox(w, 0.4, d - 0.02, woodM(c), 0, 0.1, 0, 0.012);
  const n = Math.max(2, Math.round(w / 0.6));
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 0.11, y1: 0.49, z: (d - 0.02) / 2, nx: n, ny: 1, m: woodM(darker(c, 0.97)), hd: 'edge' });
  h.rbox(1.45, 0.84, 0.025, mat('#18181a', { roughness: 0.4, metalness: 0.3 }), 0, 0.95, bz + 0.03, 0.006);
  h.box(1.41, 0.8, 0.004, screenMat('#1f2b3a'), 0, 0.97, bz + 0.03 + 0.0145);
  h.rbox(0.9, 0.06, 0.09, mat('#1f1f22', { roughness: 0.5 }), 0, 0.5, 0.0, 0.02);
  vase(h, -w / 2 + 0.16, 0.5, 0.0, { h: 0.26, r: 0.06, flowers: true });
  bookStack(h, w / 2 - 0.2, 0.5, 0.02, [[0.2, 0.03, 0.27, '#d9b36c'], [0.19, 0.025, 0.26, '#e6dccd'], [0.18, 0.03, 0.25, '#a8675e']]);
};

B.rug = (h, w, d, c) => {
  const m = mat(c, { roughness: 1 });
  const add2 = (bw, bh, bd, col, y) => { const me = h.box(bw, bh, bd, mat(col, { roughness: 1 }), 0, y, 0); me.castShadow = false; };
  add2(w, 0.01, d, c, 0);
  add2(w - 0.16, 0.002, d - 0.16, darker(c, 0.82), 0.01);
  add2(w - 0.26, 0.002, d - 0.26, lighter(c, 0.12), 0.012);
};

B.floorlamp = (h, w, d, c) => {
  const r = Math.min(w, d) / 2;
  const bm = blackMetal();
  h.lathe([[0, 0], [0.5 * r, 0], [0.5 * r, 0.015], [0.3 * r, 0.03], [0.02, 0.04], [0.011, 0.05]], bm, 0, 0, 0, 28);
  h.cyl(0.011, 0.011, 1.33, bm, 0, 0.03, 0, 10);
  h.lathe([[r * 0.85, 0], [r * 0.55, 0.36]], glowMat(), 0, 1.22, 0, 32);
  h.blob(0.045, 0.06, 0.045, glowMat(), 0, 1.36, 0);
  h.ring(r * 0.85, 0.004, bm, 0, 1.22, 0);
  h.ring(r * 0.55, 0.004, bm, 0, 1.58, 0);
};

B.plant = (h, w, d, c) => {
  const r = Math.min(w, d) / 2, HT = 0.9 + 1.6 * r;
  h.lathe([[0, 0], [0.4 * r, 0], [0.44 * r, 0.02], [0.54 * r, 0.36], [0.57 * r, 0.4], [0.52 * r, 0.4], [0.5 * r, 0.37], [0, 0.37]],
    mat('#d9d2c5', { roughness: 0.7, side: DS }), 0, 0, 0, 28);
  h.cyl(0.5 * r, 0.5 * r, 0.02, mat('#4a3a2c', { roughness: 1 }), 0, 0.35, 0, 20);
  const tm = mat('#6b5540', { roughness: 0.85 });
  h.rod([0, 0.36, 0], [0.02, HT * 0.9, 0.01], 0.014, tm, 0.007);
  const N = 20 + Math.round(36 * r);
  const g1 = mat('#5f8f4e', { roughness: 0.6 }), g2 = mat('#79a862', { roughness: 0.6 });
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), a = i * 2.399;
    const yy = HT * (0.42 + 0.58 * t);
    const len = (0.14 + R() * 0.08) * (1.1 - 0.4 * t) * Math.sqrt(r / 0.25) * 1.25;
    const droop = 0.1 + 0.5 * t + R() * 0.3;
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(droop), -Math.sin(droop) * 0.7 + 0.15, Math.sin(a) * Math.cos(droop)).normalize();
    const base = new THREE.Vector3(0.02 * t, yy, 0.01 * t);
    const sap = base.clone().add(new THREE.Vector3(Math.cos(a) * 0.06, 0.03, Math.sin(a) * 0.06));
    h.rod([base.x, base.y, base.z], [sap.x, sap.y, sap.z], 0.003, tm);
    const ctr = sap.clone().addScaledVector(dir, len / 2);
    const me = h.blob(len / 2, 0.005, len * 0.27, i % 2 ? g2 : g1, ctr.x, ctr.y, ctr.z);
    me.material = i % 2 ? g2 : g1;
    me.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  }
};

/* ===== Yemek & Mutfak ===== */
B.table = (h, w, d, c) => {
  const dk = darker(c, 0.55);
  h.legs(w, d, 0.715, woodM(dk), 0.07, 0.035);
  h.rbox(w, 0.035, d, mat(c, { roughness: 0.4 }), 0, 0.715, 0, 0.012);
  h.box(w - 0.22, 0.07, d - 0.22, woodM(dk), 0, 0.645, 0);
  const ty = 0.75;
  h.box(w * 0.7, 0.003, 0.32, mat('#b9a58c', { roughness: 0.9 }), 0, ty, 0);
  const ns = Math.max(1, Math.round(w / 0.62)), ww = w - 0.2;
  for (const sz of [-1, 1]) for (let i = 0; i < ns; i++) {
    const x = -ww / 2 + ww * (i + 0.5) / ns, z = sz * (d / 2 - 0.2);
    h.box(0.38, 0.004, 0.28, mat('#e7dfd1', { roughness: 0.9 }), x, ty, z);
    plate(h, x, ty + 0.004, z, 0.11);
    h.cyl(0.03, 0.026, 0.09, mat('#dfeaee', { roughness: 0.05, transparent: true, opacity: 0.45 }), x + 0.15, ty, z - sz * 0.06, 14);
  }
  vase(h, 0, ty, 0, { h: 0.26, r: 0.065, flowers: true, color: '#efe6d6' });
};

B.roundtable = (h, w, d, c) => {
  const rr = w / 2;
  h.lathe([[0.25, 0], [0.25, 0.02], [0.08, 0.06], [0.05, 0.2], [0.05, 0.62], [0.12, 0.69], [0.14, 0.715]], woodM('#4a3e33'), 0, 0, 0, 32);
  h.cyl(rr, rr, 0.035, mat(c, { roughness: 0.4 }), 0, 0.715, 0, 48);
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4;
    plate(h, Math.cos(a) * rr * 0.6, 0.75, Math.sin(a) * rr * 0.6, 0.11);
  }
  vase(h, 0, 0.75, 0, { h: 0.24, r: 0.06, flowers: true, color: '#efe6d6' });
};

B.island = (h, w, d, c) => {
  const cd = d - 0.3, bz = -d / 2;
  const zc = bz + cd / 2;
  const stone = mat('#e8e4dc', { roughness: 0.2 });
  h.box(w - 0.1, 0.1, cd - 0.08, mat('#4a4641'), 0, 0, zc);
  h.box(w - 0.1, 0.74, cd - 0.03, woodM(c), 0, 0.1, zc);
  const s = h.sub(0, 0, zc, PI);
  const n = Math.max(1, Math.round((w - 0.1) / 0.6));
  s.fronts({ x0: -(w - 0.1) / 2 + 0.01, x1: (w - 0.1) / 2 - 0.01, y0: 0.62, y1: 0.83, z: (cd - 0.03) / 2, nx: n, ny: 1, m: woodM(darker(c, 0.98)), hd: 'bar' });
  s.fronts({ x0: -(w - 0.1) / 2 + 0.01, x1: (w - 0.1) / 2 - 0.01, y0: 0.1, y1: 0.62, z: (cd - 0.03) / 2, nx: n, ny: 1, m: woodM(darker(c, 0.98)), hd: 'bar' });
  h.rbox(w, 0.05, d, stone, 0, 0.84, 0, 0.012);
  for (const sx of [-1, 1]) h.box(0.04, 0.84, d, stone, sx * (w / 2 - 0.02), 0, 0);
  fruitBowl(h, -w * 0.25, 0.89, -0.1, 4);
  vase(h, w * 0.3, 0.89, -0.1, { h: 0.24, r: 0.06, flowers: true, color: '#e9e2d4' });
};

B.barstool = (h, w, d, c) => {
  const r = Math.min(w, d) / 2;
  const bm = blackMetal();
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4, ca = Math.cos(a), sa = Math.sin(a);
    h.rod([ca * 0.72 * r, 0, sa * 0.72 * r], [ca * 0.4 * r, 0.7, sa * 0.4 * r], 0.012, bm, 0.014);
  }
  h.ring(0.59 * r, 0.008, bm, 0, 0.28, 0);
  h.cyl(0.85 * r, 0.85 * r, 0.015, bm, 0, 0.685, 0, 24);
  h.lathe([[0, 0], [r * 0.98, 0], [r, 0.03], [r * 0.92, 0.07], [r * 0.5, 0.075], [0, 0.075]], mat(c, { roughness: 0.6 }), 0, 0.7, 0, 28);
};

B.counter = (h, w, d, c) => {
  const bz = -d / 2;
  const n = Math.max(1, Math.round(w / 0.6));
  h.box(w, 0.1, d - 0.06, mat('#4a4641'), 0, 0, -0.01);
  h.box(w, 0.72, d - 0.04, woodM(c), 0, 0.1, -0.0);
  const fm = woodM(darker(c, 0.98));
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 0.64, y1: 0.82, z: (d - 0.04) / 2, nx: n, ny: 1, m: fm, hd: 'bar' });
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 0.1, y1: 0.64, z: (d - 0.04) / 2, nx: n, ny: 1, m: fm, hd: 'bar' });
  h.rbox(w + 0.01, 0.04, d, mat('#dcd7cf', { roughness: 0.22 }), 0, 0.82, 0, 0.012);
  h.box(w, 0.62, 0.01, mat('#efece6', { roughness: 0.4 }), 0, 0.86, bz + 0.005);
  h.box(w, 0.7, 0.33, woodM(c), 0, 1.48, bz + 0.165);
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 1.49, y1: 2.17, z: bz + 0.33, nx: n, ny: 1, m: fm, hd: 'bar', hy: 1.62 });
  h.box(w - 0.1, 0.012, 0.03, glowMat(), 0, 1.468, bz + 0.25);
  if (w >= 0.8) {
    h.rbox(0.35, 0.02, 0.24, woodM('#b98d5f'), -w / 2 + 0.3, 0.86, -0.02, 0.006);
    const jc = ['#e8dcc4', '#d9b36c', '#a8b58c'], jr = [0.07, 0.06, 0.05];
    for (let i = 0; i < 3; i++) h.cyl(jr[i], jr[i], 0.16 - i * 0.02, mat(jc[i], { roughness: 0.1, transparent: true, opacity: 0.8 }), w / 2 - 0.16 - i * 0.16, 0.86, bz + 0.16, 18);
    h.cyl(0.05, 0.045, 0.14, mat('#c9ced3', { metalness: 0.7, roughness: 0.3 }), w * 0.05, 0.86, bz + 0.15, 16);
    h.rod([w * 0.05, 1.0, bz + 0.15], [w * 0.05 - 0.02, 1.13, bz + 0.13], 0.006, mat('#8a6a4a'));
    h.rod([w * 0.05, 1.0, bz + 0.15], [w * 0.05 + 0.02, 1.12, bz + 0.16], 0.006, mat('#2b2b2d'));
  }
};

B.stove = (h, w, d, c) => {
  const bz = -d / 2, fz = d / 2;
  h.rbox(w, 0.012, d, mat('#0d0d0e', { roughness: 0.1, metalness: 0.2 }), 0, 0.862, 0, 0.004);
  const rb = Math.min(w, d) * 0.26;
  const eyes = w / d > 1.4 ? [[-w / 4, 0], [w / 4, 0]] : [[-w / 4, -d / 4], [w / 4, -d / 4], [-w / 4, d / 4], [w / 4, d / 4]];
  const grate = mat('#161616', { roughness: 0.5, metalness: 0.5 });
  for (const [ex, ez] of eyes) {
    h.cyl(rb, rb, 0.003, mat('#050505', { roughness: 0.3 }), ex, 0.874, ez, 28);
    h.cyl(rb * 0.55, rb * 0.55, 0.012, mat('#8a6a3a', { metalness: 0.7, roughness: 0.4 }), ex, 0.874, ez, 20);
    h.cyl(rb * 0.4, rb * 0.4, 0.008, mat('#3a2f22', { roughness: 0.5 }), ex, 0.886, ez, 20);
    for (let k = 0; k < 5; k++) {
      const a = k * PI * 2 / 5;
      const arm = h.box(rb * 1.05, 0.008, 0.01, grate, ex + Math.cos(a) * rb * 0.53, 0.89, ez + Math.sin(a) * rb * 0.53);
      arm.rotation.y = -a;
    }
    h.cylZ(0.018, 0.018, 0.02, mat('#2b2b2d', { metalness: 0.5, roughness: 0.4 }), ex, 0.874, fz - 0.03);
  }
  const st = steel();
  h.rbox(w, 0.06, 0.5, st, 0, 1.55, bz + 0.25, 0.015);
  h.box(0.3, 0.72, 0.26, st, 0, 1.61, bz + 0.13);
  const gl = h.box(w - 0.06, 0.008, 0.4, mat('#1c2126', { roughness: 0.1, transparent: true, opacity: 0.7 }), 0, 1.575, bz + 0.3);
  gl.rotation.x = 0.12;
  h.box(w * 0.6, 0.006, 0.02, led('#7ad0ff', 1.2), 0, 1.545, bz + 0.44);
};

B.ksink = (h, w, d, c) => {
  const bz = -d / 2;
  const st = steel();
  const two = w >= 0.75;
  const bw = two ? w * 0.42 : w * 0.7, bd = d * 0.66;
  const centers = two ? [-w * 0.23, w * 0.23] : [0];
  h.slab(w, d, 0.008, centers.map(x => ({ x, z: 0, w: bw, d: bd, r: 0.04 })), st, 0, 0.862, 0);
  for (const x of centers) {
    h.shell(bw, bd, 0.17, 0.006, 0.04, st, x, 0.7, 0);
    h.box(bw, 0.008, bd, st, x, 0.69, 0);
    h.cyl(0.03, 0.03, 0.006, mat('#8a8f93', { metalness: 0.8, roughness: 0.4 }), x, 0.698, 0.0, 16);
  }
  const zb = bz + d * 0.1;
  h.cyl(0.03, 0.035, 0.035, chrome(), 0, 0.87, zb, 20);
  h.tube([[0, 0.9, zb], [0, 1.13, zb], [0, 1.17, zb + 0.06], [0, 1.12, zb + 0.16], [0, 1.08, zb + 0.2]], 0.011, chrome());
  h.rod([0.03, 0.93, zb], [0.1, 0.99, zb], 0.007, chrome());
};

B.fridge = (h, w, d, c) => {
  const fz = d / 2;
  const bm = mat(c, { metalness: 0.45, roughness: 0.28 });
  h.rbox(w, 1.8, d - 0.04, bm, 0, 0, -0.02, 0.02);
  const hm = mat('#b6bbc0', { metalness: 0.9, roughness: 0.25 });
  if (w > 0.85) {
    for (const sx of [-1, 1]) h.rbox(w / 2 - 0.006, 1.72, 0.04, bm, sx * w / 4, 0.06, fz - 0.02, 0.012);
    for (const sx of [-1, 1]) h.rbox(0.022, 0.8, 0.028, hm, sx * 0.05, 0.6, fz + 0.02, 0.008);
    h.box(0.08, 0.12, 0.006, screenMat('#2a5a8a'), -w / 4, 1.2, fz + 0.003);
  } else {
    h.rbox(w, 1.06, 0.04, bm, 0, 0.72, fz - 0.02, 0.012);
    h.rbox(w, 0.64, 0.04, bm, 0, 0.07, fz - 0.02, 0.012);
    h.rbox(0.022, 0.5, 0.028, hm, -w / 2 + 0.06, 1.15, fz + 0.02, 0.008);
    h.rbox(0.022, 0.4, 0.028, hm, -w / 2 + 0.06, 0.3, fz + 0.02, 0.008);
    h.rbox(w * 0.6, 0.02, 0.028, hm, 0, 0.7, fz + 0.02, 0.008);
    h.box(0.08, 0.1, 0.006, screenMat('#2a5a8a'), w / 4, 1.4, fz + 0.003);
  }
};

B.cabinet = (h, w, d, c) => {
  const bz = -d / 2;
  h.legs(w, d, 0.1, woodM('#5a4a3b'), 0.06, 0.018);
  h.box(w, 0.72, d - 0.02, woodM(c), 0, 0.1, 0);
  const n = Math.max(1, Math.round(w / 0.5));
  const fm = woodM(darker(c, 0.97));
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 0.62, y1: 0.82, z: (d - 0.02) / 2, nx: n, ny: 1, m: fm, hd: 'bar' });
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 0.105, y1: 0.615, z: (d - 0.02) / 2, nx: n, ny: 1, m: fm, hd: 'bar' });
  h.rbox(w + 0.02, 0.03, d + 0.01, woodM(darker(c, 0.62)), 0, 0.82, 0, 0.008);
  vase(h, -w / 2 + 0.16, 0.85, bz + 0.12, { h: 0.26, r: 0.06, flowers: w > 0.5, color: '#ddd3bf' });
  if (w > 0.7) {
    const fr = h.rbox(0.28, 0.36, 0.02, woodM('#8a6a4a'), -w * 0.1, 0.85, bz + 0.1, 0.006);
    fr.rotation.x = -0.15;
    const pic = h.box(0.22, 0.3, 0.005, mat('#c9d4cc', { roughness: 0.8 }), -w * 0.1, 0.88, bz + 0.117);
    pic.rotation.x = -0.15;
    fruitBowl(h, w * 0.3, 0.85, 0.0, 3, 0.13);
  }
};

B.shoecab = (h, w, d, c) => {
  h.box(w - 0.04, 0.14, d - 0.08, mat('#2a2724'), 0, 0, -0.01);
  h.box(w, 0.815, d - 0.02, woodM(c), 0, 0.16, 0);
  h.box(w - 0.06, 0.008, d - 0.08, glowMat(), 0, 0.152, 0);
  const n = Math.max(1, Math.round(w / 0.45));
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 0.17, y1: 0.97, z: (d - 0.02) / 2, nx: n, ny: 1, m: woodM(darker(c, 0.97)), hd: 'edge' });
  h.rbox(w + 0.01, 0.025, d, woodM(darker(c, 0.9)), 0, 0.975, 0, 0.008);
  h.rbox(0.3, 0.018, 0.2, woodM('#8a6a4a'), -w * 0.25, 1.0, 0, 0.006);
  cup(h, -w * 0.25, 1.018, 0.0, 0.9, '#e8dcc4');
  vase(h, w * 0.3, 1.0, -0.02, { h: 0.24, r: 0.055, flowers: true, color: '#ddd3bf' });
};

/* ===== Banyo ===== */
B.toilet = (h, w, d, c) => {
  const bz = -d / 2;
  const cm = ceramic();
  h.rbox(w * 0.88, 0.4, d * 0.24, cm, 0, 0.36, bz + d * 0.12, 0.03);
  h.rbox(w * 0.92, 0.03, d * 0.27, cm, 0, 0.76, bz + d * 0.135, 0.012);
  h.cyl(0.02, 0.02, 0.012, chrome(), 0, 0.79, bz + d * 0.12, 16);
  const Rb = w * 0.45, sz = d * 0.37 / Rb, zc = bz + d * 0.27 + d * 0.37;
  const b = h.lathe([[0.45 * Rb, 0], [0.75 * Rb, 0.02], [0.95 * Rb, 0.16], [Rb, 0.3], [Rb, 0.37], [0.82 * Rb, 0.37], [0.78 * Rb, 0.25], [0.5 * Rb, 0.06]],
    mat('#fbfbf9', { roughness: 0.12, side: DS }), 0, 0, zc, 32);
  b.scale.z = sz;
  const seat = h.lathe([[0.7 * Rb, 0], [0.99 * Rb, 0], [0.99 * Rb, 0.022], [0.7 * Rb, 0.022]], mat('#f4f4f2', { roughness: 0.2, side: DS }), 0, 0.37, zc, 32);
  seat.scale.z = sz;
  const lid = h.cyl(Rb * 0.97, Rb * 0.97, 0.014, mat('#f4f4f2', { roughness: 0.2 }), 0, 0.392, zc, 32);
  lid.scale.z = sz;
  for (const sx of [-1, 1]) h.cyl(0.012, 0.012, 0.03, chrome(), sx * w * 0.25, 0.37, zc - d * 0.37 + 0.0, 10);
};

B.vanity = (h, w, d, c) => {
  const bz = -d / 2, fz = d / 2;
  const nb = w >= 1.1 ? 2 : 1;
  h.rbox(w, 0.45, d - 0.04, woodM(c), 0, 0.33, -0.02, 0.012);
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 0.34, y1: 0.77, z: d / 2 - 0.04 + 0.0, nx: nb, ny: 2, m: woodM(darker(c, 0.98)), hd: 'edge' });
  h.rbox(w, 0.03, d, mat('#fafafa', { roughness: 0.3 }), 0, 0.78, 0, 0.008);
  const cw = w / nb;
  const rb = Math.min(0.19, cw * 0.36);
  for (let i = 0; i < nb; i++) {
    const x = -w / 2 + cw * (i + 0.5);
    h.lathe([[0, 0], [0.4 * rb, 0], [rb, 0.07], [rb * 1.02, 0.11], [rb * 0.92, 0.11], [rb * 0.85, 0.08], [0.35 * rb, 0.015]], mat('#fbfbf9', { roughness: 0.1, side: DS }), x, 0.81, 0.03, 32);
    h.cyl(0.02, 0.02, 0.004, chrome(), x, 0.815, 0.03, 12);
    h.cyl(0.018, 0.02, 0.05, chrome(), x, 0.81, bz + 0.09, 14);
    h.tube([[x, 0.85, bz + 0.09], [x, 0.98, bz + 0.09], [x, 1.0, bz + 0.13], [x, 0.97, bz + 0.19]], 0.008, chrome());
  }
  const mw = Math.min(0.9 * w, 0.7 * nb);
  h.rbox(mw + 0.02, 0.82, 0.02, glowMat(), 0, 1.14, bz + 0.02, 0.005);
  h.box(mw, 0.8, 0.01, mirrorM(), 0, 1.15, bz + 0.033);
  h.rbox(0.06, 0.12, 0.06, mat('#e9eef0', { roughness: 0.2 }), w / 2 - 0.1, 0.81, bz + 0.15, 0.02);
  h.rbox(0.2, 0.05, 0.14, fabric('#e9eef0'), -w / 2 + 0.16, 0.81, bz + 0.2, 0.02);
};

B.shower = (h, w, d, c) => {
  const bz = -d / 2, fz = d / 2;
  const fm = frameMat(), gm = glassM();
  h.rbox(w, 0.05, d, mat('#f4f4f2', { roughness: 0.3 }), 0, 0, 0, 0.012);
  h.box(0.5, 0.006, 0.05, mat('#9aa0a4', { metalness: 0.8, roughness: 0.3 }), 0, 0.05, 0);
  h.box(w, 1.95, 0.01, gm, 0, 0.05, fz - 0.005);
  h.box(0.01, 1.95, d, gm, w / 2 - 0.005, 0.05, 0);
  for (const [x, z] of [[-w / 2 + 0.015, fz - 0.015], [w / 2 - 0.015, fz - 0.015], [w / 2 - 0.015, bz + 0.015]]) h.box(0.03, 1.95, 0.03, fm, x, 0.05, z);
  h.box(w, 0.03, 0.03, fm, 0, 1.97, fz - 0.015);
  h.box(0.03, 0.03, d, fm, w / 2 - 0.015, 1.97, 0);
  h.box(w, 0.03, 0.03, fm, 0, 0.05, fz - 0.015);
  h.box(0.06, 0.02, 0.02, chrome(), -w * 0.25, 1.0, fz - 0.03);
  const vx = -w * 0.2;
  h.rbox(0.14, 0.1, 0.04, chrome(), vx, 0.95, bz + 0.02, 0.01);
  h.cyl(0.012, 0.012, 1.08, chrome(), vx, 1.0, bz + 0.03, 10);
  h.rbox(0.24, 0.012, 0.24, chrome(), vx, 2.02, bz + 0.16, 0.005);
  h.rod([vx, 2.02, bz + 0.03], [vx, 2.02, bz + 0.1], 0.01, chrome());
  h.tube([[vx + 0.08, 0.98, bz + 0.05], [vx + 0.14, 0.7, bz + 0.08], [vx + 0.1, 0.6, bz + 0.12]], 0.005, mat('#8a8f93', { metalness: 0.7, roughness: 0.4 }));
  h.rbox(0.24, 0.02, 0.1, ceramic(), w / 2 - 0.2, 1.1, bz + 0.06, 0.006);
  const bc = ['#e8b4a0', '#7ad0c8', '#f6d27a'];
  for (let i = 0; i < 3; i++) h.cyl(0.022, 0.022, 0.12 + i * 0.015, mat(bc[i], { roughness: 0.3 }), w / 2 - 0.27 + i * 0.07, 1.12, bz + 0.06, 12);
};

B.bathtub = (h, w, d, c) => {
  const cm = mat(c, { roughness: 0.12 });
  h.shell(w, d, 0.56, 0.07, 0.14, cm, 0, 0, 0);
  h.rbox(w - 0.1, 0.06, d - 0.1, mat('#e9edef', { roughness: 0.2 }), 0, 0.03, 0, 0.03);
  h.rbox(w - 0.13, 0.005, d - 0.13, mat('#bfe0ea', { roughness: 0.05, transparent: true, opacity: 0.6 }), 0, 0.4, 0, 0.002);
  const bk = h.rbox(0.14, 0.35, d - 0.3, cm, -w / 2 + 0.17, 0.12, 0, 0.05);
  bk.rotation.z = -0.5;
  const tx = w / 2 - 0.09;
  h.cyl(0.025, 0.028, 0.03, chrome(), tx, 0.56, 0.0, 16);
  h.tube([[tx, 0.585, 0], [tx, 0.72, 0], [tx - 0.06, 0.74, 0], [tx - 0.12, 0.68, 0]], 0.012, chrome());
  for (const sz of [-1, 1]) h.cyl(0.02, 0.02, 0.03, chrome(), tx, 0.56, sz * 0.14, 12);
};

B.washer = (h, w, d, c) => {
  laundry(h, w, d, c, '#26343d');
};
B.dryer = (h, w, d, c) => {
  laundry(h, w, d, c, '#4a4038');
};
function laundry(h, w, d, c, glassCol) {
  const fz = d / 2;
  h.rbox(w, 0.81, d - 0.02, mat(c, { roughness: 0.35 }), 0, 0.04, 0, 0.02);
  h.rbox(w - 0.02, 0.1, 0.012, mat(lighter(c, 0.3), { roughness: 0.3 }), 0, 0.74, fz - 0.01, 0.006);
  h.box(0.16, 0.05, 0.008, mat('#dcdfe2', { roughness: 0.3 }), -w * 0.28, 0.765, fz - 0.003);
  h.box(0.09, 0.03, 0.006, led('#39d0a8', 0.6), 0.02, 0.775, fz - 0.002);
  h.cylZ(0.03, 0.03, 0.02, chrome(), w * 0.28, 0.79, fz + 0.0, 20);
  const R0 = Math.min(w, d) * 0.25, cy = 0.4;
  h.cylZ(R0, R0, 0.02, mat('#111214', { roughness: 0.4 }), 0, cy, fz - 0.002, 32);
  const rg = h.add(cg(`tor${q(R0 * 1.3)}`, () => new THREE.TorusGeometry(R0 * 1.3, 0.018, 10, 40)), mat('#b5bbc0', { metalness: 0.9, roughness: 0.25 }), 0, cy, fz + 0.005);
  const dome = h.add(cg(`dome${q(R0)}`, () => new THREE.SphereGeometry(R0 * 1.3, 32, 12, 0, PI * 2, 0, PI / 2).scale(1, 0.3, 1)),
    mat(glassCol, { roughness: 0.05, transparent: true, opacity: 0.8, side: DS, depthWrite: false }), 0, cy, fz + 0.005);
  dome.rotation.x = PI / 2;
}

B.waterheater = (h, w, d, c) => {
  const r = Math.min(d / 2, 0.23), len = w - 0.06;
  const zc = -d / 2 + r + 0.01;
  const wm = mat(c, { roughness: 0.3 });
  h.cylX(r, r, len, wm, 0, 1.95, zc, 32);
  for (const sx of [-1, 1]) h.blob(0.05, r, r, wm, sx * len / 2, 1.95, zc);
  for (const sx of [-1, 1]) h.box(0.05, 0.12, 0.03, mat('#9a9a98', { metalness: 0.6, roughness: 0.4 }), sx * len * 0.3, 1.95 - 0.06, -d / 2 + 0.015);
  h.rbox(0.2, 0.09, 0.02, mat('#e0e0dc', { roughness: 0.3 }), 0, 1.95 - 0.045, zc + r - 0.005, 0.008);
  h.box(0.05, 0.02, 0.005, led('#39d05a', 0.8), 0.03, 1.95 - 0.02, zc + r + 0.007);
  h.rod([-0.12, 1.95 - r * 0.6, zc], [-0.12, 1.55, zc], 0.011, mat('#3b7bbf', { roughness: 0.5 }));
  h.rod([0.12, 1.95 - r * 0.6, zc], [0.12, 1.55, zc], 0.011, mat('#c0463a', { roughness: 0.5 }));
};

/* ===== Ev aletleri ===== */
B.tv = (h, w, d, c) => {
  const th = w * 0.5625, bz = -d / 2;
  h.rbox(w * 0.6, th * 0.6, 0.03, blackMetal(), 0, 1.2 - th * 0.3, bz + 0.015, 0.006);
  h.rbox(w, th, 0.025, mat(c, { roughness: 0.4, metalness: 0.3 }), 0, 1.2 - th / 2, bz + 0.04, 0.006);
  h.box(w - 0.03, th - 0.03, 0.003, screenMat('#1f2b3a'), 0, 1.2 - th / 2 + 0.015, bz + 0.04 + 0.0135);
};

B.aircon = (h, w, d, c) => {
  const fz = d / 2;
  h.box(w - 0.02, 0.06, d - 0.04, mat('#cfd3d6', { roughness: 0.5 }), 0, 0, 0);
  h.rbox(w, 1.74, d - 0.01, mat(c, { roughness: 0.3 }), 0, 0.06, 0, 0.06);
  h.rbox(w - 0.06, 1.0, 0.01, mat(lighter(c, 0.4), { roughness: 0.3 }), 0, 0.22, fz - 0.001, 0.008);
  h.box(w - 0.1, 0.42, 0.01, mat('#3d4145', { roughness: 0.5 }), 0, 1.28, fz - 0.001);
  for (let i = 0; i < 8; i++) {
    const l = h.box(w - 0.12, 0.012, 0.05, mat('#f0f0f0', { roughness: 0.4 }), 0, 1.3 + i * 0.048, fz - 0.005);
    l.rotation.x = -0.35;
  }
  h.box(0.03, 0.01, 0.004, led('#39d0c8', 1.2), w * 0.3, 1.15, fz + 0.005);
  for (let i = 0; i < 8; i++) h.box(w - 0.16, 0.004, 0.004, mat('#c9cdd0', { roughness: 0.5 }), 0, 0.34 + i * 0.045, fz + 0.005);
};

B.acwall = (h, w, d, c) => {
  const bz = -d / 2;
  const len = w - 0.02;
  const geo = cg(`ac${q(len)},${q(d)}`, () => {
    const s = new THREE.Shape(), hh = 0.3, rr = Math.min(0.1, d * 0.4), r2 = Math.min(0.07, d * 0.3);
    s.moveTo(0, 0); s.lineTo(d - rr, 0); s.quadraticCurveTo(d, 0, d, rr); s.lineTo(d, hh - r2);
    s.quadraticCurveTo(d, hh, d - r2, hh); s.lineTo(0, hh); s.lineTo(0, 0);
    const e = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2, curveSegments: 8 });
    e.rotateY(-PI / 2);
    e.translate(len / 2, 0, bz);
    return e;
  });
  h.add(geo, mat(c, { roughness: 0.3 }), 0, 2.2, 0);
  h.box(len - 0.08, 0.03, 0.06, mat('#3d4145', { roughness: 0.5 }), 0, 2.2 + 0.002, bz + d - 0.09);
  const fl = h.box(len - 0.1, 0.008, 0.06, mat('#f0f0f0', { roughness: 0.4 }), 0, 2.2 - 0.005, bz + d - 0.05);
  fl.rotation.x = 0.5;
  h.box(0.04, 0.012, 0.004, led('#39d0c8', 1.2), len * 0.3, 2.2 + 0.19, bz + d + 0.011);
  for (let i = 0; i < 6; i++) h.box(len - 0.14, 0.003, 0.004, mat('#d5d8da', { roughness: 0.5 }), 0, 2.2 + 0.31, bz + 0.05 + i * 0.02).visible = true;
};

B.dishwasher = (h, w, d, c) => {
  const fz = d / 2;
  h.box(w - 0.02, 0.08, d - 0.06, mat('#2a2724'), 0, 0, -0.01);
  h.box(w - 0.005, 0.76, d - 0.03, mat('#8b9095', { roughness: 0.5 }), 0, 0.08, 0);
  h.rbox(w - 0.006, 0.7, 0.02, mat(c, { metalness: 0.55, roughness: 0.28 }), 0, 0.1, fz - 0.005, 0.008);
  h.box(w - 0.006, 0.04, 0.02, mat('#26282a', { roughness: 0.4 }), 0, 0.8, fz - 0.005);
  for (let i = 0; i < 4; i++) h.box(0.012, 0.006, 0.004, led(i === 0 ? '#3ddc84' : '#4aa8ff', 1.2), -0.09 + i * 0.06, 0.82, fz + 0.006);
  const L = w * 0.6;
  h.rbox(L, 0.02, 0.02, hwMat(), 0, 0.73, fz + 0.03, 0.008);
  for (const sx of [-1, 1]) h.box(0.02, 0.02, 0.03, hwMat(), sx * (L / 2 - 0.02), 0.73, fz + 0.015);
};

B.ovencol = (h, w, d, c) => {
  const fz = d / 2;
  const zf = (d - 0.02) / 2;
  h.box(w, 2.1, d - 0.02, woodM(c), 0, 0, 0);
  const fm = woodM(darker(c, 0.97));
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 0.08, y1: 0.69, z: zf, nx: 1, ny: 2, m: fm, hd: 'bar' });
  h.fronts({ x0: -w / 2 + 0.01, x1: w / 2 - 0.01, y0: 1.78, y1: 2.09, z: zf, nx: 1, ny: 1, m: fm, hd: 'bar' });
  for (const [y, hh] of [[0.7, 0.58], [1.3, 0.46]]) {
    h.rbox(w - 0.06, hh, 0.02, mat('#1b1b1d', { roughness: 0.4, metalness: 0.3 }), 0, y, zf + 0.002, 0.006);
    h.box(w - 0.14, hh - 0.2, 0.004, screenMat('#161c22'), 0, y + 0.06, zf + 0.013);
    h.box(w - 0.14, 0.045, 0.004, mat('#0d0d0e', { roughness: 0.3 }), 0, y + hh - 0.065, zf + 0.013);
    h.box(0.03, 0.008, 0.004, led('#ffb03b', 1), w * 0.2, y + hh - 0.05, zf + 0.016);
    h.rbox(w - 0.2, 0.018, 0.018, hwMat(), 0, y + hh - 0.1, zf + 0.03, 0.007);
    for (const sx of [-1, 1]) h.box(0.018, 0.018, 0.02, hwMat(), sx * (w / 2 - 0.1), y + hh - 0.1, zf + 0.02);
  }
};

B.purifier = (h, w, d, c) => {
  const fz = d / 2;
  h.rbox(w, 0.72, d, mat(c, { roughness: 0.45 }), 0, 0, 0, 0.06);
  h.rbox(w - 0.04, 0.015, d - 0.04, mat('#d5d9dc', { roughness: 0.4 }), 0, 0.72, 0, 0.006);
  for (let i = 0; i < 7; i++) h.box(w - 0.14, 0.004, 0.012, mat('#26282a'), 0, 0.7345, -d / 2 + 0.05 + i * (d - 0.1) / 6);
  h.rbox(w - 0.08, 0.5, 0.012, fabric('#c8ccd0'), 0, 0.1, fz - 0.004, 0.006);
  h.ring(Math.min(w, d) * 0.3, 0.004, led('#39d0c8', 1.2), 0, 0.6, 0);
  h.box(w * 0.5, 0.008, 0.004, led('#39d0c8', 1.2), 0, 0.6, fz + 0.002);
};

/* ===== Çalışma & Dinlenme ===== */
B.officechair = (h, w, d, c) => {
  const bz = -d / 2, bm = blackMetal(), fb = fabric(c);
  const leg = mat('#555555', { metalness: 0.5, roughness: 0.4 });
  for (let k = 0; k < 5; k++) {
    const a = k * PI * 2 / 5 + PI / 5, ca = Math.cos(a), sa = Math.sin(a);
    h.rod([0, 0.11, 0], [ca * 0.3, 0.06, sa * 0.3], 0.02, leg, 0.013);
    h.blob(0.028, 0.028, 0.028, bm, ca * 0.3, 0.032, sa * 0.3);
  }
  h.cyl(0.025, 0.025, 0.22, chrome(), 0, 0.1, 0, 14);
  h.cyl(0.04, 0.05, 0.12, bm, 0, 0.2, 0, 14);
  h.box(0.28, 0.04, 0.26, bm, 0, 0.34, 0);
  h.rbox(w * 0.78, 0.03, d * 0.72, bm, 0, 0.38, 0.02, 0.01);
  h.rbox(w * 0.8, 0.08, d * 0.74, fb, 0, 0.4, 0.02, 0.03);
  h.tube([[0, 0.36, -0.06], [0, 0.42, bz + 0.1], [0, 0.6, bz + 0.09]], 0.012, bm);
  const fr = h.shell(w * 0.66, 0.5, 0.02, 0.035, 0.07, bm, 0, 0, 0);
  fr.rotation.x = PI / 2; fr.position.set(0, 0.86, bz + 0.09); fr.rotation.x = PI / 2 - 0.12;
  const ms = h.box(w * 0.6, 0.47, 0.006, mat(darker(c, 0.75), { roughness: 0.9, transparent: true, opacity: 0.88 }), 0, 0.86 - 0.235, bz + 0.09);
  ms.position.y = 0.86; ms.rotation.x = -0.12; ms.position.z = bz + 0.09;
  h.rbox(w * 0.4, 0.1, 0.05, fb, 0, 0.62, bz + 0.13, 0.02);
  h.rbox(w * 0.45, 0.12, 0.05, fb, 0, 1.2, bz + 0.06, 0.03);
  for (const sx of [-1, 1]) h.rod([sx * 0.07, 1.0, bz + 0.1], [sx * 0.07, 1.22, bz + 0.07], 0.007, chrome());
  for (const sx of [-1, 1]) {
    h.box(0.03, 0.22, 0.03, bm, sx * w * 0.4, 0.42, 0.02);
    h.rbox(0.07, 0.03, d * 0.4, bm, sx * w * 0.4, 0.63, 0.02, 0.012);
  }
};

B.piano = (h, w, d, c) => {
  const bz = -d / 2;
  const pm = mat(c, { roughness: 0.12, metalness: 0.1 });
  const bd = d * 0.5;
  h.rbox(w, 1.0, bd, pm, 0, 0.25, bz + bd / 2, 0.015);
  h.rbox(w + 0.02, 0.03, bd + 0.02, pm, 0, 1.22, bz + bd / 2, 0.01);
  for (const sx of [-1, 1]) {
    h.rbox(0.06, 0.72, d * 0.5, pm, sx * (w / 2 - 0.03), 0.0, bz + d * 0.75, 0.01);
    h.box(0.08, 0.05, d * 0.5, pm, sx * (w / 2 - 0.04), 0.0, bz + d * 0.75);
  }
  const kd = d * 0.22 - 0.03, kz = bz + bd + kd / 2;
  h.rbox(w - 0.12, 0.06, kd + 0.03, mat('#141414', { roughness: 0.4 }), 0, 0.64, kz + 0.015, 0.008);
  const nk = 52, kw = (w - 0.12) / nk, x0 = -(w - 0.12) / 2;
  const ivory = mat('#f7f2e6', { roughness: 0.35 }), ebony = mat('#0e0e0f', { roughness: 0.35 });
  for (let i = 0; i < nk; i++) {
    h.box(kw - 0.002, 0.02, kd, ivory, x0 + kw * (i + 0.5), 0.68, kz);
    const m7 = i % 7;
    if ([0, 2, 3, 5, 6].includes(m7) && i < nk - 1) h.box(kw * 0.58, 0.02, kd * 0.62, ebony, x0 + kw * (i + 1), 0.7, kz - kd * 0.19);
  }
  const ms = h.rbox(w * 0.7, 0.3, 0.015, mat('#2a2724', { roughness: 0.3 }), 0, 0.8, bz + bd + 0.03, 0.006);
  ms.rotation.x = -0.28;
  h.box(w - 0.1, 0.03, 0.012, pm, 0, 0.72, bz + bd + 0.005);
  const brass = mat('#b8964a', { metalness: 0.9, roughness: 0.3 });
  for (const px of [-0.08, 0, 0.08]) {
    h.box(0.03, 0.012, 0.11, brass, px, 0.05, bz + d * 0.62);
    h.rod([px, 0.05, bz + d * 0.55], [px, 0.5, bz + d * 0.53], 0.004, brass);
  }
  h.cyl(0.014, 0.055, 0.2, mat('#5a3d28', { roughness: 0.4 }), -w * 0.3, 1.25, bz + 0.18, 4).rotation.y = PI / 4;
  h.rod([-w * 0.3, 1.32, bz + 0.18], [-w * 0.3 + 0.03, 1.42, bz + 0.18], 0.003, brass);
  const fr = h.rbox(0.2, 0.15, 0.015, woodM('#8a6a4a'), w * 0.3, 1.25, bz + 0.2, 0.005);
  fr.rotation.x = -0.2;
  const pc = h.box(0.17, 0.12, 0.004, mat('#cbd6db', { roughness: 0.5 }), w * 0.3, 1.265, bz + 0.212);
  pc.rotation.x = -0.2;
};

B.treadmill = (h, w, d, c) => {
  const bz = -d / 2;
  const bm = mat(c, { roughness: 0.5 }), dk = blackMetal();
  h.rbox(w, 0.14, d - 0.25, bm, 0, 0.03, 0.125, 0.03);
  for (const sx of [-1, 1]) for (const z of [bz + 0.35, d / 2 - 0.15]) h.cyl(0.03, 0.035, 0.03, dk, sx * (w / 2 - 0.08), 0, z, 12);
  h.box(w - 0.16, 0.006, d - 0.5, mat('#141414', { roughness: 0.8 }), 0, 0.171, 0.15);
  for (const sx of [-1, 1]) h.box(0.05, 0.02, d - 0.5, mat('#b6bbc0', { metalness: 0.8, roughness: 0.35 }), sx * (w / 2 - 0.1), 0.171, 0.15);
  h.rbox(w, 0.22, 0.32, bm, 0, 0.03, bz + 0.16, 0.05);
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.08);
    h.rod([x, 0.15, bz + 0.2], [x, 1.15, bz + 0.2], 0.02, dk);
    h.tube([[x, 1.05, bz + 0.2], [x, 1.02, bz + 0.5], [x, 0.95, bz + 0.85], [x, 0.9, bz + 0.98]], 0.016, chrome());
  }
  const cs = h.rbox(w * 0.8, 0.2, 0.08, dk, 0, 1.12, bz + 0.2, 0.03);
  cs.rotation.x = -0.5;
  const sc = h.box(w * 0.6, 0.12, 0.005, screenMat('#2a6ab0'), 0, 1.2, bz + 0.2 + 0.05);
  sc.rotation.x = -0.5; sc.position.set(0, 1.23, bz + 0.245);
};

/* ---------- bilinmeyen ---------- */
function unknownBox(h, w, d, c) { h.box(w, 0.8, d, mat(c), 0, 0, 0); }

/* ---------- yayınlanan tipler ---------- */
const TYPES = ['bed', 'crib', 'nightstand', 'wardrobe', 'dresser', 'desk', 'chair', 'bookshelf', 'baycushion',
  'sofa', 'cornersofa', 'armchair', 'beanbag', 'coffeetable', 'sidetable', 'tvstand', 'rug', 'shoecab', 'floorlamp', 'plant',
  'table', 'roundtable', 'island', 'barstool', 'counter', 'stove', 'ksink', 'fridge', 'cabinet',
  'toilet', 'vanity', 'shower', 'bathtub', 'washer', 'waterheater',
  'tv', 'aircon', 'acwall', 'dishwasher', 'ovencol', 'dryer', 'purifier',
  'officechair', 'piano', 'treadmill'];

/* ---------- aynı malzemeli parçaları birleştir (çizim çağrısı azaltma) ---------- */
function mergeGroup(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const buckets = new Map();
  const meshes = [];
  g.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) {
    const key = m.material.uuid + (m.castShadow ? 'c' : 'n');
    let b = buckets.get(key);
    if (!b) { b = { mat: m.material, cast: m.castShadow, geos: [] }; buckets.set(key, b); }
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    b.geos.push(geo);
  }
  for (const m of meshes) m.parent.remove(m);
  for (const c of [...g.children]) if (c.isGroup && c.children.length === 0) g.remove(c);
  for (const b of buckets.values()) {
    const geo = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    b.geos.forEach(x => { if (x !== geo) x.dispose(); });
    if (!geo) continue;
    const me = new THREE.Mesh(geo, b.mat);
    me.castShadow = b.cast; me.receiveShadow = true;
    g.add(me);
  }
}

function buildFurniture(f, opts = {}) {
  if (opts.envMap !== undefined || opts.envK !== undefined) setEnvironment(opts.envMap, opts.envK);
  const w = Math.max(0.05, (+f.w || 500) / 1000), d = Math.max(0.05, (+f.d || 500) / 1000);
  const c = f.color || '#cccccc';
  const g = new THREE.Group();
  g.name = 'furn-' + (f.id !== undefined ? f.id : f.type);
  g.userData.furnitureId = f.id;
  g.userData.type = f.type;
  RNG = mulberry32(Math.round((+f.w || 0) * 7 + (+f.d || 0) * 13 + (+f.cx || 0) + (+f.cy || 0)));
  const h = H(g);
  try {
    (B[f.type] || unknownBox)(h, w, d, c);
  } catch (e) {
    console.error('Models3D: model hatası', f.type, e);
    while (g.children.length) g.remove(g.children[0]);
    unknownBox(h, w, d, c);
  }
  if (f.type === 'rug') g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  if (opts.merge !== false) {
    try { mergeGroup(g); } catch (e) { console.warn('Models3D: birleştirme atlandı', e); }
  }
  return g;
}

function disposeGroup(g) {
  if (!g) return;
  g.traverse(o => { if (o.isMesh && o.geometry && !SHARED.has(o.geometry)) o.geometry.dispose(); });
  if (g.parent) g.parent.remove(g);
  while (g.children.length) g.remove(g.children[0]);
}

window.Models3D = { buildFurniture, TYPES, disposeGroup, setEnvironment, mat, darker, lighter };
window.dispatchEvent(new Event('models3d-ready'));
