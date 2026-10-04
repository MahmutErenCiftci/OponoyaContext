import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "../../../components/brand-mark";
import { LanguageSwitch } from "../../../components/language-switch";
import { ThemeToggle } from "../../../components/theme-toggle";
import { getAuthOptions, getLegalConfig } from "../../../lib/api";
import { defineCopy } from "../../../lib/i18n";
import { getLocale } from "../../../lib/locale-server";
import { loadSession } from "../../../lib/server-session";
import { readTheme } from "../../../lib/theme-server";
import { ForgotPasswordForm } from "../password-reset-forms";

const copy = defineCopy({
  tr: {
    metaTitle: "Şifremi unuttum",
    title: "Şifre sıfırlama açık değil",
    body: "Bu ortamda e-posta ile şifre sıfırlama henüz kullanılamıyor. ",
    contactBefore: "Hesabına erişemiyorsan ",
    contactAfter: " adresine yaz.",
    noContact: "Hesabına erişemiyorsan hizmet sağlayıcıyla iletişime geç.",
    back: "Girişe dön",
  },
  en: {
    metaTitle: "Forgot password",
    title: "Password reset is not enabled",
    body: "Password reset by email is not available in this environment yet. ",
    contactBefore: "If you can't access your account, write to ",
    contactAfter: ".",
    noContact: "If you can't access your account, contact the service provider.",
    back: "Back to sign in",
  },
});

export async function generateMetadata(): Promise<Metadata> {
  return { title: copy[await getLocale()].metaTitle, robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const [session, theme, options, legal, locale] = await Promise.all([loadSession(), readTheme(), getAuthOptions(), getLegalConfig(), getLocale()]);
  const contact = legal?.entity.contactEmail ?? null;
  if (session.status === "authenticated") redirect("/workspace");
  const t = copy[locale];

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
        {options.passwordReset ? <ForgotPasswordForm /> : (
          <div className="auth-form">
            <h1>{t.title}</h1>
            <p>{t.body}{contact ? <>{t.contactBefore}<a className="text-link" href={`mailto:${contact}`}>{contact}</a>{t.contactAfter}</> : t.noContact}</p>
            <Link className="button large full" href="/auth?mode=sign-in">{t.back}</Link>
          </div>
        )}
      </section>
    </main>
  );
}
