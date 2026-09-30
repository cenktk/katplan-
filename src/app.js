/* Kat Planı Tasarımı — 2D editör, panel, durum, i18n (klasik betik).
 * 3D tarafı window.View3D ile konuşur; View3D yoksa 2D tek başına çalışır. */

/* ===================== yardımcılar ===================== */
var NS = 'http://www.w3.org/2000/svg';
var PX_MM = 25.4 / 96;
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function r1(v) { return Math.round(v * 10) / 10; }
function norm(a) { a = Math.round(a) % 360; return a < 0 ? a + 360 : a; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
var K_STATE = 'kp-plan-v1', K_LANG = 'kp-lang', K_PANES = 'kp-panes';
var IS_TOUCH = false;
try { IS_TOUCH = matchMedia('(pointer:coarse)').matches; } catch (e) { }

/* ===================== dil ===================== */
var LANG = lsGet(K_LANG) === 'en' ? 'en' : 'tr';
function tr(t, e) { return LANG === 'en' ? e : t; }
function nm(s) { try { return LANG === 'en' ? ((typeof NAMES_EN !== 'undefined' && NAMES_EN[s]) || s) : s; } catch (e) { return s; } }
function locale() { return LANG === 'en' ? 'en-US' : 'tr-TR'; }
function fmt(n, dec) {
  dec = dec == null ? 0 : dec;
  try { return Number(n).toLocaleString(locale(), { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  catch (e) { return Number(n).toFixed(dec); }
}
function money(n) { return '₺' + fmt(Math.round(n), 0); }

/* ===================== veri (data.js) ===================== */
var _WALLS = (typeof WALLS !== 'undefined') ? WALLS : [];
var _WINS = (typeof WINS !== 'undefined') ? WINS : [];
var _DOORS = (typeof DOORS !== 'undefined') ? DOORS : [];
var _SLIDES = (typeof SLIDES !== 'undefined') ? SLIDES : [];
var _ROOMS = (typeof ROOMS !== 'undefined') ? ROOMS : [];
var _BOUNDS = (typeof BOUNDS !== 'undefined') ? BOUNDS : { x: -1850, y: -1750, w: 15600, h: 14100 };

/* Malzemeler: dizi ya da nesne olabilir → [{k,name,price,sw}] */
function matList() {
  var M = (typeof MATS !== 'undefined') ? MATS : [];
  var out = [];
  if (Array.isArray(M)) {
    M.forEach(function (e) { out.push({ k: e.k || e.key || e.id, name: e.name || e.tr || e.n, price: e.price != null ? e.price : e.p, sw: e.sw || e.color }); });
  } else {
    Object.keys(M).forEach(function (k) { var e = M[k]; out.push({ k: k, name: e.name || e.tr || e.n, price: e.price != null ? e.price : e.p, sw: e.sw || e.color }); });
  }
  return out;
}
var MATLIST = matList();
function matOf(k) { for (var i = 0; i < MATLIST.length; i++) if (MATLIST[i].k === k) return MATLIST[i]; return MATLIST[0] || { k: k, name: k, price: 0, sw: '#ddd' }; }

/* Kitaplık: [{cat, items:[{type,name,w,d,color}]}] */
function libList() {
  var L = (typeof LIB !== 'undefined') ? LIB : [];
  var cats = [];
  var arr = Array.isArray(L) ? L : Object.keys(L).map(function (k) { return { cat: k, items: L[k] }; });
  arr.forEach(function (c) {
    var items = (c.items || c.list || c[1] || []).map(function (it) {
      if (Array.isArray(it)) return { type: it[0], name: it[1], w: it[2], d: it[3], color: it[4] };
      return { type: it.type || it.t, name: it.name || it.n, w: it.w, d: it.d, color: it.color || it.c };
    });
    cats.push({ cat: c.cat || c.name || c.title || c[0], items: items });
  });
  return cats;
}
var LIBCATS = libList();

/* ===================== durum ===================== */
var state = null;
var ui = { tool: 'select', sel: null, is3d: false, layers: { dims: true, rooms: true, furn: true, grid: false, bearing: false, snap: true } };
var view = { x0: 0, y0: 0, s: 0.05 };
var undoStack = [], redoStack = [], pendingSnap = null;
var _uid = 0;

function newId() { return 'f' + Date.now().toString(36) + (_uid++); }
function defaultState() {
  var rooms = {};
  _ROOMS.forEach(function (r) { rooms[r.id] = { name: r.name, mat: r.mat }; });
  var fur = (typeof defaultFurniture === 'function') ? defaultFurniture() : [];
  fur = fur.map(function (f) { var o = JSON.parse(JSON.stringify(f)); if (!o.id) o.id = newId(); return o; });
  return { furniture: fur, rooms: rooms, demolished: [], measures: [] };
}
function fixState(s) {
  var d = defaultState();
  s.rooms = Object.assign(d.rooms, s.rooms || {});
  if (!Array.isArray(s.demolished)) s.demolished = [];
  if (!Array.isArray(s.measures)) s.measures = [];
  return s;
}
function loadState() {
  var raw = lsGet(K_STATE);
  if (raw) { try { var s = JSON.parse(raw); if (s && Array.isArray(s.furniture)) return fixState(s); } catch (e) { } }
  return defaultState();
}
function saveState() { lsSet(K_STATE, JSON.stringify(state)); }
function getF(id) { for (var i = 0; i < state.furniture.length; i++) if (state.furniture[i].id === id) return state.furniture[i]; return null; }
function roomById(id) { for (var i = 0; i < _ROOMS.length; i++) if (_ROOMS[i].id === id) return _ROOMS[i]; return null; }
function roomName(id) { var r = state.rooms[id]; return r ? r.name : id; }
function roomMatKey(id) { var r = state.rooms[id]; return r ? r.mat : 'wood'; }

/* geri al / yinele (150 adım) */
function snap() { pendingSnap = JSON.stringify(state); }
function commit() {
  if (pendingSnap != null) {
    if (pendingSnap !== JSON.stringify(state)) { undoStack.push(pendingSnap); if (undoStack.length > 150) undoStack.shift(); redoStack = []; }
    pendingSnap = null;
  }
  saveState(); renderAll();
}
function mutate(fn) { snap(); fn(); commit(); }
function validateSel() {
  if (ui.sel && ui.sel.kind === 'furn' && !getF(ui.sel.id)) ui.sel = null;
  if (ui.sel && ui.sel.kind === 'room' && !roomById(ui.sel.id)) ui.sel = null;
}
function undo() {
  if (!undoStack.length) { toast(tr('Geri alınacak işlem yok', 'Nothing to undo')); return; }
  redoStack.push(JSON.stringify(state));
  state = JSON.parse(undoStack.pop()); window.state = state;
  validateSel(); saveState(); renderAll();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = JSON.parse(redoStack.pop()); window.state = state;
  validateSel(); saveState(); renderAll();
}

/* ===================== geometri ===================== */
function polyPerim(p) { var a = 0; for (var i = 0; i < p.length; i++) { var q = p[(i + 1) % p.length]; a += Math.hypot(q[0] - p[i][0], q[1] - p[i][1]); } return a / 1000; }
function polyBox(p) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; p.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }); return { x0: x0, y0: y0, x1: x1, y1: y1 }; }
function pointInPoly(x, y, p) {
  var c = false;
  for (var i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c;
  }
  return c;
}
function roomAt(x, y) {
  for (var i = _ROOMS.length - 1; i >= 0; i--) if (pointInPoly(x, y, _ROOMS[i].poly)) return _ROOMS[i];
  return null;
}
function netArea() { var a = 0; _ROOMS.forEach(function (r) { if (r.counted !== false) a += polyArea(r.poly); }); return a; }
function isDemo(i) { return state.demolished.indexOf('w' + i) >= 0; }
/* yapışma hedefleri: yıkılmamış duvarlar + pencereler */
function targets() {
  var t = [];
  _WALLS.forEach(function (w, i) { if (!isDemo(i)) t.push([w[0], w[1], w[2], w[3]]); });
  _WINS.forEach(function (w) { t.push([w[0], w[1], w[2], w[3]]); });
  return t;
}
function halfBox(f) {
  var a = f.rot * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  return { hw: f.w / 2 * c + f.d / 2 * s, hh: f.w / 2 * s + f.d / 2 * c };
}
/* mobilya taşırken duvara yapışma (SPEC §4.3) */
function snapMove(f, x, y) {
  var gx = Math.round(x / 10) * 10, gy = Math.round(y / 10) * 10;
  var rx = gx, ry = gy;
  if (ui.layers.snap) {
    var th = 10 / view.s, hb = halfBox(f), hw = hb.hw, hh = hb.hh;
    var bx = null, bdx = th + 1e-9, by = null, bdy = th + 1e-9;
    targets().forEach(function (t) {
      var vov = (y + hh > t[1] - th) && (y - hh < t[3] + th);
      var hov = (x + hw > t[0] - th) && (x - hw < t[2] + th);
      if (vov) {
        [t[0] - hw, t[0] + hw, t[2] - hw, t[2] + hw].forEach(function (c) { var dd = Math.abs(c - x); if (dd < bdx) { bdx = dd; bx = c; } });
      }
      if (hov) {
        [t[1] - hh, t[1] + hh, t[3] - hh, t[3] + hh].forEach(function (c) { var dd = Math.abs(c - y); if (dd < bdy) { bdy = dd; by = c; } });
      }
    });
    if (bx != null) rx = bx;
    if (by != null) ry = by;
  }
  var out = [rx, ry]; out.x = rx; out.y = ry;
  return out;
}
/* ölçü aracı yapışması */
function snapPoint(x, y, first, shift) {
  var th = 8 / view.s, rx = Math.round(x / 10) * 10, ry = Math.round(y / 10) * 10;
  var bx = th, by = th;
  targets().forEach(function (t) {
    [t[0], t[2]].forEach(function (c) { var d = Math.abs(c - x); if (d < bx) { bx = d; rx = c; } });
    [t[1], t[3]].forEach(function (c) { var d = Math.abs(c - y); if (d < by) { by = d; ry = c; } });
  });
  if (shift && first) { if (Math.abs(rx - first.x) > Math.abs(ry - first.y)) ry = first.y; else rx = first.x; }
  return { x: rx, y: ry };
}
/* eklenen mobilyayı duvardan it */
function pushOut(f) {
  for (var round = 0; round < 4; round++) {
    var moved = false, hb = halfBox(f);
    var ts = targets();
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i];
      var ox = Math.min(f.cx + hb.hw, t[2]) - Math.max(f.cx - hb.hw, t[0]);
      var oy = Math.min(f.cy + hb.hh, t[3]) - Math.max(f.cy - hb.hh, t[1]);
      if (ox > 0 && oy > 0) {
        if (ox < oy) f.cx += (f.cx < (t[0] + t[2]) / 2) ? -ox : ox;
        else f.cy += (f.cy < (t[1] + t[3]) / 2) ? -oy : oy;
        moved = true; hb = halfBox(f);
      }
    }
    if (!moved) break;
  }
}

/* ===================== 2D semboller (SPEC §5.2) ===================== */
function shade(hex, k) {
  var h = String(hex || '#cccccc').replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  var v = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
  v = v.map(function (n) { return k < 1 ? n * k : n + (255 - n) * (k - 1) * 2; });
  return '#' + v.map(function (n) { n = clamp(Math.round(n), 0, 255); return (n < 16 ? '0' : '') + n.toString(16); }).join('');
}
function n2(v) { return Math.round(v * 100) / 100; }
function RC(x, y, w, h, fill, rx, ex) {
  return '<rect x="' + n2(x) + '" y="' + n2(y) + '" width="' + n2(Math.max(0, w)) + '" height="' + n2(Math.max(0, h)) + '"' + (rx ? ' rx="' + n2(rx) + '"' : '') + ' fill="' + (fill || 'none') + '"' + (ex ? ' ' + ex : '') + '/>';
}
function EL(cx, cy, rx, ry, fill, ex) { return '<ellipse cx="' + n2(cx) + '" cy="' + n2(cy) + '" rx="' + n2(rx) + '" ry="' + n2(ry) + '" fill="' + (fill || 'none') + '"' + (ex ? ' ' + ex : '') + '/>'; }
function CI(cx, cy, r, fill, ex) { return '<circle cx="' + n2(cx) + '" cy="' + n2(cy) + '" r="' + n2(r) + '" fill="' + (fill || 'none') + '"' + (ex ? ' ' + ex : '') + '/>'; }
function LN(x1, y1, x2, y2, ex) { return '<line x1="' + n2(x1) + '" y1="' + n2(y1) + '" x2="' + n2(x2) + '" y2="' + n2(y2) + '"' + (ex ? ' ' + ex : '') + '/>'; }
var DASH = 'stroke-dasharray="4 3"';

function sym(type, w, d, c) {
  var x = -w / 2, y = -d / 2, m = Math.min(w, d), s = '', i;
  switch (type) {
    case 'bed': {
      s += RC(x, y, w, d, '#fbf8f2', 30);
      s += RC(x, y, w, Math.min(90, d * 0.05), shade(c, .62), 20);
      var py = y + 150, ph = Math.min(360, d * 0.18);
      if (w >= 1300) { var pw = (w - 240) / 2; s += RC(x + 80, py, pw, ph, '#fff', 70) + RC(x + 160 + pw, py, pw, ph, '#fff', 70); }
      else s += RC(x + 80, py, w - 160, ph, '#fff', 70);
      var top = py + ph + 110, bot = y + d - 15;
      s += RC(x + 15, top, w - 30, bot - top, c, 40);
      s += LN(x + 15, top + 300, x + w - 15, top + 300, DASH);
      var t = Math.min(420, w * 0.3), xr = x + w - 15;
      s += '<polygon points="' + (xr - t) + ',' + top + ' ' + xr + ',' + top + ' ' + xr + ',' + (top + t) + '" fill="' + shade(c, 1.12) + '"/>';
      break;
    }
    case 'sofa': case 'armchair': {
      var b = d * 0.24, a = Math.min(200, w * 0.13), n = type === 'armchair' ? 1 : (w > 2200 ? 3 : 2), cw = (w - 2 * a) / n, dk = shade(c, .85);
      s += RC(x, y, w, d, dk, 60);
      for (i = 0; i < n; i++) s += RC(x + a + i * cw, y + b, cw, d - b - 40, c, 40);
      s += RC(x, y, w, b, dk, 50) + RC(x, y, a, d, dk, 50) + RC(x + w - a, y, a, d, dk, 50);
      break;
    }
    case 'cornersofa': {
      var k = Math.min(950, d * 0.56, w * 0.4), bb = 220, dk2 = shade(c, .85), cw2 = (w - bb - 200) / 2;
      s += '<path d="M' + x + ' ' + y + 'H' + (x + w) + 'V' + (y + k) + 'H' + (x + k) + 'V' + (y + d) + 'H' + x + 'Z" fill="' + dk2 + '"/>';
      s += RC(x + bb, y + bb, cw2, k - bb - 30, c, 40) + RC(x + bb + cw2, y + bb, cw2, k - bb - 30, c, 40) + RC(x + bb, y + k, k - bb - 30, d - k - 200, c, 40);
      s += RC(x, y, w, bb, dk2, 50) + RC(x, y, bb, d, dk2, 50) + RC(x + w - 200, y, 200, k, dk2, 50) + RC(x, y + d - 200, k, 200, dk2, 50);
      break;
    }
    case 'nightstand':
      s += RC(x, y, w, d, c, 30) + CI(0, 0, m * .24, '#fff6dd') + CI(0, 0, m * .08, shade(c, .8)); break;
    case 'wardrobe':
      s += RC(x, y, w, d, c) + LN(x + 50, 0, x + w - 50, 0);
      for (var hx = x + 160; hx < x + w - 100; hx += 180) s += LN(hx - 45, -d * .28, hx + 45, d * .28, 'opacity=".6"');
      break;
    case 'cabinet': case 'shoecab':
      s += RC(x, y, w, d, c) + LN(x, y + d, x + w, y, ''); break;
    case 'dresser':
      s += EL(0, d / 2 + 180, 160, 140, shade(c, .9)) + RC(x, y, w, d, c, 20) + RC(x + w * .2, y, w * .6, 55, '#dfe9ee'); break;
    case 'desk':
      s += RC(x, y, w, d, c, 20) + RC(-w * .18, y + 50, w * .36, 45, '#555') + RC(-w * .14, y + d * .45, w * .28, d * .28, '#f4f4f4', 10); break;
    case 'chair':
      s += RC(x + 25, y + d * .16, w - 50, d * .84 - 10, c, 60) + RC(x, y, w, d * .2, shade(c, .78), 40); break;
    case 'bookshelf':
      s += RC(x, y, w, d, c);
      for (var bx = x + 400; bx < x + w - 50; bx += 400) s += LN(bx, y, bx, y + d);
      break;
    case 'baycushion': {
      var ph2 = Math.min(300, d * .2);
      s += RC(x, y, w, d, c, 60) + RC(x + 60, y + 80, w - 120, ph2, '#fff', 60) + RC(x + 60, y + d - 80 - ph2, w - 120, ph2, '#fff', 60); break;
    }
    case 'coffeetable':
      s += RC(x, y, w, d, c, 80) + RC(x + 60, y + 60, w - 120, d - 120, shade(c, 1.06), 50); break;
    case 'tvstand':
      s += RC(x, y, w, d, c) + RC(x + w * .15, y + 30, w * .7, 55, '#3a3a3a'); break;
    case 'rug':
      s += RC(x, y, w, d, c, 40, 'fill-opacity=".6"') + RC(x + 90, y + 90, w - 180, d - 180, 'none', 30, 'stroke-dasharray="3 3" opacity=".6"'); break;
    case 'plant':
      s += CI(0, 0, m / 2, c, 'fill-opacity=".85"');
      for (i = 0; i < 8; i++) s += EL(0, -m * .27, m * .1, m * .21, shade(c, .8), 'transform="rotate(' + (i * 45) + ')"');
      s += CI(0, 0, m * .1, '#8a6a4a'); break;
    case 'table':
      s += RC(x, y, w, d, c, 30) + RC(x + 50, y + 50, w - 100, d - 100, 'none', 20, 'opacity=".4"'); break;
    case 'roundtable':
      s += EL(0, 0, w / 2, d / 2, c) + EL(0, 0, w / 2 - 50, d / 2 - 50, 'none', 'opacity=".4"'); break;
    case 'counter':
      s += RC(x, y, w, d, c) + LN(x, y + d - 40, x + w, y + d - 40, DASH); break;
    case 'stove': {
      s += RC(x, y, w, d, '#2f2f2f', 20);
      var rr = m * .26, pts = (w / d > 1.4) ? [[-w / 4, 0], [w / 4, 0]] : [[-w / 4, -d / 4], [w / 4, -d / 4], [-w / 4, d / 4], [w / 4, d / 4]];
      pts.forEach(function (p) { s += CI(p[0], p[1], rr, 'none', 'stroke="#bbb"') + CI(p[0], p[1], rr * .45, '#666'); });
      break;
    }
    case 'ksink':
      s += RC(x, y, w, d, c, 20) + RC(x + w * .06, y + d * .18, w * .42, d * .66, '#fff', 50) + RC(x + w * .52, y + d * .18, w * .42, d * .66, '#fff', 50) + CI(0, y + d * .09, 22, '#999'); break;
    case 'fridge':
      s += RC(x, y, w, d, c, 30) + LN(x, y + d * .14, x + w, y + d * .14) + LN(0, y + d * .14, 0, y + d) + RC(-70, y + d * .5, 40, d * .25, '#aab') + RC(30, y + d * .5, 40, d * .25, '#aab'); break;
    case 'toilet':
      s += RC(x + w * .04, y, w * .92, d * .27, c, 30) + EL(0, y + d * .27 + d * .36, w * .47, d * .36, c) + EL(0, y + d * .27 + d * .4, w * .3, d * .24, '#eef4f7'); break;
    case 'vanity':
      s += RC(x, y, w, d, c, 20) + EL(0, y + d * .57, Math.min(w * .32, 260), d * .28, '#fff') + CI(0, y + d * .17, 26, '#999'); break;
    case 'shower':
      s += RC(x, y, w, d, c) + LN(x, y, x + w, y + d, DASH) + LN(x + w, y, x, y + d, DASH) + CI(0, 0, 45, '#fff'); break;
    case 'bathtub':
      s += RC(x, y, w, d, c, 40) + RC(x + 80, y + 80, w - 160, d - 160, '#fff', m * .33) + CI(x + w - 260, 0, 35, '#ccc'); break;
    case 'washer': case 'dryer':
      s += RC(x, y, w, d, c, 30) + RC(x, y, w, d * .14, shade(c, .9)) + CI(0, d * .06, m * .34, '#fff') + CI(0, d * .06, m * .24, type === 'washer' ? '#cfdde4' : '#e9dccb'); break;
    case 'crib':
      s += RC(x, y, w, d, c, 20) + RC(x + 45, y + 45, w - 90, d - 90, '#fff', 20);
      for (var cx = x + 90; cx < x + w - 60; cx += 90) s += LN(cx, y + 45, cx, y + 90, 'opacity=".5"') + LN(cx, y + d - 90, cx, y + d - 45, 'opacity=".5"');
      break;
    case 'beanbag':
      s += EL(0, 0, w / 2, d / 2, c) + EL(-w * .04, -d * .06, w * .3, d * .28, shade(c, 1.12), 'opacity=".9"'); break;
    case 'sidetable':
      s += EL(0, 0, w / 2, d / 2, c) + EL(0, 0, w * .12, d * .12, 'none', 'opacity=".5"'); break;
    case 'floorlamp':
      s += CI(0, 0, m * .5, '#fff6dd', 'opacity=".85"') + CI(0, 0, m * .32, 'none', DASH) + CI(0, 0, m * .07, c); break;
    case 'island':
      s += RC(x, y, w, d, c) + LN(x, y + d - 250, x + w, y + d - 250, DASH); break;
    case 'barstool':
      s += CI(0, 0, m / 2, c) + CI(0, 0, m * .3, shade(c, 1.15)); break;
    case 'waterheater':
      s += RC(x, y, w, d, c, d / 2, DASH) + LN(x + w * .2, 0, x + w * .8, 0, DASH); break;
    case 'tv':
      s += RC(x, y, w, d, c, 10) + RC(x + w * .3, y + d, w * .4, Math.min(40, d), '#666'); break;
    case 'aircon':
      s += RC(x, y, w, d, c, 30) + LN(x + 40, y + d * .72, x + w - 40, y + d * .72) + LN(x + 40, y + d * .86, x + w - 40, y + d * .86); break;
    case 'acwall':
      s += RC(x, y, w, d, c, 30, DASH);
      [.25, .5, .75].forEach(function (f) { s += LN(x + w * f, y + d, x + w * f, y + d + 200, DASH + ' opacity=".6"'); });
      break;
    case 'dishwasher':
      s += RC(x, y, w, d, c, 15) + LN(x, y + d - 70, x + w, y + d - 70) + RC(x + w * .3, y + d - 45, w * .4, 25, '#888'); break;
    case 'ovencol':
      s += RC(x, y, w, d, c) + LN(x, y, x + w, y + d) + LN(x + w, y, x, y + d); break;
    case 'purifier':
      s += RC(x, y, w, d, c, 60) + RC(x + 45, y + 45, w - 90, d - 90, 'none', 40, DASH); break;
    case 'officechair':
      for (i = 0; i < 5; i++) { var an = (i * 72 + 36) * Math.PI / 180; s += LN(0, 0, Math.cos(an) * m * .48, Math.sin(an) * m * .48, 'stroke="#555" stroke-width="2"'); }
      s += RC(x + w * .12, y + d * .22, w * .76, d * .66, c, 80) + RC(x + w * .15, y + d * .04, w * .7, d * .16, shade(c, .78), 40)
        + RC(x + w * .02, y + d * .3, w * .1, d * .45, shade(c, .7), 30) + RC(x + w * .88, y + d * .3, w * .1, d * .45, shade(c, .7), 30);
      break;
    case 'piano': {
      var ky = y + d * .55, kx = x + 90, kw = w - 180;
      s += RC(x, y, w, d * .55, c, 10) + RC(x + 40, ky, w - 80, d * .4, shade(c, 1.4), 10) + RC(kx, ky, kw, d * .2, '#faf8f3');
      for (i = 1; i <= 25; i++) s += LN(kx + kw * i / 26, ky, kx + kw * i / 26, ky + d * .2);
      break;
    }
    case 'treadmill':
      s += RC(x, y, w, d, c, 50) + RC(x + 90, y + 320, w - 180, d - 400, '#1c1c1e', 25) + RC(x, y, w, 230, shade(c, 1.4), 40); break;
    default:
      s += RC(x, y, w, d, c);
  }
  return s;
}
var LABEL_SKIP = { plant: 1, floorlamp: 1, sidetable: 1, barstool: 1, beanbag: 1 };

/* ===================== SVG iskeleti ===================== */
var svg, gGrid, gRooms, gFurn, gWalls, gOpen, gLabels, gDims, gMeasure, gSel, mainEl;
function patWood(id, bg, ln) {
  return '<pattern id="' + id + '" width="1800" height="360" patternUnits="userSpaceOnUse"><rect width="1800" height="360" fill="' + bg + '"/>'
    + '<path d="M0 5H1800M0 185H1800" stroke="' + ln + '" stroke-width="10" fill="none"/>'
    + '<path d="M1200 0V180M600 180V360" stroke="' + ln + '" stroke-width="10" fill="none"/>'
    + '<path d="M60 90Q450 60 900 92T1740 88" stroke="' + ln + '" stroke-width="5" fill="none" opacity=".45"/>'
    + '<path d="M40 270Q400 240 800 272T1700 268" stroke="' + ln + '" stroke-width="5" fill="none" opacity=".45"/></pattern>';
}
function patTile(id, sz, bg, ln) {
  return '<pattern id="' + id + '" width="' + sz + '" height="' + sz + '" patternUnits="userSpaceOnUse"><rect width="' + sz + '" height="' + sz + '" fill="' + bg + '"/>'
    + '<path d="M0 0V' + sz + 'M0 0H' + sz + '" stroke="' + ln + '" stroke-width="10" fill="none"/></pattern>';
}
function buildDefs() {
  var s = '';
  s += patWood('m-wood', '#dcc09a', '#bf9d70') + patWood('m-walnut', '#a57c56', '#80593a');
  s += patTile('m-tile800', 800, '#ece7de', '#d3cabb') + patTile('m-tile600', 600, '#e2e6e3', '#c4cbc6') + patTile('m-antislip', 300, '#d6dbd7', '#b3bab4');
  s += '<pattern id="m-marble" width="1200" height="1200" patternUnits="userSpaceOnUse"><rect width="1200" height="1200" fill="#f3f0ea"/>'
    + '<path d="M0 0V1200M0 0H1200" stroke="#dcd5c8" stroke-width="10" fill="none"/>'
    + '<path d="M0 300C300 250 450 520 760 430S1100 640 1200 600" stroke="#d6cfc2" stroke-width="12" fill="none"/>'
    + '<path d="M300 1200C380 1000 560 960 640 780" stroke="#d6cfc2" stroke-width="12" fill="none"/></pattern>';
  s += '<pattern id="m-terrazzo" width="500" height="500" patternUnits="userSpaceOnUse"><rect width="500" height="500" fill="#e8e1d5"/>'
    + '<circle cx="60" cy="80" r="22" fill="#b9a58c"/><circle cx="310" cy="140" r="16" fill="#8fa3a0"/><circle cx="190" cy="330" r="26" fill="#c9b7a2"/>'
    + '<circle cx="420" cy="400" r="18" fill="#a88f76"/><circle cx="90" cy="440" r="12" fill="#8fa3a0"/><circle cx="440" cy="40" r="10" fill="#b9a58c"/></pattern>';
  s += '<pattern id="m-carpet" width="120" height="120" patternUnits="userSpaceOnUse"><rect width="120" height="120" fill="#c9c3d3"/>'
    + '<circle cx="30" cy="30" r="8" fill="#bab3c6"/><circle cx="90" cy="90" r="8" fill="#bab3c6"/></pattern>';
  s += '<pattern id="grid" width="1000" height="1000" patternUnits="userSpaceOnUse">'
    + '<path d="M0 500H1000M500 0V1000" stroke="#e5dfd3" stroke-width="8" fill="none"/>'
    + '<path d="M0 0H1000M0 1000H1000M0 0V1000M1000 0V1000" stroke="#d8d0c1" stroke-width="14" fill="none"/></pattern>';
  return s;
}
function initSvg() {
  mainEl = $('#stage');
  svg = $('#plan');
  svg.innerHTML = '<defs>' + buildDefs() + '</defs><g id="gGrid"></g><g id="gRooms"></g><g id="gFurn"></g><g id="gWalls"></g><g id="gOpen"></g><g id="gLabels" class="noptr"></g><g id="gDims" class="noptr"></g><g id="gMeasure" class="noptr"></g><g id="gSel"></g>';
  gGrid = $('#gGrid'); gRooms = $('#gRooms'); gFurn = $('#gFurn'); gWalls = $('#gWalls'); gOpen = $('#gOpen');
  gLabels = $('#gLabels'); gDims = $('#gDims'); gMeasure = $('#gMeasure'); gSel = $('#gSel');
}

/* ===================== katman çizimleri ===================== */
function renderGrid() {
  gGrid.innerHTML = '<rect x="-20000" y="-20000" width="55000" height="55000" fill="' + (ui.layers.grid ? 'url(#grid)' : 'transparent') + '"/>';
}
function rectPts(r) { return r; }
function renderRooms() {
  var s = '';
  _ROOMS.forEach(function (r) {
    s += '<polygon class="room" data-room="' + esc(r.id) + '" points="' + r.poly.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" fill="url(#m-' + esc(roomMatKey(r.id)) + ')"/>';
  });
  var th = function (rc) { return RC(rc[0], rc[1], rc[2] - rc[0], rc[3] - rc[1], '#e2dacb', 0, 'stroke="#b9b0a0" stroke-width="1" class="noptr"'); };
  _DOORS.forEach(function (d) { s += th(d.rect); });
  _SLIDES.forEach(function (d) { s += th(d.rect); });
  gRooms.innerHTML = s;
}
function furnMarkup(f, forLib) {
  var s = '<g class="furn" data-id="' + esc(f.id) + '" transform="translate(' + f.cx + ' ' + f.cy + ') rotate(' + f.rot + ')" stroke="#3d3a34" stroke-width="1" stroke-linejoin="round">';
  s += sym(f.type, f.w, f.d, f.color);
  var m = Math.min(f.w, f.d);
  if (m >= 380 && !LABEL_SKIP[f.type]) {
    var fs = clamp(m * 0.2, 80, 170);
    s += '<text x="0" y="0" transform="rotate(' + (-f.rot) + ')" font-size="' + fs + '" fill="#4a443c" fill-opacity=".8" stroke="none" text-anchor="middle" dominant-baseline="central" class="noptr">' + esc(nm(f.name)) + '</text>';
  }
  return s + '</g>';
}
function renderFurn() {
  gFurn.innerHTML = state.furniture.map(function (f) { return furnMarkup(f); }).join('');
  gFurn.style.display = ui.layers.furn ? '' : 'none';
}
function renderWalls() {
  var s = '';
  _WALLS.forEach(function (w, i) {
    var t = w[4], fill, ex = '';
    if (isDemo(i)) { fill = 'rgba(198,91,58,.12)'; ex = ' stroke="#c65b3a" stroke-width="1.2" stroke-dasharray="5 3"'; }
    else if (t === 'b') fill = ui.layers.bearing ? '#b8412c' : '#26241f';
    else if (t === 'e') fill = '#8f897d';
    else if (t === 'low') { fill = '#e9e3d8'; ex = ' stroke="#8f897d" stroke-width="1"'; }
    else fill = '#a7a195';
    s += '<rect class="wall" data-wall="' + i + '" x="' + w[0] + '" y="' + w[1] + '" width="' + (w[2] - w[0]) + '" height="' + (w[3] - w[1]) + '" fill="' + fill + '"' + ex + '/>';
  });
  gWalls.innerHTML = s;
}
function renderOpenings() {
  var s = '';
  _WINS.forEach(function (w) {
    var x0 = w[0], y0 = w[1], x1 = w[2], y1 = w[3], W = x1 - x0, H = y1 - y0;
    s += RC(x0, y0, W, H, '#f7fbfd', 0, 'stroke="#4f7394" stroke-width="1"');
    if (W >= H) { s += LN(x0, y0 + H / 3, x1, y0 + H / 3, 'stroke="#4f7394"') + LN(x0, y0 + 2 * H / 3, x1, y0 + 2 * H / 3, 'stroke="#4f7394"'); }
    else { s += LN(x0 + W / 3, y0, x0 + W / 3, y1, 'stroke="#4f7394"') + LN(x0 + 2 * W / 3, y0, x0 + 2 * W / 3, y1, 'stroke="#4f7394"'); }
  });
  _DOORS.forEach(function (d) {
    var h = d.h, c = d.c, o = d.o, L = d.len, col = d.entry ? '#b5653a' : '#3d3a34', sw = d.entry ? 1.8 : 1;
    var p1 = [h[0] + o[0] * L, h[1] + o[1] * L];
    var pts = [h, p1, [p1[0] + c[0] * 40, p1[1] + c[1] * 40], [h[0] + c[0] * 40, h[1] + c[1] * 40]];
    s += '<polygon points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" fill="#fff" stroke="' + col + '" stroke-width="' + sw + '"/>';
    var pc = [h[0] + c[0] * L, h[1] + c[1] * L], cross = o[0] * c[1] - o[1] * c[0];
    s += '<path d="M' + p1[0] + ' ' + p1[1] + 'A' + L + ' ' + L + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + pc[0] + ' ' + pc[1] + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-dasharray="5 3" opacity=".7"/>';
  });
  _SLIDES.forEach(function (sl) {
    var r = sl.rect, cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2, ex = 'stroke="#3d3a34" stroke-width="1"';
    if (sl.v) {
      var L = r[3] - r[1], pl = L * .55;
      s += RC(cx - 45, r[1], 40, pl, '#fff', 0, ex) + RC(cx + 5, r[3] - pl, 40, pl, '#fff', 0, ex);
    } else {
      var L2 = r[2] - r[0], pl2 = L2 * .55;
      s += RC(r[0], cy - 45, pl2, 40, '#fff', 0, ex) + RC(r[2] - pl2, cy + 5, pl2, 40, '#fff', 0, ex);
    }
  });
  s += entryMarkup();
  gOpen.innerHTML = s;
}
function renderLabels() {
  var s = '';
  _ROOMS.forEach(function (r) {
    if (!r.at) return;
    var nmv = nm(roomName(r.id)), a = fmt(polyArea(r.poly), 2) + ' m²';
    var halo = 'stroke="#fbf9f4" stroke-width="45" paint-order="stroke" stroke-linejoin="round"';
    s += '<text x="' + r.at[0] + '" y="' + r.at[1] + '" font-size="250" font-weight="600" fill="#2b2824" text-anchor="middle" ' + halo + '>' + esc(nmv) + '</text>';
    s += '<text x="' + r.at[0] + '" y="' + (r.at[1] + 260) + '" font-size="175" fill="#7d7366" text-anchor="middle" ' + halo + '>' + a + '</text>';
  });
  gLabels.innerHTML = s;
  gLabels.style.display = ui.layers.rooms ? '' : 'none';
}

/* ===================== ölçü zincirleri, giriş işareti ===================== */
function renderDims() {
  var s = '', col = '#7d7160', D = (typeof DIMS !== 'undefined') ? DIMS : [];
  D.forEach(function (ch) {
    var horiz = ch.axis === 'x';
    function chain(lineAt, parts) {
      var pos = ch.from, marks = [pos];
      parts.forEach(function (p) { pos += p; marks.push(pos); });
      var o = '';
      var a = marks[0], b = marks[marks.length - 1];
      o += horiz ? LN(a, lineAt, b, lineAt, 'stroke="' + col + '"') : LN(lineAt, a, lineAt, b, 'stroke="' + col + '"');
      marks.forEach(function (m) {
        if (horiz) o += LN(m, lineAt - 170, m, lineAt + 170, 'stroke="' + col + '"') + LN(m - 80, lineAt + 80, m + 80, lineAt - 80, 'stroke="' + col + '" stroke-width="2"');
        else o += LN(lineAt - 170, m, lineAt + 170, m, 'stroke="' + col + '"') + LN(lineAt - 80, m + 80, lineAt + 80, m - 80, 'stroke="' + col + '" stroke-width="2"');
      });
      parts.forEach(function (p, i) {
        var mid = (marks[i] + marks[i + 1]) / 2, fs = p < 400 ? 140 : 200;
        if (horiz) o += '<text x="' + mid + '" y="' + (lineAt - 70) + '" font-size="' + fs + '" fill="' + col + '" text-anchor="middle">' + p + '</text>';
        else o += '<text x="0" y="0" transform="translate(' + (lineAt - 70) + ' ' + mid + ') rotate(-90)" font-size="' + fs + '" fill="' + col + '" text-anchor="middle">' + p + '</text>';
      });
      return o;
    }
    s += chain(ch.line, ch.segs) + chain(ch.tline, [ch.total]);
  });
  gDims.innerHTML = s;
  gDims.style.display = ui.layers.dims ? '' : 'none';
}
function entryMarkup() {
  if (typeof ENTRY === 'undefined' || !ENTRY) return '';
  var e = ENTRY, col = '#b5653a', dx = e.x2 - e.x1, dir = dx >= 0 ? 1 : -1, h = 150;
  var s = LN(e.x1, e.y, e.x2, e.y, 'stroke="' + col + '" stroke-width="2"');
  s += LN(e.x2, e.y, e.x2 - dir * h, e.y - h * .55, 'stroke="' + col + '" stroke-width="2"') + LN(e.x2, e.y, e.x2 - dir * h, e.y + h * .55, 'stroke="' + col + '" stroke-width="2"');
  s += '<text x="' + e.tx + '" y="' + e.ty + '" font-size="200" fill="' + col + '" text-anchor="middle">' + esc(nm(e.text || 'Giriş')) + '</text>';
  return s;
}

/* ===================== ölçü aracı çizimi ===================== */
function measureLine(a, b, color) {
  var px = 1 / view.s, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 1) return '';
  var ux = dx / len, uy = dy / len, nx = -uy, ny = ux, t = 5 * px;
  var s = LN(a.x, a.y, b.x, b.y, 'stroke="' + color + '" stroke-width="1.5"');
  s += LN(a.x - nx * t, a.y - ny * t, a.x + nx * t, a.y + ny * t, 'stroke="' + color + '" stroke-width="1.5"');
  s += LN(b.x - nx * t, b.y - ny * t, b.x + nx * t, b.y + ny * t, 'stroke="' + color + '" stroke-width="1.5"');
  var ang = Math.atan2(dy, dx) * 180 / Math.PI;
  if (ang > 90 || ang < -90) ang += 180;
  var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, rad = ang * Math.PI / 180;
  var ox = Math.sin(rad) * 5 * px, oy = -Math.cos(rad) * 5 * px;
  s += '<text x="0" y="0" transform="translate(' + (mx + ox) + ' ' + (my + oy) + ') rotate(' + ang + ')" font-size="' + (12 * px) + '" font-weight="600" fill="' + color + '" text-anchor="middle" stroke="#fff" stroke-width="' + (3.5 * px) + '" paint-order="stroke" stroke-linejoin="round">' + Math.round(len) + ' mm</text>';
  return s;
}
function renderMeasure() {
  var s = '';
  state.measures.forEach(function (m) { s += measureLine(m.a, m.b, '#b5653a'); });
  if (ui.mpend) {
    s += CI(ui.mpend.x, ui.mpend.y, 3 / view.s, '#2f5d62', 'stroke="none"');
    if (ui.mcur) s += measureLine(ui.mpend, ui.mcur, '#2f5d62');
  }
  gMeasure.innerHTML = s;
}

/* ===================== seçim katmanı ===================== */
function renderSel() {
  var s = '', px = 1 / view.s, T = IS_TOUCH ? 1.7 : 1, sel = ui.sel;
  if (sel && sel.kind === 'furn') {
    var f = getF(sel.id);
    if (f) {
      var pad = 5 * px, w = f.w, d = f.d, hb = halfBox(f);
      var hy = -d / 2 - (IS_TOUCH ? 40 : 26) * px, sz = 10 * px * T;
      s += '<g transform="translate(' + f.cx + ' ' + f.cy + ') rotate(' + f.rot + ')" fill="none">';
      s += '<rect class="noptr" x="' + (-w / 2 - pad) + '" y="' + (-d / 2 - pad) + '" width="' + (w + 2 * pad) + '" height="' + (d + 2 * pad) + '" stroke="#b5653a" stroke-width="1.5" stroke-dasharray="5 3"/>';
      s += LN(0, -d / 2 - pad, 0, hy, 'stroke="#b5653a" class="noptr"');
      s += '<circle class="noptr" cx="0" cy="' + hy + '" r="' + (6 * px * T) + '" fill="#fff" stroke="#b5653a" stroke-width="1.5"/>';
      s += '<circle data-handle="rot" cx="0" cy="' + hy + '" r="' + ((IS_TOUCH ? 24 : 11) * px) + '" fill="transparent" stroke="none"><title>' + esc(tr('Döndürmek için sürükle (Shift: serbest açı)', 'Drag to rotate (Shift for free angle)')) + '</title></circle>';
      var sx = w / 2 + pad, sy = d / 2 + pad;
      s += '<rect class="noptr" x="' + sx + '" y="' + sy + '" width="' + sz + '" height="' + sz + '" fill="#b5653a" stroke="none"/>';
      s += '<circle data-handle="size" cx="' + (sx + sz / 2) + '" cy="' + (sy + sz / 2) + '" r="' + ((IS_TOUCH ? 24 : 11) * px) + '" fill="transparent" stroke="none"><title>' + esc(tr('Boyutlandırmak için sürükle', 'Drag to resize')) + '</title></circle>';
      s += '</g>';
      s += '<text class="noptr" x="' + f.cx + '" y="' + (f.cy + hb.hh + 24 * px) + '" font-size="' + (12 * px) + '" font-weight="600" fill="#b5653a" text-anchor="middle" stroke="#fff" stroke-width="' + (3 * px) + '" paint-order="stroke" stroke-linejoin="round">' + Math.round(w) + ' × ' + Math.round(d) + '</text>';
    }
  } else if (sel && sel.kind === 'room') {
    var r = roomById(sel.id);
    if (r) s += '<polygon class="noptr" points="' + r.poly.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '" fill="rgba(181,101,58,.08)" stroke="#b5653a" stroke-width="2"/>';
  }
  gSel.innerHTML = s;
}

/* ===================== görünüm / zoom ===================== */
function viewSize() { return { W: Math.max(1, svg.clientWidth || mainEl.clientWidth), H: Math.max(1, svg.clientHeight || mainEl.clientHeight) }; }
function applyView() {
  var v = viewSize();
  svg.setAttribute('viewBox', view.x0 + ' ' + view.y0 + ' ' + (v.W / view.s) + ' ' + (v.H / view.s));
  var ratio = Math.round(1 / (view.s * PX_MM));
  $('#scaleTxt').textContent = '1:' + ratio;
  var nice = [100, 200, 500, 1000, 2000, 5000], n = 5000;
  for (var i = 0; i < nice.length; i++) if (nice[i] * view.s >= 60) { n = nice[i]; break; }
  $('#sbTxt').textContent = n >= 1000 ? (n / 1000) + ' m' : n + ' mm';
  $('#sbBar').style.width = (n * view.s) + 'px';
  renderSel(); renderMeasure();
}
function fitView() {
  var v = viewSize(), b = _BOUNDS;
  view.s = Math.min(v.W / b.w, v.H / b.h);
  view.x0 = b.x + b.w / 2 - v.W / view.s / 2;
  view.y0 = b.y + b.h / 2 - v.H / view.s / 2;
  applyView();
}
function toMM(cx, cy) {
  var r = svg.getBoundingClientRect();
  return { x: view.x0 + (cx - r.left) / view.s, y: view.y0 + (cy - r.top) / view.s };
}
function zoomTo(ns, cx, cy) {
  ns = clamp(ns, 0.012, 2);
  var r = svg.getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
  var wx = view.x0 + px / view.s, wy = view.y0 + py / view.s;
  view.s = ns; view.x0 = wx - px / ns; view.y0 = wy - py / ns;
  applyView();
}
function zoomCenter(k) { var r = svg.getBoundingClientRect(); zoomTo(view.s * k, r.left + r.width / 2, r.top + r.height / 2); }
function setRatio(n) { var r = svg.getBoundingClientRect(); zoomTo(1 / (n * PX_MM), r.left + r.width / 2, r.top + r.height / 2); }

/* ===================== tümünü çiz ===================== */
function renderAll() {
  validateSel();
  renderGrid(); renderRooms(); renderFurn(); renderWalls(); renderOpenings(); renderLabels(); renderDims(); renderMeasure(); renderSel();
  renderPanel(); renderHeader(); renderFab();
  if (ui.is3d) sync3d();
}
function sync3d() { try { if (window.View3D && window.View3D.sync) window.View3D.sync(); } catch (e) { console.error(e); } }
function renderHeader() {
  $('#brandSub').textContent = tr('Net kullanım alanı ≈ ' + fmt(netArea(), 2) + ' m² · Birim: mm · Özgün plan ölçeği 1:60', 'Net floor area ≈ ' + fmt(netArea(), 2) + ' m² · Units: mm · Original scale 1:60');
  var u = $('#undo'), r = $('#redo');
  u.disabled = !undoStack.length; u.style.opacity = undoStack.length ? '' : '.4';
  r.disabled = !redoStack.length; r.style.opacity = redoStack.length ? '' : '.4';
}
function renderLayers() {
  $$('[data-layer]').forEach(function (b) { b.classList.toggle('on', !!ui.layers[b.dataset.layer]); });
}

/* ===================== bildirim ===================== */
var toastTimer = null;
function toast(msg) {
  var t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
}

/* ===================== seçim ===================== */
function select(kind, id) {
  if (kind && typeof kind === 'object') { id = kind.id; kind = kind.kind; }
  ui.sel = kind ? { kind: kind, id: id } : null;
  renderSel(); renderPanel(); renderFab();
  if (ui.is3d) { try { window.View3D && window.View3D.onSelect && window.View3D.onSelect(ui.sel); } catch (e) { } }
}
function setTool(t) {
  ui.tool = t; ui.mpend = null; ui.mcur = null;
  $$('#tools [data-tool]').forEach(function (b) { b.classList.toggle('on', b.dataset.tool === t); });
  svg.classList.remove('tool-select', 'tool-measure', 'tool-demolish'); svg.classList.add('tool-' + t);
  var mh = $('#modehint');
  if (t === 'measure') mh.textContent = IS_TOUCH ? tr('Basılı tutup çizgi sürükleyin veya iki noktaya dokunun · duvara yaklaşınca yapışır · çıkmak için «Seç»', 'Hold and drag a line, or tap two points · snaps to walls · tap "Select" to exit')
    : tr('İki noktaya tıklayın (veya sürükleyin) · duvara yaklaşınca yapışır · Shift: yatay/dikey kilit · Esc: iptal', 'Click two points (or drag) to measure · snaps to walls · Shift locks horizontal/vertical · Esc cancels');
  else if (t === 'demolish') mh.textContent = tr('Gri (taşıyıcı olmayan) duvara tıklayıp yıkım işaretleyin, tekrar tıklayınca geri gelir · siyah taşıyıcı duvarlar yıkılamaz', 'Click a grey non-bearing wall to remove it, click again to restore · black bearing walls cannot be removed');
  else mh.textContent = '';
  mh.classList.toggle('show', t !== 'select');
  renderMeasure();
}

/* ===================== 2D işaretçi etkileşimi ===================== */
var act = null, pointers = {}, pinch = null;
function thr() { return IS_TOUCH ? 9 : 4; }
function pcount() { return Object.keys(pointers).length; }
function hoverInfo(e) {
  var p = toMM(e.clientX, e.clientY);
  $('#cx').textContent = Math.round(p.x) + ' mm'; $('#cy').textContent = Math.round(p.y) + ' mm';
  var hr = $('#hoverRoom');
  if (!act) {
    var r = roomAt(p.x, p.y);
    hr.innerHTML = r ? '<b>' + esc(roomName(r.id)) + '</b> ' + fmt(polyArea(r.poly), 2) + ' m²' : '';
  } else hr.innerHTML = '';
}
function startPinch() {
  var ids = Object.keys(pointers); if (ids.length < 2) return;
  var a = pointers[ids[0]], b = pointers[ids[1]];
  var r = svg.getBoundingClientRect(), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: view.s, wx: view.x0 + (mx - r.left) / view.s, wy: view.y0 + (my - r.top) / view.s };
  cancelAct();
}
function cancelAct() {
  if (act) { if (act.type === 'move' || act.type === 'rot' || act.type === 'size') { if (act.moved) commit(); else pendingSnap = null; } }
  act = null; ui.mpend = null; ui.mcur = null; svg.classList.remove('panning'); renderMeasure();
}
function onDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  closeDrawers(); closeMenu();
  if (e.pointerType === 'touch') {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pcount() === 2) { startPinch(); try { svg.setPointerCapture(e.pointerId); } catch (x) { } return; }
    if (pcount() > 2) return;
  }
  try { svg.setPointerCapture(e.pointerId); } catch (x) { }
  var P = toMM(e.clientX, e.clientY), tg = e.target;
  if (ui.tool === 'measure') {
    var pt = snapPoint(P.x, P.y, ui.mpend, e.shiftKey);
    if (ui.mpend) {
      var a = ui.mpend;
      if (Math.hypot(pt.x - a.x, pt.y - a.y) > 20) mutate(function () { state.measures.push({ a: { x: a.x, y: a.y }, b: { x: pt.x, y: pt.y } }); });
      ui.mpend = null; ui.mcur = null; act = { type: 'none' }; renderMeasure();
    } else {
      ui.mpend = pt; ui.mcur = pt; act = { type: 'measure', sx: e.clientX, sy: e.clientY, moved: false, pid: e.pointerId };
      renderMeasure();
    }
    return;
  }
  var h = tg.closest && tg.closest('[data-handle]');
  if (h && ui.sel && ui.sel.kind === 'furn') {
    var f = getF(ui.sel.id);
    if (f) {
      snap();
      act = { type: h.dataset.handle === 'rot' ? 'rot' : 'size', id: f.id, moved: false, sx: e.clientX, sy: e.clientY, w0: f.w, d0: f.d, cx0: f.cx, cy0: f.cy, rot0: f.rot };
      return;
    }
  }
  if (ui.tool === 'demolish') {
    var wl = tg.closest && tg.closest('.wall');
    if (wl) { toggleDemolish(+wl.dataset.wall); act = { type: 'none' }; return; }
  }
  if (ui.tool === 'select') {
    var fg = tg.closest && tg.closest('g.furn');
    if (fg) {
      var ff = getF(fg.dataset.id);
      if (ff) {
        if (!ui.sel || ui.sel.kind !== 'furn' || ui.sel.id !== ff.id) select('furn', ff.id);
        snap();
        act = { type: 'move', id: ff.id, moved: false, sx: e.clientX, sy: e.clientY, ox: P.x - ff.cx, oy: P.y - ff.cy };
        return;
      }
    }
  }
  var rm = tg.closest && tg.closest('[data-room]');
  act = { type: 'pan', sx: e.clientX, sy: e.clientY, x0: view.x0, y0: view.y0, moved: false, room: rm ? rm.dataset.room : null };
}
function onMove(e) {
  if (e.pointerType === 'touch' && pointers[e.pointerId]) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pinch && pcount() >= 2) {
      var ids = Object.keys(pointers), a = pointers[ids[0]], b = pointers[ids[1]], r = svg.getBoundingClientRect();
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ns = clamp(pinch.s0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0), 0.012, 2);
      view.s = ns; view.x0 = pinch.wx - (mx - r.left) / ns; view.y0 = pinch.wy - (my - r.top) / ns;
      applyView(); return;
    }
  }
  hoverInfo(e);
  if (!act) return;
  var P = toMM(e.clientX, e.clientY);
  if (act.type === 'measure') {
    if (!act.moved && Math.hypot(e.clientX - act.sx, e.clientY - act.sy) > thr()) act.moved = true;
    ui.mcur = snapPoint(P.x, P.y, ui.mpend, e.shiftKey); renderMeasure(); return;
  }
  if (act.type === 'none') { if (ui.tool === 'measure' && ui.mpend) { ui.mcur = snapPoint(P.x, P.y, ui.mpend, e.shiftKey); renderMeasure(); } return; }
  if (!act.moved && Math.hypot(e.clientX - act.sx, e.clientY - act.sy) <= thr()) return;
  act.moved = true;
  if (act.type === 'pan') {
    svg.classList.add('panning');
    view.x0 = act.x0 - (e.clientX - act.sx) / view.s; view.y0 = act.y0 - (e.clientY - act.sy) / view.s;
    applyView(); return;
  }
  var f = getF(act.id); if (!f) return;
  if (act.type === 'move') {
    var q = snapMove(f, P.x - act.ox, P.y - act.oy); f.cx = q.x; f.cy = q.y;
  } else if (act.type === 'rot') {
    var ang = Math.atan2(P.y - f.cy, P.x - f.cx) * 180 / Math.PI + 90;
    f.rot = e.shiftKey ? norm(ang) : norm(Math.round(ang / 15) * 15);
  } else if (act.type === 'size') {
    var rad = act.rot0 * Math.PI / 180, dx = P.x - act.cx0, dy = P.y - act.cy0;
    var lx = dx * Math.cos(rad) + dy * Math.sin(rad), ly = -dx * Math.sin(rad) + dy * Math.cos(rad);
    var nw = Math.max(100, Math.round((lx + act.w0 / 2) / 10) * 10), nd = Math.max(100, Math.round((ly + act.d0 / 2) / 10) * 10);
    var ncx = -act.w0 / 2 + nw / 2, ncy = -act.d0 / 2 + nd / 2;
    f.w = nw; f.d = nd;
    f.cx = Math.round(act.cx0 + ncx * Math.cos(rad) - ncy * Math.sin(rad)); f.cy = Math.round(act.cy0 + ncx * Math.sin(rad) + ncy * Math.cos(rad));
  }
  renderFurn(); renderSel();
  if (ui.is3d) sync3d();
}
function onUp(e) {
  if (e.pointerType === 'touch') {
    delete pointers[e.pointerId];
    if (pinch) { if (pcount() < 2) pinch = null; if (pcount() === 0) act = null; return; }
  }
  svg.classList.remove('panning');
  var a = act; act = null;
  if (!a) return;
  if (a.type === 'measure') {
    if (a.moved && ui.mpend) {
      var P = toMM(e.clientX, e.clientY), pt = snapPoint(P.x, P.y, ui.mpend, e.shiftKey), s0 = ui.mpend;
      if (Math.hypot(pt.x - s0.x, pt.y - s0.y) > 20) mutate(function () { state.measures.push({ a: { x: s0.x, y: s0.y }, b: { x: pt.x, y: pt.y } }); });
      ui.mpend = null; ui.mcur = null; renderMeasure();
    }
    return;
  }
  if (a.type === 'move' || a.type === 'rot' || a.type === 'size') {
    if (a.moved) commit(); else pendingSnap = null;
    return;
  }
  if (a.type === 'pan' && !a.moved && ui.tool === 'select') {
    if (a.room) select('room', a.room); else select(null);
  }
}
function toggleDemolish(i) {
  var w = _WALLS[i]; if (!w) return;
  if (w[4] === 'b') { toast(tr('Taşıyıcı duvar (siyah) yıkılamaz', 'Load-bearing walls (black) cannot be removed')); return; }
  if (w[4] === 'e') { toast(tr('Dış duvarlar binanın dış kabuğudur, yıkılması önerilmez', 'Exterior walls are part of the building envelope and should not be removed')); return; }
  var key = 'w' + i, was = state.demolished.indexOf(key) >= 0;
  mutate(function () {
    if (was) state.demolished.splice(state.demolished.indexOf(key), 1); else state.demolished.push(key);
  });
  if (was) toast(tr('Duvar geri getirildi', 'Wall restored'));
  else toast(tr(Math.round(Math.max(w[2] - w[0], w[3] - w[1])) + ' mm duvar yıkım için işaretlendi', 'Marked ' + Math.round(Math.max(w[2] - w[0], w[3] - w[1])) + ' mm of wall for removal'));
}
function initPointer() {
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', function (e) { if (e.pointerType === 'touch') delete pointers[e.pointerId]; if (pcount() < 2) pinch = null; cancelAct(); });
  svg.addEventListener('pointerleave', function () { if (!act) { $('#cx').textContent = '—'; $('#cy').textContent = '—'; $('#hoverRoom').innerHTML = ''; } });
  svg.addEventListener('contextmenu', function (e) { if (ui.tool === 'measure') { e.preventDefault(); ui.mpend = null; ui.mcur = null; act = null; renderMeasure(); } });
  svg.addEventListener('dblclick', function (e) {
    if (ui.tool !== 'select') return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var fg = el && el.closest && el.closest('g.furn'); if (!fg) return;
    var f = getF(fg.dataset.id); if (!f) return;
    mutate(function () { f.rot = norm(f.rot + 90); });
  });
  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var k = e.ctrlKey ? 0.01 : 0.0015;
    zoomTo(view.s * Math.exp(-e.deltaY * k), e.clientX, e.clientY);
  }, { passive: false });
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('pointerdown', function (e) { var m = $('#fileMenu'); if (m.open && !m.contains(e.target)) m.open = false; });
}
function closeMenu() { var m = $('#fileMenu'); if (m) m.open = false; }

/* ===================== mobilya ekleme / silme ===================== */
function addFurn(it, x, y) {
  var f = { id: newId(), type: it.type, name: it.name, cx: Math.round(x / 10) * 10, cy: Math.round(y / 10) * 10, w: it.w, d: it.d, rot: 0, color: it.color };
  pushOut(f);
  snap();
  if (it.type === 'rug') state.furniture.unshift(f); else state.furniture.push(f);
  ui.sel = { kind: 'furn', id: f.id };
  commit();
  toast(tr('«' + it.name + '» eklendi ' + it.w + '×' + it.d, 'Added "' + nm(it.name) + '" ' + it.w + '×' + it.d));
  return f;
}
function defaultAddPoint() {
  if (ui.sel && ui.sel.kind === 'room') { var r = roomById(ui.sel.id); if (r) { var b = polyBox(r.poly); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }; } }
  if (ui.is3d && window.View3D && window.View3D.centerGround) { try { var g = window.View3D.centerGround(); if (g) return g; } catch (e) { } }
  var v = viewSize(); return { x: view.x0 + v.W / view.s / 2, y: view.y0 + v.H / view.s / 2 };
}
function dupSel() {
  if (!ui.sel || ui.sel.kind !== 'furn') return;
  var f = getF(ui.sel.id); if (!f) return;
  snap();
  var c = JSON.parse(JSON.stringify(f)); c.id = newId(); c.cx += 200; c.cy += 200;
  state.furniture.push(c); ui.sel = { kind: 'furn', id: c.id }; commit();
}
function delSel() {
  if (!ui.sel || ui.sel.kind !== 'furn') return;
  var id = ui.sel.id;
  snap(); state.furniture = state.furniture.filter(function (f) { return f.id !== id; }); ui.sel = null; commit();
}
function rotSel(deg) {
  if (!ui.sel || ui.sel.kind !== 'furn') return;
  var f = getF(ui.sel.id); if (!f) return;
  mutate(function () { f.rot = norm(f.rot + deg); });
}
function clearAllFurn() {
  var n = state.furniture.length;
  if (!n) { toast(tr('Temizlenecek mobilya yok', 'There is no furniture to clear')); return; }
  var msg = tr(n + ' mobilya / cihazın tamamı kaldırılsın mı?\nDuvarlar, zemin malzemeleri ve ölçüler korunur. «Geri Al» ile geri getirebilirsiniz.',
    'Remove all ' + n + ' furniture / appliance items?\nWalls, flooring and measurements are kept. You can Undo this.');
  if (!confirm(msg)) return;
  mutate(function () { state.furniture = []; ui.sel = null; });
  toast(tr('Yerleşim temizlendi — geri almak için «Geri Al»', 'Layout cleared — Undo to restore'));
}
function reorderSel(top) {
  if (!ui.sel || ui.sel.kind !== 'furn') return;
  var f = getF(ui.sel.id); if (!f) return;
  mutate(function () { state.furniture = state.furniture.filter(function (x) { return x !== f; }); if (top) state.furniture.push(f); else state.furniture.unshift(f); });
}

/* ===================== sağ panel ===================== */
function statBox(label, val, unit) { return '<div><small>' + esc(label) + '</small><div class="big">' + val + (unit ? '<i>' + unit + '</i>' : '') + '</div></div>'; }
function matCostTable() {
  var order = [], acc = {};
  _ROOMS.forEach(function (r) {
    var k = roomMatKey(r.id);
    if (!acc[k]) { acc[k] = 0; order.push(k); }
    acc[k] += polyArea(r.poly);
  });
  return order.map(function (k) { var m = matOf(k); return { k: k, m: m, area: acc[k], cost: acc[k] * (m.price || 0) * 1.05 }; });
}
function demolishedMeters() {
  var t = 0;
  state.demolished.forEach(function (key) { var w = _WALLS[+key.slice(1)]; if (w) t += Math.max(w[2] - w[0], w[3] - w[1]); });
  return t / 1000;
}
function kbdRows(rows) { return '<div class="kbdg">' + rows.map(function (r) { return '<kbd>' + esc(r[0]) + '</kbd><span>' + esc(r[1]) + '</span>'; }).join('') + '</div>'; }
function renderOverview() {
  var s = '<section><h3>' + esc(tr('Oda Alanları', 'Room Areas')) + '<small>' + esc(tr('Zemini görmek / değiştirmek için tıkla', 'Click to view / change flooring')) + '</small></h3><table>';
  _ROOMS.forEach(function (r) {
    var m = matOf(roomMatKey(r.id));
    s += '<tr data-room="' + esc(r.id) + '"><td><span class="sw" style="background:' + esc(m.sw) + '"></span>' + esc(nm(roomName(r.id))) + (r.counted === false ? ' <em>*</em>' : '') + '</td><td class="r">' + fmt(polyArea(r.poly), 2) + ' m²</td></tr>';
  });
  s += '</table><div class="total"><span>' + esc(tr('Net kullanım alanı', 'Net floor area')) + '</span><b>' + fmt(netArea(), 2) + ' m²</b></div>';
  s += '<div class="note">' + esc(tr('* Cumbalar net alana dahil değildir; alanlar duvar iç net ölçülerinden hesaplanır', '* Bay windows are excluded; areas use net inner wall dimensions')) + '</div></section>';
  var rows = matCostTable(), tot = 0;
  s += '<section><h3>' + esc(tr('Zemin Malzemesi Tahmini', 'Flooring Estimate')) + '<small>' + esc(tr('%5 fire dahil', 'incl. 5% waste')) + '</small></h3><table>';
  rows.forEach(function (r) {
    tot += r.cost;
    s += '<tr><td><span class="sw" style="background:' + esc(r.m.sw) + '"></span>' + esc(nm(r.m.name)) + '</td><td class="r">' + fmt(r.area, 1) + ' m²</td><td class="r">' + money(r.cost) + '</td></tr>';
  });
  s += '</table><div class="total"><span>' + esc(tr('Zemin malzemesi toplamı', 'Flooring total')) + '</span><b>' + money(tot) + '</b></div></section>';
  s += '<section><h3>' + esc(tr('Plan İstatistikleri', 'Plan Stats')) + '</h3><div class="stats">'
    + statBox(tr('Mobilya sayısı', 'Furniture'), state.furniture.length, '')
    + statBox(tr('Yıkılan duvar', 'Walls removed'), fmt(demolishedMeters(), 1), ' m') + '</div>'
    + '<div class="acts"><button class="btn" data-act="clearMeasures">' + esc(tr('Ölçüleri temizle', 'Clear measures')) + ' (' + state.measures.length + ')</button>'
    + '<button class="btn danger" data-act="clearLayout">' + esc(tr('Yerleşimi temizle', 'Clear layout')) + '</button></div></section>';
  if (IS_TOUCH) {
    s += '<section><h3>' + esc(tr('Dokunmatik Kontroller', 'Touch Controls')) + '</h3>' + kbdRows([
      [tr('Tek parmak sürükle', '1-finger drag'), tr('Boşlukta görüntüyü kaydırır', 'Pan on empty space')],
      [tr('İki parmak', '2 fingers'), tr('Sıkıştırarak yakınlaştır, sürükleyerek kaydır', 'Pinch to zoom, drag to pan')],
      [tr('Kitaplık', 'Library'), tr('Dokun: ortaya yerleştirir; basılı tutup sağa sürükle: istenen yere', 'Tap to place at center, or hold and drag right to a spot')],
      [tr('Mobilyaya dokun', 'Tap item'), tr('Sürükleyerek taşı; üst nokta döndürür, sağ-alt kare boyutlandırır', 'Drag to move; top dot rotates, bottom-right square resizes')],
      [tr('Araç çubuğu', 'Toolbar'), tr('Seçince alttaki çubuktan döndür / kopyala / sil', 'Bottom bar can rotate / duplicate / delete')],
      [tr('Ölç', 'Measure'), tr('Basılı tutup çizgi sürükle veya iki noktaya dokun', 'Hold and drag a line, or tap two points')],
      [tr('3D Gezinti', '3D walk'), tr('Joystick ile yürü, ekranı sürükleyerek bak, kapıya dokunarak aç/kapat', 'Joystick moves, drag to look, tap doors to open')]
    ]) + '</section>';
  }
  s += '<section><h3>' + esc(tr('Klavye Kısayolları', 'Keyboard Shortcuts')) + '</h3>' + kbdRows([
    [tr('Sürükle', 'Drag'), tr('Soldaki mobilyayı plana sürükle', 'Drag furniture onto the plan')],
    ['V', tr('Seç / taşı', 'Select / move')],
    ['M', tr('Ölç (Shift: yatay/dikey)', 'Measure (Shift: horizontal/vertical)')],
    ['X', tr('Taşıyıcı olmayan duvarı yık (siyah = taşıyıcı)', 'Demolish non-bearing walls (black = bearing)')],
    ['R', tr('90° döndür (Shift: ters yön)', 'Rotate 90° (Shift reverses)')],
    [tr('Ok tuşları', 'Arrows'), tr('10 mm ince ayar (Shift: 100 mm)', 'Nudge 10mm (Shift 100mm)')],
    ['⌘/Ctrl D', tr('Kopyala', 'Duplicate')],
    ['Delete', tr('Sil', 'Delete')],
    ['⌘/Ctrl Z', tr('Geri al', 'Undo')],
    ['T', tr('2D / 3D geçiş', 'Toggle 2D / 3D')],
    ['F', tr('Pencereye sığdır', 'Fit to window')],
    ['Esc', tr('Seçimi kaldır', 'Deselect')]
  ]) + '</section>';
  return s;
}
function renderRoomPanel(r) {
  var b = polyBox(r.poly), per = polyPerim(r.poly), mk = roomMatKey(r.id), cur = matOf(mk), a = polyArea(r.poly);
  var s = '<section><h3>' + esc(tr('Oda', 'Room')) + '</h3><div class="form"><label class="full">' + esc(tr('Ad', 'Name')) + '<input id="rName" value="' + esc(nm(roomName(r.id))) + '"></label></div>';
  s += '<div class="stats" style="margin-top:8px">'
    + statBox(tr('Kullanım alanı', 'Floor area'), fmt(a, 2), ' m²') + statBox(tr('Çevre', 'Perimeter'), fmt(per, 1), ' m')
    + statBox(tr('Genişlik (açıklık)', 'Width'), Math.round(b.x1 - b.x0), ' mm') + statBox(tr('Derinlik', 'Depth'), Math.round(b.y1 - b.y0), ' mm') + '</div>';
  s += '<div class="note" style="font-size:12px">' + esc(tr('Duvar alanı (tavan 2,8 m, kapı/pencere düşülmeden) ≈ ', 'Wall area (2.8m ceiling, openings not deducted) ≈ ') + fmt(per * 2.8, 1) + ' m²') + '</div></section>';
  s += '<section><h3>' + esc(tr('Zemin malzemesi', 'Flooring')) + '</h3><div class="mats">';
  MATLIST.forEach(function (m) {
    s += '<button data-mat="' + esc(m.k) + '"' + (m.k === mk ? ' class="on"' : '') + '><span class="sw" style="background:' + esc(m.sw) + '"></span><span><b>' + esc(nm(m.name)) + '</b><small>₺' + fmt(m.price, 0) + '/m²</small></span></button>';
  });
  s += '</div><div class="total"><span>' + esc(tr('Malzeme tahmini maliyet', 'Estimated cost')) + '</span><b>' + money(a * (cur.price || 0) * 1.05) + '</b></div></section>';
  var inRoom = state.furniture.filter(function (f) { return f.cx > b.x0 && f.cx < b.x1 && f.cy > b.y0 && f.cy < b.y1; });
  s += '<section><h3>' + esc(tr('Odadaki mobilyalar', 'Furniture in room')) + '<small>' + esc(tr(inRoom.length + ' adet', inRoom.length + ' items')) + '</small></h3>';
  if (inRoom.length) {
    s += '<table>' + inRoom.map(function (f) { return '<tr data-fid="' + esc(f.id) + '"><td>' + esc(nm(f.name)) + '</td><td class="m">' + Math.round(f.w) + '×' + Math.round(f.d) + '</td></tr>'; }).join('') + '</table>';
  } else s += '<div class="muted12">' + esc(tr('Yok', 'None')) + '</div>';
  s += '<div class="acts"><button class="btn" data-act="deselect">' + esc(tr('← Genel bakışa dön', '← Back to overview')) + '</button></div></section>';
  return s;
}
function renderFurnPanel(f) {
  var s = '<section><h3>' + esc(tr('Mobilya Özellikleri', 'Furniture')) + '</h3><div class="form">'
    + '<label class="full">' + esc(tr('Ad', 'Name')) + '<input data-f="name" value="' + esc(nm(f.name)) + '"></label>'
    + '<label>' + esc(tr('Genişlik (mm)', 'Width (mm)')) + '<input type="number" data-f="w" min="50" step="10" value="' + Math.round(f.w) + '"></label>'
    + '<label>' + esc(tr('Derinlik (mm)', 'Depth (mm)')) + '<input type="number" data-f="d" min="50" step="10" value="' + Math.round(f.d) + '"></label>'
    + '<label>' + esc(tr('Merkez X (mm)', 'Center X (mm)')) + '<input type="number" data-f="cx" step="10" value="' + Math.round(f.cx) + '"></label>'
    + '<label>' + esc(tr('Merkez Y (mm)', 'Center Y (mm)')) + '<input type="number" data-f="cy" step="10" value="' + Math.round(f.cy) + '"></label>'
    + '<label>' + esc(tr('Döndürme (°)', 'Rotation (°)')) + '<input type="number" data-f="rot" step="15" value="' + Math.round(f.rot) + '"></label>'
    + '<label>' + esc(tr('Renk', 'Color')) + '<input type="color" data-f="color" value="' + esc(f.color) + '"></label></div>'
    + '<div class="muted12" style="margin:10px 0 0">' + esc(tr('Taban alanı ', 'Footprint ') + fmt(f.w * f.d / 1e6, 2) + ' m²') + '</div>'
    + '<div class="acts"><button class="btn" data-act="rot90">' + esc(tr('90° döndür', 'Rotate 90°')) + '</button><button class="btn" data-act="dup">' + esc(tr('Kopyala', 'Duplicate')) + '</button>'
    + '<button class="btn" data-act="front">' + esc(tr('En üste getir', 'Bring to front')) + '</button><button class="btn" data-act="back">' + esc(tr('En alta gönder', 'Send to back')) + '</button>'
    + '<button class="btn danger" data-act="del">' + esc(tr('Sil', 'Delete')) + '</button><button class="btn" data-act="deselect">' + esc(tr('← Geri', '← Back')) + '</button></div></section>';
  s += '<section class="muted12">' + esc(tr('Taşımak için mobilyayı sürükleyin; üstteki noktayı sürükleyerek döndürün; sağ alt köşedeki kareyi sürükleyerek boyutlandırın. «Duvara yapış» açıkken duvara yaklaşınca otomatik hizalanır.',
    'Drag to move; drag the top dot to rotate; drag the bottom-right square to resize. With "Wall snap" on, items snap flush to nearby walls.')) + '</section>';
  return s;
}
function renderPanel() {
  var p = $('#panel'), s;
  if (ui.sel && ui.sel.kind === 'furn' && getF(ui.sel.id)) s = renderFurnPanel(getF(ui.sel.id));
  else if (ui.sel && ui.sel.kind === 'room' && roomById(ui.sel.id)) s = renderRoomPanel(roomById(ui.sel.id));
  else s = renderOverview();
  var st = p.parentNode.scrollTop;
  p.innerHTML = s;
  p.parentNode.scrollTop = st;
}
function initPanelEvents() {
  var p = $('#panel');
  p.addEventListener('click', function (e) {
    var t = e.target;
    var row = t.closest('tr[data-room]');
    if (row) { select('room', row.dataset.room); if (ui.is3d && window.View3D && window.View3D.flyToRoom) { try { window.View3D.flyToRoom(row.dataset.room); } catch (x) { } } return; }
    var fr = t.closest('tr[data-fid]'); if (fr) { select('furn', fr.dataset.fid); return; }
    var mb = t.closest('[data-mat]');
    if (mb && ui.sel && ui.sel.kind === 'room') { var id = ui.sel.id; mutate(function () { state.rooms[id].mat = mb.dataset.mat; }); return; }
    var ab = t.closest('[data-act]'); if (!ab) return;
    switch (ab.dataset.act) {
      case 'clearMeasures': mutate(function () { state.measures = []; }); break;
      case 'clearLayout': clearAllFurn(); break;
      case 'deselect': select(null); break;
      case 'rot90': rotSel(90); break;
      case 'dup': dupSel(); break;
      case 'front': reorderSel(true); break;
      case 'back': reorderSel(false); break;
      case 'del': delSel(); break;
    }
  });
  p.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'rName' && ui.sel && ui.sel.kind === 'room') {
      var id = ui.sel.id, v = t.value.trim();
      if (!v || v === nm(roomName(id))) { renderPanel(); return; }
      mutate(function () { state.rooms[id].name = v; }); return;
    }
    var key = t.dataset && t.dataset.f;
    if (!key || !ui.sel || ui.sel.kind !== 'furn') return;
    var f = getF(ui.sel.id); if (!f) return;
    if (key === 'name') { var nv = t.value.trim(); if (!nv || nv === nm(f.name)) { renderPanel(); return; } mutate(function () { f.name = nv; }); return; }
    if (key === 'color') { mutate(function () { f.color = t.value; }); return; }
    var v = parseFloat(t.value);
    if (!isFinite(v)) { renderPanel(); return; }
    mutate(function () {
      if (key === 'w' || key === 'd') f[key] = Math.max(50, Math.round(v));
      else if (key === 'rot') f.rot = norm(v);
      else f[key] = Math.round(v);
    });
  });
}

/* ===================== yüzen çubuk ===================== */
function renderFab() {
  var fab = $('#fab'), sel = ui.sel, s = '';
  if (sel && sel.kind === 'furn' && getF(sel.id)) {
    var f = getF(sel.id);
    s = '<span class="name">' + esc(nm(f.name)) + '</span><button class="btn" data-fab="rotL" title="' + esc(tr('Saat yönünün tersine 90°', '90° counter-clockwise')) + '">↺</button>'
      + '<button class="btn" data-fab="rotR">↻ ' + esc(tr('Döndür', 'Rotate')) + '</button><button class="btn" data-fab="dup">' + esc(tr('Kopyala', 'Duplicate')) + '</button>'
      + '<button class="btn danger" data-fab="del">' + esc(tr('Sil', 'Delete')) + '</button><span class="sep"></span>'
      + '<button class="btn narrow-only" data-fab="props">' + esc(tr('Özellikler', 'Properties')) + '</button><button class="btn" data-fab="done">' + esc(tr('Bitti', 'Done')) + '</button>';
  } else if (sel && sel.kind === 'room' && roomById(sel.id)) {
    s = '<span class="name">' + esc(nm(roomName(sel.id))) + '</span><button class="btn narrow-only" data-fab="props">' + esc(tr('Zemin / Özellikler', 'Floor / Properties')) + '</button><button class="btn" data-fab="done">' + esc(tr('Bitti', 'Done')) + '</button>';
  }
  fab.innerHTML = s;
  fab.classList.toggle('show', !!s);
}
function initFab() {
  $('#fab').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fab]'); if (!b) return;
    switch (b.dataset.fab) {
      case 'rotL': rotSel(-90); break;
      case 'rotR': rotSel(90); break;
      case 'dup': dupSel(); break;
      case 'del': delSel(); break;
      case 'done': select(null); break;
      case 'props': openDrawer('right'); break;
    }
  });
}

/* ===================== kitaplık ===================== */
function previewSvg(it, cls) {
  var pad = Math.max(it.w, it.d) * 0.08;
  return '<svg viewBox="' + n2(-it.w / 2 - pad) + ' ' + n2(-it.d / 2 - pad) + ' ' + n2(it.w + 2 * pad) + ' ' + n2(it.d + 2 * pad) + '" xmlns="' + NS + '"><g stroke="#3d3a34" stroke-width="1" stroke-linejoin="round">' + sym(it.type, it.w, it.d, it.color) + '</g></svg>';
}
function renderLib() {
  var s = '';
  LIBCATS.forEach(function (c, ci) {
    s += '<h4>' + esc(nm(c.cat)) + '</h4><div class="grid">';
    c.items.forEach(function (it, ii) {
      s += '<div class="item" data-c="' + ci + '" data-i="' + ii + '" title="' + esc(tr('Eklemek için tıklayın veya plandaki yere sürükleyin', 'Click to add, or drag onto the plan')) + '">' + previewSvg(it) + '<b>' + esc(nm(it.name)) + '</b><small>' + it.w + '×' + it.d + '</small></div>';
    });
    s += '</div>';
  });
  $('#lib').innerHTML = s;
  $('#libHint').textContent = IS_TOUCH
    ? tr('Mobilyalar gerçek ölçüde (mm) çizilir. Dokunarak ortaya yerleştirin veya basılı tutup sağa, plana / 3D zemine sürükleyin (yukarı-aşağı kaydırma listeyi kaydırır). Eklendikten sonra sağ panelden genişlik, derinlik ve rengi değiştirebilirsiniz.',
      'Furniture is drawn at real size (mm). Tap to place at the center, or hold and drag right onto the plan / 3D floor (swipe up/down to scroll). Edit size and color in the right panel afterwards.')
    : tr('Mobilyalar gerçek ölçüde (mm) çizilir. Tıklayarak ekranın ortasına ekleyin veya plana / 3D zemine sürükleyin. Eklendikten sonra sağ panelden genişlik, derinlik ve rengi değiştirebilirsiniz.',
      'Furniture is drawn at real size (mm). Click to add at the center, or drag onto the plan / 3D floor. Edit size and color in the right panel afterwards.');
}
var libDrag = null;
function dropTargetOK(x, y) {
  var el = document.elementFromPoint(x, y);
  if (!el) return false;
  if (!mainEl.contains(el)) return false;
  if (el.closest('#fab, #walkOverlay, #joy, #walkExit')) return false;
  return true;
}
function ghostScaleAt(x, y) {
  if (ui.is3d && window.View3D && window.View3D.dropInfo) { try { var i = window.View3D.dropInfo(x, y); if (i && i.scale) return i.scale; } catch (e) { } }
  return view.s;
}
function initLibDrag() {
  var lib = $('#lib');
  lib.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var el = e.target.closest('.item'); if (!el) return;
    var it = LIBCATS[+el.dataset.c].items[+el.dataset.i];
    libDrag = { it: it, el: el, sx: e.clientX, sy: e.clientY, on: false, id: e.pointerId, touch: e.pointerType === 'touch' };
    closeMenu();
  });
  function ghostUpdate(e) {
    var g = $('#ghost'), s = ghostScaleAt(e.clientX, e.clientY), it = libDrag.it;
    var w = Math.max(28, it.w * s), h = Math.max(20, it.d * s);
    g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px';
    if (g._k !== it.name + '|' + Math.round(w) + '|' + Math.round(h)) {
      g._k = it.name + '|' + Math.round(w) + '|' + Math.round(h);
      g.innerHTML = previewSvg(it).replace('<svg ', '<svg width="' + w + '" height="' + h + '" ');
    }
  }
  document.addEventListener('pointermove', function (e) {
    if (!libDrag || e.pointerId !== libDrag.id) return;
    var dx = e.clientX - libDrag.sx, dy = e.clientY - libDrag.sy;
    if (!libDrag.on) {
      if (libDrag.touch) { if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy)) libDrag.on = true; else return; }
      else { if (Math.hypot(dx, dy) > 4) libDrag.on = true; else return; }
      libDrag.el.classList.add('dragging'); $('#ghost').style.display = 'block'; $('#ghost')._k = '';
    }
    ghostUpdate(e);
    if (narrowNow()) { var d = $('#libAside'); if (d.classList.contains('open') && e.clientX > d.getBoundingClientRect().right) closeDrawers(); }
    e.preventDefault();
  });
  function finish(e, cancel) {
    if (!libDrag || e.pointerId !== libDrag.id) return;
    var L = libDrag; libDrag = null;
    L.el.classList.remove('dragging'); $('#ghost').style.display = 'none';
    if (cancel) return;
    if (!L.on) {
      if (Math.hypot(e.clientX - L.sx, e.clientY - L.sy) > thr() + 2) return;
      var p = defaultAddPoint(); addFurn(L.it, p.x, p.y);
      if (narrowNow()) closeDrawers();
      return;
    }
    if (!dropTargetOK(e.clientX, e.clientY)) return;
    if (ui.is3d) {
      var g = null;
      try { g = window.View3D && window.View3D.dropPoint && window.View3D.dropPoint(e.clientX, e.clientY); } catch (x) { }
      if (!g) { toast(tr('Zemine bırakın', 'Drop it on the floor')); return; }
      addFurn(L.it, g.x, g.y);
    } else {
      var q = toMM(e.clientX, e.clientY); addFurn(L.it, q.x, q.y);
    }
  }
  document.addEventListener('pointerup', function (e) { finish(e, false); });
  document.addEventListener('pointercancel', function (e) { finish(e, true); });
}

/* ===================== yerleşim: paneller / çekmeceler ===================== */
function narrowNow() { try { return matchMedia('(max-width:1100px)').matches; } catch (e) { return false; } }
function savePanes() { lsSet(K_PANES, JSON.stringify({ hideLib: $('#app').classList.contains('hide-lib'), hidePanel: $('#app').classList.contains('hide-panel') })); }
function updatePaneBtns() {
  var app = $('#app'), narrow = narrowNow();
  var libOn = narrow ? $('#libAside').classList.contains('open') : !app.classList.contains('hide-lib');
  var panOn = narrow ? $('#rightAside').classList.contains('open') : !app.classList.contains('hide-panel');
  var a = $('#tgLib'), b = $('#tgPanel');
  a.classList.toggle('on', libOn); b.classList.toggle('on', panOn);
  a.title = libOn ? tr('Mobilya kitaplığını gizle ( [ )', 'Hide library ( [ )') : tr('Mobilya kitaplığını göster ( [ )', 'Show library ( [ )');
  b.title = panOn ? tr('Özellik panelini gizle ( ] )', 'Hide properties ( ] )') : tr('Özellik panelini göster ( ] )', 'Show properties ( ] )');
  mainEl.classList.toggle('drawer-panel', narrow && $('#rightAside').classList.contains('open'));
}
function closeDrawers() {
  var l = $('#libAside'), r = $('#rightAside');
  if (l.classList.contains('open') || r.classList.contains('open')) { l.classList.remove('open'); r.classList.remove('open'); updatePaneBtns(); }
}
function openDrawer(side) {
  var l = $('#libAside'), r = $('#rightAside');
  l.classList.toggle('open', side === 'lib'); r.classList.toggle('open', side === 'right');
  updatePaneBtns();
}
function togglePane(side) {
  if (narrowNow()) {
    var el = side === 'lib' ? $('#libAside') : $('#rightAside');
    if (el.classList.contains('open')) closeDrawers(); else openDrawer(side);
  } else {
    $('#app').classList.toggle(side === 'lib' ? 'hide-lib' : 'hide-panel'); savePanes(); updatePaneBtns();
  }
}
function loadPanes() {
  try { var p = JSON.parse(lsGet(K_PANES) || 'null'); if (p) { $('#app').classList.toggle('hide-lib', !!p.hideLib); $('#app').classList.toggle('hide-panel', !!p.hidePanel); } } catch (e) { }
}

/* ===================== 2D / 3D geçişi ===================== */
function walking() { try { return !!(window.View3D && window.View3D.walking && window.View3D.walking()); } catch (e) { return false; } }
function updateTip() {
  var t;
  if (ui.is3d) t = tr('3D sahne plan ile anlık senkron · sağ paneldeki değişiklikler hemen uygulanır · T: 2D', '3D stays in sync with the plan · panel edits apply instantly · T for 2D');
  else if (IS_TOUCH) t = tr('Kitaplıktan dokunun veya sürükleyin · tek parmak kaydırır · iki parmak yakınlaştırır · seçince alt çubuktan döndür / kopyala / sil', 'Tap or drag from the library · 1 finger pans · pinch zooms · bottom bar rotates / duplicates / deletes');
  else t = tr('Soldaki mobilyayı plana sürükleyin · tekerlek yakınlaştırır · boşluğu sürükleyerek kaydırın · T: 3D', 'Drag furniture onto the plan · scroll to zoom · drag empty space to pan · T for 3D');
  $('#tip').textContent = t;
}
function setViewUI(is3d) {
  ui.is3d = !!is3d;
  document.body.classList.toggle('m3d', ui.is3d);
  $('#viewSeg').classList.toggle('is3d', ui.is3d);
  $$('#viewSeg [data-view]').forEach(function (b) { b.classList.toggle('on', (b.dataset.view === '3d') === ui.is3d); });
  updateTip();
}
function isThenable(x) { return x && typeof x.then === 'function'; }
function setView(v) {
  var to3d = v === '3d';
  if (to3d === ui.is3d) return;
  var V = window.View3D;
  if (!V || !(to3d ? V.enter : V.exit)) { toast(tr('3D motoru hâlâ yükleniyor veya yüklenemedi (three.js için ağ bağlantısı gerekir)', '3D engine is still loading or failed to load (three.js needs a network connection)')); return; }
  document.body.classList.add('busy');
  if (to3d) { cancelAct(); setTool('select'); closeDrawers(); }
  setViewUI(to3d);
  var done = function () { document.body.classList.remove('busy'); if (!to3d) { renderAll(); } };
  var res;
  try { res = to3d ? V.enter() : V.exit(); } catch (e) { console.error(e); setViewUI(!to3d); done(); return; }
  if (isThenable(res)) res.then(done, function (e) { console.error(e); done(); });
  else setTimeout(done, to3d ? 2300 : 1900);
}
function toggleView() { setView(ui.is3d ? '2d' : '3d'); }

/* ===================== tam ekran ===================== */
function fsLabel() {
  var on = !!document.fullscreenElement;
  var b = $('#fullscreen');
  b.textContent = on ? '⛶ ' + tr('Tam ekrandan çık', 'Exit fullscreen') : '⛶ ' + tr('Tam ekran', 'Fullscreen');
}
function toggleFullscreen() {
  var el = document.documentElement;
  if (!el.requestFullscreen) { toast(tr('Bu tarayıcı tam ekranı desteklemiyor — Safari’de «Ana Ekrana Ekle» ile tam ekran açın', 'Fullscreen is not supported here — in Safari, use "Add to Home Screen" to open it fullscreen')); return; }
  var p = document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
  if (p && p.catch) p.catch(function () { toast(tr('Tam ekrana geçilemedi', 'Could not enter fullscreen')); });
}

/* ===================== dışa / içe aktarma ===================== */
function download(blobOrUrl, name) {
  var a = document.createElement('a'), url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
function exportImage() {
  if (ui.is3d) {
    var cv = $('#view3d canvas');
    try { if (window.View3D && window.View3D.exportPNG) { window.View3D.exportPNG(); return; } } catch (e) { }
    if (cv) { try { download(cv.toDataURL('image/png'), 'kat-plani-tasarimi-3D.png'); } catch (e) { } }
    return;
  }
  var b = _BOUNDS, W = 3200, Hh = Math.round(W * b.h / b.w);
  var c = svg.cloneNode(true);
  c.setAttribute('xmlns', NS); c.setAttribute('viewBox', b.x + ' ' + b.y + ' ' + b.w + ' ' + b.h);
  c.setAttribute('width', W); c.setAttribute('height', Hh); c.removeAttribute('class'); c.removeAttribute('style');
  var q = c.querySelector('#gSel'); if (q) q.innerHTML = '';
  var q2 = c.querySelector('#gGrid rect'); if (q2) q2.setAttribute('fill', ui.layers.grid ? 'url(#grid)' : '#f7f4ee');
  var st = document.createElementNS(NS, 'style');
  st.textContent = '*{vector-effect:non-scaling-stroke} pattern *,text{vector-effect:none} text{font-family:-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif} .wall{pointer-events:none}';
  c.insertBefore(st, c.firstChild);
  var bg = document.createElementNS(NS, 'rect');
  bg.setAttribute('x', b.x); bg.setAttribute('y', b.y); bg.setAttribute('width', b.w); bg.setAttribute('height', b.h); bg.setAttribute('fill', '#f7f4ee');
  var defs = c.querySelector('defs'); c.insertBefore(bg, defs ? defs.nextSibling : c.firstChild);
  var xml = new XMLSerializer().serializeToString(c);
  var img = new Image();
  img.onload = function () {
    var cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = Hh;
    var cx = cv2.getContext('2d'); cx.fillStyle = '#f7f4ee'; cx.fillRect(0, 0, W, Hh); cx.drawImage(img, 0, 0, W, Hh);
    cv2.toBlob(function (bl) { if (bl) download(bl, 'kat-plani-tasarimi.png'); }, 'image/png');
  };
  img.onerror = function () { toast(tr('Görüntü dışa aktarılamadı', 'Could not export image')); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
}
function exportJson() {
  download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'kat-plani-tasarimi.json');
}
function importFile(file) {
  file.text().then(function (txt) {
    var o; try { o = JSON.parse(txt); } catch (e) { o = null; }
    if (!o || !Array.isArray(o.furniture)) { toast(tr('Dosya biçimi geçersiz', 'Invalid file format')); return; }
    snap(); state = fixState(o); ui.sel = null; commit();
    toast(tr('Plan içe aktarıldı', 'Plan imported'));
  }, function () { toast(tr('Dosya biçimi geçersiz', 'Invalid file format')); });
}
function resetDefault() {
  if (!confirm(tr('Varsayılan tasarıma dönülsün mü? (geri alınabilir)', 'Reset to the default design? (undoable)'))) return;
  snap(); state = defaultState(); ui.sel = null; commit();
}

/* ===================== klavye ===================== */
function nudge(dx, dy) {
  if (!ui.sel || ui.sel.kind !== 'furn') return false;
  var f = getF(ui.sel.id); if (!f) return false;
  mutate(function () { f.cx += dx; f.cy += dy; });
  return true;
}
function initKeys() {
  document.addEventListener('keydown', function (e) {
    var tg = e.target, tn = tg && tg.tagName;
    if (tn === 'INPUT' || tn === 'SELECT' || tn === 'TEXTAREA') { if (!(tn === 'INPUT' && (tg.type === 'range' || tg.type === 'checkbox') && false)) return; }
    if (walking()) return;
    var k = e.key, lk = k.length === 1 ? k.toLowerCase() : k, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      if (lk === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (lk === 'y') { e.preventDefault(); redo(); }
      else if (lk === 'd') { e.preventDefault(); dupSel(); }
      return;
    }
    if (e.altKey) return;
    var in3 = ui.is3d;
    switch (lk) {
      case 'v': if (!in3) setTool('select'); break;
      case 'm': if (!in3) setTool('measure'); break;
      case 'x': if (!in3) setTool('demolish'); break;
      case 'Escape':
        if (ui.tool === 'measure' && ui.mpend) { ui.mpend = null; ui.mcur = null; act = null; renderMeasure(); }
        else { if (ui.tool !== 'select') setTool('select'); select(null); }
        break;
      case 'r': rotSel(e.shiftKey ? -90 : 90); break;
      case 'Delete': case 'Backspace': if (ui.sel && ui.sel.kind === 'furn') { e.preventDefault(); delSel(); } break;
      case 'ArrowLeft': if (nudge(e.shiftKey ? -100 : -10, 0)) e.preventDefault(); break;
      case 'ArrowRight': if (nudge(e.shiftKey ? 100 : 10, 0)) e.preventDefault(); break;
      case 'ArrowUp': if (nudge(0, e.shiftKey ? -100 : -10)) e.preventDefault(); break;
      case 'ArrowDown': if (nudge(0, e.shiftKey ? 100 : 10)) e.preventDefault(); break;
      case 't': toggleView(); break;
      case 'f': if (e.shiftKey) toggleFullscreen(); else if (!in3) fitView(); break;
      case '+': case '=': if (!in3) zoomCenter(1.25); break;
      case '-': case '_': if (!in3) zoomCenter(0.8); break;
      case '[': togglePane('lib'); break;
      case ']': togglePane('right'); break;
    }
  });
}

/* ===================== dil uygulama ===================== */
function walkTexts() {
  var a = $('#wo1'), b = $('#wo2'), c = $('#wo3');
  if (IS_TOUCH) {
    a.innerHTML = esc(tr('Başlamak için dokunun (giriş kapısından girilir)', 'Tap to start at the front door'));
    b.innerHTML = esc(tr('Sol alttaki joystick ile yürü · ekranı sürükleyerek bak', 'Joystick moves · drag on screen to look'));
    c.innerHTML = esc(tr('Kapıya dokunarak aç/kapat · «Gezintiden çık» ile kuşbakışına dön', 'Tap doors to open · "Exit walk" returns to orbit'));
  } else {
    a.innerHTML = esc(tr('Başlamak için tıklayın (giriş kapısından girilir)', 'Click to start at the front door'));
    b.innerHTML = tr('<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> yürü · fare: bak · <kbd>Shift</kbd> hızlı', '<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move · mouse looks · <kbd>Shift</kbd> runs');
    c.innerHTML = tr('<kbd>E</kbd> önündeki kapıyı aç/kapat · <kbd>Esc</kbd> duraklat', '<kbd>E</kbd> opens the door ahead · <kbd>Esc</kbd> pauses');
  }
}
function applyLang() {
  document.documentElement.lang = LANG;
  document.title = tr('Kat Planı Dekorasyon Tasarımı', 'Floor Plan Designer');
  $$('[data-en]').forEach(function (el) {
    if (el.dataset.tr == null) el.dataset.tr = el.innerHTML;
    el.innerHTML = LANG === 'en' ? el.dataset.en : el.dataset.tr;
  });
  $$('[data-en-title]').forEach(function (el) {
    if (el.dataset.trTitle == null) el.dataset.trTitle = el.getAttribute('title') || '';
    el.setAttribute('title', LANG === 'en' ? el.dataset.enTitle : el.dataset.trTitle);
  });
  $('#langBtn').textContent = LANG === 'en' ? 'TR' : 'EN';
  walkTexts(); fsLabel(); updateTip(); updatePaneBtns();
  renderLib(); setTool(ui.tool); renderAll();
  window.dispatchEvent(new CustomEvent('kp-lang', { detail: LANG }));
  try { var V = window.View3D; if (V) { (V.onLang || V.relang || V.refreshLang || function () { }).call(V, LANG); } } catch (e) { console.error(e); }
}
function setLang(l) { LANG = l; lsSet(K_LANG, l); applyLang(); }

/* ===================== başlatma ===================== */
function initUI() {
  $$('#tools [data-tool]').forEach(function (b) { b.addEventListener('click', function () { setTool(b.dataset.tool); }); });
  $('#zIn').addEventListener('click', function () { zoomCenter(1.25); });
  $('#zOut').addEventListener('click', function () { zoomCenter(0.8); });
  $('#zFit').addEventListener('click', fitView);
  $('#z60').addEventListener('click', function () { setRatio(60); toast(tr('1:60 gösteriliyor (özgün plan ile aynı ölçek)', 'Showing at 1:60 (same scale as the original plan)')); });
  $('#z100').addEventListener('click', function () { setRatio(100); });
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#clearAll').addEventListener('click', clearAllFurn);
  $$('[data-layer]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.layer; ui.layers[k] = !ui.layers[k]; renderLayers();
      if (k === 'grid') renderGrid(); else if (k === 'dims') renderDims(); else if (k === 'rooms') renderLabels(); else if (k === 'furn') renderFurn(); else if (k === 'bearing') renderWalls();
    });
  });
  $$('#viewSeg [data-view]').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view); }); });
  $('#tgLib').addEventListener('click', function () { togglePane('lib'); });
  $('#tgPanel').addEventListener('click', function () { togglePane('right'); });
  $('#langBtn').addEventListener('click', function () { setLang(LANG === 'en' ? 'tr' : 'en'); });
  $('#fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', fsLabel);
  try { if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('#fullscreen').style.display = 'none'; } catch (e) { }
  $('#mExportImg').addEventListener('click', function () { closeMenu(); exportImage(); });
  $('#mExportJson').addEventListener('click', function () { closeMenu(); exportJson(); });
  $('#mImport').addEventListener('click', function () { closeMenu(); $('#importFile').click(); });
  $('#mReset').addEventListener('click', function () { closeMenu(); resetDefault(); });
  $('#importFile').addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; if (f) importFile(f); e.target.value = ''; });
  $('#sun').addEventListener('input', function (e) {
    var h = parseFloat(e.target.value), hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    $('#sunVal').textContent = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  });
  mainEl.addEventListener('pointerdown', function () { closeDrawers(); closeMenu(); }, true);
  try { matchMedia('(max-width:1100px)').addEventListener('change', function () { closeDrawers(); updatePaneBtns(); }); } catch (e) { }
}
function initResize() {
  var lw = 0, lh = 0;
  var ro = new ResizeObserver(function () {
    var v = viewSize();
    if (v.W < 2 || v.H < 2) return;
    if (!lw) fitView();
    else { view.x0 += lw / 2 / view.s - v.W / 2 / view.s; view.y0 += lh / 2 / view.s - v.H / 2 / view.s; applyView(); }
    lw = v.W; lh = v.H;
  });
  ro.observe(mainEl);
}
function boot() {
  state = loadState();
  loadPanes();
  initSvg(); initPointer(); initPanelEvents(); initFab(); initLibDrag(); initUI(); initKeys();
  setTool('select'); renderLayers();
  applyLang();
  initResize();
  updatePaneBtns();
  window.state = state;
}
window.setViewUI = setViewUI;
window.is3d = function () { return ui.is3d; };
window.snapshot = window.pushUndo = window.beginChange = snap;
window.walking2D = walking;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
