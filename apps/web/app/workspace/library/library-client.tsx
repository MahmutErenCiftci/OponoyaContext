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
import { useEffect, useId, useState, type FormEvent } from "react";
import { DecisionBadge, ModeIcon, NoRuleBadge } from "../../../components/decision-badge";
import { DrawerFrame } from "../../../components/drawer";
import { PageHead } from "../../../components/page-heading";
import { RowMenu } from "../../../components/row-menu";
import { TechLogo } from "../../../components/tech-logo";
import { readApiError, responseError } from "../../../lib/errors";
import { catalogSlugFor } from "../../../lib/logos";
import { typeLabels } from "../../../lib/resource-labels";

type LibraryView = "active" | "favorites" | "archived";
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

/** Global preference choices: LOCKED / PREFERRED / DISABLED or no rule. AI_DECIDE does not exist at Library level. */
const globalChoices: Array<{ id: GlobalChoice; label: string; text: string; mode: GlobalPreferenceMode | null; tone: string }> = [
  { id: "LOCKED", label: "Kilitli", text: "Bu kaynağı tüm projelerde zorunlu olarak kullan; AI değiştirmesin.", mode: "LOCKED", tone: "tone-locked" },
  { id: "PREFERRED", label: "Tercih edilen", text: "Bu kaynağı tercih ederim; gerekirse alternatif seçilebilir.", mode: "PREFERRED", tone: "tone-preferred" },
  { id: "NONE", label: "Varsayılan kural yok", text: "Kütüphane kaydı bir genel karar dayatmaz.", mode: null, tone: "tone-neutral" },
  { id: "DISABLED", label: "Devre dışı", text: "Bu kaynağı projelerde kullanmak istemem.", mode: "DISABLED", tone: "tone-neutral" },
];

function CompatibilitySection({ resource, library }: { resource: Resource; library: Resource[] }) {
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
        setError(failure.details.length > 0 ? "Bu kaynak arşivde ya da kullanılamıyor." : failure.message);
        return;
      }
      const result = compatibilityRuleResponseSchema.parse(await response.json());
      setRules((previous) => [result.rule, ...(previous ?? []).filter((item) => item.id !== result.rule.id)]);
      setOtherId("");
      setNote("");
    } catch {
      setError("Kural kaydedilemedi. Tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  async function remove(rule: CompatibilityRule) {
    const response = await fetch(`/api/compatibility-rules/${rule.id}`, { method: "DELETE" });
    if (response.ok) setRules((previous) => (previous ?? []).filter((item) => item.id !== rule.id));
    else setError(await responseError(response));
  }

  const others = library.filter((item) => item.id !== resource.id);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div><strong className="field-label">Uyumluluk kuralları</strong><p className="muted small">Uyumluluk kuralları derleme sırasında uyarı verir; tercihlerini değiştirmez.</p></div>
      {rules === null ? <p className="muted small">Kurallar yükleniyor…</p> : rules.length === 0 ? <p className="note">Bu kaynakla ilgili uyumluluk kuralı yok.</p> : (
        <ul className="check-list">
          {rules.map((rule) => (
            <li className="check-item" key={rule.id} style={{ cursor: "default" }}>
              <span className="grow"><strong>{rule.left.name}</strong> {rule.kind === "conflicts" ? "ile birlikte kullanılamaz:" : "şunu gerektirir:"} <strong>{rule.right.name}</strong>{rule.note ? <small> · {rule.note}</small> : null}</span>
              <button aria-label={`Kuralı kaldır: ${rule.left.name} ${rule.kind === "conflicts" ? "birlikte kullanılamaz" : "gerektirir"} ${rule.right.name}`} className="icon-button" onClick={() => void remove(rule)} type="button"><X aria-hidden size={18} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="field-row">
        <label className="field"><span>Kural</span><select aria-label="Kural" className="select" onChange={(event) => setKind(event.target.value as "conflicts" | "requires")} value={kind}><option value="conflicts">Birlikte kullanılamaz</option><option value="requires">Gerektirir</option></select></label>
        <label className="field"><span>Diğer kaynak</span><select aria-label="Diğer kaynak" className="select" onChange={(event) => setOtherId(event.target.value)} value={otherId}><option value="">Seç…</option>{others.map((item) => <option key={item.id} value={item.id}>{item.name} · {typeLabels[item.type]}</option>)}</select></label>
      </div>
      <label className="field"><span>Gerekçe (isteğe bağlı)</span><input maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="MVP’de tek veri deposu." value={note} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div><button className="button" disabled={pending || !otherId} onClick={() => void add()} type="button">{pending ? "Kaydediliyor…" : "Kural ekle"}</button></div>
    </div>
  );
}

function ResourceEditor({ resource, library, onClose, onSaved }: {
  resource: Resource | null;
  library: Resource[];
  onClose(): void;
  onSaved(result: { resource: Resource; duplicates: ResourceDuplicate[] }): void;
}) {
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
      setError("Kaynağa bir ad ver.");
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
      setError("Kaynak hizmetine ulaşılamıyor. Tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <DrawerFrame
      closeLabel="Kaynak düzenleyiciyi kapat"
      footer={<><button className="button" onClick={onClose} type="button">İptal</button><button className="button primary" disabled={pending} type="submit">{pending ? "Kaydediliyor…" : "Kaynağı kaydet"}</button></>}
      onClose={onClose}
      onSubmit={submit}
      title={resource ? "Kaynağı düzenle" : "Kaynak ekle"}
    >
      <label className="field"><span>Kaynak bağlantısı</span><input data-autofocus={resource ? undefined : true} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" type="url" value={sourceUrl} /></label>
      <label className="field"><span>Ad *</span><input aria-invalid={error && !name.trim() ? true : undefined} maxLength={160} onChange={(event) => setName(event.target.value)} required value={name} /></label>
      <div className="field-row">
        <label className="field"><span>Tür *</span><select aria-label="Tür *" className="select" onChange={(event) => changeType(event.target.value as ResourceType)} value={type}>{resourceTypeSchema.options.map((option) => <option key={option} value={option}>{typeLabels[option]}</option>)}</select></label>
        {preference !== "NONE"
          ? <label className="field"><span>Karar alanı *</span><input aria-label="Karar alanı *" className="code" onChange={(event) => setSlot(event.target.value)} pattern="[a-z][a-z0-9_]*(\.[a-z0-9_]+)+" placeholder="frontend.framework" required value={slot} /><small>Talimatlar derlenirken kullanılan anahtar.</small></label>
          : <div className="field"><span>Karar alanı</span><input className="code" disabled value={slot} /><small>Genel kural olmadığında kullanılmaz.</small></div>}
      </div>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 12 }}>
        <legend className="field-label">Varsayılan karar</legend>
        <div className="radio-grid">
          {globalChoices.map((choice) => (
            <label className={`radio-card ${choice.tone}${preference === choice.id ? " selected" : ""}`} key={choice.id}>
              <input checked={preference === choice.id} name={`${id}-preference`} onChange={() => setPreference(choice.id)} type="radio" value={choice.id} />
              <strong>{choice.label}</strong>
              {choice.mode ? <ModeIcon mode={choice.mode} size={20} /> : <span />}
              <span>{choice.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field"><span>Etiketler</span><input onChange={(event) => setTagText(event.target.value)} placeholder="ui, react" value={tagText} /><small>Virgülle ayırarak etiket ekleyin.</small></label>
      <label className="field"><span>Notlar</span><textarea maxLength={10000} onChange={(event) => setNotes(event.target.value)} placeholder="Yeni projelerde varsayılan bileşen kütüphanem." rows={3} value={notes} /><small>Bu kaynağa dair ek notlar.</small></label>
      <details className="disclosure" open={Boolean(resource) || Boolean(docsUrl || repoUrl || installCommand || description)}>
        <summary>Gelişmiş bilgiler <CaretDown aria-hidden size={18} /></summary>
        <div className="disclosure-body">
          <label className="field"><span>Açıklama</span><textarea maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="Neden kullandığın ve nereye oturduğu…" rows={2} value={description} /></label>
          <div className="field-row">
            <label className="field"><span>Dokümantasyon bağlantısı</span><input onChange={(event) => setDocsUrl(event.target.value)} placeholder="https://…" type="url" value={docsUrl} /></label>
            <label className="field"><span>Depo bağlantısı</span><input onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/…" type="url" value={repoUrl} /></label>
          </div>
          <label className="field"><span>Kurulum komutu</span><input className="code" onChange={(event) => setInstallCommand(event.target.value)} placeholder="pnpm add paket" value={installCommand} /><small>Komut yalnızca metin olarak saklanır; asla çalıştırılmaz.</small></label>
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
  const archived = Boolean(resource.archivedAt);
  return (
    <tr className={archived ? "archived" : ""}>
      <td>
        <div className="identity">
          <span className="mark"><TechLogo name={resource.name} size={26} slug={catalogSlugFor(resource)} /></span>
          <div style={{ minWidth: 0 }}>
            <h3>{resource.name}</h3>
            <small>{resource.description || typeLabels[resource.type]}</small>
          </div>
        </div>
      </td>
      <td data-label="Tür">{typeLabels[resource.type]}</td>
      <td data-label="Varsayılan tercih">{resource.preference ? <DecisionBadge mode={resource.preference.mode} /> : <NoRuleBadge label="Varsayılan kural yok" />}</td>
      <td className="actions">
        <div className="row-actions">
          {resource.sourceUrl && <a aria-label={`${resource.name} kaynağını aç`} className="icon-button" href={resource.sourceUrl} rel="noreferrer" target="_blank" title="Kaynak bağlantısı"><ArrowSquareOut aria-hidden size={20} /></a>}
          {!archived && (
            <button aria-label={resource.favorite ? `${resource.name} favorilerden kaldır` : `${resource.name} favorilere ekle`} aria-pressed={resource.favorite} className={`star-button${resource.favorite ? " active" : ""}`} onClick={onToggleFavorite} type="button"><Star aria-hidden size={22} weight={resource.favorite ? "fill" : "regular"} /></button>
          )}
          <RowMenu label={`${resource.name} işlemleri`}>
            {!archived && <button onClick={onEdit} type="button"><PencilSimple aria-hidden size={18} />Düzenle</button>}
            {archived
              ? <button onClick={onRestore} type="button"><ArrowCounterClockwise aria-hidden size={18} />Geri yükle</button>
              : <button onClick={onArchive} type="button"><Archive aria-hidden size={18} />Arşivle</button>}
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
  const [resources, setResources] = useState(initial.resources);
  const [total, setTotal] = useState(initial.total);
  const [search, setSearch] = useState(initialSearch);
  const [type, setType] = useState("");
  const [preference, setPreference] = useState<PreferenceFilter>("");
  const [view, setView] = useState<LibraryView>(initialView);
  const [editor, setEditor] = useState<"closed" | "create" | Resource>(openCreateOnLoad ? "create" : "closed");
  const [loading, setLoading] = useState(false);
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

  async function load(next: { search?: string; type?: string; preference?: PreferenceFilter; view?: LibraryView } = {}) {
    const values = { search: next.search ?? search, type: next.type ?? type, preference: next.preference ?? preference, view: next.view ?? view };
    const params = new URLSearchParams({ archived: values.view === "archived" ? "archived" : "active" });
    if (values.view === "favorites") params.set("favorite", "true");
    if (values.search) params.set("q", values.search);
    if (values.type) params.set("type", values.type);
    if (values.preference) params.set("preference", values.preference);
    setLoading(true);
    syncUrl(values);
    try {
      const response = await fetch(`/api/resources?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load resources");
      const result = resourceListResponseSchema.parse(await response.json());
      setResources(result.resources);
      setTotal(result.total);
    } catch {
      setNotice({ text: "Kütüphane yenilenemedi." });
    } finally {
      setLoading(false);
    }
  }

  async function mutate(resource: Resource, action: "archive" | "restore") {
    const response = await fetch(`/api/resources/${resource.id}${action === "restore" ? "/restore" : ""}`, { method: action === "restore" ? "POST" : "DELETE" });
    if (!response.ok) {
      setNotice({ text: await responseError(response) });
      return;
    }
    setNotice({ text: action === "restore" ? `${resource.name} geri yüklendi.` : `${resource.name} arşive taşındı.` });
    await load();
  }

  async function toggleFavorite(resource: Resource) {
    const response = await fetch(`/api/resources/${resource.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorite: !resource.favorite }) });
    if (!response.ok) {
      setNotice({ text: await responseError(response) });
      return;
    }
    const result = resourceMutationResponseSchema.parse(await response.json());
    setResources((previous) => previous.map((item) => item.id === result.resource.id ? result.resource : item));
    setNotice({ text: result.resource.favorite ? `${resource.name} favorilere eklendi.` : `${resource.name} favorilerden kaldırıldı.` });
    if (view === "favorites" && !result.resource.favorite) void load();
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
  const tabs: Array<{ id: LibraryView; label: string }> = [{ id: "active", label: "Tümü" }, { id: "favorites", label: "Favoriler" }, { id: "archived", label: "Arşiv" }];

  return (
    <section className="page">
      <PageHead
        actions={<button className="button primary large" onClick={() => setEditor("create")} type="button"><Plus aria-hidden size={20} />Kaynak ekle</button>}
        lead="Her projede hatırlanmasını istediğin araçlar ve kurallar."
        title="Kütüphane"
      />
      <div className="toolbar">
        <form className="search" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search">
          <MagnifyingGlass aria-hidden size={20} />
          <input aria-label="Kaynaklarda ara" onChange={(event) => setSearch(event.target.value)} placeholder="Kaynaklarda ara" value={search} />
        </form>
        <select aria-label="Türe göre filtrele" className="select inline" onChange={(event) => { setType(event.target.value); void load({ type: event.target.value }); }} value={type}><option value="">Tür</option>{resourceTypeSchema.options.map((option) => <option key={option} value={option}>{typeLabels[option]}</option>)}</select>
        <select aria-label="Tercihe göre filtrele" className="select inline" onChange={(event) => { const value = event.target.value as PreferenceFilter; setPreference(value); void load({ preference: value }); }} value={preference}><option value="">Tercih</option><option value="LOCKED">Kilitli</option><option value="PREFERRED">Tercih edilen</option><option value="DISABLED">Devre dışı</option></select>
      </div>
      <div aria-label="Kütüphane görünümü" className="tabs" role="tablist" style={{ marginTop: 22 }}>
        {tabs.map((tab) => <button aria-selected={view === tab.id} key={tab.id} onClick={() => switchView(tab.id)} role="tab" type="button">{tab.label}</button>)}
      </div>
      {resources.length > 0 && (
        <div className="table-wrap">
          <table aria-label="Kaynaklar" className="table">
            <thead><tr><th scope="col">Kaynak</th><th scope="col">Tür</th><th scope="col">Varsayılan tercih</th><th className="actions" scope="col"><span className="visually-hidden">İşlemler</span></th></tr></thead>
            <tbody>
              {resources.map((resource) => <ResourceRow key={resource.id} onArchive={() => void mutate(resource, "archive")} onEdit={() => setEditor(resource)} onRestore={() => void mutate(resource, "restore")} onToggleFavorite={() => void toggleFavorite(resource)} resource={resource} />)}
            </tbody>
          </table>
        </div>
      )}
      {!loading && resources.length === 0 && (
        <div className="empty">
          <span className="mark xl"><Tray size={34} /></span>
          <h2>{view === "archived" ? "Arşiv boş" : view === "favorites" ? "Henüz favorin yok" : filtered ? "Eşleşen kaynak yok" : "Kütüphanen burada başlıyor"}</h2>
          <p>{view === "archived" ? "Arşivlediğin kaynakları buradan geri yükleyebilirsin." : view === "favorites" ? "Sık kullandığın kaynakları yıldızlayarak burada topla." : filtered ? "Başka bir sözcük dene veya filtreleri temizle." : "AI’ın hatırlamasını istediğin bir framework, veritabanı, bileşen veya kural ekle."}</p>
          {view === "active" && !filtered && <button className="button primary" onClick={() => setEditor("create")} type="button">İlk kaynağını ekle</button>}
          {filtered && <button className="button" onClick={clearFilters} type="button">Filtreleri temizle</button>}
          {view === "active" && !filtered && <p className="muted small">Ya da <Link className="text-link" href="/workspace/catalog">katalogdan ekle</Link>.</p>}
        </div>
      )}
      <p aria-live="polite" className="result-count">{loading ? "Yükleniyor…" : `${total} kaynak gösteriliyor`}</p>
      {notice && (
        <div className="toast" role="status">
          <span>{notice.text}</span>
          {notice.duplicates && notice.duplicates.length > 0 && (
            <ul>
              {notice.duplicates.map((duplicate) => (
                <li key={`${duplicate.id}-${duplicate.reason}`}>
                  {duplicate.reason === "url" ? "Aynı kaynak bağlantısı:" : "Aynı ad ve tür:"} <Link href={`/workspace/library?q=${encodeURIComponent(duplicate.name)}`}>{duplicate.name}</Link>{duplicate.sourceUrl ? <small> · {duplicate.sourceUrl}</small> : null}
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
              ? { text: `${resource.name} kaydedildi; mevcut bir kaynağın kopyası olabilir. İkisi de korundu, aşağıdan incele.`, duplicates }
              : { text: `${resource.name} Kütüphanene kaydedildi.` });
            if (view === "archived") setView("active");
            void load({ view: view === "archived" ? "active" : view });
          }}
          resource={editor === "create" ? null : editor}
        />
      )}
    </section>
  );
}
