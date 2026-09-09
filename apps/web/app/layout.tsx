import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { themeAttribute } from "../lib/theme";
import { readTheme } from "../lib/theme-server";

export const metadata: Metadata = {
  title: "DevContext",
  description: "Teknolojilerini bir kez anlat. Her projede hatırlansın.",
};

/** The theme cookie is read here so the first paint already uses the chosen palette (no flash). */
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = await readTheme();
  return (
    <html data-theme={themeAttribute(theme)} lang="tr">
      <body>{children}</body>
    </html>
  );
}
