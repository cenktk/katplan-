# Özellik Kontrol Listesi — Birebir Karşılaştırma

Amaç: Yeni (Türkçe) uygulamayı özgün Çince uygulamayla madde madde karşılaştırmak. Her maddenin sonunda **Nasıl doğrulanır** yer alır. Ayrıntı için `SPEC.md` bölüm numaraları `[§…]` ile verilmiştir. "Beklenen" değerler özgün uygulamanın 1440×900 pencerede ölçülmüş çıktısıdır; metinler Türkçeleşeceği için sarılma noktaları kayabilir (ayrı işaretli). Referans görüntüler: `shots/`.

Durum sütunu boş bırakılmıştır; test eden `[ ]` işaretini doldurur.

---

## A. Genel yerleşim ve tema

1. [ ] **Üç sütunlu grid**: sol kitaplık 236 px, sağ panel 300 px, orta esnek; üst bar `auto`, alt çubuk 30 px. [§1.1]
   *Doğrula*: 1440×900'de DevTools ile `aside.lib` genişliği 236, `aside.right` 300, `footer` yüksekliği 30, `main` 904 px olmalı.
2. [ ] **Sayfa kaydırması yok**: `html, body` `overflow:hidden`; yalnız paneller kendi içinde kaydırılır. [§1.1]
   *Doğrula*: Sayfayı tekerlekle/dokunarak kaydırmaya çalış; sayfa hareket etmemeli, sol kitaplık ve sağ panel dikey kaydırılabilmeli.
3. [ ] **Renk paleti**: `--bg #f3efe7`, `--paper #f7f4ee`, `--panel #fffdf9`, `--line #e3dccf`, `--ink #2b2824`, `--muted #8a8174`, `--accent #b5653a`, `--accent-soft #f3e3d8`. [§2]
   *Doğrula*: `getComputedStyle(document.documentElement)` ile değişkenleri oku; tuval arka planı `rgb(247,244,238)`, üst bar `rgb(255,253,249)`.
4. [ ] **Gövde tipografisi**: 13 px / 1.5, sistem font yığını; marka başlığı 15 px kalın, letter-spacing .5 px. [§1.2]
   *Doğrula*: `body` computed font-size 13 px; `.brand b` 15 px.
5. [ ] **`.grp` grup kapları**: beyaz, 1 px `--line` kenar, radius 8, padding 2, gap 2. [§1.3]
   *Doğrula*: Herhangi bir üst bar grubunu incele.
6. [ ] **Düğme durumları**: hover `#f2ece2`; `.on` koyu (`--ink`) + beyaz yazı; chip.on açık turuncu arka plan + `--accent` yazı; primary turuncu, hover `#9f5530`; danger yazı `#b3372a`. [§1.3]
   *Doğrula*: Fareyle üzerine gel, "Seç/Ölç/Yık" aç-kapa; "Tam duvar" chip'i; "Gezintiden çık" hover.
7. [ ] **Buton ölçüleri**: normal düğme yüksekliği 30 px, padding `5px 9px`, radius 6. [§1.3]
   *Doğrula*: "Geri Al" düğmesi ≈ 44×30 (Çince); Türkçede yükseklik 30 olmalı.
8. [ ] **Toast**: alt-orta (`bottom:110px`), koyu, 1800 ms görünür, 0,25 s geçiş, alttan kayarak. [§1.3]
   *Doğrula*: Bir mobilya ekle → toast; süreyi ve konumu ölç.
9. [ ] **Alt durum çubuğu**: `X`, `Y` (mm), `Geçerli ölçek 1:NN`, hover oda adı+alan, sağda ipucu; 30 px, 12 px muted. [§1.3]
   *Doğrula*: Fareyi planda gezdir; X/Y canlı güncellenir; oda üstünde ad ve alan görünür; ipucu taşarsa "…".
10. [ ] **Ölçek çubuğu**: sol-alt, "2 m" gibi metin + 6 px çubuk; uzunluk = `nice × s` px, `nice ∈ [100,200,500,1000,2000,5000]` içinden ≥60 px olan ilk. [§1.3]
    *Doğrula*: Zoom yap; metin 500 mm→1 m→2 m… sıçrar, çubuk genişliği 60–150 px aralığında kalır.
11. [ ] **Geniş ekranda panel daraltma**: `[` ve `]` tuşları ve üst bar düğmeleri panelleri 0,3 s animasyonla daraltır/açar; seçim `huxing-panes`'te saklanır. [§1.7]
    *Doğrula*: `[`'e bas → sol panel kaybolur, tuval genişler; sayfayı yenile → durum korunur.
12. [ ] **Dar ekranda çekmece**: ≤1100 px'te paneller `min(320px,86vw)` çekmece, aynı anda biri açık, tuvale dokununca kapanır. [§1.7]
    *Doğrula*: Pencereyi 1024 px yap; `[` ile sol çekmece kayarak açılır (gölgeli); tuvale tıklayınca kapanır; `]` açınca sol kapanır.
13. [ ] **Dar ekranda kitaplık 3 sütun**, marka alt başlığı ve alt çubuktaki X/Y/ölçek gizli. [§1.7]
    *Doğrula*: 1024 px; kitaplık çekmecesinde 3 kart/satır; alt çubukta yalnız ipucu.
14. [ ] **Dokunmatik boyutlar**: `pointer:coarse` iken düğme min yükseklik 38, seg düğmeleri 92 px, form yazısı 16 px, sürükleme eşiği 9 px. [§1.7]
    *Doğrula*: Chrome DevTools'ta dokunmatik emülasyonu; ölçüleri karşılaştır.
15. [ ] **Mobil üst bar**: 390×844'te üst bar ~382 px, tuval ~432 px. [§1.7]
    *Doğrula*: `shots/14` ile birebir kıyasla; grupların sarılma sırası (paneller · marka · segment · araçlar · zoom · geri al · katmanlar · EN/Tam ekran/Dosya).

## B. Üst bar

16. [ ] **Grup sırası (2D)**: Mobilya/Özellikler · marka · 2D/3D · Seç-Ölç-Yık · zoom grubu · Geri Al-Yinele-Temizle · katmanlar · (boşluk) · EN · Tam ekran · Dosya. [§3]
    *Doğrula*: 1440 px'te sıra ve 2 satırlı sarma (`shots/01`).
17. [ ] **Grup sırası (3D)**: Mobilya/Özellikler · marka · 2D/3D · Kuşbakışı-Gezinti · Eğik-Üstten · Geri al grubu · Tam/Kesik duvar · Mobilya-Oda adları-Gece · Güneş · EN · Tam ekran · Dosya. [§3]
    *Doğrula*: `T` ile 3D'ye geç; `shots/07` ile karşılaştır.
18. [ ] **2D/3D geçiş anahtarı**: 82 px düğmeler, turuncu hap 0,5 s `cubic-bezier(.65,0,.35,1)` ile 84 px kayar, seçili metin beyaz. [§1.3]
    *Doğrula*: Kaydırma süresi/eğrisi (DevTools animasyon paneli); hap gölgesi `0 2px 6px rgba(181,101,58,.35)`.
19. [ ] **Marka alt başlığı dinamik**: net alan toplamı 2 ondalık + "Birim: mm" + "Özgün plan ölçeği 1:60" biçimi. [§3]
    *Doğrula*: Alan toplamı sağ paneldeki "Net kullanım alanı" ile aynı.
20. [ ] **Araç tooltip'leri kısayol içerir** (V, M, X, F, T, Ctrl+Z…). [§14.1]
    *Doğrula*: Düğmelerin üzerinde `title`.
21. [ ] **Geri Al/Yinele durumu**: boşken opaklık .4 ve devre dışı. [§1.3]
    *Doğrula*: Sayfa ilk açılışında ikisi soluk; bir işlem sonra Geri Al normal.
22. [ ] **Katman chip'leri varsayılanları**: Ölçü/Odalar/Mobilya/Duvara yapış açık; Izgara/Taşıyıcı duvar kapalı. [§3]
    *Doğrula*: İlk açılışta chip'lerin `.on` durumu.
23. [ ] **Dil düğmesi**: mevcut dilin karşıtını yazar; tıklayınca tüm arayüz (statik, dinamik, tooltip, kitaplık, 3D etiketleri) değişir ve `localStorage` anahtarı yazılır. [§14]
    *Doğrula*: Düğmeye bas; sayfayı yenile; dil korunur; `document.documentElement.lang` ve `document.title` güncellenir.
24. [ ] **Tam ekran düğmesi** metni "⛶ Tam ekran"/"Tam ekrandan çık"; Shift+F kısayolu; API yoksa toast. [§3, §11]
    *Doğrula*: Düğme ve kısayol; tam ekrana girince metin değişir.
25. [ ] **Dosya menüsü**: `details` açılır kutu (sağa hizalı, gölge, 0,2 s fade), 4 öğe (görüntü, JSON dışa, içe aktar, sıfırla-danger); dışarı tıklayınca ve öğe seçince kapanır. [§1.3]
    *Doğrula*: Aç, dışarı tıkla, kapanır.

## C. 2D editör — görünüm ve katmanlar

26. [ ] **SVG katman sırası**: grid → odalar → mobilya → duvarlar → açıklıklar → etiketler → ölçüler → ölçü aracı → seçim. [§4.1]
    *Doğrula*: DOM'da `#plan` çocuk sırası; mobilya duvarların ALTINDA çizilir (bir mobilyayı duvara doğru sürükle, duvar üstte kalır).
27. [ ] **Ölçek 1:60 / 1:100**: butonlar `s = 1/(oran × 0,26458)` uygular; alt çubuk "1:60"/"1:100" gösterir. [§4.2]
    *Doğrula*: Butona bas; `viewBox` genişliği = `tuvalGenişliği / s`; alt çubuk oranı.
28. [ ] **Sığdır (F)**: tüm plan + ölçü zincirleri görünür ve ortalı; özgün BOUNDS 15600×14100 mm (kenar payı dahil). [§4.2]
    *Doğrula*: Zoom/pan yap, F'ye bas; 1440'ta oran ≈1:69.
29. [ ] **Zoom sınırları** `s∈[0,012; 2]`; tekerlek `exp(−deltaY×0,0015)`; imleç altı nokta sabit. [§4.2]
    *Doğrula*: Çok zoom out/in; imleç altındaki duvar köşesi kaymamalı; sınırda durur.
30. [ ] **Zoom düğmeleri ×1,25 / ×0,8**, `+ = -` tuşları aynı. [§4.2]
    *Doğrula*: Bir kez bas, `s` oranı 1,25.
31. [ ] **Pan**: boşluk/oda üzerinde sürükleme kaydırır, imleç `grabbing`; orta/sağ tuş pan yapmaz. [§4.2]
    *Doğrula*: Sol sürükle; orta tuş ve sağ tuşla dene.
32. [ ] **Pinch zoom / iki parmak pan**: dokunmatikte orta nokta sabit; ikinci parmak tek parmak eylemini iptal eder. [§4.2]
    *Doğrula*: Dokunmatik emülasyon veya cihaz; ölçü çizerken ikinci parmak koy.
33. [ ] **Izgara katmanı**: 500 mm ince (`#e5dfd3`), 1000 mm kalın (`#d8d0c1`) çizgiler; kapalıyken görünmez ama arka plan tıklanabilir. [§4.3]
    *Doğrula*: Izgarayı aç; zoom'da çizgi aralıkları planla ölçeklenir.
34. [ ] **Duvar renkleri**: taşıyıcı `#26241f`, dış `#8f897d`, yıkılabilir `#a7a195`, alçak `#e9e3d8` + 1 px `#8f897d` kenar. [§2]
    *Doğrula*: SVG `fill` değerleri.
35. [ ] **Taşıyıcı duvar katmanı**: açınca taşıyıcı duvarlar `#b8412c`. [§4.5]
    *Doğrula*: Chip'i aç (`shots/05`).
36. [ ] **Zemin desenleri (2D)**: 8 malzemenin desen boyutları (1800×360, 800, 600, 300, 1200, 500, 120) ve renkleri. [§4.4]
    *Doğrula*: Her odaya sırayla her malzemeyi ata; derz aralıklarını mm olarak ölç (ör. 800'lük karo 800 mm).
37. [ ] **Pencere sembolü**: `#f7fbfd` dolgu, `#4f7394` çizgi, uzun kenara paralel iki iç çizgi (1/3, 2/3). [§4.6]
    *Doğrula*: Herhangi bir pencereyi yakınlaştır.
38. [ ] **Kapı sembolü**: açık beyaz yaprak (40 mm kalın) + kesikli çeyrek daire yay (5 3, .7 opak); giriş kapısı `#b5653a` 1,8 px. [§4.6]
    *Doğrula*: Yakınlaştır; yay yönü kapının açıldığı odaya doğru.
39. [ ] **Sürgülü kapı sembolü**: iki örtüşen %55'lik kanat, 40 mm kalın. [§4.6]
    *Doğrula*: Balkon/mutfak sürgülü kapısı.
40. [ ] **Giriş işareti**: turuncu ok + "Giriş" yazısı, giriş kapısının dışında. [§4.6]
    *Doğrula*: Görsel kıyas (`shots/01`).
41. [ ] **Oda adı ve alan etiketleri**: ad 250 mm/600 ağırlık `#2b2824`, alan 175 mm `#7d7366`, y+260, halo `#fbf9f4` 45. [§4.7]
    *Doğrula*: SVG text öznitelikleri; alan "12.37 m²" 2 ondalık.
42. [ ] **Ölçü zincirleri**: iç (parçalar) ve dış (toplam) çift zincir dört kenarda; eğik tikler; değer <400 için 140 mm yazı; dikey yazılar −90°. [§4.8]
    *Doğrula*: Zincir toplamları toplam ölçüyle eşit; `Ölçü` katmanı kapatınca hepsi gizlenir.
43. [ ] **Oda katmanı** kapalıyken oda adı/alan etiketleri, **Mobilya** katmanı kapalıyken mobilya gizlenir. [§4.13]
    *Doğrula*: Chip'leri aç-kapa.

## D. 2D editör — seçim, sürükleme, tutamaçlar

44. [ ] **Mobilya seçimi**: tıklayınca kesikli `#b5653a` çerçeve (5 px dışta), üst döndürme tutamacı (26 px yukarıda), sağ-alt boyut karesi, "G × D" yazısı. [§4.9]
    *Doğrula*: `shots/02`.
45. [ ] **Tutamaç ölçüleri**: normal r=6 px daire / 10 px kare; dokunmatik ×1,7 ve isabet 24 px. [§4.9]
    *Doğrula*: SVG boyutları (zoom farklı olsa da ekranda sabit).
46. [ ] **Sürükleme eşiği** 4 px (dokunmatik 9 px): tıklama mobilyayı kımıldatmaz. [§4.3]
    *Doğrula*: 2 px hareketli tıklama sonrası konum aynı; 6 px hareket taşır.
47. [ ] **10 mm ızgara**: sürüklerken konum 10'un katı. [§4.3]
    *Doğrula*: Taşıdıktan sonra paneldeki X/Y 10'a bölünür (duvara yapışmadıysa).
48. [ ] **Duvara yapışma**: `Duvara yapış` açıkken mobilya kenarı duvar/pencere kenarına ekranda ≤10 px kala yapışır; kapalıyken yapışmaz. [§4.3]
    *Doğrula*: Duvara yaklaş, kenar tam duvar yüzüne oturur (bitişik, ±0 mm); kapatınca serbest.
49. [ ] **Ekleme sonrası itme**: duvara çakışacak şekilde eklenen mobilya duvarın dışına itilerek tam bitişik yerleşir. [§4.3]
    *Doğrula*: Duvar üzerine sürükleyip bırak; koordinat duvar kenarı ± yarı boy.
50. [ ] **Döndürme tutamacı**: 15° adım; Shift ile serbest (1°); değer 0–359. [§4.9]
    *Doğrula*: Tutamacı sürükle; paneldeki "Döndürme" değerleri 15'in katı; Shift ile ara değer.
51. [ ] **Boyutlandırma tutamacı**: sol-üst köşe sabit, 10 mm adım, min 100 mm; döndürülmüş mobilyada da doğru. [§4.9]
    *Doğrula*: 90° döndürülmüş mobilyayı büyüt; sabit köşe yerinde kalır.
52. [ ] **Çift tık** mobilyayı 90° döndürür (Seç aracında). [§4.9]
    *Doğrula*: Çift tıkla.
53. [ ] **Oda seçimi**: odaya tıklama (sürükleme yok) odayı seçer: `rgba(181,101,58,.08)` dolgu + 2 px `#b5653a` kenar; boşluğa tıklama seçimi kaldırır. [§4.9]
    *Doğrula*: `shots/06`.
54. [ ] **Oda hover**: Seç aracında opaklık .82; mobilya hover'ında (fare cihazı) turuncu gölge. [§4.4]
    *Doğrula*: Fare ile üzerine gel.
55. [ ] **Mobilya etiketi**: `min(w,d)≥380` ve bitki/lamba/yan sehpa/bar taburesi/puf hariç; boyut `clamp(0,2·min, 80, 170)` mm; hep yatay. [§4.9]
    *Doğrula*: 90° döndürülmüş mobilyada da yazı yatay; 300 mm'lik nesnede yazı yok.
56. [ ] **Yüzen çubuk (fab)**: seçilince alt-ortada belirir; Döndür/Kopyala/Sil/Bitti; mobilya adı 9em'de kesilir. [§1.6]
    *Doğrula*: Uzun adlı mobilya seç; "Bitti" seçimi kaldırır.

## E. Araçlar: ölçü ve duvar yıkma

57. [ ] **Ölç aracı ipucu hapı** metni ve görünme animasyonu (0,2 s), imleç crosshair. [§4.11]
    *Doğrula*: `M` tuşu (`shots/03`).
58. [ ] **Tıkla–tıkla ve sürükle ile ölçü**; min uzunluk 20 mm; geçici çizgi teal, kalıcı turuncu. [§4.11]
    *Doğrula*: İkisini de dene; çok kısa çizgi kaydedilmez.
59. [ ] **Ölçü yapışması**: 8 px içinde duvar/pencere kenarına; 10 mm ızgara; Shift ile yatay/dikey kilit. [§4.3]
    *Doğrula*: Duvar yüzünden ölçerken "N mm" duvar boyuna tam eşit çıkar.
60. [ ] **Ölçü çizgisi stili**: 1,5 px, uçlarda ±5 px tik, ortada dönük 12 px kalın yazı + beyaz halo; yazı okunur yönde. [§4.11]
    *Doğrula*: Ters yönlü çizgide yazı baş aşağı olmaz.
61. [ ] **Sağ tık** bekleyen ölçü başlangıcını iptal eder; **Esc** iptal eder, ikinci Esc Seç'e döner. [§4.11]
    *Doğrula*: Sırayla dene.
62. [ ] **Ölçüler kalıcıdır** (state.measures), geri alınır, "Ölçüleri temizle (n)" ile silinir. [§4.11, §9.1]
    *Doğrula*: Sayfayı yenile; ölçüler durur.
63. [ ] **Duvar yık aracı**: hover `#d9894f`; taşıyıcı → uyarı toast; dış duvar → uyarı toast; n/low → yıkım işareti (kesikli kırmızı) ve geri alma. [§4.5]
    *Doğrula*: Her tip duvara tıkla (`shots/04`).
64. [ ] **Yıkım toast'ı** uzun kenar mm'sini yazar. [§4.5]
    *Doğrula*: Metindeki sayı duvarın uzun kenarı.
65. [ ] **Yıkılan duvar** yapışma hedeflerinden çıkar, 3D'de kaybolur, "Yıkılan duvar (m)" istatistiği artar; oda alanları değişmez. [§4.5, §9.1]
    *Doğrula*: Yık, 3D'ye geç, panel sayılarını izle.

## F. Mobilya kütüphanesi ve 2D semboller

66. [ ] **Kategori ve öğe sayısı**: 6 kategori, toplam 60 öğe, sırası ve G×D değerleri SPEC §5.1 ile aynı. [§5.1]
    *Doğrula*: Kartları say; ad, G×D ve önizleme rengini tabloyla karşılaştır.
67. [ ] **Kart görünümü**: 105×99 px civarı, 56×44 SVG önizleme, ad 12 px/500, boyut 11 px muted, hover'da turuncu kenar + 1 px yukarı. [§1.4]
    *Doğrula*: Ölç ve hover.
68. [ ] **Kategori başlıkları sticky**, 12 px muted, letter-spacing 1. [§1.4]
    *Doğrula*: Listeyi kaydır.
69. [ ] **Tıkla-ekle**: seçili oda varsa oda merkezine, yoksa görünüm merkezine (3D: ekran merkezinin zemin noktası); halı diziye başa, diğerleri sona; yeni öğe seçili gelir; toast. [§4.12]
    *Doğrula*: Halı ekle → diğer mobilyaların altında; oda seçip mobilya ekle → oda ortası.
70. [ ] **Sürükle-bırak**: hayalet gerçek ölçekte (en az 28×20 px), %80 opak, gölge; bırakınca eklenir; çekmece/fab üzerine bırakma reddedilir; 3D'de zemine değilse "Zemine bırakın". [§1.4, §4.12]
    *Doğrula*: 2D ve 3D'de dene.
71. [ ] **Her tipin 2D sembolü** (45 tip) §5.2 tarifiyle uyumlu (yastık, minder, ocak gözleri, klavye tuşları vb.). [§5.2]
    *Doğrula*: Her tipten bir örnek ekleyip büyütülmüş ekran görüntüsüyle kıyasla; özellikle yatak (1300 mm sınırı: tek/çift yastık), kanepe (2200 mm sınırı: 2/3 minder), ocak (w/d>1,4: 2/4 göz).
72. [ ] **Çizgi kalınlığı zoom'dan bağımsız 1 px** (non-scaling-stroke). [§0]
    *Doğrula*: Yakınlaştırınca çizgiler kalınlaşmaz.
73. [ ] **Çoğaltma** (+200,+200 mm), **Sil**, **En üste/altta**, **Ok tuşları** (10/100 mm), **R/Shift+R**. [§4.12, §11]
    *Doğrula*: Her kısayolu dene; her biri ayrı geri al adımı.
74. [ ] **Yerleşimi Temizle**: onay diyaloğu metni sayıyı içerir; onaylayınca tüm mobilya silinir, Geri Al ile döner; boşsa "Temizlenecek mobilya yok". [§4.12]
    *Doğrula*: Butonu iki kez dene.

## G. Sağ panel

75. [ ] **Genel bakış**: oda listesi (renk kutusu + ad + alan m² 2 ondalık; cumbalarda `*`), net alan toplamı (cumba hariç), dipnot. [§9.1]
    *Doğrula*: Toplam = cumba olmayan alanların toplamı.
76. [ ] **Alan hesabı**: poligon shoelace, iç net ölçü, m² 2 ondalık. [§13.5]
    *Doğrula*: Dikdörtgen oda için G×D/1e6 ile eşit.
77. [ ] **Zemin maliyeti**: malzeme başına alan (1 ondalık) ve `alan × fiyat × 1,05`, yuvarlanmış, binlik ayraçlı; toplam satırı; cumba alanları dahil. [§9.1]
    *Doğrula*: Elle hesapla; bir odanın malzemesini değiştirince tablo ve toplam anında güncellenir.
78. [ ] **%5 fire etiketi** başlıkta "%5 fire dahil". [§9.1]
    *Doğrula*: Metin.
79. [ ] **Plan istatistikleri**: mobilya sayısı, yıkılan duvar toplam uzunluğu (m, 1 ondalık), iki düğme. [§9.1]
    *Doğrula*: Mobilya ekle/sil, duvar yık.
80. [ ] **Oda paneli**: ad girdisi, kullanım alanı, çevre (1 ondalık), genişlik/derinlik (sınır kutusu mm), duvar alanı = çevre × 2,8. [§9.2]
    *Doğrula*: 5450×3950 salonda çevre 18.8 m, duvar alanı 52.6 m² (`shots/06` örneği).
81. [ ] **Malzeme kartları**: 8 kart, 2 sütun, seçili kart turuncu kenar + 2 px `--accent-soft` halka, fiyat "¥N/m²" (yeni: ₺). [§9.2, §9.4]
    *Doğrula*: Seçimi değiştir; 2D deseni ve 3D dokusu değişir.
82. [ ] **Odadaki mobilyalar listesi**: merkezi sınır kutusu içinde olanlar, "G×D" sağda muted, tıklayınca seçer, boşsa "Yok". [§9.2]
    *Doğrula*: Mobilyayı odadan çıkar/geri sok.
83. [ ] **Mobilya paneli alanları**: Ad, Genişlik, Derinlik (min 50, step 10), Merkez X/Y (step 10), Döndürme (step 15), Renk; `change` ile uygulanır; "Taban alanı m²". [§9.3]
    *Doğrula*: Değer gir; 2D ve 3D anında güncellenir; Enter/blur ile bir geri al adımı.
84. [ ] **Panel düğmeleri**: 90° döndür, Kopyala, En üste getir, En alta gönder, Sil, ← Geri. [§9.3]
    *Doğrula*: Her düğme.
85. [ ] **Dokunmatik yardım bölümü yalnız dokunmatik cihazda**, klavye kısayolu bölümü her yerde. [§9.1]
    *Doğrula*: Masaüstü/dokunmatik emülasyonu.

## H. 3D sahne — genel

86. [ ] **Renderer ayarları**: antialias, PCFSoft gölge, ACES Filmic, exposure 1,05, pixelRatio ≤2. [§6.2]
    *Doğrula*: Kod incelemesi/`renderer.toneMapping`, `renderer.getPixelRatio()`.
87. [ ] **Kamera**: FOV 45°, near .05, far 300. [§6.1]
    *Doğrula*: `camera.fov`.
88. [ ] **OrbitControls**: damping, `maxPolarAngle≈0,495π`, min mesafe 1,5, max 45; sol döndür/sağ kaydır/tekerlek. [§6.8]
    *Doğrula*: Zemin altına inilemez; yakın/uzak sınırlar.
89. [ ] **Işıklar**: Hemisphere (`0xfff8ee`/`0xb9a88f`, 1,1), Directional güneş (4096² gölge, ±11 m, bias −0,0004, normalBias .02), arka plan `0xf7f4ee`, dış zemin 160×160 `0xf2eee7` y=−0,015. [§6.3]
    *Doğrula*: Sahne grafiğini incele.
90. [ ] **Güneş yolu**: 07:00–18:00, adım .25; konum/renk/şiddet §6.4 formülleriyle; saat etiketi "HH:MM". [§6.4]
    *Doğrula*: 07:00, 12:00, 18:00'de `sun.position/color/intensity` değerlerini hesaplanan ile karşılaştır (12:00: şiddet 3,0).
91. [ ] **Gece modu**: güneş .05, hemisfer .12, bg `0x1c2130`, zemin `0x2a2e38`, oda nokta ışıkları 6 (renk `0xffd9a8`, mesafe 7, decay 1,6), lamba emissive 2, exposure 1,25, env ×0,15. [§6.5]
    *Doğrula*: Gece düğmesi (`shots/09`); ışık yoğunlukları.
92. [ ] **Tam/Kesik duvar**: 2,8 m ↔ 1,2 m; kesikte tavan ve lamba diskleri gizli, etiketler cut+0,15 m yüksekte; alçak duvar `min(1, cut)`. [§6.6]
    *Doğrula*: Düğmeler (`shots/08`).
93. [ ] **Duvar malzemesi**: gövde `#f4f1eb` (r .92), tepe kapak `#34312d`. [§6.6]
    *Doğrula*: Duvar tepesi koyu şerit.
94. [ ] **Pencereler**: denizlik 0,9 (banyo yüksek 1,4, cumba 0,45), baş 2,4; cam `0xcfe6ef` opaklık .28; ~0,9 m aralıkla dikmeler, alt-üst çıta. [§6.6]
    *Doğrula*: Yakından bak.
95. [ ] **Kapılar açık başlar**, tıklama/E ile aç-kapa; üstel yumuşama (~0,4 s); giriş kapısı koyu ceviz, diğerleri krem; kol küre. [§6.6]
    *Doğrula*: 3D'ye gir; kapı yapraklarının açık olduğunu gör; tıkla.
96. [ ] **Cumba platformu** 0,45 m yükseklikte, yan yüzler `#e9e4da`. [§6.6]
    *Doğrula*: Cumba bölgesi.
97. [ ] **Zemin dokuları (3D)**: 8 malzeme için canvas dokuları (§6.7) — ahşapta kaydırmalı derz ve damar, karoda derz + benek, mermerde damar, terrazzo'da benekler. [§6.7]
    *Doğrula*: Yakın planda her malzemeyi tek tek karşılaştır; karo boyutu gerçek (0,8 m karo = 0,8 m).
98. [ ] **Ortam haritası yalnız metal/parlak malzemelerde** (`RoomEnvironment`), `scene.environment` boş. [§6.3]
    *Doğrula*: Kod/`scene.environment === null`; krom musluk yansıması var, duvar parlamaz.
99. [ ] **Oda etiketleri (CSS2D)**: pill biçimi, ad + "12.4m²"; Oda adları düğmesiyle aç-kapa; animasyon ve gezintide gizli. [§6.11]
    *Doğrula*: `shots/08`.
100. [ ] **Odalar listesi** (sol üst, 3D'de): 2 sütun, alanlar 2 ondalık, "Tüm daire" son öğe; tıklayınca uçuş 900 ms; aktif vurgulu. [§6.10]
     *Doğrula*: Tıkla, süreyi ölç.
101. [ ] **Hazır kamera pozları**: Eğik hedef (0,0,0) konum (5,5;15,5;10); Üstten (0;19;0,0001); oda uçuşu formülü (dist = boyut×1,3+2,2, yükseklik dist×1,05). [§6.8]
     *Doğrula*: `camera.position` değerleri.

## I. 3D — geçişler, seçim, sürükleme

102. [ ] **2D→3D animasyonu**: 3D önce 2D ile örtüşür (çapraz solma 0,45 s), 420 ms bekleme, 1700 ms: kamera %85'te varır, duvarlar yerden yükselir, mobilya sonra belirir. [§6.9]
     *Doğrula*: Ekran kaydı/kare kare izle; toplam ≈2,1 s; segment anahtarı bu süre kilitli.
103. [ ] **3D→2D animasyonu**: mobilya iner, duvar iner, kamera tepeye döner (1300 ms) sonra 450 ms solma. [§6.9]
     *Doğrula*: `T` ile geri dön; son karede 3D, 2D ile örtüşür (kayma yok).
104. [ ] **3D görünüm 2D ile aynı ölçek ve merkezde başlar** (planPose). [§6.8]
     *Doğrula*: 2D'de zoom+pan yap, `T`; ilk kare 3D duvar izleri 2D ile örtüşür.
105. [ ] **3D seçimi**: tıklama mobilyayı seçer (turuncu `BoxHelper`), odayı seçer, kapıyı aç-kapar, duvara tıklama seçimi kaldırır; sağ panel senkron. [§6.12]
     *Doğrula*: Her hedefe tıkla.
106. [ ] **3D sürükleme**: yalnız seçili mobilya; zemin düzleminde, 2D ile aynı ızgara+duvara yapışma; bırakınca tek geri al adımı; 2D anında güncellenir; sürüklerken kamera dönmez. [§6.12]
     *Doğrula*: Seçili mobilyayı sürükle; sonra 2D'ye dön.
107. [ ] **2D↔3D senkron**: sağ panelden malzeme/renk/boyut değişimi 3D'yi anında günceller; 3D'de yapılan taşıma 2D'ye yansır. [§6.12]
     *Doğrula*: Her iki yönde deneme.
108. [ ] **3D klavye**: T, R, Delete, oklar, Ctrl+Z/Y/D, [ ] çalışır; V M X F + − yok sayılır. [§6.12, §11]
     *Doğrula*: Tuşları dene.
109. [ ] **3D ipuçları**: fare/dokunmatik/gezinti metinleri §8; hap animasyonda gizlenir (0,4 s). [§6.13, §8]
     *Doğrula*: Metinler.
110. [ ] **Kitaplıktan 3D zemine bırakma** (hayalet perspektif ölçekli). [§1.4]
     *Doğrula*: 3D'de bir mobilyayı zemine sürükle.

## J. 3D mobilya modelleri

111. [ ] **Her tipin 3D modeli** (43 farklı model) §7.2'deki parçalarla aynı; ölçüler oransal. [§7.2]
     *Doğrula*: Tüm 60 öğeyi bir odaya ekle, `shots` referansıyla ve tarifle kıyasla; modelin arka yüzü duvara bakar (yerel −z).
112. [ ] **Yatak**: baş ucu döşemeli dikey paneller (`round(w/0,28)`), şilte, yorgan+katlama, ayak örtüsü, 1–2 yastık + minder. [§7.2]
     *Doğrula*: 1800 ve 1200 mm yatakta panel/yastık sayısı.
113. [ ] **Koltuk**: 1/2/3 minder (armchair 1; sofa >2200 mm→3), dört ayak, iki kol, eğik sırt minderleri. [§7.2]
     *Doğrula*: 1700 ve 2400 mm koltuk.
114. [ ] **Dolap kapakları ve kulplar**: 5 mm boşluk, koyu arka plaka, kulp tipleri bar/knob/edge; çekmece kuralı `ph<.4 && pw≥ph`; çok kapaklı dolapta kulplar ortada buluşur. [§7.1]
     *Doğrula*: Gardırop (2000 mm → 4 kapak), banyo dolabı (edge), komodin (bar çekmece).
115. [ ] **Kitaplık**: 5 raf, rastgele kitaplar (tohumlu), dekor; aynı yerde aynı görünüm. [§7]
     *Doğrula*: İki kez kur → aynı dizilim.
116. [ ] **Bitki**: `N = 20+round(36r)` yaprak, altın açı spirali, iki yeşil ton. [§7.2]
     *Doğrula*: 500 mm ve 700 mm bitki yaprak sayıları (29 / 33).
117. [ ] **Ekran/ışıklı yüzeyler**: TV/monitör koyu mavi emissive, abajur ve aynalar `glowMat`; gece parlak. [§7.3]
     *Doğrula*: Gece modunda abajur, ayakkabılık altı şerit, banyo aynası.
118. [ ] **Ayakkabılık havada** (0,16 m), vanity 0,33 m'de asılı, klima duvar tipi y=2,2, termosifon merkez y=1,95. [§7.2]
     *Doğrula*: Yükseklikleri ölç.
119. [ ] **Halı** gölge vermez; üç eş merkezli katman. [§7.2]
     *Doğrula*: Halı üzerinde gölge yok.

## K. Gezinti modu

120. [ ] **Giriş**: Gezinti düğmesi, kaplama kartı (3 satır metin), kamera giriş kapısı dışında 1,6 m; seçim temizlenir; tam duvara döner. [§8]
     *Doğrula*: Kesik duvarda iken Gezinti'ye geç.
121. [ ] **Pointer lock** (masaüstü): tıkla → kilit, artı işareti 14×14; Esc → kaplama geri gelir. [§8]
     *Doğrula*: Gerçek tarayıcıda dene.
122. [ ] **Hız**: 1,4 m/s, Shift 2,6 m/s; W A S D ve oklar; çapraz normalize. [§8]
     *Doğrula*: 5 sn ileri yürü → 7 m (Shift: 13 m) ±.
123. [ ] **Çarpışma**: yarıçap 0,22 m; duvar/pencere AABB'lerinden ve kapı yapraklarından (0,176 m) geçilmez; eksen bazında kayma; mobilyadan geçilir. [§8]
     *Doğrula*: Duvara çapraz yürü → kayarak ilerler.
124. [ ] **E ile kapı**: ekran merkezindeki, ≤2,5 m kapıyı aç-kapar. [§8]
     *Doğrula*: Kapıya bak ve E'ye bas.
125. [ ] **Duvar kenar çizgileri ve süpürgelik yalnız gezintide görünür**. [§6.6]
     *Doğrula*: Gezinti ↔ Kuşbakışı arasında gidip gel.
126. [ ] **Dokunmatik joystick**: 130 px daire, 56 px topuz, R=50 px, `left/bottom 28`, blur(3px); ekran sürükleme bakış 0,005 rad/px, pitch ±1,35; "Gezintiden çık" sağ-altta. [§8]
     *Doğrula*: `shots/19` ile kıyasla; topuz sınırı aşmaz.
127. [ ] **Dokunma ile kapı** (≤3,5 m, hareket ≤9 px). [§8]
     *Doğrula*: Dokunmatik emülasyon.
128. [ ] **Gezinti sırasında kısayollar kapalı**; çıkış yalnız düğmelerle. [§8]
     *Doğrula*: Gezintide T'ye bas → etkisiz.

## L. Kalıcılık, dışa aktarma, geri al

129. [ ] **localStorage anahtarları** `huxing-design-v1` (state), `huxing-lang`, `huxing-panes` (yeni ad önekleri farklı olabilir ama şema aynı). [§12.1]
     *Doğrula*: Uygulama Depolama sekmesi.
130. [ ] **Durum şeması**: `furniture[]{id,type,name,cx,cy,w,d,rot,color}`, `rooms{id:{name,mat}}`, `demolished[]`, `measures[]{a,b}`. [§12.2]
     *Doğrula*: JSON dışa aktar ve alanları karşılaştır.
131. [ ] **Geri al/yinele**: 150 adım, snapshot; sürükleme tek adım; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y; tüm state alanları geri alınır. [§11.3]
     *Doğrula*: Ekle, taşı, malzeme değiştir, duvar yık, ölç → tek tek geri al; 151. adımda en eski düşer.
132. [ ] **Sayfa yenileme** son durumu geri getirir (undo yığını hariç). [§12.1]
     *Doğrula*: Yenile; Geri Al soluk.
133. [ ] **JSON dışa aktarma**: 2 boşluk girintili, `application/json`. [§12.3]
     *Doğrula*: Dosyayı aç.
134. [ ] **JSON içe aktarma**: geçerli dosyada toast + geri alınabilir; `furniture` dizisi yoksa "Dosya biçimi geçersiz". [§12.3]
     *Doğrula*: Geçerli ve bozuk dosya.
135. [ ] **Varsayılana sıfırla**: confirm + geri alınabilir. [§12.3]
     *Doğrula*: Sıfırla → Geri Al.
136. [ ] **2D PNG**: 3200×2892 px, tüm plan+ölçü zincirleri, `#f7f4ee` zemin, seçim katmanı yok, katman durumlarını korur. [§12.4]
     *Doğrula*: İndir, boyutu `identify` ile kontrol et.
137. [ ] **3D PNG**: canvas boyutunda, etiketsiz, dosya adı `-3D` ekli. [§12.4]
     *Doğrula*: 3D'de "Görüntüyü dışa aktar".

## M. Dil (i18n) ve erişilebilirlik

138. [ ] **Tüm arayüz metinleri** SPEC §14 tablosuyla uyumlu (statik, tooltip, toast, panel, ipuçları). [§14]
     *Doğrula*: Ekranda tarayarak; eksik/çevrilmemiş dize yok (özgündeki alt çubuk hover istisnası düzeltilmeli mi karar ver).
139. [ ] **Yerleşik adlar çevrilir, kullanıcı adlandırması olduğu gibi kalır**. [§14]
     *Doğrula*: Bir odayı yeniden adlandır, dili değiştir.
140. [ ] **Dil değişimi anında** tüm render'ları (kitaplık, oda listesi, 3D etiketleri, kapı yazısı) günceller, sayfa yenilemeden. [§14]
     *Doğrula*: 3D'deyken dil değiştir.

## N. Animasyon/geçiş süreleri (toplu kontrol)

141. [ ] **Süreler**: seg hap 0,5 s; mod grup fade 0,45 s; panel daralma 0,3 s; fab 0,2 s; toast 0,25 s/1,8 s; hint 0,4 s; uçuş 900 ms; enter 420+1700 ms; exit 1300+450 ms. [§10]
     *Doğrula*: DevTools Performance/Animations ile ölç veya ekran kaydı.
142. [ ] **Kübik ease-in-out** kamera geçişlerinde; küresel (ark) interpolasyon. [§6.8]
     *Doğrula*: Uçuş sırasında kamera çizgi değil ark çizer.
