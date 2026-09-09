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
import { Breadcrumb } from "../../../../components/page-heading";
import { RowMenu } from "../../../../components/row-menu";
import { SlotPicker } from "../../../../components/slot-picker";
import { readConstraints, slotLabel } from "../../../../lib/decision-slots";
import { responseError } from "../../../../lib/errors";
import { formatDate, pluralCount } from "../../../../lib/resource-labels";
import { ProfileEditor, profileTypeShort } from "../profiles-client";

export function ProfileDetailClient({ initial, library }: { initial: Profile; library: Resource[] }) {
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
      setNotice(result.archivedAt ? "Profil arşivlendi. Onu kullanan projeler kararlarını korur." : "Profil geri yüklendi.");
      router.refresh();
    } catch {
      setNotice("Profil hizmetine ulaşılamıyor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="page">
      <Breadcrumb items={[{ label: "Profiller", href: "/workspace/profiles" }, { label: profile.name }]} />
      <div className="project-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">{profile.name}<span className="chip">{profileTypeShort[profile.type]}</span>{archived && <span className="chip">Arşivde</span>}</h1>
          <p className="lead">{profile.description || "Henüz açıklama yok."}</p>
        </div>
        <div className="actions">
          <button className="button quiet" onClick={() => setEditingMeta(true)} type="button"><PencilSimple aria-hidden size={18} />Adı düzenle</button>
          <RowMenu label="Diğer işlemler">
            {archived
              ? <button disabled={pending} onClick={() => void toggleArchive()} type="button"><ArrowCounterClockwise aria-hidden size={18} />Profili geri yükle</button>
              : <button disabled={pending} onClick={() => void toggleArchive()} type="button"><Archive aria-hidden size={18} />Profili arşivle</button>}
          </RowMenu>
          {!archived && <button className="button primary" onClick={() => setPicking(true)} type="button"><Plus aria-hidden size={18} />Karar ekle</button>}
        </div>
      </div>
      {archived && <p className="note warning" role="status" style={{ marginTop: 16 }}>Bu profil arşivde: yeni projelere bağlanamaz, ama onu kullanan projeler kararlarını devralmaya devam eder. Güncellendi {formatDate(profile.updatedAt)}.</p>}
      <div className="split" style={{ marginTop: 28, borderTop: "1px solid var(--line)", paddingTop: 28 }}>
        <section aria-labelledby="profile-decisions-title">
          <h2 className="section-title small" id="profile-decisions-title">Profil kararları</h2>
          <GroupedDecisionTable
            ariaLabel="Profil kararları"
            emptyText="Bu profilde henüz karar yok. “Karar ekle” ile başla."
            onEdit={archived ? undefined : (slot) => setEditor({ slot, record: bySlot.get(slot) ?? null })}
            rows={profile.decisions.map((decision) => ({
              slot: decision.slot,
              mode: decision.mode,
              resource: decision.resource,
              note: decision.mode === "AI_DECIDE" && readConstraints(decision.constraints).allowed.length > 0 ? `İzin verilen: ${readConstraints(decision.constraints).allowed.join(", ")}` : undefined,
            }))}
            showSource={false}
          />
        </section>
        <aside className="rail" style={{ borderLeft: "1px solid var(--line)", paddingLeft: 40 }}>
          <section aria-labelledby="reuse-title">
            <h3 className="section-title small" id="reuse-title">Yeniden kullanım</h3>
            <p className="muted" style={{ marginTop: 8 }}>Bu profil projelere ve tariflere eklenebilir.</p>
            <p style={{ marginTop: 18, fontSize: 16, fontWeight: 600 }}>{profile.projectCount === 0 ? "Henüz bir projede kullanılmıyor." : `${pluralCount(profile.projectCount, "projede")} kullanılıyor.`}</p>
            <p className="muted small" style={{ marginTop: 6 }}>{pluralCount(profile.decisions.filter((decision) => decision.mode !== "AI_DECIDE").length, "açık seçim")} · {pluralCount(profile.decisions.filter((decision) => decision.mode === "AI_DECIDE").length, "AI’a bırakılan karar")}</p>
            <p className="note" role="note" style={{ marginTop: 22 }}><Info aria-hidden size={20} />Projeye özel kararlar profil tercihlerini geçersiz kılabilir.</p>
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
          onRemoved={() => { applyDecision(editor.slot, null); setEditor(null); setNotice(`${slotLabel(editor.slot)} profilden kaldırıldı.`); }}
          onSaved={(record) => { if (record) applyDecision(editor.slot, record); setEditor(null); setNotice(`${slotLabel(editor.slot)} kaydedildi.`); }}
          parseRemoved={() => null}
          parseSaved={(body) => profileDecisionResponseSchema.parse(body).decision}
          record={editor.record}
          removeLabel="Profilden kaldır"
          scopeNote="Bu karar profile kaydedilir; profili kullanan projeler bir sonraki oluşturmada değişikliği alır."
          slot={editor.slot}
        />
      )}
      {editingMeta && (
        <ProfileEditor
          onClose={() => setEditingMeta(false)}
          onSaved={(saved) => { setProfile(saved); setEditingMeta(false); setNotice("Profil kaydedildi."); }}
          profile={profile}
        />
      )}
    </section>
  );
}
