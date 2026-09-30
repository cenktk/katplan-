/* Daire planı verisi — tipik Türk 3+1 (≈135 m² brüt).
 * Koordinatlar mm; orijin sol üst, x sağa, y aşağı. Duvarlar merkez çizgisiyle tanımlanır.
 * Bu dosya yalnızca veri içerir; başka dairede kullanmak için yalnızca bu dosyayı değiştirin. */
var KP = window.KP = window.KP || {};
KP.PLAN = {
  name: 'Örnek 3+1 Daire',
  wallHeight: 2800,          // tavan yüksekliği (mm)
  cutHeight: 1200,           // kesik duvar modunda duvar yüksekliği (mm)
  // Duvarlar: id, a/b uç noktaları, kalınlık, taşıyıcı mı, tür (wall | parapet)
  walls: [
    // Dış duvarlar (taşıyıcı)
    { id: 'd1', a: [0, 0],        b: [13000, 0],     t: 250, bearing: true },
    { id: 'd2', a: [13000, 0],    b: [13000, 10000], t: 250, bearing: true },
    { id: 'd3', a: [13000, 10000],b: [0, 10000],     t: 250, bearing: true },
    { id: 'd4', a: [0, 10000],    b: [0, 0],         t: 250, bearing: true },
    // Balkon korkuluğu (alçak duvar)
    { id: 'b1', a: [0, 0],        b: [0, -1500],     t: 150, bearing: false, kind: 'parapet', h: 1100 },
    { id: 'b2', a: [0, -1500],    b: [4500, -1500],  t: 150, bearing: false, kind: 'parapet', h: 1100 },
    { id: 'b3', a: [4500, -1500], b: [4500, 0],      t: 150, bearing: false, kind: 'parapet', h: 1100 },
    // İç duvarlar
    { id: 'i1', a: [6500, 0],     b: [6500, 4800],   t: 200, bearing: true },   // salon | mutfak (perde)
    { id: 'i2', a: [9800, 0],     b: [9800, 4800],   t: 120, bearing: false },  // mutfak | ebeveyn + hol
    { id: 'i3', a: [0, 4800],     b: [9800, 4800],   t: 120, bearing: false },  // salon, mutfak | banyo, hol
    { id: 'i4', a: [9800, 4200],  b: [13000, 4200],  t: 120, bearing: false },  // ebeveyn | hol, e.banyo
    { id: 'i5', a: [11000, 4200], b: [11000, 6800],  t: 120, bearing: false },  // hol | ebeveyn banyo
    { id: 'i6', a: [11000, 6800], b: [13000, 6800],  t: 120, bearing: false },  // ebeveyn banyo | antre
    { id: 'i7', a: [2800, 4800],  b: [2800, 10000],  t: 120, bearing: false },  // banyo, çamaşır | hol, yatak 2
    { id: 'i8', a: [0, 7600],     b: [2800, 7600],   t: 120, bearing: false },  // banyo | çamaşır
    { id: 'i9', a: [2800, 6200],  b: [9800, 6200],   t: 120, bearing: false },  // hol | yatak 2, yatak 3
    { id: 'i10',a: [6400, 6200],  b: [6400, 10000],  t: 120, bearing: false },  // yatak 2 | yatak 3
    { id: 'i11',a: [9800, 6200],  b: [9800, 10000],  t: 200, bearing: true },   // yatak 3 | antre (perde)
  ],
  // Açıklıklar: duvar id'si, duvar başlangıcından (a) itibaren from..to (mm).
  // type: door (menteşeli), slide (sürgülü balkon kapısı), entry (çelik daire kapısı), window, opening (kapısız)
  // swing: kapının açıldığı taraf ('left' | 'right': a→b yönüne bakınca), hinge: 'start' | 'end'
  openings: [
    { id: 'k1', wall: 'i3',  from: 3500, to: 4400, type: 'door', swing: 'right', hinge: 'start' }, // salon
    { id: 'k2', wall: 'i3',  from: 7300, to: 8200, type: 'door', swing: 'right', hinge: 'end' },   // mutfak
    { id: 'k3', wall: 'i7',  from: 300,  to: 1050, type: 'door', swing: 'right', hinge: 'start' }, // banyo (holden)
    { id: 'k4', wall: 'i4',  from: 200,  to: 1100, type: 'door', swing: 'right', hinge: 'start' }, // ebeveyn
    { id: 'k5', wall: 'i5',  from: 1200, to: 1950, type: 'door', swing: 'left',  hinge: 'end' },   // ebeveyn banyo
    { id: 'k6', wall: 'i9',  from: 2500, to: 3400, type: 'door', swing: 'left',  hinge: 'end' },   // yatak 2
    { id: 'k7', wall: 'i9',  from: 3800, to: 4700, type: 'door', swing: 'left',  hinge: 'start' }, // yatak 3
    { id: 'k8', wall: 'i8',  from: 1000, to: 1750, type: 'door', swing: 'right', hinge: 'start' }, // çamaşır odası
    { id: 'k9', wall: 'd2',  from: 8200, to: 9200, type: 'entry', swing: 'right', hinge: 'start' },// daire kapısı
    { id: 'k10',wall: 'd1',  from: 800,  to: 3400, type: 'slide' },                                // balkon kapısı
    // Pencereler (sill: parapet yüksekliği, top: üst kot)
    { id: 'p1', wall: 'd1',  from: 4300, to: 6000, type: 'window', sill: 900, top: 2300 },   // salon
    { id: 'p2', wall: 'd4',  from: 6800, to: 8600, type: 'window', sill: 900, top: 2300 },   // salon batı
    { id: 'p3', wall: 'd1',  from: 7300, to: 9000, type: 'window', sill: 1000, top: 2300 },  // mutfak
    { id: 'p4', wall: 'd1',  from: 10500,to: 12300,type: 'window', sill: 900, top: 2300 },   // ebeveyn
    { id: 'p5', wall: 'd3',  from: 7500, to: 9200, type: 'window', sill: 900, top: 2300 },   // yatak 3
    { id: 'p6', wall: 'd3',  from: 3900, to: 5600, type: 'window', sill: 900, top: 2300 },   // yatak 2
    { id: 'p7', wall: 'd4',  from: 3600, to: 4300, type: 'window', sill: 1500, top: 2200 },  // banyo
    { id: 'p8', wall: 'd2',  from: 5000, to: 5700, type: 'window', sill: 1500, top: 2200 },  // ebeveyn banyo
    { id: 'p9', wall: 'd4',  from: 800,  to: 1500, type: 'window', sill: 1500, top: 2200 },  // çamaşır
  ],
  // Odalar: iç poligon (duvar merkez çizgisi üzerinden), varsayılan zemin malzemesi
  rooms: [
    { id: 'salon',   name: 'Salon',          poly: [[0,0],[6500,0],[6500,4800],[0,4800]],                 mat: 'laminat' },
    { id: 'mutfak',  name: 'Mutfak',         poly: [[6500,0],[9800,0],[9800,4800],[6500,4800]],           mat: 'seramik' },
    { id: 'ebeveyn', name: 'Ebeveyn Yatak Odası', poly: [[9800,0],[13000,0],[13000,4200],[9800,4200]],    mat: 'parke' },
    { id: 'ebanyo',  name: 'Ebeveyn Banyosu',poly: [[11000,4200],[13000,4200],[13000,6800],[11000,6800]], mat: 'seramik' },
    { id: 'hol',     name: 'Hol',            poly: [[2800,4800],[9800,4800],[9800,4200],[11000,4200],[11000,6800],[9800,6800],[9800,6200],[2800,6200]], mat: 'laminat' },
    { id: 'antre',   name: 'Antre',          poly: [[9800,6800],[13000,6800],[13000,10000],[9800,10000]], mat: 'granit' },
    { id: 'banyo',   name: 'Banyo',          poly: [[0,4800],[2800,4800],[2800,7600],[0,7600]],           mat: 'seramik' },
    { id: 'camasir', name: 'Çamaşır Odası',  poly: [[0,7600],[2800,7600],[2800,10000],[0,10000]],         mat: 'seramik' },
    { id: 'yatak2',  name: 'Yatak Odası 2',  poly: [[2800,6200],[6400,6200],[6400,10000],[2800,10000]],   mat: 'laminat' },
    { id: 'yatak3',  name: 'Yatak Odası 3',  poly: [[6400,6200],[9800,6200],[9800,10000],[6400,10000]],   mat: 'laminat' },
    { id: 'balkon',  name: 'Balkon',         poly: [[0,-1500],[4500,-1500],[4500,0],[0,0]],               mat: 'dis-seramik', outdoor: true },
  ],
  north: 0, // derece; kuzey yukarı
};
