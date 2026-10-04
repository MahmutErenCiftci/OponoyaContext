"use client";

import { Archive, ArrowCounterClockwise, ArrowSquareOut, CaretDown, MagnifyingGlass, PencilSimple, Plus, Star, Tray, X } from "@phosphor-icons/react/dist/ssr";
import {
  compatibilityRuleListResponseSchema,
  compatibilityRuleResponseSchema,
  resourceListResponseSchema,
  resourceMutationResponseSchema,
  resourceTypeSchema,
  type CompatibilityRule,
  type GlobalPreferenceMode,
  type Resource,
  type ResourceDuplicate,
  type ResourceType,
} from "@devcontext/contracts";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { DecisionBadge, ModeIcon, NoRuleBadge } from "../../../components/decision-badge";
import { DrawerFrame } from "../../../components/drawer";
import { PageHead } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { TechLogo } from "../../../components/tech-logo";
import { useLocale } from "../../../components/locale-provider";
import { modeLabels } from "../../../lib/decision-slots";
import { readApiError, responseError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";
import { catalogSlugFor } from "../../../lib/logos";
import { typeLabels } from "../../../lib/resource-labels";

type LibraryView = "active" | "favorites" | "archived";

/** Rows per request; the API caps a page at 100. */
const pageSize = 50;
type PreferenceFilter = "" | GlobalPreferenceMode;
type GlobalChoice = "NONE" | GlobalPreferenceMode;

const suggestedSlots: Record<ResourceType, string> = {
  language: "frontend.language", framework: "frontend.framework", runtime: "runtime.primary",
  database: "database.primary", orm: "database.query_layer", auth: "auth.provider", storage: "storage.object",
  cache: "database.cache", queue: "backend.queue", ui_library: "frontend.ui.base",
  component: "frontend.component.default", theme: "frontend.theme.default", design_system: "frontend.design_system",
  animation: "frontend.animation.default", icon_library: "frontend.icons", repository: "project.starter",
  boilerplate: "project.boilerplate", template: "project.template", prompt: "ai.prompt.default",
  ai_coding_tool: "ai.coding.primary", ai_builder: "ai.builder.primary", mcp: "ai.mcp.default",
  cli: "tooling.cli", deployment: "infra.deployment.primary", monitoring: "infra.monitoring.primary",
  service: "backend.service.default", architecture: "backend.architecture", rule: "custom.coding_rule",
  reference: "custom.reference",
};

const copy = defineCopy({
  tr: {
    choices: {
      LOCKED: { label: "Kilitli", text: "Bu kaynağı tüm projelerde zorunlu olarak kullan; AI değiştirmesin." },
      PREFERRED: { label: "Tercih edilen", text: "Bu kaynağı tercih ederim; gerekirse alternatif seçilebilir." },
      NONE: { label: "Varsayılan kural yok", text: "Kütüphane kaydı bir genel karar dayatmaz." },
      DISABLED: { label: "Devre dışı", text: "Bu kaynağı projelerde kullanmak istemem." },
    } as Record<GlobalChoice, { label: string; text: string }>,
    ruleTargetUnavailable: "Bu kaynak arşivde ya da kullanılamıyor.",
    ruleSaveFailed: "Kural kaydedilemedi. Tekrar dene.",
    ruleRemoveFailed: "Kural kaldırılamadı. Tekrar dene.",
    rulesTitle: "Uyumluluk kuralları",
    rulesHelp: "Uyumluluk kuralları derleme sırasında uyarı verir; tercihlerini değiştirmez.",
    rulesLoading: "Kurallar yükleniyor…",
    rulesEmpty: "Bu kaynakla ilgili uyumluluk kuralı yok.",
    ruleConflictsJoin: "ile birlikte kullanılamaz:",
    ruleRequiresJoin: "şunu gerektirir:",
    removeRule: (left: string, conflicts: boolean, right: string) => `Kuralı kaldır: ${left} ${conflicts ? "birlikte kullanılamaz" : "gerektirir"} ${right}`,
    rule: "Kural",
    conflicts: "Birlikte kullanılamaz",
    requires: "Gerektirir",
    otherResource: "Diğer kaynak",
    choose: "Seç…",
    reason: "Gerekçe (isteğe bağlı)",
    reasonPlaceholder: "MVP’de tek veri deposu.",
    saving: "Kaydediliyor…",
    addRule: "Kural ekle",
    nameRequired: "Kaynağa bir ad ver.",
    serviceUnreachable: "Kaynak hizmetine ulaşılamıyor. Tekrar dene.",
    closeEditor: "Kaynak düzenleyiciyi kapat",
    cancel: "İptal",
    saveResource: "Kaynağı kaydet",
    editResource: "Kaynağı düzenle",
    addResource: "Kaynak ekle",
    sourceLink: "Kaynak bağlantısı",
    name: "Ad *",
    typeRequired: "Tür *",
    slotRequired: "Karar alanı *",
    slotHelp: "Talimatlar derlenirken kullanılan anahtar.",
    slot: "Karar alanı",
    slotUnused: "Genel kural olmadığında kullanılmaz.",
    defaultDecision: "Varsayılan karar",
    tags: "Etiketler",
    tagsHelp: "Etiketleri virgülle ayır.",
    notes: "Notlar",
    notesPlaceholder: "Yeni projelerde varsayılan bileşen kütüphanem.",
    notesHelp: "Bu kaynağa dair ek notlar.",
    advanced: "Gelişmiş bilgiler",
    description: "Açıklama",
    descriptionPlaceholder: "Neden kullandığın ve nereye oturduğu…",
    docsLink: "Dokümantasyon bağlantısı",
    repoLink: "Depo bağlantısı",
    installCommand: "Kurulum komutu",
    installPlaceholder: "pnpm add paket",
    installHelp: "Komut yalnızca metin olarak saklanır; asla çalıştırılmaz.",
    type: "Tür",
    defaultPreference: "Varsayılan tercih",
    noDefaultRule: "Varsayılan kural yok",
    openSource: (name: string) => `${name} kaynağını aç`,
    removeFavorite: (name: string) => `${name} favorilerden kaldır`,
    addFavorite: (name: string) => `${name} favorilere ekle`,
    rowActions: (name: string) => `${name} işlemleri`,
    edit: "Düzenle",
    restore: "Geri yükle",
    archive: "Arşivle",
    refreshFailed: "Kütüphane yenilenemedi.",
    loadMoreFailed: "Daha fazla kaynak yüklenemedi. Tekrar dene.",
    restored: (name: string) => `${name} geri yüklendi.`,
    archived: (name: string) => `${name} arşive taşındı.`,
    libraryUnreachable: "Kütüphane hizmetine ulaşılamıyor. Tekrar dene.",
    favoriteAdded: (name: string) => `${name} favorilere eklendi.`,
    favoriteRemoved: (name: string) => `${name} favorilerden kaldırıldı.`,
    tabAll: "Tümü",
    tabFavorites: "Favoriler",
    tabArchive: "Arşiv",
    lead: "Her projede hatırlanmasını istediğin araçlar ve kurallar.",
    title: "Kütüphane",
    search: "Kaynaklarda ara",
    filterType: "Türe göre filtrele",
    filterPreference: "Tercihe göre filtrele",
    preference: "Tercih",
    view: "Kütüphane görünümü",
    resources: "Kaynaklar",
    resource: "Kaynak",
    actions: "İşlemler",
    emptyArchiveTitle: "Arşiv boş",
    emptyFavoritesTitle: "Henüz favorin yok",
    emptyFilteredTitle: "Eşleşen kaynak yok",
    emptyTitle: "Kütüphanen burada başlıyor",
    emptyArchiveText: "Arşivlediğin kaynakları buradan geri yükleyebilirsin.",
    emptyFavoritesText: "Sık kullandığın kaynakları yıldızlayarak burada topla.",
    emptyFilteredText: "Başka bir sözcük dene veya filtreleri temizle.",
    emptyText: "AI’ın hatırlamasını istediğin bir framework, veritabanı, bileşen veya kural ekle.",
    addFirst: "İlk kaynağını ekle",
    clearFilters: "Filtreleri temizle",
    catalogPrefix: "Ya da ",
    catalogLink: "katalogdan ekle",
    catalogSuffix: ".",
    loading: "Yükleniyor…",
    showMore: (left: number) => `Daha fazla göster (${left} kaldı)`,
    showingPart: (shown: number, total: number) => `${total} kaynaktan ${shown} tanesi gösteriliyor`,
    showingAll: (total: number) => `${total} kaynak gösteriliyor`,
    duplicateUrl: "Aynı kaynak bağlantısı:",
    duplicateName: "Aynı ad ve tür:",
    savedDuplicate: (name: string) => `${name} kaydedildi; mevcut bir kaynağın kopyası olabilir. İkisi de korundu, aşağıdan incele.`,
    saved: (name: string) => `${name} Kütüphanene kaydedildi.`,
  },
  en: {
    choices: {
      LOCKED: { label: "Locked", text: "Use this resource in every project; the AI must not change it." },
      PREFERRED: { label: "Preferred", text: "I prefer this resource; an alternative may be chosen when needed." },
      NONE: { label: "No default rule", text: "The Library entry does not impose a global decision." },
      DISABLED: { label: "Disabled", text: "I don't want this resource used in my projects." },
    },
    ruleTargetUnavailable: "This resource is archived or unavailable.",
    ruleSaveFailed: "The rule could not be saved. Try again.",
    ruleRemoveFailed: "The rule could not be removed. Try again.",
    rulesTitle: "Compatibility rules",
    rulesHelp: "Compatibility rules raise warnings when instructions are compiled; they don't change your preferences.",
    rulesLoading: "Loading rules…",
    rulesEmpty: "No compatibility rules for this resource.",
    ruleConflictsJoin: "can't be used with",
    ruleRequiresJoin: "requires",
    removeRule: (left: string, conflicts: boolean, right: string) => `Remove rule: ${left} ${conflicts ? "can't be used with" : "requires"} ${right}`,
    rule: "Rule",
    conflicts: "Can't be used with",
    requires: "Requires",
    otherResource: "Other resource",
    choose: "Choose…",
    reason: "Reason (optional)",
    reasonPlaceholder: "A single data store for the MVP.",
    saving: "Saving…",
    addRule: "Add rule",
    nameRequired: "Give the resource a name.",
    serviceUnreachable: "The resource service can't be reached. Try again.",
    closeEditor: "Close the resource editor",
    cancel: "Cancel",
    saveResource: "Save resource",
    editResource: "Edit resource",
    addResource: "Add resource",
    sourceLink: "Resource link",
    name: "Name *",
    typeRequired: "Type *",
    slotRequired: "Decision slot *",
    slotHelp: "The key used when instructions are compiled.",
    slot: "Decision slot",
    slotUnused: "Not used when there is no global rule.",
    defaultDecision: "Default decision",
    tags: "Tags",
    tagsHelp: "Separate tags with commas.",
    notes: "Notes",
    notesPlaceholder: "My default component library for new projects.",
    notesHelp: "Extra notes about this resource.",
    advanced: "Advanced details",
    description: "Description",
    descriptionPlaceholder: "Why you use it and where it fits…",
    docsLink: "Documentation link",
    repoLink: "Repository link",
    installCommand: "Install command",
    installPlaceholder: "pnpm add package",
    installHelp: "The command is stored as text only; it is never run.",
    type: "Type",
    defaultPreference: "Default preference",
    noDefaultRule: "No default rule",
    openSource: (name: string) => `Open the ${name} link`,
    removeFavorite: (name: string) => `Remove ${name} from favorites`,
    addFavorite: (name: string) => `Add ${name} to favorites`,
    rowActions: (name: string) => `${name} actions`,
    edit: "Edit",
    restore: "Restore",
    archive: "Archive",
    refreshFailed: "The Library could not be refreshed.",
    loadMoreFailed: "More resources could not be loaded. Try again.",
    restored: (name: string) => `${name} restored.`,
    archived: (name: string) => `${name} moved to the archive.`,
    libraryUnreachable: "The Library service can't be reached. Try again.",
    favoriteAdded: (name: string) => `${name} added to favorites.`,
    favoriteRemoved: (name: string) => `${name} removed from favorites.`,
    tabAll: "All",
    tabFavorites: "Favorites",
    tabArchive: "Archive",
    lead: "The tools and rules you want remembered in every project.",
    title: "Library",
    search: "Search resources",
    filterType: "Filter by type",
    filterPreference: "Filter by preference",
    preference: "Preference",
    view: "Library view",
    resources: "Resources",
    resource: "Resource",
    actions: "Actions",
    emptyArchiveTitle: "The archive is empty",
    emptyFavoritesTitle: "No favorites yet",
    emptyFilteredTitle: "No matching resources",
    emptyTitle: "Your Library starts here",
    emptyArchiveText: "You can restore archived resources from here.",
    emptyFavoritesText: "Star the resources you use often to collect them here.",
    emptyFilteredText: "Try another word or clear the filters.",
    emptyText: "Add a framework, database, component or rule you want the AI to remember.",
    addFirst: "Add your first resource",
    clearFilters: "Clear filters",
    catalogPrefix: "Or ",
    catalogLink: "add from the Catalog",
    catalogSuffix: ".",
    loading: "Loading…",
    showMore: (left: number) => `Show more (${left} left)`,
    showingPart: (shown: number, total: number) => `Showing ${shown} of ${total} resources`,
    showingAll: (total: number) => `Showing ${total} ${total === 1 ? "resource" : "resources"}`,
    duplicateUrl: "Same resource link:",
    duplicateName: "Same name and type:",
    savedDuplicate: (name: string) => `${name} saved; it may duplicate an existing resource. Both were kept; review them below.`,
    saved: (name: string) => `${name} saved to your Library.`,
  },
});

/** Global preference choices: LOCKED / PREFERRED / DISABLED or no rule. AI_DECIDE does not exist at Library level. Text comes from `copy.choices`. */
const globalChoices: Array<{ id: GlobalChoice; mode: GlobalPreferenceMode | null; tone: string }> = [
  { id: "LOCKED", mode: "LOCKED", tone: "tone-locked" },
  { id: "PREFERRED", mode: "PREFERRED", tone: "tone-preferred" },
  { id: "NONE", mode: null, tone: "tone-neutral" },
  { id: "DISABLED", mode: "DISABLED", tone: "tone-neutral" },
];

function CompatibilitySection({ resource, library }: { resource: Resource; library: Resource[] }) {
  const locale = useLocale();
  const t = copy[locale];
  const [rules, setRules] = useState<CompatibilityRule[] | null>(null);
  const [kind, setKind] = useState<"conflicts" | "requires">("conflicts");
  const [otherId, setOtherId] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/compatibility-rules?resourceId=${resource.id}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("failed");
        setRules(compatibilityRuleListResponseSchema.parse(await response.json()).rules);
      } catch (failure) {
        if (!(failure instanceof DOMException && failure.name === "AbortError")) setRules([]);
      }
    })();
    return () => controller.abort();
  }, [resource.id]);

  async function add() {
    if (!otherId) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/compatibility-rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, leftResourceId: resource.id, rightResourceId: otherId, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      if (!response.ok) {
        const failure = await readApiError(response);
        setError(failure.details.length > 0 ? t.ruleTargetUnavailable : failure.message);
        return;
      }
      const result = compatibilityRuleResponseSchema.parse(await response.json());
      setRules((previous) => [result.rule, ...(previous ?? []).filter((item) => item.id !== result.rule.id)]);
      setOtherId("");
      setNote("");
    } catch {
      setError(t.ruleSaveFailed);
    } finally {
      setPending(false);
    }
  }

  async function remove(rule: CompatibilityRule) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(`/api/compatibility-rules/${rule.id}`, { method: "DELETE" });
      if (response.ok) setRules((previous) => (previous ?? []).filter((item) => item.id !== rule.id));
      else setError(await responseError(response));
    } catch {
      setError(t.ruleRemoveFailed);
    } finally {
      setPending(false);
    }
  }

  const others = library.filter((item) => item.id !== resource.id);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div><strong className="field-label">{t.rulesTitle}</strong><p className="muted small">{t.rulesHelp}</p></div>
      {rules === null ? <p className="muted small">{t.rulesLoading}</p> : rules.length === 0 ? <p className="note">{t.rulesEmpty}</p> : (
        <ul className="check-list">
          {rules.map((rule) => (
            <li className="check-item" key={rule.id} style={{ cursor: "default" }}>
              <span className="grow"><strong>{rule.left.name}</strong> {rule.kind === "conflicts" ? t.ruleConflictsJoin : t.ruleRequiresJoin} <strong>{rule.right.name}</strong>{rule.note ? <small> · {rule.note}</small> : null}</span>
              <button aria-label={t.removeRule(rule.left.name, rule.kind === "conflicts", rule.right.name)} className="icon-button" onClick={() => void remove(rule)} type="button"><X aria-hidden size={18} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="field-row">
        <label className="field"><span>{t.rule}</span><select aria-label={t.rule} className="select" onChange={(event) => setKind(event.target.value as "conflicts" | "requires")} value={kind}><option value="conflicts">{t.conflicts}</option><option value="requires">{t.requires}</option></select></label>
        <label className="field"><span>{t.otherResource}</span><select aria-label={t.otherResource} className="select" onChange={(event) => setOtherId(event.target.value)} value={otherId}><option value="">{t.choose}</option>{others.map((item) => <option key={item.id} value={item.id}>{item.name} · {typeLabels[locale][item.type]}</option>)}</select></label>
      </div>
      <label className="field"><span>{t.reason}</span><input maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder={t.reasonPlaceholder} value={note} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div><button className="button" disabled={pending || !otherId} onClick={() => void add()} type="button">{pending ? t.saving : t.addRule}</button></div>
    </div>
  );
}

function ResourceEditor({ resource, library, onClose, onSaved }: {
  resource: Resource | null;
  library: Resource[];
  onClose(): void;
  onSaved(result: { resource: Resource; duplicates: ResourceDuplicate[] }): void;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const id = useId();
  const initialType = resource?.type ?? "framework";
  const [name, setName] = useState(resource?.name ?? "");
  const [type, setType] = useState<ResourceType>(initialType);
  const [description, setDescription] = useState(resource?.description ?? "");
  const [sourceUrl, setSourceUrl] = useState(resource?.sourceUrl ?? "");
  const [docsUrl, setDocsUrl] = useState(resource?.docsUrl ?? "");
  const [repoUrl, setRepoUrl] = useState(resource?.repoUrl ?? "");
  const [installCommand, setInstallCommand] = useState(resource?.installCommand ?? "");
  const [notes, setNotes] = useState(resource?.notes ?? "");
  const [tagText, setTagText] = useState(resource?.tags.join(", ") ?? "");
  const [preference, setPreference] = useState<GlobalChoice>(resource ? resource.preference?.mode ?? "NONE" : "PREFERRED");
  const [slot, setSlot] = useState(resource?.preference?.slot ?? suggestedSlots[initialType]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeType(nextType: ResourceType) {
    if (slot === suggestedSlots[type]) setSlot(suggestedSlots[nextType]);
    setType(nextType);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t.nameRequired);
      return;
    }
    setError(null);
    setPending(true);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      type,
      description: description.trim() || (resource ? null : undefined),
      sourceUrl: sourceUrl.trim() || (resource ? null : undefined),
      docsUrl: docsUrl.trim() || (resource ? null : undefined),
      repoUrl: repoUrl.trim() || (resource ? null : undefined),
      installCommand: installCommand.trim() || (resource ? null : undefined),
      notes: notes.trim() || (resource ? null : undefined),
      tags: tagText.split(",").map((tag) => tag.trim()).filter(Boolean),
      metadata: resource?.metadata ?? {},
      preference: preference === "NONE" ? (resource ? null : undefined) : { slot, mode: preference },
    };
    for (const key of Object.keys(payload)) if (payload[key] === undefined) delete payload[key];
    try {
      const response = await fetch(resource ? `/api/resources/${resource.id}` : "/api/resources", {
        method: resource ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      const result = resourceMutationResponseSchema.parse(await response.json());
      onSaved({ resource: result.resource, duplicates: result.duplicates });
    } catch {
      setError(t.serviceUnreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <DrawerFrame
      closeLabel={t.closeEditor}
      footer={<><button className="button" onClick={onClose} type="button">{t.cancel}</button><button className="button primary" disabled={pending} type="submit">{pending ? t.saving : t.saveResource}</button></>}
      onClose={onClose}
      onSubmit={submit}
      title={resource ? t.editResource : t.addResource}
    >
      <label className="field"><span>{t.sourceLink}</span><input data-autofocus={resource ? undefined : true} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" type="url" value={sourceUrl} /></label>
      <label className="field"><span>{t.name}</span><input aria-invalid={error && !name.trim() ? true : undefined} maxLength={160} onChange={(event) => setName(event.target.value)} required value={name} /></label>
      <div className="field-row">
        <label className="field"><span>{t.typeRequired}</span><select aria-label={t.typeRequired} className="select" onChange={(event) => changeType(event.target.value as ResourceType)} value={type}>{resourceTypeSchema.options.map((option) => <option key={option} value={option}>{typeLabels[locale][option]}</option>)}</select></label>
        {preference !== "NONE"
          ? <label className="field"><span>{t.slotRequired}</span><input aria-label={t.slotRequired} className="code" onChange={(event) => setSlot(event.target.value)} pattern="[a-z][a-z0-9_]*(\.[a-z0-9_]+)+" placeholder="frontend.framework" required value={slot} /><small>{t.slotHelp}</small></label>
          : <div className="field"><span>{t.slot}</span><input className="code" disabled value={slot} /><small>{t.slotUnused}</small></div>}
      </div>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 12 }}>
        <legend className="field-label">{t.defaultDecision}</legend>
        <div className="radio-grid">
          {globalChoices.map((choice) => (
            <label className={`radio-card ${choice.tone}${preference === choice.id ? " selected" : ""}`} key={choice.id}>
              <input checked={preference === choice.id} name={`${id}-preference`} onChange={() => setPreference(choice.id)} type="radio" value={choice.id} />
              <strong>{t.choices[choice.id].label}</strong>
              {choice.mode ? <ModeIcon mode={choice.mode} size={20} /> : <span />}
              <span>{t.choices[choice.id].text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field"><span>{t.tags}</span><input onChange={(event) => setTagText(event.target.value)} placeholder="ui, react" value={tagText} /><small>{t.tagsHelp}</small></label>
      <label className="field"><span>{t.notes}</span><textarea maxLength={10000} onChange={(event) => setNotes(event.target.value)} placeholder={t.notesPlaceholder} rows={3} value={notes} /><small>{t.notesHelp}</small></label>
      <details className="disclosure" open={Boolean(resource) || Boolean(docsUrl || repoUrl || installCommand || description)}>
        <summary>{t.advanced} <CaretDown aria-hidden size={18} /></summary>
        <div className="disclosure-body">
          <label className="field"><span>{t.description}</span><textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder={t.descriptionPlaceholder} rows={2} value={description} /></label>
          <div className="field-row">
            <label className="field"><span>{t.docsLink}</span><input onChange={(event) => setDocsUrl(event.target.value)} placeholder="https://…" type="url" value={docsUrl} /></label>
            <label className="field"><span>{t.repoLink}</span><input onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/…" type="url" value={repoUrl} /></label>
          </div>
          <label className="field"><span>{t.installCommand}</span><input className="code" onChange={(event) => setInstallCommand(event.target.value)} placeholder={t.installPlaceholder} value={installCommand} /><small>{t.installHelp}</small></label>
          {resource && <CompatibilitySection library={library} resource={resource} />}
        </div>
      </details>
      {error && <p className="form-error" role="alert">{error}</p>}
    </DrawerFrame>
  );
}

function ResourceRow({ resource, onEdit, onArchive, onRestore, onToggleFavorite }: {
  resource: Resource;
  onEdit(): void;
  onArchive(): void;
  onRestore(): void;
  onToggleFavorite(): void;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const archived = Boolean(resource.archivedAt);
  return (
    <tr className={archived ? "archived" : ""}>
      <td>
        <div className="identity">
          <span className="mark"><TechLogo name={resource.name} size={26} slug={catalogSlugFor(resource)} /></span>
          <div style={{ minWidth: 0 }}>
            <h3>{resource.name}</h3>
            <small>{resource.description || typeLabels[locale][resource.type]}</small>
          </div>
        </div>
      </td>
      <td data-label={t.type}>{typeLabels[locale][resource.type]}</td>
      <td data-label={t.defaultPreference}>{resource.preference ? <DecisionBadge mode={resource.preference.mode} /> : <NoRuleBadge label={t.noDefaultRule} />}</td>
      <td className="actions">
        <div className="row-actions">
          {resource.sourceUrl && <a aria-label={t.openSource(resource.name)} className="icon-button" href={resource.sourceUrl} rel="noreferrer" target="_blank" title={t.sourceLink}><ArrowSquareOut aria-hidden size={20} /></a>}
          {!archived && (
            <button aria-label={resource.favorite ? t.removeFavorite(resource.name) : t.addFavorite(resource.name)} aria-pressed={resource.favorite} className={`star-button${resource.favorite ? " active" : ""}`} onClick={onToggleFavorite} type="button"><Star aria-hidden size={22} weight={resource.favorite ? "fill" : "regular"} /></button>
          )}
          <RowMenu label={t.rowActions(resource.name)}>
            {!archived && <button onClick={onEdit} type="button"><PencilSimple aria-hidden size={18} />{t.edit}</button>}
            {archived
              ? <button onClick={onRestore} type="button"><ArrowCounterClockwise aria-hidden size={18} />{t.restore}</button>
              : <button onClick={onArchive} type="button"><Archive aria-hidden size={18} />{t.archive}</button>}
          </RowMenu>
        </div>
      </td>
    </tr>
  );
}

export function LibraryClient({ initial, openCreateOnLoad, initialSearch, initialView }: {
  initial: { resources: Resource[]; total: number };
  openCreateOnLoad: boolean;
  initialSearch: string;
  initialView: LibraryView;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const [resources, setResources] = useState(initial.resources);
  const [total, setTotal] = useState(initial.total);
  const [search, setSearch] = useState(initialSearch);
  const [type, setType] = useState("");
  const [preference, setPreference] = useState<PreferenceFilter>("");
  const [view, setView] = useState<LibraryView>(initialView);
  const [editor, setEditor] = useState<"closed" | "create" | Resource>(openCreateOnLoad ? "create" : "closed");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState<{ text: string; duplicates?: ResourceDuplicate[] } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), notice.duplicates?.length ? 9_000 : 4_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function syncUrl(values: { search: string; view: LibraryView }) {
    const params = new URLSearchParams();
    if (values.search) params.set("q", values.search);
    if (values.view !== "active") params.set("view", values.view);
    const query = params.toString();
    window.history.replaceState(null, "", `/workspace/library${query ? `?${query}` : ""}`);
  }

  function listParams(values: { search: string; type: string; preference: PreferenceFilter; view: LibraryView }) {
    const params = new URLSearchParams({ archived: values.view === "archived" ? "archived" : "active", limit: String(pageSize) });
    if (values.view === "favorites") params.set("favorite", "true");
    if (values.search) params.set("q", values.search);
    if (values.type) params.set("type", values.type);
    if (values.preference) params.set("preference", values.preference);
    return params;
  }

  async function load(next: { search?: string; type?: string; preference?: PreferenceFilter; view?: LibraryView } = {}) {
    const values = { search: next.search ?? search, type: next.type ?? type, preference: next.preference ?? preference, view: next.view ?? view };
    setLoading(true);
    syncUrl(values);
    try {
      const response = await fetch(`/api/resources?${listParams(values)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load resources");
      const result = resourceListResponseSchema.parse(await response.json());
      setResources(result.resources);
      setTotal(result.total);
    } catch {
      setNotice({ text: t.refreshFailed });
    } finally {
      setLoading(false);
    }
  }

  /** Appends the next page; rows already on screen (after an edit moved them) are not repeated. */
  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const params = listParams({ search, type, preference, view });
      params.set("offset", String(resources.length));
      const response = await fetch(`/api/resources?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load resources");
      const result = resourceListResponseSchema.parse(await response.json());
      setResources((previous) => {
        const seen = new Set(previous.map((item) => item.id));
        return [...previous, ...result.resources.filter((item) => !seen.has(item.id))];
      });
      setTotal(result.total);
    } catch {
      setNotice({ text: t.loadMoreFailed });
    } finally {
      setLoadingMore(false);
    }
  }

  /** One row action at a time: a double click must not archive twice or race a favorite toggle. */
  const busy = useRef(false);

  async function mutate(resource: Resource, action: "archive" | "restore") {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch(`/api/resources/${resource.id}${action === "restore" ? "/restore" : ""}`, { method: action === "restore" ? "POST" : "DELETE" });
      if (!response.ok) {
        setNotice({ text: await responseError(response) });
        return;
      }
      setNotice({ text: action === "restore" ? t.restored(resource.name) : t.archived(resource.name) });
      await load();
    } catch {
      setNotice({ text: t.libraryUnreachable });
    } finally {
      busy.current = false;
    }
  }

  async function toggleFavorite(resource: Resource) {
    if (busy.current) return;
    busy.current = true;
    try {
      const response = await fetch(`/api/resources/${resource.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorite: !resource.favorite }) });
      if (!response.ok) {
        setNotice({ text: await responseError(response) });
        return;
      }
      const result = resourceMutationResponseSchema.parse(await response.json());
      setResources((previous) => previous.map((item) => item.id === result.resource.id ? result.resource : item));
      setNotice({ text: result.resource.favorite ? t.favoriteAdded(resource.name) : t.favoriteRemoved(resource.name) });
      if (view === "favorites" && !result.resource.favorite) void load();
    } catch {
      setNotice({ text: t.libraryUnreachable });
    } finally {
      busy.current = false;
    }
  }

  function switchView(next: LibraryView) {
    setView(next);
    void load({ view: next });
  }

  function clearFilters() {
    setSearch(""); setType(""); setPreference("");
    void load({ search: "", type: "", preference: "" });
  }

  const filtered = Boolean(search || type || preference);
  const tabs: Array<{ id: LibraryView; label: string }> = [{ id: "active", label: t.tabAll }, { id: "favorites", label: t.tabFavorites }, { id: "archived", label: t.tabArchive }];

  return (
    <section className="page">
      <PageHead
        actions={<button className="button primary large" onClick={() => setEditor("create")} type="button"><Plus aria-hidden size={20} />{t.addResource}</button>}
        lead={t.lead}
        title={t.title}
      />
      <div className="toolbar">
        <form className="search" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search">
          <MagnifyingGlass aria-hidden size={20} />
          <input aria-label={t.search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} value={search} />
        </form>
        <select aria-label={t.filterType} className="select inline" onChange={(event) => { setType(event.target.value); void load({ type: event.target.value }); }} value={type}><option value="">{t.type}</option>{resourceTypeSchema.options.map((option) => <option key={option} value={option}>{typeLabels[locale][option]}</option>)}</select>
        <select aria-label={t.filterPreference} className="select inline" onChange={(event) => { const value = event.target.value as PreferenceFilter; setPreference(value); void load({ preference: value }); }} value={preference}><option value="">{t.preference}</option><option value="LOCKED">{modeLabels[locale].LOCKED}</option><option value="PREFERRED">{modeLabels[locale].PREFERRED}</option><option value="DISABLED">{modeLabels[locale].DISABLED}</option></select>
      </div>
      <div aria-label={t.view} className="tabs" role="tablist" style={{ marginTop: 22 }}>
        {tabs.map((tab) => <button aria-selected={view === tab.id} key={tab.id} onClick={() => switchView(tab.id)} role="tab" type="button">{tab.label}</button>)}
      </div>
      {resources.length > 0 && (
        <div className="table-wrap">
          <table aria-label={t.resources} className="table">
            <thead><tr><th scope="col">{t.resource}</th><th scope="col">{t.type}</th><th scope="col">{t.defaultPreference}</th><th className="actions" scope="col"><span className="visually-hidden">{t.actions}</span></th></tr></thead>
            <tbody>
              {resources.map((resource) => <ResourceRow key={resource.id} onArchive={() => void mutate(resource, "archive")} onEdit={() => setEditor(resource)} onRestore={() => void mutate(resource, "restore")} onToggleFavorite={() => void toggleFavorite(resource)} resource={resource} />)}
            </tbody>
          </table>
        </div>
      )}
      {!loading && resources.length === 0 && (
        <div className="empty">
          <span className="mark xl"><Tray aria-hidden size={34} /></span>
          <h2>{view === "archived" ? t.emptyArchiveTitle : view === "favorites" ? t.emptyFavoritesTitle : filtered ? t.emptyFilteredTitle : t.emptyTitle}</h2>
          <p>{view === "archived" ? t.emptyArchiveText : view === "favorites" ? t.emptyFavoritesText : filtered ? t.emptyFilteredText : t.emptyText}</p>
          {view === "active" && !filtered && <button className="button primary" onClick={() => setEditor("create")} type="button">{t.addFirst}</button>}
          {filtered && <button className="button" onClick={clearFilters} type="button">{t.clearFilters}</button>}
          {view === "active" && !filtered && <p className="muted small">{t.catalogPrefix}<Link className="text-link" href="/workspace/catalog">{t.catalogLink}</Link>{t.catalogSuffix}</p>}
        </div>
      )}
      {!loading && resources.length < total && (
        <div className="load-more">
          <button className="button" disabled={loadingMore} onClick={() => void loadMore()} type="button">
            {loadingMore ? t.loading : t.showMore(total - resources.length)}
          </button>
        </div>
      )}
      <p aria-live="polite" className="result-count">{loading ? t.loading : resources.length < total ? t.showingPart(resources.length, total) : t.showingAll(total)}</p>
      {notice && (
        <div className="toast" role="status">
          <span>{notice.text}</span>
          {notice.duplicates && notice.duplicates.length > 0 && (
            <ul>
              {notice.duplicates.map((duplicate) => (
                <li key={`${duplicate.id}-${duplicate.reason}`}>
                  {duplicate.reason === "url" ? t.duplicateUrl : t.duplicateName} <Link href={`/workspace/library?q=${encodeURIComponent(duplicate.name)}`}>{duplicate.name}</Link>{duplicate.sourceUrl ? <small> · {duplicate.sourceUrl}</small> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {editor !== "closed" && (
        <ResourceEditor
          key={editor === "create" ? "create" : editor.id}
          library={resources.filter((item) => !item.archivedAt)}
          onClose={() => setEditor("closed")}
          onSaved={({ resource, duplicates }) => {
            setEditor("closed");
            setNotice(duplicates.length > 0
              ? { text: t.savedDuplicate(resource.name), duplicates }
              : { text: t.saved(resource.name) });
            if (view === "archived") setView("active");
            void load({ view: view === "archived" ? "active" : view });
          }}
          resource={editor === "create" ? null : editor}
        />
      )}
    </section>
  );
}
