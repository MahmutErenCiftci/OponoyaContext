import { apiErrorSchema, portableLimits } from "@devcontext/contracts";

export type ApiErrorDetail = { path: string[]; code: string };

const fallbackMessage = "İstek tamamlanamadı. Lütfen tekrar dene.";

/**
 * The API speaks English and machine-readable codes; the product speaks
 * Turkish. Known detail codes and envelope codes get Turkish text here, in
 * one place; screens may still override a code with more specific copy.
 * Unknown codes keep the API's (already content-free) message.
 */
const detailText: Record<string, string> = {
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
};

const envelopeText: Record<string, string> = {
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
};

const featureNames: Record<string, string> = {
  bundle: "Sıkıştırılmış bağlam paketi",
  diff: "Sürüm karşılaştırması",
  generic: "Genel talimat dışa aktarımı",
  agents: "AGENTS.md dışa aktarımı",
  claude: "CLAUDE.md dışa aktarımı",
  cursor: "Cursor dışa aktarımı",
  copilot: "Copilot dışa aktarımı",
};

const limitNames: Record<string, string> = { projects: "aktif proje", resources: "aktif Kütüphane kaynağı", profiles: "profil", recipes: "tarif" };

/** Plan refusals name what was refused, by the key the API puts in the detail path. */
function planText(detail: ApiErrorDetail | undefined): string | null {
  if (!detail) return null;
  if (detail.code === "plan_feature") {
    const name = featureNames[detail.path.at(-1) ?? ""];
    return name ? `${name} Pro planına dahil. Plan ayrıntıları Plan sayfasında.` : null;
  }
  if (detail.code === "plan_limit") {
    const name = limitNames[detail.path[0] ?? ""];
    return name ? `Planındaki ${name} sınırına ulaştın. Birini arşivleyerek yer açabilirsin; plan ayrıntıları Plan sayfasında.` : null;
  }
  return null;
}

function looseMessage(value: unknown) {
  if (typeof value !== "object" || value === null || !("error" in value)) return null;
  const error = value.error;
  if (typeof error !== "object" || error === null || !("message" in error)) return null;
  return typeof error.message === "string" ? error.message : null;
}

/** Reads the shared API error envelope; proxy failures without a code still yield their message. */
export async function readApiError(response: Response): Promise<{ message: string; details: ApiErrorDetail[] }> {
  try {
    const body: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) {
      const details = parsed.data.error.details ?? [];
      const detailCode = details[0]?.code;
      const message = planText(details[0]) || (detailCode && detailText[detailCode]) || envelopeText[parsed.data.error.code] || parsed.data.error.message;
      return { message, details };
    }
    const message = looseMessage(body);
    if (message) return { message, details: [] };
  } catch {
    // Non-JSON body; fall through to the generic message.
  }
  if (response.status === 429) return { message: envelopeText.RATE_LIMITED!, details: [] };
  if (response.status >= 500) return { message: envelopeText.SERVICE_UNAVAILABLE!, details: [] };
  return { message: fallbackMessage, details: [] };
}

export async function responseError(response: Response) {
  return (await readApiError(response)).message;
}
