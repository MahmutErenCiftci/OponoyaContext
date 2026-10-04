"use client";

import { changePasswordResponseSchema } from "@devcontext/contracts";
import { useId, useState, type FormEvent } from "react";
import { useLocale } from "../../../components/locale-provider";
import { readApiError } from "../../../lib/errors";
import { defineCopy } from "../../../lib/i18n";

const copy = defineCopy({
  tr: {
    failures: {
      invalid_password: "Mevcut şifre doğru değil. Hiçbir şey değişmedi.",
    } as Record<string, string>,
    tooShort: "Yeni şifre en az 8 karakter olmalı.",
    mismatch: "Yeni şifreler birbiriyle eşleşmiyor.",
    unchanged: "Yeni şifre mevcut şifreden farklı olmalı.",
    changed: "Şifren değiştirildi. Diğer cihazlardaki oturumların kapatıldı.",
    unreachable: "Hesap hizmetine ulaşılamıyor. Şifren değişmedi; tekrar dene.",
    title: "Şifreyi değiştir",
    lead: "Değiştirdiğinde bu cihaz dışındaki tüm oturumların kapatılır.",
    current: "Mevcut şifre",
    next: "Yeni şifre",
    repeat: "Yeni şifre (tekrar)",
    changing: "Değiştiriliyor…",
    submit: "Şifreyi değiştir",
  },
  en: {
    failures: {
      invalid_password: "The current password is not correct. Nothing changed.",
    },
    tooShort: "The new password must be at least 8 characters.",
    mismatch: "The new passwords do not match.",
    unchanged: "The new password must differ from the current one.",
    changed: "Your password was changed. Your sessions on other devices were signed out.",
    unreachable: "The account service can't be reached. Your password did not change; try again.",
    title: "Change password",
    lead: "Changing it signs out all your sessions except this device.",
    current: "Current password",
    next: "New password",
    repeat: "New password (again)",
    changing: "Changing…",
    submit: "Change password",
  },
});

/**
 * Password change for the signed-in account. The API checks the current
 * password, signs out every other session and renews this one, so a leaked
 * password stops working everywhere else at once.
 */
export function PasswordForm({ onNotice }: { onNotice(text: string): void }) {
  const id = useId();
  const t = copy[useLocale()];
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (next.length < 8) { setError(t.tooShort); return; }
    if (next !== repeat) { setError(t.mismatch); return; }
    if (next === current) { setError(t.unchanged); return; }
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
        const code = failure.details.find((detail) => detail.code in t.failures)?.code;
        setError(code ? t.failures[code]! : failure.message);
        setCurrent("");
        return;
      }
      changePasswordResponseSchema.parse(await response.json());
      setCurrent("");
      setNext("");
      setRepeat("");
      onNotice(t.changed);
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(false);
    }
  }

  return (
    <form aria-labelledby={`${id}-title`} className="numbered-section" onSubmit={submit}>
      <h3 id={`${id}-title`}>{t.title}</h3>
      <p>{t.lead}</p>
      <div className="field-row">
        <label className="field">
          <span>{t.current}</span>
          <input autoComplete="current-password" maxLength={128} onChange={(event) => setCurrent(event.target.value)} required type="password" value={current} />
        </label>
        <span aria-hidden="true" />
        <label className="field">
          <span>{t.next}</span>
          <input autoComplete="new-password" maxLength={128} minLength={8} onChange={(event) => setNext(event.target.value)} required type="password" value={next} />
        </label>
        <label className="field">
          <span>{t.repeat}</span>
          <input autoComplete="new-password" maxLength={128} minLength={8} onChange={(event) => setRepeat(event.target.value)} required type="password" value={repeat} />
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions">
        <button className="button" disabled={pending} type="submit">{pending ? t.changing : t.submit}</button>
      </div>
    </form>
  );
}
