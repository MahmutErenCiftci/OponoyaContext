"use client";

import {
  contextStateResponseSchema,
  projectDecisionResponseSchema,
  type AiStatus,
  type CompileWarning,
  type Project,
  type ProjectDecisionView,
  type Resource,
} from "@devcontext/contracts";
import { Info, Plus, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ComingSoonBadge } from "../../../../../components/coming-soon";
import { DecisionBadge } from "../../../../../components/decision-badge";
import { DecisionEditor } from "../../../../../components/decision-editor";
import { GroupedDecisionTable, type DecisionRow } from "../../../../../components/decision-table";
import { useLocale } from "../../../../../components/locale-provider";
import { SlotPicker } from "../../../../../components/slot-picker";
import { modeLabels, originLabel, readConstraints, slotLabel, sourceLabels } from "../../../../../lib/decision-slots";
import { defineCopy, type Locale } from "../../../../../lib/i18n";
import { pluralCount } from "../../../../../lib/resource-labels";
import { warningTitles } from "../../../../../lib/warning-labels";

type Editor = { slot: string; view: ProjectDecisionView | null } | null;

const copy = defineCopy({
  tr: {
    overrides: (origin: string) => `${origin} tercihini geçersiz kılar`,
    shadowed: (count: number) => `${pluralCount(count, "başka profil")} gölgede`,
    allowed: (items: string) => `İzin verilen: ${items}`,
    loadFailed: "Kararlar yüklenemedi. Sayfayı yenileyip tekrar dene.",
    title: "Teknoloji kararları",
    lead: "Her seçimin kaynağını ve karar biçimini gör.",
    counts: (project: number, recipe: number, profile: number, global: number, delegated: number) => `${pluralCount(project, "proje kararı")} · ${recipe} tariften · ${profile} profilden · ${global} Kütüphane kuralından · ${delegated} AI’a bırakılan`,
    overrideNote: "Proje kararları profil ve kütüphane tercihlerini geçersiz kılar.",
    proLater: "Pro ile V2’de gelecek",
    suggestStack: "AI ile stack öner",
    soon: "Yakında",
    addDecision: "Karar ekle",
    impactWarnings: "Etki uyarıları",
    warningsNote: "Uyarılar Kütüphane kurallarından ve arşivlenmiş kaynaklardan gelir. Bir sorunu açıklar, kararını senin yerine değiştirmez; bir sonraki oluşturma da bunları listeler.",
    linkedProfiles: "Bağlı profiller: ",
    profilePriority: (priority: number, archived: boolean) => ` (öncelik ${priority}${archived ? ", arşivde" : ""})`,
    linkedProfilesAfter: ". İki profil aynı alanda karar verdiğinde yüksek öncelik kazanır.",
    empty: "Henüz karar yok. “Karar ekle” ile bir teknolojiyi kilitle, tercih et, AI’a bırak veya devre dışı bırak. Kütüphane tercihleri devralınan kural olarak otomatik görünür.",
    modes: "Karar biçimleri",
    followsAgain: (slot: string, origin: string) => `${slot} yeniden ${origin} tercihini izliyor.`,
    removed: (slot: string) => `${slot} kararı kaldırıldı.`,
    saved: (slot: string) => `${slot} kaydedildi.`,
    useLayer: (layer: string) => `${layer} tercihini kullan`,
    remove: "Kararı kaldır",
    scopeNote: "Bu değişiklik projeye özel kaydedilir. AI talimatlarının yeniden oluşturulması gerekir.",
    aiAccepted: (slot: string) => `${slot} için AI önerisi kabul edildi.`,
  },
  en: {
    overrides: (origin: string) => `Overrides the ${origin} preference`,
    shadowed: (count: number) => `${pluralCount(count, "other profile", "other profiles")} shadowed`,
    allowed: (items: string) => `Allowed: ${items}`,
    loadFailed: "Decisions could not be loaded. Refresh the page and try again.",
    title: "Technology decisions",
    lead: "See where every choice comes from and how it is decided.",
    counts: (project: number, recipe: number, profile: number, global: number, delegated: number) => `${pluralCount(project, "project decision", "project decisions")} · ${recipe} from recipes · ${profile} from profiles · ${global} from Library rules · ${delegated} left to AI`,
    overrideNote: "Project decisions override profile and Library preferences.",
    proLater: "Coming with Pro in V2",
    suggestStack: "Suggest a stack with AI",
    soon: "Coming soon",
    addDecision: "Add decision",
    impactWarnings: "Impact warnings",
    warningsNote: "Warnings come from Library rules and archived resources. They explain a problem but never change your decision for you; the next time you create instructions, they are listed too.",
    linkedProfiles: "Attached profiles: ",
    profilePriority: (priority: number, archived: boolean) => ` (priority ${priority}${archived ? ", archived" : ""})`,
    linkedProfilesAfter: ". When two profiles decide the same slot, the higher priority wins.",
    empty: "No decisions yet. Use “Add decision” to lock a technology, prefer it, leave it to AI or disable it. Library preferences appear automatically as inherited rules.",
    modes: "Decision modes",
    followsAgain: (slot: string, origin: string) => `${slot} follows the ${origin} preference again.`,
    removed: (slot: string) => `${slot} decision removed.`,
    saved: (slot: string) => `${slot} saved.`,
    useLayer: (layer: string) => `Use the ${layer} preference`,
    remove: "Remove decision",
    scopeNote: "This change is saved for this project only. The AI instructions need to be created again.",
    aiAccepted: (slot: string) => `AI suggestion accepted for ${slot}.`,
  },
});

/** Which inherited layer a project decision sits on top of, if any. */
function underlying(view: ProjectDecisionView | null) {
  if (!view) return null;
  return view.source === "project" ? view.recipe ?? view.profile ?? view.global : null;
}

function rowFor(view: ProjectDecisionView, locale: Locale): DecisionRow {
  const t = copy[locale];
  const decision = view.effective;
  const layer = underlying(view);
  const allowed = decision.mode === "AI_DECIDE" ? readConstraints(decision.constraints).allowed : [];
  const shadowed = view.source === "profile" ? view.profiles.length - 1 : view.profiles.length;
  return {
    slot: view.slot,
    mode: decision.mode,
    resource: decision.resource,
    source: originLabel(decision, locale),
    sourceNote: layer ? t.overrides(originLabel(layer, locale)) : shadowed > 0 ? t.shadowed(shadowed) : undefined,
    note: allowed.length > 0 ? t.allowed(allowed.join(", ")) : undefined,
  };
}

export function StackClient({ project, initial, library, warnings: initialWarnings, ai }: {
  project: Project;
  /** AI availability, consent and quota; null when unavailable or not loaded. */
  ai: AiStatus | null;
  initial: ProjectDecisionView[] | null;
  library: Resource[];
  /** Compile-time warnings for the current draft (null when they could not be loaded). */
  warnings: CompileWarning[] | null;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const router = useRouter();
  const [decisions, setDecisions] = useState<ProjectDecisionView[]>(initial ?? []);
  const [warnings, setWarnings] = useState<CompileWarning[] | null>(initialWarnings);
  const [editor, setEditor] = useState<Editor>(null);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<string | null>(initial === null ? t.loadFailed : null);

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
          <h2>{t.title}</h2>
          <p className="lead">{t.lead}</p>
          <p aria-live="polite" className="muted small" role="status" style={{ marginTop: 10 }}>
            {t.counts(counts.project, counts.recipe, counts.profile, counts.global, counts.delegated)}
          </p>
        </div>
        <div className="right">
          <span className="note" role="note"><Info aria-hidden size={18} />{t.overrideNote}</span>
          {!archived && !ai?.available && <button className="button soon-button" disabled title={t.proLater} type="button"><Sparkle aria-hidden size={18} />{t.suggestStack}<ComingSoonBadge label={t.soon} /></button>}
          {!archived && <button className="button primary" onClick={() => setPicking(true)} type="button"><Plus aria-hidden size={18} />{t.addDecision}</button>}
        </div>
      </div>
      {warnings && warnings.length > 0 && (
        <section aria-labelledby="impact-warnings" className="warning-panel" style={{ marginTop: 20 }}>
          <h3 id="impact-warnings">{t.impactWarnings} ({warnings.length})</h3>
          <ul>{warnings.map((warning, index) => <li key={`${warning.code}-${index}`}><code>{warning.code}</code><span><strong>{warningTitles[locale][warning.code]}:</strong> {warning.message}</span></li>)}</ul>
          <p>{t.warningsNote}</p>
        </section>
      )}
      {project.profiles.length > 0 && (
        <p className="muted small" style={{ marginTop: 16 }}>
          {t.linkedProfiles}{project.profiles.map((item, index) => <span key={item.id}>{index > 0 ? ", " : ""}<strong>{item.name}</strong>{t.profilePriority(item.priority, Boolean(item.archivedAt))}</span>)}{t.linkedProfilesAfter}
        </p>
      )}
      <GroupedDecisionTable
        ariaLabel={t.title}
        emptyText={t.empty}
        onEdit={archived ? undefined : (slot) => setEditor({ slot, view: bySlot.get(slot) ?? null })}
        rows={decisions.map((view) => rowFor(view, locale))}
      />
      <div aria-label={t.modes} className="stack-legend">
        {(["LOCKED", "PREFERRED", "AI_DECIDE", "DISABLED"] as const).map((mode) => <DecisionBadge key={mode} label={modeLabels[locale][mode]} mode={mode} />)}
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
      {picking && <SlotPicker onClose={() => setPicking(false)} onPick={(slot) => { setPicking(false); setEditor({ slot, view: bySlot.get(slot) ?? null }); }} taken={new Set(decisions.map((view) => view.slot))} />}
      {editor && (
        <DecisionEditor<ProjectDecisionView | null, ProjectDecisionView | null>
          endpoint={`/api/projects/${project.id}/decisions/${encodeURIComponent(editor.slot)}`}
          inherited={editorInherited ? { label: `${originLabel(editorInherited, locale)}${editorInherited.origin ? ` (${sourceLabels[locale][editorInherited.scope]})` : ""}` } : undefined}
          isOverride={Boolean(editor.view?.project)}
          key={editor.slot}
          library={library}
          onClose={() => setEditor(null)}
          onRemoved={(view) => { replace(editor.slot, view); setEditor(null); setNotice(view ? t.followsAgain(slotLabel(editor.slot, locale), originLabel(view.effective, locale)) : t.removed(slotLabel(editor.slot, locale))); void refreshWarnings(); router.refresh(); }}
          onSaved={(view) => { if (view) replace(editor.slot, view); setEditor(null); setNotice(t.saved(slotLabel(editor.slot, locale))); void refreshWarnings(); router.refresh(); }}
          parseRemoved={(body) => projectDecisionResponseSchema.parse(body).decision}
          parseSaved={(body) => projectDecisionResponseSchema.parse(body).decision}
          record={editor.view?.effective ?? null}
          removeLabel={editorLayer ? t.useLayer(sourceLabels[locale][editorLayer.scope]) : t.remove}
          scopeNote={t.scopeNote}
          slot={editor.slot}
          ai={ai && !archived ? {
            projectId: project.id,
            status: ai,
            onAccepted: (view) => { replace(editor.slot, view); setEditor(null); setNotice(t.aiAccepted(slotLabel(editor.slot, locale))); void refreshWarnings(); },
          } : undefined}
        />
      )}
    </>
  );
}
