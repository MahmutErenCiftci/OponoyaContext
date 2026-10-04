import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * True when the module at `moduleUrl` is the script Node was started with.
 * Real paths are compared: in the API image this package is reached through a
 * pnpm symlink (`node_modules/@devcontext/db` → `node_modules/.pnpm/…`), and
 * Node reports the resolved path in `import.meta.url` but the typed one in
 * `process.argv[1]`. A plain string comparison made `migrate.js` exit 0
 * without applying anything there.
 */
export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
