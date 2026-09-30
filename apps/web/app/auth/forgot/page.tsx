import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "../../../components/brand-mark";
import { ThemeToggle } from "../../../components/theme-toggle";
import { getAuthOptions } from "../../../lib/api";
import { loadSession } from "../../../lib/server-session";
import { readTheme } from "../../../lib/theme-server";
import { ForgotPasswordForm } from "../password-reset-forms";

export const metadata: Metadata = { title: "Şifremi unuttum", robots: { index: false } };

export default async function ForgotPasswordPage() {
  const [session, theme, options] = await Promise.all([loadSession(), readTheme(), getAuthOptions()]);
  if (session.status === "authenticated") redirect("/workspace");

  return (
    <main>
      <header className="auth-header">
        <Link className="brand" href="/"><BrandMark /></Link>
        <ThemeToggle initialTheme={theme} />
      </header>
      <section className="auth-form-region auth-single">
        {options.passwordReset ? <ForgotPasswordForm /> : (
          <div className="auth-form">
            <h1>Şifre sıfırlama açık değil</h1>
            <p>Bu ortamda e-posta ile şifre sıfırlama henüz kullanılamıyor. Hesabına erişemiyorsan destek ile iletişime geç.</p>
            <Link className="button large full" href="/auth?mode=sign-in">Girişe dön</Link>
          </div>
        )}
      </section>
    </main>
  );
}
