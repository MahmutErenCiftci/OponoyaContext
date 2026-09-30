/**
 * Product news shown on the overview: the newest entry feeds the top banner,
 * the list feeds "Yenilikler". Entries describe shipped changes only; add a new
 * one at the top when a release lands. `version` is set only for real tags.
 */
import { proPricing } from "./roadmap";

export type AnnouncementKind ="new" | "improved" | "notice" | "release";

export type Announcement = {
  id: string;
  date: string;
  kind: AnnouncementKind;
  version: string | null;
  title: string;
  summary: string;
  href: string | null;
};

export const announcementKindLabels: Record<AnnouncementKind, string> = {
  new: "Yeni",
  improved: "İyileştirme",
  notice: "Duyuru",
  release: "Sürüm",
};

export const announcements: Announcement[] = [
  {
    id: "2026-09-30-roadmap",
    date: "2026-09-30",
    kind: "notice",
    version: null,
    title: "Gelişim planı ve Pro",
    summary: `Oponoya geliştirme aşamasında ve şu an tamamen ücretsiz. Pro, V2 ile gelişim indirimiyle ${proPricing.launch} / ${proPricing.period} olarak geliyor; Free hesap her zaman kalacak.`,
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
];

/** Cookie that remembers the dismissed banner, so the server does not render it again (no flash). */
export const bannerCookieName = "devcontext-banner";

export function bannerCookie(id: string): string {
  return `${bannerCookieName}=${encodeURIComponent(id)}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`;
}
