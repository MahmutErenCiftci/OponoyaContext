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
import { Breadcrumb } from "../../../../components/page-heading";
import { RowMenu } from "../../../../components/row-menu";
import { SlotPicker } from "../../../../components/slot-picker";
import { TechLogo } from "../../../../components/tech-logo";
import { readConstraints, slotLabel } from "../../../../lib/decision-slots";
import { responseError } from "../../../../lib/errors";
import { catalogSlugFor } from "../../../../lib/logos";
import { formatDate, formatDateTime, profileTypeLabels } from "../../../../lib/resource-labels";
import { ProfileIcon, profileTypeShort } from "../../profiles/profiles-client";
import { RecipeEditor } from "../recipes-client";

type Attachment = { profileId: string; priority: number };
type Effective = { slot: string; record: DecisionRecord; from: string };

function ProfilesSection({ recipe, profiles, archived, onSaved, onNotice }: {
  recipe: Recipe;
  profiles: ProfileSummary[];
  archived: boolean;
  onSaved(attached: Recipe["profiles"]): void;
  onNotice(text: string): void;
}) {
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
      onNotice("Profil sırası kaydedildi.");
    } catch {
      setError("Tarif hizmetine ulaşılamıyor. Tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="recipe-profiles" className="card">
      <div className="section-head">
        <div><h3 className="section-title small" id="recipe-profiles">Profil sırası</h3><p className="muted small" style={{ marginTop: 6 }}>Yüksek öncelik, çakışan kararları belirler.</p></div>
        {!archived && available.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select aria-label="Profil ekle" className="select inline" onChange={(event) => setAddId(event.target.value)} value={addId}>
              <option value="">Profil seç…</option>
              {available.map((item) => <option key={item.id} value={item.id}>{item.name} · {profileTypeShort[item.type]}</option>)}
            </select>
            <button className="button" disabled={!addId} onClick={() => { if (addId) { setAttachments((previous) => [...previous, { profileId: addId, priority: 0 }]); setAddId(""); } }} type="button"><Plus aria-hidden size={18} />Profil ekle</button>
          </div>
        )}
      </div>
      {ordered.length === 0 ? <p className="note">Henüz profil eklenmedi.</p> : (
        <ol aria-label="Bağlı profiller" className="profile-order">
          {ordered.map((attachment, index) => {
            const profile = known.get(attachment.profileId);
            return (
              <li key={attachment.profileId}>
                <span className="order-buttons">
                  <button aria-label={`${profile?.name ?? "Profil"} yukarı taşı`} className="icon-button" disabled={archived || index === 0} onClick={() => move(attachment.profileId, -1)} style={{ width: 28, height: 28 }} type="button"><ArrowUp aria-hidden size={14} /></button>
                  <button aria-label={`${profile?.name ?? "Profil"} aşağı taşı`} className="icon-button" disabled={archived || index === ordered.length - 1} onClick={() => move(attachment.profileId, 1)} style={{ width: 28, height: 28 }} type="button"><ArrowDown aria-hidden size={14} /></button>
                </span>
                <span className="order">{index + 1}</span>
                <span className={`mark tone profile-${profile?.type ?? "stack"}`}>{profile ? <ProfileIcon size={24} type={profile.type} /> : null}</span>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontWeight: 600 }}>{profile?.name ?? "Profil"}</strong>
                  <small className="muted">Profil · {profile ? profileTypeLabels[profile.type] : ""}{profile?.archivedAt ? " · arşivde" : ""}</small>
                </span>
                <label className="priority"><span>Öncelik</span><input aria-label={`${profile?.name ?? "Profil"} önceliği`} disabled={archived} max={1000} min={-1000} onChange={(event) => setAttachments((previous) => previous.map((item) => item.profileId === attachment.profileId ? { ...item, priority: Number(event.target.value) || 0 } : item))} type="number" value={attachment.priority} /></label>
                {!archived
                  ? <button className="button quiet small" onClick={() => setAttachments((previous) => previous.filter((item) => item.profileId !== attachment.profileId))} type="button"><Trash aria-hidden size={18} />Kaldır</button>
                  : <span />}
              </li>
            );
          })}
        </ol>
      )}
      {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      {!archived && dirty && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
          <span className="muted small" style={{ alignSelf: "center" }}>Kaydedilmemiş değişiklik</span>
          <button className="button primary" disabled={pending} onClick={() => void save()} type="button">{pending ? "Kaydediliyor…" : "Profil sırasını kaydet"}</button>
        </div>
      )}
    </section>
  );
}

export function RecipeDetailClient({ initial, library, profiles }: { initial: Recipe; library: Resource[]; profiles: ProfileSummary[] }) {
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
      setNotice(result.archivedAt ? "Tarif arşivlendi. Onu kullanan projeler kararlarını korur." : "Tarif geri yüklendi.");
      router.refresh();
    } catch {
      setNotice("Tarif hizmetine ulaşılamıyor.");
    } finally {
      setPending(false);
    }
  }

  const visibleEffective = showAll ? effective : effective.slice(0, 6);

  return (
    <section className="page">
      <Breadcrumb items={[{ label: "Tarifler", href: "/workspace/recipes" }, { label: recipe.name }]} />
      <div className="project-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{recipe.name}{archived && <span className="chip">Arşivde</span>}<button className="button quiet" onClick={() => setEditingMeta(true)} style={{ fontSize: 15 }} type="button"><PencilSimple aria-hidden size={18} />Düzenle</button></h1>
          <p className="lead">{recipe.description || "Henüz açıklama yok."}</p>
        </div>
        <div className="actions">
          <RowMenu label="Diğer işlemler">
            {archived
              ? <button disabled={pending} onClick={() => void toggleArchive()} type="button"><ArrowCounterClockwise aria-hidden size={18} />Tarifi geri yükle</button>
              : <button disabled={pending} onClick={() => void toggleArchive()} type="button"><Archive aria-hidden size={18} />Tarifi arşivle</button>}
          </RowMenu>
          {!archived && <Link className="button primary" href={`/workspace/projects?new=1&recipe=${recipe.id}`}><PlusCircle aria-hidden size={20} />Bu tarifle proje oluştur</Link>}
        </div>
      </div>
      {archived && <p className="note warning" role="status" style={{ marginTop: 16 }}>Bu tarif arşivde: yeni projelere uygulanamaz, ama onu kullanan projeler kararlarını devralmaya devam eder. Güncellendi {formatDate(recipe.updatedAt)}.</p>}
      <div className="split recipe" style={{ marginTop: 28 }}>
        <div className="rail">
          <ProfilesSection archived={archived} onNotice={setNotice} onSaved={(attached) => setRecipe((previous) => ({ ...previous, profiles: attached, profileCount: attached.length }))} profiles={profiles} recipe={recipe} />
          <section aria-labelledby="recipe-decisions" className="card">
            <div className="section-head">
              <h3 className="section-title small" id="recipe-decisions">Tarife özel kararlar</h3>
              {!archived && <button className="button small" onClick={() => setPicking(true)} type="button"><Plus aria-hidden size={16} />Karar ekle</button>}
            </div>
            <GroupedDecisionTable
              ariaLabel="Tarife özel kararlar"
              emptyText="Tarifin kendi kararı yok; profillerin seçimleri geçerli."
              onEdit={archived ? undefined : (slot) => setEditor({ slot, record: bySlot.get(slot) ?? null })}
              rows={recipe.decisions.map((decision) => ({
                slot: decision.slot,
                mode: decision.mode,
                resource: decision.resource,
                note: decision.mode === "AI_DECIDE" && readConstraints(decision.constraints).allowed.length > 0 ? `İzin verilen: ${readConstraints(decision.constraints).allowed.join(", ")}` : undefined,
              }))}
              showSource={false}
            />
          </section>
        </div>
        <aside className="card" aria-labelledby="effective-title">
          <h3 className="section-title small" id="effective-title">Etkin seçimler</h3>
          <p className="muted small" style={{ marginTop: 6 }}>Bu tarife uygulanacak seçilmiş kararlar ve kaynakları.</p>
          {effective.length === 0 ? <p className="note" style={{ marginTop: 16 }}>Profiller yüklendiğinde etkin seçimler burada görünür.</p> : (
            <ul className="list-rows" style={{ marginTop: 8 }}>
              {visibleEffective.map((item) => (
                <li key={item.slot}>
                  <span className="mark large">{item.record.resource ? <TechLogo name={item.record.resource.name} size={32} slug={catalogSlugFor(item.record.resource)} /> : <DecisionBadge label="" mode={item.record.mode} size={22} />}</span>
                  <div className="grow">
                    <strong>{item.record.resource?.name ?? slotLabel(item.slot)}</strong>
                    <small>{slotLabel(item.slot)} · <DecisionBadge mode={item.record.mode} size={14} /></small>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <small className="muted">Kaynak</small>
                    <div style={{ fontSize: 14 }}>{item.from}</div>
                    <small className="muted">Tarih</small>
                    <div style={{ fontSize: 13 }}>{formatDateTime(item.record.updatedAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {effective.length > 6 && (
            <button className="text-link" onClick={() => setShowAll(!showAll)} style={{ background: "none", border: 0, padding: 0, marginTop: 16, color: "var(--ink)" }} type="button">
              {showAll ? "Daha az göster" : "Tüm etkin seçimleri göster"} <CaretRight aria-hidden size={18} />
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
          onRemoved={() => { applyDecision(editor.slot, null); setEditor(null); setNotice(`${slotLabel(editor.slot)} tariften kaldırıldı.`); }}
          onSaved={(record) => { if (record) applyDecision(editor.slot, record); setEditor(null); setNotice(`${slotLabel(editor.slot)} kaydedildi.`); }}
          parseRemoved={() => null}
          parseSaved={(body) => profileDecisionResponseSchema.parse(body).decision}
          record={editor.record}
          removeLabel="Tariften kaldır"
          scopeNote="Bu karar tarife kaydedilir ve profillerin seçimlerini geçersiz kılar; tarifi kullanan projeler bir sonraki oluşturmada değişikliği alır."
          slot={editor.slot}
        />
      )}
      {editingMeta && (
        <RecipeEditor
          onClose={() => setEditingMeta(false)}
          onSaved={(saved) => { setRecipe(saved); setEditingMeta(false); setNotice("Tarif kaydedildi."); }}
          recipe={recipe}
        />
      )}
    </section>
  );
}
