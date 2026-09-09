# Katalog (Seed Data)

DevContext OS Resource Library ve Stack Wizard için hazırlanmış, koddan bağımsız veri katalogu.
Buradaki dosyalar **kod değildir**; seed script'i, discovery motoru ve stack önerici tarafından okunur.

## Dosyalar

| Dosya | İçerik |
| --- | --- |
| `technologies.frontend.json` | Diller, frontend framework'leri, UI kütüphaneleri, state, form, animasyon, ikon, grafik |
| `technologies.backend.json` | Runtime'lar, backend framework'leri, API katmanı, auth, queue, cache, realtime |
| `technologies.database.json` | SQL/NoSQL/vektör/analitik veritabanları, ORM'ler, migration ve BaaS |
| `technologies.ai.json` | LLM sağlayıcıları, AI coding tool'ları, agent framework'leri, RAG, MCP, gözlemlenebilirlik |
| `technologies.devops.json` | Deployment, CI/CD, container, IaC, monitoring, test, ödeme/e-posta/analitik servisleri |
| `technologies.mobile-desktop.json` | Mobil ve masaüstü framework'leri, cross-platform araçlar |
| `technologies.data-engineering.json` | Orkestrasyon, ELT/CDC, veri ambarı, lakehouse, BI, MLOps |
| `technologies.security.json` | SAST/DAST/SCA, sır yönetimi, tedarik zinciri, SIEM, uyumluluk, LLM güvenliği |
| `technologies.turkey.json` | Türkiye'ye özel ödeme, SMS, e-fatura, pazaryeri, kargo, bulut, mevzuat |
| `stacks.json` | Hazır tech stack preset'leri; hangi proje için uygun, performans/maliyet/ölçek profili |
| `ai-readiness.json` | Doküman kalitesi, kullanım oranı, topluluk, AI ile geliştirilebilirlik skorları |
| `velocity.json` | Prototip hızı, MVP süresi, üretime hazır olma süresi, üretim boşlukları |

## Teknoloji kaydı şeması

```jsonc
{
  "slug": "nextjs",                  // resources.slug ile birebir
  "name": "Next.js",
  "type": "framework",               // resource_type enum değeri (schema.ts)
  "category": "frontend/meta-framework",
  "summary": "Tek cümlelik tanım",
  "whatFor": "Ne işe yarar / hangi problemi çözer",
  "whereUsed": "Nerede, hangi tip projelerde kullanılır",
  "commonUse": "En yaygın gerçek dünya kullanımı",
  "strengths": ["..."],
  "tradeoffs": ["..."],
  "popularity": "very-high | high | medium | niche",
  "maturity": "mature | stable | emerging | experimental",
  "learningCurve": "low | medium | high",
  "license": "MIT",
  "pricing": "free | freemium | paid | usage-based",
  "docsUrl": "https://...",
  "repoUrl": "https://...",
  "installCommand": "pnpm add next",
  "alternatives": ["remix", "nuxt"],
  "pairsWith": ["react", "tailwindcss"],
  "tags": ["ssr", "react", "fullstack"]
}
```

## Stack kaydı şeması

```jsonc
{
  "slug": "t3-stack",
  "name": "T3 Stack",
  "summary": "...",
  "layers": { "language": [...], "frontend": [...], "backend": [...], "database": [...], "infra": [...] },
  "bestFor": ["..."],
  "notFor": ["..."],
  "performance": "Metin açıklama",
  "scalability": "...",
  "cost": "...",
  "teamSize": "solo | small | medium | large",
  "learningCurve": "low | medium | high",
  "timeToMvp": "days | 1-2 weeks | weeks | months",
  "usedBy": ["..."],
  "tags": ["..."]
}
```

## Hız kaydı şeması (`velocity.json`)

```jsonc
{
  "slug": "nextjs-supabase",
  "timeToPrototype": "4-8 saat",
  "timeToMvp": "3-7 gün",
  "timeToProductionReady": "2-4 hafta",
  "prototypeSpeed": 5,          // 1-5
  "productionReadiness": 3,      // 1-5
  "productionGaps": ["RLS denetimi", "rate limiting", "..."],
  "opsBurden": "düşük",
  "hiddenCosts": ["..."],
  "verdict": "..."
}
```

> **Kritik:** `prototypeSpeed` ile `productionReadiness` ters orantılıdır ve **ayrı gösterilmelidir**.
> Tek bir "hız" skoru kullanıcıyı yanıltır: vibe coding yığını prototipte 5/5, üretime hazırlıkta 2/5'tir.
> `productionGaps` alanı, o yığında canlıya çıkmadan önce kapatılması zorunlu maddeleri listeler ve
> proje bağlamına doğrudan çıkış kontrol listesi (launch checklist) olarak yazılmalıdır.

## Kurallar

- `slug` global olarak benzersizdir, kebab-case.
- `type` alanı **mutlaka** `packages/db/src/schema.ts` içindeki `resourceType` enum değerlerinden biri olmalıdır.
- `alternatives` ve `pairsWith` alanları başka kayıtların `slug` değerlerini işaret eder (graf ilişkisi).
- Sürüm numarası tutulmaz; sürümler `.local/latest-versions.json` üzerinden çözülür.
