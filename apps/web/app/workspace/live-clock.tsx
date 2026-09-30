"use client";

import { useEffect, useState } from "react";
import { displayTimeZone } from "../../lib/resource-labels";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: displayTimeZone });
const timeFormat = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: displayTimeZone });

/**
 * "Salı, 30 Eylül 2026 · 16:42", ticking every minute in Türkiye time. The
 * server renders the same text, so only a minute boundary can differ at hydration.
 */
export function LiveClock({ initial }: { initial: string }) {
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
