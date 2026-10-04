import type {
  CatalogDomain,
  CatalogLevel,
  CatalogMaturity,
  CatalogPopularity,
  CatalogPricing,
  CatalogStackLayer,
  CatalogTeamSize,
  CatalogTimeToMvp,
} from "@devcontext/contracts";
import { defineCopy } from "./i18n";

export const domainLabels = defineCopy<Record<CatalogDomain, string>>({
  tr: {
    frontend: "Frontend",
    backend: "Backend",
    database: "Veri ve depolama",
    ai: "AI ve ajanlar",
    "devops-and-services": "DevOps ve servisler",
    "mobile-and-desktop": "Mobil ve masaüstü",
    "data-engineering": "Veri mühendisliği",
    security: "Güvenlik",
    turkey: "Türkiye",
  },
  en: {
    frontend: "Frontend",
    backend: "Backend",
    database: "Data and storage",
    ai: "AI and agents",
    "devops-and-services": "DevOps and services",
    "mobile-and-desktop": "Mobile and desktop",
    "data-engineering": "Data engineering",
    security: "Security",
    turkey: "Türkiye",
  },
});

export const popularityLabels = defineCopy<Record<CatalogPopularity, string>>({
  tr: { "very-high": "Çok yaygın", high: "Yaygın", medium: "Yerleşik", niche: "Niş" },
  en: { "very-high": "Very common", high: "Common", medium: "Established", niche: "Niche" },
});

export const maturityLabels = defineCopy<Record<CatalogMaturity, string>>({
  tr: { mature: "Olgun", stable: "Kararlı", emerging: "Gelişmekte", experimental: "Deneysel" },
  en: { mature: "Mature", stable: "Stable", emerging: "Emerging", experimental: "Experimental" },
});

export const levelLabels = defineCopy<Record<CatalogLevel, string>>({
  tr: { low: "Kolay öğrenilir", medium: "Orta öğrenme eğrisi", high: "Dik öğrenme eğrisi" },
  en: { low: "Easy to learn", medium: "Moderate learning curve", high: "Steep learning curve" },
});

export const pricingLabels = defineCopy<Record<CatalogPricing, string>>({
  tr: { free: "Ücretsiz", freemium: "Freemium", paid: "Ücretli", "usage-based": "Kullanıma göre" },
  en: { free: "Free", freemium: "Freemium", paid: "Paid", "usage-based": "Usage-based" },
});

export const teamSizeLabels = defineCopy<Record<CatalogTeamSize, string>>({
  tr: { solo: "Solo geliştirici", small: "Küçük ekip", medium: "Orta ölçekli ekip", large: "Büyük ekip" },
  en: { solo: "Solo developer", small: "Small team", medium: "Mid-sized team", large: "Large team" },
});

export const timeToMvpLabels = defineCopy<Record<CatalogTimeToMvp, string>>({
  tr: { days: "Günler içinde MVP", "1-2 weeks": "1–2 haftada MVP", weeks: "Haftalar içinde MVP", months: "Aylar içinde MVP" },
  en: { days: "MVP within days", "1-2 weeks": "MVP in 1–2 weeks", weeks: "MVP within weeks", months: "MVP within months" },
});

export const layerLabels = defineCopy<Record<CatalogStackLayer, string>>({
  tr: { language: "Dil", frontend: "Frontend", backend: "Backend", database: "Veritabanı", infra: "Altyapı" },
  en: { language: "Language", frontend: "Frontend", backend: "Backend", database: "Database", infra: "Infrastructure" },
});

/** Tag the research uses to flag offensive-security tooling; the UI must keep it visible. */
export const authorizedUseTag = "yetkili-kullanım";

/** Diacritic- and case-insensitive matching, shared by the client filter and the API. */
export function foldText(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}
