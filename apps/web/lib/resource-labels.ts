import type { ProfileType, ProjectStage, ResourceType } from "@devcontext/contracts";
import { defineCopy, intlLocales, type Locale } from "./i18n";

export const profileTypeLabels = defineCopy<Record<ProfileType, string>>({
  tr: {
    stack: "Teknoloji seti",
    design: "Tasarım profili",
    ai: "AI profili",
    deployment: "Dağıtım profili",
  },
  en: {
    stack: "Tech stack",
    design: "Design profile",
    ai: "AI profile",
    deployment: "Deployment profile",
  },
});

export const profileTypeDescriptions = defineCopy<Record<ProfileType, string>>({
  tr: {
    stack: "Her projede kullandığın diller, framework’ler, veri ve kimlik tercihleri.",
    design: "Tasarım sistemi, tema, bileşen, hareket ve ikon tercihleri.",
    ai: "Kullandığın coding agent, talimat ve MCP sunucuları.",
    deployment: "Barındırma, CI/CD ve izleme tercihleri.",
  },
  en: {
    stack: "The languages, frameworks, data and auth choices you use in every project.",
    design: "Design system, theme, component, motion and icon choices.",
    ai: "The coding agents, instructions and MCP servers you use.",
    deployment: "Hosting, CI/CD and monitoring choices.",
  },
});

export const typeLabels = defineCopy<Record<ResourceType, string>>({
  tr: {
    language: "Dil", framework: "Framework", runtime: "Runtime", database: "Veritabanı",
    orm: "ORM / query", auth: "Kimlik doğrulama", storage: "Depolama", cache: "Önbellek", queue: "Kuyruk",
    ui_library: "UI kütüphanesi", component: "Bileşen", theme: "Tema", design_system: "Tasarım sistemi",
    animation: "Animasyon", icon_library: "İkon kütüphanesi", repository: "Kod deposu", boilerplate: "Boilerplate",
    template: "Şablon", prompt: "Prompt", ai_coding_tool: "AI kodlama aracı", ai_builder: "AI oluşturucu",
    mcp: "MCP sunucusu", cli: "CLI", deployment: "Dağıtım", monitoring: "İzleme", service: "Servis / API",
    architecture: "Mimari", rule: "Kodlama kuralı", reference: "Referans",
  },
  en: {
    language: "Language", framework: "Framework", runtime: "Runtime", database: "Database",
    orm: "ORM / query", auth: "Authentication", storage: "Storage", cache: "Cache", queue: "Queue",
    ui_library: "UI library", component: "Component", theme: "Theme", design_system: "Design system",
    animation: "Animation", icon_library: "Icon library", repository: "Repository", boilerplate: "Boilerplate",
    template: "Template", prompt: "Prompt", ai_coding_tool: "AI coding tool", ai_builder: "AI builder",
    mcp: "MCP server", cli: "CLI", deployment: "Deployment", monitoring: "Monitoring", service: "Service / API",
    architecture: "Architecture", rule: "Coding rule", reference: "Reference",
  },
});

export const stageLabels = defineCopy<Record<ProjectStage, string>>({
  tr: { experiment: "Deneme", mvp: "MVP", production: "Üretim", maintenance: "Bakım" },
  en: { experiment: "Experiment", mvp: "MVP", production: "Production", maintenance: "Maintenance" },
});

export const stageDescriptions = defineCopy<Record<ProjectStage, string>>({
  tr: {
    experiment: "Fikrini dene, hızla öğren.",
    mvp: "Gerçek kullanıcılar için ilk sürüm.",
    production: "Canlı ürün; güvenilirlik öncelikli.",
    maintenance: "Kararlı ürün; kontrollü değişiklikler.",
  },
  en: {
    experiment: "Try the idea, learn fast.",
    mvp: "A first release for real users.",
    production: "A live product; reliability first.",
    maintenance: "A stable product; controlled changes.",
  },
});

export const suggestedPlatforms = ["web", "mobile", "desktop", "api", "cli", "browser extension"];

/** Suggestion chips only: whatever the user picks is stored as their own text. */
export const suggestedProductTypes = defineCopy<string[]>({
  tr: ["SaaS", "Internal tool", "Marketplace", "API / service", "Mobile app", "CLI tool", "Kütüphane", "Landing page"],
  en: ["SaaS", "Internal tool", "Marketplace", "API / service", "Mobile app", "CLI tool", "Library", "Landing page"],
});

export const suggestedPriorities = ["Fast MVP", "Maintainability", "Low cost", "Scalability", "Type safety", "Accessibility", "Performance", "Security"];

/**
 * Times are shown in Türkiye time (UTC+3, no daylight saving) in both
 * languages. A fixed zone, rather than the machine's, keeps server-rendered
 * and client-rendered dates identical, so hydration never disagrees.
 */
export const displayTimeZone = "Europe/Istanbul";

export function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: "medium", timeZone: displayTimeZone }).format(new Date(iso));
}

/** "8 Eylül 2026, 14:32" / "September 8, 2026 at 2:32 PM" style timestamp (Türkiye time, see displayTimeZone). */
export function formatDateTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocales[locale], { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: displayTimeZone }).format(new Date(iso)).replace(" ", " ");
}

/** "14:32" (Türkiye time). */
export function formatTime(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocales[locale], { hour: "2-digit", minute: "2-digit", timeZone: displayTimeZone }).format(new Date(iso));
}

export function pluralCount(count: number, singular: string, plural = singular) {
  return `${count} ${count === 1 ? singular : plural}`;
}
