import type { DecisionMode, DecisionRecord } from "@devcontext/contracts";

export type SlotDefinition = { key: string; label: string; hint: string };
export type SlotGroup = { id: string; label: string; description: string; slots: SlotDefinition[] };

/** Stable slot keys grouped the way the Stack screen and the wizard present them. Custom `custom.*` slots are listed separately. */
export const slotGroups: SlotGroup[] = [
  {
    id: "frontend", label: "Frontend", description: "Ürünün dili, framework’ü ve arayüz temeli.",
    slots: [
      { key: "frontend.language", label: "Dil", hint: "TypeScript, JavaScript, Dart…" },
      { key: "frontend.framework", label: "Framework", hint: "Next.js, Astro, SvelteKit…" },
      { key: "frontend.ui.base", label: "Bileşenler", hint: "shadcn/ui, Radix, MUI…" },
      { key: "frontend.component.default", label: "Varsayılan bileşenler", hint: "Yeni bileşen yazmadan önce kullanılacak hazır setler." },
    ],
  },
  {
    id: "backend", label: "Backend", description: "Sunucu tarafının teknolojileri ve mimarisi.",
    slots: [
      { key: "backend.language", label: "Dil", hint: "TypeScript, Go, Python…" },
      { key: "backend.framework", label: "Framework", hint: "Fastify, Hono, NestJS…" },
      { key: "backend.architecture", label: "Mimari", hint: "Modular monolith, serverless…" },
      { key: "backend.api_style", label: "API biçimi", hint: "REST, tRPC, GraphQL…" },
    ],
  },
  {
    id: "database", label: "Veri", description: "Verinin saklandığı ve sorgulandığı katmanlar.",
    slots: [
      { key: "database.primary", label: "Veritabanı", hint: "PostgreSQL, SQLite, MongoDB…" },
      { key: "database.query_layer", label: "Sorgu katmanı", hint: "Drizzle, Prisma, raw SQL…" },
      { key: "database.cache", label: "Önbellek", hint: "Redis, in-memory, none…" },
      { key: "backend.queue", label: "Kuyruk / işler", hint: "Database-backed jobs, BullMQ…" },
    ],
  },
  {
    id: "auth", label: "Kimlik", description: "Kimlik doğrulama, dosyalar ve dış iletişim.",
    slots: [
      { key: "auth.provider", label: "Kimlik doğrulama", hint: "Better Auth, Clerk, Auth.js…" },
      { key: "storage.object", label: "Dosya depolama", hint: "S3, Cloudflare R2…" },
      { key: "email.provider", label: "E-posta gönderimi", hint: "Resend, Postmark…" },
    ],
  },
  {
    id: "design", label: "Tasarım", description: "Tasarım sistemi, tema, hareket ve ikonlar.",
    slots: [
      { key: "frontend.design_system", label: "Tasarım sistemi", hint: "Kaydettiğin tasarım profili veya sistemi." },
      { key: "frontend.theme.default", label: "Tema", hint: "Kayıtlı tema veya token seti." },
      { key: "frontend.animation.default", label: "Animasyon", hint: "Motion, GSAP, CSS only…" },
      { key: "frontend.icons", label: "İkonlar", hint: "Lucide, Phosphor…" },
    ],
  },
  {
    id: "ai", label: "AI", description: "Kullandığın coding agent’lar ve talimatlar.",
    slots: [
      { key: "ai.coding.primary", label: "Ana coding agent", hint: "Claude Code, Codex, Cursor…" },
      { key: "ai.builder.primary", label: "UI oluşturucu", hint: "v0, Lovable, none…" },
      { key: "ai.prompt.default", label: "Varsayılan talimat", hint: "Başlangıç için kayıtlı talimat veya şablon." },
      { key: "ai.mcp.default", label: "MCP sunucuları", hint: "Agent’ın bağlanacağı sunucular." },
    ],
  },
  {
    id: "infra", label: "Altyapı", description: "Uygulamanın çalıştığı ve izlendiği altyapı.",
    slots: [
      { key: "infra.deployment.primary", label: "Dağıtım", hint: "Vercel, Fly.io, Docker on a VPS…" },
      { key: "infra.monitoring.primary", label: "İzleme", hint: "Sentry, OpenTelemetry…" },
      { key: "tooling.cli", label: "CLI araçları", hint: "Tercih ettiğin komut satırı araçları." },
    ],
  },
];

const knownSlots = new Map(slotGroups.flatMap((group) => group.slots.map((slot) => [slot.key, slot] as const)));
const slotGroupIndex = new Map(slotGroups.flatMap((group) => group.slots.map((slot) => [slot.key, group] as const)));

export function slotLabel(slot: string) {
  const known = knownSlots.get(slot);
  if (known) return known.label;
  const derived = slot.split(".").slice(1).join(" · ").replace(/_/g, " ");
  return derived || slot;
}

export function isKnownSlot(slot: string) {
  return knownSlots.has(slot);
}

/** Group a slot belongs to; custom slots have none. */
export function slotGroupOf(slot: string): SlotGroup | null {
  return slotGroupIndex.get(slot) ?? null;
}

export const modeLabels: Record<DecisionMode, string> = {
  LOCKED: "Kilitli",
  PREFERRED: "Tercih edilen",
  AI_DECIDE: "AI karar versin",
  DISABLED: "Devre dışı",
};

/** Short labels for compact segmented controls. */
export const modeShortLabels: Record<DecisionMode, string> = {
  LOCKED: "Kilitli",
  PREFERRED: "Tercih",
  AI_DECIDE: "AI",
  DISABLED: "Devre dışı",
};

/** Helper copy from the domain rules: a lock binds the coding agent, never the user. */
export const modeDescriptions: Record<DecisionMode, string> = {
  LOCKED: "AI bu seçimi değiştirmesin. Sen istediğin zaman düzenleyebilirsin.",
  PREFERRED: "Varsayılan tercih; gerekçesi olan bir alternatif seçilebilir.",
  AI_DECIDE: "Kısıtlar içinde seçimi AI yapsın; sabit bir kaynak bağlanmaz.",
  DISABLED: "Bu kaynak bu kapsamda kullanılmasın.",
};

export const modeBadgeClass: Record<DecisionMode, string> = {
  LOCKED: "badge-locked",
  PREFERRED: "badge-preferred",
  AI_DECIDE: "badge-ai_decide",
  DISABLED: "badge-disabled",
};

export type DecisionScope = DecisionRecord["scope"];

/** Where an effective decision comes from, as the UI names it. */
export const sourceLabels: Record<DecisionScope, string> = {
  project: "Proje",
  recipe: "Tarif",
  profile: "Profil",
  global: "Kütüphane",
};

/** Provenance text for a decision: the profile/recipe name when there is one, otherwise the scope name. */
export function originLabel(record: { origin: { name: string } | null } & ({ source: DecisionScope } | { scope: DecisionScope })): string {
  if (record.origin?.name) return record.origin.name;
  return sourceLabels["source" in record ? record.source : record.scope];
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
