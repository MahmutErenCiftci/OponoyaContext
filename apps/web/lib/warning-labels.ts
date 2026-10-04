import type { CompileWarning } from "@devcontext/contracts";
import { defineCopy } from "./i18n";

/**
 * Headline per compiler warning code. The sentence after it is the
 * compiler's own text, which is also what coding agents read in the export,
 * so the screen and the exported file never disagree about the details.
 */
export const warningTitles = defineCopy<Record<CompileWarning["code"], string>>({
  tr: {
    RESOURCE_UNRESOLVED: "Kaynak bulunamadı",
    RESOURCE_ARCHIVED: "Arşivlenmiş kaynak",
    RESOURCE_CONFLICT: "Aynı kaynak hem seçili hem devre dışı",
    DISABLED_RESOURCE_ATTACHED: "Devre dışı kaynak projeye bağlı",
    RULE_CONFLICT: "Uyumluluk kuralı çakışması",
    MISSING_REQUIREMENT: "Eksik gereksinim",
  },
  en: {
    RESOURCE_UNRESOLVED: "Resource not found",
    RESOURCE_ARCHIVED: "Archived resource",
    RESOURCE_CONFLICT: "The same resource is both selected and disabled",
    DISABLED_RESOURCE_ATTACHED: "A disabled resource is attached to the project",
    RULE_CONFLICT: "Compatibility rule conflict",
    MISSING_REQUIREMENT: "Missing requirement",
  },
});
