import Link from "next/link";
import type { ReactNode } from "react";

export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span className="crumb" key={`${item.label}-${index}`} style={{ display: "contents" }}>
            {index > 0 && <span aria-hidden="true" className="sep">/</span>}
            {item.href && !last ? <Link href={item.href}>{item.label}</Link> : <span aria-current={last ? "page" : undefined}>{item.label}</span>}
          </span>
        );
      })}
    </nav>
  );
}

/** Title row shared by every workspace page: title (with optional chips), one-line lead and right-aligned actions. */
export function PageHead({ title, lead, actions, badges, compact = false, id }: {
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
  compact?: boolean;
  id?: string;
}) {
  return (
    <header className="page-head">
      <div>
        <h1 className={`page-title${compact ? " compact" : ""}`} id={id}>{title}{badges}</h1>
        {lead && <p className="page-lead">{lead}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
