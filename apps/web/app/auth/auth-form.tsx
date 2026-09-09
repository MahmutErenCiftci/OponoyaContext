"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";

type Mode = "sign-in" | "sign-up";

/**
 * Email/password sign-in and sign-up on one page. The narrative column is
 * rendered by the caller per mode; the form owns the request, its pending
 * state and the error message, which stays inside the form.
 */
export function AuthForm({ initialMode = "sign-up", signInNarrative, signUpNarrative }: { initialMode?: Mode; signInNarrative: ReactNode; signUpNarrative: ReactNode }) {
  const router = useRouter();
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
      const payload = await response.json().catch(() => null) as null | { message?: string; error?: { message?: string } };
      if (!response.ok) {
        setError(payload?.message ?? payload?.error?.message ?? "İşlem tamamlanamadı. Lütfen tekrar dene.");
        return;
      }
      router.push("/workspace");
      router.refresh();
    } catch {
      setError("Giriş hizmetine ulaşılamıyor. Lütfen tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-split">
      {mode === "sign-in" ? signInNarrative : signUpNarrative}
      <section className="auth-form-region">
        <form aria-labelledby="auth-title" className="auth-form" onSubmit={submit}>
          <h1 id="auth-title">{mode === "sign-up" ? "Hesap oluştur" : "Giriş yap"}</h1>
          {mode === "sign-up" && (
            <label className="field">
              <span>Adın</span>
              <input autoComplete="name" maxLength={120} name="name" required />
            </label>
          )}
          <label className="field">
            <span>E-posta</span>
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <div className="field">
            <label htmlFor="auth-password">Şifre</label>
            <div className="password-control">
              <input aria-describedby={mode === "sign-up" ? "auth-password-help" : undefined} autoComplete={mode === "sign-up" ? "new-password" : "current-password"} className="input" id="auth-password" minLength={8} name="password" required type={showPassword ? "text" : "password"} />
              <button aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} type="button">{showPassword ? <EyeSlash aria-hidden size={20} /> : <Eye aria-hidden size={20} />}</button>
            </div>
            {mode === "sign-up" && <small id="auth-password-help">En az 8 karakter.</small>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {mode === "sign-up" && (
            <p className="legal-note">Hesap oluşturarak <Link href="/legal/terms">Kullanım Şartları</Link>’nı ve <Link href="/legal/privacy">Gizlilik Politikası</Link>’nı kabul etmiş olursun. Pazarlama e-postası gönderilmez.</p>
          )}
          <button aria-busy={pending} className="button primary large full" disabled={pending} type="submit">
            {pending ? "İşleniyor…" : mode === "sign-up" ? "Hesap oluştur" : "Giriş yap"}
          </button>
          <p className="alt">
            {mode === "sign-up" ? "Zaten hesabın var mı?" : "Hesabın yok mu?"}
            <button onClick={() => switchMode(mode === "sign-up" ? "sign-in" : "sign-up")} type="button">{mode === "sign-up" ? "Giriş yap" : "Hesap oluştur"}</button>
          </p>
        </form>
      </section>
    </div>
  );
}
