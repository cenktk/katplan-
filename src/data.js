/* Plan verisi ve kütüphane — Türk 3+1 daire (SPEC §5, §9.4, §9.5, §13).
 * Koordinatlar mm; orijin = sol-üst İÇ köşe (dış duvar iç yüzü), +x sağ, +y aşağı.
 * Klasik script: const/function tanımları global; sonunda window'a da yayınlanır. */

const H = 2.8;                 // kat yüksekliği (m)
const OX = 6375, OY = 4150;    // 3D orijini = planın (balkon dahil) merkezi

/* ---------- Duvarlar: [x0, y0, x1, y1, tip, id] ----------
 * tip: 'e' dış, 'b' taşıyıcı iç perde, 'n' yıkılabilir bölme, 'low' balkon korkuluğu.
 * Açıklıklar (kapı/pencere/sürgü) boşluk olarak bırakılmıştır. Sıra kararlıdır; id sabittir. */
const WALLS = [
  // Dış duvar — üst (250 kalınlık): balkon sürgüsü + 3 pencere boşluğu
  [-250, -250, 675, 0, 'e', 'e-ust-1'],
  [3275, -250, 4525, 0, 'e', 'e-ust-2'],
  [6075, -250, 7175, 0, 'e', 'e-ust-3'],
  [8875, -250, 10375, 0, 'e', 'e-ust-4'],
  [12175, -250, 13000, 0, 'e', 'e-ust-5'],
  // Dış duvar — sağ: ebeveyn banyo penceresi + daire kapısı boşluğu
  [12750, 0, 13000, 4875, 'e', 'e-sag-1'],
  [12750, 5575, 13000, 8700, 'e', 'e-sag-2'],
  [12750, 9600, 13000, 9750, 'e', 'e-sag-3'],
  // Dış duvar — alt: 2 pencere boşluğu
  [-250, 9750, 3675, 10000, 'e', 'e-alt-1'],
  [5375, 9750, 7275, 10000, 'e', 'e-alt-2'],
  [8975, 9750, 13000, 10000, 'e', 'e-alt-3'],
  // Dış duvar — sol: 3 pencere boşluğu
  [-250, 0, 0, 1275, 'e', 'e-sol-1'],
  [-250, 3075, 0, 5575, 'e', 'e-sol-2'],
  [-250, 6275, 0, 8375, 'e', 'e-sol-3'],
  [-250, 9075, 0, 9750, 'e', 'e-sol-4'],
  // İç duvarlar
  [6275, 0, 6475, 4615, 'b', 'i1'],                      // salon | mutfak (perde)
  [9615, 0, 9735, 4735, 'n', 'i2'],                      // mutfak | ebeveyn + hol
  [0, 4615, 3375, 4735, 'n', 'i3-1'],                    // salon, mutfak | banyo, hol (k1, k2 boşluğu)
  [4275, 4615, 8500, 4735, 'n', 'i3-2'],
  [9400, 4615, 9615, 4735, 'n', 'i3-3'],
  [9735, 4015, 9800, 4135, 'n', 'i4-1'],                 // ebeveyn | hol, ebeveyn banyo (k4 boşluğu)
  [10700, 4015, 12750, 4135, 'n', 'i4-2'],
  [10815, 4135, 10935, 5800, 'n', 'i5-1'],               // hol | ebeveyn banyo (k5 boşluğu)
  [10815, 6600, 10935, 6735, 'n', 'i5-2'],
  [10935, 6615, 12750, 6735, 'n', 'i6'],                 // ebeveyn banyo | antre
  [2615, 4735, 2735, 4800, 'n', 'i7-1'],                 // banyo, çamaşır | hol, yatak 2 (k3 boşluğu)
  [2615, 5600, 2735, 9750, 'n', 'i7-2'],
  [0, 7415, 1700, 7535, 'n', 'i8-1'],                    // banyo | çamaşır (k8 boşluğu)
  [2500, 7415, 2615, 7535, 'n', 'i8-2'],
  [2735, 6015, 5275, 6135, 'n', 'i9-1'],                 // hol | yatak 2, yatak 3 (k6, k7 boşluğu)
  [6175, 6015, 6375, 6135, 'n', 'i9-2'],
  [7275, 6015, 9575, 6135, 'n', 'i9-3'],
  [6215, 6135, 6335, 9750, 'n', 'i10'],                  // yatak 2 | yatak 3
  [9575, 6015, 9775, 9750, 'b', 'i11'],                  // yatak 3 | antre (perde)
  // Balkon korkuluğu (150, alçak)
  [-200, -1550, -50, -250, 'low', 'k-sol'],
  [-200, -1700, 4450, -1550, 'low', 'k-ust'],
  [4300, -1550, 4450, -250, 'low', 'k-sag'],
];

/* ---------- Pencereler: [x0, y0, x1, y1, denizlik(mm), üst kot(mm), id] ---------- */
const WINS = [
  [4525, -250, 6075, 0, 900, 2300, 'p1'],        // salon (kuzey)
  [-250, 1275, 0, 3075, 900, 2300, 'p2'],        // salon (batı)
  [7175, -250, 8875, 0, 1000, 2300, 'p3'],       // mutfak
  [10375, -250, 12175, 0, 900, 2300, 'p4'],      // ebeveyn yatak odası
  [3675, 9750, 5375, 10000, 900, 2300, 'p5'],    // yatak odası 2
  [7275, 9750, 8975, 10000, 900, 2300, 'p6'],    // yatak odası 3
  [-250, 5575, 0, 6275, 1500, 2200, 'p7'],       // banyo
  [12750, 4875, 13000, 5575, 1500, 2200, 'p8'],  // ebeveyn banyosu
  [-250, 8375, 0, 9075, 1500, 2200, 'p9'],       // çamaşır odası
];

/* ---------- Menteşeli kapılar ---------- */
const DOORS = [
  { id: 'k1', name: 'Salon', rect: [3375, 4615, 4275, 4735], h: [3375, 4675], c: [1, 0], o: [0, -1], len: 885 },
  { id: 'k2', name: 'Mutfak', rect: [8500, 4615, 9400, 4735], h: [9400, 4675], c: [-1, 0], o: [0, -1], len: 885 },
  { id: 'k3', name: 'Banyo', rect: [2615, 4800, 2735, 5600], h: [2675, 4800], c: [0, 1], o: [-1, 0], len: 785 },
  { id: 'k4', name: 'Ebeveyn Yatak Odası', rect: [9800, 4015, 10700, 4135], h: [9800, 4075], c: [1, 0], o: [0, -1], len: 885 },
  { id: 'k5', name: 'Ebeveyn Banyosu', rect: [10815, 5800, 10935, 6600], h: [10875, 6600], c: [0, -1], o: [1, 0], len: 785 },
  { id: 'k6', name: 'Yatak Odası 2', rect: [5275, 6015, 6175, 6135], h: [6175, 6075], c: [-1, 0], o: [0, 1], len: 885 },
  { id: 'k7', name: 'Yatak Odası 3', rect: [6375, 6015, 7275, 6135], h: [6375, 6075], c: [1, 0], o: [0, 1], len: 885 },
  { id: 'k8', name: 'Çamaşır Odası', rect: [1700, 7415, 2500, 7535], h: [2500, 7475], c: [-1, 0], o: [0, 1], len: 785 },
  { id: 'k9', name: 'Daire Kapısı', rect: [12750, 8700, 13000, 9600], h: [12875, 9600], c: [0, -1], o: [-1, 0], len: 885, entry: true },
];

/* ---------- Sürgülü kapılar ---------- */
const SLIDES = [
  { id: 'k10', rect: [675, -250, 3275, 0], v: false },   // salon – balkon
];

/* ---------- Odalar: iç net çokgenler ---------- */
const ROOMS = [
  { id: 'salon', name: 'Salon', poly: [[0, 0], [6275, 0], [6275, 4615], [0, 4615]], mat: 'wood', at: [3140, 2300] },
  { id: 'mutfak', name: 'Mutfak', poly: [[6475, 0], [9615, 0], [9615, 4615], [6475, 4615]], mat: 'tile800', at: [8045, 2300] },
  { id: 'ebeveyn', name: 'Ebeveyn Yatak Odası', poly: [[9735, 0], [12750, 0], [12750, 4015], [9735, 4015]], mat: 'walnut', at: [11240, 2000] },
  { id: 'ebanyo', name: 'Ebeveyn Banyosu', poly: [[10935, 4135], [12750, 4135], [12750, 6615], [10935, 6615]], mat: 'antislip', at: [11840, 5375] },
  { id: 'hol', name: 'Hol', poly: [[2735, 4735], [9735, 4735], [9735, 4135], [10815, 4135], [10815, 6735], [9775, 6735], [9775, 6015], [2735, 6015]], mat: 'wood', at: [6000, 5375] },
  { id: 'antre', name: 'Antre', poly: [[9775, 6735], [12750, 6735], [12750, 9750], [9775, 9750]], mat: 'marble', at: [11260, 8240] },
  { id: 'banyo', name: 'Banyo', poly: [[0, 4735], [2615, 4735], [2615, 7415], [0, 7415]], mat: 'tile600', at: [1310, 6075] },
  { id: 'camasir', name: 'Çamaşır Odası', poly: [[0, 7535], [2615, 7535], [2615, 9750], [0, 9750]], mat: 'antislip', at: [1310, 8640] },
  { id: 'yatak2', name: 'Yatak Odası 2', poly: [[2735, 6135], [6215, 6135], [6215, 9750], [2735, 9750]], mat: 'wood', at: [4475, 7940] },
  { id: 'yatak3', name: 'Yatak Odası 3', poly: [[6335, 6135], [9575, 6135], [9575, 9750], [6335, 9750]], mat: 'wood', at: [7955, 7940] },
  { id: 'balkon', name: 'Balkon', poly: [[-50, -1550], [4300, -1550], [4300, -250], [-50, -250]], mat: 'terrazzo', at: [2125, -900], outdoor: true },
];

/* ---------- Ölçü zincirleri (SPEC §4.8) ----------
 * side: kenar; axis: zincirin uzandığı eksen; from: ilk kesitin başlangıcı (mm);
 * segs: ardışık parça ölçüleri (duvar kalınlıkları dahil); total: toplam;
 * line: parça zincirinin konumu (üst/alt için y, sol/sağ için x); tline: toplam zincirinin konumu. */
const DIMS = [
  { side: 'top', axis: 'x', from: -250, segs: [250, 6275, 200, 3140, 120, 3015, 250], total: 13250, line: -2450, tline: -2950 },
  { side: 'bottom', axis: 'x', from: -250, segs: [250, 2615, 120, 3480, 120, 3240, 200, 2975, 250], total: 13250, line: 10750, tline: 11250 },
  { side: 'left', axis: 'y', from: -1700, segs: [150, 1300, 250, 4615, 120, 2680, 120, 2215, 250], total: 11700, line: -1000, tline: -1500 },
  { side: 'right', axis: 'y', from: -250, segs: [250, 4015, 120, 2480, 120, 3015, 250], total: 10250, line: 14250, tline: 14750 },
];

/* Sığdırma kutusu: ölçü zincirlerini ve giriş işaretini kapsar */
const BOUNDS = { x: -1800, y: -3300, w: 17000, h: 14900 };

/* Giriş işareti: daire kapısının dışında yatay ok (x1→x2, kapıya doğru) + yazı */
const ENTRY = { x1: 14000, x2: 13080, y: 9150, tx: 13540, ty: 9060, text: 'Giriş' };

/* ---------- Zemin malzemeleri (SPEC §9.4) — fiyat ₺/m² ---------- */
const MATS = {
  wood: { name: 'Meşe Parke', price: 1250, color: '#d8b88a' },
  walnut: { name: 'Ceviz Parke', price: 1600, color: '#9b7250' },
  tile800: { name: '80×80 Seramik', price: 650, color: '#ebe6dc' },
  tile600: { name: '60×60 Seramik', price: 480, color: '#dfe3e1' },
  marble: { name: 'Mermer', price: 2600, color: '#f1eee8' },
  antislip: { name: '30×30 Kaymaz Seramik', price: 420, color: '#d3d8d4' },
  terrazzo: { name: 'Terrazzo', price: 1150, color: '#e6dfd3' },
  carpet: { name: 'Duvardan Duvara Halı (Moket)', price: 700, color: '#c9c3d3' },
};

/* ---------- Mobilya kütüphanesi (SPEC §5.1): [tip, ad, G, D, renk] ---------- */
const LIB = [
  { name: 'Yatak Odası', items: [
    ['bed', 'Çift Kişilik Yatak 1,8 m', 1800, 2000, '#c9d6df'],
    ['bed', 'Çift Kişilik Yatak 1,5 m', 1500, 2000, '#d8c7dc'],
    ['bed', 'Tek Kişilik Yatak', 1200, 2000, '#e8d5b5'],
    ['crib', 'Bebek Beşiği', 1250, 700, '#efe3d0'],
    ['nightstand', 'Komodin', 450, 400, '#e8dccb'],
    ['wardrobe', 'Gardırop', 2000, 600, '#efe6d8'],
    ['wardrobe', 'Küçük Gardırop', 1200, 550, '#efe6d8'],
    ['dresser', 'Makyaj Masası', 1000, 450, '#efe6d8'],
    ['desk', 'Çalışma Masası', 1200, 600, '#e2cfb4'],
    ['chair', 'Sandalye', 450, 480, '#cfc6b8'],
    ['bookshelf', 'Kitaplık', 800, 300, '#e2cfb4'],
    ['baycushion', 'Cumba Minderi', 520, 1800, '#e7dccd'],
  ] },
  { name: 'Salon', items: [
    ['sofa', 'Üçlü Koltuk', 2400, 900, '#b7c4b0'],
    ['sofa', 'İkili Koltuk', 1700, 880, '#c3cbd6'],
    ['cornersofa', 'Köşe Koltuk', 2800, 1700, '#b7c4b0'],
    ['armchair', 'Tekli Koltuk', 850, 850, '#d6b99a'],
    ['beanbag', 'Puf (Sakso)', 800, 800, '#e0b98f'],
    ['coffeetable', 'Orta Sehpa', 1300, 650, '#e8dccb'],
    ['sidetable', 'Yan Sehpa', 500, 500, '#d9c3a3'],
    ['tvstand', 'TV Ünitesi', 2400, 400, '#e2cfb4'],
    ['rug', 'Halı', 2400, 1700, '#d9cbb8'],
    ['shoecab', 'Ayakkabılık', 1000, 350, '#efe6d8'],
    ['shoecab', 'Vestiyer Dolabı', 1400, 380, '#e6dccc'],
    ['floorlamp', 'Lambader', 450, 450, '#3d3a34'],
    ['plant', 'Bitki', 500, 500, '#a9c39b'],
    ['plant', 'Büyük Bitki', 700, 700, '#9dbb8c'],
  ] },
  { name: 'Yemek & Mutfak', items: [
    ['table', 'Yemek Masası', 1400, 800, '#e2cfb4'],
    ['table', '6 Kişilik Yemek Masası', 1800, 900, '#d8c2a2'],
    ['roundtable', 'Yuvarlak Masa', 1000, 1000, '#e2cfb4'],
    ['chair', 'Yemek Sandalyesi', 450, 480, '#cfc6b8'],
    ['island', 'Mutfak Adası', 1800, 900, '#e9e5de'],
    ['barstool', 'Bar Taburesi', 420, 420, '#6b5d4c'],
    ['counter', 'Mutfak Tezgâhı', 1600, 600, '#e9e5de'],
    ['stove', 'Ocak', 750, 450, '#dcdcdc'],
    ['ksink', 'Evye', 800, 450, '#e1e6ea'],
    ['fridge', 'Buzdolabı', 700, 700, '#dfe4e8'],
    ['cabinet', 'Büfe', 1600, 400, '#efe6d8'],
  ] },
  { name: 'Banyo', items: [
    ['toilet', 'Klozet', 400, 700, '#ffffff'],
    ['vanity', 'Banyo Dolabı', 800, 500, '#eef1f3'],
    ['vanity', 'Çift Lavabolu Banyo Dolabı', 1200, 500, '#eef1f3'],
    ['shower', 'Duşakabin', 900, 900, '#e4edf2'],
    ['bathtub', 'Küvet', 1600, 750, '#eef3f6'],
    ['washer', 'Çamaşır Makinesi', 600, 600, '#e6ebee'],
    ['waterheater', 'Termosifon', 800, 450, '#f4f4f2'],
    ['cabinet', 'Depolama Dolabı', 1000, 400, '#efe6d8'],
  ] },
  { name: 'Ev Aletleri', items: [
    ['tv', '65" TV', 1450, 80, '#1d1d1f'],
    ['tv', '55" TV', 1230, 80, '#1d1d1f'],
    ['fridge', 'Gardırop Tipi Buzdolabı', 910, 700, '#c9ced3'],
    ['aircon', 'Ayaklı (Salon Tipi) Klima', 500, 380, '#f6f7f8'],
    ['acwall', 'Duvar Tipi (Split) Klima', 900, 250, '#f6f7f8'],
    ['dishwasher', 'Bulaşık Makinesi', 600, 600, '#c9ced3'],
    ['ovencol', 'Buharlı Fırın Boy Dolabı', 600, 600, '#efe6d8'],
    ['dryer', 'Kurutma Makinesi', 600, 600, '#e6ebee'],
    ['purifier', 'Hava Temizleyici', 400, 300, '#f4f4f2'],
  ] },
  { name: 'Çalışma & Dinlenme', items: [
    ['desk', 'Uzun Çalışma Masası', 1600, 700, '#d8c2a2'],
    ['officechair', 'Ofis Koltuğu', 620, 620, '#4a4f55'],
    ['bookshelf', 'Büyük Kitaplık', 1600, 350, '#e2cfb4'],
    ['piano', 'Dik Piyano', 1500, 600, '#1f1d1b'],
    ['treadmill', 'Koşu Bandı', 800, 1800, '#3a3a3c'],
    ['armchair', 'Okuma Koltuğu', 750, 800, '#c9a98a'],
  ] },
];

/* ---------- TR → EN ad sözlüğü (oda, malzeme, mobilya, kategori, kapı) ---------- */
const NAMES_EN = {
  // odalar
  'Salon': 'Living Room', 'Mutfak': 'Kitchen', 'Ebeveyn Yatak Odası': 'Master Bedroom',
  'Ebeveyn Banyosu': 'Master Bath', 'Hol': 'Hallway', 'Antre': 'Entrance Hall', 'Banyo': 'Bathroom',
  'Çamaşır Odası': 'Laundry Room', 'Yatak Odası 2': 'Bedroom 2', 'Yatak Odası 3': 'Bedroom 3', 'Balkon': 'Balcony',
  'Daire Kapısı': 'Entry Door', 'Giriş': 'Entry',
  // SPEC §9.5'teki ek yerleşik adlar
  'Çocuk Odası': "Kids' Room", 'Çocuk Odası 2': "Children's Room", 'Misafir Banyosu': 'Guest Bath',
  'Çamaşır Balkonu': 'Laundry Balcony', 'Yemek Alanı': 'Dining', 'Koridor': 'Hallway',
  'Dinlenme Balkonu': 'Leisure Balcony', 'Ebeveyn Cumbası': 'Master Bay Window', 'Çocuk Odası 2 Cumbası': "Children's Bay Window",
  // malzemeler
  'Meşe Parke': 'Oak Flooring', 'Ceviz Parke': 'Walnut Flooring', '80×80 Seramik': '800 Tile',
  '60×60 Seramik': '600 Tile', 'Mermer': 'Marble', '30×30 Kaymaz Seramik': '300 Anti-slip Tile',
  'Terrazzo': 'Terrazzo', 'Duvardan Duvara Halı (Moket)': 'Wall-to-wall Carpet',
  // kategoriler
  'Yemek & Mutfak': 'Dining & Kitchen', 'Ev Aletleri': 'Appliances', 'Çalışma & Dinlenme': 'Study & Leisure',
  // mobilya (Yatak Odası)
  'Çift Kişilik Yatak 1,8 m': 'Double Bed 1.8m', 'Çift Kişilik Yatak 1,5 m': 'Double Bed 1.5m',
  'Tek Kişilik Yatak': 'Single Bed', 'Bebek Beşiği': 'Crib', 'Komodin': 'Nightstand', 'Gardırop': 'Wardrobe',
  'Küçük Gardırop': 'Small Wardrobe', 'Makyaj Masası': 'Dresser', 'Çalışma Masası': 'Desk', 'Sandalye': 'Chair',
  'Kitaplık': 'Bookshelf', 'Cumba Minderi': 'Bay Cushion',
  // Salon
  'Üçlü Koltuk': '3-Seat Sofa', 'İkili Koltuk': 'Loveseat', 'Köşe Koltuk': 'Corner Sofa', 'Tekli Koltuk': 'Armchair',
  'Puf (Sakso)': 'Beanbag', 'Orta Sehpa': 'Coffee Table', 'Yan Sehpa': 'Side Table', 'TV Ünitesi': 'TV Stand',
  'Halı': 'Rug', 'Ayakkabılık': 'Shoe Cabinet', 'Vestiyer Dolabı': 'Entry Cabinet', 'Lambader': 'Floor Lamp',
  'Bitki': 'Plant', 'Büyük Bitki': 'Large Plant',
  // Yemek & Mutfak
  'Yemek Masası': 'Dining Table', '6 Kişilik Yemek Masası': '6-Seat Dining Table', 'Yuvarlak Masa': 'Round Table',
  'Yemek Sandalyesi': 'Dining Chair', 'Mutfak Adası': 'Kitchen Island', 'Bar Taburesi': 'Bar Stool',
  'Mutfak Tezgâhı': 'Kitchen Counter', 'Ocak': 'Gas Stove', 'Evye': 'Sink', 'Buzdolabı': 'Fridge', 'Büfe': 'Sideboard',
  // Banyo
  'Klozet': 'Toilet', 'Banyo Dolabı': 'Vanity', 'Çift Lavabolu Banyo Dolabı': 'Double Vanity', 'Duşakabin': 'Shower',
  'Küvet': 'Bathtub', 'Çamaşır Makinesi': 'Washer', 'Termosifon': 'Water Heater', 'Depolama Dolabı': 'Storage Cabinet',
  // Ev Aletleri
  '65" TV': '65" TV', '55" TV': '55" TV', 'Gardırop Tipi Buzdolabı': 'French-door Fridge',
  'Ayaklı (Salon Tipi) Klima': 'Floor AC', 'Duvar Tipi (Split) Klima': 'Wall AC', 'Bulaşık Makinesi': 'Dishwasher',
  'Buharlı Fırın Boy Dolabı': 'Oven Tower', 'Kurutma Makinesi': 'Dryer', 'Hava Temizleyici': 'Air Purifier',
  // Çalışma & Dinlenme
  'Uzun Çalışma Masası': 'Long Desk', 'Ofis Koltuğu': 'Office Chair', 'Büyük Kitaplık': 'Large Bookshelf',
  'Dik Piyano': 'Upright Piano', 'Koşu Bandı': 'Treadmill', 'Okuma Koltuğu': 'Reading Chair',
};

/* ---------- Yardımcılar ---------- */
/* Tipin ilk eşleşen kütüphane öğesinin rengi */
function typeColor(tip) {
  for (const cat of LIB) for (const it of cat.items) if (it[0] === tip) return it[4];
  return '#cfc6b8';
}

/* Ayakkabı bağı ile çokgen alanı (m²) */
function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2 / 1e6;
}

/* Varsayılan yerleşim: F(tip, ad, cx, cy, w, d, rot=0, renk?) — sıra çizim sırasıdır (halılar en başta).
 * rot: saat yönü derece; yerel −y (arka) rot=0'da kuzeye, 90'da doğuya, 180'de güneye, 270'te batıya bakar. */
function defaultFurniture() {
  const out = [];
  let n = 0;
  const F = (tip, ad, cx, cy, w, d, rot = 0, renk) => {
    n++;
    out.push({ id: 'fd' + n, type: tip, name: ad, cx, cy, w, d, rot, color: renk || typeColor(tip) });
  };
  // Halılar
  F('rug', 'Halı', 3000, 2800, 2400, 1700, 90);                 // salon oturma grubu
  F('rug', 'Halı', 11240, 1400, 2400, 1700, 0);                 // ebeveyn
  F('rug', 'Halı', 4200, 7900, 2400, 1700, 0);                  // yatak 2
  F('rug', 'Halı', 8000, 8200, 2400, 1700, 90);                 // yatak 3

  // Salon — oturma grubu (TV doğu duvarında)
  F('sofa', 'Üçlü Koltuk', 1900, 2800, 2400, 900, 270);
  F('coffeetable', 'Orta Sehpa', 3250, 2800, 1300, 650, 90);
  F('armchair', 'Tekli Koltuk', 2900, 4000, 850, 850, 180);
  F('tvstand', 'TV Ünitesi', 6075, 2800, 2400, 400, 90);
  F('tv', '65" TV', 6075, 2800, 1450, 80, 90);
  F('floorlamp', 'Lambader', 450, 1000, 450, 450);
  // Salon — yemek alanı (kuzey-doğu)
  F('table', '6 Kişilik Yemek Masası', 4900, 1100, 1800, 900, 0);
  for (const x of [4300, 4900, 5500]) F('chair', 'Yemek Sandalyesi', x, 410, 450, 480, 0);
  for (const x of [4300, 4900, 5500]) F('chair', 'Yemek Sandalyesi', x, 1790, 450, 480, 180);
  F('cabinet', 'Büfe', 5300, 4415, 1600, 400, 180);
  F('plant', 'Büyük Bitki', 400, 4250, 700, 700);

  // Mutfak
  F('fridge', 'Buzdolabı', 6825, 350, 700, 700, 0);
  F('counter', 'Mutfak Tezgâhı', 6775, 1500, 1600, 600, 90);
  F('ovencol', 'Buharlı Fırın Boy Dolabı', 6775, 2600, 600, 600, 90);
  F('dishwasher', 'Bulaşık Makinesi', 7475, 300, 600, 600, 0);
  F('ksink', 'Evye', 8175, 225, 800, 450, 0);
  F('stove', 'Ocak', 8950, 225, 750, 450, 0);

  // Ebeveyn yatak odası
  F('bed', 'Çift Kişilik Yatak 1,8 m', 11240, 1000, 1800, 2000, 0);
  F('nightstand', 'Komodin', 10115, 200, 450, 400, 0);
  F('nightstand', 'Komodin', 12365, 200, 450, 400, 0);
  F('wardrobe', 'Gardırop', 11750, 3715, 2000, 600, 180);
  F('desk', 'Çalışma Masası', 12450, 2700, 1200, 600, 90);
  F('officechair', 'Ofis Koltuğu', 11835, 2700, 620, 620, 270);

  // Ebeveyn banyosu
  F('shower', 'Duşakabin', 12300, 4585, 900, 900);
  F('toilet', 'Klozet', 12400, 5500, 400, 700, 90);
  F('vanity', 'Banyo Dolabı', 12300, 6365, 800, 500, 180);
  F('cabinet', 'Depolama Dolabı', 11135, 4700, 1000, 400, 270);

  // Hol
  F('cabinet', 'Büfe', 5800, 4935, 1600, 400, 0);
  F('plant', 'Bitki', 10560, 5500, 500, 500);

  // Antre
  F('shoecab', 'Ayakkabılık', 11700, 6910, 1000, 350, 0);
  F('shoecab', 'Vestiyer Dolabı', 9965, 8000, 1400, 380, 270);
  F('plant', 'Bitki', 12500, 7100, 500, 500);

  // Banyo
  F('bathtub', 'Küvet', 800, 5110, 1600, 750, 0);
  F('toilet', 'Klozet', 350, 6900, 400, 700, 270);
  F('vanity', 'Banyo Dolabı', 250, 5925, 800, 500, 270);
  F('cabinet', 'Depolama Dolabı', 2415, 6200, 1000, 400, 90);

  // Çamaşır odası
  F('washer', 'Çamaşır Makinesi', 300, 9450, 600, 600, 180);
  F('dryer', 'Kurutma Makinesi', 900, 9450, 600, 600, 180);
  F('waterheater', 'Termosifon', 1600, 9525, 800, 450, 180);
  F('cabinet', 'Depolama Dolabı', 2415, 9000, 1000, 400, 90);

  // Yatak odası 2
  F('bed', 'Çift Kişilik Yatak 1,5 m', 3735, 7900, 1500, 2000, 270);
  F('nightstand', 'Komodin', 2935, 6925, 450, 400, 270);
  F('nightstand', 'Komodin', 2935, 8875, 450, 400, 270);
  F('wardrobe', 'Gardırop', 4200, 6435, 2000, 600, 0);
  F('desk', 'Çalışma Masası', 5915, 8300, 1200, 600, 90);
  F('chair', 'Sandalye', 5350, 8300, 450, 480, 270);

  // Yatak odası 3
  F('bed', 'Tek Kişilik Yatak', 8575, 8200, 1200, 2000, 90);
  F('nightstand', 'Komodin', 9375, 7375, 450, 400, 90);
  F('wardrobe', 'Gardırop', 6635, 8300, 2000, 600, 270);
  F('desk', 'Çalışma Masası', 8600, 6435, 1200, 600, 0);
  F('officechair', 'Ofis Koltuğu', 8600, 7050, 620, 620, 180);

  // Balkon
  F('sidetable', 'Yan Sehpa', 4030, -850, 500, 500);
  F('chair', 'Sandalye', 3530, -850, 450, 480, 270);
  F('barstool', 'Bar Taburesi', 4030, -1340, 420, 420);
  F('plant', 'Büyük Bitki', 300, -600, 700, 700);
  return out;
}

Object.assign(window, {
  WALLS, WINS, DOORS, SLIDES, ROOMS, MATS, LIB, NAMES_EN, DIMS, BOUNDS, ENTRY,
  OX, OY, H, defaultFurniture, typeColor, polyArea,
});
