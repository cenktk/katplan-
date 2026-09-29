# Yapım sözleşmesi (alt ajanlar için)

Hedef: `spec/SPEC.md`'de tarif edilen Çince uygulamanın **birebir** Türkçe yeniden yapımı. Görünüm, yerleşim, değerler, davranış, animasyon süreleri, kısayollar SPEC'teki gibi olacak. Farklar YALNIZCA: (1) arayüz Türkçe (varsayılan) + İngilizce (EN düğmesi; SPEC §14 İngilizce sütunu), (2) daire planı Türk 3+1 (bkz. `src/plan.js` geometrisi → `src/data.js`), (3) para birimi ₺, TR yerel ayarı. Orijinal koddan KOPYALAMA YOK (lisanssız); SPEC'ten kendi kodunu yaz. Orijinalin tutarsızlıkları (SPEC §17) korunur, SADECE şunlar düzeltilir: alt çubuk hover oda adı çevrilir; kilit açıkken gezinti dışında kısayollar çalışır.

## Dosyalar ve sahipleri (başkasının dosyasına YAZMA)
| Dosya | Sahip | İçerik |
|---|---|---|
| `src/data.js` | Ajan VERİ | klasik script; global sabitler: `WALLS, WINS, DOORS, SLIDES, ROOMS, MATS, LIB (kategoriler+öğeler), NAMES_EN (TR→EN ad sözlüğü: oda, malzeme, mobilya, kategori), DIMS (ölçü zincirleri), BOUNDS, ENTRY (giriş işareti), OX, OY, H, defaultFurniture() (F(...) listesi döndürür), typeColor(tip)` — SPEC §13, §5, §9.4, §9.5 biçiminde |
| `src/shell.html` | Ajan 2D | `<body>` içi statik işaretleme (header, aside.lib, main (svg#plan + 3D kapsayıcı + overlay'ler), aside.right, footer, toast, joystick DOM'u dahil) |
| `src/styles.css` | Ajan 2D | tüm CSS (3D overlay'leri, joystick, CSS2D etiket stili dahil — 3D ajanı gerekli sınıf adlarını SPEC'ten alır; eksik stil varsa `src/view3d.css`'e yazar) |
| `src/app.js` | Ajan 2D | klasik script: i18n (`tr(trMetin, enMetin)`, dil değişimi), `state/ui/view`, `renderAll`, 2D editör, kütüphane, sağ panel, geri al/yinele, kalıcılık, JSON/PNG(2D) dışa aktarma, kısayollar, çekmece/responsive, toast. 3D için SPEC §0'daki global fonksiyonları `window` üzerinde yayınlar (`select, closeDrawers, snapMove, getF, commit, renderAll, state, ui, view, …`) ve `window.View3D` varsa onu çağırır (yoksa 2D tek başına çalışmalı). |
| `src/models3d.js` | Ajan MODEL | `<script type="module">`: `import * as THREE from 'three'` + `RoundedBoxGeometry`; `window.Models3D = { buildFurniture(f, opts) → THREE.Group, materials..., dispose }` — SPEC §7 (tüm 45 tip), yerel eksen: arka −z, ön +z, taban y=0, ölçü f.w/f.d mm → m. Tohumlu rastgelelik §7. |
| `src/view3d.js` (+ gerekirse `src/view3d.css`) | Ajan 3D | `<script type="module">`: sahne, renderer, ışıklar, güneş, gece, mimari (WALLS/WINS/DOORS/SLIDES/ROOMS'tan), zemin dokuları, kamera pozları, 2D↔3D geçiş, odalar listesi, CSS2D etiketler, seçim/sürükleme, gezinti + joystick, 3D PNG, `window.View3D` API (SPEC'teki çağrılara göre). Mobilyayı `window.Models3D.buildFurniture` ile kurar (Models3D henüz yüklenmemişse bekler). |
| `build.py`, `index.html`, testler | Orkestra (ben) | birleştirme ve test |

## Birleştirme sırası (build.py)
`index.html` = `<!doctype html><html lang="tr"><head>` meta + `<title>Kat Planı Tasarımı</title>` + `<style>styles.css + view3d.css</style>` + importmap (`three` → `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`, `three/addons/` → `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/`) `</head><body>` + shell.html + `<script>data.js</script>` + `<script>app.js</script>` + `<script type="module">models3d.js</script>` + `<script type="module">view3d.js</script></body></html>`.

Yerel geliştirme: `python3 build.py` (henüz yoksa geçici olarak kendi birleştirme komutunu kullan, dosyaya yazma) → `python3 -m http.server` ile aç. jsDelivr bu ortamda proxy tarafından 403; Playwright'ta `https://cdn.jsdelivr.net/npm/three@0.160.0/**` isteklerini `THREE_DIR=/tmp/claude-0/-home-user-airtable-dashboard/05d84c35-6486-527f-a8e3-900ef6468b02/scratchpad/three/package/` altından servis et (örnek: `tools/orijinal-shots.js`). Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, argümanlar `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox`. `playwright install` ÇALIŞTIRMA.

## Ortak kurallar
- Kod yorumları Türkçe, kısa. Framework yok.
- Veri adları Türkçe saklanır (`f.name` Türkçe); İngilizce gösterimde `NAMES_EN[ad] || ad`.
- `localStorage` anahtarları: SPEC §12.1'deki anahtarların `kp-` önekli karşılıkları (ör. `kp-plan-v1`, `kp-lang`); her erişim try/catch.
- Orijinal ekran görüntüleri: `spec/shots/`. Kendi karşılaştırma görüntülerini `temp/` altına koy (git dışı), kalıcı olarak `shots-yeni/` altına yalnızca istenirse.
- Commit/push YAPMA.
