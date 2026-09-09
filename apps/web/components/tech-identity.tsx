import type { ReactNode } from "react";
import { TechLogo } from "./tech-logo";

/** Brand mark plus name and a one-line sublabel, used in tables, rails and cards. */
export function TechIdentity({ name, sub, slug, size = 24, markClass = "", children }: {
  name: ReactNode;
  sub?: ReactNode;
  slug: string | null | undefined;
  size?: number;
  markClass?: string;
  children?: ReactNode;
}) {
  const plainName = typeof name === "string" ? name : "";
  return (
    <div className="identity">
      <span className={`mark ${markClass}`.trim()}><TechLogo name={plainName} size={size} slug={slug} /></span>
      <div style={{ minWidth: 0 }}>
        <strong>{name}</strong>
        {sub && <small>{sub}</small>}
        {children}
      </div>
    </div>
  );
}
