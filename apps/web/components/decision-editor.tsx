"use client";

import { decisionModeSchema, resourceListResponseSchema, type AiStatus, type DecisionMode, type DecisionRecord, type ProjectDecisionView, type Resource } from "@devcontext/contracts";
import { Info, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useId, useState, type FormEvent } from "react";
import { modeDescriptions, modeLabels, readConstraints, slotLabel, writeConstraints, type DecisionConstraints } from "../lib/decision-slots";
import { readApiError } from "../lib/errors";
import { defineCopy } from "../lib/i18n";
import { typeLabels } from "../lib/resource-labels";
import { catalogSlugFor } from "../lib/logos";
import { AiSuggestionPanel } from "./ai-suggestion-panel";
import { ChipField } from "./chip-field";
import { AiComingSoon } from "./coming-soon";
import { ModeIcon } from "./decision-badge";
import { DrawerFrame } from "./drawer";
import { useLocale } from "./locale-provider";
import { TechLogo } from "./tech-logo";

const copy = defineCopy({
  tr: {
    pickResource: "Kütüphanenden bir kaynak seç veya kararı AI’a bırak.",
    resourceUnavailable: "Bu kaynak arşivde ya da artık kullanılamıyor. Aktif bir kaynak seç.",
    resourceRequired: "Bu karar biçimi Kütüphanenden bir kaynak gerektirir.",
    unreachable: "Karar hizmetine ulaşılamıyor. Tekrar dene.",
    close: "Karar düzenleyiciyi kapat",
    cancel: "İptal",
    saving: "Kaydediliyor…",
    save: "Kararı kaydet",
    title: (slot: string) => `${slot} kararı`,
    current: "Şu an: ",
    overridden: " tercihi bu proje kararıyla geçersiz kılındı",
    inEffect: " tercihi geçerli",
    mode: "Karar biçimi",
    delegatedNote: "Bu kararda kaynak seçilmez. Coding agent aşağıdaki kısıtlar içinde en uygun seçeneği belirler ve gerekçesini yazar.",
    aiAction: "AI önerisi iste",
    aiText: "Bu karar için AI’dan gerekçeli öneri almak Pro ile V2’de geliyor. O zamana kadar karar, dışa aktardığın talimatlarda coding agent’a bırakılır.",
    aiTitle: "AI karar önerisi",
    resource: "Kaynak *",
    fromLibrary: "Kütüphaneden seç…",
    archivedOption: " (arşiv)",
    searchToggle: "Kütüphanede ara",
    searchInput: "Kütüphanende ara",
    searchPlaceholder: "Ad, tür veya etiket ara…",
    archivedResource: "Bu kaynak Kütüphanende arşivlendi. Koru ya da aktif bir kaynak seç.",
    emptyLibrary: "Kütüphanende aktif kaynak yok. Önce bir kaynak ekle veya kararı AI’a bırak.",
    addAllowed: "İzin verilen seçenek ekle",
    allowedHintDelegated: "Agent’ın seçebileceği seçenekler.",
    allowedHint: "Kaynak kullanılamazsa kabul edilebilir alternatifler.",
    constraints: "Kısıtlar",
    addExcluded: "Hariç tutulan seçenek ekle",
    excludedHint: "Bu karar için asla kabul edilmeyenler.",
    excluded: "Hariç tutulanlar",
    notes: "Kısıt notları",
    notesPlaceholder: "Bütçe, uyumluluk, performans veya operasyon sınırları…",
    rationale: "Gerekçe",
    rationalePlaceholder: "Kararla birlikte dışa aktarılan isteğe bağlı gerekçe.",
  },
  en: {
    pickResource: "Pick a resource from your Library or let AI decide.",
    resourceUnavailable: "This resource is archived or no longer available. Pick an active resource.",
    resourceRequired: "This decision mode needs a resource from your Library.",
    unreachable: "The decision service cannot be reached. Try again.",
    close: "Close decision editor",
    cancel: "Cancel",
    saving: "Saving…",
    save: "Save decision",
    title: (slot: string) => `${slot} decision`,
    current: "Currently: the ",
    overridden: " preference is overridden by this project decision",
    inEffect: " preference applies",
    mode: "Decision mode",
    delegatedNote: "No resource is picked for this decision. The coding agent chooses the best option within the constraints below and writes down why.",
    aiAction: "Request AI suggestion",
    aiText: "Getting a reasoned AI suggestion for this decision arrives with Pro in V2. Until then, the decision is left to the coding agent in the instructions you export.",
    aiTitle: "AI decision suggestion",
    resource: "Resource *",
    fromLibrary: "Choose from Library…",
    archivedOption: " (archived)",
    searchToggle: "Search the Library",
    searchInput: "Search your Library",
    searchPlaceholder: "Search by name, type or tag…",
    archivedResource: "This resource was archived in your Library. Keep it or pick an active resource.",
    emptyLibrary: "Your Library has no active resources. Add a resource first or let AI decide.",
    addAllowed: "Add allowed option",
    allowedHintDelegated: "Options the agent may choose.",
    allowedHint: "Acceptable alternatives if the resource cannot be used.",
    constraints: "Constraints",
    addExcluded: "Add excluded option",
    excludedHint: "Never acceptable for this decision.",
    excluded: "Excluded",
    notes: "Constraint notes",
    notesPlaceholder: "Budget, compliance, performance or operational limits…",
    rationale: "Rationale",
    rationalePlaceholder: "Optional rationale exported with the decision.",
  },
});

export type DecisionResourceRef = { id: string; name: string; type: Resource["type"]; archivedAt: string | null };

export type DecisionDraft = {
  mode: DecisionMode;
  resource: DecisionResourceRef | null;
  constraints: DecisionConstraints;
  rationale: string;
};

export function draftFromRecord(record: DecisionRecord | null, constraints: DecisionConstraints): DecisionDraft {
  return {
    mode: record?.mode ?? "PREFERRED",
    resource: record?.resource ? { id: record.resource.id, name: record.resource.name, type: record.resource.type, archivedAt: record.resource.archivedAt } : null,
    constraints,
    rationale: record?.rationale ?? "",
  };
}

const tone: Record<DecisionMode, string> = { LOCKED: "tone-locked", PREFERRED: "tone-preferred", AI_DECIDE: "tone-neutral", DISABLED: "tone-neutral" };

/**
 * Drawer for one decision slot, shared by Projects, Profiles and Recipes: the
 * caller supplies the endpoint and how to read the saved/removed responses so
 * the editing experience stays identical across scopes. AI_DECIDE clears the
 * resource and saves `resourceId: null`; every other mode needs a resource.
 */
export function DecisionEditor<TSaved, TRemoved>({
  slot, record, isOverride, library, endpoint, inherited, scopeNote, removeLabel, parseSaved, parseRemoved, onClose, onSaved, onRemoved, ai,
}: {
  slot: string;
  /** Decision currently shown for the slot (explicit or inherited); null for a new slot. */
  record: DecisionRecord | null;
  /** Whether `record` is an explicit decision at this scope (enables removal). */
  isOverride: boolean;
  library: Resource[];
  endpoint: string;
  /** Provenance of the decision currently in effect, when it comes from another layer. */
  inherited?: { label: string } | undefined;
  /** One sentence about where this decision is saved and what happens next. */
  scopeNote: string;
  removeLabel: string;
  parseSaved(body: unknown): TSaved;
  parseRemoved(body: unknown): TRemoved;
  onClose(): void;
  onSaved(result: TSaved): void;
  onRemoved(result: TRemoved): void;
  /** Project scope only: AI proposals for a slot that is currently delegated. */
  ai?: { projectId: string; status: AiStatus; onAccepted(view: ProjectDecisionView): void } | undefined;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const id = useId();
  const [draft, setDraft] = useState<DecisionDraft>(() => draftFromRecord(record, readConstraints(record?.constraints ?? {})));
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [remote, setRemote] = useState<{ query: string; resources: Resource[] } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const delegated = draft.mode === "AI_DECIDE";

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ archived: "active", limit: "50", q: trimmed });
        const response = await fetch(`/api/resources?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        setRemote({ query: trimmed, resources: resourceListResponseSchema.parse(await response.json()).resources });
      } catch {
        // Aborted or failed searches fall back to the locally loaded Library.
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const lowered = query.trim().toLowerCase();
  const local = library.filter((resource) => !lowered || resource.name.toLowerCase().includes(lowered) || typeLabels[locale][resource.type].toLowerCase().includes(lowered) || resource.tags.some((tag) => tag.includes(lowered)));
  const candidates = lowered && remote?.query === query.trim()
    ? [...remote.resources, ...local.filter((resource) => !remote.resources.some((item) => item.id === resource.id))]
    : local;
  const options: DecisionResourceRef[] = candidates.map((item) => ({ id: item.id, name: item.name, type: item.type, archivedAt: item.archivedAt }));
  if (draft.resource && !options.some((item) => item.id === draft.resource?.id)) options.unshift(draft.resource);
  const selected = draft.resource ? library.find((item) => item.id === draft.resource?.id) ?? null : null;

  function setMode(mode: DecisionMode) {
    setDraft({ ...draft, mode, resource: mode === "AI_DECIDE" ? null : draft.resource });
  }

  function setConstraints(patch: Partial<DecisionConstraints>) {
    setDraft({ ...draft, constraints: { ...draft.constraints, ...patch } });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.mode !== "AI_DECIDE" && !draft.resource) {
      setError(t.pickResource);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: draft.mode,
          resourceId: draft.mode === "AI_DECIDE" ? null : draft.resource?.id ?? null,
          constraints: writeConstraints(draft.constraints),
          rationale: draft.rationale.trim() || null,
          priority: isOverride ? record?.priority ?? 0 : 0,
          conditions: isOverride ? record?.conditions ?? {} : {},
        }),
      });
      if (!response.ok) {
        const failure = await readApiError(response);
        const code = failure.details[0]?.code;
        setError(code === "resource_unavailable"
          ? t.resourceUnavailable
          : code === "resource_required"
            ? t.resourceRequired
            : failure.message);
        return;
      }
      onSaved(parseSaved(await response.json()));
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      if (!response.ok) {
        setError((await readApiError(response)).message);
        return;
      }
      onRemoved(parseRemoved(await response.json()));
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <DrawerFrame
      closeLabel={t.close}
      footer={<>
        {isOverride && <button className="button quiet danger spacer" disabled={pending} onClick={() => void remove()} type="button">{removeLabel}</button>}
        <button className="button" onClick={onClose} type="button">{t.cancel}</button>
        <button className="button primary" disabled={pending} type="submit">{pending ? t.saving : t.save}</button>
      </>}
      onClose={onClose}
      onSubmit={submit}
      subtitle={<code className="code">{slot}</code>}
      title={t.title(slotLabel(slot, locale))}
      wide
    >
      {inherited && (
        <div className="provenance-strip" role="note">
          <span>{t.current}<strong>{inherited.label}</strong>{isOverride ? t.overridden : t.inEffect}</span>
          {isOverride && <button disabled={pending} onClick={() => void remove()} type="button">{removeLabel}</button>}
        </div>
      )}
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 12 }}>
        <legend className="field-label">{t.mode}</legend>
        <div className="radio-grid">
          {decisionModeSchema.options.map((mode) => (
            <label className={`radio-card ${tone[mode]}${draft.mode === mode ? " selected" : ""}`} key={mode}>
              <input checked={draft.mode === mode} name={`${id}-mode`} onChange={() => setMode(mode)} type="radio" value={mode} />
              <strong>{modeLabels[locale][mode]}</strong>
              <ModeIcon mode={mode} size={20} />
              <span>{modeDescriptions[locale][mode]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {delegated ? (
        <>
          <p className="note" role="note"><Info aria-hidden size={20} />{t.delegatedNote}</p>
          {ai?.status.available
            ? record?.mode === "AI_DECIDE" && <AiSuggestionPanel onAccepted={ai.onAccepted} projectId={ai.projectId} slot={slot} status={ai.status} />
            : <AiComingSoon action={t.aiAction} text={t.aiText} title={t.aiTitle} />}
        </>
      ) : (
        <div className="field">
          <label htmlFor={`${id}-resource`}>{t.resource}</label>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {selected && <span className="mark small"><TechLogo name={selected.name} size={20} slug={catalogSlugFor(selected)} /></span>}
              <select aria-label={t.resource} className="select" id={`${id}-resource`} onChange={(event) => { const item = options.find((entry) => entry.id === event.target.value); setDraft({ ...draft, resource: item ? { id: item.id, name: item.name, type: item.type, archivedAt: item.archivedAt } : null }); }} value={draft.resource?.id ?? ""}>
                <option value="">{t.fromLibrary}</option>
                {options.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {typeLabels[locale][resource.type]}{resource.archivedAt ? t.archivedOption : ""}</option>)}
              </select>
            </div>
            <button aria-expanded={searching} aria-label={t.searchToggle} className="icon-button bordered" onClick={() => setSearching(!searching)} type="button"><MagnifyingGlass aria-hidden size={20} /></button>
          </div>
          {searching && <input aria-label={t.searchInput} autoFocus className="input" onChange={(event) => setQuery(event.target.value)} placeholder={t.searchPlaceholder} value={query} />}
          {draft.resource?.archivedAt && <small style={{ color: "var(--warning)" }}>{t.archivedResource}</small>}
          {library.length === 0 && <small>{t.emptyLibrary}</small>}
        </div>
      )}

      <ChipField addLabel={t.addAllowed} hint={delegated ? t.allowedHintDelegated : t.allowedHint} legend={t.constraints} onChange={(allowed) => setConstraints({ allowed })} suggestions={[]} values={draft.constraints.allowed} />
      <ChipField addLabel={t.addExcluded} hint={t.excludedHint} legend={t.excluded} onChange={(excluded) => setConstraints({ excluded })} suggestions={[]} values={draft.constraints.excluded} />
      <label className="field">
        <span>{t.notes}</span>
        <textarea maxLength={2000} onChange={(event) => setConstraints({ notes: event.target.value })} placeholder={t.notesPlaceholder} rows={2} value={draft.constraints.notes} />
      </label>
      <label className="field">
        <span>{t.rationale}</span>
        <textarea maxLength={500} onChange={(event) => setDraft({ ...draft, rationale: event.target.value })} placeholder={t.rationalePlaceholder} rows={3} value={draft.rationale} />
        <span aria-hidden="true" className="counter">{draft.rationale.length}/500</span>
      </label>
      <p className="note info" role="note"><Info aria-hidden size={20} />{scopeNote}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </DrawerFrame>
  );
}
