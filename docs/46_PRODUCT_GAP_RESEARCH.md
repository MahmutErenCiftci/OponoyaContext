# 46 — Ürün Araştırması: Kesin Eksikler ve Öneriler

Tarih: 2026-09-26 · Kapsam: dokümanlarda vaat edilenle kodun karşılaştırılması
(eksik analizi) ve kodlama ajanı talimat dosyaları, dağıtım yöntemleri ve
rakipler üzerine web araştırması. Bu araştırmada bulunup aynı gün kapatılan
maddeler ✅ ile işaretli; kalanlar sahip kararı ya da sonraki iş.

## 1. Kısa özet

1. **En büyük ürün boşluğu, ücretsiz beta kararının yan etkisi.**
   `BILLING_PROVIDER=none` iken herkes Free planda; Cursor ve Copilot dışa
   aktarımı, zip paketi ve sürüm farkı (diff) lansmanda kullanılamıyor.
   Yol haritası bunları V1 için vaat ediyor. Karar: betada bu özellikler
   açılsın mı?
2. **Şifremi unuttum akışı yoktu** (unutulan şifre = kalıcı kilit). ✅ Kodu
   yazıldı; gerçek bir e-posta sağlayıcısı bağlanınca açılıyor.
3. **Dosyaları depoya taşımak elle yapılıyor.** Rakipler komut satırı
   aracı, GitHub eylemi/PR botu ve MCP sunucusu sunuyor; DevContext yalnızca
   kopyala/indir sunuyor.
4. **Dışa aktarılan dosyalar birbirini tekrar ediyor.** Aynı içerik AGENTS.md,
   CLAUDE.md ve Cursor kuralında ayrı ayrı; Cursor üçünü birden okuyor, Claude
   Code ise CLAUDE.md varken AGENTS.md'yi okumuyor.
5. **İlk kullanım deneyimi katalogdan yararlanmıyor**; örnek veri İngilizce ve
   Free limitlerini (2 profil, 1 tarif) hemen dolduruyor.

## 2. Dokümanlarda vaat edilip kodda olmayanlar

| # | Eksik | Durum |
| --- | --- | --- |
| 1 | Ücretsiz betada Cursor/Copilot dışa aktarımı, zip paketi ve diff kapalı (Free planda yoklar) | Sahip kararı (rapor 44 eki) |
| 2 | Ücretli lansman yok: Stripe adaptörü bu derlemede yok, aylık/yıllık Pro ayrımı yok | Sahip kararı |
| 3 | "Projeyi tarif olarak kaydet" yalnızca API'de vardı | ✅ Proje menüsüne eklendi (e2e ile) |
| 4 | Onboarding Akış A: katalogdan 5–10 kaynak seçimi, tasarım profili adımı ve "değer anı" mesajı yok; örnek veri İngilizce | Öneri (bkz. §6) |
| 5 | Herkese açık fiyatlandırma ve yardım/doküman sayfası yok | Öneri |
| 6 | Doğrulama/büyüme varlıkları (5 dış geliştirici testi, 90 sn demo, örnekler) yok | Sahip işi |

## 3. Kısmen var olanlar

- **Teknoloji değiştirme (Akış E):** uyarılar yalnızca kaydettikten sonra
  görünüyor; kaydetmeden önce etki özeti, alternatif önerisi ya da otomatik
  yeniden derleme/fark yok.
- **Proje sihirbazı:** "Kaynak ekle" Kütüphane'yi yeni sekmede açıyor ve taslak
  saklanmıyor; karar alanı listeleri türe göre süzülmüyor ve 100 kaynakla
  sınırlı; özel slotlar (ör. `frontend.component.toggle`) sihirbazda görünmüyor.
- **Plan görünürlüğü:** Free kullanıcı Cursor/Copilot önizlemesini ham
  görünümde okuyabiliyor, yalnızca kopyala/dışa aktar kapalı; kilitli
  seçeneklerde "Pro" rozeti yok.
- **Listeler:** ✅ Kütüphane ve Projeler'e "Daha fazla göster" eklendi;
  Profiller/Tarifler tam sayfa (100) yüklüyor. Uyumluluk kuralı seçicisi yalnızca
  ekranda yüklü kaynakları sunuyor.
- **Etkinlik geçmişi:** API var (`GET /v1/audit`), ama ayrı bir Geçmiş sayfası
  yok (son 5/4 olay gösteriliyor). ✅ Yeni eylemlerin etiketleri Türkçeleştirildi.
- **Kütüphane:** içe aktarma, seçimden profil oluşturma, etiket/kaynak/kullanım
  filtreleri ve "kullanan projeler" sütunu yok (API etiket filtresini destekliyor).
- **Free limitleri ve örnek veri:** örnek veriler 2/2 profili ve 1/1 tarifi
  dolduruyor; ardından stack profili, "profil olarak kaydet" ve yeni tarif
  engelleniyor. Tüm hazır stack'ler birlikte 80 kaynak istiyor (Free: 50).
- **Tekil kalıcı silme:** proje/kaynak/profil/tarif yalnızca arşivlenebiliyor;
  kalıcı silme yalnızca hesap düzeyinde var.
- **Türkçe tutarlılık:** ✅ API hata kodları, abonelik durumları, plan
  metinleri ve uyarı başlıkları Türkçeleştirildi. Kalanlar: örnek veri,
  içe aktarma uyarıları, derleyici uyarı cümleleri (dışa aktarılan dosyayla
  aynı kalsın diye İngilizce), stack profili gerekçesi, sihirbaz öneri çipleri.

## 4. Lansmanı etkileyen UX eksikleri

| Eksik | Durum |
| --- | --- |
| Şifre sıfırlama yok | ✅ Yazıldı (e-posta sağlayıcısı bağlanınca açılır) |
| E-posta doğrulama yok (yanlış yazılan adres kurtarılamıyor; kayıt var olan adresi ele veriyor) | E-posta sağlayıcısına bağlı; sonraki iş |
| Her plan reddi "Plan sayfasından yükselt" diyordu ama betada yükseltme yok | ✅ Metin nötrleştirildi |
| Tarih ve saatler etiketsiz UTC idi (Türkiye'de 3 saat kayık) | ✅ Türkiye saati |
| Hata bildirimleri başarı simgesiyle görünüyordu (Ayarlar) | ✅ Kırmızı uyarı, `role="alert"` |
| İndirilen dosyalar klasör yolunu kaybediyor (`devcontext.mdc`) | ✅ Bildirim depo yolunu söylüyor; kalıcı çözüm §6 |
| Toplu işlemler, geri al, Ctrl+K dışında klavye kısayolu, erişilebilirlik beyanı | Öneri |
| Giriş sayfası ekip özellikleri ve sürüme geri dönme vaat ediyordu | ✅ Metin düzeltildi |

## 5. Ajan talimat dosyaları ve pazar (web araştırması)

Bu bölüm web kaynaklarına dayanıyor (liste en sonda); bağımsız olarak
doğrulanmadı.

**Formatlar (Eylül 2026):**
- AGENTS.md fiilî standart: Linux Foundation bünyesinde, agents.md'ye göre 20+
  araç okuyor (Codex, Cursor, Copilot, Jules, Devin Desktop, Junie, Kiro, Amp,
  Zed…). Codex dosyaları kökten çalışma dizinine birleştiriyor, toplam 32 KiB
  sınırıyla.
- Claude Code AGENTS.md'yi okuyor ama CLAUDE.md varsa varsayılan olarak onu
  kullanıyor; önerilen yol, içinde `@AGENTS.md` bulunan kısa bir CLAUDE.md.
- Cursor: `.mdc` kuralları geçerli (`alwaysApply: true` iken `description`
  yok sayılıyor); ayrıca AGENTS.md ve CLAUDE.md'yi de kendiliğinden okuyor.
  `.cursorrules` eski.
- Copilot: `.github/copilot-instructions.md` her yüzeyde geçerli; yol bazlı
  `.github/instructions/*.instructions.md` (`applyTo`) var. VS Code Copilot
  AGENTS.md'yi de okuyor.
- Gemini CLI varsayılan olarak GEMINI.md okuyor (AGENTS.md yalnızca ayarla).
- Boyut sınırları: Codex 32 KiB, Claude Code dosya başına ~200 satır önerisi,
  Cursor kural başına 500 satır, Devin Desktop 12.000 karakter.

**Bizim çıktımız için sonuçlar:**
1. Kullanıcı tüm dosyaları depoya koyarsa Cursor aynı içeriği üç kez,
   VS Code Copilot iki kez yüklüyor.
2. CLAUDE.md verdiğimiz için Claude Code AGENTS.md'deki sonraki düzeltmeleri
   görmüyor.
3. PROJECT_CONTEXT.md'yi hiçbir araç kendiliğinden yüklemiyor.
4. Yeniden indirmek kullanıcının dosyada yaptığı düzenlemeleri eziyor
   (Next.js BEGIN/END işaretli blokla bunu çözüyor).

**Dağıtım ve rakipler:**
- Komut satırı senkronu: rulesync (50+ hedef), Ruler (30+ hedef); ikisi de açık
  kaynak ve ücretsiz.
- CI/PR: Agent Sync Action (farkı PR ile commit'ler ya da kayma varsa CI'yi
  düşürür).
- MCP sunucuları: Packmind, Tessl, Lockstep, Unblocked ($29/kullanıcı/ay),
  Context7 (Pro $10/koltuk/ay). Kavram olarak en yakın rakip **Lockstep**:
  karar defteri, bağlayıcı kararlar ve oturum başında brifing (yalnızca Claude
  Code, pilot).
- Kurallar/yetenekler pazarları: PRPM, skills.sh, Cursor ve Claude Code
  eklenti pazarları; ekip düzeyinde zorunlu kurallar (Cursor Team Rules,
  Copilot organizasyon talimatları).

## 6. Öneriler (öncelik sırasıyla)

Lansmandan önce:
1. **Beta kapsamı kararı:** betada Cursor/Copilot/zip/diff açılsın mı?
   (Kod tarafında tek satırlık plan tanımı; karar sahibin.)
2. **E-posta sağlayıcısı** (Resend/Postmark/SES gibi): şifre sıfırlama hazır;
   ardından e-posta doğrulama.
3. **AGENTS.md öncelikli dışa aktarım** (küçük iş, derleyici sürüm artışı):
   AGENTS.md tam içerik; CLAUDE.md = `@AGENTS.md` + Claude'a özel notlar;
   GEMINI.md ekle; Cursor `.mdc` isteğe bağlı olsun; copilot-instructions.md tam
   kalsın. Tekrar yüklemeyi ve "Claude AGENTS.md'yi görmüyor" sorununu bitirir.
4. **Yönetilen blok işaretleri** (BEGIN/END): yeniden dışa aktarım yalnızca
   DevContext bloğunu değiştirsin; indirmeden önce fark göster.
5. **Boyut ve tekrar denetimi:** her hedefin bütçesine göre uyar (32 KiB,
   200/500 satır).
6. **İlk kullanım:** katalogdan 5–10 teknoloji seçtiren adım, Türkçe örnek
   veri, Free limitleriyle çakışmayan örnek seti.
7. **Fiyatlandırma ve yardım sayfası** (beta koşulları ve limitlerle).

Lansmandan sonra:
8. **Komut satırı aracı** (`devcontext pull` / `devcontext check`): dosyaları
   işaretli bloklarla yazar, CI'de kaymayı yakalar. (API anahtarı/token gerekir.)
9. **GitHub eylemi / PR botu:** proje kararları değişince PR açar.
10. **Salt okunur MCP sunucusu:** `get_decisions`, `check_tool(name)`;
    `AI_DECIDE` için öneri; ajanlar yeniden dışa aktarmadan güncel kararları görür.
11. **Mevcut dosyalardan içe aktarma:** var olan AGENTS.md/CLAUDE.md ve paket
    dosyalarından karar önerisi (AI adımı zaten hazır).
12. **Monorepo/yol bazlı çıktı** (iç içe AGENTS.md, `applyTo`, `globs`),
    Kütüphane araçları için doküman işaretçileri, tarifler için SKILL.md,
    ardından ekip yönetimi (V2).

## Kaynaklar (web araştırması)

- https://agents.md/
- https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation
- https://learn.chatgpt.com/docs/agent-configuration/agents-md
- https://code.claude.com/docs/en/memory
- https://cursor.com/docs/context/rules
- https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions
- https://docs.github.com/en/copilot/reference/custom-instructions-support
- https://geminicli.com/docs/cli/gemini-md/
- https://docs.devin.ai/desktop/cascade/memories
- https://zed.dev/docs/ai/instructions
- https://nextjs.org/blog/next-16-2-ai
- https://github.com/dyoshikawa/rulesync
- https://github.com/intellectronica/ruler
- https://github.com/julien777z/agent-sync-action
- https://packmind.com/
- https://github.com/lockstep-team-agent/lockstep
- https://getunblocked.com/pricing
- https://context7.com/plans
- https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals
