"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";
import { useLocale } from "../../components/locale-provider";
import { defineCopy } from "../../lib/i18n";

type Mode = "sign-in" | "sign-up";

const copy = defineCopy({
  tr: {
    /** Better Auth answers with English messages and stable codes; the form shows its own text per code. */
    errors: {
      INVALID_EMAIL_OR_PASSWORD: "E-posta veya şifre hatalı.",
      USER_ALREADY_EXISTS: "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.",
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.",
      PASSWORD_TOO_SHORT: "Şifre en az 8 karakter olmalı.",
      PASSWORD_TOO_LONG: "Şifre en fazla 128 karakter olabilir.",
      INVALID_EMAIL: "Geçerli bir e-posta adresi yaz.",
      RATE_LIMITED: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.",
    } as Record<string, string>,
    failed: "İşlem tamamlanamadı. Lütfen tekrar dene.",
    unreachable: "Giriş hizmetine ulaşılamıyor. Lütfen tekrar dene.",
    signUp: "Hesap oluştur",
    signIn: "Giriş yap",
    name: "Adın",
    email: "E-posta",
    password: "Şifre",
    hidePassword: "Şifreyi gizle",
    showPassword: "Şifreyi göster",
    passwordHelp: "En az 8 karakter.",
    forgot: "Şifremi unuttum",
    legal: {
      before: "Hesap oluşturarak ",
      terms: "Kullanım Şartları",
      between: "’nı ve ",
      privacy: "Gizlilik Politikası",
      after: "’nı kabul etmiş olursun. Pazarlama e-postası gönderilmez.",
    },
    pending: "İşleniyor…",
    haveAccount: "Zaten hesabın var mı?",
    noAccount: "Hesabın yok mu?",
  },
  en: {
    errors: {
      INVALID_EMAIL_OR_PASSWORD: "Incorrect email or password.",
      USER_ALREADY_EXISTS: "An account with this email already exists. Try signing in.",
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "An account with this email already exists. Try signing in.",
      PASSWORD_TOO_SHORT: "Your password must be at least 8 characters.",
      PASSWORD_TOO_LONG: "Your password can be at most 128 characters.",
      INVALID_EMAIL: "Enter a valid email address.",
      RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
    },
    failed: "The request could not be completed. Please try again.",
    unreachable: "The sign-in service can't be reached. Please try again.",
    signUp: "Create account",
    signIn: "Sign in",
    name: "Your name",
    email: "Email",
    password: "Password",
    hidePassword: "Hide password",
    showPassword: "Show password",
    passwordHelp: "At least 8 characters.",
    forgot: "Forgot your password?",
    legal: {
      before: "By creating an account you accept the ",
      terms: "Terms of Use",
      between: " and the ",
      privacy: "Privacy Policy",
      after: ". We don't send marketing emails.",
    },
    pending: "Working…",
    haveAccount: "Already have an account?",
    noAccount: "Don't have an account?",
  },
});

type Copy = (typeof copy)["tr"];

function authErrorMessage(t: Copy, status: number, payload: null | { code?: string; message?: string; error?: { code?: string } }) {
  if (status === 429) return t.errors.RATE_LIMITED!;
  const code = payload?.code ?? payload?.error?.code;
  if (code && t.errors[code]) return t.errors[code];
  if (status === 401) return t.errors.INVALID_EMAIL_OR_PASSWORD!;
  return t.failed;
}

/**
 * Email/password sign-in and sign-up on one page. The narrative column is
 * rendered by the caller per mode; the form owns the request, its pending
 * state and the error message, which stays inside the form.
 */
export function AuthForm({ initialMode = "sign-up", signInNarrative, signUpNarrative, passwordReset = false }: { initialMode?: Mode; signInNarrative: ReactNode; signUpNarrative: ReactNode; passwordReset?: boolean }) {
  const router = useRouter();
  const t = copy[useLocale()];
  const [mode, setMode] = useState<Mode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    window.history.replaceState(null, "", next === "sign-in" ? "/auth?mode=sign-in" : "/auth");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const body = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      ...(mode === "sign-up" ? { name: String(form.get("name") ?? "") } : {}),
    };

    try {
      const response = await fetch(`/api/auth/${mode}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as null | { code?: string; message?: string; error?: { code?: string } };
      if (!response.ok) {
        setError(authErrorMessage(t, response.status, payload));
        return;
      }
      router.push("/workspace");
      router.refresh();
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-split">
      {mode === "sign-in" ? signInNarrative : signUpNarrative}
      <section className="auth-form-region">
        <form aria-labelledby="auth-title" className="auth-form" onSubmit={submit}>
          <h1 id="auth-title">{mode === "sign-up" ? t.signUp : t.signIn}</h1>
          {mode === "sign-up" && (
            <label className="field">
              <span>{t.name}</span>
              <input autoComplete="name" maxLength={120} name="name" required />
            </label>
          )}
          <label className="field">
            <span>{t.email}</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <div className="field">
            <label htmlFor="auth-password">{t.password}</label>
            <div className="password-control">
              <input aria-describedby={mode === "sign-up" ? "auth-password-help" : undefined} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} className="input" id="auth-password" maxLength={128} minLength={8} name="password" required type={showPassword ? "text" : "password"} />
              <button aria-label={showPassword ? t.hidePassword : t.showPassword} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} type="button">{showPassword ? <EyeSlash aria-hidden size={20} /> : <Eye aria-hidden size={20} />}</button>
            </div>
            {mode === "sign-up" && <small id="auth-password-help">{t.passwordHelp}</small>}
            {mode === "sign-in" && passwordReset && <Link className="text-link small" href="/auth/forgot">{t.forgot}</Link>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {mode === "sign-up" && (
            <p className="legal-note">{t.legal.before}<Link href="/legal/terms">{t.legal.terms}</Link>{t.legal.between}<Link href="/legal/privacy">{t.legal.privacy}</Link>{t.legal.after}</p>
          )}
          <button aria-busy={pending} className="button primary large full" disabled={pending} type="submit">
            {pending ? t.pending : mode === "sign-up" ? t.signUp : t.signIn}
          </button>
          <p className="alt">
            {mode === "sign-up" ? t.haveAccount : t.noAccount}
            <button onClick={() => switchMode(mode === "sign-up" ? "sign-in" : "sign-up")} type="button">{mode === "sign-up" ? t.signIn : t.signUp}</button>
          </p>
        </form>
      </section>
    </div>
  );
}
