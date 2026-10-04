"use client";

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { feedbackKindSchema, feedbackMessageLimits, feedbackResponseSchema, type Feedback, type FeedbackKind } from "@devcontext/contracts";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { feedbackKindDescriptions, feedbackKindLabels } from "../lib/feedback-labels";
import { responseError } from "../lib/errors";

/**
 * Suggestion, complaint or bug report. Shared by the top-bar drawer and the
 * feedback page; `pagePath` tells the operator where the user was.
 */
export function FeedbackForm({ pagePath, onSent, showHistoryLink = false }: {
  pagePath?: string | undefined;
  onSent?(feedback: Feedback): void;
  showHistoryLink?: boolean;
}) {
  const id = useId();
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const length = message.trim().length;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (length < feedbackMessageLimits.min || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, message, ...(pagePath ? { pagePath: pagePath.slice(0, 300) } : {}) }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? "Kısa sürede çok fazla geri bildirim gönderdin. Biraz sonra tekrar dene." : await responseError(response));
        return;
      }
      const parsed = feedbackResponseSchema.safeParse(await response.json());
      setSent(true);
      setMessage("");
      if (parsed.success) onSent?.(parsed.data.feedback);
    } catch {
      setError("Geri bildirim şu an gönderilemiyor. Bağlantını kontrol edip tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="feedback-sent" role="status">
        <CheckCircle aria-hidden size={40} weight="duotone" />
        <strong>Teşekkürler, geri bildirimin bize ulaştı.</strong>
        <p className="muted">Her mesajı okuyoruz. Durumunu Geri bildirim sayfasından takip edebilirsin.</p>
        <div className="actions">
          <button className="button" onClick={() => setSent(false)} type="button">Yeni bir tane gönder</button>
          {showHistoryLink && <Link className="button quiet" href="/workspace/feedback">Gönderdiklerin</Link>}
        </div>
      </div>
    );
  }

  return (
    <form className="feedback-form" onSubmit={submit}>
      <fieldset className="feedback-kinds">
        <legend className="field-label">Ne hakkında?</legend>
        <div className="radio-grid">
          {feedbackKindSchema.options.map((option) => (
            <label className={`radio-card${kind === option ? " selected" : ""}`} key={option}>
              <input checked={kind === option} name={`${id}-kind`} onChange={() => setKind(option)} type="radio" value={option} />
              <strong>{feedbackKindLabels[option]}</strong>
              <span>{feedbackKindDescriptions[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Mesajın</span>
        <textarea
          data-autofocus
          maxLength={feedbackMessageLimits.max}
          minLength={feedbackMessageLimits.min}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={kind === "bug" ? "Ne yapıyordun, ne olmasını bekliyordun, ne oldu?" : "Aklındakini birkaç cümleyle yaz."}
          required
          rows={6}
          value={message}
        />
        <small>{length < feedbackMessageLimits.min ? `En az ${feedbackMessageLimits.min} karakter` : `${message.length} / ${feedbackMessageLimits.max}`}</small>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions">
        <button className="button primary" disabled={pending || length < feedbackMessageLimits.min} type="submit">{pending ? "Gönderiliyor…" : "Gönder"}</button>
      </div>
    </form>
  );
}
