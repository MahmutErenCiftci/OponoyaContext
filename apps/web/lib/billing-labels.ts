import type { Entitlement, ExportTarget, PlanLimitKey, SubscriptionStatus } from "@devcontext/contracts";
import { defineCopy, type Locale } from "./i18n";
import { formatDate } from "./resource-labels";

export const limitLabels = defineCopy<Record<PlanLimitKey, string>>({
  tr: { projects: "Aktif projeler", resources: "Kütüphane kaynakları", profiles: "Profiller", recipes: "Tarifler" },
  en: { projects: "Active projects", resources: "Library resources", profiles: "Profiles", recipes: "Recipes" },
});

export const exportTargetLabels = defineCopy<Record<ExportTarget, string>>({
  tr: {
    generic: "Genel talimat",
    agents: "AGENTS.md",
    claude: "CLAUDE.md",
    cursor: "Cursor kuralları (.mdc)",
    copilot: "Copilot talimatları",
  },
  en: {
    generic: "General instructions",
    agents: "AGENTS.md",
    claude: "CLAUDE.md",
    cursor: "Cursor rules (.mdc)",
    copilot: "Copilot instructions",
  },
});

export const subscriptionStatusLabels = defineCopy<Record<SubscriptionStatus, string>>({
  tr: {
    none: "Abonelik yok",
    trialing: "Deneme süresinde",
    active: "Etkin",
    past_due: "Ödeme gecikti",
    canceled: "İptal edildi",
    incomplete: "Ödeme tamamlanmadı",
    incomplete_expired: "Ödeme süresi doldu",
    unpaid: "Ödenmedi",
    expired: "Süresi doldu",
  },
  en: {
    none: "No subscription",
    trialing: "In trial",
    active: "Active",
    past_due: "Payment overdue",
    canceled: "Canceled",
    incomplete: "Payment not completed",
    incomplete_expired: "Payment window expired",
    unpaid: "Unpaid",
    expired: "Expired",
  },
});

/** One honest sentence about the current entitlement; never urgency, never "unlimited". */
export function entitlementSentence(entitlement: Entitlement, locale: Locale): string {
  const until = entitlement.effectiveUntil ? formatDate(entitlement.effectiveUntil, locale) : null;
  if (locale === "en") {
    switch (entitlement.reason) {
      case "active":
        return until ? `Pro renews on ${until}.` : "Your Pro plan is active.";
      case "trialing":
        return until ? `The Pro trial runs until ${until}.` : "The Pro trial is active.";
      case "renewal_pending":
        return `The billing period ended; Pro stays on until ${until} while the renewal is confirmed.`;
      case "past_due_grace":
        return `The last payment failed. Pro stays on until ${until}; update your payment method to keep it.`;
      case "cancel_at_period_end":
        return until ? `Pro is canceled and stays active until ${until}. You can restart it before then.` : "Pro is canceled.";
      case "period_ended":
        return "The Pro period ended. You are on Free; nothing was deleted.";
      case "payment_failed":
        return "Pro ended because the payment could not be collected. You are on Free; nothing was deleted.";
      case "incomplete":
        return "The payment was not completed. You are on Free.";
      case "canceled":
        return "Pro is canceled. You are on Free; nothing was deleted.";
      case "no_subscription":
      default:
        return "You are on Free.";
    }
  }
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
