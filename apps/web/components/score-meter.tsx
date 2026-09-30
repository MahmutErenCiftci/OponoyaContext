/**
 * 1–5 editor assessment shown as dots. Prototype speed and production
 * readiness use different colours so they are never read as one score.
 */
export function ScoreMeter({ label, value, kind = "default" }: { label: string; value: number | null; kind?: "default" | "production" }) {
  if (value === null) return null;
  return (
    <span className={`score${kind === "production" ? " production" : ""}`} title={`${label}: 5 üzerinden ${value} (editör değerlendirmesi, ölçüm değil)`}>
      <span>{label}</span>
      <span aria-hidden="true" className="score-dots">{[1, 2, 3, 4, 5].map((step) => <i className={step <= value ? "on" : ""} key={step} />)}</span>
      <span className="visually-hidden">5 üzerinden {value}</span>
    </span>
  );
}
