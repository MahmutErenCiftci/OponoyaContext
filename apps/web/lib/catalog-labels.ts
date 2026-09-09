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

export const domainLabels: Record<CatalogDomain, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Veri ve depolama",
  ai: "AI ve ajanlar",
  "devops-and-services": "DevOps ve servisler",
  "mobile-and-desktop": "Mobil ve masaüstü",
  "data-engineering": "Veri mühendisliği",
  security: "Güvenlik",
  turkey: "Türkiye",
};

export const popularityLabels: Record<CatalogPopularity, string> = {
  "very-high": "Çok yaygın",
  high: "Yaygın",
  medium: "Yerleşik",
  niche: "Niş",
};

export const maturityLabels: Record<CatalogMaturity, string> = {
  mature: "Olgun",
  stable: "Kararlı",
  emerging: "Gelişmekte",
  experimental: "Deneysel",
};

export const levelLabels: Record<CatalogLevel, string> = {
  low: "Kolay öğrenilir",
  medium: "Orta öğrenme eğrisi",
  high: "Dik öğrenme eğrisi",
};

export const pricingLabels: Record<CatalogPricing, string> = {
  free: "Ücretsiz",
  freemium: "Freemium",
  paid: "Ücretli",
  "usage-based": "Kullanıma göre",
};

export const teamSizeLabels: Record<CatalogTeamSize, string> = {
  solo: "Solo geliştirici",
  small: "Küçük ekip",
  medium: "Orta ölçekli ekip",
  large: "Büyük ekip",
};

export const timeToMvpLabels: Record<CatalogTimeToMvp, string> = {
  days: "Günler içinde MVP",
  "1-2 weeks": "1–2 haftada MVP",
  weeks: "Haftalar içinde MVP",
  months: "Aylar içinde MVP",
};

export const layerLabels: Record<CatalogStackLayer, string> = {
  language: "Dil",
  frontend: "Frontend",
  backend: "Backend",
  database: "Veritabanı",
  infra: "Altyapı",
};

/** Tag the research uses to flag offensive-security tooling; the UI must keep it visible. */
export const authorizedUseTag = "yetkili-kullanım";

/** Diacritic- and case-insensitive matching, shared by the client filter and the API. */
export function foldText(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}
