# 48 — hooliee'ye geçiş: isim ve domain (2026-10-05)

Sahip kararı (2026-10-04/05): ürünün adı **hooliee**, adresi **hooliee.com**.
**Oponoya**, ürünü geliştiren stüdyonun adı olarak kalıyor; oponoya.com ileride
stüdyonun tüm projelerini yayınladığı site olacak. Landing'in alt satırı
"Oponoya tarafından geliştirildi" der ve oponoya.com'a bağlanır.

## Durum (2026-10-05'te kontrol edildi)

- oponoya.com canlı: uygulama Cloudflare arkasında (Full (strict), Origin CA),
  Dokploy'da yalnızca `web` servisine bağlı; API dışarı açık değil.
- hooliee.com Hostinger'da kayıtlı ve park sayfasında (nameserver
  `*.dns-parking.com`, A `2.57.91.91`).
- Sunucu ve veritabanı aynı kalır; veri taşınmaz. Oturum çerezleri domaine
  bağlı olduğu için herkes hooliee.com'da bir kez yeniden giriş yapar.

## 1. Kod (`feat/hooliee` dalı)

- `productName` ve derleyicinin `GENERATOR_NAME`'i "hooliee";
  `COMPILER_VERSION` 0.4.5 (dışa aktarım başlığı değişti), golden ve
  `examples/generated-context` derleyiciden yeniden üretildi.
- Yeni logo: zincir gibi iç içe geçmiş iki halka (`components/logo-mark.tsx`);
  favicon, uygulama ikonları ve paylaşım görseli aynı geometriden çizilir.
- Animasyonlar: landing başlığında halkalar bir kez çizilip kenetlenir; logonun
  üzerine gelince yarım tur döner; giriş, proje kaydetme ve talimat oluşturma
  düğmeleri beklerken halkalar adım adım döner. "Hareketi azalt" tercihinde
  hepsi durur.
- Footer: "Oponoya tarafından geliştirildi" / "Built by Oponoya" →
  `developerUrl` (oponoya.com).
- Yenilikler: isim değişiklikleri haber sayılmaz (sahip kararı 2026-10-05);
  "DevContext OS artık Oponoya" kaydı kalktı, hooliee için de duyuru yok.
  Liste git geçmişine göre düzeltildi ve eksik olan "Proje sihirbazında
  önerilen teknolojiler" (2026-10-04) eklendi.
- Değişmeyenler: `devcontext` çerez önekleri, dışa aktarım format kimliği,
  `@devcontext/*` paketleri, `oponoya-*` imaj adları ve sunucudaki
  `/opt/oponoya` klasörü. Kullanıcı bunları görmez; değiştirmek yalnızca risk
  getirir.

## 2. Domain (sahip, Cloudflare + Hostinger)

1. Cloudflare → **Add a site** → `hooliee.com` (Free).
2. Cloudflare'in verdiği iki nameserver'ı Hostinger'da hooliee.com için yaz
   (park nameserver'larının yerine). Yayılma birkaç dakika ile birkaç saat
   sürebilir.
3. DNS (proxy açık, turuncu bulut): `A @ → 167.148.181.155`,
   `A www → 167.148.181.155`. Cloudflare park kaydını (`2.57.91.91`) içe
   aktarırsa sil.
4. SSL/TLS → **Full (strict)**; Origin Server → `hooliee.com` ve
   `*.hooliee.com` için yeni **Origin CA sertifikası** (oponoya.com'unki
   hooliee'yi kapsamaz).
5. Redirect rule: `www.hooliee.com/*` → `https://hooliee.com/${1}` (301).

## 3. Sunucu (sahip, Dokploy paneli)

Sıra önemli: önce yeni kod, sonra domain.

1. `feat/hooliee` `dev`'e alındıktan sonra yeni sürümü deploy et; site o an
   hâlâ oponoya.com'da çalışır.
2. Dokploy → **Certificates**: yeni Origin CA sertifikasını ve anahtarını yükle.
3. Web servisi → **Domains**: `hooliee.com`, port 3000, HTTPS açık
   (oponoya.com'daki ayarın aynısı).
4. Environment: `CORS_ORIGIN`, `BETTER_AUTH_URL` ve `SITE_URL` içindeki
   oponoya.com'u hooliee.com yap ve yeniden başlat. `CORS_ORIGIN` tek bir
   origin olduğu için bu andan itibaren oponoya.com'da giriş çalışmaz; 4.
   bölümdeki yönlendirmeyi hemen ardından kur.
5. Elle kontrol: açılış (TR ve `/en`), giriş, proje oluşturma, talimat
   oluşturma ve dışa aktarma, `/sitemap.xml` ve `/robots.txt`'nin hooliee.com
   adreslerini göstermesi, favicon. `scripts/smoke.mjs` API'ye doğrudan
   bağlandığı için canlıya dışarıdan çalıştırılamaz.

## 4. oponoya.com ve sonrası

1. Cloudflare'de oponoya.com için redirect rule: tüm yollar →
   `https://hooliee.com/${path}` (301, sorgu dizesi korunur). Sonra oponoya.com'u
   Dokploy'daki web servisinden kaldır.
2. Stüdyo sitesi hazır olunca genel yönlendirmeyi kaldır, ama uygulama
   yollarını (`/workspace*`, `/auth*`, `/legal*`, `/en`) hooliee.com'a
   yönlendirmeye devam et; eski linkler kırılmasın.
3. Google Search Console: hooliee.com mülkünü ekle ve sitemap'i gönder.
   oponoya.com aramada görünüyorsa iki mülk de doğrulandıktan sonra
   **Adres değişikliği** aracını kullan.
4. LinkedIn paylaşımlarının önizlemesini Post Inspector ile yenile.

## Açık kararlar

- Yasal sayfalar için bir iletişim e-postası (`LEGAL_CONTACT_EMAIL`), örneğin
  Cloudflare Email Routing ile Gmail'e yönlenen `destek@hooliee.com`.
- Stüdyo sitesinin (oponoya.com) ne zaman yayına gireceği.
