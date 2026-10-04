import type { FeedbackKind, FeedbackStatus } from "@devcontext/contracts";
import { defineCopy } from "./i18n";

export const feedbackKindLabels = defineCopy<Record<FeedbackKind, string>>({
  tr: { suggestion: "Öneri", complaint: "Şikayet", bug: "Hata / bug", other: "Diğer" },
  en: { suggestion: "Suggestion", complaint: "Complaint", bug: "Bug", other: "Other" },
});

export const feedbackKindDescriptions = defineCopy<Record<FeedbackKind, string>>({
  tr: {
    suggestion: "Bir özellik ya da iyileştirme fikri",
    complaint: "Memnun kalmadığın bir şey",
    bug: "Beklendiği gibi çalışmayan bir şey",
    other: "Bunların dışında kalan her şey",
  },
  en: {
    suggestion: "An idea for a feature or an improvement",
    complaint: "Something you are not happy with",
    bug: "Something that does not work as expected",
    other: "Anything else",
  },
});

export const feedbackStatusLabels = defineCopy<Record<FeedbackStatus, string>>({
  tr: { new: "Yeni", reviewing: "İnceleniyor", resolved: "Çözüldü", dismissed: "Kapatıldı" },
  en: { new: "New", reviewing: "In review", resolved: "Resolved", dismissed: "Closed" },
});
