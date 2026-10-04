import type { FeedbackKind, FeedbackStatus } from "@devcontext/contracts";

export const feedbackKindLabels: Record<FeedbackKind, string> = {
  suggestion: "Öneri",
  complaint: "Şikayet",
  bug: "Hata / bug",
  other: "Diğer",
};

export const feedbackKindDescriptions: Record<FeedbackKind, string> = {
  suggestion: "Bir özellik ya da iyileştirme fikri",
  complaint: "Memnun kalmadığın bir şey",
  bug: "Beklendiği gibi çalışmayan bir şey",
  other: "Bunların dışında kalan her şey",
};

export const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  resolved: "Çözüldü",
  dismissed: "Kapatıldı",
};
