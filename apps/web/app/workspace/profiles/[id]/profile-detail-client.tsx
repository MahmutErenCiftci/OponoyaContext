"use client";

import {
  profileDecisionResponseSchema,
  profileResponseSchema,
  type DecisionRecord,
  type Profile,
  type Resource,
} from "@devcontext/contracts";
import { Archive, ArrowCounterClockwise, Info, PencilSimple, Plus } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DecisionEditor } from "../../../../components/decision-editor";
import { GroupedDecisionTable } from "../../../../components/decision-table";
import { useLocale } from "../../../../components/locale-provider";
import { Breadcrumb } from "../../../../components/page-heading";
import { RowMenu } from "../../../../components/row-menu";
import { SlotPicker } from "../../../../components/slot-picker";
import { readConstraints, slotLabel } from "../../../../lib/decision-slots";
import { responseError } from "../../../../lib/errors";
import { defineCopy } from "../../../../lib/i18n";
import { formatDate, pluralCount } from "../../../../lib/resource-labels";
import { ProfileEditor, profileTypeShort } from "../profiles-client";

const copy = defineCopy({
  tr: {
    archivedNotice: "Profil arşivlendi. Onu kullanan projeler kararlarını korur.",
    restoredNotice: "Profil geri yüklendi.",
    serviceUnreachable: "Profil hizmetine ulaşılamıyor.",
    profiles: "Profiller",
    archivedChip: "Arşivde",
    noDescription: "Henüz açıklama yok.",
    editName: "Adı düzenle",
    moreActions: "Diğer işlemler",
    restoreProfile: "Profili geri yükle",
    archiveProfile: "Profili arşivle",
    addDecision: "Karar ekle",
    archivedNote: (date: string) => `Bu profil arşivde: yeni projelere bağlanamaz, ama onu kullanan projeler kararlarını devralmaya devam eder. Güncellendi ${date}.`,
    decisionsTitle: "Profil kararları",
    decisionsEmpty: "Bu profilde henüz karar yok. “Karar ekle” ile başla.",
    allowed: (items: string) => `İzin verilen: ${items}`,
    reuseTitle: "Yeniden kullanım",
    reuseText: "Bu profil projelere ve tariflere eklenebilir.",
    unused: "Henüz bir projede kullanılmıyor.",
    usedIn: (count: number) => `${pluralCount(count, "projede")} kullanılıyor.`,
    explicitChoices: (count: number) => pluralCount(count, "açık seçim"),
    aiDecisions: (count: number) => pluralCount(count, "AI’a bırakılan karar"),
    overrideNote: "Projeye özel kararlar profil tercihlerini geçersiz kılabilir.",
    slotRemoved: (label: string) => `${label} profilden kaldırıldı.`,
    slotSaved: (label: string) => `${label} kaydedildi.`,
    removeLabel: "Profilden kaldır",
    scopeNote: "Bu karar profile kaydedilir; profili kullanan projeler bir sonraki oluşturmada değişikliği alır.",
    saved: "Profil kaydedildi.",
  },
  en: {
    archivedNotice: "Profile archived. Projects that use it keep their decisions.",
    restoredNotice: "Profile restored.",
    serviceUnreachable: "The profile service can't be reached.",
    profiles: "Profiles",
    archivedChip: "Archived",
    noDescription: "No description yet.",
    editName: "Edit name",
    moreActions: "More actions",
    restoreProfile: "Restore profile",
    archiveProfile: "Archive profile",
    addDecision: "Add decision",
    archivedNote: (date: string) => `This profile is archived: it can't be attached to new projects, but projects that use it keep inheriting its decisions. Updated ${date}.`,
    decisionsTitle: "Profile decisions",
    decisionsEmpty: "This profile has no decisions yet. Start with “Add decision”.",
    allowed: (items: string) => `Allowed: ${items}`,
    reuseTitle: "Reuse",
    reuseText: "This profile can be added to projects and recipes.",
    unused: "Not used in any project yet.",
    usedIn: (count: number) => `Used in ${pluralCount(count, "project", "projects")}.`,
    explicitChoices: (count: number) => pluralCount(count, "explicit choice", "explicit choices"),
    aiDecisions: (count: number) => pluralCount(count, "decision left to AI", "decisions left to AI"),
    overrideNote: "Project-specific decisions can override profile preferences.",
    slotRemoved: (label: string) => `${label} removed from the profile.`,
    slotSaved: (label: string) => `${label} saved.`,
    removeLabel: "Remove from profile",
    scopeNote: "This decision is saved to the profile; projects that use the profile pick up the change the next time their instructions are created.",
    saved: "Profile saved.",
  },
});

export function ProfileDetailClient({ initial, library }: { initial: Profile; library: Resource[] }) {
  const locale = useLocale();
  const t = copy[locale];
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [editor, setEditor] = useState<{ slot: string; record: DecisionRecord | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4_500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const bySlot = new Map(profile.decisions.map((decision) => [decision.slot, decision]));
  const archived = Boolean(profile.archivedAt);

  function applyDecision(slot: string, record: DecisionRecord | null) {
    setProfile((previous) => {
      const rest = previous.decisions.filter((decision) => decision.slot !== slot);
      const decisions = record ? [...rest, record].sort((a, b) => a.slot.localeCompare(b.slot)) : rest;
      return { ...previous, decisions, decisionCount: decisions.length };
    });
  }

  async function toggleArchive() {
    setPending(true);
    try {
      const response = await fetch(`/api/profiles/${profile.id}${archived ? "/restore" : ""}`, { method: archived ? "POST" : "DELETE" });
      if (!response.ok) {
        setNotice(await responseError(response));
        return;
      }
      const result = profileResponseSchema.parse(await response.json()).profile;
      setProfile(result);
      setNotice(result.archivedAt ? t.archivedNotice : t.restoredNotice);
      router.refresh();
    } catch {
      setNotice(t.serviceUnreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="page">
      <Breadcrumb items={[{ label: t.profiles, href: "/workspace/profiles" }, { label: profile.name }]} />
      <div className="project-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{profile.name}<span className="chip">{profileTypeShort[locale][profile.type]}</span>{archived && <span className="chip">{t.archivedChip}</span>}</h1>
          <p className="lead">{profile.description || t.noDescription}</p>
        </div>
        <div className="actions">
          <button className="button quiet" onClick={() => setEditingMeta(true)} type="button"><PencilSimple aria-hidden size={18} />{t.editName}</button>
          <RowMenu label={t.moreActions}>
            {archived
              ? <button disabled={pending} onClick={() => void toggleArchive()} type="button"><ArrowCounterClockwise aria-hidden size={18} />{t.restoreProfile}</button>
              : <button disabled={pending} onClick={() => void toggleArchive()} type="button"><Archive aria-hidden size={18} />{t.archiveProfile}</button>}
          </RowMenu>
          {!archived && <button className="button primary" onClick={() => setPicking(true)} type="button"><Plus aria-hidden size={18} />{t.addDecision}</button>}
        </div>
      </div>
      {archived && <p className="note warning" role="status" style={{ marginTop: 16 }}>{t.archivedNote(formatDate(profile.updatedAt, locale))}</p>}
      <div className="split" style={{ marginTop: 28, borderTop: "1px solid var(--line)", paddingTop: 28 }}>
        <section aria-labelledby="profile-decisions-title">
          <h2 className="section-title small" id="profile-decisions-title">{t.decisionsTitle}</h2>
          <GroupedDecisionTable
            ariaLabel={t.decisionsTitle}
            emptyText={t.decisionsEmpty}
            onEdit={archived ? undefined : (slot) => setEditor({ slot, record: bySlot.get(slot) ?? null })}
            rows={profile.decisions.map((decision) => ({
              slot: decision.slot,
              mode: decision.mode,
              resource: decision.resource,
              note: decision.mode === "AI_DECIDE" && readConstraints(decision.constraints).allowed.length > 0 ? t.allowed(readConstraints(decision.constraints).allowed.join(", ")) : undefined,
            }))}
            showSource={false}
          />
        </section>
        <aside className="rail bordered">
          <section aria-labelledby="reuse-title">
            <h3 className="section-title small" id="reuse-title">{t.reuseTitle}</h3>
            <p className="muted" style={{ marginTop: 8 }}>{t.reuseText}</p>
            <p style={{ marginTop: 18, fontSize: 16, fontWeight: 600 }}>{profile.projectCount === 0 ? t.unused : t.usedIn(profile.projectCount)}</p>
            <p className="muted small" style={{ marginTop: 6 }}>{t.explicitChoices(profile.decisions.filter((decision) => decision.mode !== "AI_DECIDE").length)} · {t.aiDecisions(profile.decisions.filter((decision) => decision.mode === "AI_DECIDE").length)}</p>
            <p className="note" role="note" style={{ marginTop: 22 }}><Info aria-hidden size={20} />{t.overrideNote}</p>
          </section>
        </aside>
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
      {picking && <SlotPicker onClose={() => setPicking(false)} onPick={(slot) => { setPicking(false); setEditor({ slot, record: bySlot.get(slot) ?? null }); }} taken={new Set(profile.decisions.map((decision) => decision.slot))} />}
      {editor && (
        <DecisionEditor<DecisionRecord | null, null>
          endpoint={`/api/profiles/${profile.id}/decisions/${encodeURIComponent(editor.slot)}`}
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
        <ProfileEditor
          onClose={() => setEditingMeta(false)}
          onSaved={(saved) => { setProfile(saved); setEditingMeta(false); setNotice(t.saved); }}
          profile={profile}
        />
      )}
    </section>
  );
}
