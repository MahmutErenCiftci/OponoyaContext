"use client";

import { decisionSlotSchema } from "@devcontext/contracts";
import { useState, type FormEvent } from "react";
import { slotGroups } from "../lib/decision-slots";
import { defineCopy } from "../lib/i18n";
import { DrawerFrame } from "./drawer";
import { useLocale } from "./locale-provider";

const copy = defineCopy({
  tr: {
    title: "Karar ekle",
    customError: "custom.date_library gibi noktalı, küçük harfli bir anahtar kullan.",
    pickError: "Bir karar alanı seç.",
    cancel: "İptal",
    next: "Devam et",
    slot: "Karar alanı",
    choose: "Seç…",
    taken: " (zaten var)",
    other: "Diğer",
    customOption: "Özel anahtar…",
    customKey: "Özel anahtar",
    customHint: "Grupların kapsamadığı her şey; küçük harf ve nokta ile.",
  },
  en: {
    title: "Add decision",
    customError: "Use a lowercase key with dots, like custom.date_library.",
    pickError: "Pick a decision slot.",
    cancel: "Cancel",
    next: "Continue",
    slot: "Decision slot",
    choose: "Choose…",
    taken: " (already added)",
    other: "Other",
    customOption: "Custom key…",
    customKey: "Custom key",
    customHint: "Anything the groups do not cover; lowercase letters and dots.",
  },
});

/** Small dialog behind every "Karar ekle" button: pick a known slot or type a custom `custom.*` key. */
export function SlotPicker({ taken, onPick, onClose, title }: { taken: Set<string>; onPick(slot: string): void; onClose(): void; title?: string }) {
  const locale = useLocale();
  const t = copy[locale];
  const [slot, setSlot] = useState("");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = slot === "custom" ? custom.trim() : slot;
    const parsed = decisionSlotSchema.safeParse(value);
    if (!parsed.success) {
      setError(slot === "custom" ? t.customError : t.pickError);
      return;
    }
    onPick(parsed.data);
  }

  return (
    <DrawerFrame
      footer={<><button className="button" onClick={onClose} type="button">{t.cancel}</button><button className="button primary" type="submit">{t.next}</button></>}
      onClose={onClose}
      onSubmit={submit}
      title={title ?? t.title}
      variant="dialog"
    >
      <label className="field">
        <span>{t.slot}</span>
        <select aria-label={t.slot} className="select" data-autofocus onChange={(event) => { setSlot(event.target.value); setError(null); }} value={slot}>
          <option value="">{t.choose}</option>
          {slotGroups[locale].map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.slots.map((item) => <option disabled={taken.has(item.key)} key={item.key} value={item.key}>{item.label}{taken.has(item.key) ? t.taken : ""}</option>)}
            </optgroup>
          ))}
          <optgroup label={t.other}><option value="custom">{t.customOption}</option></optgroup>
        </select>
      </label>
      {slot === "custom" && (
        <label className="field">
          <span>{t.customKey}</span>
          <input aria-invalid={error ? true : undefined} className="input code" onChange={(event) => { setCustom(event.target.value); setError(null); }} placeholder="custom.date_library" value={custom} />
          <small>{t.customHint}</small>
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </DrawerFrame>
  );
}
