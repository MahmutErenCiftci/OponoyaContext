"use client";

import type { DecisionMode } from "@devcontext/contracts";
import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { isKnownSlot, slotGroups, slotLabel } from "../lib/decision-slots";
import { defineCopy } from "../lib/i18n";
import { catalogSlugFor, type LogoSubject } from "../lib/logos";
import { DecisionBadge, ModeIcon } from "./decision-badge";
import { useLocale } from "./locale-provider";
import { TechLogo } from "./tech-logo";

const copy = defineCopy({
  tr: {
    edit: (label: string) => `${label} kararını düzenle`,
    ariaLabel: "Kararlar",
    empty: "Henüz karar yok.",
    aiDecides: "AI karar versin",
    noResource: "Kaynak seçilmedi",
    archived: " · arşivde",
    layer: "Katman / Seçim",
    decision: "Karar",
    source: "Kaynak",
    editColumn: "Düzenle",
    custom: "Özel",
  },
  en: {
    edit: (label: string) => `Edit ${label} decision`,
    ariaLabel: "Decisions",
    empty: "No decisions yet.",
    aiDecides: "Let AI decide",
    noResource: "No resource selected",
    archived: " · archived",
    layer: "Layer / Choice",
    decision: "Decision",
    source: "Source",
    editColumn: "Edit",
    custom: "Custom",
  },
});

export type DecisionRow = {
  slot: string;
  mode: DecisionMode;
  resource: (LogoSubject & { name: string; archivedAt?: string | null }) | null;
  /** Provenance text, e.g. "Proje" or the profile name. */
  source?: string | undefined;
  /** Secondary line under the source, e.g. what the decision overrides. */
  sourceNote?: string | undefined;
  /** Constraint summary for delegated decisions. */
  note?: string | undefined;
};

/**
 * Decisions grouped under Frontend / Backend / Veri … headings the way the
 * Stack, Profile and Recipe screens present them. Only decided slots appear;
 * new ones are added through the caller's "Karar ekle" button.
 * `editLabel`, when given, is appended to the slot label ("Dil kararını düzenle");
 * by default the edit label follows the interface language.
 */
export function GroupedDecisionTable({ rows, showSource = true, onEdit, editLabel, ariaLabel, emptyText, extra }: {
  rows: DecisionRow[];
  showSource?: boolean | undefined;
  onEdit?: ((slot: string) => void) | undefined;
  editLabel?: string | undefined;
  ariaLabel?: string | undefined;
  emptyText?: string | undefined;
  /** Optional trailing content rendered after the table (e.g. custom slot form). */
  extra?: ReactNode;
}) {
  const locale = useLocale();
  const t = copy[locale];
  const bySlot = new Map(rows.map((row) => [row.slot, row]));
  const groups = slotGroups[locale].map((group) => ({ group, rows: group.slots.map((slot) => bySlot.get(slot.key)).filter((row): row is DecisionRow => Boolean(row)) })).filter((entry) => entry.rows.length > 0);
  const custom = rows.filter((row) => !isKnownSlot(row.slot));
  if (rows.length === 0) return <p className="muted" style={{ marginTop: 16 }}>{emptyText ?? t.empty}</p>;

  function renderRow(row: DecisionRow) {
    const label = slotLabel(row.slot, locale);
    const edit = editLabel ? `${label} ${editLabel}` : t.edit(label);
    return (
      <tr key={row.slot}>
        <td>
          <div className="identity">
            <span className="mark">{row.resource ? <TechLogo name={row.resource.name} size={26} slug={catalogSlugFor(row.resource)} /> : <ModeIcon mode={row.mode} size={22} />}</span>
            <div style={{ minWidth: 0 }}>
              <strong>{row.resource?.name ?? (row.mode === "AI_DECIDE" ? t.aiDecides : t.noResource)}</strong>
              <small>{label} · <code className="code">{row.slot}</code>{row.resource?.archivedAt ? t.archived : ""}{row.note ? ` · ${row.note}` : ""}</small>
            </div>
          </div>
        </td>
        <td data-label={t.decision}><DecisionBadge mode={row.mode} /></td>
        {showSource && <td data-label={t.source}><span>{row.source ?? "—"}</span>{row.sourceNote && <small className="muted" style={{ display: "block" }}>{row.sourceNote}</small>}</td>}
        <td className="actions">
          {onEdit && <button aria-label={edit} className="icon-button" onClick={() => onEdit(row.slot)} title={edit} type="button"><PencilSimple aria-hidden size={20} /></button>}
        </td>
      </tr>
    );
  }

  return (
    <div className="table-wrap">
      <table aria-label={ariaLabel ?? t.ariaLabel} className="table">
        <thead>
          <tr><th scope="col">{t.layer}</th><th scope="col">{t.decision}</th>{showSource && <th scope="col">{t.source}</th>}<th className="actions" scope="col">{t.editColumn}</th></tr>
        </thead>
        <tbody>
          {groups.map(({ group, rows: groupRows }) => (
            <GroupRows key={group.id} label={group.label} span={showSource ? 4 : 3}>{groupRows.map(renderRow)}</GroupRows>
          ))}
          {custom.length > 0 && <GroupRows label={t.custom} span={showSource ? 4 : 3}>{custom.map(renderRow)}</GroupRows>}
        </tbody>
      </table>
      {extra}
    </div>
  );
}

function GroupRows({ label, span, children }: { label: string; span: number; children: ReactNode }) {
  return (
    <>
      <tr className="group-row"><td colSpan={span}>{label}</td></tr>
      {children}
    </>
  );
}
