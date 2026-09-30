# Kat Planı Dekorasyon Tasarımı — Birebir Yeniden Yapım Spesifikasyonu

Kaynak uygulama: tek dosyalık web uygulaması (Çince "户型装修设计" = "Kat planı dekorasyon tasarımı"), 2664 satır, ~183 KB. Bu belge **kod içermez**; yalnızca görünümü, yerleşimi, değerleri ve davranışı tarif eder. Yeniden yazan ekip bu belgeyi tek referans olarak kullanır. Sayısal değerlerin tamamı orijinal kaynaktan okunmuş ve 1440×900, 1024×768, 390×844 pencerelerinde Chromium ile ölçülmüştür (bkz. `shots/`).

> Okuma notu: "piksel" CSS pikselidir. "mm" plan birimidir (SVG kullanıcı birimi = 1 mm). "m" 3D dünya birimidir (1 birim = 1 m = 1000 mm). Renkler hex olarak verilmiştir. "Özgün" = incelenen Çince uygulama. "Yeni" = yeniden yazılacak Türkçe uygulama.

---

## 0. Teknik özet ve mimari

| Konu | Değer |
|---|---|
| Dosya yapısı | Tek HTML; bir klasik `<script>` (2D editör, durum, panel, i18n) + bir `<script type="module">` (3D sahne). 3D modül, klasik betiğin global fonksiyonlarını (`select`, `closeDrawers`, `snapMove`, `getF`, `commit`, `renderAll`, `state`, `ui`, `view`, `ROOMS`, `WALLS`, `DOORS`, `SLIDES`, `WINS` vb.) `window` üzerinden kullanır; klasik betik de `window.View3D` nesnesini kullanır. |
| 3D kütüphane | three.js r160 (jsDelivr CDN, importmap ile `three` ve `three/addons/`). Kullanılan eklentiler: `OrbitControls`, `PointerLockControls`, `RoundedBoxGeometry`, `RoomEnvironment`, `CSS2DRenderer/CSS2DObject`. |
| 2D çizim | Tek `<svg id="plan">`, kullanıcı birimi = mm; `viewBox` her zoom/pan'de yeniden yazılır. Tüm çizgiler `vector-effect: non-scaling-stroke` (çizgi kalınlığı zoom'dan bağımsız 1 px). |
| Durum | `state = {furniture[], rooms{}, demolished[], measures[]}`; `ui` (araç, seçim, katman bayrakları) ayrı; `view = {x0,y0,s}` (sol-üst mm koordinatı ve piksel/mm ölçeği). |
| Render modeli | "Tümünü yeniden çiz": her değişiklikte `renderAll()` (grid, odalar, mobilya, duvarlar, etiketler, ölçüler, seçim, panel, başlık). Sürükleme sırasında yalnız mobilya + seçim katmanı çizilir. 3D, imza (JSON) karşılaştırmasıyla yalnız değişen grubu (mimari / mobilya / etiket) yeniden kurar. |
| Kalıcılık | `localStorage` (bkz. §12). Geri al yığını bellekte, 150 adım. |
| Dil | Varsayılan Çince; EN düğmesiyle İngilizce; tercih `localStorage`'da. Yeni uygulamada TR (varsayılan) + EN önerilir. |
| CDN durumu | Özgün dosya three.js'i jsDelivr'den ister. Bu ortamda jsDelivr'e erişim proxy tarafından **403** ile engelli olduğundan ekran görüntüleri için `three@0.160.0` npm paketi indirilip Playwright istek yönlendirmesiyle CDN adresine servis edildi (özgün dosya değiştirilmedi). Ayrıntı §17. |

---

## 1. Genel yerleşim

### 1.1 Iskelet (CSS Grid)

`.app` tam ekran bir grid'dir: `height: 100vh` (ardından `100dvh`), güvenli alan (`env(safe-area-inset-*)`) iç boşluğu, metin seçimi kapalı (`user-select:none`; yalnız `input`'ta açık), `touch-callout:none`. `html, body`: `overflow:hidden`, `overscroll-behavior:none`, `touch-action:manipulation`, `-webkit-tap-highlight-color: transparent`.

- **Satırlar:** `auto` (üst bar) / `minmax(0,1fr)` (gövde) / `30px` (alt durum çubuğu).
- **Sütunlar (geniş, > 1100 px):** `236px` (sol kitaplık) / `minmax(0,1fr)` (tuval) / `300px` (sağ panel).
- Üst bar ve alt çubuk tüm sütunları kaplar (`grid-column: 1 / -1`).

Ölçülen değerler (1440×900, 2D, varsayılan):

| Eleman | x, y | Genişlik × Yükseklik |
|---|---|---|
| Üst bar (`header`) | 0, 0 | 1440 × **96** (iki satıra sarılmış) |
| Sol kitaplık (`aside.lib`) | 0, 96 | **236** × 774 |
| Tuval (`main`) | 236, 96 | **904** × 774 |
| Sağ panel (`aside.right`) | 1140, 96 | **300** × 774 |
| Alt çubuk (`footer`) | 0, 870 | 1440 × **30** |
| Marka bloğu | 153, 10 | 302 × 34 |
| 2D/3D segment anahtarı | 473, 8 | 174 × 38 |
| Araçlar grubu (Seç/Ölç/Yık) | 657, 9 | 168 × 36 |
| Katman grubu (2. satır) | 14, 52 | 319 × 36 |
| EN düğmesi | 1243, 54 | 38 × 32 |
| Tam ekran düğmesi | 1291, 54 | 63 × 32 |
| Dosya menüsü özeti | 1364, 53 | 62 × 34 |
| Ölçek çubuğu | 250, 817 | 132 × 41 |
| Kitaplık öğesi kartı | 10, 132 | 105 × 99 |
| Yüzen çubuk (fab) — mobilya seçiliyken | 531, 810 | 315 × 43,5 |

Üst bar yüksekliği içeriğe bağlıdır (`flex-wrap: wrap`); 1440'ta 2D için iki satır (96 px), 1024'te de 96 px, 390 px mobilde 382 px'e çıkar.

### 1.2 Tipografi

- Gövde: `font: 13px/1.5` ; aile yığını: `-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`. (Yeni uygulamada Latin/Türkçe için aynı sistem yığını + `"Segoe UI", Roboto, "Helvetica Neue", Arial` önerilir; ı, İ, ş, ğ, ç, ö, ü glifleri sistem fontunda bulunmalı.)
- Dokunmatik (`pointer:coarse`) cihazlarda gövde `14px`.
- Marka başlığı `b`: 15 px, letter-spacing .5 px, kalın; alt başlık `span`: 12 px, `--muted`. Marka bloğu dikey flex, satır yüksekliği 1,25, sağ boşluk 8 px.
- Sol kitaplık kategori başlığı `h4`: 12 px, `--muted`, ağırlık 600, letter-spacing 1 px, padding `12px 14px 6px`, `position:sticky; top:0; z-index:1; background: var(--panel)`.
- Kitaplık öğesi ad `b`: 12 px / 500; boyut `small`: 11 px `--muted`.
- Sağ panel: `h3` 13 px; `h3 small` `--muted` 400, sol boşluk 6 px; tablolar 13 px, rakamlar `tabular-nums`; büyük sayı `.big` 22 px / 600; `.stats small` 11 px.
- `kbd`: 11 px `ui-monospace, Menlo, monospace`, arka plan `#f2ece2`, kenarlık 1 px `--line` (alt kenar 2 px), radius 4, padding `0 5px`, renk `--ink`.
- SVG içi metin: `-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif` (font boyutları mm cinsinden, bkz. §4).

### 1.3 Genel bileşenler

**Grup (`.grp`)**: üst barda düğme kapsayıcısı. `display:flex; align-items:center; gap:2px; padding:2px; border:1px solid var(--line); border-radius:8px; background:#fff`.

**Düğme (`.btn`)**: kenarlıksız, saydam arka plan, `padding:5px 9px`, `border-radius:6px`, `cursor:pointer`, `white-space:nowrap`; ölçülen yükseklik 30 px (ör. "Geri Al" 44×30).
- `:hover` → arka plan `#f2ece2`.
- `.on` → arka plan `--ink` (#2b2824), metin beyaz (araç ve mod seçimi).
- `.chip.on` → arka plan `--accent-soft` (#f3e3d8), metin `--accent` (#b5653a) (katman/aç-kapa düğmeleri, kitaplık/panel düğmeleri).
- `.primary` → arka plan `--accent`, metin beyaz; hover `#9f5530` (yalnız "Gezintiden çık").
- `.danger` → metin `#b3372a` (Temizle, Sıfırla).
- Geri Al / Yinele "devre dışı": gerçek `disabled` özelliği + satır içi `opacity:.4`; ayrı bir cursor stili yok.
- Sistem font-boyutu `inherit`.

**Segment anahtarı (`.seg`)** (2D/3D): `.grp` + `padding:3px`. İki düğme, her biri **82 px** genişliğinde (dokunmatikte 92 px). Arkasında `pill`: `position:absolute; left:3px; top:3px; bottom:3px; width:82px; border-radius:6px; background:--accent; box-shadow:0 2px 6px rgba(181,101,58,.35); transition: transform .5s cubic-bezier(.65,0,.35,1)`. 3D modunda pill `translateX(84px)` (dokunmatik: 94 px). Düğme metni geçişte 0,45 s renk animasyonu: aktif olan beyaz, pasif `--ink`. Hover arka planı saydam. Geçiş sürerken (`body.busy`) anahtar `pointer-events:none`.

**Açılır menü (`details.menu`)**: özet `summary.btn`: kenarlık 1 px `--line`, beyaz, radius 8, padding `6px 12px`, ok işareti gizli (metinde "▾" var). Açılır kutu `.menu-pop`: `position:absolute; right:0; top:calc(100% + 6px); min-width:150px; background:#fff; border:1px solid --line; border-radius:10px; padding:4px; box-shadow:0 10px 30px rgba(40,30,20,.14); z-index:20; animation: fadeIn .2s`. İçindeki düğmeler sola hizalı dikey liste. Bir öğe tıklanınca menü kapanır; menü dışına `pointerdown` ve tuvale `pointerdown` menüyü kapatır.

**Aralık (`.range`)**: `display:flex; gap:6px; padding:0 8px; color:--muted; font-size:12px`; kaydırıcı genişliği satır içi 84 px (dokunmatik 120 px), `accent-color: --accent`; sağdaki saat metni `--ink`, `tabular-nums`.

**Toast (`#toast`)**: `position:fixed; left:50%; bottom:110px; transform: translateX(-50%) translateY(20px)`; arka plan `--ink`, beyaz metin, padding `8px 16px`, radius 8, `z-index:10`, `transition:.25s`, `.show` → opaklık 1 + `translateX(-50%)`. Görünme süresi **1800 ms**; yeni toast öncekinin zamanlayıcısını sıfırlar.

**Mod ipucu hapı (`#modehint`)**: tuvalin üst-ortası, `top:12px`, `left:50%`; arka plan `--ink`, beyaz, padding `5px 12px`, radius 20, 12 px; `opacity:0 → .9` (0,2 s geçiş); yalnız Ölç ve Yık araçlarında görünür (Seç'te boş metin, gizli). Uzun metinde satır kırar (bkz. `shots/03`).

**Ölçek çubuğu (`#scalebar`)**: tuvalin sol-alt `left:14px; bottom:12px`; arka plan `rgba(255,253,249,.92)`, kenarlık 1 px `--line`, radius 8, padding `6px 10px`, 12 px, `pointer-events:none`. İçinde metin ("2 m", "500 mm" …) ve altında 6 px yüksekliğinde çubuk (`border:1.5px solid --ink; border-top:0; margin-top:3px`). Çubuk genişliği = `nice × s` piksel; `nice` değeri `[100, 200, 500, 1000, 2000, 5000]` mm listesinden `nice × s ≥ 60 px` olan **ilk** değerdir (yoksa 5000). ≥1000 ise "N m", değilse "N mm". 3D'de opaklığı 0'a iner (0,3 s).

**Alt durum çubuğu (`footer`)**: 30 px, `display:flex; gap:18px; align-items:center; padding:0 14px; background:--panel; border-top:1px solid --line; color:--muted; font-size:12px; tabular-nums; overflow:hidden; white-space:nowrap`. Sıra: `X <b>…mm</b>` · `Y <b>…mm</b>` · `Geçerli ölçek <b>1:69</b>` · (fare bir odanın üstündeyse) `<b>Oda adı</b> alan m²` · esnek boşluk · sağda ipucu metni `#tip` (taşarsa "…" ile kesilir). `b` rengi `--ink`, ağırlık 500. X/Y başlangıçta "—". Bu üç 2D-özel öğe ve hover metni 3D'de gizlidir.

### 1.4 Sol kitaplık (`aside.lib`)

- Arka plan `--panel`, sağ kenar 1 px `--line`, dikey kaydırma. İçerik iki bölüm: önce `#lib3d` (yalnız 3D modunda; bkz. §6.10), sonra `#lib` (her iki modda görünür; 3D'de de mobilya sürükle-bırak çalışır).
- Kategori başlığı (sticky) + **2 sütunlu** ızgara (`gap:6px; padding:0 10px 6px`); ≤1100 px'te **3 sütun**.
- Öğe kartı (`.item`): dikey flex, içerik ortalı, `gap:2px`, `padding:8px 4px 6px`, kenarlık 1 px `--line`, radius 8, beyaz, `cursor:grab`, `touch-action:pan-y`, `transition: border-color .15s, transform .15s`. Boyut ölçümü: 105×99 px. İçerik: 56×44 px SVG önizleme (gerçek 2D sembolü), ad, "G×D" mm metni.
- `:hover` (yalnız `hover:hover` cihazlarda): kenarlık `--accent`, `translateY(-1px)`.
- Sürüklenirken kart `dragging`: kenarlık `--accent`, opaklık .5.
- En altta ipucu (`.hint`): `padding:10px 14px 16px`, `--muted`, 12 px (metin §14 tablosunda).
- Önizleme SVG: `viewBox` = mobilya ayak izi + her yönde `max(w,d)×0,08` dolgu; sembol §5.2'deki 2D çizimdir, kalınlık 1 px.
- Sürüklenen hayalet (`#ghost`): `position:fixed; z-index:30; pointer-events:none; opacity:.8; transform:translate(-50%,-50%); filter:drop-shadow(0 4px 10px rgba(40,30,20,.3))`; boyutu düşüş noktasındaki gerçek ölçeğe göre `w×s`, `d×s` piksel (en az 28×20). 3D'de perspektife göre yakın büyük / uzak küçük.

### 1.5 Sağ panel (`aside.right > #panel`)

Arka plan `--panel`, sol kenar 1 px `--line`, dikey kaydırma. Her `section`: `padding:12px 16px; border-bottom:1px solid --line`. İçerik seçime göre değişir (Genel bakış / Oda / Mobilya, bkz. §9).

### 1.6 Tuval (`main`)

`position:relative; overflow:hidden; background: --paper (#f7f4ee)`. Katmanlar (alttan üste): `svg#plan` (%100×%100), `#view3d` (mutlak, `inset:0`, başlangıçta gizli), `#scalebar`, `#modehint`, `#fab`. 2D→3D geçişinde `#plan` opaklığı 0 (0,45 s), `#view3d` opaklığı 1 (0,45 s).

**Yüzen çubuk `#fab`**: mobilya veya oda seçilince tuvalin alt-ortasında görünür. `position:absolute; left:50%; bottom:16px; transform: translate(-50%,12px)` → görünürken `translate(-50%,0)`; `display:flex; gap:4px; align-items:center; padding:5px; background:rgba(255,253,249,.97); border:1px solid --line; border-radius:14px; box-shadow:0 8px 26px rgba(40,30,20,.16); z-index:4; max-width: calc(100% - 24px)`; opaklık/transform 0,2 s. Düğmelerin kenarlığı saydam; `.name` (kalın 600, en çok `9em`, taşarsa "…"); `.sep` 1 px dikey ayırıcı. İçerik: mobilya için `[Ad] [↺] [↻ Döndür] [Kopyala] [Sil] | [Özellikler(yalnız dar)] [Bitti]`; oda için `[Ad] [Zemin / Özellikler (yalnız dar)] [Bitti]`. "Özellikler" panelini açan çekmece açıkken (`main.drawer-panel`) fab gizlenir.

### 1.7 Duyarlılık (responsive) davranışı

Kesme noktaları: `max-width:1100px` (dar), `min-width:1101px` (geniş), `pointer:coarse` (dokunmatik), `hover:hover`.

**Geniş (≥1101):**
- Sol/sağ paneller yerinde durur; `[` ve `]` tuşları veya üst bardaki "◧ Mobilya" / "Özellikler ◨" düğmeleri panelleri **daraltır/açar**: `grid-template-columns` `236px|0` ve `300px|0` arasında geçiş yapar (`transition: grid-template-columns .3s cubic-bezier(.3,.7,.3,1)`). Kapalı panelde `overflow:hidden; border:0`. İçerik daralırken ezilmesin diye `aside.lib>div{min-width:220px}`, `#panel{min-width:284px}`.
- Seçim `localStorage['huxing-panes']` içine `{hideLib, hidePanel}` olarak yazılır ve yüklemede geri gelir.
- Düğme durumu: panel görünürse düğme `chip.on` (vurgulu); tooltip "Gizle/Göster (…)" olarak değişir.

**Dar (≤1100):**
- Tek sütunlu grid; `main`, `aside.lib`, `aside.right` üçü de `grid-row:2; grid-column:1` (üst üste). Paneller **çekmece**dir: `position:relative; z-index:6; width:min(320px, 86vw)`; sol çekmece `justify-self:start; transform:translateX(-110%)`, sağ çekmece `justify-self:end; transform:translateX(110%)`; `.open` → `transform:none; box-shadow:0 0 30px rgba(40,30,20,.18)`; geçiş 0,3 s aynı eğri.
- Aynı anda yalnız bir çekmece açık. Kapanma tetikleyicileri: tuvale (2D veya 3D) `pointerdown`; kitaplıktan öğe ekleme (dokunma); kitaplıktan sürükleyip çekmecenin sağ kenarını geçmek; fab'daki "Bitti"; medya sorgusu değişimi (`change` → hepsi kapanır).
- Kitaplık ızgarası 3 sütun. Marka alt başlığı gizlenir; alt çubuktaki 2D-özel öğeler (X, Y, ölçek, hover) gizlenir, yalnız ipucu kalır.
- Mobil (390×844, dokunmatik): üst bar 3–5 satıra sarılarak **382 px** yüksekliğe çıkar (tuval 432 px kalır); alt çubuk 30 px. Bu, özgün davranıştır (bkz. `shots/14`). Çekmeceler 320 px genişliğinde (390 px'te 86vw = 335 → 320 sınırı).

**Dokunmatik (`pointer:coarse`) ayarları:** gövde 14 px; `header` padding `8px 12px` gap 8; `.grp` padding 3 radius 10; `.btn` padding `8px 12px`, `min-height:38px`, radius 8; segment düğmeleri 92 px; menü özeti padding `9px 14px`; menü öğeleri padding `11px 14px`; kitaplık kartı padding `10px 4px 8px`; form girdileri 16 px yazı (iOS yakınlaştırmasını engellemek için) padding `8px 9px`, renk girdisi 40 px; eylem/fab düğmeleri `min-height:42px; padding:9px 14px`; tablo hücresi padding `7px 2px`; oda listesi düğmeleri `8px 10px`; malzeme kartı `9px 8px`; kaydırıcı 120 px. Sürükleme eşiği **9 px** (fare: 4 px). Seçim tutamaçları büyür (bkz. §4.9).

---

## 2. CSS değişkenleri ve renk paleti

`:root` değişkenleri:

| Değişken | Hex | Kullanım |
|---|---|---|
| `--bg` | `#f3efe7` | Sayfa (html/body) arka planı |
| `--paper` | `#f7f4ee` | Tuval (2D) arka planı, PNG dışa aktarma zemini, 3D arka plan (gündüz) |
| `--panel` | `#fffdf9` | Üst bar, yan paneller, alt çubuk, kartlar |
| `--line` | `#e3dccf` | Tüm kenarlıklar/ayırıcılar |
| `--ink` | `#2b2824` | Ana metin, aktif düğme, toast |
| `--muted` | `#8a8174` | İkincil metin |
| `--accent` | `#b5653a` | Vurgu (terrakota) |
| `--accent-soft` | `#f3e3d8` | Vurgu arka planı (chip.on, seçili malzeme halkası, seçili oda düğmesi) |
| `--teal` | `#2f5d62` | Tanımlı ama CSS'te kullanılmıyor; JS'te geçici ölçü çizgisi ve nokta rengi olarak `#2f5d62` |

`meta theme-color`: `#fffdf9`.

Değişken dışı, sık kullanılan sabit renkler:

| Hex | Nerede |
|---|---|
| `#ffffff` | `.grp`, girdi, kart arka planı |
| `#f2ece2` | Düğme hover, `kbd` arka planı, oda listesi hover |
| `#faf5ee` | Tablo satırı hover |
| `#faf6ef` | İstatistik kutusu arka planı |
| `#eee6d9` | Tablo hücresi kesikli alt çizgi |
| `#9f5530` | `.primary` hover |
| `#b3372a` | `.danger` metni |
| `rgba(30,28,25,.35)` | Gezinti başlangıç kaplaması |
| `rgba(43,40,36,.82)` | 3D ipucu hapı |
| `#d9894f` | Yık aracında duvar hover dolgusu |
| `rgba(255,253,249,.9)` | 3D oda etiketi arka planı |

Duvar / plan renkleri (2D):

| Öğe | Renk |
|---|---|
| Taşıyıcı duvar (`b`) | `#26241f` (Taşıyıcı katmanı açıkken `#b8412c`) |
| Dış duvar (`e`) | `#8f897d` |
| Yıkılabilir duvar (`n`) | `#a7a195` |
| Alçak duvar (`low`) | dolgu `#e9e3d8`, çizgi `#8f897d` 1 px |
| Yıkılmış duvar | dolgu `rgba(198,91,58,.12)`, çizgi `#c65b3a` 1,2 px kesik `5 3` |
| Pencere | dolgu `#f7fbfd`, çizgi `#4f7394` |
| Kapı gövdesi/yayı | çizgi `#3d3a34`; giriş kapısı `#b5653a` 1,8 px |
| Eşik dikdörtgeni | dolgu `#e2dacb`, çizgi `#b9b0a0` |
| Ölçü çizgileri (boyutlandırma) | `#7d7160` |
| Oda adı | `#2b2824`; alan `#7d7366`; halo `#fbf9f4` |
| Mobilya çizgisi | `#3d3a34` 1 px; mobilya etiketi `#4a443c` opak .8 |
| Seçim / tutamaç | `#b5653a` |
| Ölçü aracı | kalıcı `#b5653a`, geçici `#2f5d62` |
| Grid | ince `#e5dfd3`, kalın `#d8d0c1` |

Zemin malzemesi örnek renkleri (`MATS[].sw`): bkz. §9.4 tablosu. 3D sahne renkleri §6.

---

## 3. Üst bar (header) — tüm düğmeler, sıra ve etiketler

Üst bar bir `flex-wrap` konteynerdir: `display:flex; flex-wrap:wrap; align-items:center; gap:6px 10px; padding:8px 14px; background:--panel; border-bottom:1px solid --line`. Elemanlar DOM sırasıyla (mod = hangi modda görünür; "2D-özel" `only2d`, "3D-özel" `only3d`; mod değişince ilgili gruplar `display:none` ↔ görünür, görünenler `fadeIn .45s` (opaklık 0→1 ve `translateY(-4px)→0`) ile belirir):

| # | Grup | Mod | Öğeler (Çince → EN → önerilen TR) | Notlar |
|---|---|---|---|---|
| 1 | `#paneBtns` (`.grp`) | her ikisi | `◧ 家具库` → `◧ Library` → **◧ Mobilya**; `属性 ◨` → `Properties ◨` → **Özellikler ◨** | İkisi de `.btn.chip`; panel görünürse `.on`. Tooltip: "Mobilya kitaplığını gizle/göster ( [ )", "Özellik panelini gizle/göster ( ] )". |
| 2 | Marka (`.brand`) | her ikisi | Başlık `三室两厅两卫 · 装修设计` → `3BR 2LR 2BA · Interior Design` → **3+1 Daire · Dekorasyon Tasarımı**; alt başlık (dinamik, mm/alan) | Alt başlık: "Net kullanım alanı ≈ 87,18 m² · Birim: mm · Özgün plan ölçeği 1:60" (Çince: "套内使用面积约 … · 尺寸单位 mm · 原图比例 1:60"). ≤1100 px'te alt başlık gizli. |
| 3 | `#viewSeg` (`.grp.seg`) | her ikisi | `2D 平面` / `3D 场景` → `2D Plan` / `3D Scene` → **2D Plan** / **3D Sahne** | Tooltip "切换 2D / 3D (T)". Kayan turuncu hap (bkz. §1.3). |
| 4 | `#tools` | 2D | `选择` (Seç, `V`, varsayılan `.on`), `测量` (Ölç, `M`), `拆改墙体` (Duvar Yık, `X`) | Tek seçimli (`.on` = koyu). Tooltip'ler: "选择 / 移动 (V)", "测量 (M)", "拆改非承重墙 (X)". |
| 5 | Zoom grubu | 2D | `−` (Uzaklaştır), `＋` (Yakınlaştır), `适应` (Sığdır, `F`), `1:60`, `1:100` | `−` U+2212, `＋` tam genişlikli artı U+FF0B. 1:60 → toast "1:60 gösteriliyor…"; 1:100 sessiz. |
| 6 | `#modes3d` | 3D | `鸟瞰` Orbit (Kuşbakışı, varsayılan `.on`), `漫游` Walk (Gezinti) | Tek seçimli. |
| 7 | Kamera grubu | 3D | `斜视` (Eğik/İzometrik), `俯视` (Üstten) | Kamerayı hazır pozlara uçurur (§6.7). |
| 8 | Geçmiş grubu | her ikisi | `撤销` (Geri Al), `重做` (Yinele), `清空布置` (Yerleşimi Temizle, `.danger`) | Geri Al/Yinele yığın boşken opaklık .4. Tooltip "撤销 (Ctrl+Z)", "重做 (Ctrl+Shift+Z)". |
| 9 | `#layers` | 2D | Hepsi `.btn.chip`: `尺寸` (Ölçü, açık), `房间` (Odalar, açık), `家具` (Mobilya, açık), `网格` (Izgara, kapalı), `承重墙` (Taşıyıcı duvar, kapalı), `贴墙吸附` (Duvara yapış, açık) | Katman durumu oturumlar arasında saklanmaz. |
| 10 | Kesit grubu | 3D | `全高墙` Full walls (**Tam duvar**, açık, `data-cut=2.8`), `剖切墙` Cut walls (**Kesik duvar**, `data-cut=1.2`) | Tek seçimli chip. |
| 11 | `#toggles3d` | 3D | `家具` (Mobilya, açık), `房间名` Labels (Oda adları, açık), `夜景` Night (Gece, kapalı) | Bağımsız aç/kapa chip'leri. |
| 12 | Güneş grubu | 3D | Etiket `日照` (Güneş) + aralık kaydırıcı (min 7, max 18, step 0,25, varsayılan 10) + saat metni "10:00" | Kaydırıcı 84 px. |
| — | `.spacer` | | `flex:1`, kalan boşluğu emer; sonraki üç öğe sağa yaslanır | |
| 13 | `#langBtn` | her ikisi | Metin: Çince modda `EN`, İngilizce modda `中文` → Yeni: TR modda `EN`, EN modda `TR` | Kenarlık 1 px `--line`, beyaz. Tooltip "Switch language / 切换语言". |
| 14 | `#fullscreen` | her ikisi | `⛶ 全屏` → `⛶ Fullscreen` → **⛶ Tam ekran** (tam ekranda "⛶ Tam ekrandan çık") | Tooltip "Tam ekran (Shift+F)". PWA/standalone modda gizlenir. Tam ekran API yoksa toast. |
| 15 | `details.menu` "文件 ▾" | her ikisi | `导出图片` (Görüntüyü dışa aktar), `导出方案 JSON` (Planı JSON olarak dışa aktar), `导入方案` (Planı içe aktar), `重置为默认方案` (`.danger`, Varsayılan plana sıfırla) | Gizli `input[type=file]` (`.json`) içe aktarma için. |

Not: "家具" adı iki farklı yerde (2D katman anahtarı ve 3D göster/gizle) aynı etiketle bulunur; iki ayrı durumdur (2D: `ui.layers.furn`, 3D: `opt.furn`).

Ekran ölçüleri 1440 px 2D: 1. satırda paneller, marka, segment, araçlar, zoom, geçmiş; 2. satırda katmanlar ve sağda EN / Tam ekran / Dosya. 3D'de 1. satır: paneller, marka, segment, modlar, kamera, geçmiş, kesit, toggles; 2. satır: güneş grubu + sağ üçlü (bkz. `shots/07`).

---

## 4. 2D editör

### 4.1 SVG yapısı ve katman sırası

`<svg id="plan">` tuvalin tamamını kaplar (`display:block`, `touch-action:none`). Çocuk `<g>` grupları **alttan üste** şu sırada durur (bu sıra kritiktir: mobilya duvarların ALTINDA, etiketler ve ölçüler en üstte çizilir):

| # | Grup | İçerik | Pointer olayı |
|---|---|---|---|
| 0 | `<defs>` | Desen (pattern) tanımları: zemin malzemeleri + grid | — |
| 1 | `gGrid` | Tek dev dikdörtgen (−20000,−20000, 55000×55000). Grid kapalıyken `fill: transparent` (arka plan tıklamaları için kalır), açıkken `url(#grid)` | evet |
| 2 | `gRooms` | Oda çokgenleri (`class="room"`, zemin deseniyle dolu) + kapı/sürgülü kapı eşik dikdörtgenleri | oda tıklanır |
| 3 | `gFurn` | Mobilya (`g.furn`), dizideki sıraya göre (sonraki üstte). Katman kapalıysa `display:none` | evet |
| 4 | `gWalls` | Tüm duvar dikdörtgenleri (`class="wall"`) | **hayır** (`pointer-events:none`); yalnız Yık aracında `all` |
| 5 | `gOpen` | Pencereler, kapı yaprağı+yay, sürgülü kapılar, "Giriş" oku ve yazısı | — |
| 6 | `gLabels` | Oda adı + alan yazıları (`pointer-events:none`); katman kapalıysa gizli | hayır |
| 7 | `gDims` | Ölçü zincirleri; katman kapalıysa gizli | hayır |
| 8 | `gMeasure` | Ölçü aracı çizgileri | hayır |
| 9 | `gSel` | Seçim kutusu, tutamaçlar, boyut yazısı; oda seçiminde oda vurgusu | tutamaçlar evet |

Yeniden çizim sırası `renderAll`: grid → odalar → mobilya → duvarlar → etiketler → ölçü çizgileri (measure) → seçim → sağ panel → başlık; 3D etkinse senkron. (Ölçü zincirleri `renderDims` yalnız başlangıçta ve dil değişiminde çizilir; kapı/pencere `renderOpenings` başlangıçta ve dil değişiminde çizilir; her ikisi de veri sabit olduğu için.)

Koordinat sistemi: kaynak = sol-üst iç köşe; +x sağa, +y **aşağı**; mm. Dış duvarlar negatif koordinatlara taşabilir (üst duvar y = −240…0).

### 4.2 Ölçek, görünüm ve zoom

- `view = {x0, y0, s}`: `viewBox = "x0 y0 W/s H/s"`; `s` = piksel/mm. `PX_MM = 25.4 / 96 = 0,26458` mm (1 CSS px). Gösterilen oran: `"1:" + round(1 / (s × PX_MM))`. 1:60 → `s = 1/(60×0,26458) ≈ 0,06299`; 1:100 → `s ≈ 0,0378`. (96 dpi ekranda 1:60 fiziksel ölçüye denk gelir.)
- Başlangıç ve "Sığdır": `BOUNDS = {x:−1850, y:−1750, w:15600, h:14100}` mm; `s = min(W/15600, H/14100)`; görünüm bu dikdörtgeni ortalar. (Yeni planda dış ölçü zincirleri dahil sınır kutusu + kenar boşluğu hesaplanmalı; toplam plan + ölçü zincirleri sığmalı.) 1440×900'de ölçek ≈ 1:69.
- Zoom sınırı: `s ∈ [0,012 ; 2]`.
- Fare tekerleği: `s' = s × exp(−deltaY × k)`, `k = 0,0015` (Ctrl basılıyken / pinch-touchpad `0,01`), imleç altındaki nokta sabit kalır. `preventDefault` (passive:false).
- Düğmeler/klavye: `＋`/`+`/`=` → ×1,25; `−`/`-` → ×0,8 (merkez sabit); `1:60`, `1:100` merkez sabit; `F` / Sığdır → bounds'a sığdır.
- Pencere/panel boyutu değişince (ResizeObserver): genişlik 0'dan geliyorsa (ilk yerleşim) Sığdır; aksi halde görünüm merkezi sabit kalacak şekilde `x0,y0` kaydırılır (ölçek değişmez).
- Pan: boşluğa veya odaya basıp sürükle (bkz. §4.10). **Orta ve sağ fare tuşu ile pan yok** (`pointerdown` bunları yok sayar).
- Dokunmatik: tek parmak sürükleme = pan (boşlukta); iki parmak = pinch-zoom + pan (parmakların orta noktası sabit kalır, ölçek = başlangıç × mesafe oranı, aynı `[0,012; 2]` sınırı); ikinci parmak inince devam eden tek parmak eylemi (ölçü/pan) iptal olur; iki parmaktan biri kalkınca kalan parmak eylem başlatmaz. Safari `gesturestart/change/end` olayları engellenir.

### 4.3 Birim, ızgara ve yapışma değerleri

- Tüm veri **mm**, tamsayıya yuvarlanmış. Konum ızgarası **10 mm** (`Math.round(v/10)*10`) — hem mobilya taşırken hem ölçü aracında.
- Görsel grid (katman `Izgara`): 1000×1000 mm'lik `pattern`; 500 mm'de ince çizgiler (`#e5dfd3`, kalınlık 8 mm), 1000 mm'de kalın çizgiler (`#d8d0c1`, 14 mm). Yani 0,5 m ince, 1 m kalın ızgara. Desen `userSpaceOnUse` olduğundan zoom ile birlikte ölçeklenir.
- **Duvara yapışma (mobilya, `snapMove`)**: eşik `10 / s` mm (yani ekranda **10 piksel**). Yapışma hedefleri = yıkılmamış tüm duvar dikdörtgenleri + tüm pencere dikdörtgenleri. Mobilyanın döndürülmüş sınır kutusu yarı boyutları `hw, hh` hesaplanır (`hw = w/2|cos| + d/2|sin|`, `hh = w/2|sin| + d/2|cos|`). Her hedef dikdörtgen için: mobilyanın dikey aralığı hedefin dikey aralığıyla (eşik payıyla) örtüşüyorsa, x için aday konumlar `hedefKenarX ± hw` (yani mobilyanın sol/sağ kenarı hedefin sol veya sağ kenarına değecek şekilde) denenir; benzer şekilde yatay örtüşme varsa y için `hedefKenarY ± hh`. Eşik içindeki **en yakın** aday, eksen başına ayrı ayrı seçilir; yoksa 10 mm ızgaraya yuvarlanan değer kullanılır. Katman `Duvara yapış` kapalıysa yalnız ızgara.
- **Ölçü aracı yapışması (`snapPoint`)**: 10 mm ızgara + hedef dikdörtgenlerin herhangi bir kenar x'ine / y'sine **8 piksel** (`8/s` mm) eşik, eksen başına bağımsız. **Shift**: ilk noktaya göre |Δx| > |Δy| ise y ilk noktaya kilitlenir, değilse x kilitlenir (yatay/dikey kilit).
- **İtme (`pushOut`)**: kitaplıktan yeni eklenen mobilya bir duvar/pencere ile çakışıyorsa, en az nüfuz eden eksende duvarın dışına itilir (en çok 4 tur). Böylece duvara "tam bitişik" yerleşir. Sonra 10 mm ızgaraya alınmış konum kullanılır (ekleme anında `Math.round(v/10)*10`, itme ızgaraya tekrar yuvarlanmaz).
- Sürükleme eşiği (tıklama ile sürüklemeyi ayıran): fare **4 px**, dokunmatik **9 px**. Eşik aşılmadan mobilya "titremez".

### 4.4 Oda dolgusu ve zemin desenleri (2D)

Her oda `polygon.room` olup dolgusu `url(#m-<malzeme>)`. Desenler `patternUnits="userSpaceOnUse"` (mm cinsinden, yani gerçek boyutta karolar):

| Malzeme | Desen boyutu (mm) | Zemin / çizgi renkleri | Çizim |
|---|---|---|---|
| `wood` (meşe) | 1800×360 | `#dcc09a` / `#bf9d70` | 10 mm çizgi: üst kenar, orta (y=180) yatay çizgi; kaydırmalı derz: üst yarıda x=1200'de, alt yarıda x=600'de dikey 180 mm'lik çizgi (tahta uçları); 2 adet dalgalı damar (quad eğri, 5 mm, opak .45) |
| `walnut` (ceviz) | 1800×360 | `#a57c56` / `#80593a` | aynı desen |
| `tile800` | 800×800 | `#ece7de` / `#d3cabb` | sol ve üst kenarda 10 mm derz |
| `tile600` | 600×600 | `#e2e6e3` / `#c4cbc6` | aynı |
| `antislip` | 300×300 | `#d6dbd7` / `#b3bab4` | aynı |
| `marble` | 1200×1200 | `#f3f0ea` / derz `#dcd5c8` | iki eğrisel damar `#d6cfc2` 12 mm (bir "C/S" eğri + bir kısa eğri) |
| `terrazzo` | 500×500 | `#e8e1d5` | 6 adet daire parçacık: (60,80,r22 `#b9a58c`), (310,140,r16 `#8fa3a0`), (190,330,r26 `#c9b7a2`), (420,400,r18 `#a88f76`), (90,440,r12 `#8fa3a0`), (440,40,r10 `#b9a58c`) |
| `carpet` | 120×120 | `#c9c3d3` | iki nokta: (30,30,r8) ve (90,90,r8) `#bab3c6` |

Oda üzerine hover (Seç aracında): opaklık .82. Odaya tıklama (sürüklemeden) odayı seçer; boşluğa tıklama seçimi kaldırır.

Kapı ve sürgülü kapı eşikleri (`gRooms` içinde, mobilyanın altında): kapı boşluğu dikdörtgeni, dolgu `#e2dacb`, kenar `#b9b0a0` 1 px.

### 4.5 Duvarlar

Her duvar bir eksen-hizalı dikdörtgen `[x0,y0,x1,y1,tip]` (bkz. §13). Dolgu rengi tipe göre (§2 tablosu). `low` (alçak duvar/parapet) açık dolgu + 1 px kenarlıklı. Taşıyıcı duvar katmanı (`承重墙`) açıkken taşıyıcı duvarlar kırmızımsı `#b8412c` olur (varsayılan: neredeyse siyah `#26241f`; kullanıcı yardımı "siyah = taşıyıcı" der).

Yık aracında (`tool-demolish`): duvarlar `pointer-events:all`, imleç `pointer`, hover dolgusu `#d9894f`. Bir duvara basınca (`pointerdown`, sürükleme yok):
- Tip `b` → toast "Taşıyıcı duvar (siyah) yıkılamaz".
- Tip `e` → toast "Dış duvarlar binanın dış kabuğudur, yıkılması önerilmez".
- Tip `n` veya `low` → yıkım işareti aç/kapa (`state.demolished` içinde `"w"+indeks`). Yıkık duvar: dolgu `rgba(198,91,58,.12)`, kenar `#c65b3a` 1,2 px kesik (5 3). Toast: yıkma "N mm duvar yıkım için işaretlendi" (N = dikdörtgenin uzun kenarı, mm); geri alma "Duvar geri getirildi". Her değişiklik geri alınabilir tek adım.
- Yıkılan duvarlar yapışma hedeflerinden çıkar, 3D'de görünmez ve çarpışma hesabına girmez. Oda alanları **değişmez** (çokgenler sabit; birleştirme yok).

### 4.6 Pencere, kapı ve sürgülü kapı sembolleri (`gOpen`)

- **Pencere** (dikdörtgen, duvar içine gömülü): dolgu `#f7fbfd`, çizgi `#4f7394` 1 px; uzun kenara paralel **iki iç çizgi** 1/3 ve 2/3 konumunda (cam katmanlarını gösterir).
- **Menteşeli kapı**: (a) yaprak: menteşe noktasından açık yönde `len` mm uzanan, kapalı yön tarafına 40 mm kalınlıkta **beyaz dolgulu dörtgen** (açık konumda çizilir), çizgi `#3d3a34` 1 px; (b) **kesik yay** (dash `5 3`, opaklık .7): açık uç noktasından kapalı uç noktasına yarıçapı `len` olan çeyrek daire; yay yönü (sweep) `open × closed` çapraz çarpımının işaretinden. Giriş kapısı çizgisi `#b5653a`, 1,8 px.
- **Sürgülü kapı**: boşluk boyunca iki üst üste binen dikdörtgen kanat: her biri uzunluğun %55'i, 40 mm kalınlık; birinci kanat boşluğun başlangıç ucundan (dikey kapıda üstten, yatay kapıda soldan), ikincisi bitiş ucundan başlar; iki kanat boşluk eksenine göre 5–45 mm karşılıklı yanlara kayık durur (kaydırma/üst üste binme görünümü). Beyaz dolgu, `#3d3a34` 1 px.
- **Giriş işareti**: giriş kapısının dış tarafında ~1000 mm'lik yatay bir ok (çizgi + ok başı, `#b5653a`, 2 px) ve üstünde `Giriş` yazısı (200 mm yazı boyutu, `#b5653a`). Yeni plandaki giriş kapısına göre konumlandırılır.

### 4.7 Oda adları ve alan etiketleri (`gLabels`)

Her `at` noktası olan oda için iki `<text>`, `text-anchor:middle`:
- Ad: `font-size:250` (mm), ağırlık 600, `#2b2824`.
- Alan: aynı x, `y + 260`, `font-size:175`, `#7d7366`, metin `"12.37 m²"` (2 ondalık).
- İkisi de halo: `stroke:#fbf9f4; stroke-width:45; paint-order:stroke; stroke-linejoin:round`.
Yazılar mm cinsinden olduğundan zoom ile büyür/küçülür. Oda adı `state.rooms[id].name` (yerelleştirilmiş: yerleşik adlar İngilizcede çevrilir, kullanıcı değiştirdiyse olduğu gibi).

### 4.8 Ölçü çizgileri (boyutlandırma, `gDims`)

Plan çevresinde 4 kenarda **çift zincir**: iç zincir parça ölçüleri (duvar kalınlıkları dahil ardışık), dış zincir toplam ölçü.
- Renk `#7d7160`; ana çizgi 1 px; **eğik tik** (45°) 2 px, uzunluk ±80 mm; **uzatma çizgileri** (dik) 1 px, ±170 mm.
- Değer yazısı: parça ortasında, çizgiden 70 mm dışarıda; yazı boyutu 200 mm (değer < 400 ise 140 mm); dikey zincirde −90° döndürülmüş.
- Zincir konumları (özgün planda): üst −750 (parçalar) ve −1250 (toplam); alt +11350 ve +11850; sol −800 ve −1300; sağ +12750 ve +13250. Yani parça zinciri planın ~750 mm dışında, toplam zinciri 500 mm daha dışında. Sayısal değerler plana özgü; yapı: her kenar için segment listesi (mm) ve toplam.
- Katman "Ölçü" ile toplu aç/kapa.

### 4.9 Mobilya sembolleri, etiket, seçim kutusu ve tutamaçlar

**Mobilya grubu**: `g.furn` `transform="translate(cx cy) rotate(rot)"`; imleç `move`; hover'da (yalnız `hover:hover`) `filter: drop-shadow(0 0 2px rgba(181,101,58,.7))`. Ayrıntılı semboller §5.2.

**Mobilya etiketi**: `min(w,d) ≥ 380` ve tip `[plant, floorlamp, sidetable, barstool, beanbag]` dışındaysa görünür. Yazı boyutu `clamp(min(w,d) × 0,2 ; 80 ; 170)` mm, `#4a443c`, opaklık .8, ortalı, `rotate(−rot)` ile hep yatay; `pointer-events:none`.

**Seçim (mobilya)** — `gSel`, mobilyanın döndürülmüş koordinat sisteminde:
- Kesikli çerçeve: mobilya sınırından her yönde `5 px` (5/s mm) dışarıda; `#b5653a`, 1,5 px, dash `5 3`.
- **Döndürme tutamacı**: üst kenarın ortasından yukarı `26 px` (dokunmatik `40 px`) uzaklıkta daire; görünür daire yarıçapı `6 px` (dokunmatik ×1,7 = 10,2 px), beyaz dolgu, `#b5653a` 1,5 px kenar; kenardan tutamaca 1 px düz bağlantı çizgisi; üstünde saydam, yarıçapı `11 px` (dokunmatik `24 px`) **isabet alanı**. Tooltip: "Döndürmek için sürükle (Shift: serbest açı)". İmleç `pointer`.
- **Boyut tutamacı**: sağ-alt köşenin `5 px` dışında, **10×10 px** (dokunmatik ×1,7) dolu kare `#b5653a`; isabet alanı saydam daire `11 px` (dokunmatik 24). İmleç `nwse-resize`. Tooltip "Boyutlandırmak için sürükle".
- **Ölçü yazısı** seçili mobilyanın altında: sınır kutusu alt kenarından `24 px` aşağıda ortalı `"1800 × 2000"`, 12 px (ekran boyutu, `12/s` mm), ağırlık 600, `#b5653a`, beyaz halo 3 px. (Bu yazı tuval kenarında kesilebilir; bkz. `shots/02`.)
- Seçim oda ise: oda çokgeni `fill: rgba(181,101,58,.08)`, `stroke:#b5653a` 2 px, `pointer-events:none`.

**Sürükleme mantığı:**
- *Taşıma*: seçim yoksa/başkası seçiliyse önce seç, sonra `pointerdown` noktası ile merkez arasındaki fark (`ox,oy`) korunarak taşı; konum `snapMove` ile hesaplanır. Eşik aşılmadan hareket yok. Bırakınca tek geri-al adımı.
- *Döndürme*: açı = `atan2(imleç − merkez) + 90°`; normalde **15° adımlarına** yuvarlanır, **Shift** ile serbest (1° tamsayıya yuvarlama `norm`). Değer 0–359.
- *Boyutlandırma*: imleç yerel eksenlere (döndürmeyle) izdüşürülür; sol-üst köşe sabit tutulur (yerel `(-w/2,-d/2)`), yeni `w,d = round((imleç−sabit köşe)/10)*10`, en az **100 mm**; merkez buna göre kaydırılır (döndürmeye duyarlı). (Sağ paneldeki alanlar en az 50 mm kabul eder — tutarsızlık özgündür.)
- *Çift tık* (Seç aracında mobilyada): 90° döndürür.

### 4.10 Pointer olay akışı (özet)

`pointerdown` (yalnız birincil/sol tuş; orta ve sağ tuş yok sayılır):
1. Çekmeceleri kapat, Dosya menüsünü kapat.
2. Dokunmatikte parmağı kaydet; ikinci parmak → pinch başlat (yukarıya bakın).
3. Araç `measure`: bkz. §4.11.
4. Bir tutamaç (`[data-handle]`) ve seçili mobilya varsa → döndürme/boyutlandırma sürüklemesi.
5. Araç `demolish` ve duvar → duvarı değiştir, bitir.
6. Araç `select` ve mobilya → seç + taşıma sürüklemesi.
7. Aksi halde → pan sürüklemesi (basılan oda kaydedilir).
`pointermove`: durum çubuğuna imleç mm koordinatı (X/Y, yuvarlanmış); sürükleme yokken üzerindeki oda varsa alt çubukta "Oda adı alan m²" (bu ad çevrilmez); sürükleme varsa eşik kontrolü ve eyleme göre güncelleme. `pointerup/cancel`: eylemi bitir (taşıma/döndürme/boyut ise hareket olduysa `commit`; pan'de hareket olmadıysa: Seç aracındaysa odayı seç veya seçimi kaldır). İmleç: pan sırasında `grabbing`, ölçü aracında `crosshair`.

### 4.11 Ölçü aracı (Measure)

- `M` veya "Ölç": araç açılır; ipucu hapı görünür (fare: "İki noktaya tıklayın (veya sürükleyin) · duvara yaklaşınca yapışır · Shift: yatay/dikey kilit · Esc: iptal"; dokunmatik: "Basılı tutup çizgi sürükleyin veya iki noktaya dokunun · … · çıkmak için «Seç»"). Imleç `crosshair`.
- **İki etkileşim biçimi**: (a) *tıkla–tıkla*: ilk tık başlangıç noktasını koyar (küçük dolu daire, yarıçap 3 px, `#2f5d62`), fare hareket ettikçe geçici çizgi (`#2f5d62`) izler, ikinci tık kaydeder; (b) *sürükle*: ilk basış + eşik üstü sürükleme + bırakma çizgiyi kaydeder. Sürüklemeden bırakılırsa başlangıç korunur ve ikinci tık beklenir.
- En az uzunluk: kayıt için **> 20 mm**; ondan kısa çizgi atılır.
- **Sağ tık** (`contextmenu`) ölçü aracında: bekleyen başlangıç noktasını iptal eder (tarayıcı menüsü açılmaz). **Esc**: bekleyen başlangıç varsa onu iptal; yoksa araç `Seç`'e döner.
- Görünüm (`gMeasure`): kalıcı çizgiler `#b5653a`, geçici `#2f5d62`; çizgi 1,5 px; iki ucunda **±5 px** uzunluğunda dik tik çizgileri; ortada çizgiye paralel döndürülmüş (okunur kalması için 90°'yi aşınca 180° çevrilir) yazı `"3553 mm"` (tamsayı, mm), 12 px ekran boyutu (`12/s` mm), ağırlık 600, çizgiden 5 px yukarıda, beyaz halo 3,5 px. Yazı boyutu zoom'dan bağımsız (yeniden çizim `view` değişince yapılır).
- Ölçüler `state.measures = [{a:{x,y}, b:{x,y}}]` içinde saklanır (kalıcı, geri alınabilir); sağ panel "Ölçüleri temizle (n)" düğmesiyle silinir. Ölçü aracına 3D'ye geçişte çıkılır.

### 4.12 Mobilya ekleme / silme / çoğaltma / z-sırası

- **Ekleme**: kitaplıktan (a) tıklama/dokunma: seçili oda varsa o odanın sınır kutusunun merkezine, yoksa 3D'de ekran merkezinin zemin karşılığına, yoksa 2D'de görünüm merkezine; (b) sürükle-bırak: bırakılan noktaya (2D: plan koordinatı; 3D: ışının y=0 düzlemiyle kesişimi, duvara çarparsa duvarın vurulan noktası). Tuval dışına ya da açık çekmecenin/fab/kaplama üzerine bırakma yok sayılır. 3D'de zemine değilse toast "Zemine bırakın". Eklenen öğe seçilir. **Halı (`rug`) diziye başa eklenir** (en altta çizilir), diğerleri sona.
- Yeni mobilya alanları: `{id, type, name, cx, cy, w, d, rot:0, color}`; `id = 'f' + Date.now().toString(36) + sayaç`.
- **Çoğaltma** (Ctrl/Cmd+D, fab "Kopyala", panel): kopya `(+200, +200) mm` kaydırılmış, seçili olur.
- **Silme**: Delete/Backspace, fab "Sil", panel "Sil".
- **Yerleşimi Temizle** (üst bar, panel): `confirm` diyaloğu ("N mobilya/cihaz kaldırılsın mı? Duvarlar, zemin malzemeleri ve ölçüler korunur, Geri Al ile geri gelir"); onaylanırsa tüm mobilya silinir (tek adım), toast. Mobilya yoksa toast "Temizlenecek mobilya yok".
- **Öne/Arkaya**: paneldeki "En üste getir / En alta gönder" dizide yeri değiştirir.
- **Ok tuşları**: seçili mobilya 10 mm (Shift: 100 mm) kayar; her basış ayrı geri-al adımı.
- Klavye `R`: 90° saat yönü (Shift: −90°). Döndürme değerleri `norm` ile 0–359.

### 4.13 Katman aç/kapa

`Ölçü` → `gDims` göster/gizle (yeniden çizim yok). `Odalar` → oda adı+alan etiketleri. `Mobilya` → `gFurn`. `Izgara` → arka plan deseni (PNG dışa aktarımda da geçerli). `Taşıyıcı duvar` → taşıyıcı duvar rengini kırmızıya çevirir (`renderAll`). `Duvara yapış` → yalnız bayrak (yapışmayı aç/kapa). Katmanlar oturum içidir, kaydedilmez.

### 4.14 Dosya menüsü işlevleri (2D)

- **Görüntüyü dışa aktar (2D)**: bkz. §12.4. 3D'deyken 3D tuvalinin PNG'sini indirir.
- **JSON dışa aktar / içe aktar / sıfırla**: bkz. §12.3.

---

## 5. Mobilya kütüphanesi

### 5.1 Kategoriler ve öğeler (60 öğe, 6 kategori, 45 tip anahtarı)

Kayıt biçimi: `[tip, ad, genişlik(G) mm, derinlik(D) mm, varsayılan renk]`. G = yerel x ekseni (döndürme 0'da yatay), D = yerel y ekseni (dikey). Kategori sırası ekrandaki sıradır. Aynı tip anahtarı birden fazla öğede geçebilir (ör. `bed`, `wardrobe`, `chair`, `vanity`, `fridge`, `cabinet`, `plant`, `armchair`, `table`, `desk`, `bookshelf`, `tv`, `shoecab`); tip = hem 2D sembolünü hem 3D modelini belirler, boyut ve renk öğeden gelir. Renk kullanıcı tarafından paneldeki renk girdisiyle değiştirilebilir (`f.color`); 2D/3D birlikte kullanır. Dosyadaki ad hem `f.name` (Çince) olarak saklanır; İngilizcede `NAMES_EN` haritası ile gösterilir (kullanıcı değiştirmişse olduğu gibi).

Önerilen Türkçe adlar ve kategori adları yeni uygulama içindir; yeni uygulamada adların dile göre seçilmesi yerine doğrudan çeviri tablosu (TR/EN) tutulması önerilir.


#### 卧室 → Bedroom → önerilen: **Yatak Odası**

| # | Çince ad | İngilizce | Önerilen Türkçe | Tip anahtarı | G×D (mm) | Renk |
|---|---|---|---|---|---|---|
| 1 | 双人床 1.8m | Double Bed 1.8m | Çift Kişilik Yatak 1,8 m | `bed` | 1800×2000 | `#c9d6df` |
| 2 | 双人床 1.5m | Double Bed 1.5m | Çift Kişilik Yatak 1,5 m | `bed` | 1500×2000 | `#d8c7dc` |
| 3 | 单人床 | Single Bed | Tek Kişilik Yatak | `bed` | 1200×2000 | `#e8d5b5` |
| 4 | 婴儿床 | Crib | Bebek Beşiği | `crib` | 1250×700 | `#efe3d0` |
| 5 | 床头柜 | Nightstand | Komodin | `nightstand` | 450×400 | `#e8dccb` |
| 6 | 衣柜 | Wardrobe | Gardırop | `wardrobe` | 2000×600 | `#efe6d8` |
| 7 | 小衣柜 | Small Wardrobe | Küçük Gardırop | `wardrobe` | 1200×550 | `#efe6d8` |
| 8 | 梳妆台 | Dresser | Makyaj Masası | `dresser` | 1000×450 | `#efe6d8` |
| 9 | 书桌 | Desk | Çalışma Masası | `desk` | 1200×600 | `#e2cfb4` |
| 10 | 椅子 | Chair | Sandalye | `chair` | 450×480 | `#cfc6b8` |
| 11 | 书架 | Bookshelf | Kitaplık | `bookshelf` | 800×300 | `#e2cfb4` |
| 12 | 飘窗垫 | Bay Cushion | Cumba Minderi | `baycushion` | 520×1800 | `#e7dccd` |

#### 客厅 → Living Room → önerilen: **Salon**

| # | Çince ad | İngilizce | Önerilen Türkçe | Tip anahtarı | G×D (mm) | Renk |
|---|---|---|---|---|---|---|
| 1 | 三人沙发 | 3-Seat Sofa | Üçlü Koltuk | `sofa` | 2400×900 | `#b7c4b0` |
| 2 | 双人沙发 | Loveseat | İkili Koltuk | `sofa` | 1700×880 | `#c3cbd6` |
| 3 | 转角沙发 | Corner Sofa | Köşe Koltuk | `cornersofa` | 2800×1700 | `#b7c4b0` |
| 4 | 单人沙发 | Armchair | Tekli Koltuk | `armchair` | 850×850 | `#d6b99a` |
| 5 | 懒人沙发 | Beanbag | Puf (Sakso) | `beanbag` | 800×800 | `#e0b98f` |
| 6 | 茶几 | Coffee Table | Orta Sehpa | `coffeetable` | 1300×650 | `#e8dccb` |
| 7 | 边几 | Side Table | Yan Sehpa | `sidetable` | 500×500 | `#d9c3a3` |
| 8 | 电视柜 | TV Stand | TV Ünitesi | `tvstand` | 2400×400 | `#e2cfb4` |
| 9 | 地毯 | Rug | Halı | `rug` | 2400×1700 | `#d9cbb8` |
| 10 | 鞋柜 | Shoe Cabinet | Ayakkabılık | `shoecab` | 1000×350 | `#efe6d8` |
| 11 | 玄关柜 | Entry Cabinet | Vestiyer Dolabı | `shoecab` | 1400×380 | `#e6dccc` |
| 12 | 落地灯 | Floor Lamp | Lambader | `floorlamp` | 450×450 | `#3d3a34` |
| 13 | 绿植 | Plant | Bitki | `plant` | 500×500 | `#a9c39b` |
| 14 | 大绿植 | Large Plant | Büyük Bitki | `plant` | 700×700 | `#9dbb8c` |

#### 餐厨 → Dining & Kitchen → önerilen: **Yemek & Mutfak**

| # | Çince ad | İngilizce | Önerilen Türkçe | Tip anahtarı | G×D (mm) | Renk |
|---|---|---|---|---|---|---|
| 1 | 餐桌 | Dining Table | Yemek Masası | `table` | 1400×800 | `#e2cfb4` |
| 2 | 六人餐桌 | 6-Seat Dining Table | 6 Kişilik Yemek Masası | `table` | 1800×900 | `#d8c2a2` |
| 3 | 圆桌 | Round Table | Yuvarlak Masa | `roundtable` | 1000×1000 | `#e2cfb4` |
| 4 | 餐椅 | Dining Chair | Yemek Sandalyesi | `chair` | 450×480 | `#cfc6b8` |
| 5 | 岛台 | Kitchen Island | Mutfak Adası | `island` | 1800×900 | `#e9e5de` |
| 6 | 吧椅 | Bar Stool | Bar Taburesi | `barstool` | 420×420 | `#6b5d4c` |
| 7 | 橱柜台面 | Kitchen Counter | Mutfak Tezgâhı | `counter` | 1600×600 | `#e9e5de` |
| 8 | 燃气灶 | Gas Stove | Ocak | `stove` | 750×450 | `#dcdcdc` |
| 9 | 水槽 | Sink | Evye | `ksink` | 800×450 | `#e1e6ea` |
| 10 | 冰箱 | Fridge | Buzdolabı | `fridge` | 700×700 | `#dfe4e8` |
| 11 | 餐边柜 | Sideboard | Büfe | `cabinet` | 1600×400 | `#efe6d8` |

#### 卫浴 → Bathroom → önerilen: **Banyo**

| # | Çince ad | İngilizce | Önerilen Türkçe | Tip anahtarı | G×D (mm) | Renk |
|---|---|---|---|---|---|---|
| 1 | 马桶 | Toilet | Klozet | `toilet` | 400×700 | `#ffffff` |
| 2 | 浴室柜 | Vanity | Banyo Dolabı | `vanity` | 800×500 | `#eef1f3` |
| 3 | 双盆浴室柜 | Double Vanity | Çift Lavabolu Banyo Dolabı | `vanity` | 1200×500 | `#eef1f3` |
| 4 | 淋浴房 | Shower | Duşakabin | `shower` | 900×900 | `#e4edf2` |
| 5 | 浴缸 | Bathtub | Küvet | `bathtub` | 1600×750 | `#eef3f6` |
| 6 | 洗衣机 | Washer | Çamaşır Makinesi | `washer` | 600×600 | `#e6ebee` |
| 7 | 电热水器 | Water Heater | Termosifon | `waterheater` | 800×450 | `#f4f4f2` |
| 8 | 储物柜 | Storage Cabinet | Depolama Dolabı | `cabinet` | 1000×400 | `#efe6d8` |

#### 家电 → Appliances → önerilen: **Ev Aletleri**

| # | Çince ad | İngilizce | Önerilen Türkçe | Tip anahtarı | G×D (mm) | Renk |
|---|---|---|---|---|---|---|
| 1 | 65 寸电视 | 65" TV | 65" TV | `tv` | 1450×80 | `#1d1d1f` |
| 2 | 55 寸电视 | 55" TV | 55" TV | `tv` | 1230×80 | `#1d1d1f` |
| 3 | 对开门冰箱 | French-door Fridge | Gardırop Tipi Buzdolabı | `fridge` | 910×700 | `#c9ced3` |
| 4 | 柜机空调 | Floor AC | Ayaklı (Salon Tipi) Klima | `aircon` | 500×380 | `#f6f7f8` |
| 5 | 挂机空调 | Wall AC | Duvar Tipi (Split) Klima | `acwall` | 900×250 | `#f6f7f8` |
| 6 | 洗碗机 | Dishwasher | Bulaşık Makinesi | `dishwasher` | 600×600 | `#c9ced3` |
| 7 | 蒸烤箱高柜 | Oven Tower | Buharlı Fırın Boy Dolabı | `ovencol` | 600×600 | `#efe6d8` |
| 8 | 烘干机 | Dryer | Kurutma Makinesi | `dryer` | 600×600 | `#e6ebee` |
| 9 | 空气净化器 | Air Purifier | Hava Temizleyici | `purifier` | 400×300 | `#f4f4f2` |

#### 书房 · 休闲 → Study & Leisure → önerilen: **Çalışma & Dinlenme**

| # | Çince ad | İngilizce | Önerilen Türkçe | Tip anahtarı | G×D (mm) | Renk |
|---|---|---|---|---|---|---|
| 1 | 长书桌 | Long Desk | Uzun Çalışma Masası | `desk` | 1600×700 | `#d8c2a2` |
| 2 | 办公椅 | Office Chair | Ofis Koltuğu | `officechair` | 620×620 | `#4a4f55` |
| 3 | 大书架 | Large Bookshelf | Büyük Kitaplık | `bookshelf` | 1600×350 | `#e2cfb4` |
| 4 | 立式钢琴 | Upright Piano | Dik Piyano | `piano` | 1500×600 | `#1f1d1b` |
| 5 | 跑步机 | Treadmill | Koşu Bandı | `treadmill` | 800×1800 | `#3a3a3c` |
| 6 | 阅读椅 | Reading Chair | Okuma Koltuğu | `armchair` | 750×800 | `#c9a98a` |

Yeni ada göre `typeColor(tip)`: verilen bir tip için ilk eşleşen öğenin rengi (varsayılan plan mobilyaları bunu kullanır; renk verilmemişse).

### 5.2 2D semboller — her tipin çizimi

Ortak: sembol yerel merkez-orijinli çizilir: `x = −w/2`, `y = −d/2`, `m = min(w,d)`. Tüm şekillerde çizgi `#3d3a34`, 1 px, `non-scaling-stroke`. `rx` = köşe yarıçapı (mm). `shade(renk, k)`: k<1 → RGB'yi k ile çarpar (koyulaştırır); k>1 → beyaza doğru `(255−v)×(k−1)×2` kadar açar (örn. 1,12 → %24 beyaza, 1,4 → %80 beyaza). "Sağ/üst" tarifleri yerel eksenlerdedir: **yerel −y = mobilyanın arkası (duvara bakan taraf)**, +y = ön.

| Tip | Çizim (sırayla, alttan üste) |
|---|---|
| `bed` | (1) Gövde: tüm ayak izi, dolgu `#fbf8f2`, rx 30. (2) Baş ucu şeridi: üstte yükseklik `min(90, d×0,05)`, dolgu `shade(c,.62)`, rx 20. (3) Yastık(lar): üstten 150 mm içeride, yükseklik `min(360, d×0,18)`; `w ≥ 1300` ise iki yastık, her biri `(w−240)/2` genişlikte (sol x+80, sağ x+160+pw), değilse tek yastık `w−160` genişlikte x+80'de; beyaz, rx 70. (4) Yorgan: yastık altından 110 mm aşağıda başlar, alt kenardan 15 mm içeride biter, yanlardan 15 mm boşluk; dolgu = mobilya rengi `c`, rx 40. (5) Yorganın üstünden 300 mm aşağıda yatay kesikli katlama çizgisi (dash `4 3`). (6) Yorgan sağ-üst köşesinde katlanmış üçgen: dik kenarları `min(420, w×0,3)`, dolgu `shade(c,1.12)`. |
| `sofa`, `armchair` | Geri yaslanma derinliği `b = d×0,24`; kol genişliği `a = min(200, w×0,13)`; minder sayısı `n`: armchair=1, sofa: `w>2200` → 3, aksi 2; minder genişliği `cw=(w−2a)/n`; koyu ton `dk=shade(c,.85)`. Sıra: tabanı `dk` rx 60 ile tüm ayak izi; minderler (x+a+i·cw, y+b, cw, d−b−40, dolgu c, rx 40); sırt şeridi (x,y,w,b, dk, rx 50); sol ve sağ kol (a genişliğinde tam derinlik, dk, rx 50). |
| `cornersofa` | L şekilli taban: `k = min(950, d×0,56, w×0,4)`, `b = 220`; yol: (x,y)→(x+w,y)→(x+w,y+k)→(x+k,y+k)→(x+k,y+d)→(x,y+d) kapalı, dolgu `dk`. Minderler: yatay kolda iki adet (genişlik `cw=(w−b−200)/2`, konum x+b ve x+b+cw, y+b, yükseklik k−b−30); dikey kolda bir adet (x+b, y+k, genişlik k−b−30, yükseklik d−k−200); hepsi dolgu c, rx 40. Sırt/kol şeritleri `dk`, rx 50: üst (x,y,w,b), sol (x,y,b,d), sağ-üst kol (x+w−200, y, 200, k), sol-alt uç (x, y+d−200, k, 200). |
| `nightstand` | Gövde rx 30 dolgu c; ortada yarıçapı `m×0,24` daire `#fff6dd` (abajur üstten); içinde yarıçapı `m×0,08` daire `shade(c,.8)`. |
| `wardrobe` | Gövde dolgu c; x+50→x+w−50 arası merkezde yatay çizgi (kapı ekseni); x+160'tan başlayıp her 180 mm'de (x+w−100'e kadar) çapraz askı tikleri: (hx−45, −d×0,28)→(hx+45, d×0,28), opaklık .6. |
| `cabinet`, `shoecab` | Gövde dolgu c + sol-alt→sağ-üst köşegen çizgi. |
| `dresser` | Gövde rx 20; üst kenarda ayna şeridi (x+w×0,2, y, w×0,6, 55) `#dfe9ee`; ön tarafta (dışarıda) tabure: elips merkez (0, d/2+180), rx 160, ry 140, `shade(c,.9)`. |
| `desk` | Gövde rx 20; monitör dikdörtgeni (−w×0,18, y+50, w×0,36, 45) `#555`; klavye (−w×0,14, y+d×0,45, w×0,28, d×0,28) `#f4f4f4` rx 10. |
| `chair` | Oturma: (x+25, y+d×0,16, w−50, d×0,84−10) dolgu c rx 60; arkalık: (x, y, w, d×0,2) `shade(c,.78)` rx 40. |
| `bookshelf` | Gövde dolgu c; x+400'den başlayıp her 400 mm'de dikey bölme çizgisi (x+w−50'ye kadar). |
| `baycushion` | Gövde rx 60; iki beyaz yastık (x+60, y+80) ve (x+60, y+d−80−ph), genişlik w−120, `ph = min(300, d×0,2)`, rx 60. |
| `coffeetable` | Gövde rx 80; iç dikdörtgen 60 mm içeride, dolgu `shade(c,1.06)`, rx 50. |
| `tvstand` | Gövde; TV: (x+w×0,15, y+30, w×0,7, 55) `#3a3a3a`. |
| `rug` | Gövde rx 40 `fill-opacity .6`; iç çerçeve 90 mm içeride, dolgusuz, rx 30, dash `3 3`, opaklık .6. |
| `plant` | Daire yarıçap `m/2`, dolgu c, `fill-opacity .85`; 8 yaprak elips (rx `m×0,1`, ry `m×0,21`, merkez y = −`m×0,27`, her biri k×45° döndürülmüş) `shade(c,.8)`; merkezde yarıçap `m×0,1` daire `#8a6a4a`. |
| `table` | Gövde rx 30 + 50 mm içeride dolgusuz çerçeve (rx 20, opaklık .4). |
| `roundtable` | Elips (w/2, d/2) dolgu c + iç elips (50 mm küçük) dolgusuz opaklık .4. |
| `counter` | Gövde dolgu c + ön kenardan (yerel +y) 40 mm içeride tam genişlik kesikli çizgi (y+d−40; ön kenar çizgisi). |
| `stove` | Gövde `#2f2f2f` rx 20; ocak gözleri yarıçap `m×0,26`: `w/d>1,4` ise iki göz (±w/4, 0), değilse dört göz (±w/4, ±d/4); her göz: dolgusuz daire (çizgi `#bbb`) + içinde yarıçap ×0,45 daire dolgu `#666`. |
| `ksink` | Gövde rx 20; iki evye gözü: (x+w×0,06, y+d×0,18, w×0,42, d×0,66) ve (x+w×0,52, aynı), beyaz, rx 50; musluk dairesi (0, y+d×0,09) r 22 `#999`. |
| `fridge` | Gövde rx 30; y+d×0,14'te yatay çizgi (dondurucu/üst ayrımı); (0, y+d×0,14)→(0, y+d) dikey orta çizgi; iki kulp (−70, y+d×0,5, 40, d×0,25) ve (30, …) `#aab`. |
| `toilet` | Sifon kutusu (x+w×0,04, y, w×0,92, d×0,27) rx 30 dolgu c; tas: elips merkez (0, y+d×0,27+d×0,36), rx w×0,47, ry d×0,36; iç elips merkez (0, y+d×0,27+d×0,4), rx w×0,3, ry d×0,24 `#eef4f7`. |
| `vanity` | Gövde rx 20; lavabo elipsi merkez (0, y+d×0,57), rx `min(w×0,32, 260)`, ry d×0,28 beyaz; musluk dairesi (0, y+d×0,17) r 26 `#999`. (Çift lavabolu model 2D'de de tek elipslidir.) |
| `shower` | Gövde; iki köşegen kesikli çizgi (dash `4 3`); merkezde r 45 beyaz daire (duş başlığı). |
| `bathtub` | Gövde rx 40; iç küvet (80 mm içeride) beyaz, rx = `m×0,33`; gider dairesi (x+w−260, 0) r 35 `#ccc`. |
| `washer`, `dryer` | Gövde rx 30; üst panel şeridi (x,y,w,d×0,14) `shade(c,.9)`; kapak dairesi merkez (0, d×0,06) r `m×0,34` beyaz; iç daire r `m×0,24`: washer `#cfdde4`, dryer `#e9dccb`. |
| `crib` | Gövde rx 20; 45 mm içeride beyaz iç dikdörtgen (rx 20); üst ve alt bordür şeritlerinde her 90 mm'de kısa dikey çıta çizgileri (uzunluk 45, opaklık .5, x+90'dan x+w−60'a). |
| `beanbag` | Elips dolgu c + ikinci elips (−w×0,04, −d×0,06; rx w×0,3, ry d×0,28) `shade(c,1.12)` opaklık .9. |
| `sidetable` | Elips dolgu c + iç küçük elips (rx w×0,12, ry d×0,12) dolgusuz opaklık .5. |
| `floorlamp` | Daire r `m×0,5` `#fff6dd` opaklık .85 + r `m×0,32` kesikli dolgusuz daire + r `m×0,07` dolgu c. |
| `island` | Gövde + ön kenardan 250 mm içeride kesikli tam genişlik çizgi (bar tezgâhı ayrımı). |
| `barstool` | Daire r `m/2` dolgu c + r `m×0,3` `shade(c,1.15)`. |
| `waterheater` | Gövde kesikli kenarlıklı (rx d/2, dash `4 3`); ortada x+w×0,2→x+w×0,8 kesikli çizgi (tank ekseni). |
| `tv` | Gövde rx 10 dolgu c; ayak: (x+w×0,3, y+d, w×0,4, min(40,d)) `#666`. |
| `aircon` (ayaklı) | Gövde rx 30; y+d×0,72 ve y+d×0,86 seviyelerinde yatay çizgi (x+40→x+w−40). |
| `acwall` (duvar tipi) | Gövde rx 30 kesik çizgili; üç hava akış çizgisi x+w×(.25,.5,.75)'te y+d'den +200 mm aşağı, kesikli opaklık .6. |
| `dishwasher` | Gövde rx 15; y+d−70'te yatay çizgi; kulp (x+w×0,3, y+d−45, w×0,4, 25) `#888`. |
| `ovencol` | Gövde + iki köşegen (X işareti). |
| `purifier` | Gövde rx 60 + 45 mm içeride kesikli iç çerçeve (rx 40). |
| `officechair` | 5 kol çizgisi (merkezden `m×0,48` uzunlukta, açılar k×72+36°, `#555`, 2 px); oturma (x+w×0,12, y+d×0,22, w×0,76, d×0,66) c rx 80; arkalık (x+w×0,15, y+d×0,04, w×0,7, d×0,16) `shade(c,.78)` rx 40; kolluklar (x+w×0,02 ve x+w×0,88, y+d×0,3, w×0,1, d×0,45) `shade(c,.7)` rx 30. |
| `piano` | Gövde (x,y,w,d×0,55) rx 10 dolgu c; klavye rafı (x+40, y+d×0,55, w−80, d×0,4) `shade(c,1.4)` rx 10; tuş yatağı (x+90, y+d×0,55, w−180, d×0,2) `#faf8f3`; 25 adet ayırıcı çizgi (i=1..25, x = tuş başlangıcı + genişlik×i/26). |
| `treadmill` | Gövde rx 50; bant (x+90, y+320, w−180, d−400) `#1c1c1e` rx 25; konsol şeridi (x, y, w, 230) `shade(c,1.4)` rx 40. |
| diğer | Düz dikdörtgen dolgu c. |


---

## 6. 3D sahne

### 6.1 Koordinat eşlemesi ve sabitler

- Plan → dünya: `X = (x_mm − OX)/1000`, `Z = (y_mm − OY)/1000`, `Y` = yükseklik (m). `OX, OY` plan sınır kutusunun (kabaca) merkezidir (özgün planda 6000, 5300); yeni planda **planın merkezi dünya orijinine gelecek şekilde** seçilmelidir (gölge kamerası ve hazır kamera pozları orijine göre kurulu).
- Kat yüksekliği `H = 2,8 m`. Kamera `PerspectiveCamera(fov 45°, near 0,05, far 300)`.
- Mobilya dönüşü: 2D'de saat yönü `rot°` → 3D'de `group.rotation.y = −rot × π/180`. Mobilya yerel koordinatında **arka yüz −z, ön yüz +z**; 2D'de yerel −y (arka) ile eşleşir.
- Yükseklikler metre, yatay ölçüler `w/1000`, `d/1000`.

### 6.2 Renderer

- `WebGLRenderer({antialias:true, preserveDrawingBuffer:true})` (PNG dışa aktarım için).
- `setPixelRatio(min(devicePixelRatio, 2))`.
- Gölge: `shadowMap.enabled = true`, `PCFSoftShadowMap`.
- Ton eşleme: `ACESFilmicToneMapping`, `toneMappingExposure = 1,05` (gündüz), **1,25** (gece).
- Renk alanı: varsayılan (sRGB çıktı); zemin dokuları `SRGBColorSpace`.
- Canvas `#view3d` içine `prepend` edilir; üstüne `CSS2DRenderer` katmanı (`position:absolute; inset:0; pointer-events:none`) eklenir (oda etiketleri).
- Tuval boyutu `main` boyutuna bağlıdır (ResizeObserver: `setSize`, `camera.aspect`).
- Ana döngü `requestAnimationFrame`; 3D etkin olmayınca döngü durur (2D'ye dönüş bitince). `dt = min(Δt, 0,05 s)`.

### 6.3 Işıklar, gökyüzü, zemin ve ortam haritası

| Öğe | Tip | Değerler |
|---|---|---|
| Gökyüzü ışığı | `HemisphereLight` | gök `0xfff8ee`, zemin `0xb9a88f`, yoğunluk **1,1** (gündüz) / **0,12** (gece) |
| Güneş | `DirectionalLight` | renk ve şiddet saate göre (§6.4); `castShadow`; gölge haritası **4096²** (dokunmatikte 2048²); gölge kamerası ortografik `left/bottom −11, right/top +11`, `near 1`, `far 60`; `shadow.bias −0,0004`, `normalBias 0,02`; hedef = orijin |
| Arka plan | `scene.background` | gündüz `0xf7f4ee` (= `--paper`), gece `0x1c2130` |
| Zemin (dış) | 160×160 m düzlem, y = −0,015, x ekseninde −90° | `MeshStandardMaterial(color 0xf2eee7, roughness 1)`, gölge alır; gece `0x2a2e38` |
| Oda tavan lambası | `PointLight` (oda başına, `at` noktası olan odalarda) | renk `0xffd9a8`; gündüz yoğunluk **0**, gece **6**; `distance 7`, `decay 1,6`; konum `(oda etiket noktası, y = H − 0,25)` |
| Tavan lamba diski | `CylinderGeometry(r 0,22, h 0,02, 32)` | `MeshStandardMaterial(color #fff, emissive #fff2d6)`, emissiveIntensity **0,3** (gündüz) / **2** (gece); `y = H − 0,012`; yalnız `cut ≥ H` iken görünür |
| Ortam haritası | `RoomEnvironment` → `PMREMGenerator.fromScene(env, 0.04)` | `scene.environment` **atanmaz**; yalnız `metalness>0` veya `roughness<0,4` olan malzemelere tek tek `envMap` verilir. `envMapIntensity` = 1 (metalness>0,5) veya 0,5, **çarpı `envK`** (gündüz 1, gece 0,15) |

`mat(renk, {roughness:0,7 varsayılan, …})` önbellekli `MeshStandardMaterial` üretir; mat yüzeylere (duvar vb.) env verilmez ki genel parlaklık artmasın.

### 6.4 Güneş yolu ve renk sıcaklığı (kaydırıcı 7:00–18:00)

`hour` = kaydırıcı değeri (7…18, adım 0,25, varsayılan 10). Hesap:

- `t = (hour − 6) / 12`  (07:00→0,083; 12:00→0,5; 18:00→1)
- `azimut = π × (0,15 + 0,7 t)`
- `yükselme = sin(π t) × 1,05 + 0,15`  (radyan, 12:00'de ≈1,2)
- `sıcaklık (warm) = 1 − sin(π t)`  (öğlen 0, sabah/akşam 1'e yakın)
- Güneş konumu: `x = cos(azimut) × 18`, `y = sin(yükselme) × 20 + 3`, `z = −sin(azimut) × 10 + 8`; hedef (0,0,0).
- Renk: HSL(`0,09`, `0,5 + warm × 0,4`, `0,92 − warm × 0,12`) — öğlen soluk krem (~`#fff1dd`), sabah/akşam doygun turuncu.
- Şiddet (gündüz): `1,4 + sin(π t) × 1,6` (18:00'de 1,4; 12:00'de 3,0); gece: **0,05**.
- Saat metni "HH:MM" (`10:00`, `16:15` …). Kaydırıcı hareketi anında `applyLight()`; animasyon yok.

### 6.5 Gece modu (Gece düğmesi)

Değişenler: güneş şiddeti 0,05; hemisfer 0,12; arka plan `0x1c2130`; dış zemin `0x2a2e38`; her odanın nokta ışığı **6** ve lamba diski emissive **2**; ton eşleme pozlaması **1,25**; ortam yansıma çarpanı **0,15**. Yani "gece" yalnız tavan lambalı odalar (ilgili odalardaki `PointLight`'lar; ışıklar tavan yüksekliğine göre H−0,25'te) yanar; mobilya üstündeki ışıklı yüzeyler (`glowMat` abajur, ışıklı ayna, dolap alt ışığı) kendi `emissive` değerleriyle kalır. Kesik-duvar modunda lamba **diskleri** gizlenir ama nokta ışıklar açık kalır. Gündüz hâline dönünce ışıklar 0'a iner. Not: lamba grubu (`lampG`, ışıklar dahil) yalnız `grow > 0,99` iken görünür; yani 2D↔3D geçiş animasyonu sürerken gece ışıkları da kapalıdır. (Bkz. `shots/09`.)

### 6.6 Duvarlar, zemin, tavan, cam, kapılar

**Duvar kutuları**: her (yıkılmamış) duvar dikdörtgeni `BoxGeometry(genişlik, yükseklik, derinlik)`; kalınlık planın kendisi (özgün planda 240 mm dış ve iç duvar, bazıları 90–540 mm). Malzeme dizisi (yüz sırası +x, −x, **+y (üst)**, −y, +z, −z): `[duvar, duvar, kapak, duvar, duvar, duvar]`; duvar = `#f4f1eb` roughness .92; **üst kapak (cap)** = `#34312d` roughness .9 (koyu tepe çizgisi). Gölge alır ve verir.
- Yükseklik `cut`: **Tam duvar** = 2,8 m; **Kesik duvar** = 1,2 m. `low` (alçak) duvar: `min(1, cut)`.
- Gezinti moduna özel yardımcılar (yalnız Gezinti'de görünür): her duvar kutusunun kenar çizgileri (`EdgesGeometry`, `LineBasicMaterial 0x6f675b`) ve zemin seviyesindeki duvarlar için **süpürgelik**: kutu ayak izinin +20 mm büyüğü, yükseklik `min(0,12; duvar yüksekliği)`, renk `#8b7f6e`, roughness .6. Amaç, komşu duvar yüzlerini ve köşeleri ayırt etmek.
- Çarpışma dikdörtgeni (duvar + pencere) listeye eklenir (bkz. §8).

**Kapı/sürgülü/geçit üst kirişleri (lento)**: kapı boşluğu üstünde `y = 2,1` (menteşeli kapı ve yatay sürgülü) veya `2,4` (dikey sürgülü ve bay-window geçidi) üstünden `cut`a kadar duvar dolgusu; yalnız `cut > yükseklik` iken.

**Pencereler**: pencere dikdörtgeninin alt kısmı `sill` yüksekliğine kadar duvar: pencere listesindeki **ilk** kayıt (özgün planda ebeveyn banyosunun yüksek penceresi) `sill = 1,4`; cumba (bay) pencereleri (liste indeksi ≥ 6, özgün planda 6 adet) `sill = 0,45`; diğerleri `sill = 0,9`. Yeni uygulamada bu kuralı indekse bağlamak yerine her pencere kaydına açık bir `sill` (denizlik) alanı eklenmesi önerilir; görünüm aynı kalır. Üst kısım `head = 2,4` m'den `cut`a kadar duvar (yalnız `cut > 2,4`). Cam paneli: `BoxGeometry` kalınlık 0,01 m, `MeshPhysicalMaterial(color 0xcfe6ef, roughness .05, transparent, opacity .28, depthWrite:false, DoubleSide)`; `sill`'den `min(head,cut)`e; pick ışınları camı yok sayar; gölge vermez. Doğrama (`frameMat` = `#5d6166`, roughness .5, metalness .4): dikey **kayıtlar (mullion)** sayısı `n = max(1, round(uzunluk/0,9))` → `n+1` adet, kesit 0,04×0,06 m; alt ve üst yatay **çıta** (sill+0,02 ve üst−0,02) 0,04 m yüksek, 0,06 m kalın. Yön = pencerenin uzun ekseni.

**Sürgülü kapılar**: iki cam kanat (her biri uzunluğun %55'i, kalınlık 0,02 m, ±0,02 m ofset), yüksekliği `min(2,4 (dikey)/2,1 (yatay), cut)`; üst-alt çerçeve çıtaları (0,05 m yüksek, 0,04 m kalın) ve kenar dikmeleri 0,04×0,04. Statik (etkileşimsiz), aynı cam malzemesi.

**Menteşeli kapılar**: menteşe noktasında bir `Group` (pivot); yaprak `BoxGeometry(len, min(2,05, cut), 0,04)` menteşeden +x'e uzanır; renk: iç kapılar `#efe6d8`, giriş kapısı `#6b4f3a`, roughness .5; kol: `SphereGeometry(0,03)` metal (`#cfd2d4`, m .9, r .25), z ekseninde 2,2× uzatılmış, yaprak ucundan 0,07 içeride, yükseklik `min(1, kapı yüksekliği−0,05)`. **Açık/kapalı açıları**: kapalı yön vektörü `c`, açık yön `o` (§13) → `açı(v) = atan2(−v.y, v.x)`; iki açı arasındaki fark ±π içinde tutulur; başlangıçta **açık** (`open = true`) gelir. Kapı tıklanınca veya `E` ile açık/kapalı geçişi; animasyon: her karede `cur += (hedef − cur) × min(1, dt × 6)` (üstel yumuşama, ≈0,4 s). Mimari her yeniden kurulduğunda (oda malzemesi/yıkım/kesit değişimi) kapılar tekrar açık başlar.

**Eşik**: her kapı ve sürgülü boşlukta `0,012 m` kalınlıkta `#d8d0c0` (roughness .3) plaka, gölgesiz.

**Zemin**: her oda çokgeni `ShapeGeometry` (y=0, düz), malzeme `floorMat(anahtar)`; UV birimi metre olduğundan doku gerçek boyutta karolanır. **Cumba (bay) odaları** (`counted:false`) yerine `ExtrudeGeometry` ile **0,45 m yüksekliğinde platform** olarak çıkarılır (üst yüz zemin malzemesi, yan yüzler `#e9e4da`), gölge verir; büyüme animasyonu grubuna dahildir. **Tavan**: oda çokgeni `y = H` yüzü aşağı bakan düzlem, `#fbfaf7` roughness 1, gölge vermez; yalnız `cut ≥ H` iken görünür.

### 6.7 Zemin dokuları (3D) — prosedürel `CanvasTexture`

Her malzeme anahtarı için bir kez üretilir, `RepeatWrapping`, `repeat = (1/sx, 1/sy)` (sx, sy = doku başına metre), `anisotropy = maksimum`, `MeshStandardMaterial({map, roughness})`. Rastgelelik tohumlu mulberry32 (`tohum = anahtar.length × 977 + 13`) — yani her malzemenin deseni deterministiktir.

| Anahtar | Doku boyutu (canvas) | sx × sy (m) | Taban renk | roughness | Desen |
|---|---|---|---|---|---|
| `wood` | 1024×205 | 1,8 × 0,36 | `#d6b58a` | .55 | 2 sıra tahta; 1. sırada derz x = 2/3 W'de, 2. sırada x = 1/3 W'de (ard arda kaydırılmış); her tahta parçası taban renk × (0,90…1,10 rastgele); 7 adet dalgalı damar (`sin(x·0,02+k)×2,5` sapma), çizgi `taban×0,8`, alfa .35, kalınlık 1,2; parça sonu koyu şerit 3 px `taban×0,62`; sıralar arası 2,5 px koyu çizgi |
| `walnut` | 1024×205 | 1,8 × 0,36 | `#9a6f4b` | .5 | aynı |
| `tile800` | 512×512 | 0,8 × 0,8 | `#ebe6dd` | .3 | üst ve sol kenarda 3 px derz `#cfc6b7`; 1500 adet 2×2 px rastgele siyah benek (alfa 0–.04) |
| `tile600` | 512×512 | 0,6 × 0,6 | `#dfe3e0` | .35 | derz `#bfc6c1`; aynı benek |
| `antislip` | 512×512 | 0,3 × 0,3 | `#d3d8d4` | .8 | derz `#aab2ac`; aynı benek |
| `marble` | 512×512 | 1,2 × 1,2 | `#f2efe9` | .18 | 6 adet rastgele bezier damar (kalınlık 1–4 px, `rgba(160,150,135,.35)`); derz `#d9d2c4` |
| `terrazzo` | 512×512 | 0,5 × 0,5 | `#e6dfd3` | .4 | 160 adet rastgele daire (r 2–9 px), renk döngüsü `#b9a58c, #8fa3a0, #c9b7a2, #a88f76, #7e8a86` |
| `carpet` | 512×512 | 0,3 × 0,3 | `#c6bfd2` | 1 | yalnız benek gürültüsü |

### 6.8 Kamera pozları, OrbitControls ve hazır görünümler

**OrbitControls**: `enableDamping = true` (varsayılan 0,05), `maxPolarAngle = 0,495π` (zemin altına inmez), `minDistance 1,5`, `maxDistance 45`; fare: sol döndür, sağ kaydır, tekerlek yakınlaştır; dokunmatik: 1 parmak döndür, 2 parmak yakınlaştır+kaydır. Animasyon sırasında `enabled=false`.

**Hazır pozlar** (hedef, kamera konumu, dünya metre):

| Poz | Hedef | Konum | Kullanım |
|---|---|---|---|
| `isoWhole` ("Eğik", "Tüm daire") | (0,0,0) | (5,5 ; 15,5 ; 10) | Eğik düğmesi, "Tüm daire" oda düğmesi, Gezinti'den çıkış |
| `topWhole` ("Üstten") | (0,0,0) | (0 ; 19 ; 0,0001) | Üstten düğmesi |
| `planPose` | 2D görünüm merkezi | Hedefin tam üstü, yükseklik `dist = görünürYükseklik/2 / tan(fov/2)` (görünürYükseklik = 2D görünüm yüksekliği metre) | 2D↔3D geçişinin başlangıcı/sonu; 2D ile piksel-piksel örtüşür |
| `isoFrom(planPose)` | aynı hedef | hedef + normalize(0,3 ; 0,82 ; 0,49) × `clamp(planPose yüksekliği, 5, 30)` | 2D→3D varış pozu |
| Odaya uçuş | oda sınır kutusu merkezi, **y = 0,6** | yatayda `hedef + yön × dist × 0,7`, yükseklik `dist × 1,05`; `dist = boyut × 1,3 + 2,2` (boyut = kutunun uzun kenarı m); `yön` = kameranın hedefe göre yatay yönü (çok kısaysa (0,6 ; 0 ; 0,8)) | Oda listesi / sağ panel oda satırı |

**Kamera geçişi (`camTween`)**: hedefler doğrusal, kamera konumu **hedefe göre küresel koordinatta** (yarıçap, phi lineer; theta en kısa yoldan) interpolasyon → kamera ark çizerek döner/eğilir. **Easing**: kübik ease-in-out (`t<.5 ? 4t³ : 1 − (−2t+2)³/2`). "Uçuş" (`flyTo`) süresi **900 ms**; yeni uçuş eskisini iptal eder; uçuş sürerken `OrbitControls.update()` çağrılmaz, yani kullanıcı girdisi uçuş bitene kadar etkisizdir; Gezinti'ye geçiş uçuşu iptal eder.

### 6.9 2D ↔ 3D geçiş animasyonları

**2D→3D (`enter`, toplam ≈ 2,1 s):**
1. 3D ilk kez ise sahneyi kur (`init`); mimari ve mobilyayı senkronla; `grow = furnGrow = 0`; kamera `planPose`'ta (tam üstten, 2D ile aynı ölçek/konum); etiketler gizli; `orbit` kapalı; `main.animating` sınıfı (ipucu hapı gizli); ilk kare render edilir.
2. `main.is3d` sınıfı → 2D svg opaklığı 0 / 3D 1'e **0,45 s çapraz solma** (o an ikisi piksel piksel örtüşür).
3. **420 ms bekle**, sonra **1700 ms** animasyon (t = 0…1): kamera `isoFrom(planPose)` poza `ease(clamp(t/0,85))` ile gider (yani süresinin ilk %85'inde, ≈1445 ms); duvarlar `grow = ease(clamp((t−0,1)/0,55))` (yerden yükselir: `archUp` grubunun `scale.y`'si 0,001→1); mobilya `furnGrow = ease(clamp((t−0,45)/0,5))` (`furnG.scale.y`); tavan lambaları `grow>0,99` olunca görünür.
4. Bitince OrbitControls açılır, oda etiketleri gösterilir, `animating` kalkar.
- Geçiş sırasında segment anahtarı kilitli (`body.busy`); ipucu hapı animasyon boyunca opaklık 0 (0,4 s geçiş).

**3D→2D (`exit`, toplam ≈ 1,75 s):** Gezintideyse önce gezintiden çıkılır (imleç kilidi açılır, mod Kuşbakışı, hedef = bakılan noktanın 3 m ilerisi). Sonra **1300 ms**: kamera mevcut pozdan `planPose`'a `ease(clamp((t−0,1)/0,9))`; mobilya `furnGrow = 1 − ease(clamp(t/0,45))`; duvarlar `grow = 1 − ease(clamp((t−0,2)/0,6))`. Bitince `is3d` kalkar (3D opaklığı 0 — o an 3D tam düz ve 2D ile örtüşür), **450 ms bekle**, ardından döngü durdurulur, `grow = furnGrow = 1`'e sıfırlanır.

2D arayüz öğelerinin geçişi: `body.m3d` sınıfı 2D-özel grupları `display:none`, 3D-özel grupları görünür yapar; görünenler `fadeIn .45s` ile belirir.

### 6.10 Sol panel: "Odalar" listesi (yalnız 3D)

`#lib3d` başlığı "Odalar · tıklayınca odaya uçulur" (h4 stili) + `#roomList`: iki sütunlu ızgara (`gap:4px; padding:0 10px 6px`), her öğe dikey iki satırlı düğme (`border:1px solid --line; background:#fff; padding:5px 8px; border-radius:7px; text-align:left; line-height:1,3`; ad, altında `small` muted alan "12.37 m²" 2 ondalık). Hover `#f2ece2`; aktif `.on` → arka plan `--accent-soft`, metin `--accent`. Liste yalnız `counted !== false` odaları içerir (cumbalar yok) + son öğe "Tüm daire" (toplam alan). Tıklayınca: Gezintideyse Kuşbakışı'na geç; oda için `flyToRoom`, "Tüm daire" için `isoWhole`'a uç. Liste dil/oda adı değişince yeniden kurulur.

### 6.11 3D oda etiketleri

`CSS2DObject`, konum `(oda etiket noktası, y = cut + 0,15 m)`; DOM: `div.rlabel` (12 px, ağırlık 600, `#2b2824`, arka plan `rgba(255,253,249,.9)`, kenarlık 1 px `--line`, radius 12, padding `2px 9px`, `white-space:nowrap`, `pointer-events:none`) içinde ad + `small` (400, muted, sol boşluk 4 px) alan `"12.4m²"` (1 ondalık, boşluksuz "m²"). "Oda adları" düğmesiyle, ayrıca animasyon ve Gezinti sırasında gizlenir (CSS2DRenderer üst grubun `visible`ını miras almadığı için tek tek ayarlanır).

### 6.12 Seçim / vurgulama / sürükleme (3D)

- **Seçili mobilya vurgusu**: `THREE.BoxHelper(grup, 0xb5653a)` (turuncu sınır kutusu, her karede güncellenir).
- **Tıklama (kuşbakışı)**: ışın (`Raycaster`) `[mobilya grubu (gösteriliyorsa), duvar/mimari grup, zemin grubu]` üzerinde; cam yok sayılır; ilk vuruş: kapı → aç/kapa; zemin odası → oda seç; mobilya → mobilya seç; duvar (veya hiçbir şey) → seçimi kaldır. "Tıklama" = hareket ≤ eşik (4/9 px). Animasyon sırasında yok.
- **Sürükleme**: yalnız **zaten seçili** mobilyaya basılıp sürüklenirse: OrbitControls kapatılır, ışın–zemin (y=0) kesişimi ile 2D ile **aynı `snapMove`** (10 mm ızgara + duvara yapışma; eşik 2D'deki `view.s`'e bağlı) uygulanır; sürükleme sırasında yalnız 3D model kayar, imleç `grabbing`; bırakınca `commit` (geri al adımı) ve tam yeniden çizim (2D de güncellenir). Yakalama fazında (capture) dinlenir, böylece OrbitControls çalışmadan kapatılır. Ekle-bırak için zemin noktası: ışın y=0'a değer (mesafe ≤ 60 m); ondan önce bir duvar/cumba vurursa vuruş noktası kullanılır.
- **2D ile senkron**: her `renderAll` (yani her durum değişimi) 3D etkinse `sync()` çağırır; mimari (oda malzemesi, yıkım, kesit), mobilya, etiket grupları ayrı imzalarla yalnız değişince yeniden kurulur. 3D'den yapılan seçim (`select`) sağ paneli ve fab'ı günceller; sağ panelden değişiklik 3D'ye anında yansır. Mobilya grubu **her mobilya değişiminde topluca yeniden kurulur** (artımlı güncelleme yok). Kapılar yeniden kurulumda açık hâle döner.
- Seçili oda 3D'de görsel vurgu almaz (yalnız sağ panel); mobilya seçiliyken "Mobilya" 3D düğmesi kapatılırsa seçim kaldırılır.
- 3D'de klavye: `T` 2D'ye döner; `R`, Delete, oklar, Ctrl+Z/Y/D, `[`/`]` çalışır; `V`, `M`, `X`, `F`, `+`, `-` yok sayılır.

### 6.13 3D ipuçları (alt çubuk `#tip` ve tuval üstü `#hint3d`)

Alt çubuk (2D): "Soldaki mobilyayı plana sürükleyin · tekerlek yakınlaştırır · boşluğu sürükleyerek kaydırın · T: 3D". Alt çubuk (3D): "3D sahne plan ile anlık senkron · sağ paneldeki değişiklikler hemen uygulanır · T: 2D". Tuval üstü hap (`#hint3d`): `position:absolute; left:50%; top:12px; transform:translateX(-50%); background: rgba(43,40,36,.82); color:#fff; border-radius:20px; padding:5px 14px; font-size:12px; z-index:2; pointer-events:none; white-space:nowrap; transition: opacity .4s` ; metin moda göre (Kuşbakışı/Gezinti/Dokunmatik gezinti; bkz. §14).

---

## 7. 3D mobilya modelleri

Her mobilya, `buildFurniture(f)` ile **birkaç düzine ilkel şekilden oluşan bir `Group`** olarak kurulur. Hepsi `castShadow` + `receiveShadow` (halı hariç gölge vermez). Modeller mobilyanın `w, d` (metre), `c` (renk) ve boyutuna göre ölçeklenir: yatay ölçüler **oransal** (`w`, `d` ile), dikey ölçüler (yükseklik, ayak, tezgâh) **gerçek dünya değerleri** (m) sabittir. Rastgelelik (kitap renkleri, bitki yaprakları, çiçek dizilimi) tohumlu: `tohum = round(w_mm × 7 + d_mm × 13 + cx + cy)` — aynı yerdeki aynı mobilya her yeniden kurulumda aynı görünür; taşınınca dekor hafifçe değişebilir.

### 7.1 Yardımcı ilkeller ve malzeme sözlüğü

Bu ilkeller tarif dilidir (yeniden yazımda aynı görünümü veren herhangi bir eşdeğer geometri kullanılabilir).

| İlkel | Tarif |
|---|---|
| `box(w,h,d, m, x,y,z)` | `BoxGeometry`; **y = alt yüz yüksekliği**, konum (x, y+h/2, z) |
| `rbox(w,h,d, m, x,y,z, r=0,04)` | `RoundedBoxGeometry(w,h,d, segments 3, radius = min(r, en küçük yarı-boyut))`, y alt yüz |
| `cyl(rTop,rBot,h, m, x,y,z, seg=28)` | `CylinderGeometry`, y alt yüz |
| `lathe(pts, m, x,y,z, seg=40)` | `LatheGeometry`; `pts` = `[yarıçap, yükseklik]` çiftleri aşağıdan yukarı; vazo, tabak, abajur, saksı, lavabo, tas |
| `rod(a,b, r0, m, r1)` | İki 3D nokta arasında silindir (uçlarda farklı yarıçap: konik ayak/ayak sehpası) |
| `tube(pts, r, m)` | `CatmullRomCurve3` (centripetal) boyunca `TubeGeometry`; musluk, lamba kolu, tutamak |
| `blob(rx,ry,rz, m, x,y,z)` | Elipsoid (küre ölçeklenmiş), y = **merkez**; yastık, yaprak, meyve |
| `ring(R, r, m, x,y,z)` | Yatay `TorusGeometry`, y = merkez |
| `shell(w,d,h,t,r, m)` | Yuvarlak köşeli boşluklu çerçeve (Shape + delik, extrude): küvet, evye, sandalye çerçevesi |
| `legs(g,w,d,h,m, inset, r)` | 4 konik ayak (üst yarıçap r, alt 0,7 r), köşelerden `inset` içeride |
| `vase`, `tableLamp`, `plate` | Süs nesneleri (aşağıya bakın) |

Malzeme kısayolları (`MeshStandardMaterial`): `woodM(c)` = roughness .55; `fabric(c)` = roughness .96; `metal` = `#cfd2d4` m .9 r .25; `chrome` = `#eef0f2` m 1 r .08; `hwMat` (donanım) = `#b9b3a8` m .85 r .3; `blackMetal` = `#2b2b2d` m .6 r .4; `mirror` = `#dfeaee` m .55 r .06; `ceramic` = `#fbfbf9` r .12; `screenMat(glow)` = `#0b0e13` r .1 m .3 + `emissive glow` ×0,35 (ekran kararmış ama hafif mavi parlak); `glowMat` = ışıklı yüzey (`#fff4dc`, emissive `#ffdca0`, yoğunluk .5, çift yüz). `darker(hex,k)` = rengi k ile çarpar; `lighter(hex,k)` = beyaza doğru k oranında karıştırır.

**Süs nesneleri:** `vase` = lathe profili `[0,0],[.65r,0],[r,.32h],[.92r,.62h],[.42r,.86h],[.5r,h]` (çift yüz, roughness .35) + isteğe bağlı 5 çiçek (ince yeşil sap `#6f8f4a`, uç blob yarıçap ~.02, renk `#f3e6d8/#e8b4a0/#f6d27a/#fff`); `tableLamp` = seramik gövde (lathe ~0,3 m) + krem abajur lathe (`#f6ecd9` parlak, emissive .35) + parlak ampul; `plate` = lathe tabak r ≈ .11–.12 m.

**Kapak / çekmece paneli (`fronts`)** — dolap tipleri ortak: bir dikdörtgen bölgeyi `nx` sütun × `ny` satıra böler; aralarda 5 mm boşluk; boşluğun arkasında ince koyu plaka `#2a2724`; her panel `rbox(pw−.005, ph−.005, .018, r .003)` gövde malzemesiyle; `hd` (donanım): `'bar'` = 10 mm kesitli metal çubuk kulp (`hwMat`, gövdeden 28 mm öne, iki ayaklı; dikey kulp uzunluğu `min(.45, ph×.35)`, çekmece için yatay `min(.3, pw×.45)`); `'knob'` = silindir tutamak + küçük küre; `'edge'` = üst kenarda gizli kulp oluğu (koyu `#3c3a37` şerit); `'none'`. Panelin çekmece sayılma kuralı: `ph < .4 && pw ≥ ph`. Kapı kulp konumu: tek sütunda sağ kenardan .045 içeride; çok sütunda çift/tek sütun için değişen taraf (çift indeksli kapı sağ kenarda, tek indeksli sol kenarda; böylece çiftler ortada buluşur); kulp yüksekliği `hy` verilmişse ona (panele sınırlı), yoksa panel ortası.

### 7.2 Tip tip model tarifleri

(Yükseklikler metre, `w,d` mobilya yatay ölçüleri metre, `c` mobilya rengi, `bz = −d/2`.)

**`bed` (yatak)** — çerçeve `woodM('#8d7258')`; şilte `#f6f3ee`; yorgan `fabric(c)`.
1. Alt tabla: `box(w−.12, .06, d−.14)` `#4a3e33`, z +.03. Yatak kasası: `rbox(w, .24, d−.08)` çerçeve, y .06.
2. Başlık: `rbox(w, 1.08, .06)` çerçeve, arka uçta. Ön yüzünde `n = max(3, round(w/.28))` adet dikey döşemeli panel (`rbox((w−.04)/n − .006, .62, .06)`, `fabric(darker(c,.8))`, y .42).
3. Şilte: `rbox(w−.06, .22, d−.13)` y .3, yuvarlak r .07.
4. Yorgan: derinlik `dd = (d−.13)×.66`, `rbox(w+.02, .27, dd)` ayak ucuna hizalı, y = üst−.2; başlık tarafı kenarında beyaz katlama `rbox(w+.024, .06, .22)` `#fbfaf7`.
5. Yatak sonu örtüsü: `rbox(w+.05, .285, .42)` `fabric(darker(c,.62))`, ayak ucunda.
6. Yastıklar: `w ≥ 1,3` → 2 adet, aksi 1; her biri `rbox(pw, .15, .42)` beyaz, -0,28 rad eğik; önlerinde dekoratif minder `rbox(pw×.62, .3, .1)` (1.: `fabric(darker(c,.7))`, 2.: `#efe7da`), -0,3 rad eğik.

**`sofa`, `armchair` (koltuklar)** — `fabric(c)` minder, `fabric(darker(c,.88))` gövde.
- Ayaklar: `legs(h .12, inset .07, r .018)` `woodM('#3a3027')`. Taban: `rbox(w, .16, d)` y .12. Sırt: `rbox(w, .73, bd)`, `bd = min(.2, d×.24)`, arkada. Kollar: `a = min(.18, w×.14)`; iki `rbox(a, .5, d)`.
- Oturma minderleri: `n` (armchair 1; sofa: w>2,2 → 3, aksi 2), her biri `rbox(cw−.012, .15, sd)` y .28 (`sd = d−bd−.02`); sırt minderi `rbox(cw−.03, .44, .16)` y .42, −0,16 rad geriye eğik.
- Dekoratif yastıklar: `n>1` ise iki adet `rbox(.42,.42,.12)` (solda `#ece5d8`, sağda `darker(c,.7)`) hafif eğik/dönük; `n=1` ise ortada tek `rbox(.4,.26,.1)` `#ece5d8`.

**`cornersofa` (köşe koltuk)** — L planı: `k = min(.95, d×.56, w×.4)`, `b = .2`, ayak h .1 (6 ayak).
- İki taban: uzun kol `rbox(w, .18, k)`, kısa kol `rbox(k, .18, d−k+.02)` sol tarafta.
- Sırt/kol: arka `rbox(w, .72, b)`, sol `rbox(b, .72, d)`, sağ-üst kol `rbox(.2, .5, k)`, alt uç kolu `rbox(k, .5, .2)`.
- Minderler: uzun kolda 2 (`(w−b−.2)/2` genişlik) + sırt minderleri; şezlong kolunda 1 minder (`k−b−.02` × `d−k−.22`); sol sırtta `round((d−.2−b−.18)/.75)` adet dikey sırt yastığı (Z ekseninde .16 rad eğik); iki dekoratif yastık.

**`nightstand` (komodin)** — ayaklar 4×h .1 `woodM('#5a4a3b')`; gövde `rbox(w, .4, d−.02)` y .1; çekmece cepheleri 1 sütun × 2 satır (bar kulp); üstte masa lambası (sol arka) + kitap yığını (`#2f5d62` + `#e6dccd`) sağda.

**`wardrobe` (gardırop)** — yükseklik **2,2**; süpürgelik `box(w−.02, .08, d−.06)` `#4a4641`; gövde `box(w, 2.12, d−.02)`; kapaklar `n = max(1, round(w/.5))` sütun, `hd bar`, kulp y 1,05; üst kapak profili `box(w, .02, d−.02)`.

**`shoecab` (ayakkabılık/vestiyer)** — yükseklik **1,0**, zeminden 0,16 yüksekte "havada" gövde (`box(w, .84, d−.02)`), alt ışık şeridi (glow); `n = max(1, round(w/.45))` kapak `hd edge`; üst tabla `rbox(w+.01, .025, d)`; üstünde küçük tepsi + vazo.

**`cabinet` (büfe/depolama dolabı)** — yükseklik **0,85**; ayaklar h .1; gövde `box(w, .72, d−.02)`; üst sıra çekmece (y .62, h .2), alt sıra kapak (y .1, h .52), `n = max(1, round(w/.5))`; üst tabla `rbox(w+.02, .03, d+.01)` koyu; üstte vazo, eğik tablo çerçevesi (arka duvara yaslı), meyve kasesi (3 meyve).

**`dresser` (makyaj masası)** — 4 konik ayak (h .58); çekmece gövdesi `box(w−.04, .14, d−.04)` y .58; tabla `rbox(w, .03, d)` y .72; 2 sütun düğmeli çekmece; yuvarlak ayna: `TorusGeometry(R=min(.34, w×.3), tüp .018)` çerçeve + `CircleGeometry(R)` ayna malzemesi, y .77+R; kozmetik şişeleri (3 şeffaf silindir), mücevher kutusu; önünde tabure (4 ayak + `rbox(.34,.08,.34)` `#e8ddd0` minder, y .4, z = d/2+.25).

**`desk` (masa)** — tabla `rbox(w, .025, d)` `woodM(c)` y .72; iki yan siyah metal çerçeve (dikme .03×.72×.03, alt-üst kuşak); arka panel; sağ altta çekmece kutusu `box(.4,.09,d−.12)`; üzerinde: monitör (taban + kol + `rbox(.62,.37,.02)` ekran), klavye+ fare, masa lambası (sol arka: taban, boru kol, konik kafa), kalemlik (sağ), sol önde mavi mouse pad/defter (`#3b5566`).

**`chair` (sandalye)** — ahşap `#6b543f`; ön ayaklar 0→0,44, arka ayaklar 0→0,86 (arkalığa uzanır); yan ve ön/arka kuşaklar y .15; oturma çerçevesi + minder `rbox(w−.04, .05, d−.08)` `fabric(c)` y .44; sırt: eğik `rbox(w−.08, .15, .025)` y .66 + ince üst çıta.

**`bookshelf` (kitaplık)** — yükseklik **1,8**; 5 raf, kalınlık .022; arka panel; yan tahtalar; rafa göre rastgele kitaplar (genişlik .018–.048, yükseklik .17–.30, derinlik %62–84 d; palet `#b88a6a, #6f8f8a, #d9c08c, #9aa58c, #a8675e, #e6dccd, #7d8ea3, #c9bfae`), %7 boşluk; raf başına %55 olasılıkla dekor (vazo veya 3 yatık kitap).

**`baycushion` (cumba minderi)** — `rbox(w, .08, d)` y **0,45** (cumba platformu üstünde); iki uçta silindirik/yastık `rbox(w−.1, .34, .14)` (arka beyaz, ön `#f0e6d6`, ±0,25 rad eğik); ortada örtü `rbox(w×.8,.04,.3)`; tepsi + fincan.

**`coffeetable` (orta sehpa)** — 4 konik ayak h .365 `#3a3027`; tabla `rbox(w, .035, d)` `mat(c, r .35)`; alt raf `rbox(w−.12, .02, d−.12)` y .12; üstünde tepsi (kitap+fincan), dergi yığını (`#2f5d62`, `#d9b36c`), vazo.

**`tvstand` (TV ünitesi)** — ayaklar h .1 `blackMetal`; gövde `rbox(w, .4, d−.02)` y .1, `n = max(2, round(w/.6))` kapak `hd edge`; TV: `rbox(1.45, .84, .025)` `#18181a` r .4 m .3 + ekran plakası (sabit 1,45 m genişlik, ünite genişliğinden bağımsız), y .95; soundbar `rbox(.9,.06,.09)`; vazo ve kitap yığını.

**`rug` (halı)** — üç eş merkezli katman: `box(w, .01, d)` renk c; `box(w−.16, .002, d−.16)` `darker(c,.82)`; `box(w−.26, .002, d−.26)` `lighter(c,.12)`; roughness 1, gölge vermez.

**`plant` (bitki)** — `r = min(w,d)/2`, `H = .9 + 1,6 r`. Saksı: lathe `[0,0],[.4r,0],[.44r,.02],[.54r,.36],[.57r,.4],[.52r,.4],[.5r,.37],[0,.37]` `#d9d2c5`; toprak diski `#4a3a2c`; gövde konik çubuk (`#6b5540`); yaprak sayısı `N = 20 + round(36 r)`; altın açı (2,399 rad) ile spiral dizilim, yükseklik `H×(0,42…1,0)`; her yaprak: kısa sap kutusu + çift yüzlü elipsoid (`rx = uzunluk/2`, `ry .005`, `rz = uzunluk×.27`), uzunluk `(.14….22) × (1,1 − 0,4 t) × √(r/.25)`, sarkma açısı `0,1 + 0,5 t + rastgele 0,3` rad; iki ton yeşil `#5f8f4e` / `#79a862` dönüşümlü.

**`table` (yemek masası)** — ayaklar 4 konik (h .715, `darker(c,.55)`); tabla `rbox(w, .035, d)` `mat(c, r .4)` y .715; alt çerçeve `box(w−.22, .07, d−.22)`; orta koşucu (runner) `box(w×.7, .003, .32)` `#b9a58c`; uzun kenarların her ikisinde `ns = max(1, round(w/.62))` yer takımı (amerikan servis `.38×.28` `#e7dfd1`, tabak, şeffaf bardak); ortada vazo (çiçekli).

**`roundtable` (yuvarlak masa)** — tek ayaklı lathe kaide (r .25/… profil, h .715, `#4a3e33`), tabla silindir r = w/2, h .035; 4 tabak; vazo.

**`counter` (mutfak tezgâhı: alt + üst dolap)** — süpürgelik `#4a4641`; alt dolap `box(w, .72, d−.04)` y .1; üst çekmece sırası (y .64, h .18) + kapak sırası (y .1, h .54), `n = max(1, round(w/.6))`; tezgâh taşı `rbox(w+.01, .04, d)` `#dcd7cf` r .22 y .82; sıçrama panosu `box(w, .62, .01)` `#efece6` y .86; **üst dolap** `box(w, .7, .33)` y 1,48 (arkada) + kapaklar + alt LED şeridi; `w ≥ 0,8` ise tezgâh üstünde kesme tahtası, 3 kavanoz (r .07/.06/.05), çatal-kaşık kabı.

**`stove` (ocak)** — cam ocak yüzeyi `rbox(w, .012, d)` `#0d0d0e` y .862; her göz: siyah disk, bronz brülör, kapak, 5 ızgara kolu, önde düğme; `w/d > 1,4` → 2 göz, aksi 4 göz; **davlumbaz**: paslanmaz `rbox(w, .06, .5)` y 1,55 + baca `box(.3, .72, .26)` + eğimli cam panel + mavi LED şerit.

**`ksink` (evye)** — çelik levha `box(w,.008,d)` y .862; gözler `shell` ile (w ≥ .75 ise iki göz w×.42, değilse tek göz w×.7; derinlik d×.66) + iç zemin + gider; musluk: taban silindir + `tube` kavis (y .9→1,17→1,08, arkaya kıvrımlı) + kol.

**`fridge` (buzdolabı)** — yükseklik **1,8**; gövde `mat(c, metalness .45, roughness .28)`; `w > .85` → yan yana iki kapı (`rbox(w/2, 1.72, .04)`), dikey kulplar (0,8 m) ortada; küçük mavi ekran; değilse iki bölmeli: üst kapı `rbox(w, 1.06, .04)` y .72, alt kapı `rbox(w, .64, .04)` y .07, dikey kulp 0,5 m solda + yatay kulp; küçük ekran.

**`toilet` (klozet)** — rezervuar `rbox(w×.88, .4, d×.24)` y .36 + kapak `rbox(w×.92,.03,d×.27)` y .76 + krom düğme; tas: lathe (yarıçap `Rb = w×.45`, profil y 0→.37, z ekseninde `d×.37/Rb` ile oval basık), oturak silindiri y .37 (`#f4f4f2`), kapak silindiri y .392; krom menteşe.

**`vanity` (banyo dolabı)** — askı tipi kasa `rbox(w, .45, d−.04)` y **.33**; cepheler `nb = (w ≥ 1,1 ? 2 : 1)` sütun × 2 satır `edge`; taş tezgâh `rbox(w,.03,d)` `#fafafa` y .78; her göz için lathe lavabo (`rb = min(.19, w/nb×.36)`), krom gider, musluk (tüp), ; ayna: `rbox(mw+.02, .82, .02)` **arkadan aydınlatmalı** (glowMat) + ayna plakası `box(mw,.8,.01)`, `mw = min(.9w, .7 nb)`, y 1,14; sabunluk, katlanmış havlu.

**`shower` (duşakabin)** — tekne `rbox(w,.05,d)` `#f4f4f2` + gider şeridi; **iki cam duvar** (ön: tam genişlik, yan: tam derinlik; kalınlık .01, yükseklik 1,95, y .05) + profiller/üst çıtalar `frameMat`; duş rögarı: vana `rbox(.14,.1,.04)` krom y 1,0, dikey boru → yağmur başlığı `rbox(.24,.012,.24)` y 2,02; el duşu; ceramic raf ve 3 şişe.

**`bathtub` (küvet)** — `shell(w, d, h .56, t .07, r .14)` seramik + tabanlık; su yüzeyi `#bfe0ea` şeffaf .6 y .4; ayak ucunda musluk (tüp) ve iki vana; eğimli arkalık ve sabunluk.

**`washer`, `dryer`** — gövde `rbox(w, .81, d−.02)` y .04 `mat(c, r .35)`; üst panel + deterjan çekmecesi + yeşil-mavi ekran + krom düğme; kapak: siyah disk (r `R0 = min(w,d)×.25`, y .4) + gümüş halka (torus) + cam kubbe (r ×1,42, washer koyu mavi-gri `#26343d`, dryer kahve `#4a4038`, şeffaf .8).

**`crib` (bebek beşiği)** — tabla + şilte (beyaz); 4 köşe direği (.045×.95×.045, üstlerinde küre); dört kenarda üst (y .88) ve alt (y .25) kuşak; her uzun ve kısa kenarda `0,075` aralıklı çıtalar (r .009); battaniye (`#f3d9c9`), yastık, oyuncak ayı (elipsoidler `#c9a27a`).

**`beanbag` (puf)** — gövde elipsoid (`rx w/2, ry .3, rz d/2`) y .3 + sırt elipsoid; `fabric` roughness .95.

**`sidetable` (yan sehpa)** — siyah metal lathe kaide (r .55·r taban → ince gövde → tabla altı) + tabla silindir (r·.98, h .025, y .52) `mat(c, r .35)`; mavi kitap; küçük vazo.

**`floorlamp` (lambader)** — lathe taban (metal), direk r .011 y .03→1,36, konik abajur (glowMat, y 1,22, yükseklik .36, r·.85→r·.55), ampul, iki ince halka (`ring`).

**`island` (mutfak adası)** — kabin (derinlik `d−.3`, 180° dönük kapaklar; +z tarafı bar sandalyesi için boş): plinth, `box(w−.1, .74, cd−.03)`, üst çekmece (y .64) + alt kapak; **taş tezgâh** `rbox(w,.05,d)` y .84 + iki yan "şelale" paneli `box(.04,.84,d)`; üstte meyve tabağı (4 meyve) ve vazo.

**`barstool` (bar taburesi)** — 4 dış açılı ayak (yer: ±0,72 r, üst: ±0,4 r, y .7), ayak halkası (torus) y .28, oturma plakası, minder lathe `mat(c, r .6)` y .7 (kalınlık .075).

**`waterheater` (termosifon)** — yatay silindir `r = min(d/2, .23)`, uzunluk `w−.06`, merkez y **1,95**, arkaya dayalı; uç kapaklar (elipsoid), duvar braketleri, ön panel `rbox(.2,.09,.02)` + yeşil ekran; iki boru (mavi soğuk `#3b7bbf`, kırmızı sıcak `#c0463a`) aşağı uzanır.

**`tv` (duvar TV'si)** — `th = w×.5625` (16:9); merkez y 1,2; arkada askı plakası `rbox(w×.6, th×.6, .03)`; panel `rbox(w, th, .025)` `#18181a` + ekran plakası (`screenMat('#1f2b3a')`).

**`aircon` (ayaklı klima)** — yükseklik **1,8**; gövde `rbox(w, 1.74, d−.01)` `mat(c, r .3)` yuvarlak r .06; taban `#cfd3d6`; ön panel `rbox(w−.06, 1.0, .01)` açık ton y .22; üst hava çıkışı bölmesi `box(w−.1, .42, .01)` `#3d4145` y 1,28 + 8 eğik kanat (-0,35 rad); turkuaz gösterge; 8 ızgara çizgisi.

**`acwall` (duvar tipi klima)** — profil: yuvarlak köşeli "hap" kesit, yükseklik .3, derinlik `d` (arka düz, ön yuvarlak); `ExtrudeGeometry` uzunluk `w−.02`, bevel .01; alt y **2,2**; alt hava çıkışı ve eğimli kanat; ön gösterge; üst ızgara çizgileri.

**`dishwasher` (bulaşık makinesi)** — yükseklik .84; plinth; gövde `box(w−.005, .76, d−.03)` `#8b9095`; ön kapak `rbox(w−.006, .7, .02)` `mat(c, metal .55, r .28)`; üst kontrol şeridi `#26282a` + 4 LED (ilki yeşil, diğerleri mavi); yatay kulp (uzunluk w×.6).

**`ovencol` (fırın boy dolabı)** — yükseklik **2,1**; alt çekmeceler (y .08, h .6, 2 satır), üst kapak (y 1,78); iki fırın bölmesi (y .7 h .58; y 1,3 h .46): koyu çerçeve, cam, kontrol şeridi, amber LED, yatay kulp.

**`purifier` (hava temizleyici)** — `rbox(w, .72, d)` `mat(c, r .45)` yuvarlak; üst ızgara plakası + 7 yarık; ön filtre paneli (`fabric('#c8ccd0')`); turkuaz LED halka y .6.

**`officechair` (ofis koltuğu)** — 5 kollu ayak (yıldız): 5 konik çubuk + tekerlek silindirleri; krom gaz pistonu (h .22) + gövde kılıfı; mekanizma plakası; oturma tablası `rbox(w×.78,.03,d×.72)` y .38 + minder `rbox(w×.8,.08,d×.74)` `fabric(c)` y .4; sırt: tüp destek + eğik file çerçevesi (`shell`) + şeffaf file paneli (`darker(c,.75)` opaklık .88) + bel yastığı; başlık `rbox(w×.45,.12,.05)` y 1,2 (iki çubuk); kolluklar (direk + `rbox(.07,.03,d×.4)` y .63).

**`piano` (dik piyano)** — yükseklik **1,25**; gövde derinliği `d×.5` (arka yarı), parlak `mat(c, r .12, m .1)`; üst kapak; yanlarda yan kaideler ve ayaklar; klavye derinliği `d×.22−.03`; **52 beyaz tuş** (`(w−.12)/52` genişlik, ivory) + siyah tuşlar (A, C, D, F, G sonrası, `kw×.58` genişlik, ebony, y .7); eğik nota sehpası; 3 pirinç pedal; üstte metronom (dörtgen piramit) ve fotoğraf çerçevesi.

**`treadmill` (koşu bandı)** — taban `rbox(w, .14, d−.25)` y .03; bant `box(w−.16,.006,d−.5)` `#141414` + iki alüminyum yan ray; 4 ayak; ön motor kapağı `rbox(w,.22,.32)`; iki dikme (y .15→1,15) + tüp tutamaçlar; konsol (−0,5 rad eğik) `rbox(w×.8,.2,.08)` + mavi ekran (y 1,2).

**Bilinmeyen tip** — `box(w, .8, d)` düz renk c.

### 7.3 Ortak dekor kuralları

- Ekranlar (TV, monitör, fırın camı) çok koyu, hafif mavi emissive; gece de aynı.
- Işıklı yüzeyler (lamba abajurları, banyo aynası çerçevesi, ayakkabılık ve üst dolap alt şeritleri, ampul) `glowMat` emissive ile gece parlar; ortam ışığı azaldığında öne çıkar.
- Metal parçalar (krom, çelik, kulplar) yalnız env haritasından yansıma alır.

---

## 8. Gezinti (yürüyüş) modu

**Giriş**: 3D'de "Gezinti" düğmesi (veya `setMode('walk')`). Sırayla: seçim kaldırılır; kesit "Kesik duvar" ise otomatik **Tam duvar**'a döner (ve mimari yeniden kurulur); OrbitControls kapanır; devam eden uçuş iptal; kamera **giriş kapısının yaklaşık 0,4 m dışında, göz yüksekliği 1,6 m'de, içeriye (salona) doğru bakacak** şekilde yerleştirilir (özgün planda (4200, 8755) mm noktasından (7000, 8755) mm'ye bakış; yani giriş kapısının önü); oda etiketleri gizlenir; Gezinti'ye özel duvar kenar çizgileri ve süpürgelikler görünür olur; kaplama (overlay) gösterilir; üst ipucu hapı güncellenir. Gezinti sırasında Tam/Kesik duvar düğmeleri etkisizdir.

**Başlangıç kaplaması `#walkOverlay`**: tuvali kaplar (`inset:0`), `display:flex` ortalı, arka plan `rgba(30,28,25,.35)`, `z-index:3`, imleç `pointer`. Ortada kart: `background: --panel; border-radius:14px; padding:22px 28px; text-align:center; max-width:360px`. İçerik: `h3` "Gezinti modu"; üç `p` (margin 4px 0, `--muted`): (1) "Başlamak için tıklayın (giriş kapısından girilir)", (2) `<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> yürü · fare: bak · <kbd>Shift</kbd> hızlı`, (3) `<kbd>E</kbd> önündeki kapıyı aç/kapa · <kbd>Esc</kbd> duraklat`. Dokunmatikte üç satır: "Başlamak için dokunun…", "Sol alttaki joystick ile yürü · ekranı sürükleyerek bak", "Kapıya dokunarak aç/kapat · «Gezintiden çık» ile kuşbakışına dön". Görüntü: `shots/13`, `shots/18`.

**Masaüstü (fare + klavye)**
- Kaplamaya tıklayınca `PointerLockControls.lock()` (kilit hedefi `document.body`). Kilitlenince kaplama gizlenir, merkezde **artı işareti** (`#cross`: 14×14 px, iki beyaz 2 px çizgi, `box-shadow: 0 0 2px #000`, `pointer-events:none`) görünür. `Esc` ile kilit açılınca kaplama tekrar görünür (mod hâlâ Gezinti). Kilit hatası (`pointerlockerror`, ör. iframe/izin) olursa **otomatik olarak dokunmatik joystick moduna** düşer.
- Bakış: `PointerLockControls` varsayılanları (fare hareketiyle yaw/pitch; pitch ±90°).
- Hareket: W/S ileri/geri, A/D sağa/sola, ayrıca ok tuşları. Yön, kameranın **yatay düzleme izdüşürülmüş** bakış yönü. Hız **1,4 m/s**, `Shift` basılıyken **2,6 m/s** (kare süresi `dt ≤ 0,05 s` sınırlı). Çapraz harekette vektör normalize edilir. Yerçekimi, zıplama, çömelme, kafa sallama yok; göz yüksekliği sabit **1,6 m**. FOV 45°.
- `E`: ekran merkezinden ışın atar; **2,5 m** içindeki kapıyı aç/kapa.
- Gezinti sırasında 2D'deki genel klavye kısayolları (T, V, Ctrl+Z vb.) çalışmaz (klavye işleyicisi `walking()` iken erken çıkar). Kilit `Esc` ile açılsa bile mod Gezinti kaldığından kısayollar (T dahil) yine devre dışıdır. Çıkış yolları yalnız düğmelerdir: "Kuşbakışı", "Eğik"/"Üstten", oda listesinden bir oda, dokunmatikte "Gezintiden çık", veya 2D/3D segment anahtarı (`exit()` gezintiyi kendisi sonlandırır).

**Dokunmatik (veya kilit alınamazsa)**
- Kaplamaya dokunma → `startTouchWalk`: kaplama gizlenir; **sanal joystick** (`#joy`) ve **"Gezintiden çık"** düğmesi (`#walkExit`, `.btn.primary`) görünür; üst ipucu "Sol alttaki joystick ile yürü · ekranı sürükleyerek bak · kapıya dokunarak aç/kapat".
- **Joystick görünümü**: tuvalin sol-altında `left:28px; bottom:28px`, **130×130 px daire**; `background: rgba(255,253,249,.25); border: 2px solid rgba(255,255,255,.7); box-shadow: 0 4px 18px rgba(0,0,0,.18); backdrop-filter: blur(3px); z-index:3; touch-action:none`. İçinde **56×56 px** yuvarlak topuz (`rgba(255,253,249,.92)`, gölge `0 2px 8px rgba(0,0,0,.25)`), ortada durur; parmakla `translate(dx,dy)` ile kayar. Menzil (R) **50 px**; parmak bu yarıçapı aşarsa topuz sınıra kenetlenir. Değerler `x = dx/50`, `y = dy/50` ∈ [−1, 1].
- Hareket: `ileri = −y`, `sağ = +x`; büyüklük `min(1, |vektör|)`; eşik altı (<0,05) hareket yok; hız = `1,4 m/s × büyüklük` (Shift yok). Joystick bırakılınca topuz merkeze döner.
- **Bakış**: joystick dışında tuval üzerinde tek parmak sürükleme: yaw `+= dx × 0,005`, pitch `+= dy × 0,005` rad, pitch ±1,35 rad'a kenetli (`Euler 'YXZ'`).
- **Kapı**: tuvale kısa dokunma (hareket ≤ 9 px) → ışın; **3,5 m** içindeki kapı aç/kapa.
- "Gezintiden çık" → Kuşbakışı; hedef orijin, kamera `isoWhole`'a uçar.

**Çarpışma**: hareket, eksen bazında ayrı denenir (duvara sürtünerek kayma): önce x adımı, sonra z adımı; yeni nokta engelliyse o eksen adımı yapılmaz. Engel = (a) her (yıkılmamış) duvar ve **her pencere** dikdörtgeni, kenarları **0,22 m** (yarıçap) şişirilmiş AABB içinde kalan nokta; (b) her menteşeli kapı yaprağı: pivottan güncel açı yönünde 0,9 m'lik doğru parçası; noktanın doğruya uzaklığı **< 0,22×0,8 = 0,176 m** ise engel. Kapı geçitleri (kapı boşluğu) duvar listesinde boşluk olduğundan açıktır; **mobilya çarpışması yoktur** (içinden geçilir), sürgülü kapı ve cumba/balkon geçişleri de duvar listesine göre serbesttir (sürgülü kapı boşluğu duvar dışındadır).

**İpuçları (`#hint3d`)**: Kuşbakışı: fare "Sol tuş: döndür · sağ tuş: kaydır · tekerlek: yakınlaştır · seçili mobilyayı sürükleyip yerleştir · kapıya tıklayarak aç/kapat", dokunmatik "Tek parmak döndürür · iki parmak yakınlaştırır / kaydırır · seçili mobilyayı sürükleyip yerleştirin · kapıya dokunarak aç/kapat". Gezinti (masaüstü): "WASD: yürü · fare: bak · Shift: hızlı yürü · E: kapı aç/kapat · Esc: duraklat". Gezinti (dokunmatik): "Sol alttaki joystick ile yürü · ekranı sürükleyerek bak · kapıya dokunarak aç/kapat".

---

## 9. Sağ panel (Özellikler)

Üç durum: **Genel bakış** (seçim yok), **Oda paneli** (oda seçili), **Mobilya paneli** (mobilya seçili). Seçim `ui.sel = {kind:'furn'|'room', id}`; `select()` panel + seçim katmanı + yüzen çubuğu yeniden çizer. Seçim geri-al'dan sonra geçersizleşirse (mobilya artık yok) temizlenir.

### 9.1 Genel bakış

Üç bölüm (`section`):
1. **Oda Alanları** — `h3` + `small` "Zemini görmek / değiştirmek için tıkla". Tablo: her oda için satır: `[12×12 px renk kutusu (o odanın zemin malzemesi rengi, §9.4)] Oda adı` solda, sağda alan `"12.37 m²"` (2 ondalık). Cumbalar adın yanında `*` (muted). Satır tıklanınca oda seçilir (3D'deyken ayrıca kamera odaya uçar). Altında `total`: "Net kullanım alanı" ↔ kalın vurgu renkli `87.18 m²` (`--accent`, 14 px satır); altında 11 px muted dipnot "* Cumbalar net alana dahil değildir; alanlar duvar iç net ölçülerinden hesaplanır".
2. **Zemin Malzemesi Tahmini** (`small`: "%5 fire dahil"): malzeme başına bir satır `[renk kutusu] Malzeme adı | toplam alan (1 ondalık) m² | ¥ maliyet` ; maliyet = `alan × birim fiyat × 1,05`, `Math.round` + binlik ayraç; malzeme sırası, `ROOMS` dizisinde ilk görüldükleri sıradır. Toplam satırı "Zemin malzemesi toplamı" ↔ vurgu renkli `¥25,077`. **Cumba odalarının alanı da malzeme toplamına dahildir** (net alana dahil değil).
3. **Plan İstatistikleri** — 2 sütun kutu (`.stats`; arka plan `#faf6ef`, radius 8, padding 8): "Mobilya sayısı" büyük sayı (22 px/600) ; "Yıkılan duvar" büyük sayı (m, 1 ondalık; her yıkık duvar için uzun kenar toplamı /1000) + " m". Altında iki düğme (kenarlık `--line`, beyaz): "Ölçüleri temizle (n)", "Yerleşimi temizle" (`.danger`).
4. (Yalnız dokunmatik) **Dokunmatik Kontroller** bölümü (`.kbd` iki sütunlu ızgara: `auto 1fr`, boşluk `3px 10px`, 12 px muted; sol sütunda `kbd`): Tek parmak sürükle / İki parmak / Kitaplık / Mobilyaya dokun / Araç çubuğu / Ölç / 3D gezinti (metinler §14).
5. **Klavye Kısayolları** bölümü (her cihazda gösterilir): aynı `.kbd` ızgarası (metinler §14 ve §11).

Panel dikey kaydırılır (`overflow:auto`).

### 9.2 Oda paneli

`section` 1 "Oda": ad girdisi (`#rName`, tam genişlik; `change` olayında adı kaydeder, boş bırakılırsa eski ad kalır), 2×2 istatistik kutusu: **Kullanım alanı** (m², 2 ondalık), **Çevre** (m, 1 ondalık = çokgen kenar uzunlukları toplamı/1000), **Genişlik (açıklık)** (mm, sınır kutusu genişliği), **Derinlik** (mm, sınır kutusu yüksekliği). Altında muted satır: "Duvar alanı (tavan yüksekliği 2,8 m, kapı-pencere düşülmeden) ≈ N m²" (`çevre × 2,8`, 1 ondalık).
`section` 2 "Zemin malzemesi": 2 sütunlu `.mats` ızgarası, sekiz malzeme kartı (`border:1px solid --line; radius 8; padding 6; white; gap 8; text-align:left`), sol 26×26 px renk kutusu (radius 5, `rgba(0,0,0,.12)` kenar), sağda ad ve altında `small` `¥320/m²`; seçili kart `border-color: --accent; box-shadow: 0 0 0 2px --accent-soft`. Tıklama malzemeyi değiştirir (geri alınabilir; 2D deseni, 3D dokusu, sağ panel tahmini hemen güncellenir). Altında `total`: "Malzeme tahmini maliyet" ↔ vurgu `¥N` (= `alan × fiyat × 1,05`).
`section` 3 "Odadaki mobilyalar" (`small`: "N adet"): tablo — merkezi **odanın sınır kutusunun içinde** kalan her mobilya (`x0<cx<x1 && y0<cy<y1`; L şekilli odalarda komşu alanlar da yakalanabilir); satır: ad | `G×D` (muted); tıklayınca mobilyayı seçer; boşsa "Yok". Altında "← Genel bakışa dön".

### 9.3 Mobilya paneli

`section` 1 "Mobilya Özellikleri": 2 sütunlu `.form` (`gap:8px`; etiket 12 px muted, dikey; girdi: `border:1px solid --line; border-radius:6px; padding:5px 7px; background:#fff; width:100%`):
- Ad (tam genişlik metin girdisi)
- Genişlik (mm) — sayı, `min 50`, `step 10`
- Derinlik (mm) — sayı, `min 50`, `step 10`
- Merkez X (mm) — sayı `step 10` (yuvarlanmış tamsayı gösterilir)
- Merkez Y (mm)
- Döndürme (°) — sayı `step 15` (değer `norm` ile 0–359'a çevrilir)
- Renk — `input[type=color]` (30 px yükseklik, padding 2)
- Değişiklikler `change` olayında uygulanır (her biri ayrı geri-al adımı); geçersiz sayı yok sayılır.
Altında muted: "Taban alanı 3.60 m²". Eylem düğmeleri (`.actions`, kenarlıklı beyaz): "90° döndür", "Kopyala", "En üste getir", "En alta gönder", "Sil" (`danger`), "← Geri".
`section` 2 (muted 12 px): kullanım ipucu paragrafı ("Taşımak için mobilyayı sürükleyin; üstteki noktayı sürükleyerek döndürün; sağ alt köşedeki kareyi sürükleyerek boyutlandırın. «Duvara yapış» açıkken duvara yaklaşınca otomatik hizalanır.").

### 9.4 Zemin malzemeleri tablosu

| Anahtar | Çince | İngilizce | Türkçe | Fiyat (¥/m²) | Örnek renk (swatch) |
|---|---|---|---|---|---|
| `wood` | 橡木地板 | Oak Flooring | Meşe Parke | 320 | `#d8b88a` |
| `walnut` | 胡桃木地板 | Walnut Flooring | Ceviz Parke | 380 | `#9b7250` |
| `tile800` | 800 地砖 | 800 Tile | 80×80 Seramik | 220 | `#ebe6dc` |
| `tile600` | 600 地砖 | 600 Tile | 60×60 Seramik | 160 | `#dfe3e1` |
| `marble` | 大理石 | Marble | Mermer | 650 | `#f1eee8` |
| `antislip` | 300 防滑砖 | 300 Anti-slip Tile | 30×30 Kaymaz Seramik | 140 | `#d3d8d4` |
| `terrazzo` | 水磨石 | Terrazzo | Terrazzo | 280 | `#e6dfd3` |
| `carpet` | 满铺地毯 | Wall-to-wall Carpet | Duvardan Duvara Halı (Moket) | 200 | `#c9c3d3` |

Para birimi özgünde `¥` ve `toLocaleString()` binlik ayraçlıdır. Yeni uygulamada `₺` ve TR yerel ayarı önerilir (fiyat tablosu `MATS` içinde tek yerden değiştirilir; fire oranı **%5 = ×1,05** sabit).

### 9.5 Oda adları (yerleşik)

| Çince | İngilizce | Türkçe |
|---|---|---|
| 主卧室 | Master Bedroom | Ebeveyn Yatak Odası |
| 主卫浴 | Master Bath | Ebeveyn Banyosu |
| 小孩房 | Kids' Room | Çocuk Odası |
| 客卫浴 | Guest Bath | Misafir Banyosu |
| 洗衣阳台 | Laundry Balcony | Çamaşır Balkonu |
| 子女房 | Children's Room | Çocuk Odası 2 |
| 厨房 | Kitchen | Mutfak |
| 餐厅 | Dining | Yemek Alanı |
| 过道 | Hallway | Koridor |
| 客厅 | Living Room | Salon |
| 休闲阳台 | Leisure Balcony | Dinlenme Balkonu |
| 主卧飘窗 | Master Bay Window | Ebeveyn Cumbası |
| 子女房飘窗 | Children's Bay Window | Çocuk Odası 2 Cumbası |

---

## 10. Animasyonlar ve geçişler — özet tablo

| Ne | Süre | Easing / eğri | Ayrıntı |
|---|---|---|---|
| 2D/3D segment hapı | 0,5 s | `cubic-bezier(.65,0,.35,1)` | `translateX(84px)` (dokunmatik 94 px); metin rengi 0,45 s |
| Mod değişiminde 2D-özel / 3D-özel grupların belirmesi | 0,45 s | `ease` | `opacity 0→1`, `translateY(−4px→0)` |
| 2D tuvalin solması ↔ 3D tuvalin belirmesi | 0,45 s | `ease` | `#plan` opaklık+transform; `#view3d` opaklık (gizlenirken `visibility` 0,45 s gecikmeli) |
| 2D→3D toplam | 420 ms bekleme + 1700 ms | kübik ease-in-out | kamera %85'te varır; duvarlar yükselir (%10–%65), mobilya belirir (%45–%95); bkz. §6.9 |
| 3D→2D toplam | 1300 ms + 450 ms | kübik ease-in-out | mobilya (%0–%45) alçalır, duvar (%20–%80) iner, kamera (%10–%100) tepeye |
| Odaya / hazır poza uçuş | 900 ms | kübik ease-in-out (`4t³ … 1−(−2t+2)³/2`), küresel interpolasyon | Oda listesi, Eğik, Üstten |
| Kapı açma/kapama | ≈0,4 s | üstel yumuşama `cur += (hedef−cur)×min(1, dt×6)` | |
| Sol/sağ panel daralma (geniş) | 0,3 s | `cubic-bezier(.3,.7,.3,1)` | `grid-template-columns` |
| Çekmece (dar) | 0,3 s | aynı | `transform` + `box-shadow` |
| Yüzen çubuk (fab) | 0,2 s | `ease` | opaklık + `translateY(12px→0)`, `visibility` gecikmeli |
| Toast | 0,25 s giriş, 1800 ms kalır | `ease` | `translateY(20px)`→0 |
| Mod ipucu hapı | 0,2 s | `ease` | opaklık 0↔.9 |
| Ölçek çubuğu | 0,3 s | `ease` | 3D'de opaklık 0 |
| 3D ipucu hapı | 0,4 s | `ease` | animasyonda gizli |
| Kitaplık kartı hover | 0,15 s | `ease` | kenarlık rengi + `translateY(−1px)` |
| Dosya menüsü açılışı | 0,2 s | `ease` | `fadeIn` |
| Zoom / pan | anlık | — | animasyon yok (tekerlek ve düğmeler doğrudan uygular) |
| Güneş kaydırıcısı, gece | anlık | — | ışık/renk anında değişir |

---

## 11. Klavye kısayolları ve geri al / yinele

### 11.1 Kısayollar (tam liste)

Girdi/select/textarea odaktayken tüm kısayollar devre dışıdır. Gezintide (`walking`) hiçbiri çalışmaz.

| Tuş | İşlev | Not |
|---|---|---|
| `V` | Seç / Taşı aracı | 3D'de yok sayılır |
| `M` | Ölç aracı | 3D'de yok |
| `X` | Duvar yık aracı | 3D'de yok |
| `Esc` | Bekleyen ölçü başlangıcı varsa iptal; yoksa araç Seç'e döner ve seçimi kaldırır | |
| `R` | Seçili mobilyayı 90° saat yönünde döndür; `Shift+R` −90° | 2D ve 3D |
| `Delete` / `Backspace` | Seçili mobilyayı sil | |
| Ok tuşları | Seçili mobilyayı 10 mm (`Shift`: 100 mm) kaydır | Yalnız mobilya seçiliyken; her basış bir geri al adımı |
| `Ctrl/⌘ + D` | Seçili mobilyayı çoğalt (+200,+200 mm) | |
| `Ctrl/⌘ + Z` | Geri al; `Ctrl/⌘ + Shift + Z` yinele | |
| `Ctrl/⌘ + Y` | Yinele | |
| `T` | 2D ↔ 3D geçiş | |
| `F` | Pencereye sığdır | 2D; 3D'de yok |
| `Shift + F` | Tam ekran aç/kapat | |
| `+` / `=` | Yakınlaştır ×1,25 | 2D |
| `-` | Uzaklaştır ×0,8 | 2D |
| `[` | Mobilya kitaplığı panelini aç/kapat | |
| `]` | Özellikler panelini aç/kapat | |
| `E` | (Gezinti) önündeki kapıyı aç/kapa | 2,5 m menzil |
| `W A S D` / oklar | (Gezinti) yürü | `Shift` hızlı |
| `Enter`/`Tab` | Özel işlev yok | Girdiler için standart |

Sağ panel "Klavye kısayolları" bölümünde gösterilen satırlar: `Sürükle` (soldaki mobilyayı plana sürükle), `V`, `M` (Shift: yatay/dikey), `X` (siyah = taşıyıcı), `R` (Shift ters), `Ok tuşları` (10 mm, Shift 100 mm), `⌘/Ctrl D`, `Delete`, `⌘/Ctrl Z`, `T`, `F`, `Esc`.

### 11.2 Fare / dokunmatik özet

| Eylem | Fare | Dokunmatik |
|---|---|---|
| Mobilya seç | Tıkla | Dokun |
| Mobilya taşı | Sürükle (eşik 4 px) | Sürükle (eşik 9 px) |
| Döndür | Üst tutamaç (15° adım; Shift serbest) / çift tık +90° / `R` | Üst tutamaç / fab `↺ ↻` |
| Boyutlandır | Sağ-alt kare (10 mm adım) | aynı |
| Pan | Boşlukta sürükle | Tek parmak sürükle |
| Zoom | Tekerlek (Ctrl+tekerlek/pinch daha hassas) / ＋ − | İki parmak pinch |
| Ölçü | Tıkla–tıkla veya sürükle; sağ tık iptal | Basılı sürükle veya iki dokunuş |
| 3D döndür/kaydır | Sol/sağ tuş sürükle | 1 / 2 parmak |
| Kitaplıktan ekle | Tıkla (merkeze) veya sürükle-bırak | Dokun (merkez) veya sağa doğru sürükle; dikey kaydırma listeyi kaydırır (`touch-action: pan-y`) |

### 11.3 Geri al / yinele modeli

- **Anlık görüntü (snapshot) tabanlı**: kaynak `state` nesnesinin tamamı `JSON.stringify` ile dizgeye alınır. Yığın bellektedir, en çok **150** adım (aşarsa en eski silinir). Yeni bir değişiklik `redo` yığınını boşaltır.
- **Kapsam**: `state` içindeki her şey — mobilya listesi, oda adları ve malzemeleri, yıkılan duvarlar, ölçü çizgileri. Kapsam DIŞI: seçim, görünüm/zoom, katman anahtarları, araç, 3D seçenekleri (kesit, gece, saat), açık kapılar.
- **Adım sınırı**: her `mutate(fn)` çağrısı bir adımdır (panel alanı değişikliği, malzeme seçimi, duvar yık/geri al, ölçü ekle, ekleme/silme/çoğaltma/z-sırası, ok tuşu basışı, import, sıfırla, tümünü temizle). Sürükleme (taşı/döndür/boyutlandır, 2D ve 3D) tek adımdır ve yalnız gerçekten hareket olduysa kaydedilir; sürükleme başında anlık görüntü alınır.
- `undo`: yığın boşsa toast "Geri alınacak işlem yok"; aksi halde mevcut durum `redo`ya itilir, `undo`dan çıkan geri yüklenir; seçili mobilya artık yoksa seçim kaldırılır; `localStorage`'a kaydedilir; tam yeniden çizim. `redo` benzer (boşsa sessiz).
- Geri Al / Yinele düğmeleri yığın boşken `disabled` ve opaklık .4.

---

## 12. Kalıcılık, dışa/içe aktarma

### 12.1 localStorage anahtarları

| Anahtar | Değer | Ne zaman yazılır / okunur |
|---|---|---|
| `huxing-design-v1` | `JSON.stringify(state)` (bkz. şema) | Her `commit`/`undo`/`redo`/import/reset sonrası yazılır; açılışta okunur. Geçersiz/eksikse varsayılan plan yüklenir. |
| `huxing-lang` | `"en"` ya da yok (=Çince) | Dil değişince yazılır. Yeni: `"tr"` \| `"en"`. |
| `huxing-panes` | `{"hideLib":bool,"hidePanel":bool}` | Geniş ekranda paneller daraltılınca yazılır; açılışta okunur. |

Tüm erişimler `try/catch` ile sarılıdır; depolama yoksa uygulama yine çalışır. Yeni uygulamada anahtar öneki değiştirilebilir (ör. `katplani-tasarim-v1`).

### 12.2 Durum şeması (`state`)

```
state = {
  furniture: [ { id: "f<zaman36><sayaç>", type: "<tip anahtarı>", name: "<ad>",
                 cx: <mm, merkez x>, cy: <mm, merkez y>, w: <mm>, d: <mm>,
                 rot: <0..359 derece, saat yönü>, color: "#rrggbb" } , … ],
  rooms:     { "<odaId>": { name: "<ad>", mat: "<malzeme anahtarı>" }, … },   // tüm ROOMS için
  demolished:[ "w<duvar indeksi>", … ],                                        // WALLS dizisi indeksi
  measures:  [ { a: {x:<mm>, y:<mm>}, b: {x:<mm>, y:<mm>} }, … ]
}
```
`fixState`: yüklenen veri `furniture` dizisi içermiyorsa reddedilir; eksik `rooms` girdileri varsayılanla tamamlanır (`Object.assign(varsayılan, yüklenen)`), `demolished` ve `measures` yoksa `[]` yapılır. Mobilya alanları doğrulanmaz. Görünüm, seçim, katmanlar, 3D seçenekleri şemada yoktur.

Varsayılan durum: yerleşik mobilya listesi + her oda için yerleşik ad ve malzeme + boş `demolished` ve `measures`.

### 12.3 JSON dışa / içe aktarma

- **Dışa aktar**: `JSON.stringify(state, null, 2)` (2 boşluklu girinti), MIME `application/json`, dosya adı `户型装修方案.json` (EN: `floor-plan-design.json`) → yeni: `kat-plani-tasarimi.json`. Blob + geçici `<a download>`; nesne URL'si 1 s sonra serbest bırakılır. Şema §12.2 ile aynıdır; ayrı bir sürüm alanı yoktur.
- **İçe aktar**: gizli `input[type=file]` (`.json`, `application/json`) → `file.text()` → `JSON.parse`; `furniture` dizisi yoksa toast "Dosya biçimi geçersiz". Geçerliyse: mevcut durum geri-al yığınına atılır, `fixState` uygulanır, seçim temizlenir, kaydedilir, yeniden çizilir, toast "Plan içe aktarıldı". Aynı dosya tekrar seçilebilsin diye `input.value` sıfırlanır.
- **Varsayılana sıfırla**: `confirm("Varsayılan tasarıma dönülsün mü? (geri alınabilir)")`; onaylanırsa geri-al adımıyla `defaultState()`.

### 12.4 PNG dışa aktarma

- **2D**: mevcut `<svg>` derin klonlanır; `viewBox` = `BOUNDS` (−1850, −1750, 15600, 14100), `width=3200`, `height = round(3200 × 14100/15600) = 2892` piksel (sabit çözünürlük, ekran zoomundan bağımsız, **tüm plan + ölçü zincirleri** dahil); seçim katmanı (`gSel`) temizlenir; grid katmanı: açıksa desen, kapalıysa düz `#f7f4ee`; klonun en altına `#f7f4ee` arka plan dikdörtgeni eklenir; klon `XMLSerializer` ile `data:image/svg+xml` → `Image` → `<canvas>` (3200×2892) `drawImage` → `toBlob` (PNG) → indir. Kapalı katmanlar (ölçü, oda adları, mobilya) klonda da kapalıdır (satır içi `display`). Dosya adı `户型装修方案.png` (EN `floor-plan-design.png`) → yeni `kat-plani-tasarimi.png`. Ölçek çubuğu, ipucu hapı ve panel görüntüye girmez.
- **3D**: `renderer.domElement.toDataURL('image/png')` — mevcut canvas piksel boyutunda (CSS boyutu × pixelRatio ≤ 2), **CSS2D oda etiketleri dahil değil**, dosya adı `…-3D.png` (`floor-plan-design-3D.png`). `preserveDrawingBuffer:true` bunu mümkün kılar.

---

## 13. Plan verisi — yapı tarifi (veri değil)

Yeni uygulama Türk 3+1 plan verisini bu yapıya uygun sabit diziler olarak kodlamalıdır. Tüm koordinatlar **mm**, orijin = planın sol-üst iç köşesi (iç duvar yüzü), +x sağ, +y aşağı; duvarlar iç köşenin dışına (negatif değerlere) taşabilir.

### 13.1 `WALLS` — duvar dikdörtgenleri

`[x0, y0, x1, y1, tip]`, eksen-hizalı dikdörtgen (x0<x1, y0<y1); kalınlık = kısa kenar (ör. 240 mm; 90–540 arası değerler var). Duvarlar **sürekli çizgi değil, parçalıdır**: kapı/pencere/sürgülü kapı boşlukları listede boşluk olarak bırakılır; boşlukta ilgili açıklık dikdörtgeni durur. Köşelerde komşu duvarlar birbirine ekli dikdörtgenlerdir (T/L birleşimleri için ayrı parçalar). Tip:
- `'b'` taşıyıcı (yıkılamaz; siyah); `'e'` dış duvar (yıkılamaz uyarılı; gri-taş `#8f897d`); `'n'` yıkılabilir taşıyıcı olmayan (açık gri); `'low'` alçak duvar/parapet (3D'de 1 m; yıkılabilir).
- Dizideki **indeks** kimlik olarak kullanılır (`"w"+indeks`); yeni planda diziye sonradan eleman ekleme/silme, kayıtlı `demolished` listelerini bozar — bu yüzden kararlı sıra (veya açık `id` alanı) kullanılmalıdır (özgün kod indeks kullanır).
- Örnek desen (özgün planda): dış halka duvarları `'e'`/`'b'` parçalar; oda ayıran ince duvarlar `'n'`; balkon korkuluğu `'low'`; ıslak hacim ayıran duvarlar `'n'`.

### 13.2 `WINS` — pencereler

`[x0, y0, x1, y1]`: duvar boşluğunu tam dolduran dikdörtgen (uzun kenar duvar boyunca; kısa kenar duvar kalınlığı). Cumba/balkon kenarındaki pencere setleri ince (kalınlık 100 mm) dikdörtgenlerdir. 3D'de denizlik yüksekliği liste indeksine bağlıdır (bkz. §6.6). Sıra 3D denizliği etkiler.

### 13.3 `DOORS` — menteşeli kapılar

Nesne: `{name, rect:[x0,y0,x1,y1], h:[hx,hy], c:[cx,cy], o:[ox,oy], len, entry?}`
- `rect`: kapının açıklığı (duvar boşluğu), 3D'de eşik ve lento için.
- `h`: menteşe noktası (açıklığın bir köşesi/kenarı üzerinde).
- `c`: **kapalı** kapının menteşeden açıklığa doğru uzandığı birim yön (ör. `[0,−1]` = yukarı).
- `o`: **açık** kapının yaprağının 90° açık durumdaki birim yönü (ör. `[−1,0]` = sola).
- `len`: yaprak genişliği (mm; 785–893 arası).
- `entry:true`: giriş kapısı (2D'de turuncu çizgi; 3D'de koyu ceviz rengi; Gezinti başlangıcı buna göre).
2D'de yalnız **açık** yaprak ve kapalı uca giden kesikli çeyrek daire çizilir. 3D'de pivot menteşede, `atan2(−y, x)` ile hesaplanan iki açı arasında döner; başlangıç durumu açıktır.

### 13.4 `SLIDES` — sürgülü kapılar

`{rect:[x0,y0,x1,y1], v:bool}` : `v:true` dikey (açıklık y boyunca uzanır, 2,4 m yükseklik), `v:false` yatay (2,1 m). Yalnız görsel; etkileşimsiz, çarpışmasız.

### 13.5 `ROOMS` — odalar

`{id, name, poly:[[x,y],…], mat, at:[x,y]?, counted?:false}`
- `poly`: **iç net** çokgen (iç duvar yüzleri; genelde dikdörtgen, L şekilli olanlar için 8 köşeli). Alan = ayakkabı bağı (shoelace) / 1e6 = m² (net iç ölçü).
- `mat`: varsayılan zemin anahtarı (§9.4).
- `at`: ad+alan etiketinin merkezi (yoksa etiket yok, cumbalarda yok).
- `counted:false`: cumba/balkon çıkıntısı; net alana ve 3D odalar listesine dahil değil; 3D'de 0,45 m yüksekliğinde platform; ama zemin malzeme maliyetine dahil.
- Oda kimliği state'te ad+malzeme için anahtardır; mobilya "odada mı" testi sınır kutusu ile yapılır.

### 13.6 Ölçü zincirleri, sınırlar, diğer sabitler

- Ölçü zinciri: her kenar için segment listesi (mm) + toplam (bkz. §4.8). Yeni planın dış ölçüleri toplamı, duvar kalınlıkları dahil.
- `BOUNDS = {x, y, w, h}`: sığdırma kutusu (ölçü zincirlerini kapsar).
- Giriş işareti: giriş kapısının dış tarafında sabit koordinatlı ok+yazı.
- 3D `OX, OY` merkez, `H = 2.8`.
- **Varsayılan mobilya listesi**: `F(tip, ad, cx, cy, w, d, rot=0, renk?)` çağrılarıdır; `renk` verilmezse `typeColor(tip)`. Sıra çizim sırasıdır (sonrakiler üstte; halı en başta).

### 13.7 Oda malzemeleri

Her odanın malzemesi `state.rooms[id].mat` içindedir (§9.4 anahtarları). Kullanıcı yalnızca ad ve malzeme değiştirebilir; çokgen ve etiket noktası sabittir.

---

## 14. Arayüz metinleri (i18n tablosu)

**Mimari**: `tr(zh, en)` yardımcı fonksiyonu geçerli dile göre birini döndürür; statik HTML'de `data-en` (metin) ve `data-en-title` (tooltip) özellikleri vardır, Çince orijinal ilk çeviride `dataset`'e saklanır. Yerleşik oda/malzeme/mobilya adları Çince saklanır ve `NAMES_EN` sözlüğü ile İngilizcede gösterilir; kullanıcı yeniden adlandırdıysa metin olduğu gibi kalır. Dil değişince: `<html lang>`, `document.title`, tüm statik metinler, kitaplık, kapı/giriş etiketi, tüm render'lar, 3D etiketleri ve odalar listesi yeniden kurulur. `document.title`: Çince "户型装修设计", İngilizce "Floor Plan Designer".

Aşağıda üç sütun: **Çince | İngilizce (dosyadaki i18n) | önerilen Türkçe**. "Tür": `etiket` = düğme/etiket metni, `tooltip` = `title` özniteliği, `js` = betikten gelen metin. Yeni uygulamada TR birincil dildir; EN ikincildir (bu tablodaki İngilizce sütunu birebir alınabilir).

### 14.1 Statik ve düz metinler

| Tür | Çince | İngilizce (dosyadaki i18n) | Önerilen Türkçe |
|---|---|---|---|
| etiket | ◧ 家具库 | ◧ Library | ◧ Mobilya |
| etiket | 属性 ◨ | Properties ◨ | Özellikler ◨ |
| etiket | 三室两厅两卫 · 装修设计 | 3BR 2LR 2BA · Interior Design | 3+1 Daire · Dekorasyon Tasarımı |
| tooltip | 切换 2D / 3D (T) | Switch 2D / 3D (T) | 2D / 3D geçiş (T) |
| etiket | 2D 平面 | 2D Plan | 2D Plan |
| etiket | 3D 场景 | 3D Scene | 3D Sahne |
| etiket | 选择 | Select | Seç |
| tooltip | 选择 / 移动 (V) | Select / Move (V) | Seç / Taşı (V) |
| etiket | 测量 | Measure | Ölç |
| tooltip | 测量 (M) | Measure (M) | Ölç (M) |
| etiket | 拆改墙体 | Demolish | Duvar Yık |
| tooltip | 拆改非承重墙 (X) | Demolish non-bearing walls (X) | Taşıyıcı olmayan duvarı yık (X) |
| tooltip | 缩小 | Zoom out | Uzaklaştır |
| tooltip | 放大 | Zoom in | Yakınlaştır |
| etiket | 适应 | Fit | Sığdır |
| tooltip | 适应窗口 (F) | Fit to window (F) | Pencereye sığdır (F) |
| tooltip | 按 1:60 显示（与原图同比例） | Show at 1:60 (same scale as the original plan) | 1:60 göster (özgün planla aynı ölçek) |
| tooltip | 按 1:100 显示 | Show at 1:100 | 1:100 göster |
| etiket | 鸟瞰 | Orbit | Kuşbakışı |
| etiket | 漫游 | Walk | Gezinti |
| etiket | 斜视 | Iso | Eğik |
| etiket | 俯视 | Top | Üstten |
| etiket | 撤销 | Undo | Geri Al |
| tooltip | 撤销 (Ctrl+Z) | Undo (Ctrl+Z) | Geri al (Ctrl+Z) |
| etiket | 重做 | Redo | Yinele |
| tooltip | 重做 (Ctrl+Shift+Z) | Redo (Ctrl+Shift+Z) | Yinele (Ctrl+Shift+Z) |
| etiket | 清空布置 | Clear | Yerleşimi Temizle |
| tooltip | 清空所有家具家电（可撤销） | Remove all furniture and appliances (undoable) | Tüm mobilya ve cihazları kaldır (geri alınabilir) |
| etiket | 尺寸 | Dims | Ölçü |
| etiket | 房间 | Rooms | Odalar |
| etiket | 家具 | Furniture | Mobilya |
| etiket | 网格 | Grid | Izgara |
| etiket | 承重墙 | Bearing walls | Taşıyıcı duvar |
| etiket | 贴墙吸附 | Wall snap | Duvara yapış |
| tooltip | 拖动家具时贴墙吸附 | Snap furniture to walls while dragging | Sürüklerken mobilya duvara yapışsın |
| etiket | 全高墙 | Full walls | Tam duvar |
| etiket | 剖切墙 | Cut walls | Kesik duvar |
| etiket | 房间名 | Labels | Oda adları |
| etiket | 夜景 | Night | Gece |
| etiket | 日照 | Sun | Güneş |
| etiket | 文件 ▾ | File ▾ | Dosya ▾ |
| etiket | 导出图片 | Export image | Görüntüyü dışa aktar |
| etiket | 导出方案 JSON | Export plan JSON | Planı JSON olarak dışa aktar |
| etiket | 导入方案 | Import plan | Planı içe aktar |
| etiket | 重置为默认方案 | Reset to default | Varsayılan plana sıfırla |
| etiket | 房间 · 点击飞到该房间 | Rooms · click to fly there | Odalar · tıklayınca odaya uçulur |
| etiket | 漫游模式 | Walk mode | Gezinti modu |
| etiket | 退出漫游 | Exit walk | Gezintiden çık |
| etiket | 当前比例 | Scale | Geçerli ölçek |
| js | zh-CN | en | tr (html lang) |
| js | 户型装修设计 | Floor Plan Designer | Kat Planı Dekorasyon Tasarımı |
| etiket | EN | 中文 | Dil düğmesi: TR modda "EN", EN modda "TR" |
| js | 没有可撤销的操作 | Nothing to undo | Geri alınacak işlem yok |
| js | 入户 | Entry | Giriş |
| js | 拖动旋转（Shift 自由角度） | Drag to rotate (Shift for free angle) | Döndürmek için sürükle (Shift: serbest açı) |
| js | 拖动调整尺寸 | Drag to resize | Boyutlandırmak için sürükle |
| js | 房间面积 | Room Areas | Oda Alanları |
| js | 点击查看 / 更换地面 | Click to view / change flooring | Zemini görmek / değiştirmek için tıkla |
| js | 套内使用面积 | Net floor area | Net kullanım alanı |
| js | * 飘窗不计入使用面积；面积按墙体内净尺寸计算 | * Bay windows are excluded; areas use net inner wall dimensions | * Cumbalar net alana dahil değildir; alanlar duvar iç net ölçülerinden hesaplanır |
| js | 地面材料估算 | Flooring Estimate | Zemin Malzemesi Tahmini |
| js | 含 5% 损耗 | incl. 5% waste | %5 fire dahil |
| js | 地面材料合计 | Flooring total | Zemin malzemesi toplamı |
| js | 方案统计 | Plan Stats | Plan İstatistikleri |
| js | 家具数量 | Furniture | Mobilya sayısı |
| js | 拆除墙体 | Walls removed | Yıkılan duvar |
| js | 清除测量 | Clear measures | Ölçüleri temizle |
| js | 清空布置 | Clear layout | Yerleşimi Temizle |
| js | 旋转 | Rotate | Döndür |
| js | 复制 | Duplicate | Kopyala |
| js | 删除 | Delete | Sil |
| js | 属性 | Properties | Özellikler |
| js | 完成 | Done | Bitti |
| js | 地面 / 属性 | Floor / Properties | Zemin / Özellikler |
| js | 当前没有布置任何家具 | There is no furniture to clear | Temizlenecek mobilya yok |
| js | 已清空布置，可点「撤销」恢复 | Layout cleared — Undo to restore | Yerleşim temizlendi — geri almak için «Geri Al» |
| js | 收起家具库 ( [ ) | Hide library ( [ ) | Mobilya kitaplığını gizle ( [ ) |
| js | 展开家具库 ( [ ) | Show library ( [ ) | Mobilya kitaplığını göster ( [ ) |
| js | 收起属性面板 ( ] ) | Hide properties ( ] ) | Özellik panelini gizle ( ] ) |
| js | 展开属性面板 ( ] ) | Show properties ( ] ) | Özellik panelini göster ( ] ) |
| js | 房间 | Room | Odalar |
| js | 名称 | Name | Ad |
| js | 使用面积 | Floor area | Kullanım alanı |
| js | 周长 | Perimeter | Çevre |
| js | 开间 | Width | Genişlik (açıklık) |
| js | 进深 | Depth | Derinlik |
| js | 地面材料 | Flooring | Zemin malzemesi |
| js | 材料估价 | Estimated cost | Malzeme tahmini maliyet |
| js | 房间内家具 | Furniture in room | Odadaki mobilyalar |
| js | 暂无 | None | Yok |
| js | ← 返回总览 | ← Back to overview | ← Genel bakışa dön |
| js | 家具属性 | Furniture | Mobilya Özellikleri |
| js | 宽 | Width | Genişlik |
| js | 深 | Depth | Derinlik |
| js | 中心 | Center | Merkez |
| js | 旋转 | Rotation | Döndür |
| js | 颜色 | Color | Renk |
| js | 占地面积 | Footprint | Taban alanı |
| js | 旋转 90° | Rotate 90° | 90° döndür |
| js | 置于顶层 | Bring to front | En üste getir |
| js | 置于底层 | Send to back | En alta gönder |
| js | ← 返回 | ← Back | ← Geri |
| js | 拖动家具移动；拖动上方圆点旋转；拖动右下角方块调整尺寸。开启「贴墙吸附」后靠近墙面会自动贴齐。 | Drag to move; drag the top dot to rotate; drag the bottom-right square to resize. With "Wall snap" on, items snap flush to nearby walls. | Taşımak için mobilyayı sürükleyin; üstteki noktayı sürükleyerek döndürün; sağ alt köşedeki kareyi sürükleyerek boyutlandırın. «Duvara yapış» açıkken duvara yaklaşınca otomatik hizalanır. |
| js | 承重墙（黑色）不可拆除 | Load-bearing walls (black) cannot be removed | Taşıyıcı duvar (siyah) yıkılamaz |
| js | 外墙属于建筑外围护结构，不建议拆除 | Exterior walls are part of the building envelope and should not be removed | Dış duvarlar binanın dış kabuğudur, yıkılması önerilmez |
| js | 已恢复墙体 | Wall restored | Duvar geri getirildi |
| js | 按住拖出测量线，或依次点两点 · 靠近墙面自动吸附 · 点「选择」退出 | Hold and drag a line, or tap two points · snaps to walls · tap "Select" to exit | Basılı tutup çizgi sürükleyin veya iki noktaya dokunun · duvara yaklaşınca yapışır · çıkmak için «Seç» |
| js | 点击两点（或按住拖动）测量距离 · 靠近墙面自动吸附 · Shift 锁定水平/垂直 · Esc 取消 | Click two points (or drag) to measure · snaps to walls · Shift locks horizontal/vertical · Esc cancels | İki noktaya tıklayın (veya sürükleyin) · duvara yaklaşınca yapışır · Shift: yatay/dikey kilit · Esc: iptal |
| js | 点击灰色非承重墙标记拆除，再次点击恢复 · 黑色承重墙不可拆 | Click a grey non-bearing wall to remove it, click again to restore · black bearing walls cannot be removed | Gri (taşıyıcı olmayan) duvara tıklayıp yıkım işaretleyin, tekrar tıklayınca geri gelir · siyah taşıyıcı duvarlar yıkılamaz |
| js | 点击添加，或拖到平面图中的指定位置 | Click to add, or drag onto the plan | Eklemek için tıklayın veya plandaki yere sürükleyin |
| js | 请拖到地面上 | Drop it on the floor | Zemine bırakın |
| js | 户型装修方案 | floor-plan-design | kat-plani-tasarimi |
| js | 点或拖动家具库添加 · 单指拖动平移 · 双指缩放 · 选中家具后底部工具条可旋转 / 复制 / 删除 | Tap or drag from the library · 1 finger pans · pinch zooms · bottom bar rotates / duplicates / deletes | Kitaplıktan dokunun veya sürükleyin · tek parmak kaydırır · iki parmak yakınlaştırır · seçince alt çubuktan döndür / kopyala / sil |
| js | 单指旋转 · 双指缩放 / 平移 · 点家具或地面编辑 · 点门开关 | 1 finger orbits · 2 fingers zoom / pan · tap furniture or floor to edit · tap doors to open | Tek parmak döndürür · iki parmak yakınlaştırır / kaydırır · düzenlemek için mobilyaya veya zemine dokunun · kapıya dokunarak aç/kapat |
| js | 拖动左侧家具到平面图 · 滚轮缩放 · 拖动空白处平移 · T 切换 3D | Drag furniture onto the plan · scroll to zoom · drag empty space to pan · T for 3D | Soldaki mobilyayı plana sürükleyin · tekerlek yakınlaştırır · boşluğu sürükleyerek kaydırın · T: 3D |
| js | 3D 场景与平面方案实时同步 · 右侧面板修改会立即生效 · T 返回 2D | 3D stays in sync with the plan · panel edits apply instantly · T for 2D | 3D sahne plan ile anlık senkron · sağ paneldeki değişiklikler hemen uygulanır · T: 2D |
| js | 3D 引擎仍在加载或加载失败（需要联网加载 three.js） | 3D engine is still loading or failed to load (three.js needs a network connection) | 3D motoru hâlâ yükleniyor veya yüklenemedi (three.js için ağ bağlantısı gerekir) |
| js | 已按 1:60 显示（与原始户型图同比例） | Showing at 1:60 (same scale as the original plan) | 1:60 gösteriliyor (özgün plan ile aynı ölçek) |
| js | 当前浏览器不支持网页全屏，可在 Safari 中「添加到主屏幕」后以全屏方式打开 | Fullscreen is not supported here — in Safari, use "Add to Home Screen" to open it fullscreen | Bu tarayıcı tam ekranı desteklemiyor — Safari’de «Ana Ekrana Ekle» ile tam ekran açın |
| js | 无法进入全屏 | Could not enter fullscreen | Tam ekrana geçilemedi |
| js | 退出全屏 | Exit fullscreen | Tam ekrandan çık |
| js | 全屏 | Fullscreen | Tam ekran |
| js | 方案已导入 | Plan imported | Plan içe aktarıldı |
| js | 文件格式不正确 | Invalid file format | Dosya biçimi geçersiz |
| js | 恢复为默认设计方案？（可撤销） | Reset to the default design? (undoable) | Varsayılan tasarıma dönülsün mü? (geri alınabilir) |
| js | 全屋 | Whole home | Tüm daire |
| js | 单指旋转 · 双指缩放 / 平移 · 点选家具后可拖动摆放 · 点门开关 | 1 finger orbits · 2 fingers zoom / pan · select furniture to drag it · tap doors to open | Tek parmak döndürür · iki parmak yakınlaştırır / kaydırır · seçili mobilyayı sürükleyip yerleştirin · kapıya dokunarak aç/kapat |
| js | 左键旋转 · 右键平移 · 滚轮缩放 · 选中家具后拖动可摆放 · 点击门开关 | Left-drag orbits · right-drag pans · scroll zooms · select furniture to drag it · click doors to open | Sol tuş: döndür · sağ tuş: kaydır · tekerlek: yakınlaştır · seçili mobilyayı sürükleyip yerleştir · kapıya tıklayarak aç/kapat |
| js | 左下摇杆移动 · 拖动画面转向 · 点门开关 | Joystick moves · drag to look · tap doors to open | Sol alttaki joystick ile yürü · ekranı sürükleyerek bak · kapıya dokunarak aç/kapat |
| js | WASD 移动 · 鼠标转向 · Shift 快走 · E 开关门 · Esc 暂停 | WASD moves · mouse looks · Shift runs · E opens doors · Esc pauses | WASD: yürü · fare: bak · Shift: hızlı yürü · E: kapı aç/kapat · Esc: duraklat |
| js | 点击开始，从入户门进入 | Tap to start at the front door | Başlamak için tıklayın (giriş kapısından girilir) |
| js | 左下摇杆移动 · 在画面上拖动转向 | Joystick moves · drag on screen to look | Sol alttaki joystick ile yürü · ekranı sürükleyerek bak |
| js | 点门开关 · 点「退出漫游」回到鸟瞰 | Tap doors to open · "Exit walk" returns to orbit | Kapıya dokunarak aç/kapat · «Gezintiden çık» ile kuşbakışına dön |
| js | 点击开始，从入户门进入 | Click to start at the front door | Başlamak için tıklayın (giriş kapısından girilir) |

### 14.2 Değişkenli ve uzun metinler

| Bağlam | Çince | İngilizce | Önerilen Türkçe |
|---|---|---|---|
| Alt başlık | `套内使用面积约 ${a} m² · 尺寸单位 mm · 原图比例 1:60` | `Net floor area ≈ ${a} m² · Units: mm · Original scale 1:60` | `Net kullanım alanı ≈ ${a} m² · Birim: mm · Özgün plan ölçeği 1:60` |
| Duvar alanı (oda paneli) | `墙面面积（层高 2.8m，未扣门窗）约 ${x} m²` | `Wall area (2.8m ceiling, openings not deducted) ≈ ${x} m²` | `Duvar alanı (tavan 2,8 m, kapı/pencere düşülmeden) ≈ ${x} m²` |
| Mobilya sayısı (oda paneli) | `${n} 件` | `${n} items` | `${n} adet` |
| Temizle onayı | `确定清空全部 ${n} 件家具 / 家电吗？\n墙体、地面材料和测量线会保留，可点「撤销」恢复。` | `Remove all ${n} furniture / appliance items?\nWalls, flooring and measurements are kept. You can Undo this.` | `${n} mobilya / cihazın tamamı kaldırılsın mı?\nDuvarlar, zemin malzemeleri ve ölçüler korunur. «Geri Al» ile geri getirebilirsiniz.` |
| Ekleme toast'ı | `已添加「${ad}」${w}×${d}` | `Added "${nm(ad)}" ${w}×${d}` | `«${ad}» eklendi ${w}×${d}` |
| Yıkım toast'ı | `已标记拆除 ${mm} mm 墙体` | `Marked ${mm} mm of wall for removal` | `${mm} mm duvar yıkım için işaretlendi` |
| Kitaplık ipucu (fare) | `家具按真实尺寸（mm）绘制。点击添加到画面中央，或直接拖到平面图 / 3D 地面上。添加后可在右侧修改宽深与颜色。` | `Furniture is drawn at real size (mm). Click to add at the center, or drag onto the plan / 3D floor. Edit size and color in the right panel afterwards.` | `Mobilyalar gerçek ölçüde (mm) çizilir. Tıklayarak ekranın ortasına ekleyin veya plana / 3D zemine sürükleyin. Eklendikten sonra sağ panelden genişlik, derinlik ve rengi değiştirebilirsiniz.` |
| Kitaplık ipucu (dokunmatik) | `…点一下放到画面中央，或按住向右拖到平面图 / 3D 地面上的指定位置（上下滑动为滚动列表）。…` | `…Tap to place at the center, or hold and drag right onto the plan / 3D floor (swipe up/down to scroll).…` | `…Dokunarak ortaya yerleştirin veya basılı tutup sağa, plana / 3D zemine sürükleyin (yukarı-aşağı kaydırma listeyi kaydırır).…` |
| Kitaplık kartı tooltip'i | `点击添加，或拖到平面图中的指定位置` | `Click to add, or drag onto the plan` | `Eklemek için tıklayın veya plandaki yere sürükleyin` |

**Sağ panel — Dokunmatik Kontroller bölümü** (yalnız dokunmatik):

| Çince (tuş → açıklama) | İngilizce | Önerilen Türkçe |
|---|---|---|
| 触屏操作 | Touch Controls | Dokunmatik Kontroller |
| 单指拖动 → 空白处平移画面 | 1-finger drag → Pan on empty space | Tek parmak sürükle → Boşlukta görüntüyü kaydırır |
| 双指 → 捏合缩放、拖动平移 | 2 fingers → Pinch to zoom, drag to pan | İki parmak → Sıkıştırarak yakınlaştır, sürükleyerek kaydır |
| 家具库 → 点一下放到画面中央，或按住向右拖到指定位置 | Library → Tap to place at center, or hold and drag right to a spot | Kitaplık → Dokun: ortaya yerleştirir; basılı tutup sağa sürükle: istenen yere |
| 点家具 → 选中后拖动移动；拖顶部圆点旋转、右下方块改尺寸 | Tap item → Drag to move; top dot rotates, bottom-right square resizes | Mobilyaya dokun → Sürükleyerek taşı; üst nokta döndürür, sağ-alt kare boyutlandırır |
| 工具条 → 选中后底部可旋转 / 复制 / 删除 | Toolbar → Bottom bar can rotate / duplicate / delete | Araç çubuğu → Seçince alttaki çubuktan döndür / kopyala / sil |
| 测量 → 按住拖出一条线，或依次点两点 | Measure → Hold and drag a line, or tap two points | Ölç → Basılı tutup çizgi sürükle veya iki noktaya dokun |
| 3D 漫游 → 左下摇杆移动，拖动屏幕转向，点门开关 | 3D walk → Joystick moves, drag to look, tap doors to open | 3D Gezinti → Joystick ile yürü, ekranı sürükleyerek bak, kapıya dokunarak aç/kapat |

**Sağ panel — Klavye Kısayolları bölümü:**

| Çince (tuş → açıklama) | İngilizce | Önerilen Türkçe |
|---|---|---|
| 键盘快捷键 | Keyboard Shortcuts | Klavye Kısayolları |
| 拖拽 → 左侧家具拖入平面图 | Drag → Drag furniture onto the plan | Sürükle → Soldaki mobilyayı plana sürükle |
| V → 选择 / 移动 | V → Select / move | V → Seç / taşı |
| M → 测量（Shift 水平/垂直） | M → Measure (Shift: horizontal/vertical) | M → Ölç (Shift: yatay/dikey) |
| X → 拆改非承重墙（黑色为承重墙） | X → Demolish non-bearing walls (black = bearing) | X → Taşıyıcı olmayan duvarı yık (siyah = taşıyıcı) |
| R → 旋转 90°（Shift 反向） | R → Rotate 90° (Shift reverses) | R → 90° döndür (Shift: ters yön) |
| 方向键 → 微调 10mm（Shift 100mm） | Arrows → Nudge 10mm (Shift 100mm) | Ok tuşları → 10 mm ince ayar (Shift: 100 mm) |
| ⌘/Ctrl D → 复制 | ⌘/Ctrl D → Duplicate | ⌘/Ctrl D → Kopyala |
| Delete → 删除 | Delete → Delete | Delete → Sil |
| ⌘/Ctrl Z → 撤销 | ⌘/Ctrl Z → Undo | ⌘/Ctrl Z → Geri al |
| T → 切换 2D / 3D | T → Toggle 2D / 3D | T → 2D / 3D geçiş |
| F → 适应窗口 | F → Fit to window | F → Pencereye sığdır |
| Esc → 取消选择 | Esc → Deselect | Esc → Seçimi kaldır |

**Gezinti kaplaması metinleri** (`kbd` biçimli): "点击开始，从入户门进入 / Click to start at the front door / Başlamak için tıklayın (giriş kapısından girilir)"; "`W A S D` 移动 · 鼠标转向 · `Shift` 快走 / `W A S D` move · mouse looks · `Shift` runs / `W A S D` yürü · fare: bak · `Shift` hızlı"; "`E` 开关正前方的门 · `Esc` 暂停 / `E` opens the door ahead · `Esc` pauses / `E` önündeki kapıyı açar/kapatır · `Esc` duraklat".

**İngilizcede çevrilmeyen istisnalar (özgündeki tutarsızlıklar):** alt çubuk hover metnindeki oda adı (`state.rooms[…].name` ham); "Giriş/Entry" etiketi çevrilir; mobilya etiketleri (2D) `nm()` ile çevrilir.

---

## 15. Uygulama sırasında dikkat edilecek ek davranış ayrıntıları

- **Yeniden çizim maliyeti**: 2D sürüklemede yalnız `gFurn` + `gSel` yeniden yazılır; bırakınca `renderAll`. Yeni uygulama da bu ayrımı korumalı (aksi halde 60 mobilyalı planda sürükleme yavaşlar).
- **Ölçü/seçim yazıları ekran boyutunda**: `gSel` ve `gMeasure`, `view` her değiştiğinde (zoom/pan) yeniden çizilir ki 12 px yazı ve 5–6 px tutamaçlar mm'ye çevrilerek sabit ekran boyutunda kalsın.
- **Katman `Mobilya` kapalıyken** mobilya tıklanamaz; seçim çerçevesi yine çizilebilir (`gSel` ayrı).
- **Fab (yüzen çubuk)**: seçili nesne yoksa gizlenir; oda seçiliyken de görünür (`Zemin / Özellikler` yalnız dar ekranda).
- **Sağ panelin kendi kendini yenilemesi**: panel HTML'i her `renderAll`'da baştan kurulur (girdi odağı kaybolur; alan değişiklikleri `change` olayında uygulandığı için sorun olmaz).
- **Odada sürükle-bırak hedefi**: 2D'de `elementFromPoint` ile açık çekmece / fab / gezinti kaplaması / joystick üzerine bırakma reddedilir.
- **Yıkım işareti alanları etkilemez**; yıkılan duvarın altındaki zemin, oda çokgenlerinin kendi malzemesiyle çizilir (oda çokgenleri iç duvar yüzünde bittiğinden yıkık duvarın izi 2D'de boş kağıt rengi, 3D'de dış zemin rengi olarak kalır; yalnız kesikli kırmızı çerçeve görünür).
- **3D `sync`**: 3D etkin değilken (`active=false`) senkron yapılmaz; 3D'ye girişte `sync(true)` tam kurulum yapar.
- **Dil değişimi**: kapı/giriş yazısı (`Giriş/Entry`), kitaplık, 3D oda listesi ve etiketleri dahil her şey yeniden kurulur; mod ipucu ve tam ekran düğmesi metni güncellenir.
- **Standalone/PWA**: `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `viewport-fit=cover`, `maximum-scale=1,user-scalable=no`; standalone modda "Tam ekran" düğmesi gizlenir.
- **Sayı biçimleri**: alanlar `toFixed(2)` (oda) / `toFixed(1)` (malzeme toplamı, duvar alanı, çevre); para `Math.round(...).toLocaleString()`; ölçüler tamsayı mm.

---

## 16. Ekran görüntüleri (`spec/shots/`)

Hepsi Chromium (headless, SwiftShader WebGL) ile, özgün dosya yerel `http.server` üzerinden açılarak alınmıştır. three.js CDN'e (jsDelivr) bu ortamda erişilemediği için (proxy 403) aynı sürüm (`three@0.160.0`) npm'den indirilip Playwright ile CDN adresine yönlendirilmiştir; görüntüler bu nedenle gerçek 3D çıktıyı içerir. Görüntülerde yerleşik Çince arayüz, özgün Çin planı ve varsayılan mobilya düzeni vardır (yeni uygulamada Türkçe metin ve Türk planı olacak). Bazı görüntüler birbirinin ardından çekildiği için önceki adımların durumu (ör. 3 yıkılmış duvar, iki ölçü çizgisi) taşınır.

| Dosya | Boyut | Gösterdiği |
|---|---|---|
| `01-2d-varsayilan.png` | 1440×900 | Varsayılan 2D görünüm: iki satırlı üst bar (Mobilya/Özellikler, marka, 2D/3D anahtarı, araçlar, zoom, geri al grubu; ikinci satırda katman chip'leri, sağda EN/Tam ekran/Dosya), sol kitaplık (Yatak Odası kategorisi, 2 sütun kart), ortada plan ve ölçü zincirleri, ölçek çubuğu "2 m", sağ panelde Oda Alanları + Zemin Malzemesi tahmini + Plan İstatistikleri (kısmen), alt çubuk (X/Y/ölçek 1:69/ipucu). |
| `02-mobilya-secili.png` | 1440×900 | Ana yatak odasındaki çift kişilik yatak seçili: kesikli turuncu çerçeve, üstte döndürme tutamacı, sağ-altta boyut karesi, "1800 × 2000" yazısı, alt-ortada yüzen çubuk (Ad · ↺ ↻ Döndür · Kopyala · Sil · Bitti), sağ panelde Mobilya Özellikleri formu. |
| `03-olcu-araci.png` | 1440×900 | Ölçü aracı: araç "Ölç" seçili, üstte koyu ipucu hapı, plana iki kalıcı ölçü çizgisi (turuncu, "3553 mm" ve teal geçici çizgi "3695 mm" imleç izlerken), tikler ve dönük yazı. |
| `04-duvar-yikma.png` | 1440×900 | Duvar yık aracı: gri yıkılabilir duvarlardan üçü kesikli kırmızı çerçeveyle işaretli (çamaşır balkonu çevresi), "1366 mm duvar yıkım için işaretlendi" toast'ı, üstte araç ipucu hapı. |
| `05-2d-katmanlar-tasiyici-grid.png` | 1440×900 | "Izgara" ve "Taşıyıcı duvar" katmanları açık: 0,5/1 m ızgara deseni, taşıyıcı duvarlar kırmızı (`#b8412c`). |
| `06-sag-panel-malzemeler.png` | 1440×900 | Salon odası seçili: oda vurgusu (turuncu çerçeve), sağ panelde Oda formu (ad, alan 21.53, çevre 18.8, genişlik 5450, derinlik 3950, duvar alanı), 8 zemin malzemesi kartı (seçili olan turuncu halkalı), malzeme maliyeti ¥4,973, odadaki mobilya listesi; alt-ortada fab (Ad · Bitti). |
| `06b-sag-panel-genel.png` | 1440×900 | Seçim kaldırılmış genel bakış paneli (Escape sonrası). |
| `07-3d-kus-bakisi.png` | 1440×900 | 3D varsayılan izometrik kuşbakışı: tam yükseklik duvarlar, sol panelde "Odalar" listesi + kitaplık, 3D-özel üst bar grupları (Kuşbakışı/Gezinti, Eğik/Üstten, Geri al grubu, Tam/Kesik duvar, Mobilya/Oda adları/Gece; ikinci satırda Güneş kaydırıcısı 10:00), tuval üstünde ipucu hapı (oda etiketleri bu karede henüz belirmemiş; animasyonun hemen sonrasıdır, sonraki karelerde görünür). |
| `08-3d-kesik-duvar.png` | 1440×900 | "Kesik duvar" (1,2 m): duvar tepeleri açık, iç mekan ve mobilya görünür, oda etiketleri (adı + alan) görünür, "Kesik duvar" chip'i açık. |
| `09-3d-gece.png` | 1440×900 | "Gece" açık: koyu arka plan/zemin, sıcak tavan lambası ışıkları, oda etiketleri ve ipucu hapı. |
| `10-3d-gun-batimi-16-30.png` | 1440×900 | Güneş kaydırıcısı 16:30: güneş rengi/yönü, uzayan ve turuncuya dönen aydınlatma. |
| `11-3d-ustten.png` | 1440×900 | "Üstten" hazır kamera: neredeyse dik üstten bakış, etiketler görünür. |
| `12-3d-salona-ucus.png` | 1440×900 | Odalar listesinden "Salon" seçildi: kamera odaya uçtu (900 ms sonrası), listede "Salon" düğmesi vurgulu. |
| `12b-3d-ana-yatak-odasi.png` | 1440×900 | Aynı, "Ebeveyn Yatak Odası" odasına uçuş. |
| `13-3d-gezinti-baslangic-overlay.png` | 1440×900 | Gezinti moduna geçiş: giriş kapısı dışında göz yüksekliğinde kamera, başlangıç kaplaması (Gezinti modu kartı, W A S D / E / Esc satırları), üst ipucu hapı; Gezinti düğmesi aktif. |
| `14-mobil-2d.png` | 390×844 (2× DPR) | Mobil 2D: üst bar 5–6 satıra sarılarak ekranın yaklaşık yarısını kaplar; plan sığdırılmış; ölçek çubuğu "5 m"; kesik ipucu alt çubukta. |
| `15-mobil-kutuphane-cekmece.png` | 390×844 (2×) | Sol mobilya çekmecesi açık: 3 sütun kart, sağ kenar gölgesi, arkada plan görünür. |
| `16-mobil-panel-cekmece.png` | 390×844 (2×) | Sağ Özellikler çekmecesi açık: Oda Alanları listesi. |
| `17-mobil-3d.png` | 390×844 (2×) | Mobil 3D görünümü (kuşbakışı). |
| `18-mobil-gezinti-overlay.png` | 390×844 (2×) | Mobilde Gezinti başlangıç kaplaması (dokunmatik metinler). |
| `19-mobil-gezinti-joystick.png` | 390×844 (2×) | Dokunmatik gezinti: sol-altta 130 px şeffaf joystick (topuz yukarı itilmiş), sağ-altta "Gezintiden çık" düğmesi, salon içinde birinci şahıs görünüm. |
| `20-3d-gezinti-masaustu.png` | 1440×900 | Masaüstü gezinti aktif (imleç kilitli): merkezde artı işareti, kaplama gizli, birinci şahıs salon görünümü. |
| `21-3d-gezinti-ingilizce.png` | 1440×900 | Aynı sahne İngilizce arayüzle (dil düğmesi "中文"). |
| `22-2d-ingilizce.png` | 1440×900 | 2D arayüz İngilizce: tüm etiketler, mobilya/oda adları, tablolar çevrilmiş; alt başlık "Net floor area ≈ 87.18 m² …". |
| `23-ingilizce-oda-paneli.png` | 1440×900 | İngilizce modda mutfak seçili oda paneli. |
| `24-dar-1024-2d.png` | 1024×768 | Dar kesme noktası (≤1100): paneller çekmeceye dönüşmüş (kapalı), plan tam genişlik; üst bar 2 satır; alt çubukta yalnız ipucu. |

---

## 17. Belirsiz noktalar, tutarsızlıklar ve ortam notları

**Ortam / CDN**: Özgün dosya `https://cdn.jsdelivr.net/npm/three@0.160.0/…` adresinden importmap ile yüklenir (bu ortamda 403). Playwright `route` ile yerel npm paketine yönlendirilerek çalıştırıldı; **özgün dosya değiştirilmedi**. Yeni uygulama CDN'e bağımlı kalmamak isterse three.js r160'ı (MIT) yerel olarak paketleyebilir; görünüm three.js sürümüne duyarlıdır (ACES ton eşleme, `RoundedBoxGeometry`, ışık birimleri r155+ fiziksel ışık modeli; r160 kullanılmalı).

**Özgündeki gözlenen tutarsızlıklar (birebir mi düzeltilsin karar verilmeli):**
1. Boyutlandırma tutamacı en az 100 mm, sağ paneldeki genişlik/derinlik girdisi en az 50 mm kabul eder.
2. Alt çubuktaki oda hover metni oda adını çevirmeden gösterir (İngilizce modda Çince görünür).
3. `--teal` değişkeni tanımlı ama CSS'te kullanılmıyor; JS'te aynı renk sabit.
4. `.narrow-only` sınıfı CSS'te tanımlı ama hiçbir öğede kullanılmıyor (fab'daki "Özellikler" düğmesi hariç, o dar ekranda gösteriliyor).
5. Yıkılan duvarlar alan hesabına yansımaz, zemin/oda çokgenleri birleşmez.
6. Cumba alanı net alana girmez ama zemin malzemesi maliyetine girer.
7. "Odadaki mobilyalar" listesi çokgen değil sınır kutusu kullanır (L şekilli odalarda komşu alan mobilyaları listelenebilir).
8. Gezinti sırasında klavye kısayolları (T dahil) kilit açıkken bile kapalıdır; `keys` durumu pencere odağı kaybında temizlenmez (takılı tuş riski).
9. Mobilya çarpışması gezintide yok; pencereler yürümeye engeldir (cam dahil), sürgülü kapı açıklığı ise duvar listesinde yer almadığından geçilebilir.
10. 3D'de kapılar her mimari yeniden kurulumda (oda malzemesi değişimi, yıkım, kesit) tekrar "açık" başlar.
11. Kesik duvar modunda kapı yaprağı ve cam da 1,2 m ile kırpılır.
12. Mobil (390 px) üst bar ekranın ~%45'ini kaplar; tuval 432 px kalır. Bu davranış korunacaksa aynen; iyileştirilecekse sapma olarak belgelenmeli.
13. Pencere denizliği yükseklikleri pencere dizisindeki indekse bağlıdır (veri modelinde alan yok).
14. Aynı `PointLight` ışıkları (11 adet, gece) hafif cihazlarda maliyetli olabilir; özgünde bir sınırlama yoktur.

**Doğrulanamayan / yaklaşık bırakılan noktalar:**
- Piksel-altı font metrikleri (Çince fontla alınan ölçümler; Türkçe metin uzunlukları farklı olacağı için üst bar sarılma noktaları kayacaktır — bu bir sapma değil beklenen sonuçtur, ancak 1440 px'te de iki satır olması hedeflenmelidir).
- 3D modellerde küçük süs nesnelerinin tam konum/rastgele dağılımı tohumlu rastgeleliğe bağlıdır; bire bir aynı kitap dizilimi gerekiyorsa mulberry32 (tohum formülü §7) birebir uygulanmalıdır.
- `RoomEnvironment` çıktısı yalnız metal/parlak malzemeleri etkiler; kurulum sırası (`envTex` malzeme önbelleğinden önce hazırdır) yeniden yazımda korunmalıdır, aksi halde önbelleğe alınmış malzemeler env almaz.
- İmleç kilidi (PointerLock) headless ortamda çalıştı (artı işareti görünür); gerçek cihazlarda `pointerlockerror` durumunda joystick moduna düşme davranışı yalnız koddan doğrulandı.
