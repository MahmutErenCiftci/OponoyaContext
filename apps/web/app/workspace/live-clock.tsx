"use client";

import { useEffect, useState } from "react";
import { useLocale } from "../../components/locale-provider";
import { intlLocales, type Locale } from "../../lib/i18n";
import { displayTimeZone } from "../../lib/resource-labels";

function clockFormats(locale: Locale) {
  return {
    date: new Intl.DateTimeFormat(intlLocales[locale], { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: displayTimeZone }),
    time: new Intl.DateTimeFormat(intlLocales[locale], { hour: "2-digit", minute: "2-digit", timeZone: displayTimeZone }),
  };
}

const formats: Record<Locale, ReturnType<typeof clockFormats>> = { tr: clockFormats("tr"), en: clockFormats("en") };

/**
 * "Salı, 30 Eylül 2026 · 16:42" / "Tuesday, September 30, 2026 · 04:42 PM",
 * ticking every minute in Türkiye time. The server renders the same text, so
 * only a minute boundary can differ at hydration.
 */
export function LiveClock({ initial }: { initial: string }) {
  const { date: dateFormat, time: timeFormat } = formats[useLocale()];
  const [now, setNow] = useState(() => new Date(initial));
  useEffect(() => {
    let interval: number | undefined;
    const align = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => { window.clearTimeout(align); window.clearInterval(interval); };
  }, []);
  return (
    <time className="live-clock" dateTime={now.toISOString()} suppressHydrationWarning>
      <span suppressHydrationWarning>{dateFormat.format(now)}</span>
      <span aria-hidden="true" className="dot" />
      <strong suppressHydrationWarning>{timeFormat.format(now)}</strong>
    </time>
  );
}
