# Kat Planı Tasarımı

Tarayıcıda çalışan 2D/3D daire dekorasyon aracı. Türk 3+1 örnek dairesi üzerinde mobilya yerleştirme, duvar yıkma, ölçüm, zemin malzemesi maliyeti (₺) ve 3D gezinti.

## Kullanım
`index.html` dosyasını tarayıcıda açın. Kurulum gerekmez; 3D sahne için three.js jsDelivr'den yüklenir (internet gerekir). Yerel sunucu isterseniz:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Özellikler
- **2D plan:** 60 öğelik mobilya kütüphanesi (sürükle-bırak), taşı/döndür/boyutlandır, duvara yapışma, ölçü aracı, taşıyıcı olmayan duvarları yıkma, katmanlar, 1:60 / 1:100 ölçek
- **3D sahne:** kuş bakışı, eğik ve üstten görünüm, odaya uçuş, tam/kesik duvar, güneş saati, gece ışıkları, kapı açma
- **Gezinti:** masaüstünde WASD + fare, dokunmatikte sanal joystick, `E` ile kapı
- **Hesap:** oda alanları, net kullanım alanı, oda başına zemin malzemesi ve %5 fireli maliyet tahmini
- **Kayıt:** geri al/yinele, tarayıcıda otomatik kayıt, JSON dışa/içe aktarma, PNG dışa aktarma
- **Dil:** Türkçe (varsayılan) ve İngilizce

## Kısayollar
| Tuş | İşlev |
|---|---|
| `T` | 2D / 3D |
| `V` / `M` / `X` | Seç / Ölç / Duvar yık |
| `R` / `Shift+R` | 90° döndür |
| `Delete` | Sil |
| `Ctrl+D` | Çoğalt |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Geri al / Yinele |
| `F` | Sığdır |
| `[` / `]` | Panelleri aç/kapa |
| Gezinti: `WASD`, `Shift`, `E` | Yürü, hızlı yürü, kapı |

## Geliştirme
Kaynak parçalar `src/` altında; `python3 build.py` bunları tek dosyalık `index.html`'e birleştirir.

| Dosya | İçerik |
|---|---|
| `src/data.js` | Plan (duvar, kapı, pencere, oda), mobilya kütüphanesi, malzeme fiyatları, varsayılan yerleşim |
| `src/app.js`, `src/shell.html`, `src/styles.css` | Arayüz, 2D editör, panel, kayıt |
| `src/view3d.js` | 3D sahne, ışık, geçişler, gezinti |
| `src/models3d.js` | 45 mobilya tipinin 3D modeli |

Kendi dairenizi kullanmak için `src/data.js`'teki plan verisini değiştirin. Zemin fiyatları 2026 için tahmindir, aynı dosyadan güncellenir.

`spec/` klasörü, arayüzün esinlendiği uygulamanın davranış incelemesidir (kod içermez).

## Kaynak
Arayüz ve davranış [wy51ai/floorplan-3d](https://github.com/wy51ai/floorplan-3d) uygulamasından esinlenmiştir; kod sıfırdan yazılmıştır.
