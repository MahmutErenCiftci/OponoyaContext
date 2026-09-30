import type { CompileWarning } from "@devcontext/contracts";

/**
 * Turkish headline per compiler warning code. The sentence after it is the
 * compiler's own text, which is also what coding agents read in the export,
 * so the screen and the exported file never disagree about the details.
 */
export const warningTitles: Record<CompileWarning["code"], string> = {
  RESOURCE_UNRESOLVED: "Kaynak bulunamadı",
  RESOURCE_ARCHIVED: "Arşivlenmiş kaynak",
  RESOURCE_CONFLICT: "Aynı kaynak hem seçili hem devre dışı",
  DISABLED_RESOURCE_ATTACHED: "Devre dışı kaynak projeye bağlı",
  RULE_CONFLICT: "Uyumluluk kuralı çakışması",
  MISSING_REQUIREMENT: "Eksik gereksinim",
};
