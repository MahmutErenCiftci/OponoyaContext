import { createHash } from "node:crypto";
import { stableStringify, type CanonicalContext } from "./index.js";

/**
 * SHA-256 of the stable canonical JSON. Kept in its own entry point so the pure
 * compiler stays usable in environments without `node:crypto`.
 */
export function hashCanonical(context: CanonicalContext): string {
  return createHash("sha256").update(stableStringify(context)).digest("hex");
}
