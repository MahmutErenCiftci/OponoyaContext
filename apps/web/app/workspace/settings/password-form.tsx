"use client";

import { changePasswordResponseSchema } from "@devcontext/contracts";
import { useId, useState, type FormEvent } from "react";
import { readApiError } from "../../../lib/errors";

const failureText: Record<string, string> = {
  invalid_password: "Mevcut şifre doğru değil. Hiçbir şey değişmedi.",
};

/**
 * Password change for the signed-in account. The API checks the current
 * password, signs out every other session and renews this one, so a leaked
 * password stops working everywhere else at once.
 */
export function PasswordForm({ onNotice }: { onNotice(text: string): void }) {
  const id = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (next.length < 8) { setError("Yeni şifre en az 8 karakter olmalı."); return; }
    if (next !== repeat) { setError("Yeni şifreler birbiriyle eşleşmiyor."); return; }
    if (next === current) { setError("Yeni şifre mevcut şifreden farklı olmalı."); return; }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!response.ok) {
        const failure = await readApiError(response);
        const code = failure.details.find((detail) => detail.code in failureText)?.code;
        setError(code ? failureText[code]! : failure.message);
        setCurrent("");
        return;
      }
      changePasswordResponseSchema.parse(await response.json());
      setCurrent("");
      setNext("");
      setRepeat("");
      onNotice("Şifren değiştirildi. Diğer cihazlardaki oturumların kapatıldı.");
    } catch {
      setError("Hesap hizmetine ulaşılamıyor. Şifren değişmedi; tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form aria-labelledby={`${id}-title`} className="numbered-section" onSubmit={submit}>
      <h3 id={`${id}-title`}>Şifreyi değiştir</h3>
      <p>Değiştirdiğinde bu cihaz dışındaki tüm oturumların kapatılır.</p>
      <div className="field-row">
        <label className="field">
          <span>Mevcut şifre</span>
          <input autoComplete="current-password" maxLength={128} onChange={(event) => setCurrent(event.target.value)} required type="password" value={current} />
        </label>
        <span aria-hidden="true" />
        <label className="field">
          <span>Yeni şifre</span>
          <input autoComplete="new-password" maxLength={128} minLength={8} onChange={(event) => setNext(event.target.value)} required type="password" value={next} />
        </label>
        <label className="field">
          <span>Yeni şifre (tekrar)</span>
          <input autoComplete="new-password" maxLength={128} minLength={8} onChange={(event) => setRepeat(event.target.value)} required type="password" value={repeat} />
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions">
        <button className="button" disabled={pending} type="submit">{pending ? "Değiştiriliyor…" : "Şifreyi değiştir"}</button>
      </div>
    </form>
  );
}
