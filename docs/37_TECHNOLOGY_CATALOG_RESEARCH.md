# 37 — Teknoloji Kataloğu ve AI-Uygunluk Araştırması

Tarih: 2026-09-07 · Veri: `data/catalog/`

## 1. Ne üretildi

| Dosya | Kayıt | İçerik |
| --- | --- | --- |
| `technologies.frontend.json` | 48 | Diller, framework'ler, UI/state/form/animasyon/grafik/build |
| `technologies.backend.json` | 39 | Runtime, framework, API katmanı, auth, cache, kuyruk, realtime |
| `technologies.database.json` | 32 | SQL/NoSQL/vektör/analitik, ORM, BaaS, CMS, arama, depolama |
| `technologies.ai.json` | 34 | AI kodlama araçları, LLM sağlayıcıları, ajan framework'leri, RAG, eval |
| `technologies.devops.json` | 29 | Hosting, CI/CD, IaC, monitoring, ödeme, e-posta, test, tasarım |
| `technologies.mobile-desktop.json` | 11 | Mobil, masaüstü, oyun motorları |
| `technologies.data-engineering.json` | 21 | Orkestrasyon, ELT/CDC, ambar/lakehouse, BI, veri kalitesi, MLOps |
| `technologies.security.json` | 20 | SAST/DAST/SCA, sır yönetimi, tedarik zinciri, SIEM, uyumluluk, LLM güvenliği |
| `technologies.turkey.json` | 12 | Ödeme, SMS/İYS, e-fatura, pazaryeri, kargo, yerli bulut, e-imza |
| `stacks.json` | 15 | Hazır yığın preset'leri + performans/ölçek/maliyet profili |
| `ai-readiness.json` | 50 | Doküman kalitesi, kullanım, topluluk, **AI ile geliştirilebilirlik** skorları |
| `velocity.json` | 15 stack + 13 teknoloji | **Prototip hızı, MVP süresi, üretime hazır olma süresi, üretim boşlukları** |

Toplam **246 teknoloji kaydı**, 15 stack preset'i, 50 AI-uygunluk ve 28 hız değerlendirmesi.
Doğrulandı (script ile): tüm JSON geçerli, 246 slug'ın tamamı benzersiz, tüm `type` değerleri `packages/db/src/schema.ts` içindeki `resourceType` enum'una uyumlu, `velocity.json` ve `ai-readiness.json` içindeki tüm slug referansları katalogda mevcut.

## 2. Veri güvenilirliği — bunu ürüne aynen taşıyın

`ai-readiness.json` içindeki `methodology` bloğu iki grubu ayırıyor:

**Ölçülen (kaynaklı):**
- Stack Overflow Developer Survey 2025 — framework payları: Node.js %49.1, React %46.9, Next.js %21.5
- Stack Overflow Developer Survey 2025 (AI bölümü) — AI kullanımı %84 (2024: %76), profesyonellerde günlük kullanım %51, doğruluğa güvenmeyenler %46 (2024: %31)
- AI aracı payları: GitHub Copilot %68, Claude Sonnet ~%45, Cursor %18, Claude Code %10, GPT modelleri %81-82

**Tahmin edilen (editör değerlendirmesi):**
- `docsQuality`, `communitySupport`, `aiBuildability`, `tokenEfficiency`, `trainingDataDensity`, `bestModels`, `aiPitfalls`

> Bu skorlar bir benchmark değildir. Sitede **"editör değerlendirmesi"** etiketiyle gösterin; "ölçüm" veya "benchmark" demeyin. Aksi halde ürün doğrulanamaz iddialarda bulunmuş olur.

**npm indirme ve GitHub yıldız sayıları bilinçli olarak yazılmadı.** Bunlar günlük değişir; katalogda sabit sayı tutmak veriyi ilk haftadan yanlış hale getirir. `methodology.liveMetricsPlan` bunların hangi API'lerden haftalık cron ile çekileceğini tanımlıyor.

## 3. Araştırmanın ana bulgusu: kalite ≠ AI başarısı

Bir teknolojinin AI ile ne kadar iyi geliştirilebildiğini belirleyen ana değişken **teknik kalitesi değil, eğitim verisindeki yoğunluğu ve API kararlılığıdır.**

Dört grup çıkıyor:

**A. Güvenli bölge — yüksek veri + kararlı API**
Python, TypeScript, React, Django, Laravel, Postgres, Prisma, Stripe, Playwright, Vitest.
AI ilk denemede çalışan kod üretir. Vibe coding için önerilecek çekirdek.

**B. Tuzak bölgesi — yüksek veri + hızlı kırılan API**
Next.js (App/Pages Router), LangChain (kaldırılmış zincirler), Vercel AI SDK (v3/v4/v5), Firebase (v8/v9), OpenAI SDK (v0/v1), Vue (2/3), Angular (NgModule/standalone), Svelte (4/5).
**En tehlikeli grup:** AI kendinden emin biçimde artık çalışmayan kod üretir. Bu teknolojiler için proje bağlamına sürüm kuralı yazmak zorunludur.

**C. Kör nokta — düşük veri, iyi teknoloji**
Hono, Cloudflare Workers, Drizzle, MCP, Mastra, Elixir/Phoenix, Tauri.
AI Node/Express reflekslerine kayar. Çözüm: dokümanı bağlama enjekte etmek (MCP veya `llms.txt`).

**D. Zor bölge — dilin kendisi zor**
Rust (ownership/lifetime), Kubernetes YAML, Terraform.
AI döngüye girer, iterasyon ve token maliyeti yüksektir. Vibe coding için önerilmemeli.

## 4. Güvenlik: AI'ın tekrar eden kritik hataları

Katalogdaki `aiPitfalls` alanında işaretlendi; bunlar doğrudan kural motoruna uyarı olarak beslenmeli:

1. **Supabase/Firebase — eksik veya tamamen açık satır güvenliği (RLS / security rules).** Vibe coding ile üretilen projelerdeki en yaygın ciddi açık.
2. **Stripe — webhook imza doğrulamasının atlanması.** Doğrudan finansal risk.
3. **Express/PHP/WordPress — eski dönem güvensiz örüntüler** (SQL string birleştirme, eksik rate limit).
4. **Docker/Kubernetes — root kullanıcı, imaja gömülü sırlar, tanımsız kaynak limitleri.**
5. **Terraform — aşırı geniş IAM izni; denetimsiz `apply`.**

## 5. Token ekonomisi

Aynı işi yapan kodun bağlam maliyeti kayda değer ölçüde farklı:

- **En verimli:** Python, Svelte, Hono, FastAPI, htmx, Vitest
- **Orta:** TypeScript, React, Go, Laravel, Docker
- **En pahalı:** Java, Angular, Flutter (widget ağaçları), NestJS (boilerplate), Kubernetes YAML

Tailwind özel bir durum: AI üretimi için ideal (tek dosyada çalışır, ayrı CSS gerektirmez) ama uzun class listeleri bağlamda yer kaplar.

## 6. Hız metrikleri: prototip ≠ üretime hazır

`velocity.json`'ın tek en önemli bulgusu: **prototip hızı ile üretime hazırlık ters orantılıdır.**
Ürün bu ikisini tek bir "hız" skoru olarak birleştirirse kullanıcıyı yanıltır ve güvensiz sistemlerin canlıya çıkmasına yol açar.

| Yığın | Prototip | MVP | Üretime hazır | Proto/Prod skoru |
| --- | --- | --- | --- | --- |
| Vibe coding (Lovable/v0) | 2-6 saat | 2-5 gün | **3-6 hafta** | 5 / 2 |
| Next.js + Supabase | 4-8 saat | 3-7 gün | 2-4 hafta | 5 / 3 |
| Laravel + Livewire | 4-8 saat | 3-7 gün | 2-3 hafta | 5 / 4 |
| Rails + Hotwire | 4-8 saat | 3-7 gün | 2-3 hafta | 5 / 5 |
| Django + HTMX | 1 gün | 1-2 hafta | 2-3 hafta | 4 / 5 |
| T3 Stack | 1 gün | 1-2 hafta | 3-5 hafta | 4 / 4 |
| MERN | 4-8 saat | 1-2 hafta | **4-6 hafta** | 4 / 2 |
| AI / RAG yığını | 1-2 gün | 2-3 hafta | **6-10 hafta** | 4 / 2 |
| Expo + Supabase (mobil) | 1 gün | 2-3 hafta | 5-8 hafta | 4 / 3 |
| Jamstack içerik | 2-4 saat | 2-4 gün | **1 hafta** | 5 / 5 |
| Go mikroservis | 2-3 gün | 3-5 hafta | 8-12 hafta | 2 / 4 |
| Kurumsal Java | 1 hafta | 2-4 ay | 4-8 ay | 1 / 5 |

Referans: teknolojiyi bilen 1 deneyimli geliştirici + AI asistanı, tam zamanlı. Yeni öğrenen için 2-3 katı.

**Dikkat çeken üç aralık:**

1. **Vibe coding'de MVP→üretim mesafesi en uzun.** "Çalışıyor" ile "canlıya çıkabilir" arasında 3-6 hafta var; bunun büyük kısmı güvenlik ve test borcunu kapatmak.
2. **AI/RAG en yanıltıcı kategori.** Demo 1 günde çıkıyor, güvenilir ürün 2 aya yaklaşıyor. Fark: eval seti, maliyet tavanı, prompt injection savunması ve gözlemlenebilirlik.
3. **MERN'in üretim borcu Rails/Django'nun iki katı.** Sebep tek: framework hiçbir güvenlik varsayılanı vermiyor, her şey elle kuruluyor.

Türkiye'ye özel iki takvim kalemi (`velocity.json` içinde işaretli):
- **iyzico/PayTR üye iş yeri başvurusu:** teknik entegrasyon yarım gün, onay süreci 2-4 hafta → projenin **ilk haftasında** başlatılmalı.
- **e-Fatura entegratör + mali mühür:** teknik iş 1-2 gün, bürokratik süreç 3-6 hafta. Türkiye projelerinde en çok küçümsenen kalem.
- **Mobil:** App Store onayı 1-7 gün + red riski → takvime her zaman 1-2 hafta mağaza payı ekleyin.

## 7. Güvenlik ve veri katmanı — kapsama eklendi

**Güvenlik (20 kayıt):** OWASP Top 10/ASVS, Semgrep, CodeQL, Snyk, Dependabot/Renovate, Trivy, Gitleaks/TruffleHog, Vault/OpenBao, Infisical/Doppler, OWASP ZAP, Burp Suite, SonarQube, Cloudflare WAF+Turnstile, rate limiting, Sigstore/SBOM, Falco, Wazuh, Vanta/Drata, **OWASP LLM Top 10**, **KVKK/GDPR**.

> Saldırı araçları (Burp, ZAP) `tags` alanında `yetkili-kullanım` etiketiyle işaretlendi. Ürün bu kayıtları gösterirken bu etiketi görünür tutmalı.

**Veri mühendisliği (21 kayıt):** Airflow, Dagster, Prefect, Kestra, dbt, Airbyte, Fivetran, Debezium (CDC), Spark, Polars, pandas, Snowflake, BigQuery, Databricks, Iceberg, Trino, Metabase, Superset, Power BI/Looker, Great Expectations, MLflow.

**Türkiye (12 kayıt):** PayTR, Craftgate, Shopier/Papara, Netgsm/İleti Merkezi, **İYS**, e-Fatura entegratörleri, Paraşüt/KolayBi, Trendyol/Hepsiburada/N11 API'leri, Ticimax/İdeaSoft, yerli bulut (Turkcell/TT/Bulutistan), e-Devlet/e-İmza, kargo entegrasyonları. (iyzico zaten `devops` dosyasındaydı.)

Türkiye kayıtlarında **komisyon oranı, limit ve fiyat bilinçli olarak yazılmadı** — bunlar sık değişir ve katalogda sabitlenirse ürün yanlış bilgi yayar. Her kaydın `note` alanı bunu belirtiyor.

## 8. Ürüne entegrasyon önerisi

> **Durum (2026-09-08, rapor 39):** 1 (Library'ye isteğe bağlı ekleme, toplu seed
> değil), 2 (alternatif/birlikte kullanım referansları), 3 (stack preset →
> PREFERRED stack Profile), 5 ("AI fit" rozeti, editör değerlendirmesi etiketiyle)
> ve 9 (iki ayrı skor) uygulandı. 4, 6, 7 ve 8 `18_BACKLOG.md` içinde P2 olarak
> bekliyor. Veri `packages/catalog` tarafından derleme zamanında gömülür; JSON
> dosyaları tek kaynak olmaya devam eder.

1. **Seed:** `data/catalog/*.json` → `resources` tablosu. `type` alanı zaten `schema.ts`'teki `resourceType` enum'una uyumlu.
2. **Graf:** `alternatives` ve `pairsWith` alanları slug referansı — "bunu seçtiysen şunlar da gerekir" önerileri ve alternatif karşılaştırma ekranı buradan gelir.
3. **Stack Wizard:** `stacks.json` doğrudan preset kaynağı; `bestFor` / `notFor` alanları wizard'ın eleme sorularını besler.
4. **AI Decision Engine:** `ai-readiness.json` → `aiPitfalls` alanı, üretilen proje bağlamına otomatik "kaçınılacaklar" kuralı olarak yazılmalı. Bu, ürünün asıl farklılaştırıcısı: *bir stack'i seçtiğinizde, o stack'te AI'ın yapacağı bilinen hataları da bağlama koyar.*
5. **Rozet sistemi:** `aiBuildability` skoru "AI ile geliştirmeye uygunluk" rozeti olarak gösterilebilir — ama editör değerlendirmesi etiketiyle.
6. **Canlı metrikler:** haftalık cron ile npm/GitHub/PyPI çek, katalogda tutma.
7. **Launch checklist:** `velocity.json` → `productionGaps` alanı, projenin çıkış kontrol listesine doğrudan yazılmalı. Kullanıcı bir stack seçtiğinde ürün ona "canlıya çıkmadan önce şu 6 maddeyi kapat" diyebilir — bu, mevcut `24_LAUNCH_CHECKLIST.md` belgesini otomatik ve stack'e özel hale getirir.
8. **Takvim uyarıları:** Türkiye'ye özel bürokratik süreçler (ödeme başvurusu, e-fatura, mağaza onayı) proje oluşturulurken erken uyarı olarak gösterilmeli — teknik değil takvim riskidir.
9. **İki ayrı rozet:** "Prototip hızı" ve "Üretime hazırlık" ASLA tek skorda birleştirilmemeli.

## 9. Bilinen eksikler

- `docsQuality`, `communitySupport`, `aiBuildability`, `prototypeSpeed`, `productionReadiness` ve tüm süre tahminleri tek kişilik değerlendirme; ürüne çıkmadan ikinci bir gözle doğrulanmalı.
- Türkiye kayıtlarındaki komisyon/limit/fiyat bilgileri bilinçli olarak boş — bunları gösterecekseniz sağlayıcı dokümanından canlı doğrulama gerekir.
- Oyun geliştirme (Unity/Godot dışı), gömülü sistemler, blockchain ve veri bilimi notebook araçları kapsam dışı.
- Kargo ve pazaryeri API'leri tek kayıtta gruplandı; entegrasyon yazacak biri için her firma ayrı kayıt olmalı.
- `alternatives` / `pairsWith` alanlarında **386 adet henüz katalogda kaydı olmayan slug referansı** var (ör. `mikro-orm`, `delta-lake`, `zed`, `cloudflare-d1`). Bu kasıtlı: hem "eklenecek teknoloji" kuyruğu hem de grafın genişleme noktası. **Seed script'i bu referansları zorunlu foreign key olarak işlememeli** — aksi halde import başarısız olur. Çözülemeyen referanslar ayrı bir `pending_resources` listesine yazılmalı.

## Kaynaklar

- [Technology | 2025 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2025/technology)
- [AI | 2025 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2025/ai)
- [Stack Overflow 2025 Developer Survey — basın bülteni](https://stackoverflow.co/company/press/archive/stack-overflow-2025-developer-survey/)
- [Developers remain willing but reluctant to use AI](https://stackoverflow.blog/2025/12/29/developers-remain-willing-but-reluctant-to-use-ai-the-2025-developer-survey-results-are-here/)
- [LLM coding benchmarks: A complete guide (Openlayer)](https://www.openlayer.com/blog/llm-coding-benchmarks-complete-guide)
- [LiveCodeBench](https://arxiv.org/pdf/2403.07974)
