"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type BetterAuthFailure = null | { code?: string; message?: string; error?: { code?: string } };

/** Better Auth answers with stable codes; the pages show their own Turkish text. */
const resetErrors: Record<string, string> = {
  INVALID_TOKEN: "Bu bağlantı geçersiz ya da süresi dolmuş. Yeni bir sıfırlama bağlantısı iste.",
  PASSWORD_TOO_SHORT: "Şifre en az 8 karakter olmalı.",
  PASSWORD_TOO_LONG: "Şifre en fazla 128 karakter olabilir.",
  USER_NOT_FOUND: "Bu bağlantıya ait hesap artık yok.",
  RESET_PASSWORD_DISABLED: "Şifre sıfırlama bu ortamda açık değil.",
};

async function failureText(response: Response) {
  if (response.status === 429) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
  if (response.status === 404) return resetErrors.RESET_PASSWORD_DISABLED!;
  const payload = await response.json().catch(() => null) as BetterAuthFailure;
  const code = payload?.code ?? payload?.error?.code;
  return (code && resetErrors[code]) || "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

/**
 * Asks for a reset link. The answer is the same whether or not the address
 * has an account, so the page never reveals who is registered.
 */
export function ForgotPasswordForm() {
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
      if (!response.ok) { setError(await failureText(response)); return; }
      setSent(true);
    } catch {
      setError("Giriş hizmetine ulaşılamıyor. Lütfen tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-form" role="status">
        <h1>E-postanı kontrol et</h1>
        <p>Bu adresle kayıtlı bir hesap varsa, şifreni sıfırlama bağlantısını gönderdik. Bağlantı 1 saat geçerli ve yalnızca bir kez kullanılabilir.</p>
        <p className="muted small">E-posta gelmediyse spam klasörüne bak ya da birkaç dakika sonra yeniden iste.</p>
        <Link className="button large full" href="/auth?mode=sign-in">Girişe dön</Link>
      </div>
    );
  }

  return (
    <form aria-labelledby="forgot-title" className="auth-form" onSubmit={submit}>
      <h1 id="forgot-title">Şifreni sıfırla</h1>
      <p className="muted">Hesabının e-posta adresini yaz; şifreni yeniden belirlemen için bir bağlantı gönderelim.</p>
      <label className="field">
        <span>E-posta</span>
        <input autoComplete="email" name="email" required type="email" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button aria-busy={pending} className="button primary large full" disabled={pending} type="submit">{pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}</button>
      <p className="alt">Şifreni hatırladın mı? <Link href="/auth?mode=sign-in">Giriş yap</Link></p>
    </form>
  );
}

/** Sets a new password with the one-time token from the e-mail; every session of the account ends. */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : resetErrors.INVALID_TOKEN!);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;
    const form = new FormData(event.currentTarget);
    const next = String(form.get("password") ?? "");
    const repeat = String(form.get("repeat") ?? "");
    if (next.length < 8) { setError(resetErrors.PASSWORD_TOO_SHORT!); return; }
    if (next !== repeat) { setError("Şifreler birbiriyle eşleşmiyor."); return; }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword: next, token }),
      });
      if (!response.ok) { setError(await failureText(response)); return; }
      setDone(true);
    } catch {
      setError("Giriş hizmetine ulaşılamıyor. Lütfen tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="auth-form" role="status">
        <h1>Şifren güncellendi</h1>
        <p>Güvenliğin için hesabındaki tüm oturumlar kapatıldı. Yeni şifrenle giriş yapabilirsin.</p>
        <Link className="button primary large full" href="/auth?mode=sign-in">Giriş yap</Link>
      </div>
    );
  }

  return (
    <form aria-labelledby="reset-title" className="auth-form" onSubmit={submit}>
      <h1 id="reset-title">Yeni şifre belirle</h1>
      <div className="field">
        <label htmlFor="reset-password">Yeni şifre</label>
        <input aria-describedby="reset-password-help" autoComplete="new-password" className="input" id="reset-password" maxLength={128} minLength={8} name="password" required type="password" />
        <small id="reset-password-help">En az 8 karakter.</small>
      </div>
      <label className="field">
        <span>Yeni şifre (tekrar)</span>
        <input autoComplete="new-password" maxLength={128} minLength={8} name="repeat" required type="password" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button aria-busy={pending} className="button primary large full" disabled={pending || !token} type="submit">{pending ? "Kaydediliyor…" : "Şifreyi kaydet"}</button>
      <p className="alt">Bağlantının süresi mi doldu? <Link href="/auth/forgot">Yeni bağlantı iste</Link></p>
    </form>
  );
}
