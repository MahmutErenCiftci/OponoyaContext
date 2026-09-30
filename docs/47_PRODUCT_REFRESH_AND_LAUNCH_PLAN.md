# 47 — Ürün yenileme ve ilk yayın hazırlık planı

Tarih: 2026-09-30 · Dal: `dev` · Temel commit: `4d150cd` (yeni genel bakış,
sol menü, gelişim planı) · Bu raporla gelen commit: "Faz 0" düzeltmeleri.

Bu belge iki iş akışını tek yerde toplar:

- **A. Yenileme:** bugün genel bakışta başlayan tasarım dilini ürünün geri
  kalanına taşımak.
- **B. İlk yayın:** `docs/44_V1_LAUNCH_GATE.md` kapısını GO'ya çevirmek için
  kodda yapılacaklar ve sahibin (owner) yapması gerekenler.

Kaynaklar: iki salt-okunur araştırma (ekran ekran UX denetimi ve yayın
hazırlığı denetimi, 2026-09-30), tarayıcıda ekran turu, `docs/44`, `docs/13`,
`docs/45`, `docs/46`. Bulguların kritik olanları elle doğrulandı (aşağıda
"doğrulandı" diye işaretli).

---

## A. Tasarım dili

Bugün gelen parçalar bundan sonraki her ekranın yapı taşlarıdır:

| Parça | Nerede | Kural |
|---|---|---|
| Çerçeve | `app/workspace/workspace-navigation.tsx` | İş yapılan bölümler solda, bilgi/keşif (Katalog, Yenilikler; ileride Rehberler, Topluluk) üst barda |
| Kart | `.overview-card`, `.project-card`, `.tech-card` | 14–16 px köşe, hover'da hafif yükselme, `--ease-out` |
| Ray | `components/carousel.tsx` | 3'ten fazla öğede oklar, sürükleme, ilerleme çubuğu |
| Hero | `.overview-hero` | Sayfa başında tek güçlü başlık ve kısa bağlam |
| Yakında | `components/coming-soon.tsx` | Henüz olmayan AI/Pro işlemleri soluk + "Yakında · Pro" |
| Plan | `components/roadmap.tsx`, `lib/roadmap.ts` | Fiyat ve aşama metinleri tek yerde |
| Ölçek | `globals.css` | Masaüstü %90 (`zoom`), tam yükseklikler `/ var(--ui-zoom)` |

Önerilen tipografi ölçeği (bugün 9 farklı sayfa başlığı boyutu var: 56 → 28):
hero 38 (telefonda 28), sayfa başlığı 32, bölüm 22, kart başlığı 18.

### A1. Ekran ekran fırsatlar

Efor: S (yarım gün), M (1–2 gün), L (3+ gün). "E2e" sütunu değişiklikle
birlikte güncellenmesi gereken testleri gösterir.

| Öncelik | Ekran | Ne yapılmalı | Efor | E2e |
|---|---|---|---|---|
| P1 | Projeler listesi | Tabloyu genel bakıştaki proje kartlarından oluşan ızgaraya çevir (`components/project-card.tsx`); sonda "Yeni proje" kartı; üstte aktif/güncel/yenilenmeli sayıları | M | `projects.spec.ts` |
| P1 | Kütüphane | Izgara/liste geçişi, tercih filtreleri sayılı hap düğmeler, boş durum için öneri rayı; "Bağlantıdan otomatik doldur" ve "AI uyumluluk önerisi" için soluk "Yakında · Pro" | M | `foundation`, `usability` |
| P1 | Proje detayı | Hero kart (baş harf, aşama, durum, "AI talimatları" çağrısı), sekmeler hap düğme, özet kart ızgarası, etkinlik için `ActivityTimeline` | M | `decisions`, `usability`, `.brief-item` korunmalı |
| P1 | AI talimatları | Ajan seçimi logolu hap düğmeler, fark görünümü ayrı, sürümler yatay ray, "yenilenmeli" uyarısı `.dev-notice` stilinde; dışa aktarma çekirdek, aktif kalır | M–L | `usability`, `composer`, `context`, `portability` |
| P1 | Proje sihirbazı | Adımlar plan sayfasındaki aşama düğmeleri gibi, ilerleme çubuğu, özet kartı logolarla; 2. adımda soluk "AI ile stack öner · Yakında" | L | `support/workspace.ts` adım adları |
| P2 | Teknoloji kararları | Sayım cümlesi renkli istatistik haplarına; tablo kalır (testler satırlara bağlı) | S–M | — |
| P2 | Katalog | Hazır stack'ler şeridi yerine ray; kartlara yeni köşe/hover; teknoloji ve stack detayında hero, puanlar karo | M | `catalog.spec.ts` |
| P2 | Profiller ve Tarifler | Ortak `EntityCard` ızgarası; iki sayfada aynı Aktif/Arşiv sekmeleri | S–M | `portability` |
| P2 | Profil/Tarif detayı | Yan panel telefonda kenarlık taşıyor; tarifte "Düzenle" h1 içinde; `.profile-order` sütunları taşıyor | M | — |
| P2 | Ayarlar | Başlık bileşeni, bölümler kart, menü öğeleri ikonlu; GitHub satırı ve "AGENTS.md içe aktar" soluk "Yakında" | M | — |
| P2 | Abonelik | Kendi planın ve kullanım en üstte, plan kartları `.roadmap-price` stilinde | S–M | `billing.spec.ts` (tek tablo kalmalı) |
| P2 | İlk kurulum | Hero degrade, seçim kartları plan aşama stili | S–M | `portability`, `support/workspace.ts` |
| P3 | Landing | Tasarım tuvalindeki A/B/C'den biri seçilecek (aşağıda) | M | `foundation` |
| P3 | Giriş/kayıt | Anlatı paneli kartlı, form kart içinde | S–M | "Hesap oluştur" tek buton kalmalı |
| P3 | Yasal, 404, hata | Telefonda yasal sayfa gezinmesi yok; 404 herkese açık metin ve marka çubuğu | S | `reliability` |

Ortak bileşenler: tek bir toast (bugün ~10 istemcide ayrı yazılmış), çekmece
giriş animasyonu, komut paletinde odak tuzağı ve Tarifler/Ayarlar/Abonelik/
Yenilikler kısayolları, `PageHead` hero varyantı, `ScoreMeter` ekran okuyucu
metni Türkçe ("of 5" → "5 üzerinden"), çip köşeleri hap.

Sistem genelinde: 255 satır içi `style` (hedef < 60), ölü CSS
(`.attached-profiles`, `.field-help`, `.grid-3`, `.legal-nav`…), sabit renkler
(`#7dc21e`, `#fff`, tanımsız `--danger-soft-border`), 901–1023 px aralığında
sol menü yüzünden daralan iki sütunlu düzenler (container query veya menüyü
otomatik daraltma), kontrast: `--muted-2` (~3,8:1) küçük etiketlerde ve
`--warning` üstünde `--warning-soft` (~4,1:1), `role="tab"` ok tuşu desteği.

### A2. Fazlar

- **Faz 0 — bugün yapıldı (bu commit):** aşağıdaki B2 listesi.
- **Faz 1 — hızlı kazanımlar (≈3–4 gün):** tipografi ölçeği ve radius
  token'ları, ölü CSS ve sabit renk temizliği, ortak toast, çekmece/menü
  animasyonları, telefon düzeltmeleri (stack h1, yan paneller,
  `profile-order`, landing'de giriş linki, yasal gezinme), kontrast token'ları,
  kalan tüm "Yakında · Pro" işaretleri.
- **Faz 2 — büyük dönüşümler (≈2 hafta):** Projeler ve Kütüphane kart
  ızgaraları, `EntityCard`, proje detayı hero'su, AI talimatları ajan hapları ve
  sürüm rayı, sihirbaz, katalog sayfaları, ayarlar ve abonelik kartları. Her
  ekran kendi e2e güncellemesiyle aynı commit'te.
- **Faz 3 — cila (≈1 hafta):** seçilen landing, giriş/kayıt, yasal içindekiler,
  404/hata, komut paleti, satır içi stilleri 60'ın altına indirmek.

### A3. Landing seçenekleri

Mevcut landing'deki ürün görseli (`public/design/context-preview.png`) eski
yatay menüyü ve eski "DevContext" markasını gösteriyor (tarayıcıda
doğrulandı); yayından önce değişmeli. Üç yön tasarım tuvalinde (claude.ai
artifact "Oponoya landing önerileri"):

- **A · Ürün vitrini:** açık tema, sağda uygulamanın canlı HTML önizlemesi,
  ajan dosyaları şeridi, üç adım, karar biçimleri + örnek AGENTS.md, Free/Pro.
- **B · Geliştirici:** koyu tema, editör penceresinde dosya ağacı ve örnek
  AGENTS.md, özellik ızgarası, V1–V3+ planı.
- **C · Anlatı:** büyük tipografi, "Oponoya olmadan / ile", büyük numaralı
  adımlar, karar biçimleri satırları, SSS.

Seçilen yön PNG yerine canlı HTML/CSS ile kurulacak (görsel eskimesin).

---

## B. İlk production yayını

Karar hâlâ **BLOCKED**: kodda yayını durduran bir kusur yok; engeller hesap,
para, hukuk ve karar isteyen sahip işleri. Ama kapının dayandığı bazı kanıtlar
yeniden adlandırma ve bugünkü commit'ten sonra geçerliliğini yitirdi.

### B1. Kapı maddeleri (docs/44) — bugünkü durum

| # | Durum | Not | Taraf |
|---|---|---|---|
| P1–P4 | GEÇER (yerel) | 15/15 e2e; ekran görüntüleri yeni arayüzle yeniden alınmalı | Kod |
| S1/S5 güvenlik | Eskidi | Son inceleme rapor 45; 4d150cd için kısa inceleme gerekli | Kod |
| S2 izolasyon | **Kapandı** | `/v1/audit/presence` ve öneriler izolasyon matrisine eklendi | Kod |
| S3 başlıklar/çerezler | BLOCKED | Staging yok; HSTS artık çalışma zamanında (B2) | Sahip + Kod |
| S4 dışa aktarma | Uyarı | Hesap dışa aktarma etkinlik kaydını 5.000 satırla sınırlıyor; oturum açma satırları bu sınıra zamanla dolduracak | Kod |
| D1 migration | GEÇER | 0000–0009, bugün migration yok (doğrulandı) | — |
| D3 geri yükleme | Yalnız yerel | Yönetilen veritabanının kendi snapshot/PITR geri yüklemesi denenmedi | Sahip |
| D4 sağlık/geri dönüş | Abartılı | Docker imajı hiç derlenmedi (sahip ertelemişti) | Kod + Sahip |
| D5 uyarılar/yedek | BLOCKED | İzleme hesabı yok; web tarafında hata raporlama yok | Sahip + Kod |
| C1 faturalama | GEÇER (ücretsiz beta) | Kullanım Şartları §6 hâlâ ücretli Pro'dan söz ediyor, §8 sorumluluk sınırı ücretsiz üründe sıfır | Hukuk |
| L1 hukuk | BLOCKED | 10 `LEGAL_*` değeri eksik; gizlilik metni bugün güncellendi (B2) | Sahip + Hukuk |
| Q1 CI | Öncül değişti | Repo artık GitHub'da; smoke düzeldi (B2); Actions sonucu okunamıyor (`gh` girişsiz) | Kod + Sahip |
| Q2 erişilebilirlik | Eskidi | Sol menü, telefon çekmecesi ve %90 ölçek sonrası yeniden geçilmeli | Kod |
| Q3 bundle | GEÇER | `verify-bundle.mjs` güncel | — |

### B2. Faz 0 — bu commit'te yapılan düzeltmeler

1. `scripts/smoke.mjs` eski metinleri arıyordu ("DevContext", "Merhaba") ve
   yayın sonrası kontrol her ortamda başarısız olacaktı (doğrulandı). Artık
   ürün adını ve sol menü landmark'ını arıyor.
2. HSTS artık `apps/web/proxy.ts` içinde her istekte ekleniyor.
   `next.config.ts` başlıkları build sırasında sabitleniyor ve imajda
   `SITE_URL` olmadığı için HSTS hiç gönderilmeyecekti (doğrulandı).
3. `robots.ts` ve `sitemap.ts` `force-dynamic`: `SITE_URL` artık çalışma
   zamanında okunuyor, boş sitemap build'e gömülmüyor.
4. `deploy/compose.staging.yml` web servisine `SITE_URL`, `CLIENT_IP_HEADER`,
   `TRUSTED_PROXY_HOPS`; `deploy/env/*.example` bu değişkenleri açıklıyor
   (yanlış hop sayısı, tüm kullanıcıları tek bir giriş limit kovasına sokar).
5. Gizlilik metni: etkinlik kaydında oturum açma zamanları ve üç tercih
   çerezi (tema, kenar çubuğu, kapatılan duyuru) artık yazıyor.
6. Bugünkü değişikliklerden kalan gerilemeler:
   - genel bakışın `.overview` sınıfı proje detayındaki `.split.overview` ile
     çakışıyordu → `.overview-page`;
   - soluk AI panelleri metin kontrastını da düşürüyordu → yalnız çerçeve,
     ikon, etiket ve buton soluk;
   - telefonda kapalı çekmece klavyeyle odaklanabiliyordu → kapalıyken
     `visibility: hidden`;
   - sihirbaz özeti ve ayarlar menüsü kaldırılan 78 px başlığa göre
     yapışıyordu → üst bar yüksekliği;
   - `--ease-out` artık tüm sayfalarda kullanılabilir.
7. AI öneri panelindeki ayarlar linki yanlış bölüme gidiyordu
   (`?section=privacy` → `settings-privacy`).
8. İzolasyon matrisine `audit.presence` ve katalog önerileri eklendi.

### B3. Yayından önce kalan kod işleri

| İş | Neden | Efor |
|---|---|---|
| E-posta adaptörü (Resend/Postmark vb.) | `EMAIL_PROVIDER` yalnız `none|log`; sağlayıcı seçilince adaptör + env gerekiyor; şifre sıfırlama ancak o zaman açılır | M |
| "Şifremi unuttum" sayfasında iletişim adresi | `none` modunda "destekle iletişime geç" diyor ama adres yok → `LEGAL_CONTACT_EMAIL` | S |
| Web tarafı hata raporlama | `error.tsx` yalnız `console.error`; Next `onRequestError` ile API'nin kullandığı taşıyıcıya bağlanmalı veya log drain belgelenmeli | S–M |
| Üretimde hata raporlama yoksa açılış uyarısı | Şu an sessizce kapalı kalabilir | S |
| Hesap dışa aktarmada etkinlik kaydını sayfalama | 5.000 satır sınırı "tüm verin" vaadini bozabilir | S–M |
| 404 sayfası herkese açık metin | Anonim ziyaretçiye "Genel bakışa dön" diyor | S |
| Belgeler | `docs/12` (etkinlik kaydı kapsamı), `docs/17` (yeni iki uç nokta), `docs/24` (smoke/containers tikleri), `docs/44` ek notu | S |
| İlk Docker imaj derlemesi | `pnpm deploy --legacy` ve migration klasörünün imaja girdiği hiç denenmedi | S (makinede Docker gerekir) |
| Kısa güvenlik incelemesi (4d150cd + Faz 0) | S1/S5 kanıtı | S |
| Landing görseli | Eski marka; A3'teki seçimle birlikte | M |

Kabul edilmiş riskler (yeniden onay): hız sınırları süreç içi, yani yayın **tek
örnek** (instance) olmalı; `www.oponoya.com` izinli origin değil, kenarda apex'e
yönlendirilmeli.

### B4. Sahip kontrol listesi (sırayla)

1. **Kararlar (hesap gerekmez):**
   - Ücretsiz beta süresince Free'ye Cursor/Copilot çıktıları, zip ve fark
     açılsın mı? (Bugün yalnız Pro'da; `plans.ts`.)
   - Repo görünürlüğü: `origin/dev` iç belgeleri ve promptları içeriyor.
     Açık olacaksa `node scripts/sync-main.mjs --fresh` ve bilinçli force-push.
   - İndirilen dosya adlarında `devcontext` kalsın mı
     (`.cursor/rules/devcontext.mdc`, `devcontext-context.zip`)?
   - `BILLING_PROVIDER=none`, `AI_PROVIDER=none` ile başlamak.
2. **Barındırma** (API konteyneri, web konteyneri, tek seferlik migration işi,
   aylık zamanlanmış iş): `APP_ENV`, `RELEASE`, `API_HOST`, `API_PORT`,
   `TRUST_PROXY`, `SHUTDOWN_TIMEOUT_MS`; web: `API_URL`, `SITE_URL`,
   `CLIENT_IP_HEADER` veya `TRUSTED_PROXY_HOPS`; hukuk: `HOSTING_REGION`.
3. **Yönetilen PostgreSQL:** `DATABASE_URL` (`sslmode=verify-full`),
   `DATABASE_POOL_MAX`, `DATABASE_STATEMENT_TIMEOUT_MS`; PITR ve snapshot
   açık, `BACKUP_RETENTION_DAYS`.
4. **Alan adı ve TLS (oponoya.com):** apex, `api.` alt alan adı, www → apex;
   `CORS_ORIGIN=https://oponoya.com`, `BETTER_AUTH_URL=https://api.oponoya.com`,
   `SITE_URL=https://oponoya.com`, `INSECURE_HTTP_ORIGINS=false`.
5. **E-posta sağlayıcısı:** SPF/DKIM/DMARC'lı gönderici alan adı ve
   `LEGAL_CONTACT_EMAIL` için posta kutusu (B3'teki adaptör bundan sonra).
6. **İzleme:** `SENTRY_DSN` veya `ERROR_REPORTING_URL` + `ERROR_REPORTING_TOKEN`;
   `/ready` için uptime yoklaması; log drain.
7. **Hukuk:** `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_ADDRESS`, `LEGAL_CONTACT_EMAIL`,
   `LEGAL_JURISDICTION`, `LEGAL_EFFECTIVE_DATE`, `LEGAL_SUBPROCESSORS`,
   `BILLING_RECORDS_RETENTION_YEARS`; Şartlar §6/§8 ve fiyat duyurusu
   metninin incelenmesi; en son `LEGAL_APPROVED_AT`.
8. **Gizli değerler** platformun secret yöneticisinde: `BETTER_AUTH_SECRET`,
   iki serviste aynı `WEB_PROXY_SECRET`; staging değerleri production'da asla
   tekrar kullanılmaz.

### B5. Yayın sırası

1. B3'teki kod işleri → yerel kapı: typecheck, lint, test, build,
   `verify-bundle`, `test:db`, `test:e2e`.
2. İlk imaj derlemesi (`deploy/env/ci.env` ile):
   `docker compose -f deploy/compose.staging.yml up -d --build --wait`, sonra
   `node scripts/smoke.mjs --web http://127.0.0.1:3100 --api http://127.0.0.1:4100`.
3. GitHub Actions'ta `containers` işi dahil bir yeşil çalışma (Q1).
4. **Staging (TLS ile):** migration işi → API → web; smoke; `curl -I` ile CSP,
   HSTS, `__Secure-` oturum çerezi, `/workspace` için `X-Robots-Tag`;
   `restore-drill.mjs` ve bir sağlayıcı snapshot geri yüklemesi; bir test
   uyarısı; önceki etiketi yeniden yayınlayarak geri dönüş provası;
   `GET /v1/legal` → `missing: []`.
5. `docs/44` kapısını staging kanıtıyla yeniden çalıştır; yalnız GO sonrası
   Handoff 13 işaretlenir.
6. **Production:** manuel snapshot → migration → API → web → smoke; aylık
   `retention-cli.js` zamanlaması.

---

## Sahip için sorular (sıradaki adımları belirler)

1. Landing için A, B, C'den hangisi (veya karışımı)?
2. Ücretsiz beta boyunca Free'ye Cursor/Copilot/zip/fark açılsın mı?
3. Barındırma, veritabanı, e-posta ve izleme için tercih ettiğin sağlayıcılar
   var mı? (Hesapları sen açarsın; ajan hesap açmaz.)
4. Repo açık mı olacak, özel mi kalacak?
5. Yenilemede önce hangi faz: Faz 1 (hızlı kazanımlar) mı, doğrudan Faz 2'deki
   Projeler/Kütüphane kartları mı?
