"use client";

import { X } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=\"hidden\"])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

/**
 * Modal surface shared by every drawer and dialog: labelled `role="dialog"`,
 * focus trap, Escape and backdrop close, body scroll lock and focus return to
 * the control that opened it. When `onSubmit` is given, body and footer sit in
 * one form so Enter submits and the footer's primary button is the submit.
 */
export function DrawerFrame({ title, eyebrow, subtitle, onClose, onSubmit, children, footer, closeLabel = "Kapat", variant = "drawer", wide = false, labelledBy }: {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  onClose(): void;
  onSubmit?(event: FormEvent<HTMLFormElement>): void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  variant?: "drawer" | "dialog";
  wide?: boolean;
  /** Optional explicit heading id (for tests or when the title is not the heading). */
  labelledBy?: string;
}) {
  const generated = useId();
  const titleId = labelledBy ?? `drawer-title-${generated}`;
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(".drawer-body " + focusableSelector) ?? panel.current;
    window.setTimeout(() => first?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(focusableSelector)).filter((item) => item.offsetParent !== null || item === document.activeElement);
    if (items.length === 0) return;
    const firstItem = items[0]!;
    const lastItem = items[items.length - 1]!;
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  }

  const body = (
    <>
      <div className="drawer-body">{children}</div>
      {footer && <footer className="drawer-foot">{footer}</footer>}
    </>
  );

  return (
    <div className={`drawer-backdrop${variant === "dialog" ? " dialog-center" : ""}`} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className={variant === "dialog" ? "dialog" : `drawer${wide ? " wide" : ""}`} onKeyDown={onKeyDown} ref={panel} role="dialog" tabIndex={-1}>
        <header className="drawer-head">
          <div>
            {eyebrow && <small>{eyebrow}</small>}
            <h2 id={titleId}>{title}</h2>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <button aria-label={closeLabel} className="icon-button" onClick={onClose} type="button"><X aria-hidden size={22} /></button>
        </header>
        {onSubmit ? <form noValidate onSubmit={onSubmit} style={{ display: "contents" }}>{body}</form> : body}
      </section>
    </div>
  );
}
