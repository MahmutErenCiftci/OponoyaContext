import type { AuditEvent } from "@devcontext/contracts";
import { Check, Clock, Database, FileText, SignIn, UploadSimple, UserCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { activityDetail, activityHref, activityLabel } from "../lib/activity-labels";
import { defineCopy, type Locale } from "../lib/i18n";
import { formatDateTime } from "../lib/resource-labels";

const copy = defineCopy({
  tr: {
    failed: "Etkinlikler şu an yüklenemiyor. Yenileyip tekrar dene.",
    empty: "Kaydettiğin kaynaklar, kararlar ve dışa aktarımlar burada görünür.",
    label: "Son etkinlikler",
  },
  en: {
    failed: "Activity can't be loaded right now. Refresh and try again.",
    empty: "The resources, decisions and exports you save show up here.",
    label: "Recent activity",
  },
});

function ActivityIcon({ event }: { event: AuditEvent }) {
  if (event.action === "account.signed_in") return <SignIn aria-hidden size={22} />;
  if (event.action.endsWith("exported")) return <UploadSimple aria-hidden size={22} />;
  if (event.action.includes("decision")) return <Database aria-hidden size={22} />;
  if (event.entityType === "profile" || event.entityType === "recipe") return <FileText aria-hidden size={22} />;
  if (event.entityType === "account") return <UserCircle aria-hidden size={22} />;
  return <Check aria-hidden size={22} />;
}

/** The caller's own audit trail as a vertical timeline; labels are content-free by construction. */
export function ActivityTimeline({ events, locale }: { events: AuditEvent[] | null; locale: Locale }) {
  const t = copy[locale];
  if (events === null) return <p className="note warning" role="status">{t.failed}</p>;
  if (events.length === 0) return <p className="muted">{t.empty}</p>;
  return (
    <ol aria-label={t.label} className="timeline">
      {events.map((event) => {
        const detail = activityDetail(event, locale);
        const href = activityHref(event);
        const title = <>{activityLabel(event, locale)}{detail ? <span className="muted"> · {detail}</span> : null}</>;
        return (
          <li key={event.id}>
            <span className="mark"><ActivityIcon event={event} /></span>
            <div>
              <strong>{href ? <Link href={href}>{title}</Link> : title}</strong>
              <small><Clock aria-hidden size={16} /><time dateTime={event.createdAt}>{formatDateTime(event.createdAt, locale)}</time></small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
