import type { AuditEvent } from "@devcontext/contracts";

const labels: Record<string, string> = {
  "account.created": "Çalışma alanı oluşturuldu",
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
};

export function activityLabel(event: AuditEvent) {
  return labels[event.action] ?? event.action.replace(/[._]/g, " ");
}

/** Short, content-free detail line built from the metadata keys the API records. */
export function activityDetail(event: AuditEvent) {
  const parts: string[] = [];
  const { metadata } = event;
  if (typeof metadata.slot === "string") parts.push(metadata.slot);
  if (typeof metadata.mode === "string") parts.push(metadata.mode);
  if (typeof metadata.version === "number") parts.push(`v${metadata.version}`);
  if (typeof metadata.target === "string") parts.push(metadata.target);
  if (typeof metadata.type === "string") parts.push(metadata.type);
  if (typeof metadata.kind === "string") parts.push(metadata.kind);
  if (typeof metadata.strategy === "string") parts.push(metadata.strategy);
  if (typeof metadata.state === "string") parts.push(metadata.state.replace("_", " "));
  if (typeof metadata.catalogSlug === "string") parts.push(metadata.catalogSlug);
  if (typeof metadata.decisions === "number") parts.push(`${metadata.decisions} karar`);
  if (typeof metadata.upserts === "number") parts.push(`${metadata.upserts} kayıt`);
  if (typeof metadata.removed === "number" && metadata.removed > 0) parts.push(`${metadata.removed} kaldırıldı`);
  return parts.join(" · ");
}

export function activityHref(event: AuditEvent): string | null {
  if (event.action.startsWith("billing.")) return "/workspace/billing";
  if (event.entityType === "workspace") return "/workspace/settings";
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
