"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useLocale } from "../../components/locale-provider";
import { defineCopy } from "../../lib/i18n";

type BetterAuthFailure = null | { code?: string; message?: string; error?: { code?: string } };

const copy = defineCopy({
  tr: {
    /** Better Auth answers with stable codes; the pages show their own text. */
    errors: {
      INVALID_TOKEN: "Bu bağlantı geçersiz ya da süresi dolmuş. Yeni bir sıfırlama bağlantısı iste.",
      PASSWORD_TOO_SHORT: "Şifre en az 8 karakter olmalı.",
      PASSWORD_TOO_LONG: "Şifre en fazla 128 karakter olabilir.",
      USER_NOT_FOUND: "Bu bağlantıya ait hesap artık yok.",
      RESET_PASSWORD_DISABLED: "Şifre sıfırlama bu ortamda açık değil.",
    } as Record<string, string>,
    rateLimited: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.",
    failed: "İşlem tamamlanamadı. Lütfen tekrar dene.",
    unreachable: "Giriş hizmetine ulaşılamıyor. Lütfen tekrar dene.",
    backToSignIn: "Girişe dön",
    signIn: "Giriş yap",
    email: "E-posta",
    forgot: {
      sentTitle: "E-postanı kontrol et",
      sentBody: "Bu adresle kayıtlı bir hesap varsa, şifreni sıfırlama bağlantısını gönderdik. Bağlantı 1 saat geçerli ve yalnızca bir kez kullanılabilir.",
      sentHint: "E-posta gelmediyse spam klasörüne bak ya da birkaç dakika sonra yeniden iste.",
      title: "Şifreni sıfırla",
      lead: "Hesabının e-posta adresini yaz; şifreni yeniden belirlemen için bir bağlantı gönderelim.",
      sending: "Gönderiliyor…",
      send: "Sıfırlama bağlantısı gönder",
      remembered: "Şifreni hatırladın mı? ",
    },
    reset: {
      mismatch: "Şifreler birbiriyle eşleşmiyor.",
      doneTitle: "Şifren güncellendi",
      doneBody: "Güvenliğin için hesabındaki tüm oturumlar kapatıldı. Yeni şifrenle giriş yapabilirsin.",
      title: "Yeni şifre belirle",
      password: "Yeni şifre",
      help: "En az 8 karakter.",
      repeat: "Yeni şifre (tekrar)",
      saving: "Kaydediliyor…",
      save: "Şifreyi kaydet",
      expired: "Bağlantının süresi mi doldu? ",
      newLink: "Yeni bağlantı iste",
    },
  },
  en: {
    errors: {
      INVALID_TOKEN: "This link is invalid or has expired. Request a new reset link.",
      PASSWORD_TOO_SHORT: "Your password must be at least 8 characters.",
      PASSWORD_TOO_LONG: "Your password can be at most 128 characters.",
      USER_NOT_FOUND: "The account for this link no longer exists.",
      RESET_PASSWORD_DISABLED: "Password reset is not enabled in this environment.",
    },
    rateLimited: "Too many attempts. Wait a moment and try again.",
    failed: "The request could not be completed. Please try again.",
    unreachable: "The sign-in service can't be reached. Please try again.",
    backToSignIn: "Back to sign in",
    signIn: "Sign in",
    email: "Email",
    forgot: {
      sentTitle: "Check your email",
      sentBody: "If an account is registered with this address, we sent it a link to reset your password. The link is valid for 1 hour and can be used only once.",
      sentHint: "If the email doesn't arrive, check your spam folder or request it again in a few minutes.",
      title: "Reset your password",
      lead: "Enter your account's email address and we'll send you a link to set a new password.",
      sending: "Sending…",
      send: "Send reset link",
      remembered: "Remember your password? ",
    },
    reset: {
      mismatch: "The passwords don't match.",
      doneTitle: "Your password was updated",
      doneBody: "For your security, every session on your account was signed out. You can sign in with your new password.",
      title: "Set a new password",
      password: "New password",
      help: "At least 8 characters.",
      repeat: "New password (again)",
      saving: "Saving…",
      save: "Save password",
      expired: "Has your link expired? ",
      newLink: "Request a new link",
    },
  },
});

type Copy = (typeof copy)["tr"];

async function failureText(t: Copy, response: Response) {
  if (response.status === 429) return t.rateLimited;
  if (response.status === 404) return t.errors.RESET_PASSWORD_DISABLED!;
  const payload = await response.json().catch(() => null) as BetterAuthFailure;
  const code = payload?.code ?? payload?.error?.code;
  return (code && t.errors[code]) || t.failed;
}

/**
 * Asks for a reset link. The answer is the same whether or not the address
 * has an account, so the page never reveals who is registered.
 */
export function ForgotPasswordForm() {
  const t = copy[useLocale()];
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) { setError(await failureText(t, response)); return; }
      setSent(true);
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-form" role="status">
        <h1>{t.forgot.sentTitle}</h1>
        <p>{t.forgot.sentBody}</p>
        <p className="muted small">{t.forgot.sentHint}</p>
        <Link className="button large full" href="/auth?mode=sign-in">{t.backToSignIn}</Link>
      </div>
    );
  }

  return (
    <form aria-labelledby="forgot-title" className="auth-form" onSubmit={submit}>
      <h1 id="forgot-title">{t.forgot.title}</h1>
      <p className="muted">{t.forgot.lead}</p>
      <label className="field">
        <span>{t.email}</span>
        <input autoComplete="email" name="email" required type="email" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button aria-busy={pending} className="button primary large full" disabled={pending} type="submit">{pending ? t.forgot.sending : t.forgot.send}</button>
      <p className="alt">{t.forgot.remembered}<Link href="/auth?mode=sign-in">{t.signIn}</Link></p>
    </form>
  );
}

/** Sets a new password with the one-time token from the e-mail; every session of the account ends. */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = copy[useLocale()];
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Without a usable token the form can never submit, so the invalid-link message stays (in the current language).
  const shownError = error ?? (token ? null : t.errors.INVALID_TOKEN!);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;
    const form = new FormData(event.currentTarget);
    const next = String(form.get("password") ?? "");
    const repeat = String(form.get("repeat") ?? "");
    if (next.length < 8) { setError(t.errors.PASSWORD_TOO_SHORT!); return; }
    if (next !== repeat) { setError(t.reset.mismatch); return; }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: next, token }),
      });
      if (!response.ok) { setError(await failureText(t, response)); return; }
      setDone(true);
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="auth-form" role="status">
        <h1>{t.reset.doneTitle}</h1>
        <p>{t.reset.doneBody}</p>
        <Link className="button primary large full" href="/auth?mode=sign-in">{t.signIn}</Link>
      </div>
    );
  }

  return (
    <form aria-labelledby="reset-title" className="auth-form" onSubmit={submit}>
      <h1 id="reset-title">{t.reset.title}</h1>
      <div className="field">
        <label htmlFor="reset-password">{t.reset.password}</label>
        <input aria-describedby="reset-password-help" autoComplete="new-password" className="input" id="reset-password" maxLength={128} minLength={8} name="password" required type="password" />
        <small id="reset-password-help">{t.reset.help}</small>
      </div>
      <label className="field">
        <span>{t.reset.repeat}</span>
        <input autoComplete="new-password" maxLength={128} minLength={8} name="repeat" required type="password" />
      </label>
      {shownError && <p className="form-error" role="alert">{shownError}</p>}
      <button aria-busy={pending} className="button primary large full" disabled={pending || !token} type="submit">{pending ? t.reset.saving : t.reset.save}</button>
      <p className="alt">{t.reset.expired}<Link href="/auth/forgot">{t.reset.newLink}</Link></p>
    </form>
  );
}
