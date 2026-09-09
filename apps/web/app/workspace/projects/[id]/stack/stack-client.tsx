"use client";

import {
  contextStateResponseSchema,
  projectDecisionResponseSchema,
  type CompileWarning,
  type Project,
  type ProjectDecisionView,
  type Resource,
} from "@devcontext/contracts";
import { Info, Plus } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DecisionBadge } from "../../../../../components/decision-badge";
import { DecisionEditor } from "../../../../../components/decision-editor";
import { GroupedDecisionTable, type DecisionRow } from "../../../../../components/decision-table";
import { SlotPicker } from "../../../../../components/slot-picker";
import { modeLabels, originLabel, readConstraints, slotLabel, sourceLabels } from "../../../../../lib/decision-slots";
import { pluralCount } from "../../../../../lib/resource-labels";

type Editor = { slot: string; view: ProjectDecisionView | null } | null;

/** Which inherited layer a project decision sits on top of, if any. */
function underlying(view: ProjectDecisionView | null) {
  if (!view) return null;
  return view.source === "project" ? view.recipe ?? view.profile ?? view.global : null;
}

function rowFor(view: ProjectDecisionView): DecisionRow {
  const decision = view.effective;
  const layer = underlying(view);
  const allowed = decision.mode === "AI_DECIDE" ? readConstraints(decision.constraints).allowed : [];
  const shadowed = view.source === "profile" ? view.profiles.length - 1 : view.profiles.length;
  return {
    slot: view.slot,
    mode: decision.mode,
    resource: decision.resource,
    source: originLabel(decision),
    sourceNote: layer ? `${originLabel(layer)} tercihini geçersiz kılar` : shadowed > 0 ? `${pluralCount(shadowed, "başka profil")} gölgede` : undefined,
    note: allowed.length > 0 ? `İzin verilen: ${allowed.join(", ")}` : undefined,
  };
}

export function StackClient({ project, initial, library, warnings: initialWarnings }: {
  project: Project;
  initial: ProjectDecisionView[] | null;
  library: Resource[];
  /** Compile-time warnings for the current draft (null when they could not be loaded). */
  warnings: CompileWarning[] | null;
}) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<ProjectDecisionView[]>(initial ?? []);
  const [warnings, setWarnings] = useState<CompileWarning[] | null>(initialWarnings);
  const [editor, setEditor] = useState<Editor>(null);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<string | null>(initial === null ? "Kararlar yüklenemedi. Sayfayı yenileyip tekrar dene." : null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4_500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  /** Re-run the draft compile so impact warnings reflect the decision that was just saved or removed. */
  const refreshWarnings = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/context`, { credentials: "same-origin" });
      if (!response.ok) return;
      const parsed = contextStateResponseSchema.safeParse(await response.json());
      if (parsed.success) setWarnings(parsed.data.draftWarnings);
    } catch {
      // Keep the last known warnings; the next compile lists them anyway.
    }
  }, [project.id]);

  const bySlot = new Map(decisions.map((view) => [view.slot, view]));
  const counts = {
    project: decisions.filter((view) => view.source === "project").length,
    recipe: decisions.filter((view) => view.source === "recipe").length,
    profile: decisions.filter((view) => view.source === "profile").length,
    global: decisions.filter((view) => view.source === "global").length,
    delegated: decisions.filter((view) => view.effective.mode === "AI_DECIDE").length,
  };

  function replace(slot: string, view: ProjectDecisionView | null) {
    setDecisions((previous) => {
      const rest = previous.filter((item) => item.slot !== slot);
      return view ? [...rest, view].sort((a, b) => a.slot.localeCompare(b.slot)) : rest;
    });
  }

  const archived = project.status === "archived";
  const editorLayer = editor ? underlying(editor.view) : null;
  const editorInherited = editor?.view ? (editor.view.source === "project" ? editorLayer : editor.view.effective) : null;

  return (
    <>
      <div className="stack-heading">
        <div>
          <h2>Teknoloji kararları</h2>
          <p className="lead">Her seçimin kaynağını ve karar biçimini gör.</p>
          <p aria-live="polite" className="muted small" role="status" style={{ marginTop: 10 }}>
            {pluralCount(counts.project, "proje kararı")} · {counts.recipe} tariften · {counts.profile} profilden · {counts.global} Kütüphane kuralından · {counts.delegated} AI’a bırakılan
          </p>
        </div>
        <div className="right">
          <span className="note" role="note"><Info aria-hidden size={18} />Proje kararları profil ve kütüphane tercihlerini geçersiz kılar.</span>
          {!archived && <button className="button primary" onClick={() => setPicking(true)} type="button"><Plus aria-hidden size={18} />Karar ekle</button>}
        </div>
      </div>
      {warnings && warnings.length > 0 && (
        <section aria-labelledby="impact-warnings" className="warning-panel" style={{ marginTop: 20 }}>
          <h3 id="impact-warnings">Etki uyarıları ({warnings.length})</h3>
          <ul>{warnings.map((warning, index) => <li key={`${warning.code}-${index}`}><code>{warning.code}</code><span>{warning.message}</span></li>)}</ul>
          <p>Uyarılar Kütüphane kurallarından ve arşivlenmiş kaynaklardan gelir. Bir sorunu açıklar, kararını senin yerine değiştirmez; bir sonraki oluşturma da bunları listeler.</p>
        </section>
      )}
      {project.profiles.length > 0 && (
        <p className="muted small" style={{ marginTop: 16 }}>
          Bağlı profiller: {project.profiles.map((item, index) => <span key={item.id}>{index > 0 ? ", " : ""}<strong>{item.name}</strong> (öncelik {item.priority}{item.archivedAt ? ", arşivde" : ""})</span>)}. İki profil aynı alanda karar verdiğinde yüksek öncelik kazanır.
        </p>
      )}
      <GroupedDecisionTable
        ariaLabel="Teknoloji kararları"
        emptyText="Henüz karar yok. “Karar ekle” ile bir teknolojiyi kilitle, tercih et, AI’a bırak veya devre dışı bırak. Kütüphane tercihleri devralınan kural olarak otomatik görünür."
        onEdit={archived ? undefined : (slot) => setEditor({ slot, view: bySlot.get(slot) ?? null })}
        rows={decisions.map(rowFor)}
      />
      <div aria-label="Karar biçimleri" className="stack-legend">
        {(["LOCKED", "PREFERRED", "AI_DECIDE", "DISABLED"] as const).map((mode) => <DecisionBadge key={mode} label={modeLabels[mode]} mode={mode} />)}
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
      {picking && <SlotPicker onClose={() => setPicking(false)} onPick={(slot) => { setPicking(false); setEditor({ slot, view: bySlot.get(slot) ?? null }); }} taken={new Set(decisions.map((view) => view.slot))} />}
      {editor && (
        <DecisionEditor<ProjectDecisionView | null, ProjectDecisionView | null>
          endpoint={`/api/projects/${project.id}/decisions/${encodeURIComponent(editor.slot)}`}
          inherited={editorInherited ? { label: `${originLabel(editorInherited)}${editorInherited.origin ? ` (${sourceLabels[editorInherited.scope]})` : ""}` } : undefined}
          isOverride={Boolean(editor.view?.project)}
          key={editor.slot}
          library={library}
          onClose={() => setEditor(null)}
          onRemoved={(view) => { replace(editor.slot, view); setEditor(null); setNotice(view ? `${slotLabel(editor.slot)} yeniden ${originLabel(view.effective)} tercihini izliyor.` : `${slotLabel(editor.slot)} kararı kaldırıldı.`); void refreshWarnings(); router.refresh(); }}
          onSaved={(view) => { if (view) replace(editor.slot, view); setEditor(null); setNotice(`${slotLabel(editor.slot)} kaydedildi.`); void refreshWarnings(); router.refresh(); }}
          parseRemoved={(body) => projectDecisionResponseSchema.parse(body).decision}
          parseSaved={(body) => projectDecisionResponseSchema.parse(body).decision}
          record={editor.view?.effective ?? null}
          removeLabel={editorLayer ? `${sourceLabels[editorLayer.scope]} tercihini kullan` : "Kararı kaldır"}
          scopeNote="Bu değişiklik projeye özel kaydedilir. AI talimatlarının yeniden oluşturulması gerekir."
          slot={editor.slot}
        />
      )}
    </>
  );
}
