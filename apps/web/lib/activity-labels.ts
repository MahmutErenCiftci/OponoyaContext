import type { AuditEvent } from "@devcontext/contracts";
import { defineCopy, type Locale } from "./i18n";

const labels = defineCopy<Record<string, string>>({
  tr: {
    "account.created": "Çalışma alanı oluşturuldu",
    "account.signed_in": "Oturum açıldı",
    "account.password_changed": "Şifre değiştirildi",
    "account.export_downloaded": "Hesap verileri indirildi",
    "account.deletion_blocked": "Hesap silme tamamlanamadı",
    "account.ai_consent_granted": "AI önerilerine izin verildi",
    "account.ai_consent_revoked": "AI önerileri kapatıldı",
    "ai.suggestion_created": "AI önerisi istendi",
    "ai.suggestion_accepted": "AI önerisi kabul edildi",
    "ai.suggestion_rejected": "AI önerisi reddedildi",
    "ai.suggestion_failed": "AI önerisi alınamadı",
    "resource.created": "Kaynak kaydedildi",
    "resource.preference_changed": "Kütüphane kuralı değişti",
    "resource.archived": "Kaynak arşivlendi",
    "resource.restored": "Kaynak geri yüklendi",
    "project.created": "Proje oluşturuldu",
    "project.updated": "Proje bilgileri düzenlendi",
    "project.cloned": "Proje kopyalandı",
    "project.archived": "Proje arşivlendi",
    "project.restored": "Proje geri yüklendi",
    "project.profiles_replaced": "Proje profilleri değişti",
    "project.decision_changed": "Proje kararı güncellendi",
    "project.decision_removed": "Proje kararı kaldırıldı",
    "project.decisions_batched": "Proje kararları kaydedildi",
    "project.compiled": "Talimatlar oluşturuldu",
    "project.exported": "Talimatlar dışa aktarıldı",
    "profile.created": "Profil oluşturuldu",
    "profile.updated": "Profil düzenlendi",
    "profile.archived": "Profil arşivlendi",
    "profile.restored": "Profil geri yüklendi",
    "profile.decision_changed": "Profil kararı güncellendi",
    "profile.decision_removed": "Profil kararı kaldırıldı",
    "compatibility_rule.created": "Uyumluluk kuralı eklendi",
    "compatibility_rule.removed": "Uyumluluk kuralı kaldırıldı",
    "recipe.created": "Tarif oluşturuldu",
    "recipe.updated": "Tarif düzenlendi",
    "recipe.archived": "Tarif arşivlendi",
    "recipe.restored": "Tarif geri yüklendi",
    "recipe.profiles_replaced": "Tarif profilleri değişti",
    "recipe.decision_changed": "Tarif kararı güncellendi",
    "recipe.decision_removed": "Tarif kararı kaldırıldı",
    "workspace.onboarding_updated": "Başlangıç rehberi güncellendi",
    "workspace.samples_installed": "Örnek veriler yüklendi",
    "workspace.samples_removed": "Örnek veriler kaldırıldı",
    "workspace.export_downloaded": "Veriler dışa aktarıldı",
    "workspace.import_completed": "Veriler içe aktarıldı",
    "catalog.technology_added": "Katalogdan teknoloji eklendi",
    "catalog.stack_added": "Katalogdan stack eklendi",
    "catalog.stack_profile_created": "Katalogdan stack profili oluşturuldu",
    "billing.checkout_started": "Yükseltme ödemesi başlatıldı",
    "billing.portal_opened": "Abonelik portalı açıldı",
    "billing.reconciled": "Plan ödeme sağlayıcısıyla doğrulandı",
    "billing.webhook_processed": "Plan ödeme sağlayıcısı tarafından güncellendi",
    "feedback.created": "Geri bildirim gönderildi",
    "feedback.status_changed": "Geri bildirim durumu güncellendi",
  },
  en: {
    "account.created": "Workspace created",
    "account.signed_in": "Signed in",
    "account.password_changed": "Password changed",
    "account.export_downloaded": "Account data downloaded",
    "account.deletion_blocked": "Account deletion could not finish",
    "account.ai_consent_granted": "AI suggestions allowed",
    "account.ai_consent_revoked": "AI suggestions turned off",
    "ai.suggestion_created": "AI suggestion requested",
    "ai.suggestion_accepted": "AI suggestion accepted",
    "ai.suggestion_rejected": "AI suggestion rejected",
    "ai.suggestion_failed": "AI suggestion failed",
    "resource.created": "Resource saved",
    "resource.preference_changed": "Library rule changed",
    "resource.archived": "Resource archived",
    "resource.restored": "Resource restored",
    "project.created": "Project created",
    "project.updated": "Project details edited",
    "project.cloned": "Project copied",
    "project.archived": "Project archived",
    "project.restored": "Project restored",
    "project.profiles_replaced": "Project profiles changed",
    "project.decision_changed": "Project decision updated",
    "project.decision_removed": "Project decision removed",
    "project.decisions_batched": "Project decisions saved",
    "project.compiled": "Instructions created",
    "project.exported": "Instructions exported",
    "profile.created": "Profile created",
    "profile.updated": "Profile edited",
    "profile.archived": "Profile archived",
    "profile.restored": "Profile restored",
    "profile.decision_changed": "Profile decision updated",
    "profile.decision_removed": "Profile decision removed",
    "compatibility_rule.created": "Compatibility rule added",
    "compatibility_rule.removed": "Compatibility rule removed",
    "recipe.created": "Recipe created",
    "recipe.updated": "Recipe edited",
    "recipe.archived": "Recipe archived",
    "recipe.restored": "Recipe restored",
    "recipe.profiles_replaced": "Recipe profiles changed",
    "recipe.decision_changed": "Recipe decision updated",
    "recipe.decision_removed": "Recipe decision removed",
    "workspace.onboarding_updated": "Getting-started guide updated",
    "workspace.samples_installed": "Sample data installed",
    "workspace.samples_removed": "Sample data removed",
    "workspace.export_downloaded": "Data exported",
    "workspace.import_completed": "Data imported",
    "catalog.technology_added": "Technology added from the catalog",
    "catalog.stack_added": "Stack added from the catalog",
    "catalog.stack_profile_created": "Stack profile created from the catalog",
    "billing.checkout_started": "Upgrade checkout started",
    "billing.portal_opened": "Subscription portal opened",
    "billing.reconciled": "Plan confirmed with the payment provider",
    "billing.webhook_processed": "Plan updated by the payment provider",
    "feedback.created": "Feedback sent",
    "feedback.status_changed": "Feedback status updated",
  },
});

const detailWords = defineCopy({
  tr: { decisions: (n: number) => `${n} karar`, upserts: (n: number) => `${n} kayıt`, removed: (n: number) => `${n} kaldırıldı` },
  en: { decisions: (n: number) => `${n} decision${n === 1 ? "" : "s"}`, upserts: (n: number) => `${n} record${n === 1 ? "" : "s"}`, removed: (n: number) => `${n} removed` },
});

export function activityLabel(event: AuditEvent, locale: Locale) {
  return labels[locale][event.action] ?? event.action.replace(/[._]/g, " ");
}

/** Short, content-free detail line built from the metadata keys the API records. */
export function activityDetail(event: AuditEvent, locale: Locale) {
  const parts: string[] = [];
  const { metadata } = event;
  const words = detailWords[locale];
  if (typeof metadata.slot === "string") parts.push(metadata.slot);
  if (typeof metadata.mode === "string") parts.push(metadata.mode);
  if (typeof metadata.version === "number") parts.push(`v${metadata.version}`);
  if (typeof metadata.target === "string") parts.push(metadata.target);
  if (typeof metadata.type === "string") parts.push(metadata.type);
  if (typeof metadata.kind === "string") parts.push(metadata.kind);
  if (typeof metadata.strategy === "string") parts.push(metadata.strategy);
  if (typeof metadata.state === "string") parts.push(metadata.state.replace("_", " "));
  if (typeof metadata.catalogSlug === "string") parts.push(metadata.catalogSlug);
  if (typeof metadata.decisions === "number") parts.push(words.decisions(metadata.decisions));
  if (typeof metadata.upserts === "number") parts.push(words.upserts(metadata.upserts));
  if (typeof metadata.removed === "number" && metadata.removed > 0) parts.push(words.removed(metadata.removed));
  return parts.join(" · ");
}

export function activityHref(event: AuditEvent): string | null {
  if (event.action.startsWith("billing.")) return "/workspace/billing";
  if (event.action === "feedback.status_changed") return "/admin";
  if (event.entityType === "feedback") return "/workspace/feedback";
  if (event.entityType === "workspace" || event.entityType === "account") return "/workspace/settings";
  // AI suggestions live on the Project's stack page; the suggestion id itself has no page.
  if (event.entityType === "ai_suggestion") return typeof event.metadata.projectId === "string" ? `/workspace/projects/${event.metadata.projectId}/stack` : null;
  if (!event.entityId) return null;
  switch (event.entityType) {
    case "project":
      return `/workspace/projects/${event.entityId}`;
    case "profile":
      return `/workspace/profiles/${event.entityId}`;
    case "recipe":
      return `/workspace/recipes/${event.entityId}`;
    case "resource":
    case "compatibility_rule":
      return "/workspace/library";
    default:
      return null;
  }
}
