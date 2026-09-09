import type { Entitlement, ExportTarget, PlanLimitKey } from "@devcontext/contracts";
import { formatDate } from "./resource-labels";

export const limitLabels: Record<PlanLimitKey, string> = {
  projects: "Aktif projeler",
  resources: "Kütüphane kaynakları",
  profiles: "Profiller",
  recipes: "Tarifler",
};

export const exportTargetLabels: Record<ExportTarget, string> = {
  generic: "Genel talimat",
  agents: "AGENTS.md",
  claude: "CLAUDE.md",
  cursor: "Cursor rules (.mdc)",
  copilot: "Copilot instructions",
};

/** One honest sentence about the current entitlement; never urgency, never "unlimited". */
export function entitlementSentence(entitlement: Entitlement): string {
  const until = entitlement.effectiveUntil ? formatDate(entitlement.effectiveUntil) : null;
  switch (entitlement.reason) {
    case "active":
      return until ? `Pro ${until} tarihinde yenilenir.` : "Pro planın etkin.";
    case "trialing":
      return until ? `Pro denemesi ${until} tarihine kadar sürer.` : "Pro denemesi etkin.";
    case "renewal_pending":
      return `Ödeme dönemi bitti; yenileme onaylanana kadar Pro ${until} tarihine kadar açık kalır.`;
    case "past_due_grace":
      return `Son ödeme alınamadı. Pro ${until} tarihine kadar açık kalır; sürdürmek için ödeme yöntemini güncelle.`;
    case "cancel_at_period_end":
      return until ? `Pro iptal edildi ve ${until} tarihine kadar etkin kalır. Bu tarihten önce yeniden başlatabilirsin.` : "Pro iptal edildi.";
    case "period_ended":
      return "Pro dönemi bitti. Free plandasın; hiçbir şey silinmedi.";
    case "payment_failed":
      return "Ödeme tahsil edilemediği için Pro sona erdi. Free plandasın; hiçbir şey silinmedi.";
    case "incomplete":
      return "Ödeme tamamlanmadı. Free plandasın.";
    case "canceled":
      return "Pro iptal edildi. Free plandasın; hiçbir şey silinmedi.";
    case "no_subscription":
    default:
      return "Free plandasın.";
  }
}
