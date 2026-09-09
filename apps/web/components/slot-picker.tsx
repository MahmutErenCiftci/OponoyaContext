"use client";

import { decisionSlotSchema } from "@devcontext/contracts";
import { useState, type FormEvent } from "react";
import { slotGroups } from "../lib/decision-slots";
import { DrawerFrame } from "./drawer";

/** Small dialog behind every "Karar ekle" button: pick a known slot or type a custom `custom.*` key. */
export function SlotPicker({ taken, onPick, onClose, title = "Karar ekle" }: { taken: Set<string>; onPick(slot: string): void; onClose(): void; title?: string }) {
  const [slot, setSlot] = useState("");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = slot === "custom" ? custom.trim() : slot;
    const parsed = decisionSlotSchema.safeParse(value);
    if (!parsed.success) {
      setError(slot === "custom" ? "custom.date_library gibi noktalı, küçük harfli bir anahtar kullan." : "Bir karar alanı seç.");
      return;
    }
    onPick(parsed.data);
  }

  return (
    <DrawerFrame
      footer={<><button className="button" onClick={onClose} type="button">İptal</button><button className="button primary" type="submit">Devam et</button></>}
      onClose={onClose}
      onSubmit={submit}
      title={title}
      variant="dialog"
    >
      <label className="field">
        <span>Karar alanı</span>
        <select aria-label="Karar alanı" className="select" data-autofocus onChange={(event) => { setSlot(event.target.value); setError(null); }} value={slot}>
          <option value="">Seç…</option>
          {slotGroups.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.slots.map((item) => <option disabled={taken.has(item.key)} key={item.key} value={item.key}>{item.label}{taken.has(item.key) ? " (zaten var)" : ""}</option>)}
            </optgroup>
          ))}
          <optgroup label="Diğer"><option value="custom">Özel anahtar…</option></optgroup>
        </select>
      </label>
      {slot === "custom" && (
        <label className="field">
          <span>Özel anahtar</span>
          <input aria-invalid={error ? true : undefined} className="input code" onChange={(event) => { setCustom(event.target.value); setError(null); }} placeholder="custom.date_library" value={custom} />
          <small>Grupların kapsamadığı her şey; küçük harf ve nokta ile.</small>
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </DrawerFrame>
  );
}
