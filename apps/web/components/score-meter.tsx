import { defineCopy, type Locale } from "../lib/i18n";

const copy = defineCopy({
  tr: {
    title: (label: string, value: number) => `${label}: 5 üzerinden ${value} (editör değerlendirmesi, ölçüm değil)`,
    outOfFive: (value: number) => `5 üzerinden ${value}`,
  },
  en: {
    title: (label: string, value: number) => `${label}: ${value} out of 5 (editor assessment, not a measurement)`,
    outOfFive: (value: number) => `${value} out of 5`,
  },
});

/**
 * 1–5 editor assessment shown as dots. Prototype speed and production
 * readiness use different colours so they are never read as one score.
 */
export function ScoreMeter({ label, value, kind = "default", locale }: { label: string; value: number | null; kind?: "default" | "production"; locale: Locale }) {
  if (value === null) return null;
  const t = copy[locale];
  return (
    <span className={`score${kind === "production" ? " production" : ""}`} title={t.title(label, value)}>
      <span>{label}</span>
      <span aria-hidden="true" className="score-dots">{[1, 2, 3, 4, 5].map((step) => <i className={step <= value ? "on" : ""} key={step} />)}</span>
      <span className="visually-hidden">{t.outOfFive(value)}</span>
    </span>
  );
}
