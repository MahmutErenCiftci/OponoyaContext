import type { ProfileType, ProjectStage, ResourceType } from "@devcontext/contracts";

export const profileTypeLabels: Record<ProfileType, string> = {
  stack: "Teknoloji seti",
  design: "Tasarım profili",
  ai: "AI profili",
  deployment: "Dağıtım profili",
};

export const profileTypeDescriptions: Record<ProfileType, string> = {
  stack: "Her projede kullandığın diller, framework’ler, veri ve kimlik tercihleri.",
  design: "Tasarım sistemi, tema, bileşen, hareket ve ikon tercihleri.",
  ai: "Kullandığın coding agent, talimat ve MCP sunucuları.",
  deployment: "Barındırma, CI/CD ve izleme tercihleri.",
};

export const typeLabels: Record<ResourceType, string> = {
  language: "Dil", framework: "Framework", runtime: "Runtime", database: "Veritabanı",
  orm: "ORM / query", auth: "Kimlik doğrulama", storage: "Depolama", cache: "Önbellek", queue: "Kuyruk",
  ui_library: "UI kütüphanesi", component: "Bileşen", theme: "Tema", design_system: "Tasarım sistemi",
  animation: "Animasyon", icon_library: "İkon kütüphanesi", repository: "Kod deposu", boilerplate: "Boilerplate",
  template: "Şablon", prompt: "Prompt", ai_coding_tool: "AI kodlama aracı", ai_builder: "AI oluşturucu",
  mcp: "MCP sunucusu", cli: "CLI", deployment: "Dağıtım", monitoring: "İzleme", service: "Service / API",
  architecture: "Mimari", rule: "Kodlama kuralı", reference: "Referans",
};

export const stageLabels: Record<ProjectStage, string> = {
  experiment: "Deneme",
  mvp: "MVP",
  production: "Üretim",
  maintenance: "Bakım",
};

export const stageDescriptions: Record<ProjectStage, string> = {
  experiment: "Fikrini dene, hızla öğren.",
  mvp: "Gerçek kullanıcılar için ilk sürüm.",
  production: "Canlı ürün; güvenilirlik öncelikli.",
  maintenance: "Kararlı ürün; kontrollü değişiklikler.",
};

export const suggestedPlatforms = ["web", "mobile", "desktop", "api", "cli", "browser extension"];

export const suggestedProductTypes = ["SaaS", "Internal tool", "Marketplace", "API / service", "Mobile app", "CLI tool", "Kütüphane", "Landing page"];

export const suggestedPriorities = ["Fast MVP", "Maintainability", "Low cost", "Scalability", "Type safety", "Accessibility", "Performance", "Security"];

/** UTC keeps server-rendered and client-rendered dates identical, so hydration never disagrees. */
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso));
}

/** "8 Eylül 2026, 14:32" style timestamp (UTC, see formatDate). */
export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso)).replace(" ", " ");
}

/** "14:32" (UTC). */
export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso));
}

export function pluralCount(count: number, singular: string, plural = singular) {
  return `${count} ${count === 1 ? singular : plural}`;
}
