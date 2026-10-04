"use client";

import {
  catalogLibraryAddResponseSchema,
  profileResponseSchema,
  projectResponseSchema,
  recipeResponseSchema,
  resourceListResponseSchema,
  type CatalogSlotSuggestions,
  type DecisionMode,
  type DecisionRecord,
  type ProfileSummary,
  type Project,
  type ProjectDecisionView,
  type ProjectStage,
  type Recipe,
  type RecipeSummary,
  type Resource,
  type SlotSuggestion,
} from "@devcontext/contracts";
import { ArrowLeft, ArrowRight, CaretDown, Check, CheckCircle, MagnifyingGlass, PencilSimple, Plus, ShieldCheck, Sparkle, Warning, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ChipField } from "../../../components/chip-field";
import { DecisionBadge, ModeIcon } from "../../../components/decision-badge";
import { useLocale } from "../../../components/locale-provider";
import { Breadcrumb } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { TechLogo } from "../../../components/tech-logo";
import { modeLabels, modeShortLabels, originLabel, slotGroupOf, slotGroups, slotLabel } from "../../../lib/decision-slots";
import { readApiError } from "../../../lib/errors";
import { defineCopy, type Locale } from "../../../lib/i18n";
import { catalogSlugFor } from "../../../lib/logos";
import { pluralCount, profileTypeLabels, stageLabels, suggestedPlatforms, suggestedPriorities, suggestedProductTypes, typeLabels } from "../../../lib/resource-labels";

type Picked = { id: string; name: string; type: Resource["type"]; sourceUrl: string | null; archivedAt: string | null };
type SlotDraft = {
  mode: DecisionMode;
  resource: Picked | null;
  constraints: Record<string, unknown>;
  rationale: string | null;
  priority: number;
  conditions: Record<string, unknown>;
};
type SelectedProfile = { profileId: string; priority: number };
type Preset = "low" | "balanced" | "high";

const steps = ["basics", "technologies", "rules", "review"] as const;

const presets: Preset[] = ["low", "balanced", "high"];

const presetCopy = defineCopy<Record<Preset, { label: string; text: string }>>({
  tr: {
    low: { label: "Düşük", text: "AI yalnızca uygulama kurallarında boşlukları doldurur." },
    balanced: { label: "Dengeli", text: "AI, seçtiğin sınırlar içinde makul tercihler yapabilir." },
    high: { label: "Yüksek", text: "AI, daha geniş bir alan içinde tercih yapabilir." },
  },
  en: {
    low: { label: "Low", text: "The AI only fills gaps in the implementation rules." },
    balanced: { label: "Balanced", text: "The AI can make reasonable choices within the limits you set." },
    high: { label: "High", text: "The AI can choose across a wider range." },
  },
});

/** Slot keys are identical in every language, so the Turkish groups serve as the key list. */
const presetSlots: Record<Preset, string[]> = {
  low: [],
  balanced: [
    "backend.api_style", "backend.architecture", "database.query_layer", "database.cache", "backend.queue", "email.provider",
    "frontend.component.default", "frontend.animation.default", "frontend.icons", "ai.mcp.default", "infra.monitoring.primary", "tooling.cli",
  ],
  high: slotGroups.tr.flatMap((group) => group.slots.map((slot) => slot.key)),
};

const copy = defineCopy({
  tr: {
    steps: ["Proje bilgileri", "Teknoloji kararları", "Kurallar", "Gözden geçir"],
    libraryRule: "Kütüphane kuralı",
    profileFallback: "Profil",
    nameRequired: "Devam etmek için projeye bir ad ver.",
    discardConfirm: "Bu projedeki kaydedilmemiş değişiklikler silinsin mi?",
    addSuggestedFailed: "Teknoloji Kütüphanene eklenemedi. Bağlantını kontrol edip tekrar dene.",
    conflict: (resource: string | null, disabledSlot: string, activeSlots: string) => `${resource ?? "Bir kaynak"} ${disabledSlot} alanında devre dışı ama ${activeSlots} alanında seçili.`,
    resourceMissing: (slot: string) => `${slot} için bir kaynak seç veya kararı AI’a bırak.`,
    attachmentGone: "Bağlı kaynaklardan biri artık Kütüphanende yok.",
    profileUnavailable: "Seçili profillerden biri arşivde ya da kullanılamıyor.",
    invalidFields: "Bazı alanlar geçersiz. Proje bilgilerini kontrol edip tekrar dene.",
    decisionsFailed: (message: string) => `Proje kaydedildi ama kararları kaydedilemedi: ${message} Tekrar dene; hiçbir şey çoğaltılmaz.`,
    unreachable: "Proje hizmetine ulaşılamıyor. Tekrar dene.",
    nextLabels: ["Teknoloji kararlarına geç", "Kurallara geç", "Gözden geçir"],
    editTitle: "Projeyi düzenle",
    newTitle: "Yeni proje",
    rulesTitle: "Kurallar ve referanslar",
    reviewEditTitle: "Değişiklikleri gözden geçir",
    reviewNewTitle: "Projeni oluşturmaya hazırsın.",
    rulesLead: "Projenin sabit kurallarını ve referans kaynaklarını tanımla. Bu bilgiler deterministik talimatların oluşturulmasında kullanılır.",
    reviewLead: "Seçimlerini ve nereden geldiklerini son kez kontrol et.",
    projectSource: "Proje",
    slotResource: (label: string) => `${label} kaynağı`,
    addingToLibrary: "Kütüphanene ekleniyor…",
    aiWillDecide: "AI karar verecek · bir seçim yaparsan tercih olur",
    archivedOption: " (arşiv)",
    yourLibrary: "Kütüphanen",
    usedIn: (count: number) => ` · ${count} projede kullandın`,
    suggestedGroup: "Önerilen · seçince Kütüphanene eklenir",
    slotMode: (label: string) => `${label} için karar biçimi`,
    moreOptions: (label: string) => `${label} için diğer seçenekler`,
    disabled: "Devre dışı",
    useInherited: "Devralınanı kullan",
    clearDecision: "Kararı bırak",
    notUsedHere: " bu projede kullanılmayacak.",
    aiLimits: "AI için sınırlar",
    aiLimitsPlaceholder: "İzin verilen seçenekler, bütçe, uyumluluk…",
    inheritedOverridden: (label: string, detail: string) => `${label} tercihi (${detail}) projeye özel değiştirildi`,
    inheritedFrom: (label: string, detail: string) => `${label} tercihinden: ${detail}`,
    noInherited: "Devralınan tercih yok",
    pickFromLibrary: "Kütüphaneden kaynak seç",
    emptyLibraryWithSuggestions: "Kütüphanen henüz boş: listedeki önerilerden birini seçtiğinde Kütüphanene eklenir.",
    emptyLibrary: "Kütüphanende aktif kaynak yok; bir kaynak ekle veya kararı AI’a bırak.",
    breadcrumb: "Projeler",
    closeWizard: "Proje oluşturucuyu kapat",
    stepsLabel: "Adımlar",
    whatBuilding: "Ne geliştiriyorsun?",
    projectName: "Proje adı *",
    projectDescription: "Proje açıklaması",
    descriptionPlaceholder: "Ne yaptığı, kimin için olduğu ve neyin değişmemesi gerektiği…",
    productType: "Ürün türü",
    choose: "Seç…",
    other: "Diğer…",
    customProductType: "Ürün türü (özel)",
    customProductTypePlaceholder: "Ürün türünü yaz",
    stage: "Aşama",
    starterRecipe: "Başlangıç tarifi",
    noRecipe: "Tarif kullanma",
    decisions: (count: number) => pluralCount(count, "karar"),
    profiles: (count: number) => pluralCount(count, "profil"),
    recipeApplied: (name: string, decisions: number, profiles: number) => `${name}; ${decisions} karar ve ${profiles} profili referansla katar. Proje seçimlerin onu geçersiz kılar; hiçbir şey kopyalanmaz.`,
    noRecipes: "Henüz tarif yok; profilleri ayrı seçebilir veya tarifsiz devam edebilirsin.",
    recipeByReference: "Tarif referansla uygulanır: sonradan düzenlersen onu kullanan her proje bir sonraki oluşturmada değişikliği alır.",
    pickProfiles: "Profilleri ayrı seç",
    noProfilesBefore: "Henüz profil yok. ",
    noProfilesLink: "Bir profil oluştur",
    noProfilesAfter: " ya da profil olmadan devam et.",
    archivedSuffix: " · arşivde",
    priority: "Öncelik",
    profilePriority: (name: string) => `${name} önceliği`,
    priorityNote: "İki profil aynı alanda karar verdiğinde yüksek öncelik kazanır. Proje seçimlerin her zaman profillerin önündedir.",
    freedom: "AI’a bırakılan özgürlük",
    freedomNote: "Bu seçim karar biçimlerini başlatır; sonraki adımda her tercihi düzenleyebilirsin.",
    platformsAndPriorities: "Platformlar ve öncelikler",
    addPlatform: "Özel platform ekle",
    platformsHint: "Ürünün çalıştığı yerler. Gerekirse birkaçını seç.",
    platforms: "Platformlar",
    addPriority: "Özel öncelik ekle",
    prioritiesHint: "Seçim şansı olduğunda coding agent neyi gözetmeli?",
    priorities: "Öncelikler",
    techGroups: "Teknoloji grupları",
    techIntro: "Seçimleri profilinden alabilir veya projeye özel değiştirebilirsin.",
    engineeringRules: "Mühendislik kuralları",
    oneRulePerLine: "Her satıra bir kural yaz.",
    rulesPlaceholder: "TypeScript strict mode kullan.\nAPI girdilerini doğrula.",
    rulesLimit: (limit: number) => ` · en fazla ${limit} kural`,
    references: "Referans kaynaklar",
    searchResources: "Kaynak ara",
    searchResourcesPlaceholder: "Kaynak ara…",
    libraryEmpty: "Kütüphanen boş. Önce bir kaynak ekle ya da referanssız devam et.",
    noMatch: (query: string) => `“${query}” ile eşleşen aktif kaynak yok.`,
    addFromLibrary: "Kütüphaneden ekle",
    decisionSummary: "Karar özeti",
    layer: "Katman",
    choice: "Seçim",
    decision: "Karar",
    source: "Kaynak",
    edit: "Düzenle",
    noTechDecisionsReview: "Henüz teknoloji kararı yok. Oluşturduktan sonra teknoloji yığınından ekleyebilirsin.",
    aiWillChoose: "AI seçecek",
    editDecision: (label: string) => `${label} kararını düzenle`,
    projectRules: (count: number) => pluralCount(count, "proje kuralı"),
    noRules: "Kural eklenmedi.",
    referencesList: (names: string) => `Referans kaynaklar: ${names}`,
    conflictsTitle: "Gözden geçirilecek çakışmalar",
    conflictCode: "ÇAKIŞMA",
    conflictsNote: "Hiçbir şey otomatik değişmez. Kararları düzenle ya da kaydedip teknoloji yığınından düzelt.",
    projectSummary: "Proje özeti",
    untitled: "Adsız proje",
    noRecipeInUse: "Tarif kullanılmıyor",
    profilesTitle: "Profiller",
    delegatedOnly: (count: number) => `${pluralCount(count, "karar")} AI’a bırakıldı`,
    noTechDecisions: "Henüz teknoloji kararı yok.",
    counts: (explicit: number, delegated: number, inherited: number) => `${explicit} açık seçim · ${delegated} AI’a bırakılan · ${inherited} devralınan`,
    rulesSuffix: (count: number) => ` · ${pluralCount(count, "kural")}`,
    referencesSuffix: (count: number) => ` · ${pluralCount(count, "referans")}`,
    resourceSummary: "Kaynak özeti",
    afterCreate: "Oluşturduktan sonra AI talimatlarını hazırlayabilirsin.",
    cancel: "İptal",
    back: "Geri",
    saving: "Kaydediliyor…",
    saveChanges: "Değişiklikleri kaydet",
    create: "Projeyi oluştur",
  },
  en: {
    steps: ["Project details", "Technology decisions", "Rules", "Review"],
    libraryRule: "Library rule",
    profileFallback: "Profile",
    nameRequired: "Give the project a name to continue.",
    discardConfirm: "Discard the unsaved changes to this project?",
    addSuggestedFailed: "The technology could not be added to your Library. Check your connection and try again.",
    conflict: (resource: string | null, disabledSlot: string, activeSlots: string) => `${resource ?? "A resource"} is disabled in ${disabledSlot} but selected in ${activeSlots}.`,
    resourceMissing: (slot: string) => `Pick a resource for ${slot} or let AI decide.`,
    attachmentGone: "One of the attached resources is no longer in your Library.",
    profileUnavailable: "One of the selected profiles is archived or unavailable.",
    invalidFields: "Some fields are invalid. Check the project details and try again.",
    decisionsFailed: (message: string) => `The project was saved, but its decisions were not: ${message} Try again; nothing will be duplicated.`,
    unreachable: "The project service cannot be reached. Try again.",
    nextLabels: ["Continue to technology decisions", "Continue to rules", "Review"],
    editTitle: "Edit project",
    newTitle: "New project",
    rulesTitle: "Rules and references",
    reviewEditTitle: "Review your changes",
    reviewNewTitle: "Your project is ready to create.",
    rulesLead: "Define the project's fixed rules and reference resources. They are used to build deterministic instructions.",
    reviewLead: "Check your choices and where they come from one last time.",
    projectSource: "Project",
    slotResource: (label: string) => `${label} resource`,
    addingToLibrary: "Adding to your Library…",
    aiWillDecide: "AI will decide · picking one makes it a preference",
    archivedOption: " (archived)",
    yourLibrary: "Your Library",
    usedIn: (count: number) => ` · used in ${pluralCount(count, "project", "projects")}`,
    suggestedGroup: "Suggested · added to your Library when picked",
    slotMode: (label: string) => `Decision mode for ${label}`,
    moreOptions: (label: string) => `More options for ${label}`,
    disabled: "Disabled",
    useInherited: "Use inherited",
    clearDecision: "Clear decision",
    notUsedHere: " will not be used in this project.",
    aiLimits: "Limits for the AI",
    aiLimitsPlaceholder: "Allowed options, budget, compliance…",
    inheritedOverridden: (label: string, detail: string) => `${label} preference (${detail}) overridden for this project`,
    inheritedFrom: (label: string, detail: string) => `Inherited from ${label}: ${detail}`,
    noInherited: "No inherited preference",
    pickFromLibrary: "Choose a resource from the Library",
    emptyLibraryWithSuggestions: "Your Library is still empty: pick one of the suggestions in the list and it is added to your Library.",
    emptyLibrary: "Your Library has no active resources; add one or let AI decide.",
    breadcrumb: "Projects",
    closeWizard: "Close project wizard",
    stepsLabel: "Steps",
    whatBuilding: "What are you building?",
    projectName: "Project name *",
    projectDescription: "Project description",
    descriptionPlaceholder: "What it does, who it is for and what must not change…",
    productType: "Product type",
    choose: "Choose…",
    other: "Other…",
    customProductType: "Product type (custom)",
    customProductTypePlaceholder: "Type the product type",
    stage: "Stage",
    starterRecipe: "Starter recipe",
    noRecipe: "No recipe",
    decisions: (count: number) => pluralCount(count, "decision", "decisions"),
    profiles: (count: number) => pluralCount(count, "profile", "profiles"),
    recipeApplied: (name: string, decisions: number, profiles: number) => `${name} adds ${pluralCount(decisions, "decision", "decisions")} and ${pluralCount(profiles, "profile", "profiles")} by reference. Your project choices override it; nothing is copied.`,
    noRecipes: "No recipes yet; you can pick profiles separately or continue without a recipe.",
    recipeByReference: "A recipe applies by reference: if you edit it later, every project using it picks up the change the next time its instructions are created.",
    pickProfiles: "Pick profiles separately",
    noProfilesBefore: "No profiles yet. ",
    noProfilesLink: "Create a profile",
    noProfilesAfter: " or continue without one.",
    archivedSuffix: " · archived",
    priority: "Priority",
    profilePriority: (name: string) => `${name} priority`,
    priorityNote: "When two profiles decide the same slot, the higher priority wins. Your project choices always come before profiles.",
    freedom: "Freedom left to the AI",
    freedomNote: "This choice sets the starting decision modes; you can edit every choice in the next step.",
    platformsAndPriorities: "Platforms and priorities",
    addPlatform: "Add custom platform",
    platformsHint: "Where the product runs. Pick several if needed.",
    platforms: "Platforms",
    addPriority: "Add custom priority",
    prioritiesHint: "What should the coding agent favour when it has a choice?",
    priorities: "Priorities",
    techGroups: "Technology groups",
    techIntro: "You can take choices from your profile or change them for this project.",
    engineeringRules: "Engineering rules",
    oneRulePerLine: "Write one rule per line.",
    rulesPlaceholder: "Use TypeScript strict mode.\nValidate API input.",
    rulesLimit: (limit: number) => ` · up to ${limit} rules`,
    references: "Reference resources",
    searchResources: "Search resources",
    searchResourcesPlaceholder: "Search resources…",
    libraryEmpty: "Your Library is empty. Add a resource first or continue without references.",
    noMatch: (query: string) => `No active resources match “${query}”.`,
    addFromLibrary: "Add from Library",
    decisionSummary: "Decision summary",
    layer: "Layer",
    choice: "Choice",
    decision: "Decision",
    source: "Source",
    edit: "Edit",
    noTechDecisionsReview: "No technology decisions yet. You can add them from the tech stack after creating the project.",
    aiWillChoose: "AI will choose",
    editDecision: (label: string) => `Edit ${label} decision`,
    projectRules: (count: number) => pluralCount(count, "project rule", "project rules"),
    noRules: "No rules added.",
    referencesList: (names: string) => `Reference resources: ${names}`,
    conflictsTitle: "Conflicts to review",
    conflictCode: "CONFLICT",
    conflictsNote: "Nothing changes automatically. Edit the decisions, or save and fix them from the tech stack.",
    projectSummary: "Project summary",
    untitled: "Untitled project",
    noRecipeInUse: "No recipe in use",
    profilesTitle: "Profiles",
    delegatedOnly: (count: number) => `${pluralCount(count, "decision", "decisions")} left to the AI`,
    noTechDecisions: "No technology decisions yet.",
    counts: (explicit: number, delegated: number, inherited: number) => `${explicit} explicit · ${delegated} left to AI · ${inherited} inherited`,
    rulesSuffix: (count: number) => ` · ${pluralCount(count, "rule", "rules")}`,
    referencesSuffix: (count: number) => ` · ${pluralCount(count, "reference", "references")}`,
    resourceSummary: "Resource summary",
    afterCreate: "After creating the project you can prepare its AI instructions.",
    cancel: "Cancel",
    back: "Back",
    saving: "Saving…",
    saveChanges: "Save changes",
    create: "Create project",
  },
});

const rulesLimit = 30;
const rulesTextLimit = 2000;

function pick(resource: Resource | Project["resources"][number] | NonNullable<DecisionRecord["resource"]>): Picked {
  return { id: resource.id, name: resource.name, type: resource.type, sourceUrl: resource.sourceUrl, archivedAt: resource.archivedAt };
}

function draftFromRecord(record: DecisionRecord): SlotDraft {
  return { mode: record.mode, resource: record.resource ? pick(record.resource) : null, constraints: record.constraints, rationale: record.rationale, priority: record.priority, conditions: record.conditions };
}

/** Select values for suggested catalog technologies; anything else is a Library resource id. */
const catalogOptionPrefix = "catalog:";
const shownSuggestions = 6;

function catalogSlugOf(resource: Resource | undefined) {
  const slug = resource?.metadata.catalogSlug;
  return typeof slug === "string" ? slug : null;
}

const reasonCopy = defineCopy({
  tr: {
    pairedWith: (name: string) => `${name} ile uyumlu`,
    usedBefore: "daha önce kullandın",
    popularHere: "Oponoya’da popüler",
    pairsWith: "Kütüphanenle uyumlu",
    widelyUsed: "yaygın",
    catalog: "katalogdan",
  },
  en: {
    pairedWith: (name: string) => `works with ${name}`,
    usedBefore: "you used it before",
    popularHere: "popular on Oponoya",
    pairsWith: "works with your Library",
    widelyUsed: "widely used",
    catalog: "from the catalog",
  },
});

/** One short reason per suggestion; a pairing with this project's own picks beats the general reasons. */
function suggestionReason(suggestion: SlotSuggestion, pairedWith: string | null, locale: Locale) {
  const text = reasonCopy[locale];
  if (pairedWith) return text.pairedWith(pairedWith);
  if (suggestion.reasons.includes("used_before")) return text.usedBefore;
  if (suggestion.reasons.includes("popular_here")) return text.popularHere;
  if (suggestion.reasons.includes("pairs_with")) return text.pairsWith;
  if (suggestion.reasons.includes("widely_used")) return text.widelyUsed;
  return text.catalog;
}

function splitRules(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, rulesLimit).map((line) => line.slice(0, 500));
}

export function ProjectWizard({ project, decisions, library, suggestions, profiles, recipes, globalDecisions, initialRecipeId = null, onClose, onSaved }: {
  project: Project | null;
  /** Existing decisions when editing; empty for a new Project. */
  decisions: ProjectDecisionView[];
  library: Resource[];
  /** Catalog picks per slot and Library usage counts; null lists the Library only. */
  suggestions: CatalogSlotSuggestions | null;
  profiles: ProfileSummary[];
  recipes: RecipeSummary[];
  globalDecisions: DecisionRecord[];
  initialRecipeId?: string | null;
  onClose(): void;
  onSaved(project: Project): void;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const groups = slotGroups[locale];
  const productTypes = suggestedProductTypes[locale];
  const editing = project !== null;
  const id = useId();
  const [step, setStep] = useState(0);
  const [groupId, setGroupId] = useState(groups[0]!.id);
  const activeGroup = groups.find((group) => group.id === groupId) ?? groups[0]!;
  const [name, setName] = useState(project?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState(project?.description ?? "");
  const [productType, setProductType] = useState(project?.productType ?? "");
  const [customProductType, setCustomProductType] = useState(project?.productType && !productTypes.includes(project.productType) ? project.productType : "");
  const [stage, setStage] = useState<ProjectStage>(project?.stage ?? "mvp");
  const [platforms, setPlatforms] = useState<string[]>(project?.platforms ?? ["web"]);
  const [priorities, setPriorities] = useState<string[]>(project?.priorities ?? []);
  const [rulesText, setRulesText] = useState((project?.rules ?? []).join("\n"));
  const [selectedProfiles, setSelectedProfiles] = useState<SelectedProfile[]>(() => (project?.profiles ?? []).map((item) => ({ profileId: item.id, priority: item.priority })));
  const [recipeId, setRecipeId] = useState<string | null>(project?.recipe?.id ?? initialRecipeId);
  const [recipeDetails, setRecipeDetails] = useState<Recipe | null>(null);
  const [profileDetails, setProfileDetails] = useState<Record<string, DecisionRecord[]>>(() => {
    const seeded: Record<string, DecisionRecord[]> = {};
    for (const view of decisions) for (const record of view.profiles) if (record.origin) seeded[record.origin.id] = [...(seeded[record.origin.id] ?? []), record];
    return seeded;
  });
  const [preset, setPreset] = useState<Preset | null>(editing ? null : "balanced");
  const [presetApplied, setPresetApplied] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, SlotDraft>>(() => {
    const initial: Record<string, SlotDraft> = {};
    for (const view of decisions) if (view.project) initial[view.slot] = draftFromRecord(view.project);
    return initial;
  });
  const [attachments, setAttachments] = useState<Map<string, Picked>>(() => new Map((project?.resources ?? []).map((resource) => [resource.id, pick(resource)])));
  const [resourceQuery, setResourceQuery] = useState("");
  const [remote, setRemote] = useState<{ query: string; resources: Resource[] } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The Library grows while the wizard is open: a suggestion picked here, or a resource saved in another tab.
  const [libraryItems, setLibraryItems] = useState<Resource[]>(library);
  /** Slot whose suggested technology is being added to the Library. */
  const [adding, setAdding] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirtyRef = useRef(false);
  // One idempotency key per wizard session, so a retried create returns the same project.
  const requestIdRef = useRef<string | null>(null);
  const existingSlots = decisions.filter((view) => view.project).map((view) => view.slot);
  const rules = splitRules(rulesText);

  function touch() { dirtyRef.current = true; }

  useEffect(() => {
    if (!recipeId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/recipes/${encodeURIComponent(recipeId)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const loaded = recipeResponseSchema.parse(await response.json()).recipe;
        if (!controller.signal.aborted) setRecipeDetails(loaded);
      } catch {
        // Aborted or failed loads leave the recipe summary in place; the API still applies it.
      }
    })();
    return () => controller.abort();
  }, [recipeId]);
  const activeRecipe = recipeId !== null && recipeDetails?.id === recipeId ? recipeDetails : null;

  useEffect(() => {
    const wanted = [...selectedProfiles.map((item) => item.profileId), ...(activeRecipe?.profiles.map((item) => item.id) ?? [])];
    const missing = [...new Set(wanted)].filter((profileId) => !(profileId in profileDetails));
    if (missing.length === 0) return;
    const controller = new AbortController();
    void Promise.all(missing.map(async (profileId) => {
      try {
        const response = await fetch(`/api/profiles/${profileId}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return [profileId, []] as const;
        return [profileId, profileResponseSchema.parse(await response.json()).profile.decisions] as const;
      } catch {
        return [profileId, []] as const;
      }
    })).then((entries) => {
      if (controller.signal.aborted) return;
      setProfileDetails((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
    });
    return () => controller.abort();
  }, [selectedProfiles, profileDetails, activeRecipe]);

  useEffect(() => {
    const query = resourceQuery.trim();
    if (!query) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ archived: "active", limit: "50", q: query });
        const response = await fetch(`/api/resources?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        setRemote({ query, resources: resourceListResponseSchema.parse(await response.json()).resources });
      } catch {
        // Aborted or failed searches fall back to the locally loaded Library.
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [resourceQuery]);

  // "Kütüphaneden kaynak seç" opens the Library in another tab; what was saved there shows up when this tab is back in front.
  useEffect(() => {
    let controller: AbortController | null = null;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/resources?${new URLSearchParams({ archived: "active", limit: "100" })}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const parsed = resourceListResponseSchema.safeParse(await response.json());
        if (parsed.success) setLibraryItems(parsed.data.resources);
      } catch {
        // Keep the list already on screen.
      }
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const profileName = (profileId: string) => profiles.find((item) => item.id === profileId)?.name ?? project?.profiles.find((item) => item.id === profileId)?.name ?? t.profileFallback;
  const recipeName = activeRecipe?.name ?? recipes.find((item) => item.id === recipeId)?.name ?? project?.recipe?.name ?? null;

  function inheritedFor(slot: string): { record: DecisionRecord; label: string } | null {
    const fromRecipe = activeRecipe?.decisions.find((record) => record.slot === slot);
    if (fromRecipe) return { record: fromRecipe, label: activeRecipe!.name };
    const attached = [
      ...selectedProfiles.map((selection) => ({ profileId: selection.profileId, priority: selection.priority, name: profileName(selection.profileId) })),
      ...(activeRecipe?.profiles ?? []).filter((item) => !selectedProfiles.some((selection) => selection.profileId === item.id)).map((item) => ({ profileId: item.id, priority: item.priority, name: item.name })),
    ];
    const fromProfiles = attached
      .flatMap((selection) => (profileDetails[selection.profileId] ?? []).filter((record) => record.slot === slot).map((record) => ({ record, priority: selection.priority, name: selection.name })))
      .sort((a, b) => (b.priority - a.priority) || (b.record.priority - a.record.priority));
    if (fromProfiles[0]) return { record: fromProfiles[0].record, label: fromProfiles[0].name };
    const global = globalDecisions.find((record) => record.slot === slot);
    return global ? { record: global, label: t.libraryRule } : null;
  }

  function goTo(index: number) {
    if (index > 0 && !name.trim()) {
      setNameError(t.nameRequired);
      setStep(0);
      return;
    }
    setNameError(null);
    setError(null);
    // The freedom preset chosen on step one seeds delegated slots the first time the technology step opens.
    if (index >= 1 && !editing && preset && presetApplied.size === 0 && Object.keys(drafts).length === 0) applyPreset(preset);
    setStep(Math.max(0, Math.min(index, steps.length - 1)));
    window.setTimeout(() => headingRef.current?.focus(), 0);
    window.scrollTo({ top: 0 });
  }

  function requestClose() {
    if (dirtyRef.current && !window.confirm(t.discardConfirm)) return;
    onClose();
  }

  function setSlotMode(slot: string, mode: DecisionMode | "inherit") {
    touch();
    setPresetApplied((previous) => { const next = new Set(previous); next.delete(slot); return next; });
    setDrafts((previous) => {
      const next = { ...previous };
      if (mode === "inherit") { delete next[slot]; return next; }
      const current = previous[slot];
      const inherited = inheritedFor(slot);
      next[slot] = {
        mode,
        resource: mode === "AI_DECIDE" ? null : current?.resource ?? (inherited?.record.resource ? pick(inherited.record.resource) : null),
        constraints: current?.constraints ?? {},
        rationale: current?.rationale ?? null,
        priority: current?.priority ?? 0,
        conditions: current?.conditions ?? {},
      };
      return next;
    });
  }

  /** Picking a resource on a slot left to the AI turns it into a preference for that resource. */
  function setSlotPicked(slot: string, picked: Picked | null) {
    touch();
    setPresetApplied((previous) => { const next = new Set(previous); next.delete(slot); return next; });
    setDrafts((previous) => {
      const current = previous[slot] ?? { mode: "PREFERRED" as DecisionMode, resource: null, constraints: {}, rationale: null, priority: 0, conditions: {} };
      if (!picked) return { ...previous, [slot]: { ...current, resource: null } };
      return { ...previous, [slot]: { ...current, mode: current.mode === "AI_DECIDE" ? "PREFERRED" : current.mode, resource: picked } };
    });
  }

  function setSlotResource(slot: string, value: string) {
    if (value.startsWith(catalogOptionPrefix)) {
      void addSuggested(slot, value.slice(catalogOptionPrefix.length));
      return;
    }
    const resource = libraryItems.find((item) => item.id === value);
    setSlotPicked(slot, value && resource ? pick(resource) : null);
  }

  /** A suggestion is a catalog technology: choosing it saves it to the Library (an explicit action, labelled in the list) and picks it. */
  async function addSuggested(slot: string, slug: string) {
    setAdding(slot);
    setError(null);
    try {
      const response = await fetch(`/api/catalog/technologies/${encodeURIComponent(slug)}/library`, { method: "POST" });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      const { resource } = catalogLibraryAddResponseSchema.parse(await response.json());
      setLibraryItems((previous) => previous.some((item) => item.id === resource.id) ? previous : [...previous, resource]);
      setSlotPicked(slot, pick(resource));
    } catch {
      setError(t.addSuggestedFailed);
    } finally {
      setAdding(null);
    }
  }

  function setSlotNotes(slot: string, notes: string) {
    touch();
    setDrafts((previous) => {
      const current = previous[slot];
      if (!current) return previous;
      const constraints = { ...current.constraints };
      if (notes.trim()) constraints.notes = notes;
      else delete constraints.notes;
      return { ...previous, [slot]: { ...current, constraints } };
    });
  }

  function applyPreset(next: Preset) {
    touch();
    setPreset(next);
    setDrafts((previous) => {
      const seeded = { ...previous };
      for (const slot of presetApplied) if (seeded[slot]?.mode === "AI_DECIDE") delete seeded[slot];
      for (const slot of presetSlots[next]) if (!seeded[slot] && !inheritedFor(slot)) seeded[slot] = { mode: "AI_DECIDE", resource: null, constraints: {}, rationale: null, priority: 0, conditions: {} };
      return seeded;
    });
    setPresetApplied(new Set(presetSlots[next].filter((slot) => !inheritedFor(slot))));
  }

  function toggleProfile(profileId: string) {
    touch();
    setSelectedProfiles((previous) => previous.some((item) => item.profileId === profileId) ? previous.filter((item) => item.profileId !== profileId) : [...previous, { profileId, priority: 0 }]);
  }

  function toggleAttachment(resource: Picked) {
    touch();
    setAttachments((previous) => {
      const next = new Map(previous);
      if (next.has(resource.id)) next.delete(resource.id);
      else next.set(resource.id, resource);
      return next;
    });
  }

  const draftEntries = Object.entries(drafts);
  const incomplete = draftEntries.find(([, draft]) => draft.mode !== "AI_DECIDE" && !draft.resource);
  const knownSlots = groups.flatMap((group) => group.slots.map((slot) => slot.key));
  const inheritedSlots = knownSlots.filter((slot) => !drafts[slot] && inheritedFor(slot));
  const conflicts = (() => {
    const disabled = new Map<string, string>();
    const active = new Map<string, string[]>();
    for (const [slot, draft] of draftEntries) {
      if (!draft.resource) continue;
      if (draft.mode === "DISABLED") disabled.set(draft.resource.id, slot);
      else active.set(draft.resource.id, [...(active.get(draft.resource.id) ?? []), slot]);
    }
    return [...disabled.entries()].filter(([resourceId]) => active.has(resourceId)).map(([resourceId, slot]) => {
      const resource = draftEntries.find(([, draft]) => draft.resource?.id === resourceId)?.[1].resource;
      return t.conflict(resource?.name ?? null, slotLabel(slot, locale), active.get(resourceId)!.map((item) => slotLabel(item, locale)).join(", "));
    });
  })();

  async function save() {
    if (!name.trim()) { goTo(0); return; }
    if (incomplete) {
      const [slot] = incomplete;
      const group = slotGroupOf(slot, locale);
      if (group) setGroupId(group.id);
      // goTo clears the message, so it is set afterwards; otherwise the wizard jumped back without saying why.
      goTo(1);
      setError(t.resourceMissing(slotLabel(slot, locale)));
      return;
    }
    setPending(true);
    setError(null);
    const trimmedDescription = description.trim();
    const resolvedProductType = (productType === "__custom__" ? customProductType : productType).trim();
    const base = { name: name.trim(), stage, platforms, priorities, rules, recipeId, profiles: selectedProfiles, resourceIds: [...attachments.keys()] };
    let payload: Record<string, unknown>;
    if (project) {
      payload = { ...base, description: trimmedDescription || null, productType: resolvedProductType || null };
    } else {
      requestIdRef.current ??= crypto.randomUUID();
      payload = { ...base, clientRequestId: requestIdRef.current };
      if (trimmedDescription) payload.description = trimmedDescription;
      if (resolvedProductType) payload.productType = resolvedProductType;
    }
    try {
      const response = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", {
        method: project ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const failure = await readApiError(response);
        const first = failure.details[0];
        setError(first?.path[0] === "resourceIds"
          ? t.attachmentGone
          : first?.path[0] === "profiles"
            ? t.profileUnavailable
            : failure.details.length > 0 ? t.invalidFields : failure.message);
        return;
      }
      const saved = projectResponseSchema.parse(await response.json()).project;
      const decisionPayload = draftEntries.map(([slot, draft]) => ({
        slot, mode: draft.mode, resourceId: draft.mode === "AI_DECIDE" ? null : draft.resource?.id ?? null,
        constraints: draft.constraints, rationale: draft.rationale, priority: draft.priority, conditions: draft.conditions,
      }));
      const removeSlots = project ? existingSlots.filter((slot) => !drafts[slot]) : [];
      if (decisionPayload.length > 0 || removeSlots.length > 0) {
        const batch = await fetch(`/api/projects/${saved.id}/decisions`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ decisions: decisionPayload, removeSlots }) });
        if (!batch.ok) {
          const failure = await readApiError(batch);
          setError(t.decisionsFailed(failure.message));
          return;
        }
      }
      dirtyRef.current = false;
      onSaved(saved);
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === steps.length - 1) void save();
    else goTo(step + 1);
  }

  const lowered = resourceQuery.trim().toLowerCase();
  const localMatches = libraryItems.filter((resource) => !lowered || resource.name.toLowerCase().includes(lowered) || typeLabels[locale][resource.type].toLowerCase().includes(lowered) || resource.tags.some((tag) => tag.includes(lowered)));
  const candidates = lowered && remote?.query === resourceQuery.trim() ? [...remote.resources, ...localMatches.filter((resource) => !remote.resources.some((item) => item.id === resource.id))] : localMatches;
  const usage = suggestions?.usage ?? {};
  // What the user already used in other projects comes first, then the rest by name.
  const sortedLibrary = [...libraryItems].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name));
  const ownedSlugs = new Set(libraryItems.map(catalogSlugOf).filter((slug): slug is string => slug !== null));
  // Catalog slugs this project already picked, so suggestions that pair with them rise to the top.
  const pickedBySlug = new Map(draftEntries.flatMap(([, draft]) => {
    const slug = draft.resource ? catalogSlugOf(libraryItems.find((item) => item.id === draft.resource?.id)) : null;
    return slug && draft.mode !== "DISABLED" ? [[slug, draft.resource!.name] as const] : [];
  }));

  function rankedSuggestions(slot: string) {
    return (suggestions?.slots[slot] ?? [])
      .filter((item) => !ownedSlugs.has(item.slug))
      .map((item) => {
        const pairedWith = item.pairsWith.find((slug) => pickedBySlug.has(slug));
        return { item, pairedWith: pairedWith ? pickedBySlug.get(pairedWith)! : null, score: item.score + (pairedWith ? 3 : 0) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, shownSuggestions);
  }
  const explicitCount = draftEntries.filter(([, draft]) => draft.mode !== "AI_DECIDE").length;
  const delegatedCount = draftEntries.filter(([, draft]) => draft.mode === "AI_DECIDE").length;
  const productTypeLabel = productType === "__custom__" ? customProductType.trim() : productType;
  const nextLabels = t.nextLabels;
  const titles = [editing ? t.editTitle : t.newTitle, editing ? t.editTitle : t.newTitle, t.rulesTitle, editing ? t.reviewEditTitle : t.reviewNewTitle];
  const leads = [null, null, t.rulesLead, t.reviewLead];

  /** Effective rows for the review table: explicit drafts first, then inherited layers. */
  const reviewRows = [
    ...draftEntries.map(([slot, draft]) => ({ slot, mode: draft.mode, resource: draft.resource, source: t.projectSource })),
    ...inheritedSlots.map((slot) => { const inherited = inheritedFor(slot)!; return { slot, mode: inherited.record.mode, resource: inherited.record.resource ? pick(inherited.record.resource) : null, source: inherited.label }; }),
  ].sort((a, b) => knownSlots.indexOf(a.slot) - knownSlots.indexOf(b.slot));

  function renderSlot(slotKey: string, label: string, hint: string) {
    const draft = drafts[slotKey];
    const inherited = inheritedFor(slotKey);
    const selectedMode = draft?.mode ?? null;
    const resourceId = draft?.resource?.id ?? (inherited?.record.resource && !draft ? inherited.record.resource.id : "");
    const shownResource = draft?.resource ?? (draft ? null : inherited?.record.resource ?? null);
    const suggested = rankedSuggestions(slotKey);
    return (
      <div className={`slot-card${draft ? " decided" : ""}`} key={slotKey}>
        <div className="slot-row">
          <strong>{label}</strong>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {shownResource && <span className="mark small"><TechLogo name={shownResource.name} size={20} slug={catalogSlugFor(shownResource)} /></span>}
            {/* Never disabled: picking a technology on a slot left to the AI makes it a preference instead. */}
            <select aria-busy={adding === slotKey} aria-label={t.slotResource(label)} className="select" disabled={adding === slotKey} onChange={(event) => setSlotResource(slotKey, event.target.value)} value={selectedMode === "AI_DECIDE" ? "" : resourceId}>
              <option value="">{adding === slotKey ? t.addingToLibrary : selectedMode === "AI_DECIDE" ? t.aiWillDecide : hint}</option>
              {draft?.resource && !sortedLibrary.some((item) => item.id === draft.resource?.id) && <option value={draft.resource.id}>{draft.resource.name}{draft.resource.archivedAt ? t.archivedOption : ""}</option>}
              {sortedLibrary.length > 0 && (
                <optgroup label={t.yourLibrary}>
                  {sortedLibrary.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {typeLabels[locale][resource.type]}{usage[resource.id] ? t.usedIn(usage[resource.id]!) : ""}</option>)}
                </optgroup>
              )}
              {suggested.length > 0 && (
                <optgroup label={t.suggestedGroup}>
                  {suggested.map(({ item, pairedWith }) => <option key={item.slug} value={`${catalogOptionPrefix}${item.slug}`}>{item.name} · {suggestionReason(item, pairedWith, locale)}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div aria-label={t.slotMode(label)} className="segmented" role="group">
              {(["LOCKED", "PREFERRED", "AI_DECIDE"] as const).map((mode) => (
                <button aria-pressed={selectedMode === mode} className={mode === "LOCKED" ? "tone-locked" : mode === "PREFERRED" ? "tone-preferred" : "tone-neutral"} key={mode} onClick={() => setSlotMode(slotKey, mode)} type="button"><ModeIcon mode={mode} size={16} />{modeShortLabels[locale][mode]}</button>
              ))}
            </div>
            <RowMenu label={t.moreOptions(label)}>
              <button aria-pressed={selectedMode === "DISABLED"} onClick={() => setSlotMode(slotKey, "DISABLED")} type="button"><ModeIcon mode="DISABLED" size={18} />{t.disabled}</button>
              <button onClick={() => setSlotMode(slotKey, "inherit")} type="button"><X aria-hidden size={18} />{inherited ? t.useInherited : t.clearDecision}</button>
            </RowMenu>
          </div>
        </div>
        {selectedMode === "DISABLED" && <p className="slot-inherit muted"><DecisionBadge mode="DISABLED" size={16} />{t.notUsedHere}</p>}
        {draft?.mode === "AI_DECIDE" && (
          <label className="field">
            <span>{t.aiLimits}</span>
            <input maxLength={500} onChange={(event) => setSlotNotes(slotKey, event.target.value)} placeholder={t.aiLimitsPlaceholder} value={typeof draft.constraints.notes === "string" ? draft.constraints.notes : ""} />
          </label>
        )}
        {inherited
          ? <p className="slot-inherit">{(draft ? t.inheritedOverridden : t.inheritedFrom)(inherited.label, `${modeLabels[locale][inherited.record.mode]}${inherited.record.resource ? ` · ${inherited.record.resource.name}` : ""}`)}</p>
          : <p className="slot-inherit muted">{t.noInherited}</p>}
        <div className="slot-foot">
          <Link className="text-link" href="/workspace/library?add=1" rel="noreferrer" style={{ color: "var(--ink)" }} target="_blank"><Plus aria-hidden size={16} />{t.pickFromLibrary}</Link>
          {sortedLibrary.length === 0 && (
            <small className="muted">{suggested.length > 0
              ? t.emptyLibraryWithSuggestions
              : t.emptyLibrary}</small>
          )}
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="wizard-page" role="region">
      <Breadcrumb items={[{ label: t.breadcrumb, href: "/workspace/projects" }, { label: editing ? project.name : t.newTitle }]} />
      <div className="page-head">
        <div>
          <h1 className="page-title" id={`${id}-title`} ref={headingRef} tabIndex={-1}>{titles[step]}</h1>
          {leads[step] && <p className="page-lead">{leads[step]}</p>}
        </div>
        <button aria-label={t.closeWizard} className="icon-button" onClick={requestClose} type="button"><X aria-hidden size={26} /></button>
      </div>
      <ol aria-label={t.stepsLabel} className="stepper">
        {steps.map((stepId, index) => (
          <li className={index === step ? "current" : index < step ? "done" : ""} key={stepId}>
            <button aria-current={index === step ? "step" : undefined} disabled={index > 0 && !name.trim()} onClick={() => goTo(index)} type="button">
              <span className="step-index">{index < step ? <Check aria-hidden size={14} weight="bold" /> : index + 1}</span>{t.steps[index]}
            </button>
            {index < steps.length - 1 && <span aria-hidden="true" className="step-line" />}
          </li>
        ))}
      </ol>
      <form className="wizard" noValidate onSubmit={handleSubmit}>
        <div className={`wizard-main${step === 3 ? " plain" : ""}`}>
          {step === 0 && (
            <>
              <h2>{t.whatBuilding}</h2>
              <label className="field">
                <span>{t.projectName}</span>
                <input aria-describedby={nameError ? `${id}-name-error` : undefined} aria-invalid={nameError ? true : undefined} autoFocus maxLength={160} onChange={(event) => { touch(); setName(event.target.value); setNameError(null); }} required value={name} />
                {nameError && <p className="form-error" id={`${id}-name-error`} role="alert">{nameError}</p>}
              </label>
              <label className="field">
                <span>{t.projectDescription}</span>
                <textarea maxLength={4000} onChange={(event) => { touch(); setDescription(event.target.value); }} placeholder={t.descriptionPlaceholder} rows={3} value={description} />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>{t.productType}</span>
                  <select aria-label={t.productType} className="select" onChange={(event) => { touch(); setProductType(event.target.value); }} value={productTypes.includes(productType) || productType === "" || productType === "__custom__" ? productType : "__custom__"}>
                    <option value="">{t.choose}</option>
                    {productTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                    <option value="__custom__">{t.other}</option>
                  </select>
                  {(productType === "__custom__" || (productType !== "" && !productTypes.includes(productType))) && <input aria-label={t.customProductType} maxLength={100} onChange={(event) => { touch(); setProductType("__custom__"); setCustomProductType(event.target.value); }} placeholder={t.customProductTypePlaceholder} value={productType === "__custom__" ? customProductType : productType} />}
                </label>
                <label className="field">
                  <span>{t.stage}</span>
                  <select aria-label={t.stage} className="select" onChange={(event) => { touch(); setStage(event.target.value as ProjectStage); }} value={stage}>
                    {(Object.keys(stageLabels[locale]) as ProjectStage[]).map((option) => <option key={option} value={option}>{stageLabels[locale][option]}</option>)}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>{t.starterRecipe}</span>
                <select aria-label={t.starterRecipe} className="select" onChange={(event) => { touch(); setRecipeId(event.target.value || null); }} value={recipeId ?? ""}>
                  <option value="">{t.noRecipe}</option>
                  {project?.recipe && !recipes.some((item) => item.id === project.recipe?.id) && <option value={project.recipe.id}>{project.recipe.name}{project.recipe.archivedAt ? t.archivedOption : ""}</option>}
                  {recipes.map((item) => <option key={item.id} value={item.id}>{item.name} · {t.decisions(item.decisionCount)} · {t.profiles(item.profileCount)}</option>)}
                </select>
                <small>{activeRecipe ? t.recipeApplied(activeRecipe.name, activeRecipe.decisions.length, activeRecipe.profiles.length) : recipes.length === 0 ? t.noRecipes : t.recipeByReference}</small>
              </label>
              <details className="disclosure" open={selectedProfiles.length > 0}>
                <summary style={{ color: "var(--locked)" }}>{t.pickProfiles} <CaretDown aria-hidden size={16} /></summary>
                <div className="disclosure-body">
                  {profiles.length === 0 && selectedProfiles.length === 0 ? (
                    <p className="note">{t.noProfilesBefore}<Link className="text-link" href="/workspace/profiles?new=1">{t.noProfilesLink}</Link>{t.noProfilesAfter}</p>
                  ) : (
                    <ul className="check-list">
                      {[...profiles, ...(project?.profiles ?? []).filter((attached) => !profiles.some((item) => item.id === attached.id)).map((attached) => ({ id: attached.id, name: attached.name, type: attached.type, description: null, decisionCount: (profileDetails[attached.id] ?? []).length, archivedAt: attached.archivedAt }))].map((profile) => {
                        const selection = selectedProfiles.find((item) => item.profileId === profile.id);
                        return (
                          <li key={profile.id}>
                            <label className="check-item">
                              <input checked={Boolean(selection)} onChange={() => toggleProfile(profile.id)} type="checkbox" />
                              <span className="grow"><strong>{profile.name}</strong> <small>· {profileTypeLabels[locale][profile.type]} · {t.decisions(profile.decisionCount)}{profile.archivedAt ? t.archivedSuffix : ""}</small></span>
                              {selection && <span className="priority" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><small className="muted">{t.priority}</small><input aria-label={t.profilePriority(profile.name)} className="input" max={1000} min={-1000} onChange={(event) => { touch(); setSelectedProfiles((previous) => previous.map((item) => item.profileId === profile.id ? { ...item, priority: Number(event.target.value) || 0 } : item)); }} style={{ width: 80, minHeight: 36, padding: "4px 8px" }} type="number" value={selection.priority} /></span>}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="muted small">{t.priorityNote}</p>
                </div>
              </details>
              <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 12 }}>
                <legend className="field-label" style={{ fontSize: 18, fontWeight: 600 }}>{t.freedom}</legend>
                <div className="radio-grid three">
                  {presets.map((option) => (
                    <label className={`radio-card tone-success${preset === option ? " selected" : ""}`} key={option} style={{ background: "var(--surface)" }}>
                      <input checked={preset === option} name={`${id}-preset`} onChange={() => applyPreset(option)} type="radio" value={option} />
                      <strong>{presetCopy[locale][option].label}</strong>
                      <span>{presetCopy[locale][option].text}</span>
                    </label>
                  ))}
                </div>
                <small className="muted">{t.freedomNote}</small>
              </fieldset>
              <details className="disclosure" open={platforms.length !== 1 || platforms[0] !== "web" || priorities.length > 0}>
                <summary><CaretDown aria-hidden size={18} />{t.platformsAndPriorities}</summary>
                <div className="disclosure-body">
                  <ChipField addLabel={t.addPlatform} hint={t.platformsHint} legend={t.platforms} onChange={(next) => { touch(); setPlatforms(next); }} suggestions={suggestedPlatforms} values={platforms} />
                  <ChipField addLabel={t.addPriority} hint={t.prioritiesHint} legend={t.priorities} onChange={(next) => { touch(); setPriorities(next); }} suggestions={suggestedPriorities} values={priorities} />
                </div>
              </details>
            </>
          )}

          {step === 1 && (
            <>
              <div aria-label={t.techGroups} className="tech-tabs" role="tablist">
                {groups.map((group) => <button aria-controls={`${id}-technology-panel`} aria-selected={group.id === groupId} id={`${id}-tab-${group.id}`} key={group.id} onClick={() => setGroupId(group.id)} role="tab" type="button">{group.label}</button>)}
              </div>
              <p className="muted">{t.techIntro}</p>
              <div aria-labelledby={`${id}-tab-${groupId}`} id={`${id}-technology-panel`} role="tabpanel" style={{ display: "grid", gap: 16 }}>
                {activeGroup.slots.map((slot) => renderSlot(slot.key, slot.label, slot.hint))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2>{t.engineeringRules}</h2>
                <p className="muted" style={{ marginTop: 6 }}>{t.oneRulePerLine}</p>
              </div>
              <label className="field">
                <span className="visually-hidden">{t.engineeringRules}</span>
                <textarea maxLength={rulesTextLimit} onChange={(event) => { touch(); setRulesText(event.target.value); }} placeholder={t.rulesPlaceholder} rows={7} value={rulesText} />
                <span aria-hidden="true" className="counter">{rulesText.length} / {rulesTextLimit}{rules.length >= rulesLimit ? t.rulesLimit(rulesLimit) : ""}</span>
              </label>
              <div style={{ display: "grid", gap: 14, maxWidth: 480 }}>
                <h2>{t.references}</h2>
                <div className="search">
                  <MagnifyingGlass aria-hidden size={20} />
                  <input aria-label={t.searchResources} onChange={(event) => setResourceQuery(event.target.value)} placeholder={t.searchResourcesPlaceholder} value={resourceQuery} />
                </div>
                <ul className="check-list">
                  {candidates.map((resource) => (
                    <li key={resource.id}>
                      <label className="check-item">
                        <input checked={attachments.has(resource.id)} onChange={() => toggleAttachment(pick(resource))} type="checkbox" />
                        <span className="grow">{resource.name}</span>
                        <small>{typeLabels[locale][resource.type]}</small>
                      </label>
                    </li>
                  ))}
                  {[...attachments.values()].filter((item) => !candidates.some((candidate) => candidate.id === item.id)).map((item) => (
                    <li key={item.id}>
                      <label className="check-item">
                        <input checked onChange={() => toggleAttachment(item)} type="checkbox" />
                        <span className="grow">{item.name}</span>
                        <small>{typeLabels[locale][item.type]}{item.archivedAt ? t.archivedSuffix : ""}</small>
                      </label>
                    </li>
                  ))}
                </ul>
                {candidates.length === 0 && (libraryItems.length === 0
                  ? <p className="note">{t.libraryEmpty}</p>
                  : <p className="note">{t.noMatch(resourceQuery.trim())}</p>)}
                <Link className="dashed-button" href="/workspace/library?add=1" rel="noreferrer" target="_blank"><Plus aria-hidden size={18} />{t.addFromLibrary}</Link>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="table-wrap" style={{ marginTop: 0 }}>
                <table aria-label={t.decisionSummary} className="table bordered review-table">
                  <thead><tr><th scope="col">{t.layer}</th><th scope="col">{t.choice}</th><th scope="col">{t.decision}</th><th scope="col">{t.source}</th><th className="actions" scope="col"><span className="visually-hidden">{t.edit}</span></th></tr></thead>
                  <tbody>
                    {reviewRows.length === 0 && <tr><td colSpan={5}><span className="muted">{t.noTechDecisionsReview}</span></td></tr>}
                    {reviewRows.map((row) => (
                      <tr key={row.slot}>
                        <td><div className="identity"><span className="mark plain">{row.resource ? <TechLogo name={row.resource.name} size={26} slug={catalogSlugFor(row.resource)} /> : <Sparkle aria-hidden size={22} />}</span><span>{slotLabel(row.slot, locale)}</span></div></td>
                        <td data-label={t.choice}>{row.resource?.name ?? (row.mode === "AI_DECIDE" ? t.aiWillChoose : "—")}</td>
                        <td data-label={t.decision}><DecisionBadge boxed mode={row.mode} /></td>
                        <td className="muted" data-label={t.source}>{row.source}</td>
                        <td className="actions"><button aria-label={t.editDecision(slotLabel(row.slot, locale))} className="icon-button" onClick={() => { const group = slotGroupOf(row.slot, locale); if (group) setGroupId(group.id); goTo(1); }} type="button"><PencilSimple aria-hidden size={18} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="disclosure" style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-panel)", padding: "0 20px", marginTop: 20 }}>
                <summary><ShieldCheck aria-hidden size={20} />{t.projectRules(rules.length)}<CaretDown aria-hidden size={16} style={{ marginLeft: "auto" }} /></summary>
                <div className="disclosure-body">
                  {rules.length === 0 ? <p className="muted">{t.noRules}</p> : <ul style={{ display: "grid", gap: 8 }}>{rules.map((rule) => <li key={rule}>• {rule}</li>)}</ul>}
                  {attachments.size > 0 && <p className="muted small">{t.referencesList([...attachments.values()].map((item) => item.name).join(", "))}</p>}
                </div>
              </details>
              {conflicts.length > 0 && (
                <div className="warning-panel" role="alert" style={{ marginTop: 20 }}>
                  <h3><Warning aria-hidden size={18} /> {t.conflictsTitle}</h3>
                  <ul>{conflicts.map((message) => <li key={message}><code>{t.conflictCode}</code><span>{message}</span></li>)}</ul>
                  <p>{t.conflictsNote}</p>
                </div>
              )}
            </>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <aside aria-label={t.projectSummary} className="wizard-summary">
          {step === 3 ? <h3 style={{ fontSize: 18 }}>{t.projectSummary}</h3> : <span className="mark xl" style={{ fontSize: 34, fontWeight: 700 }}>{(name.trim() || "?").slice(0, 1).toUpperCase()}</span>}
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{name.trim() || t.untitled}{step === 3 && productTypeLabel && <span className="chip">{productTypeLabel}</span>}</h3>
            <p className="muted" style={{ marginTop: 4 }}>{step === 3 ? <span className="chip">{stageLabels[locale][stage]}</span> : [productTypeLabel, stageLabels[locale][stage]].filter(Boolean).join(" · ")}</p>
          </div>
          <hr className="divider" />
          <div><dt style={{ color: "var(--muted)", fontSize: 14 }}>{t.starterRecipe}</dt><dd style={{ marginTop: 4 }}>{recipeName ?? t.noRecipeInUse}</dd></div>
          {selectedProfiles.length > 0 && <div><dt style={{ color: "var(--muted)", fontSize: 14 }}>{t.profilesTitle}</dt><dd style={{ marginTop: 4 }}>{selectedProfiles.map((item) => profileName(item.profileId)).join(", ")}</dd></div>}
          {step !== 3 && (
            <>
              <hr className="divider" />
              {draftEntries.length > 0 || inheritedSlots.length > 0 ? (
                <ul className="summary-list">
                  {reviewRows.filter((row) => row.resource).slice(0, 5).map((row) => (
                    <li key={row.slot}><span className="mark small plain"><TechLogo name={row.resource!.name} size={20} slug={catalogSlugFor(row.resource!)} /></span><span style={{ minWidth: 0 }}><span className="muted small" style={{ display: "block" }}>{slotLabel(row.slot, locale)}</span>{row.resource!.name}</span></li>
                  ))}
                  {reviewRows.filter((row) => row.resource).length === 0 && <li className="muted small">{t.delegatedOnly(delegatedCount)}</li>}
                </ul>
              ) : <p className="muted small">{t.noTechDecisions}</p>}
              <p className="muted small">{t.counts(explicitCount, delegatedCount, inheritedSlots.length)}{rules.length > 0 ? t.rulesSuffix(rules.length) : ""}{attachments.size > 0 ? t.referencesSuffix(attachments.size) : ""}</p>
              {attachments.size > 0 && (
                <div>
                  <dt style={{ color: "var(--muted)", fontSize: 14 }}>{t.resourceSummary}</dt>
                  <ul className="summary-list" style={{ marginTop: 8 }}>{[...attachments.values()].slice(0, 4).map((item) => <li key={item.id}><span className="mark small plain"><TechLogo name={item.name} size={20} slug={catalogSlugFor(item)} /></span>{item.name}</li>)}</ul>
                </div>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <hr className="divider" />
              <p className="status-label ok" style={{ whiteSpace: "normal", alignItems: "flex-start" }}><CheckCircle aria-hidden size={22} />{t.afterCreate}</p>
            </>
          )}
        </aside>

        <div className="wizard-foot" style={{ gridColumn: "1 / -1" }}>
          {step === 0 ? <button className="button" onClick={requestClose} type="button">{t.cancel}</button> : <button className="button" disabled={pending} onClick={() => goTo(step - 1)} type="button"><ArrowLeft aria-hidden size={18} />{t.back}</button>}
          <div className="right">
            {step < steps.length - 1
              ? <button className="button primary large" type="submit">{nextLabels[step]}<ArrowRight aria-hidden size={18} /></button>
              : <button className="button primary large" disabled={pending} type="submit">{pending ? t.saving : editing ? t.saveChanges : t.create}<ArrowRight aria-hidden size={18} /></button>}
          </div>
        </div>
      </form>
    </section>
  );
}
