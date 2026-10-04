/**
 * Product news shown on the overview: the newest entry feeds the top banner,
 * the list feeds "Yenilikler" / "What's new". Entries describe shipped changes
 * only; add a new one at the top when a release lands, in both languages with
 * the same id. `version` is set only for real tags.
 */
import { defineCopy } from "./i18n";
import { proPricing } from "./roadmap";

export type AnnouncementKind = "new" | "improved" | "notice" | "release";

export type Announcement = {
  id: string;
  date: string;
  kind: AnnouncementKind;
  version: string | null;
  title: string;
  summary: string;
  href: string | null;
};

export const announcementKindLabels = defineCopy<Record<AnnouncementKind, string>>({
  tr: { new: "Yeni", improved: "İyileştirme", notice: "Duyuru", release: "Sürüm" },
  en: { new: "New", improved: "Improved", notice: "Notice", release: "Release" },
});

export const announcements = defineCopy<Announcement[]>({
  tr: [
    {
      id: "2026-10-04-english-feedback",
      date: "2026-10-04",
      kind: "new",
      version: null,
      title: "İngilizce arayüz ve geri bildirim",
      summary: "Oponoya artık İngilizce de kullanılabiliyor; dili üst bardan değiştirebilirsin. Öneri, şikayet ve hataları da üst bardaki Geri bildirim düğmesiyle doğrudan bize iletebilirsin.",
      href: "/workspace/feedback",
    },
    {
      id: "2026-09-30-roadmap",
      date: "2026-09-30",
      kind: "notice",
      version: null,
      title: "Gelişim planı ve Pro",
      summary: `Oponoya geliştirme aşamasında ve şu an tamamen ücretsiz. Pro, V2 ile gelişim indirimiyle ${proPricing.tr.launch} / ${proPricing.tr.period} olarak geliyor; Free hesap her zaman kalacak.`,
      href: "/workspace/billing#gelisim-plani",
    },
    {
      id: "2026-09-30-overview",
      date: "2026-09-30",
      kind: "new",
      version: null,
      title: "Yeni genel bakış ve sol menü",
      summary: "Projelerin, son kullandığın teknolojiler ve sana özel öneriler artık tek ekranda. Çalışma bölümleri solda, keşif üstte.",
      href: null,
    },
    {
      id: "2026-09-30-oponoya",
      date: "2026-09-30",
      kind: "notice",
      version: null,
      title: "DevContext OS artık Oponoya",
      summary: "Ürünün yeni adı Oponoya. Kayıtlı verilerin ve daha önce aldığın dışa aktarımlar aynen çalışmaya devam ediyor.",
      href: null,
    },
    {
      id: "2026-09-26-hardening",
      date: "2026-09-26",
      kind: "improved",
      version: null,
      title: "Şifre işlemleri ve güvenlik iyileştirmeleri",
      summary: "Ayarlar’dan şifreni değiştirebilirsin; şifre sıfırlama altyapısı, güvenlik ve performans iyileştirmeleri eklendi.",
      href: "/workspace/settings",
    },
    {
      id: "2026-09-10-v1-rc1",
      date: "2026-09-10",
      kind: "release",
      version: "v1.0.0-rc.1",
      title: "V1 sürüm adayı yayında",
      summary: "Kütüphane, projeler, profiller, tarifler, teknoloji kataloğu ve AI talimatlarını dışa aktarma ücretsiz betada.",
      href: null,
    },
  ],
  en: [
    {
      id: "2026-10-04-english-feedback",
      date: "2026-10-04",
      kind: "new",
      version: null,
      title: "English interface and feedback",
      summary: "Oponoya now speaks English too; switch the language from the top bar. Send us suggestions, complaints and bug reports with the Feedback button in the top bar.",
      href: "/workspace/feedback",
    },
    {
      id: "2026-09-30-roadmap",
      date: "2026-09-30",
      kind: "notice",
      version: null,
      title: "Development plan and Pro",
      summary: `Oponoya is in development and completely free for now. Pro arrives with V2 at a development discount of ${proPricing.en.launch} / ${proPricing.en.period}; the Free account will always stay.`,
      href: "/workspace/billing#gelisim-plani",
    },
    {
      id: "2026-09-30-overview",
      date: "2026-09-30",
      kind: "new",
      version: null,
      title: "New overview and left menu",
      summary: "Your projects, recently used technologies and personal suggestions are now on one screen. Work sections sit on the left, discovery at the top.",
      href: null,
    },
    {
      id: "2026-09-30-oponoya",
      date: "2026-09-30",
      kind: "notice",
      version: null,
      title: "DevContext OS is now Oponoya",
      summary: "The product's new name is Oponoya. Your saved data and earlier exports keep working as before.",
      href: null,
    },
    {
      id: "2026-09-26-hardening",
      date: "2026-09-26",
      kind: "improved",
      version: null,
      title: "Password changes and security improvements",
      summary: "You can change your password in Settings; password reset groundwork, security and performance improvements were added.",
      href: "/workspace/settings",
    },
    {
      id: "2026-09-10-v1-rc1",
      date: "2026-09-10",
      kind: "release",
      version: "v1.0.0-rc.1",
      title: "V1 release candidate is live",
      summary: "Library, projects, profiles, recipes, the technology catalog and AI instruction exports are in the free beta.",
      href: null,
    },
  ],
});

/** Cookie that remembers the dismissed banner, so the server does not render it again (no flash). */
export const bannerCookieName = "devcontext-banner";

export function bannerCookie(id: string): string {
  return `${bannerCookieName}=${encodeURIComponent(id)}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`;
}
