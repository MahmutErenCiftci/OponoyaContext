"use client";

import { decisionModeSchema, resourceListResponseSchema, type DecisionMode, type DecisionRecord, type Resource } from "@devcontext/contracts";
import { Info, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useId, useState, type FormEvent } from "react";
import { modeDescriptions, modeLabels, readConstraints, slotLabel, writeConstraints, type DecisionConstraints } from "../lib/decision-slots";
import { readApiError } from "../lib/errors";
import { typeLabels } from "../lib/resource-labels";
import { catalogSlugFor } from "../lib/logos";
import { ChipField } from "./chip-field";
import { ModeIcon } from "./decision-badge";
import { DrawerFrame } from "./drawer";
import { TechLogo } from "./tech-logo";

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
  slot, record, isOverride, library, endpoint, inherited, scopeNote, removeLabel, parseSaved, parseRemoved, onClose, onSaved, onRemoved,
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
}) {
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
  const local = library.filter((resource) => !lowered || resource.name.toLowerCase().includes(lowered) || typeLabels[resource.type].toLowerCase().includes(lowered) || resource.tags.some((tag) => tag.includes(lowered)));
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
      setError("Kütüphanenden bir kaynak seç veya kararı AI’a bırak.");
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
          ? "Bu kaynak arşivde ya da artık kullanılamıyor. Aktif bir kaynak seç."
          : code === "resource_required"
            ? "Bu karar biçimi Kütüphanenden bir kaynak gerektirir."
            : failure.message);
        return;
      }
      onSaved(parseSaved(await response.json()));
    } catch {
      setError("Karar hizmetine ulaşılamıyor. Tekrar dene.");
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
      setError("Karar hizmetine ulaşılamıyor. Tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DrawerFrame
      closeLabel="Karar düzenleyiciyi kapat"
      footer={<>
        {isOverride && <button className="button quiet danger spacer" disabled={pending} onClick={() => void remove()} type="button">{removeLabel}</button>}
        <button className="button" onClick={onClose} type="button">İptal</button>
        <button className="button primary" disabled={pending} type="submit">{pending ? "Kaydediliyor…" : "Kararı kaydet"}</button>
      </>}
      onClose={onClose}
      onSubmit={submit}
      subtitle={<code className="code">{slot}</code>}
      title={`${slotLabel(slot)} kararı`}
      wide
    >
      {inherited && (
        <div className="provenance-strip" role="note">
          <span>Şu an: <strong>{inherited.label}</strong>{isOverride ? " tercihi bu proje kararıyla geçersiz kılındı" : " tercihi geçerli"}</span>
          {isOverride && <button disabled={pending} onClick={() => void remove()} type="button">{removeLabel}</button>}
        </div>
      )}
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 12 }}>
        <legend className="field-label">Karar biçimi</legend>
        <div className="radio-grid">
          {decisionModeSchema.options.map((mode) => (
            <label className={`radio-card ${tone[mode]}${draft.mode === mode ? " selected" : ""}`} key={mode}>
              <input checked={draft.mode === mode} name={`${id}-mode`} onChange={() => setMode(mode)} type="radio" value={mode} />
              <strong>{modeLabels[mode]}</strong>
              <ModeIcon mode={mode} size={20} />
              <span>{modeDescriptions[mode]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {delegated ? (
        <p className="note" role="note"><Info aria-hidden size={20} />Bu kararda kaynak seçilmez. Coding agent aşağıdaki kısıtlar içinde en uygun seçeneği belirler ve gerekçesini yazar.</p>
      ) : (
        <div className="field">
          <label htmlFor={`${id}-resource`}>Kaynak *</label>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {selected && <span className="mark small"><TechLogo name={selected.name} size={20} slug={catalogSlugFor(selected)} /></span>}
              <select aria-label="Kaynak *" className="select" id={`${id}-resource`} onChange={(event) => { const item = options.find((entry) => entry.id === event.target.value); setDraft({ ...draft, resource: item ? { id: item.id, name: item.name, type: item.type, archivedAt: item.archivedAt } : null }); }} value={draft.resource?.id ?? ""}>
                <option value="">Kütüphaneden seç…</option>
                {options.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {typeLabels[resource.type]}{resource.archivedAt ? " (arşiv)" : ""}</option>)}
              </select>
            </div>
            <button aria-expanded={searching} aria-label="Kütüphanede ara" className="icon-button bordered" onClick={() => setSearching(!searching)} type="button"><MagnifyingGlass aria-hidden size={20} /></button>
          </div>
          {searching && <input aria-label="Kütüphanende ara" autoFocus className="input" onChange={(event) => setQuery(event.target.value)} placeholder="Ad, tür veya etiket ara…" value={query} />}
          {draft.resource?.archivedAt && <small style={{ color: "var(--warning)" }}>Bu kaynak Kütüphanende arşivlendi. Koru ya da aktif bir kaynak seç.</small>}
          {library.length === 0 && <small>Kütüphanende aktif kaynak yok. Önce bir kaynak ekle veya kararı AI’a bırak.</small>}
        </div>
      )}

      <ChipField addLabel="İzin verilen seçenek ekle" hint={delegated ? "Agent’ın seçebileceği seçenekler." : "Kaynak kullanılamazsa kabul edilebilir alternatifler."} legend="Kısıtlar" onChange={(allowed) => setConstraints({ allowed })} suggestions={[]} values={draft.constraints.allowed} />
      <ChipField addLabel="Hariç tutulan seçenek ekle" hint="Bu karar için asla kabul edilmeyenler." legend="Hariç tutulanlar" onChange={(excluded) => setConstraints({ excluded })} suggestions={[]} values={draft.constraints.excluded} />
      <label className="field">
        <span>Kısıt notları</span>
        <textarea maxLength={2000} onChange={(event) => setConstraints({ notes: event.target.value })} placeholder="Bütçe, uyumluluk, performans veya operasyon sınırları…" rows={2} value={draft.constraints.notes} />
      </label>
      <label className="field">
        <span>Gerekçe</span>
        <textarea maxLength={500} onChange={(event) => setDraft({ ...draft, rationale: event.target.value })} placeholder="Kararla birlikte dışa aktarılan isteğe bağlı gerekçe." rows={3} value={draft.rationale} />
        <span aria-hidden="true" className="counter">{draft.rationale.length}/500</span>
      </label>
      <p className="note info" role="note"><Info aria-hidden size={20} />{scopeNote}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </DrawerFrame>
  );
}
