import { createHash } from "node:crypto";

/**
 * Best-effort scrubbing for text that may end up in logs. It masks connection
 * strings, credentials, bearer tokens, e-mail addresses, long hex strings and
 * PostgreSQL key details, then bounds the length. It is a safety net: callers
 * still must not log request bodies, cookies or Resource content on purpose.
 */
const replacements: Array<[RegExp, string]> = [
  [/\b(postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?|amqps?|https?):\/\/[^\s"'`)]+/gi, "$1://[redacted]"],
  [/\b(bearer|basic)\s+[a-z0-9._~+/=-]{8,}/gi, "$1 [redacted]"],
  [/\b([\w.-]*(?:secret|token|password|passwd|pwd|api[_-]?key|cookie|authorization)[\w.-]*)(\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi, "$1$2[redacted]"],
  [/Key \([^)]*\)=\([^)]*\)/g, "Key ([redacted])"],
  [/[\w.+%-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]"],
  [/\b[a-f0-9]{32,}\b/gi, "[hex]"],
];

export function redactText(value: string, limit = 400): string {
  let text = value;
  for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export type ErrorSummary = {
  name: string;
  /** Driver/library code such as a PostgreSQL SQLSTATE; never user data. */
  code: string | null;
  constraint: string | null;
  /** Stable identifier for grouping: hash of the error name and its first stack frame. */
  fingerprint: string;
  /** Stack frames without the message line, limited to the top of the stack. */
  frames: string[];
  /** Redacted message; only logged at debug level. */
  message: string;
};

function readString(error: object, key: string): string | null {
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export function summarizeError(error: unknown): ErrorSummary {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && error.stack ? error.stack.split("\n").slice(1) : [];
  const frames = stack.map((line) => redactText(line.trim(), 200)).filter((line) => line.startsWith("at ")).slice(0, 5);
  const fingerprint = createHash("sha256").update(`${name}\n${frames[0] ?? ""}`).digest("hex").slice(0, 12);
  return {
    name,
    code: typeof error === "object" && error !== null ? readString(error, "code") : null,
    constraint: typeof error === "object" && error !== null ? readString(error, "constraint") : null,
    fingerprint,
    frames,
    message: redactText(message),
  };
}
