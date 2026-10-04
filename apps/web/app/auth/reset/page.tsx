import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "../../../components/brand-mark";
import { LanguageSwitch } from "../../../components/language-switch";
import { ThemeToggle } from "../../../components/theme-toggle";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { readTheme } from "../../../lib/theme-server";
import { ResetPasswordForm } from "../password-reset-forms";

const copy = defineCopy({
  tr: { metaTitle: "Yeni şifre belirle" },
  en: { metaTitle: "Set a new password" },
});

// The token is a credential: never indexed, never sent to other sites as a referrer.
export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].metaTitle, robots: { index: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [{ token }, theme] = await Promise.all([searchParams, readTheme()]);
  const valid = typeof token === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(token);

  return (
    <main>
      <header className="auth-header">
        <Link className="brand" href="/"><BrandMark /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LanguageSwitch />
          <ThemeToggle initialTheme={theme} />
        </div>
      </header>
      <section className="auth-form-region auth-single">
        <ResetPasswordForm token={valid ? token : null} />
      </section>
    </main>
  );
}
