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
