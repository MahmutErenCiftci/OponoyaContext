"use client";

import { Check, Copy } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";

/** Copies a short text (install command, file name) to the clipboard with visible confirmation. */
export function CopyButton({ text, label = "Kopyala" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1_500);
    } catch {
      setDone(false);
    }
  }
  return (
    <button aria-label={label} className="icon-button" onClick={() => void copy()} style={{ width: 36, height: 36 }} title={label} type="button">
      {done ? <Check aria-hidden size={18} /> : <Copy aria-hidden size={18} />}
    </button>
  );
}
