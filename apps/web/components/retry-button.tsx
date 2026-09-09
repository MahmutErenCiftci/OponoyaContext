"use client";

import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Re-runs the server render of the current route so a recovered API shows real data without a full reload. */
export function RetryButton({ label = "Yeniden dene", onRetry, className = "button primary" }: { label?: string; onRetry?: () => void; className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function retry() {
    setPending(true);
    if (onRetry) onRetry();
    else router.refresh();
    window.setTimeout(() => setPending(false), 1_500);
  }

  return (
    <button aria-busy={pending} className={className} disabled={pending} onClick={retry} type="button">
      <ArrowsClockwise aria-hidden size={20} />
      {pending ? "Deneniyor…" : label}
    </button>
  );
}
