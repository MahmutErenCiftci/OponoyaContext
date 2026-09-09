"use client";

import { useState, type KeyboardEvent } from "react";

const listLimit = 10;

function sameText(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Toggleable suggestion chips plus a free-text entry; values keep the user's spelling and order. */
export function ChipField({ legend, hint, suggestions, values, onChange, addLabel }: {
  legend: string;
  hint: string;
  suggestions: string[];
  values: string[];
  onChange(values: string[]): void;
  addLabel: string;
}) {
  const [draft, setDraft] = useState("");
  const options = [...suggestions, ...values.filter((value) => !suggestions.some((option) => sameText(option, value)))];
  const full = values.length >= listLimit;

  function toggle(option: string) {
    const selected = values.some((value) => sameText(value, option));
    if (selected) onChange(values.filter((value) => !sameText(value, option)));
    else if (!full) onChange([...values, option]);
  }

  function add() {
    const value = draft.trim();
    if (!value || full) return;
    if (!values.some((existing) => sameText(existing, value))) onChange([...values, value]);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  }

  return (
    <fieldset className="field" style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className="field-label" style={{ padding: 0, marginBottom: 8 }}>{legend}</legend>
      {options.length > 0 && (
        <div className="chip-group">
          {options.map((option) => {
            const selected = values.some((value) => sameText(value, option));
            return (
              <button aria-pressed={selected} className={`chip${selected ? " selected" : ""}`} key={option} onClick={() => toggle(option)} type="button">
                {option}
              </button>
            );
          })}
        </div>
      )}
      <div className="chip-input">
        <input aria-label={addLabel} className="input" disabled={full} maxLength={100} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder="Kendi seçeneğini yaz…" value={draft} />
        <button className="button" disabled={full || !draft.trim()} onClick={add} type="button">Ekle</button>
      </div>
      <small>{full ? `En fazla ${listLimit} kayıt.` : hint}</small>
    </fieldset>
  );
}
