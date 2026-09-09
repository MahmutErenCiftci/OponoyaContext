"use client";

import { DotsThree } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Compact "more actions" menu for table rows. Built on <details> so it works
 * before hydration; closes on outside click, Escape and after an action.
 */
export function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: MouseEvent | KeyboardEvent) {
      const details = ref.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        details.open = false;
        details.querySelector("summary")?.focus();
        return;
      }
      if (!details.contains(event.target as Node)) details.open = false;
    }
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, []);
  return (
    <details className="row-menu" ref={ref}>
      <summary aria-label={label} title={label}><DotsThree aria-hidden size={24} weight="bold" /></summary>
      <div className="header-menu-panel" onClick={() => { if (ref.current) ref.current.open = false; }} role="presentation">{children}</div>
    </details>
  );
}
