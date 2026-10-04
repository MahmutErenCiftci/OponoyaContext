"use client";

import {
  profileDecisionResponseSchema,
  profileResponseSchema,
  recipeProfilesResponseSchema,
  recipeResponseSchema,
  type DecisionRecord,
  type ProfileSummary,
  type Recipe,
  type Resource,
} from "@devcontext/contracts";
import { Archive, ArrowCounterClockwise, ArrowDown, ArrowUp, CaretRight, PencilSimple, Plus, PlusCircle, Trash } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DecisionBadge } from "../../../../components/decision-badge";
import { DecisionEditor } from "../../../../components/decision-editor";
import { GroupedDecisionTable } from "../../../../components/decision-table";
import { useLocale } from "../../../../components/locale-provider";
import { Breadcrumb } from "../../../../components/page-heading";
import { RowMenu } from "../../../../components/row-menu";
import { SlotPicker } from "../../../../components/slot-picker";
import { TechLogo } from "../../../../components/tech-logo";
import { readConstraints, slotLabel } from "../../../../lib/decision-slots";
import { responseError } from "../../../../lib/errors";
import { defineCopy } from "../../../../lib/i18n";
import { catalogSlugFor } from "../../../../lib/logos";
import { formatDate, formatDateTime, profileTypeLabels } from "../../../../lib/resource-labels";
import { ProfileIcon, profileTypeShort } from "../../profiles/profiles-client";
import { RecipeEditor } from "../recipes-client";

type Attachment = { profileId: string; priority: number };
type Effective = { slot: string; record: DecisionRecord; from: string };

const copy = defineCopy({
  tr: {
    orderSaved: "Profil sırası kaydedildi.",
    serviceUnreachableRetry: "Tarif hizmetine ulaşılamıyor. Tekrar dene.",
    orderTitle: "Profil sırası",
    orderHelp: "Yüksek öncelik, çakışan kararları belirler.",
    addProfile: "Profil ekle",
    chooseProfile: "Profil seç…",
    noProfiles: "Henüz profil eklenmedi.",
    attachedProfiles: "Bağlı profiller",
    profile: "Profil",
    moveUp: (name: string) => `${name} yukarı taşı`,
    moveDown: (name: string) => `${name} aşağı taşı`,
    profilePrefix: "Profil · ",
    archivedSuffix: " · arşivde",
    priority: "Öncelik",
    priorityLabel: (name: string) => `${name} önceliği`,
    remove: "Kaldır",
    unsaved: "Kaydedilmemiş değişiklik",
    saving: "Kaydediliyor…",
    saveOrder: "Profil sırasını kaydet",
    archivedNotice: "Tarif arşivlendi. Onu kullanan projeler kararlarını korur.",
    restoredNotice: "Tarif geri yüklendi.",
    serviceUnreachable: "Tarif hizmetine ulaşılamıyor.",
    recipes: "Tarifler",
    archivedChip: "Arşivde",
    edit: "Düzenle",
    noDescription: "Henüz açıklama yok.",
    moreActions: "Diğer işlemler",
    restoreRecipe: "Tarifi geri yükle",
    archiveRecipe: "Tarifi arşivle",
    createProject: "Bu tarifle proje oluştur",
    archivedNote: (date: string) => `Bu tarif arşivde: yeni projelere uygulanamaz, ama onu kullanan projeler kararlarını devralmaya devam eder. Güncellendi ${date}.`,
    decisionsTitle: "Tarife özel kararlar",
    addDecision: "Karar ekle",
    decisionsEmpty: "Tarifin kendi kararı yok; profillerin seçimleri geçerli.",
    allowed: (items: string) => `İzin verilen: ${items}`,
    effectiveTitle: "Etkin seçimler",
    effectiveHelp: "Bu tarife uygulanacak seçilmiş kararlar ve kaynakları.",
    effectiveEmpty: "Profiller yüklendiğinde etkin seçimler burada görünür.",
    source: "Kaynak",
    date: "Tarih",
    showLess: "Daha az göster",
    showAll: "Tüm etkin seçimleri göster",
    slotRemoved: (label: string) => `${label} tariften kaldırıldı.`,
    slotSaved: (label: string) => `${label} kaydedildi.`,
    removeLabel: "Tariften kaldır",
    scopeNote: "Bu karar tarife kaydedilir ve profillerin seçimlerini geçersiz kılar; tarifi kullanan projeler bir sonraki oluşturmada değişikliği alır.",
    saved: "Tarif kaydedildi.",
  },
  en: {
    orderSaved: "Profile order saved.",
    serviceUnreachableRetry: "The recipe service can't be reached. Try again.",
    orderTitle: "Profile order",
    orderHelp: "Higher priority settles conflicting decisions.",
    addProfile: "Add profile",
    chooseProfile: "Choose a profile…",
    noProfiles: "No profiles added yet.",
    attachedProfiles: "Attached profiles",
    profile: "Profile",
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    profilePrefix: "Profile · ",
    archivedSuffix: " · archived",
    priority: "Priority",
    priorityLabel: (name: string) => `${name} priority`,
    remove: "Remove",
    unsaved: "Unsaved changes",
    saving: "Saving…",
    saveOrder: "Save profile order",
    archivedNotice: "Recipe archived. Projects that use it keep their decisions.",
    restoredNotice: "Recipe restored.",
    serviceUnreachable: "The recipe service can't be reached.",
    recipes: "Recipes",
    archivedChip: "Archived",
    edit: "Edit",
    noDescription: "No description yet.",
    moreActions: "More actions",
    restoreRecipe: "Restore recipe",
    archiveRecipe: "Archive recipe",
    createProject: "Create a project with this recipe",
    archivedNote: (date: string) => `This recipe is archived: it can't be applied to new projects, but projects that use it keep inheriting its decisions. Updated ${date}.`,
    decisionsTitle: "Recipe-specific decisions",
    addDecision: "Add decision",
    decisionsEmpty: "The recipe has no decisions of its own; the profiles' choices apply.",
    allowed: (items: string) => `Allowed: ${items}`,
    effectiveTitle: "Effective choices",
    effectiveHelp: "The chosen decisions and resources this recipe applies.",
    effectiveEmpty: "Effective choices appear here once the profiles have loaded.",
    source: "Source",
    date: "Date",
    showLess: "Show less",
    showAll: "Show all effective choices",
    slotRemoved: (label: string) => `${label} removed from the recipe.`,
    slotSaved: (label: string) => `${label} saved.`,
    removeLabel: "Remove from recipe",
    scopeNote: "This decision is saved to the recipe and overrides the profiles' choices; projects that use the recipe pick up the change the next time their instructions are created.",
    saved: "Recipe saved.",
  },
});

function ProfilesSection({ recipe, profiles, archived, onSaved, onNotice }: {
  recipe: Recipe;
  profiles: ProfileSummary[];
  archived: boolean;
  onSaved(attached: Recipe["profiles"]): void;
  onNotice(text: string): void;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const [attachments, setAttachments] = useState<Attachment[]>(recipe.profiles.map((item) => ({ profileId: item.id, priority: item.priority })));
  const [addId, setAddId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const known = new Map<string, { name: string; type: ProfileSummary["type"]; archivedAt: string | null }>([
    ...profiles.map((item) => [item.id, { name: item.name, type: item.type, archivedAt: item.archivedAt }] as const),
    ...recipe.profiles.map((item) => [item.id, { name: item.name, type: item.type, archivedAt: item.archivedAt }] as const),
  ]);
  const available = profiles.filter((item) => !attachments.some((attachment) => attachment.profileId === item.id));
  const dirty = JSON.stringify(attachments) !== JSON.stringify(recipe.profiles.map((item) => ({ profileId: item.id, priority: item.priority })));
  const ordered = [...attachments].sort((a, b) => b.priority - a.priority);

  function move(profileId: string, direction: -1 | 1) {
    // Priority decides precedence; moving a row swaps priorities with its neighbour so order and value stay consistent.
    const index = ordered.findIndex((item) => item.profileId === profileId);
    const neighbour = ordered[index + direction];
    const current = ordered[index];
    if (!neighbour || !current) return;
    const swapped = current.priority === neighbour.priority ? { current: current.priority + (direction === -1 ? 10 : -10), neighbour: neighbour.priority } : { current: neighbour.priority, neighbour: current.priority };
    setAttachments((previous) => previous.map((item) => item.profileId === current.profileId ? { ...item, priority: swapped.current } : item.profileId === neighbour.profileId ? { ...item, priority: swapped.neighbour } : item));
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/recipes/${recipe.id}/profiles`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ profiles: attachments }) });
      if (!response.ok) {
        setError(await responseError(response));
        return;
      }
      const saved = recipeProfilesResponseSchema.parse(await response.json()).profiles;
      setAttachments(saved.map((item) => ({ profileId: item.id, priority: item.priority })));
      onSaved(saved);
      onNotice(t.orderSaved);
    } catch {
      setError(t.serviceUnreachableRetry);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="recipe-profiles" className="card">
      <div className="section-head">
        <div><h3 className="section-title small" id="recipe-profiles">{t.orderTitle}</h3><p className="muted small" style={{ marginTop: 6 }}>{t.orderHelp}</p></div>
        {!archived && available.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select aria-label={t.addProfile} className="select inline" onChange={(event) => setAddId(event.target.value)} value={addId}>
              <option value="">{t.chooseProfile}</option>
              {available.map((item) => <option key={item.id} value={item.id}>{item.name} · {profileTypeShort[locale][item.type]}</option>)}
            </select>
            <button className="button" disabled={!addId} onClick={() => { if (addId) { setAttachments((previous) => [...previous, { profileId: addId, priority: 0 }]); setAddId(""); } }} type="button"><Plus aria-hidden size={18} />{t.addProfile}</button>
          </div>
        )}
      </div>
      {ordered.length === 0 ? <p className="note">{t.noProfiles}</p> : (
        <ol aria-label={t.attachedProfiles} className="profile-order">
          {ordered.map((attachment, index) => {
            const profile = known.get(attachment.profileId);
            return (
              <li key={attachment.profileId}>
                <span className="order-buttons">
                  <button aria-label={t.moveUp(profile?.name ?? t.profile)} className="icon-button" disabled={archived || index === 0} onClick={() => move(attachment.profileId, -1)} style={{ width: 28, height: 28 }} type="button"><ArrowUp aria-hidden size={14} /></button>
                  <button aria-label={t.moveDown(profile?.name ?? t.profile)} className="icon-button" disabled={archived || index === ordered.length - 1} onClick={() => move(attachment.profileId, 1)} style={{ width: 28, height: 28 }} type="button"><ArrowDown aria-hidden size={14} /></button>
                </span>
                <span className="order">{index + 1}</span>
                <span className={`mark tone profile-${profile?.type ?? "stack"}`}>{profile ? <ProfileIcon size={24} type={profile.type} /> : null}</span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontWeight: 600 }}>{profile?.name ?? t.profile}</strong>
                  <small className="muted">{t.profilePrefix}{profile ? profileTypeLabels[locale][profile.type] : ""}{profile?.archivedAt ? t.archivedSuffix : ""}</small>
                </span>
                <label className="priority"><span>{t.priority}</span><input aria-label={t.priorityLabel(profile?.name ?? t.profile)} disabled={archived} max={1000} min={-1000} onChange={(event) => setAttachments((previous) => previous.map((item) => item.profileId === attachment.profileId ? { ...item, priority: Number(event.target.value) || 0 } : item))} type="number" value={attachment.priority} /></label>
                {!archived
                  ? <button className="button quiet small" onClick={() => setAttachments((previous) => previous.filter((item) => item.profileId !== attachment.profileId))} type="button"><Trash aria-hidden size={18} />{t.remove}</button>
                  : <span />}
              </li>
            );
          })}
        </ol>
      )}
      {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      {!archived && dirty && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
          <span className="muted small" style={{ alignSelf: "center" }}>{t.unsaved}</span>
          <button className="button primary" disabled={pending} onClick={() => void save()} type="button">{pending ? t.saving : t.saveOrder}</button>
        </div>
      )}
    </section>
  );
}

export function RecipeDetailClient({ initial, library, profiles }: { initial: Recipe; library: Resource[]; profiles: ProfileSummary[] }) {
  const locale = useLocale();
  const t = copy[locale];
  const router = useRouter();
  const [recipe, setRecipe] = useState(initial);
  const [editor, setEditor] = useState<{ slot: string; record: DecisionRecord | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [profileDecisions, setProfileDecisions] = useState<Record<string, DecisionRecord[]>>({});
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4_500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const missing = recipe.profiles.map((item) => item.id).filter((id) => !(id in profileDecisions));
    if (missing.length === 0) return;
    const controller = new AbortController();
    void Promise.all(missing.map(async (id) => {
      try {
        const response = await fetch(`/api/profiles/${id}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return [id, []] as const;
        return [id, profileResponseSchema.parse(await response.json()).profile.decisions] as const;
      } catch {
        return [id, []] as const;
      }
    })).then((entries) => {
      if (!controller.signal.aborted) setProfileDecisions((previous) => ({ ...previous, ...Object.fromEntries(entries) }));
    });
    return () => controller.abort();
  }, [recipe.profiles, profileDecisions]);

  const bySlot = new Map(recipe.decisions.map((decision) => [decision.slot, decision]));
  const archived = Boolean(recipe.archivedAt);

  // Effective selections: the recipe's own decisions win, then the highest-priority profile decision per slot.
  const effective: Effective[] = (() => {
    const result = new Map<string, Effective>();
    const ordered = [...recipe.profiles].sort((a, b) => b.priority - a.priority);
    for (const profile of ordered) {
      for (const record of profileDecisions[profile.id] ?? []) {
        if (!result.has(record.slot)) result.set(record.slot, { slot: record.slot, record, from: profile.name });
      }
    }
    for (const record of recipe.decisions) result.set(record.slot, { slot: record.slot, record, from: recipe.name });
    return [...result.values()].sort((a, b) => a.slot.localeCompare(b.slot));
  })();

  function applyDecision(slot: string, record: DecisionRecord | null) {
    setRecipe((previous) => {
      const rest = previous.decisions.filter((decision) => decision.slot !== slot);
      const decisions = record ? [...rest, record].sort((a, b) => a.slot.localeCompare(b.slot)) : rest;
      return { ...previous, decisions, decisionCount: decisions.length };
    });
  }

  async function toggleArchive() {
    setPending(true);
    try {
      const response = await fetch(`/api/recipes/${recipe.id}${archived ? "/restore" : ""}`, { method: archived ? "POST" : "DELETE" });
      if (!response.ok) {
        setNotice(await responseError(response));
        return;
      }
      const result = recipeResponseSchema.parse(await response.json()).recipe;
      setRecipe(result);
      setNotice(result.archivedAt ? t.archivedNotice : t.restoredNotice);
      router.refresh();
    } catch {
      setNotice(t.serviceUnreachable);
    } finally {
      setPending(false);
    }
  }

  const visibleEffective = showAll ? effective : effective.slice(0, 6);

  return (
    <section className="page">
      <Breadcrumb items={[{ label: t.recipes, href: "/workspace/recipes" }, { label: recipe.name }]} />
      <div className="project-head">
        <div style={{ minWidth: 0 }}>
          <div className="title-row">
            <h1 className="page-title">{recipe.name}{archived && <span className="chip">{t.archivedChip}</span>}</h1>
            <button className="button quiet" onClick={() => setEditingMeta(true)} style={{ fontSize: 15 }} type="button"><PencilSimple aria-hidden size={18} />{t.edit}</button>
          </div>
          <p className="lead">{recipe.description || t.noDescription}</p>
        </div>
        <div className="actions">
          <RowMenu label={t.moreActions}>
            {archived
              ? <button disabled={pending} onClick={() => void toggleArchive()} type="button"><ArrowCounterClockwise aria-hidden size={18} />{t.restoreRecipe}</button>
              : <button disabled={pending} onClick={() => void toggleArchive()} type="button"><Archive aria-hidden size={18} />{t.archiveRecipe}</button>}
          </RowMenu>
          {!archived && <Link className="button primary" href={`/workspace/projects?new=1&recipe=${recipe.id}`}><PlusCircle aria-hidden size={20} />{t.createProject}</Link>}
        </div>
      </div>
      {archived && <p className="note warning" role="status" style={{ marginTop: 16 }}>{t.archivedNote(formatDate(recipe.updatedAt, locale))}</p>}
      <div className="split recipe" style={{ marginTop: 28 }}>
        <div className="rail">
          <ProfilesSection archived={archived} onNotice={setNotice} onSaved={(attached) => setRecipe((previous) => ({ ...previous, profiles: attached, profileCount: attached.length }))} profiles={profiles} recipe={recipe} />
          <section aria-labelledby="recipe-decisions" className="card">
            <div className="section-head">
              <h3 className="section-title small" id="recipe-decisions">{t.decisionsTitle}</h3>
              {!archived && <button className="button small" onClick={() => setPicking(true)} type="button"><Plus aria-hidden size={16} />{t.addDecision}</button>}
            </div>
            <GroupedDecisionTable
              ariaLabel={t.decisionsTitle}
              emptyText={t.decisionsEmpty}
              onEdit={archived ? undefined : (slot) => setEditor({ slot, record: bySlot.get(slot) ?? null })}
              rows={recipe.decisions.map((decision) => ({
                slot: decision.slot,
                mode: decision.mode,
                resource: decision.resource,
                note: decision.mode === "AI_DECIDE" && readConstraints(decision.constraints).allowed.length > 0 ? t.allowed(readConstraints(decision.constraints).allowed.join(", ")) : undefined,
              }))}
              showSource={false}
            />
          </section>
        </div>
        <aside className="card" aria-labelledby="effective-title">
          <h3 className="section-title small" id="effective-title">{t.effectiveTitle}</h3>
          <p className="muted small" style={{ marginTop: 6 }}>{t.effectiveHelp}</p>
          {effective.length === 0 ? <p className="note" style={{ marginTop: 16 }}>{t.effectiveEmpty}</p> : (
            <ul className="list-rows" style={{ marginTop: 8 }}>
              {visibleEffective.map((item) => (
                <li key={item.slot}>
                  <span className="mark large">{item.record.resource ? <TechLogo name={item.record.resource.name} size={32} slug={catalogSlugFor(item.record.resource)} /> : <DecisionBadge label="" mode={item.record.mode} size={22} />}</span>
                  <div className="grow">
                    <strong>{item.record.resource?.name ?? slotLabel(item.slot, locale)}</strong>
                    <small>{slotLabel(item.slot, locale)} · <DecisionBadge mode={item.record.mode} size={14} /></small>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <small className="muted">{t.source}</small>
                    <div style={{ fontSize: 14 }}>{item.from}</div>
                    <small className="muted">{t.date}</small>
                    <div style={{ fontSize: 13 }}>{formatDateTime(item.record.updatedAt, locale)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {effective.length > 6 && (
            <button className="text-link" onClick={() => setShowAll(!showAll)} style={{ background: "none", border: 0, padding: 0, marginTop: 16, color: "var(--ink)" }} type="button">
              {showAll ? t.showLess : t.showAll} <CaretRight aria-hidden size={18} />
            </button>
          )}
        </aside>
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
      {picking && <SlotPicker onClose={() => setPicking(false)} onPick={(slot) => { setPicking(false); setEditor({ slot, record: bySlot.get(slot) ?? null }); }} taken={new Set(recipe.decisions.map((decision) => decision.slot))} />}
      {editor && (
        <DecisionEditor<DecisionRecord | null, null>
          endpoint={`/api/recipes/${recipe.id}/decisions/${encodeURIComponent(editor.slot)}`}
          isOverride={Boolean(editor.record)}
          key={editor.slot}
          library={library}
          onClose={() => setEditor(null)}
          onRemoved={() => { applyDecision(editor.slot, null); setEditor(null); setNotice(t.slotRemoved(slotLabel(editor.slot, locale))); }}
          onSaved={(record) => { if (record) applyDecision(editor.slot, record); setEditor(null); setNotice(t.slotSaved(slotLabel(editor.slot, locale))); }}
          parseRemoved={() => null}
          parseSaved={(body) => profileDecisionResponseSchema.parse(body).decision}
          record={editor.record}
          removeLabel={t.removeLabel}
          scopeNote={t.scopeNote}
          slot={editor.slot}
        />
      )}
      {editingMeta && (
        <RecipeEditor
          onClose={() => setEditingMeta(false)}
          onSaved={(saved) => { setRecipe(saved); setEditingMeta(false); setNotice(t.saved); }}
          recipe={recipe}
        />
      )}
    </section>
  );
}
