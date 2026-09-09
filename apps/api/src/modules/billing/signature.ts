import { createHmac, timingSafeEqual } from "node:crypto";

/** Header carrying `t=<unix seconds>,v1=<hex hmac>` computed over `${t}.${rawBody}`. */
export const signatureHeader = "x-devcontext-signature";
export const signatureToleranceSeconds = 300;

function digest(secret: string, timestamp: number, rawBody: Buffer | string) {
  return createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
}

export function signWebhook(secret: string, rawBody: Buffer | string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${digest(secret, timestamp, rawBody)}`;
}

export type SignatureVerdict =
  | { ok: true; timestamp: number }
  | { ok: false; reason: "missing" | "malformed" | "expired" | "mismatch" };

/**
 * Verifies the signature against the raw request body (never a re-serialised
 * object) with a timestamp tolerance so captured requests cannot be replayed
 * later. Comparison is constant-time.
 */
export function verifyWebhookSignature(secret: string, rawBody: Buffer | string, header: string | undefined, now: Date, tolerance = signatureToleranceSeconds): SignatureVerdict {
  if (!header) return { ok: false, reason: "missing" };
  const parts = Object.fromEntries(header.split(",").map((part) => part.trim().split("=") as [string, string]));
  const timestamp = Number.parseInt(parts.t ?? "", 10);
  const provided = parts.v1;
  if (!Number.isFinite(timestamp) || !provided || !/^[0-9a-f]{64}$/i.test(provided)) return { ok: false, reason: "malformed" };
  if (Math.abs(now.getTime() / 1000 - timestamp) > tolerance) return { ok: false, reason: "expired" };
  const expected = Buffer.from(digest(secret, timestamp, rawBody), "hex");
  const actual = Buffer.from(provided, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { ok: false, reason: "mismatch" };
  return { ok: true, timestamp };
}
