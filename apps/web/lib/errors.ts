import { apiErrorSchema, portableLimits } from "@devcontext/contracts";
import { defineCopy, documentLocale, type Locale } from "./i18n";

export type ApiErrorDetail = { path: string[]; code: string };

/**
 * The API speaks English and machine-readable codes; the screens speak the
 * visitor's language. Known detail codes and envelope codes get their text
 * here, in one place; screens may still override a code with more specific
 * copy. Unknown codes keep the API's (already content-free) message.
 */
const copy = defineCopy({
  tr: {
    fallback: "İstek tamamlanamadı. Lütfen tekrar dene.",
    detail: {
      plan_limit: "Planının sınırına ulaştın. Bir kaydı arşivleyerek yer açabilirsin; plan ayrıntıları Plan sayfasında.",
      plan_feature: "Bu özellik Pro planına dahil. Plan ayrıntıları Plan sayfasında.",
      resource_unavailable: "Bu kaynak arşivde ya da artık kullanılamıyor. Aktif bir kaynak seç.",
      resource_required: "Bu karar biçimi Kütüphanenden bir kaynak gerektirir.",
      resource_not_allowed: "AI’a bırakılan kararda kaynak seçilmez.",
      context_not_compiled: "Önce AI talimatlarını oluştur.",
      decision_limit: `Bir proje, profil ya da tarif en fazla ${portableLimits.decisionsPerEntity} karar tutabilir. Yenisini eklemeden önce birini kaldır.`,
      rule_limit: `Çalışma alanın en fazla ${portableLimits.compatibilityRules} uyumluluk kuralı tutabilir. Yenisini eklemeden önce birini kaldır.`,
      import_in_progress: "Başka bir içe aktarma sürüyor. Bitmesini bekleyip tekrar dene.",
      import_busy: "Sunucu şu an başka içe aktarmaları işliyor. Birkaç dakika sonra tekrar dene.",
      invalid_value: "Gönderilen bir değer saklanamıyor (ör. görünmez bir kontrol karakteri). Metni düzenleyip tekrar dene.",
      too_big: "Dosya bir dışa aktarmanın içerebileceğinden fazla kayıt içeriyor.",
      json_depth: "Dosya çok derin iç içe geçmiş ya da döngüsel referans içeriyor.",
      unsupported_format: "Bu dosya bir dışa aktarma dosyası değil.",
      unsupported_version: "Bu dışa aktarma dosyası desteklenmeyen bir sürümle oluşturulmuş.",
      unknown_ref: "Dosyada var olmayan bir kayda yapılmış bir referans var. Dosyayı kontrol edip tekrar dene.",
      duplicate_ref: "Dosyada aynı referans birden fazla kez kullanılmış.",
      duplicate_slot: "Aynı karar alanı birden fazla kez tanımlanmış.",
      self_reference: "Bir uyumluluk kuralı bir kaynağı kendisiyle eşleştiremez.",
      export_not_portable: "Çalışma alanın dışa aktarma biçiminin sınırlarını aşıyor; eksik bir dosya oluşturulmadı. Tam veri dışa aktarımı için Ayarlar › Gizlilik ve veriler’den hesap verilerini indir.",
      samples_in_use: "Kendi projelerin, profillerin, tariflerin ya da kuralların örnek verileri kullanıyor; hiçbir şey kaldırılmadı. Önce bu bağlantıları kaldır.",
      profile_unavailable: "Bu profil arşivde ya da artık kullanılamıyor. Aktif bir profil seç.",
      recipe_unavailable: "Bu tarif arşivde ya da artık kullanılamıyor. Aktif bir tarif seç.",
      project_archived: "Proje arşivde. Değişiklik yapmak için önce geri yükle.",
      idempotency_key_in_use: "Bu işlem zaten gönderildi. Sayfayı yenileyip sonucu kontrol et.",
      billing_unavailable: "Bu ortamda ödeme henüz açık değil. Free planını kullanmaya devam edebilirsin.",
      subscription_missing: "Yönetilecek bir abonelik bulunamadı.",
    } as Record<string, string>,
    envelope: {
      VALIDATION_ERROR: "Gönderilen bilgiler geçersiz. Alanları kontrol edip tekrar dene.",
      UNAUTHORIZED: "Oturumun sona erdi. Yeniden giriş yap.",
      FORBIDDEN: "Bu işlem için yetkin yok.",
      NOT_FOUND: "Kayıt bulunamadı. Silinmiş ya da arşivlenmiş olabilir.",
      CONFLICT: "Bu işlem mevcut kayıtlarla çakışıyor. Sayfayı yenileyip tekrar dene.",
      BAD_REQUEST: "İstek işlenemedi. Sayfayı yenileyip tekrar dene.",
      PAYLOAD_TOO_LARGE: "Gönderilen içerik çok büyük.",
      UNSUPPORTED_MEDIA_TYPE: "İstek biçimi desteklenmiyor.",
      RATE_LIMITED: "Çok fazla istek gönderildi. Biraz bekleyip tekrar dene.",
      INTERNAL_ERROR: "Beklenmeyen bir hata oluştu. Verilerin etkilenmedi; tekrar dene.",
      SERVICE_UNAVAILABLE: "Hizmete şu an ulaşılamıyor. Birazdan tekrar dene.",
    } as Record<string, string>,
    features: {
      bundle: "Sıkıştırılmış bağlam paketi",
      diff: "Sürüm karşılaştırması",
      generic: "Genel talimat dışa aktarımı",
      agents: "AGENTS.md dışa aktarımı",
      claude: "CLAUDE.md dışa aktarımı",
      cursor: "Cursor dışa aktarımı",
      copilot: "Copilot dışa aktarımı",
    } as Record<string, string>,
    limits: { projects: "aktif proje", resources: "aktif Kütüphane kaynağı", profiles: "profil", recipes: "tarif" } as Record<string, string>,
    planFeature: (name: string) => `${name} Pro planına dahil. Plan ayrıntıları Plan sayfasında.`,
    planLimit: (name: string) => `Planındaki ${name} sınırına ulaştın. Birini arşivleyerek yer açabilirsin; plan ayrıntıları Plan sayfasında.`,
  },
  en: {
    fallback: "The request could not be completed. Please try again.",
    detail: {
      plan_limit: "You reached your plan's limit. Archive an item to make room; plan details are on the Plan page.",
      plan_feature: "This feature is part of the Pro plan. Plan details are on the Plan page.",
      resource_unavailable: "This resource is archived or no longer available. Choose an active one.",
      resource_required: "This decision mode needs a resource from your Library.",
      resource_not_allowed: "A decision left to the AI does not take a resource.",
      context_not_compiled: "Create the AI instructions first.",
      decision_limit: `A project, profile or recipe holds at most ${portableLimits.decisionsPerEntity} decisions. Remove one before adding another.`,
      rule_limit: `Your workspace holds at most ${portableLimits.compatibilityRules} compatibility rules. Remove one before adding another.`,
      import_in_progress: "Another import is running. Wait for it to finish and try again.",
      import_busy: "The server is busy with other imports. Try again in a few minutes.",
      invalid_value: "A value cannot be stored (for example an invisible control character). Edit the text and try again.",
      too_big: "The file holds more records than an export can contain.",
      json_depth: "The file is nested too deeply or contains a circular reference.",
      unsupported_format: "This file is not an export file.",
      unsupported_version: "This export file was created with an unsupported version.",
      unknown_ref: "The file refers to a record that does not exist. Check the file and try again.",
      duplicate_ref: "The file uses the same reference more than once.",
      duplicate_slot: "The same decision slot is defined more than once.",
      self_reference: "A compatibility rule cannot pair a resource with itself.",
      export_not_portable: "Your workspace exceeds the export format's limits; no partial file was created. For a full data export, download your account data from Settings › Privacy and data.",
      samples_in_use: "Your own projects, profiles, recipes or rules use the sample data; nothing was removed. Remove those links first.",
      profile_unavailable: "This profile is archived or no longer available. Choose an active one.",
      recipe_unavailable: "This recipe is archived or no longer available. Choose an active one.",
      project_archived: "The project is archived. Restore it before making changes.",
      idempotency_key_in_use: "This action was already sent. Refresh the page and check the result.",
      billing_unavailable: "Payments are not enabled in this environment yet. You can keep using the Free plan.",
      subscription_missing: "No subscription to manage was found.",
    },
    envelope: {
      VALIDATION_ERROR: "Some of the information is not valid. Check the fields and try again.",
      UNAUTHORIZED: "Your session has ended. Sign in again.",
      FORBIDDEN: "You are not allowed to do this.",
      NOT_FOUND: "The record was not found. It may have been deleted or archived.",
      CONFLICT: "This conflicts with existing records. Refresh the page and try again.",
      BAD_REQUEST: "The request could not be processed. Refresh the page and try again.",
      PAYLOAD_TOO_LARGE: "The content you sent is too large.",
      UNSUPPORTED_MEDIA_TYPE: "The request format is not supported.",
      RATE_LIMITED: "Too many requests. Wait a moment and try again.",
      INTERNAL_ERROR: "Something unexpected went wrong. Your data was not affected; try again.",
      SERVICE_UNAVAILABLE: "The service cannot be reached right now. Try again shortly.",
    },
    features: {
      bundle: "The zipped context bundle",
      diff: "Version comparison",
      generic: "General instructions export",
      agents: "AGENTS.md export",
      claude: "CLAUDE.md export",
      cursor: "Cursor export",
      copilot: "Copilot export",
    },
    limits: { projects: "active project", resources: "active Library resource", profiles: "profile", recipes: "recipe" },
    planFeature: (name: string) => `${name} is part of the Pro plan. Plan details are on the Plan page.`,
    planLimit: (name: string) => `You reached your plan's ${name} limit. Archive one to make room; plan details are on the Plan page.`,
  },
});

/** Plan refusals name what was refused, by the key the API puts in the detail path. */
function planText(detail: ApiErrorDetail | undefined, locale: Locale): string | null {
  if (!detail) return null;
  const t = copy[locale];
  if (detail.code === "plan_feature") {
    const name = t.features[detail.path.at(-1) ?? ""];
    return name ? t.planFeature(name) : null;
  }
  if (detail.code === "plan_limit") {
    const name = t.limits[detail.path[0] ?? ""];
    return name ? t.planLimit(name) : null;
  }
  return null;
}

function looseMessage(value: unknown) {
  if (typeof value !== "object" || value === null || !("error" in value)) return null;
  const error = value.error;
  if (typeof error !== "object" || error === null || !("message" in error)) return null;
  return typeof error.message === "string" ? error.message : null;
}

/**
 * Reads the shared API error envelope; proxy failures without a code still
 * yield their message. The language defaults to the rendered page's
 * (`<html lang>`), so client handlers need not pass it.
 */
export async function readApiError(response: Response, locale: Locale = documentLocale()): Promise<{ message: string; details: ApiErrorDetail[] }> {
  const t = copy[locale];
  try {
    const body: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) {
      const details = parsed.data.error.details ?? [];
      const detailCode = details[0]?.code;
      const message = planText(details[0], locale) || (detailCode && t.detail[detailCode]) || t.envelope[parsed.data.error.code] || parsed.data.error.message;
      return { message, details };
    }
    const message = looseMessage(body);
    if (message) return { message, details: [] };
  } catch {
    // Non-JSON body; fall through to the generic message.
  }
  if (response.status === 429) return { message: t.envelope.RATE_LIMITED!, details: [] };
  if (response.status >= 500) return { message: t.envelope.SERVICE_UNAVAILABLE!, details: [] };
  return { message: t.fallback, details: [] };
}

export async function responseError(response: Response, locale: Locale = documentLocale()) {
  return (await readApiError(response, locale)).message;
}
