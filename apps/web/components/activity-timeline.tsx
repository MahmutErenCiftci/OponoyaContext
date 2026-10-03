import type { AuditEvent } from "@devcontext/contracts";
import { Check, Clock, Database, FileText, SignIn, UploadSimple, UserCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { activityDetail, activityHref, activityLabel } from "../lib/activity-labels";
import { formatDateTime } from "../lib/resource-labels";

function ActivityIcon({ event }: { event: AuditEvent }) {
  if (event.action === "account.signed_in") return <SignIn aria-hidden size={22} />;
  if (event.action.endsWith("exported")) return <UploadSimple aria-hidden size={22} />;
  if (event.action.includes("decision")) return <Database aria-hidden size={22} />;
  if (event.entityType === "profile" || event.entityType === "recipe") return <FileText aria-hidden size={22} />;
  if (event.entityType === "account") return <UserCircle aria-hidden size={22} />;
  return <Check aria-hidden size={22} />;
}

/** The caller's own audit trail as a vertical timeline; labels are content-free by construction. */
export function ActivityTimeline({ events }: { events: AuditEvent[] | null }) {
  if (events === null) return <p className="note warning" role="status">Etkinlikler şu an yüklenemiyor. Yenileyip tekrar dene.</p>;
  if (events.length === 0) return <p className="muted">Kaydettiğin kaynaklar, kararlar ve dışa aktarımlar burada görünür.</p>;
  return (
    <ol aria-label="Son etkinlikler" className="timeline">
      {events.map((event) => {
        const detail = activityDetail(event);
        const href = activityHref(event);
        const title = <>{activityLabel(event)}{detail ? <span className="muted"> · {detail}</span> : null}</>;
        return (
          <li key={event.id}>
            <span className="mark"><ActivityIcon event={event} /></span>
            <div>
              <strong>{href ? <Link href={href}>{title}</Link> : title}</strong>
              <small><Clock aria-hidden size={16} /><time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time></small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
