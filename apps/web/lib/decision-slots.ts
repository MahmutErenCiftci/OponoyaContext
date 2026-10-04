import type { DecisionMode, DecisionRecord } from "@devcontext/contracts";
import { defineCopy, locales, type Locale } from "./i18n";

export type SlotDefinition = { key: string; label: string; hint: string };
export type SlotGroup = { id: string; label: string; description: string; slots: SlotDefinition[] };

type Text = Record<Locale, string>;
type SlotSource = { key: string; label: Text; hint: Text };
type GroupSource = { id: string; label: Text; description: Text; slots: SlotSource[] };

/** Stable slot keys grouped the way the Stack screen and the wizard present them; text per language. Custom `custom.*` slots are listed separately. */
const groupSources: GroupSource[] = [
  {
    id: "frontend",
    label: { tr: "Frontend", en: "Frontend" },
    description: { tr: "Ürünün dili, framework’ü ve arayüz temeli.", en: "The product's language, framework and UI foundation." },
    slots: [
      { key: "frontend.language", label: { tr: "Dil", en: "Language" }, hint: { tr: "TypeScript, JavaScript, Dart…", en: "TypeScript, JavaScript, Dart…" } },
      { key: "frontend.framework", label: { tr: "Framework", en: "Framework" }, hint: { tr: "Next.js, Astro, SvelteKit…", en: "Next.js, Astro, SvelteKit…" } },
      { key: "frontend.ui.base", label: { tr: "Bileşenler", en: "Components" }, hint: { tr: "shadcn/ui, Radix, MUI…", en: "shadcn/ui, Radix, MUI…" } },
      { key: "frontend.component.default", label: { tr: "Varsayılan bileşenler", en: "Default components" }, hint: { tr: "Yeni bileşen yazmadan önce kullanılacak hazır setler.", en: "Ready-made sets to use before writing a new component." } },
    ],
  },
  {
    id: "backend",
    label: { tr: "Backend", en: "Backend" },
    description: { tr: "Sunucu tarafının teknolojileri ve mimarisi.", en: "Server-side technologies and architecture." },
    slots: [
      { key: "backend.language", label: { tr: "Dil", en: "Language" }, hint: { tr: "TypeScript, Go, Python…", en: "TypeScript, Go, Python…" } },
      { key: "backend.framework", label: { tr: "Framework", en: "Framework" }, hint: { tr: "Fastify, Hono, NestJS…", en: "Fastify, Hono, NestJS…" } },
      { key: "backend.architecture", label: { tr: "Mimari", en: "Architecture" }, hint: { tr: "Modular monolith, serverless…", en: "Modular monolith, serverless…" } },
      { key: "backend.api_style", label: { tr: "API biçimi", en: "API style" }, hint: { tr: "REST, tRPC, GraphQL…", en: "REST, tRPC, GraphQL…" } },
    ],
  },
  {
    id: "database",
    label: { tr: "Veri", en: "Data" },
    description: { tr: "Verinin saklandığı ve sorgulandığı katmanlar.", en: "Where data is stored and queried." },
    slots: [
      { key: "database.primary", label: { tr: "Veritabanı", en: "Database" }, hint: { tr: "PostgreSQL, SQLite, MongoDB…", en: "PostgreSQL, SQLite, MongoDB…" } },
      { key: "database.query_layer", label: { tr: "Sorgu katmanı", en: "Query layer" }, hint: { tr: "Drizzle, Prisma, raw SQL…", en: "Drizzle, Prisma, raw SQL…" } },
      { key: "database.cache", label: { tr: "Önbellek", en: "Cache" }, hint: { tr: "Redis, in-memory, none…", en: "Redis, in-memory, none…" } },
      { key: "backend.queue", label: { tr: "Kuyruk / işler", en: "Queue / jobs" }, hint: { tr: "Database-backed jobs, BullMQ…", en: "Database-backed jobs, BullMQ…" } },
    ],
  },
  {
    id: "auth",
    label: { tr: "Kimlik", en: "Identity" },
    description: { tr: "Kimlik doğrulama, dosyalar ve dış iletişim.", en: "Authentication, files and outbound messages." },
    slots: [
      { key: "auth.provider", label: { tr: "Kimlik doğrulama", en: "Authentication" }, hint: { tr: "Better Auth, Clerk, Auth.js…", en: "Better Auth, Clerk, Auth.js…" } },
      { key: "storage.object", label: { tr: "Dosya depolama", en: "File storage" }, hint: { tr: "S3, Cloudflare R2…", en: "S3, Cloudflare R2…" } },
      { key: "email.provider", label: { tr: "E-posta gönderimi", en: "Email delivery" }, hint: { tr: "Resend, Postmark…", en: "Resend, Postmark…" } },
    ],
  },
  {
    id: "design",
    label: { tr: "Tasarım", en: "Design" },
    description: { tr: "Tasarım sistemi, tema, hareket ve ikonlar.", en: "Design system, theme, motion and icons." },
    slots: [
      { key: "frontend.design_system", label: { tr: "Tasarım sistemi", en: "Design system" }, hint: { tr: "Kaydettiğin tasarım profili veya sistemi.", en: "A design profile or system you saved." } },
      { key: "frontend.theme.default", label: { tr: "Tema", en: "Theme" }, hint: { tr: "Kayıtlı tema veya token seti.", en: "A saved theme or token set." } },
      { key: "frontend.animation.default", label: { tr: "Animasyon", en: "Animation" }, hint: { tr: "Motion, GSAP, CSS only…", en: "Motion, GSAP, CSS only…" } },
      { key: "frontend.icons", label: { tr: "İkonlar", en: "Icons" }, hint: { tr: "Lucide, Phosphor…", en: "Lucide, Phosphor…" } },
    ],
  },
  {
    id: "ai",
    label: { tr: "AI", en: "AI" },
    description: { tr: "Kullandığın coding agent’lar ve talimatlar.", en: "The coding agents and instructions you use." },
    slots: [
      { key: "ai.coding.primary", label: { tr: "Ana coding agent", en: "Main coding agent" }, hint: { tr: "Claude Code, Codex, Cursor…", en: "Claude Code, Codex, Cursor…" } },
      { key: "ai.builder.primary", label: { tr: "UI oluşturucu", en: "UI builder" }, hint: { tr: "v0, Lovable, none…", en: "v0, Lovable, none…" } },
      { key: "ai.prompt.default", label: { tr: "Varsayılan talimat", en: "Default prompt" }, hint: { tr: "Başlangıç için kayıtlı talimat veya şablon.", en: "A saved prompt or template to start from." } },
      { key: "ai.mcp.default", label: { tr: "MCP sunucuları", en: "MCP servers" }, hint: { tr: "Agent’ın bağlanacağı sunucular.", en: "Servers the agent connects to." } },
    ],
  },
  {
    id: "infra",
    label: { tr: "Altyapı", en: "Infrastructure" },
    description: { tr: "Uygulamanın çalıştığı ve izlendiği altyapı.", en: "Where the app runs and how it is monitored." },
    slots: [
      { key: "infra.deployment.primary", label: { tr: "Dağıtım", en: "Deployment" }, hint: { tr: "Vercel, Fly.io, Docker on a VPS…", en: "Vercel, Fly.io, Docker on a VPS…" } },
      { key: "infra.monitoring.primary", label: { tr: "İzleme", en: "Monitoring" }, hint: { tr: "Sentry, OpenTelemetry…", en: "Sentry, OpenTelemetry…" } },
      { key: "tooling.cli", label: { tr: "CLI araçları", en: "CLI tools" }, hint: { tr: "Tercih ettiğin komut satırı araçları.", en: "Your preferred command-line tools." } },
    ],
  },
];

/** The slot groups in one language: `slotGroups[locale]`. */
export const slotGroups = Object.fromEntries(locales.map((locale) => [locale, groupSources.map((group): SlotGroup => ({
  id: group.id,
  label: group.label[locale],
  description: group.description[locale],
  slots: group.slots.map((slot) => ({ key: slot.key, label: slot.label[locale], hint: slot.hint[locale] })),
}))])) as Record<Locale, SlotGroup[]>;

const knownSlots = new Map(groupSources.flatMap((group) => group.slots.map((slot) => [slot.key, slot] as const)));
const slotGroupIndex = new Map(groupSources.flatMap((group) => group.slots.map((slot) => [slot.key, group.id] as const)));

export function slotLabel(slot: string, locale: Locale) {
  const known = knownSlots.get(slot);
  if (known) return known.label[locale];
  const derived = slot.split(".").slice(1).join(" · ").replace(/_/g, " ");
  return derived || slot;
}

export function isKnownSlot(slot: string) {
  return knownSlots.has(slot);
}

/** Group a slot belongs to, in one language; custom slots have none. */
export function slotGroupOf(slot: string, locale: Locale): SlotGroup | null {
  const id = slotGroupIndex.get(slot);
  return id ? slotGroups[locale].find((group) => group.id === id) ?? null : null;
}

export const modeLabels = defineCopy<Record<DecisionMode, string>>({
  tr: { LOCKED: "Kilitli", PREFERRED: "Tercih edilen", AI_DECIDE: "AI karar versin", DISABLED: "Devre dışı" },
  en: { LOCKED: "Locked", PREFERRED: "Preferred", AI_DECIDE: "Let AI decide", DISABLED: "Disabled" },
});

/** Short labels for compact segmented controls. */
export const modeShortLabels = defineCopy<Record<DecisionMode, string>>({
  tr: { LOCKED: "Kilitli", PREFERRED: "Tercih", AI_DECIDE: "AI", DISABLED: "Devre dışı" },
  en: { LOCKED: "Locked", PREFERRED: "Preferred", AI_DECIDE: "AI", DISABLED: "Disabled" },
});

/** Helper copy from the domain rules: a lock binds the coding agent, never the user. */
export const modeDescriptions = defineCopy<Record<DecisionMode, string>>({
  tr: {
    LOCKED: "AI bu seçimi değiştirmesin. Sen istediğin zaman düzenleyebilirsin.",
    PREFERRED: "Varsayılan tercih; gerekçesi olan bir alternatif seçilebilir.",
    AI_DECIDE: "Kısıtlar içinde seçimi AI yapsın; sabit bir kaynak bağlanmaz.",
    DISABLED: "Bu kaynak bu kapsamda kullanılmasın.",
  },
  en: {
    LOCKED: "The AI must not change this choice. You can still edit it any time.",
    PREFERRED: "The default choice; a justified alternative may be picked.",
    AI_DECIDE: "The AI picks within the constraints; no fixed resource is attached.",
    DISABLED: "This resource must not be used in this scope.",
  },
});

export const modeBadgeClass: Record<DecisionMode, string> = {
  LOCKED: "badge-locked",
  PREFERRED: "badge-preferred",
  AI_DECIDE: "badge-ai_decide",
  DISABLED: "badge-disabled",
};

export type DecisionScope = DecisionRecord["scope"];

/** Where an effective decision comes from, as the UI names it. */
export const sourceLabels = defineCopy<Record<DecisionScope, string>>({
  tr: { project: "Proje", recipe: "Tarif", profile: "Profil", global: "Kütüphane" },
  en: { project: "Project", recipe: "Recipe", profile: "Profile", global: "Library" },
});

/** Provenance text for a decision: the profile/recipe name when there is one, otherwise the scope name. */
export function originLabel(record: { origin: { name: string } | null } & ({ source: DecisionScope } | { scope: DecisionScope }), locale: Locale): string {
  if (record.origin?.name) return record.origin.name;
  return sourceLabels[locale]["source" in record ? record.source : record.scope];
}

export type DecisionConstraints = { allowed: string[]; excluded: string[]; notes: string; extra: Record<string, unknown> };

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Splits stored constraints into the editable parts while preserving keys the UI does not know. */
export function readConstraints(value: Record<string, unknown>): DecisionConstraints {
  const { allowed, excluded, notes, ...extra } = value;
  return { allowed: stringList(allowed), excluded: stringList(excluded), notes: typeof notes === "string" ? notes : "", extra };
}

export function writeConstraints(value: DecisionConstraints): Record<string, unknown> {
  const result: Record<string, unknown> = { ...value.extra };
  if (value.allowed.length > 0) result.allowed = value.allowed;
  if (value.excluded.length > 0) result.excluded = value.excluded;
  if (value.notes.trim()) result.notes = value.notes.trim();
  return result;
}
