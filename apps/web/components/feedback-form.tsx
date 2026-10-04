"use client";

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { feedbackKindSchema, feedbackMessageLimits, feedbackResponseSchema, type Feedback, type FeedbackKind } from "@devcontext/contracts";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { feedbackKindDescriptions, feedbackKindLabels } from "../lib/feedback-labels";
import { responseError } from "../lib/errors";
import { defineCopy } from "../lib/i18n";
import { useLocale } from "./locale-provider";

const copy = defineCopy({
  tr: {
    tooMany: "Kısa sürede çok fazla geri bildirim gönderdin. Biraz sonra tekrar dene.",
    unreachable: "Geri bildirim şu an gönderilemiyor. Bağlantını kontrol edip tekrar dene.",
    thanks: "Teşekkürler, geri bildirimin bize ulaştı.",
    thanksText: "Her mesajı okuyoruz. Durumunu Geri bildirim sayfasından takip edebilirsin.",
    another: "Yeni bir tane gönder",
    history: "Gönderdiklerin",
    about: "Ne hakkında?",
    message: "Mesajın",
    bugPlaceholder: "Ne yapıyordun, ne olmasını bekliyordun, ne oldu?",
    placeholder: "Aklındakini birkaç cümleyle yaz.",
    minimum: (min: number) => `En az ${min} karakter`,
    sending: "Gönderiliyor…",
    send: "Gönder",
  },
  en: {
    tooMany: "You sent a lot of feedback in a short time. Try again in a little while.",
    unreachable: "Feedback can't be sent right now. Check your connection and try again.",
    thanks: "Thank you, your feedback reached us.",
    thanksText: "We read every message. You can follow its status on the Feedback page.",
    another: "Send another one",
    history: "What you sent",
    about: "What is it about?",
    message: "Your message",
    bugPlaceholder: "What were you doing, what did you expect, and what happened?",
    placeholder: "Write what's on your mind in a few sentences.",
    minimum: (min: number) => `At least ${min} characters`,
    sending: "Sending…",
    send: "Send",
  },
});

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
  const locale = useLocale();
  const t = copy[locale];
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
        setError(response.status === 429 ? t.tooMany : await responseError(response));
        return;
      }
      const parsed = feedbackResponseSchema.safeParse(await response.json());
      setSent(true);
      setMessage("");
      if (parsed.success) onSent?.(parsed.data.feedback);
    } catch {
      setError(t.unreachable);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="feedback-sent" role="status">
        <CheckCircle aria-hidden size={40} weight="duotone" />
        <strong>{t.thanks}</strong>
        <p className="muted">{t.thanksText}</p>
        <div className="actions">
          <button className="button" onClick={() => setSent(false)} type="button">{t.another}</button>
          {showHistoryLink && <Link className="button quiet" href="/workspace/feedback">{t.history}</Link>}
        </div>
      </div>
    );
  }

  return (
    <form className="feedback-form" onSubmit={submit}>
      <fieldset className="feedback-kinds">
        <legend className="field-label">{t.about}</legend>
        <div className="radio-grid">
          {feedbackKindSchema.options.map((option) => (
            <label className={`radio-card${kind === option ? " selected" : ""}`} key={option}>
              <input checked={kind === option} name={`${id}-kind`} onChange={() => setKind(option)} type="radio" value={option} />
              <strong>{feedbackKindLabels[locale][option]}</strong>
              <span>{feedbackKindDescriptions[locale][option]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>{t.message}</span>
        <textarea
          data-autofocus
          maxLength={feedbackMessageLimits.max}
          minLength={feedbackMessageLimits.min}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={kind === "bug" ? t.bugPlaceholder : t.placeholder}
          required
          rows={6}
          value={message}
        />
        <small>{length < feedbackMessageLimits.min ? t.minimum(feedbackMessageLimits.min) : `${message.length} / ${feedbackMessageLimits.max}`}</small>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="actions">
        <button className="button primary" disabled={pending || length < feedbackMessageLimits.min} type="submit">{pending ? t.sending : t.send}</button>
      </div>
    </form>
  );
}
