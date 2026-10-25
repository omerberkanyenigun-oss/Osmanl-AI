# Osmanlı AI V23 – Saray ve Silah Müzesi Güncellemesi

V22 özelliklerine ek olarak Sarayda Serbest Gezi ve etkileşimli Silah Müzesi eklenmiştir.

# Osmanlı AI V21 — Sistem Güncellemesi

Bu sürüm güncelleme/onarım mantığıyla hazırlandı.

Yapılanlar:
- Eski service worker kayıtları kaldırılır.
- Eski önbellek dosyaları tamamen temizlenir.
- CSS, data.js, script.js ve ses dosyalarına sürüm numarası eklendi.
- Başlangıçta güncelleme ekranı görünür ve sistem bileşenleri yeniden bağlanır.
- Ses Ayarları ve Osmanlı AI Rehberi yeniden bağlanır.
- Ceddin Deden proje içindeki MP3 dosyasından çalışır.
- Ana uygulamanın oyun, harita, müze, görev, Sarayım ve AI Komutan kodlarına dokunulmadı.
- Service worker eski dosya sunmayacak şekilde sıfırlandı.
- START.bat V21 sürüm parametresiyle açılır.

Ana JavaScript syntax check: OK
Güncelleme JavaScript syntax check: OK
Kritik bölüm kontrolü: OK
MP3 kontrolü: OK

## V22 Cihan Güncellemesi
- Çalışan Osmanlı Savaş Simülatörü
- 6 tarihî savaş, 6 birlik türü, taktik, hava ve düşman yapay zekâsı
- XP, altın, zafer ve yenilgi kayıt sistemi
- Divan-ı Hümayun devlet yönetimi
- Hazine, halk, ordu, iaşe ve itibar dengeleri
- Divan üyelerinin tavsiyeleri, ferman seçenekleri ve vakanüvis geçmişi
- V22 kayıtları tarayıcı LocalStorage alanında saklanır

## AI TANIMA DÜZELTMESİ
- Modelin eğitildiği TensorFlow.js 1.7.4 sürümüyle uyumluluk sağlandı.
- Model yolları göreli ve güvenli hale getirildi.
- Gerçek yükleme durumu ve hata mesajları eklendi.
- Tekrar Dene düğmesi çalışır hale getirildi.
- Uygulamayı mutlaka START.bat ile açın; index.html dosyasına çift tıklamayın.

V25 PENCERE SİMGESİ DÜZELTMESİ
- Osmanlı arması uygulama simgesi olarak eklendi.
- Uygulama Edge/Chrome app modunda açılır; simge pencere adının hemen solunda görünür.
- Edge/Chrome bulunamazsa normal tarayıcıda açılır.

## V26 — Topkapı Sarayı ve Devlet Görevlileri Güncellemesi
- “Padişahla Konuş” sekmesine Padişah / Paşa / Ağa konuşma seçici eklendi.
- Sokollu Mehmed Paşa, Pargalı İbrahim Paşa ve Köprülü Mehmed Paşa ile eğitimsel sohbet eklendi.
- Yeniçeri Ağası, Darüssaade Ağası ve Kapı Ağası ile eğitimsel sohbet eklendi.
- Her görevli için makamına ve dönemine uygun yerel cevap sistemi eklendi.
- Sesli cevap desteği görevliler için de etkinleştirildi.
- 10 duraklı Sanal Topkapı Sarayı Turu eklendi.
- Turda Bâb-ı Hümâyun, avlular, Divan Meydanı, mutfaklar, Arz Odası, Enderun, Hırka-i Saadet Dairesi ve Bağdat Köşkü bulunur.

## V2.7 Güncellemesi
- Yapay Zekâ Tarih Tartışması: karakter ve konu seçimi, üç turlu tartışma, kullanıcı katılımı ve tarih hakemi değerlendirmesi.
- Tarih Dedektifi Modu: 3 vaka, oda araştırması, şüpheli sorgulama, kanıt panosu, suçlama sistemi ve Saray Dedektifi rozeti.


## V2.8 Yenilikleri
- Kamera ile Tarih: kamera/fotoğraf yükleme, çevrimdışı eğitimsel görsel analizi, güven puanı ve kişisel arşiv.
- Yapay Zekâ Sinematik Modu: hazır tarihî olaylar, özel konu, 3-7 sahne, oynatıcı, sesli anlatım, zaman çizelgesi ve metin dışa aktarma.

Not: Kamera ile Tarih modundaki çevrimdışı analiz bir eğitim demosudur; uzman eser doğrulaması değildir.


## V2.9 Planlanan Özellikler

- 🖼️ **Osmanlı Yapay Zekâ Resim Üreticisi**: Kullanıcının yazdığı komutlardan yalnızca Osmanlı tarihi, padişahlar, savaşlar, mimari ve kültürüyle ilgili görseller üretir.
- 📰 **Güncel Haberleri Osmanlı Türkçesiyle Yorumlama**: Güncel haberleri Osmanlı Türkçesi üslubuyla yeniden yazar ve tarihî bir bakış açısıyla yorumlar.

## V2.9 — Çalışan AI Özellikleri
- Osmanlı ile ilgili metin komutlarından OpenAI görsel API'si üzerinden görsel üretimi.
- Osmanlı dışındaki komutları hem tarayıcıda hem yerel sunucuda reddeden konu filtresi.
- Haber başlığı ve metnini sade, orta veya ağır Osmanlı Türkçesi üslubuyla yeniden yazma.
- API anahtarını ön yüze koymayan yerel PowerShell proxy sunucusu.
- Görsel indirme, yeniden üretme, haber kopyalama ve sesli okuma.

### Kurulum
1. OpenAI platformundan bir API anahtarı oluşturun. API kullanımı ChatGPT Plus aboneliğinden ayrıdır ve hesabın API bakiyesi/faturalandırması gerekebilir.
2. `API_ANAHTARI_AYARLA.bat` dosyasını bir kez çalıştırıp anahtarı girin.
3. Açık uygulama pencerelerini kapatın ve `START.bat` ile yeniden başlatın.
4. Soldaki `Osmanlı Resim AI` veya `Osmanlıca Haber` bölümlerini açın.

Anahtar kaynak koduna veya tarayıcı LocalStorage alanına yazılmaz; Windows kullanıcı ortam değişkeninde tutulur.


## V29.1 bağlantı düzeltmesi

Bu sürüm, eski sürümden kalan hatalı service worker nedeniyle görülen `Failed to convert value to Response` ve yerel adres ağ hatasını düzeltir. Sunucu her açılışta rastgele, boş bir port ve `localhost` adresi kullanır; eski önbellekler uygulama açılırken temizlenir.

## V29.3 Kararlı Düzeltme
- Açılıştaki “Uygulama yenileniyor” perdesi tamamen kaldırıldı.
- Bakım ve bağlantı işlemleri görünmeden, arka planda ve gecikmesiz çalışır.
- OpenAI anahtarı eksik veya API bağlantısı başarısız olduğunda sunucu artık 503/502 ağ hatası üretmez; kullanıcıya sayfa içinde anlaşılır mesaj gösterir.
- Osmanlı portre modeli düzeltmesi korunmuştur.

## V30 — Osmanlı AI Infinity Nexus

Bu sürümde Infinity Rank eklenmemiştir. Yeni modüller:

- Infinity Hub: Osmanlı AI araçlarının birleşik kontrol merkezi.
- Infinity Brain: Tarihçi, stratejist, diplomat, mimar ve kâtip uzman modları.
- Infinity Timeline: 1299–1922 arasında etkileşimli yıl, dönem, padişah ve olay keşfi.

Bu üç bölüm API anahtarı gerektirmeden yerel olarak çalışır.


## V31 Infinity Nexus güncellemesi
- Infinity Brain: Padişah Danışmanı, Tarihçi, Stratejist, Osmanlıca Uzmanı, Sanatçı ve Mimarlık Uzmanı.
- Infinity Timeline: seçilen yıla göre dönem, padişah, olay, temsili etki haritası ve devlet durumu göstergeleri.
- Infinity animasyonları: kısa Osmanlı arması açılışı, altın parçacıklar, dinamik arka plan ve akıcı sayfa geçişleri.
- Kariyer sistemi: 100.000 XP'de Cihan Hâkimi rütbesi.


## 3D Fetih Görevi
- Uygulama menüsüne ayrı bir 3D mini oyun eklendi; mevcut modüller korunmuştur.
- Üç boyutlu kale alanı, karakter hareketi, devriye gezen muhafızlar, 5 toplanabilir sancak, puan/can sistemi ve yeniden başlatma.
- Bilgisayarda WASD/ok tuşları ve Space; telefonda ekrandaki dokunmatik kontroller.
- 3D motoru Three.js CDN üzerinden yüklenir; oyunu çalıştırırken internet bağlantısı gerekir.


## V31.1 — 3D Sinematik ve Gelişmiş Fetih Oyunu
- Yapay Zekâ Sinematik Modu için Three.js tabanlı hareketli 3D sahne: kale, kuleler, şehir silüetleri, askerler, toplar ve deniz sahnesinde gemiler. Kamera sahne boyunca hareket eder; otomatik oynatma ve sahne geçişleri mevcut oynatıcıyla çalışır.
- 3D Fetih Görevi artık seviye ilerlemesi içerir; her seviyede beş sancak toplanır, seviye tamamlanınca sonraki seviye açılır.
- Seviye yükseldikçe harita genişler, muhafız sayısı ve hareket baskısı artar; ağaçlar, dağlar, nehir ve köprüler araziye eklenir.
- Akçe kazanma ve Çarşı sistemi: yatağan kılıcı, çelik kalkan, akıncı atı, fitilli tüfek, yeniçeri desteği, saha topu, Şahi topu desteği ve zırhlı kaftan.
- Satın alınan ekipman karakter üzerinde görünür; at hareket hızını artırır, kalkan darbeyi engeller, ordu desteği muhafızları aralıklarla sersemletir, tüfek ve toplar menzilli saldırı yapar.
- Oyunu çalıştırmak için `START.bat` kullanın. Three.js CDN kullanıldığı için 3D oyun ve 3D sinematikte internet bağlantısı gerekir.
- Bu sürümde JavaScript sözdizimi kontrolleri yapıldı; gerçek tarayıcıda tam oynanış testi ayrıca yapılmalıdır.


## 3D motoru yerel yükleme düzeltmesi

- `START.bat` çalışırken uygulama, Three.js 0.160.0 paketini npm kayıt deposundan `public/vendor/three.module.js` konumuna indirmeyi dener.
- Oyun önce `./vendor/three.module.js` yerel dosyasını kullanır; böylece kurulum başarılı olduğunda oyun ekranını açmak için CDN'e ihtiyaç duymaz.
- İndirme otomatik gerçekleşmezse `KUR_3D_MOTORU.bat` dosyasını çalıştırabilirsiniz.
- İlk kurulum sırasında `registry.npmjs.org` adresine erişim gerekir. İnternet tamamen kapalıysa motor dosyasının başka bir bilgisayardan projeye kopyalanması gerekir.


## Açılış için ek düzeltme
- Uygulama başlatılırken Three.js indirme işlemi artık otomatik çalıştırılmaz; bu işlem ağ hatası nedeniyle ana uygulamanın açılmasını geciktirmesin.
- 3D motorunu ayrıca kurmak için `KUR_3D_MOTORU.bat` dosyasını çalıştırın.
