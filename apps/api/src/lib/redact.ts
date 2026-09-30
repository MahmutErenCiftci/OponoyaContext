import { createHash } from "node:crypto";

/**
 * Best-effort scrubbing for text that may end up in logs. It masks connection
 * strings, credentials, bearer tokens, e-mail addresses, long hex strings and
 * PostgreSQL key details, then bounds the length. It is a safety net: callers
 * still must not log request bodies, cookies or Resource content on purpose.
 *
 * Input is cut to `scanLimit` characters before any pattern runs and every
 * quantifier is bounded, so hostile text (error messages can echo request
 * values) costs linear time.
 */
const scanLimit = 2_000;

const replacements: Array<[RegExp, string]> = [
  [/\b(postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?|amqps?|https?):\/\/[^\s"'`)]{1,2048}/gi, "$1://[redacted]"],
  [/\b(bearer|basic)\s+[a-z0-9._~+/=-]{8,4096}/gi, "$1 [redacted]"],
  [/\b([\w.-]{0,64}?(?:secret|token|passw(?:or)?d|passwd|pwd|api[_-]?key|cookie|authorization)[\w.-]{0,64})(\s{0,8}[=:]\s{0,8})(?:"[^"]{0,512}"|'[^']{0,512}'|[^\s,;&]{1,512})/gi, "$1$2[redacted]"],
  [/Key \([^)]{0,512}\)=\([^)]{0,2048}\)/g, "Key ([redacted])"],
  [/[\w.+%-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63}){1,8}/g, "[email]"],
  [/\b[a-f0-9]{32,256}\b/gi, "[hex]"],
];

export function redactText(value: string, limit = 400): string {
  let text = value.length > scanLimit ? value.slice(0, scanLimit) : value;
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

/**
 * Query-builder errors wrap the driver error in a message that repeats the SQL
 * and every bound parameter, i.e. request data. Summaries describe the driver
 * error underneath instead.
 */
function unwrapQueryError(error: unknown): unknown {
  if (error instanceof Error && error.name === "DrizzleQueryError" && error.cause !== undefined) return error.cause;
  return error;
}

export function summarizeError(original: unknown): ErrorSummary {
  const error = unwrapQueryError(original);
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  const stackSource = original instanceof Error && original.stack ? original.stack : error instanceof Error ? error.stack ?? "" : "";
  const frames = stackSource.split("\n").slice(1, 40)
    .map((line) => redactText(line.trim(), 200))
    .filter((line) => line.startsWith("at "))
    .slice(0, 5);
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
