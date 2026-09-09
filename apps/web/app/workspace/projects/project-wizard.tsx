"use client";

import {
  profileResponseSchema,
  projectResponseSchema,
  recipeResponseSchema,
  resourceListResponseSchema,
  type DecisionMode,
  type DecisionRecord,
  type ProfileSummary,
  type Project,
  type ProjectDecisionView,
  type ProjectStage,
  type Recipe,
  type RecipeSummary,
  type Resource,
} from "@devcontext/contracts";
import { ArrowLeft, ArrowRight, CaretDown, Check, CheckCircle, MagnifyingGlass, PencilSimple, Plus, ShieldCheck, Sparkle, Warning, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ChipField } from "../../../components/chip-field";
import { DecisionBadge, ModeIcon } from "../../../components/decision-badge";
import { Breadcrumb } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { TechLogo } from "../../../components/tech-logo";
import { modeLabels, modeShortLabels, originLabel, slotGroupOf, slotGroups, slotLabel } from "../../../lib/decision-slots";
import { readApiError } from "../../../lib/errors";
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

const steps = [
  { id: "basics", label: "Proje bilgileri" },
  { id: "technologies", label: "Teknoloji kararları" },
  { id: "rules", label: "Kurallar" },
  { id: "review", label: "Gözden geçir" },
] as const;

const presetCopy: Record<Preset, { label: string; text: string }> = {
  low: { label: "Düşük", text: "AI yalnızca uygulama kurallarında boşlukları doldurur." },
  balanced: { label: "Dengeli", text: "AI, seçtiğin sınırlar içinde makul tercihler yapabilir." },
  high: { label: "Yüksek", text: "AI, daha geniş bir alan içinde tercih yapabilir." },
};

const presetSlots: Record<Preset, string[]> = {
  low: [],
  balanced: [
    "backend.api_style", "backend.architecture", "database.query_layer", "database.cache", "backend.queue", "email.provider",
    "frontend.component.default", "frontend.animation.default", "frontend.icons", "ai.mcp.default", "infra.monitoring.primary", "tooling.cli",
  ],
  high: slotGroups.flatMap((group) => group.slots.map((slot) => slot.key)),
};

const rulesLimit = 30;
const rulesTextLimit = 2000;

function pick(resource: Resource | Project["resources"][number] | NonNullable<DecisionRecord["resource"]>): Picked {
  return { id: resource.id, name: resource.name, type: resource.type, sourceUrl: resource.sourceUrl, archivedAt: resource.archivedAt };
}

function draftFromRecord(record: DecisionRecord): SlotDraft {
  return { mode: record.mode, resource: record.resource ? pick(record.resource) : null, constraints: record.constraints, rationale: record.rationale, priority: record.priority, conditions: record.conditions };
}

function splitRules(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, rulesLimit).map((line) => line.slice(0, 500));
}

export function ProjectWizard({ project, decisions, library, profiles, recipes, globalDecisions, initialRecipeId = null, onClose, onSaved }: {
  project: Project | null;
  /** Existing decisions when editing; empty for a new Project. */
  decisions: ProjectDecisionView[];
  library: Resource[];
  profiles: ProfileSummary[];
  recipes: RecipeSummary[];
  globalDecisions: DecisionRecord[];
  initialRecipeId?: string | null;
  onClose(): void;
  onSaved(project: Project): void;
}) {
  const editing = project !== null;
  const id = useId();
  const [step, setStep] = useState(0);
  const [groupId, setGroupId] = useState(slotGroups[0]!.id);
  const activeGroup = slotGroups.find((group) => group.id === groupId) ?? slotGroups[0]!;
  const [name, setName] = useState(project?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState(project?.description ?? "");
  const [productType, setProductType] = useState(project?.productType ?? "");
  const [customProductType, setCustomProductType] = useState(project?.productType && !suggestedProductTypes.includes(project.productType) ? project.productType : "");
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
        const response = await fetch(`/api/recipes/${recipeId}`, { cache: "no-store", signal: controller.signal });
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

  const profileName = (profileId: string) => profiles.find((item) => item.id === profileId)?.name ?? project?.profiles.find((item) => item.id === profileId)?.name ?? "Profil";
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
    return global ? { record: global, label: "Kütüphane kuralı" } : null;
  }

  function goTo(index: number) {
    if (index > 0 && !name.trim()) {
      setNameError("Devam etmek için projeye bir ad ver.");
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
    if (dirtyRef.current && !window.confirm("Bu projedeki kaydedilmemiş değişiklikler silinsin mi?")) return;
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

  function setSlotResource(slot: string, resourceId: string) {
    touch();
    const resource = library.find((item) => item.id === resourceId);
    setDrafts((previous) => {
      const current = previous[slot] ?? { mode: "PREFERRED" as DecisionMode, resource: null, constraints: {}, rationale: null, priority: 0, conditions: {} };
      if (!resourceId) return { ...previous, [slot]: { ...current, resource: null } };
      return { ...previous, [slot]: { ...current, mode: current.mode === "AI_DECIDE" ? "PREFERRED" : current.mode, resource: resource ? pick(resource) : null } };
    });
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
      const copy = { ...previous };
      for (const slot of presetApplied) if (copy[slot]?.mode === "AI_DECIDE") delete copy[slot];
      for (const slot of presetSlots[next]) if (!copy[slot] && !inheritedFor(slot)) copy[slot] = { mode: "AI_DECIDE", resource: null, constraints: {}, rationale: null, priority: 0, conditions: {} };
      return copy;
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
  const knownSlots = slotGroups.flatMap((group) => group.slots.map((slot) => slot.key));
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
      return `${resource?.name ?? "Bir kaynak"} ${slotLabel(slot)} alanında devre dışı ama ${active.get(resourceId)!.map(slotLabel).join(", ")} alanında seçili.`;
    });
  })();

  async function save() {
    if (!name.trim()) { goTo(0); return; }
    if (incomplete) {
      const [slot] = incomplete;
      setError(`${slotLabel(slot)} için bir kaynak seç veya kararı AI’a bırak.`);
      const group = slotGroupOf(slot);
      if (group) setGroupId(group.id);
      goTo(1);
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
          ? "Bağlı kaynaklardan biri artık Kütüphanende yok."
          : first?.path[0] === "profiles"
            ? "Seçili profillerden biri arşivde ya da kullanılamıyor."
            : failure.details.length > 0 ? "Bazı alanlar geçersiz. Proje bilgilerini kontrol edip tekrar dene." : failure.message);
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
          setError(`Proje kaydedildi ama kararları kaydedilemedi: ${failure.message} Tekrar dene; hiçbir şey çoğaltılmaz.`);
          return;
        }
      }
      dirtyRef.current = false;
      onSaved(saved);
    } catch {
      setError("Proje hizmetine ulaşılamıyor. Tekrar dene.");
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
  const localMatches = library.filter((resource) => !lowered || resource.name.toLowerCase().includes(lowered) || typeLabels[resource.type].toLowerCase().includes(lowered) || resource.tags.some((tag) => tag.includes(lowered)));
  const candidates = lowered && remote?.query === resourceQuery.trim() ? [...remote.resources, ...localMatches.filter((resource) => !remote.resources.some((item) => item.id === resource.id))] : localMatches;
  const sortedLibrary = [...library].sort((a, b) => a.name.localeCompare(b.name));
  const explicitCount = draftEntries.filter(([, draft]) => draft.mode !== "AI_DECIDE").length;
  const delegatedCount = draftEntries.filter(([, draft]) => draft.mode === "AI_DECIDE").length;
  const productTypeLabel = productType === "__custom__" ? customProductType.trim() : productType;
  const nextLabels = ["Teknoloji kararlarına geç", "Kurallara geç", "Gözden geçir"];
  const titles = [editing ? "Projeyi düzenle" : "Yeni proje", editing ? "Projeyi düzenle" : "Yeni proje", "Kurallar ve referanslar", editing ? "Değişiklikleri gözden geçir" : "Projeni oluşturmaya hazırsın."];
  const leads = [null, null, "Projenin sabit kurallarını ve referans kaynaklarını tanımla. Bu bilgiler deterministik talimatların oluşturulmasında kullanılır.", "Seçimlerini ve nereden geldiklerini son kez kontrol et."];

  /** Effective rows for the review table: explicit drafts first, then inherited layers. */
  const reviewRows = [
    ...draftEntries.map(([slot, draft]) => ({ slot, mode: draft.mode, resource: draft.resource, source: "Proje" })),
    ...inheritedSlots.map((slot) => { const inherited = inheritedFor(slot)!; return { slot, mode: inherited.record.mode, resource: inherited.record.resource ? pick(inherited.record.resource) : null, source: inherited.label }; }),
  ].sort((a, b) => knownSlots.indexOf(a.slot) - knownSlots.indexOf(b.slot));

  function renderSlot(slotKey: string, label: string, hint: string) {
    const draft = drafts[slotKey];
    const inherited = inheritedFor(slotKey);
    const selectedMode = draft?.mode ?? null;
    const resourceId = draft?.resource?.id ?? (inherited?.record.resource && !draft ? inherited.record.resource.id : "");
    const shownResource = draft?.resource ?? (draft ? null : inherited?.record.resource ?? null);
    return (
      <div className={`slot-card${draft ? " decided" : ""}`} key={slotKey}>
        <div className="slot-row">
          <strong>{label}</strong>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {shownResource && <span className="mark small"><TechLogo name={shownResource.name} size={20} slug={catalogSlugFor(shownResource)} /></span>}
            <select aria-label={`${label} kaynağı`} className="select" disabled={selectedMode === "AI_DECIDE"} onChange={(event) => setSlotResource(slotKey, event.target.value)} value={selectedMode === "AI_DECIDE" ? "" : resourceId}>
              <option value="">{hint}</option>
              {draft?.resource && !sortedLibrary.some((item) => item.id === draft.resource?.id) && <option value={draft.resource.id}>{draft.resource.name}{draft.resource.archivedAt ? " (arşiv)" : ""}</option>}
              {sortedLibrary.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {typeLabels[resource.type]}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div aria-label={`${label} için karar biçimi`} className="segmented" role="group">
              {(["LOCKED", "PREFERRED", "AI_DECIDE"] as const).map((mode) => (
                <button aria-pressed={selectedMode === mode} className={mode === "LOCKED" ? "tone-locked" : mode === "PREFERRED" ? "tone-preferred" : "tone-neutral"} key={mode} onClick={() => setSlotMode(slotKey, mode)} type="button"><ModeIcon mode={mode} size={16} />{modeShortLabels[mode]}</button>
              ))}
            </div>
            <RowMenu label={`${label} için diğer seçenekler`}>
              <button aria-pressed={selectedMode === "DISABLED"} onClick={() => setSlotMode(slotKey, "DISABLED")} type="button"><ModeIcon mode="DISABLED" size={18} />Devre dışı</button>
              <button onClick={() => setSlotMode(slotKey, "inherit")} type="button"><X aria-hidden size={18} />{inherited ? "Devralınanı kullan" : "Kararı bırak"}</button>
            </RowMenu>
          </div>
        </div>
        {selectedMode === "DISABLED" && <p className="slot-inherit muted"><DecisionBadge mode="DISABLED" size={16} /> bu projede kullanılmayacak.</p>}
        {draft?.mode === "AI_DECIDE" && (
          <label className="field">
            <span>AI için sınırlar</span>
            <input maxLength={500} onChange={(event) => setSlotNotes(slotKey, event.target.value)} placeholder="İzin verilen seçenekler, bütçe, uyumluluk…" value={typeof draft.constraints.notes === "string" ? draft.constraints.notes : ""} />
          </label>
        )}
        {inherited
          ? <p className="slot-inherit">{draft ? `${inherited.label} tercihi (${modeLabels[inherited.record.mode]}${inherited.record.resource ? ` · ${inherited.record.resource.name}` : ""}) projeye özel değiştirildi` : `${inherited.label} tercihinden: ${modeLabels[inherited.record.mode]}${inherited.record.resource ? ` · ${inherited.record.resource.name}` : ""}`}</p>
          : <p className="slot-inherit muted">Devralınan tercih yok</p>}
        <div className="slot-foot">
          <Link className="text-link" href="/workspace/library?add=1" rel="noreferrer" style={{ color: "var(--ink)" }} target="_blank"><Plus aria-hidden size={16} />Kütüphaneden kaynak seç</Link>
          {sortedLibrary.length === 0 && <small className="muted">Kütüphanende aktif kaynak yok; bir kaynak ekle veya kararı AI’a bırak.</small>}
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="wizard-page" role="region">
      <Breadcrumb items={[{ label: "Projeler", href: "/workspace/projects" }, { label: editing ? project.name : "Yeni proje" }]} />
      <div className="page-head">
        <div>
          <h1 className="page-title" id={`${id}-title`} ref={headingRef} tabIndex={-1}>{titles[step]}</h1>
          {leads[step] && <p className="page-lead">{leads[step]}</p>}
        </div>
        <button aria-label="Proje oluşturucuyu kapat" className="icon-button" onClick={requestClose} type="button"><X aria-hidden size={26} /></button>
      </div>
      <ol aria-label="Adımlar" className="stepper">
        {steps.map((item, index) => (
          <li className={index === step ? "current" : index < step ? "done" : ""} key={item.id}>
            <button aria-current={index === step ? "step" : undefined} disabled={index > 0 && !name.trim()} onClick={() => goTo(index)} type="button">
              <span className="step-index">{index < step ? <Check aria-hidden size={14} weight="bold" /> : index + 1}</span>{item.label}
            </button>
            {index < steps.length - 1 && <span aria-hidden="true" className="step-line" />}
          </li>
        ))}
      </ol>
      <form className="wizard" noValidate onSubmit={handleSubmit}>
        <div className={`wizard-main${step === 3 ? " plain" : ""}`}>
          {step === 0 && (
            <>
              <h2>Ne geliştiriyorsun?</h2>
              <label className="field">
                <span>Proje adı *</span>
                <input aria-describedby={nameError ? `${id}-name-error` : undefined} aria-invalid={nameError ? true : undefined} autoFocus maxLength={160} onChange={(event) => { touch(); setName(event.target.value); setNameError(null); }} required value={name} />
                {nameError && <p className="form-error" id={`${id}-name-error`} role="alert">{nameError}</p>}
              </label>
              <label className="field">
                <span>Proje açıklaması</span>
                <textarea maxLength={4000} onChange={(event) => { touch(); setDescription(event.target.value); }} placeholder="Ne yaptığı, kimin için olduğu ve neyin değişmemesi gerektiği…" rows={3} value={description} />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Ürün türü</span>
                  <select aria-label="Ürün türü" className="select" onChange={(event) => { touch(); setProductType(event.target.value); }} value={suggestedProductTypes.includes(productType) || productType === "" || productType === "__custom__" ? productType : "__custom__"}>
                    <option value="">Seç…</option>
                    {suggestedProductTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                    <option value="__custom__">Diğer…</option>
                  </select>
                  {(productType === "__custom__" || (productType !== "" && !suggestedProductTypes.includes(productType))) && <input aria-label="Ürün türü (özel)" maxLength={100} onChange={(event) => { touch(); setProductType("__custom__"); setCustomProductType(event.target.value); }} placeholder="Ürün türünü yaz" value={productType === "__custom__" ? customProductType : productType} />}
                </label>
                <label className="field">
                  <span>Aşama</span>
                  <select aria-label="Aşama" className="select" onChange={(event) => { touch(); setStage(event.target.value as ProjectStage); }} value={stage}>
                    {(Object.keys(stageLabels) as ProjectStage[]).map((option) => <option key={option} value={option}>{stageLabels[option]}</option>)}
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Başlangıç tarifi</span>
                <select aria-label="Başlangıç tarifi" className="select" onChange={(event) => { touch(); setRecipeId(event.target.value || null); }} value={recipeId ?? ""}>
                  <option value="">Tarif kullanma</option>
                  {project?.recipe && !recipes.some((item) => item.id === project.recipe?.id) && <option value={project.recipe.id}>{project.recipe.name}{project.recipe.archivedAt ? " (arşiv)" : ""}</option>}
                  {recipes.map((item) => <option key={item.id} value={item.id}>{item.name} · {pluralCount(item.decisionCount, "karar")} · {pluralCount(item.profileCount, "profil")}</option>)}
                </select>
                <small>{activeRecipe ? `${activeRecipe.name}; ${activeRecipe.decisions.length} karar ve ${activeRecipe.profiles.length} profili referansla katar. Proje seçimlerin onu geçersiz kılar; hiçbir şey kopyalanmaz.` : recipes.length === 0 ? "Henüz tarif yok; profilleri ayrı seçebilir veya tarifsiz devam edebilirsin." : "Tarif referansla uygulanır: sonradan düzenlersen onu kullanan her proje bir sonraki oluşturmada değişikliği alır."}</small>
              </label>
              <details className="disclosure" open={selectedProfiles.length > 0}>
                <summary style={{ color: "var(--locked)" }}>Profilleri ayrı seç <CaretDown aria-hidden size={16} /></summary>
                <div className="disclosure-body">
                  {profiles.length === 0 && selectedProfiles.length === 0 ? (
                    <p className="note">Henüz profil yok. <Link className="text-link" href="/workspace/profiles?new=1">Bir profil oluştur</Link> ya da profil olmadan devam et.</p>
                  ) : (
                    <ul className="check-list">
                      {[...profiles, ...(project?.profiles ?? []).filter((attached) => !profiles.some((item) => item.id === attached.id)).map((attached) => ({ id: attached.id, name: attached.name, type: attached.type, description: null, decisionCount: (profileDetails[attached.id] ?? []).length, archivedAt: attached.archivedAt }))].map((profile) => {
                        const selection = selectedProfiles.find((item) => item.profileId === profile.id);
                        return (
                          <li key={profile.id}>
                            <label className="check-item">
                              <input checked={Boolean(selection)} onChange={() => toggleProfile(profile.id)} type="checkbox" />
                              <span className="grow"><strong>{profile.name}</strong> <small>· {profileTypeLabels[profile.type]} · {pluralCount(profile.decisionCount, "karar")}{profile.archivedAt ? " · arşivde" : ""}</small></span>
                              {selection && <span className="priority" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><small className="muted">Öncelik</small><input aria-label={`${profile.name} önceliği`} className="input" max={1000} min={-1000} onChange={(event) => { touch(); setSelectedProfiles((previous) => previous.map((item) => item.profileId === profile.id ? { ...item, priority: Number(event.target.value) || 0 } : item)); }} style={{ width: 80, minHeight: 36, padding: "4px 8px" }} type="number" value={selection.priority} /></span>}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="muted small">İki profil aynı alanda karar verdiğinde yüksek öncelik kazanır. Proje seçimlerin her zaman profillerin önündedir.</p>
                </div>
              </details>
              <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 12 }}>
                <legend className="field-label" style={{ fontSize: 18, fontWeight: 600 }}>AI’ya bırakılan özgürlük</legend>
                <div className="radio-grid three">
                  {(Object.keys(presetCopy) as Preset[]).map((option) => (
                    <label className={`radio-card tone-success${preset === option ? " selected" : ""}`} key={option} style={{ background: "var(--surface)" }}>
                      <input checked={preset === option} name={`${id}-preset`} onChange={() => applyPreset(option)} type="radio" value={option} />
                      <strong>{presetCopy[option].label}</strong>
                      <span>{presetCopy[option].text}</span>
                    </label>
                  ))}
                </div>
                <small className="muted">Bu seçim karar biçimlerini başlatır; sonraki adımda her tercihi düzenleyebilirsin.</small>
              </fieldset>
              <details className="disclosure" open={platforms.length !== 1 || platforms[0] !== "web" || priorities.length > 0}>
                <summary><CaretDown aria-hidden size={18} />Platformlar ve öncelikler</summary>
                <div className="disclosure-body">
                  <ChipField addLabel="Özel platform ekle" hint="Ürünün çalıştığı yerler. Gerekirse birkaçını seç." legend="Platformlar" onChange={(next) => { touch(); setPlatforms(next); }} suggestions={suggestedPlatforms} values={platforms} />
                  <ChipField addLabel="Özel öncelik ekle" hint="Seçim şansı olduğunda coding agent neyi gözetmeli?" legend="Öncelikler" onChange={(next) => { touch(); setPriorities(next); }} suggestions={suggestedPriorities} values={priorities} />
                </div>
              </details>
            </>
          )}

          {step === 1 && (
            <>
              <div aria-label="Teknoloji grupları" className="tech-tabs" role="tablist">
                {slotGroups.map((group) => <button aria-controls={`${id}-technology-panel`} aria-selected={group.id === groupId} id={`${id}-tab-${group.id}`} key={group.id} onClick={() => setGroupId(group.id)} role="tab" type="button">{group.label}</button>)}
              </div>
              <p className="muted">Seçimleri profilinden alabilir veya projeye özel değiştirebilirsin.</p>
              <div aria-labelledby={`${id}-tab-${groupId}`} id={`${id}-technology-panel`} role="tabpanel" style={{ display: "grid", gap: 16 }}>
                {activeGroup.slots.map((slot) => renderSlot(slot.key, slot.label, slot.hint))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2>Mühendislik kuralları</h2>
                <p className="muted" style={{ marginTop: 6 }}>Her satıra bir kural yaz.</p>
              </div>
              <label className="field">
                <span className="visually-hidden">Mühendislik kuralları</span>
                <textarea maxLength={rulesTextLimit} onChange={(event) => { touch(); setRulesText(event.target.value); }} placeholder={"TypeScript strict mode kullan.\nAPI girdilerini doğrula."} rows={7} value={rulesText} />
                <span aria-hidden="true" className="counter">{rulesText.length} / {rulesTextLimit}{rules.length >= rulesLimit ? ` · en fazla ${rulesLimit} kural` : ""}</span>
              </label>
              <div style={{ display: "grid", gap: 14, maxWidth: 480 }}>
                <h2>Referans kaynaklar</h2>
                <div className="search">
                  <MagnifyingGlass aria-hidden size={20} />
                  <input aria-label="Kaynak ara" onChange={(event) => setResourceQuery(event.target.value)} placeholder="Kaynak ara…" value={resourceQuery} />
                </div>
                <ul className="check-list">
                  {candidates.map((resource) => (
                    <li key={resource.id}>
                      <label className="check-item">
                        <input checked={attachments.has(resource.id)} onChange={() => toggleAttachment(pick(resource))} type="checkbox" />
                        <span className="grow">{resource.name}</span>
                        <small>{typeLabels[resource.type]}</small>
                      </label>
                    </li>
                  ))}
                  {[...attachments.values()].filter((item) => !candidates.some((candidate) => candidate.id === item.id)).map((item) => (
                    <li key={item.id}>
                      <label className="check-item">
                        <input checked onChange={() => toggleAttachment(item)} type="checkbox" />
                        <span className="grow">{item.name}</span>
                        <small>{typeLabels[item.type]}{item.archivedAt ? " · arşivde" : ""}</small>
                      </label>
                    </li>
                  ))}
                </ul>
                {candidates.length === 0 && (library.length === 0
                  ? <p className="note">Kütüphanen boş. Önce bir kaynak ekle ya da referanssız devam et.</p>
                  : <p className="note">“{resourceQuery.trim()}” ile eşleşen aktif kaynak yok.</p>)}
                <Link className="dashed-button" href="/workspace/library?add=1" rel="noreferrer" target="_blank"><Plus aria-hidden size={18} />Kütüphaneden ekle</Link>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="table-wrap" style={{ marginTop: 0 }}>
                <table aria-label="Karar özeti" className="table bordered review-table">
                  <thead><tr><th scope="col">Katman</th><th scope="col">Seçim</th><th scope="col">Karar</th><th scope="col">Kaynak</th><th className="actions" scope="col"><span className="visually-hidden">Düzenle</span></th></tr></thead>
                  <tbody>
                    {reviewRows.length === 0 && <tr><td colSpan={5}><span className="muted">Henüz teknoloji kararı yok. Oluşturduktan sonra teknoloji yığınından ekleyebilirsin.</span></td></tr>}
                    {reviewRows.map((row) => (
                      <tr key={row.slot}>
                        <td><div className="identity"><span className="mark plain">{row.resource ? <TechLogo name={row.resource.name} size={26} slug={catalogSlugFor(row.resource)} /> : <Sparkle aria-hidden size={22} />}</span><span>{slotLabel(row.slot)}</span></div></td>
                        <td data-label="Seçim">{row.resource?.name ?? (row.mode === "AI_DECIDE" ? "AI seçecek" : "—")}</td>
                        <td data-label="Karar"><DecisionBadge boxed mode={row.mode} /></td>
                        <td className="muted" data-label="Kaynak">{row.source}</td>
                        <td className="actions"><button aria-label={`${slotLabel(row.slot)} kararını düzenle`} className="icon-button" onClick={() => { const group = slotGroupOf(row.slot); if (group) setGroupId(group.id); goTo(1); }} type="button"><PencilSimple aria-hidden size={18} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details className="disclosure" style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-panel)", padding: "0 20px", marginTop: 20 }}>
                <summary><ShieldCheck aria-hidden size={20} />{pluralCount(rules.length, "proje kuralı")}<CaretDown aria-hidden size={16} style={{ marginLeft: "auto" }} /></summary>
                <div className="disclosure-body">
                  {rules.length === 0 ? <p className="muted">Kural eklenmedi.</p> : <ul style={{ display: "grid", gap: 8 }}>{rules.map((rule) => <li key={rule}>• {rule}</li>)}</ul>}
                  {attachments.size > 0 && <p className="muted small">Referans kaynaklar: {[...attachments.values()].map((item) => item.name).join(", ")}</p>}
                </div>
              </details>
              {conflicts.length > 0 && (
                <div className="warning-panel" role="alert" style={{ marginTop: 20 }}>
                  <h3><Warning aria-hidden size={18} /> Gözden geçirilecek çakışmalar</h3>
                  <ul>{conflicts.map((message) => <li key={message}><code>ÇAKIŞMA</code><span>{message}</span></li>)}</ul>
                  <p>Hiçbir şey otomatik değişmez. Kararları düzenle ya da kaydedip teknoloji yığınından düzelt.</p>
                </div>
              )}
            </>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <aside aria-label="Proje özeti" className="wizard-summary">
          {step === 3 ? <h3 style={{ fontSize: 18 }}>Proje özeti</h3> : <span className="mark xl" style={{ fontSize: 34, fontWeight: 700 }}>{(name.trim() || "?").slice(0, 1).toUpperCase()}</span>}
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{name.trim() || "Adsız proje"}{step === 3 && productTypeLabel && <span className="chip">{productTypeLabel}</span>}</h3>
            <p className="muted" style={{ marginTop: 4 }}>{step === 3 ? <span className="chip">{stageLabels[stage]}</span> : [productTypeLabel, stageLabels[stage]].filter(Boolean).join(" · ")}</p>
          </div>
          <hr className="divider" />
          <div><dt style={{ color: "var(--muted)", fontSize: 14 }}>Başlangıç tarifi</dt><dd style={{ marginTop: 4 }}>{recipeName ?? "Tarif kullanılmıyor"}</dd></div>
          {selectedProfiles.length > 0 && <div><dt style={{ color: "var(--muted)", fontSize: 14 }}>Profiller</dt><dd style={{ marginTop: 4 }}>{selectedProfiles.map((item) => profileName(item.profileId)).join(", ")}</dd></div>}
          {step !== 3 && (
            <>
              <hr className="divider" />
              {draftEntries.length > 0 || inheritedSlots.length > 0 ? (
                <ul className="summary-list">
                  {reviewRows.filter((row) => row.resource).slice(0, 5).map((row) => (
                    <li key={row.slot}><span className="mark small plain"><TechLogo name={row.resource!.name} size={20} slug={catalogSlugFor(row.resource!)} /></span><span style={{ minWidth: 0 }}><span className="muted small" style={{ display: "block" }}>{slotLabel(row.slot)}</span>{row.resource!.name}</span></li>
                  ))}
                  {reviewRows.filter((row) => row.resource).length === 0 && <li className="muted small">{pluralCount(delegatedCount, "karar")} AI’a bırakıldı</li>}
                </ul>
              ) : <p className="muted small">Henüz teknoloji kararı yok.</p>}
              <p className="muted small">{explicitCount} açık seçim · {delegatedCount} AI’a bırakılan · {inheritedSlots.length} devralınan{rules.length > 0 ? ` · ${pluralCount(rules.length, "kural")}` : ""}{attachments.size > 0 ? ` · ${pluralCount(attachments.size, "referans")}` : ""}</p>
              {attachments.size > 0 && (
                <div>
                  <dt style={{ color: "var(--muted)", fontSize: 14 }}>Kaynak özeti</dt>
                  <ul className="summary-list" style={{ marginTop: 8 }}>{[...attachments.values()].slice(0, 4).map((item) => <li key={item.id}><span className="mark small plain"><TechLogo name={item.name} size={20} slug={catalogSlugFor(item)} /></span>{item.name}</li>)}</ul>
                </div>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <hr className="divider" />
              <p className="status-label ok" style={{ whiteSpace: "normal", alignItems: "flex-start" }}><CheckCircle aria-hidden size={22} />Oluşturduktan sonra AI talimatlarını hazırlayabilirsin.</p>
            </>
          )}
        </aside>

        <div className="wizard-foot" style={{ gridColumn: "1 / -1" }}>
          {step === 0 ? <button className="button" onClick={requestClose} type="button">İptal</button> : <button className="button" disabled={pending} onClick={() => goTo(step - 1)} type="button"><ArrowLeft aria-hidden size={18} />Geri</button>}
          <div className="right">
            {step < steps.length - 1
              ? <button className="button primary large" type="submit">{nextLabels[step]}<ArrowRight aria-hidden size={18} /></button>
              : <button className="button primary large" disabled={pending} type="submit">{pending ? "Kaydediliyor…" : editing ? "Değişiklikleri kaydet" : "Projeyi oluştur"}<ArrowRight aria-hidden size={18} /></button>}
          </div>
        </div>
      </form>
    </section>
  );
}
