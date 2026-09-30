import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

/** "Yakında · Pro" pill for features announced in the development plan. */
export function ComingSoonBadge({ label = "Yakında · Pro" }: { label?: string }) {
  return <span className="soon-badge"><Sparkle aria-hidden size={12} weight="fill" />{label}</span>;
}

/**
 * Faded placeholder for an AI feature that is not available yet. The action
 * button is permanently disabled; the plan link stays usable.
 */
export function AiComingSoon({ title, text, action }: { title: string; text: string; action: string }) {
  return (
    <div className="ai-soon">
      <div className="ai-soon-head">
        <span aria-hidden="true" className="mark small"><Sparkle size={18} /></span>
        <strong>{title}</strong>
        <ComingSoonBadge />
      </div>
      <p>{text}</p>
      <div className="ai-soon-foot">
        <button className="button small" disabled title="Pro ile gelecek" type="button"><Sparkle aria-hidden size={16} />{action}</button>
        <Link className="text-link" href="/workspace/billing#gelisim-plani">Gelişim planını gör</Link>
      </div>
    </div>
  );
}
