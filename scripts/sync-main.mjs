import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Publishes `dev` onto `main` (owner workflow, 2026-09-10): every change lands
 * on `dev` first, and once the gate run is green this script rewrites `main` as
 * dev's tree minus the internal-only paths below. The tree is rebuilt instead of
 * merged, so a path that exists only on `dev` can never raise a modify/delete
 * conflict, and `main` stays a strict subset of `dev` by construction. History
 * too: a published commit never has a `dev` commit as its parent.
 *
 *   node scripts/sync-main.mjs [--push] [--fresh]
 *
 * `--fresh` starts `main` over as a single root commit (for a branch whose
 * earlier history still links `dev`); publishing it needs a deliberate
 * `git push --force origin main` by the owner, which `--push` never does.
 */
const root = fileURLToPath(new URL("../", import.meta.url));

/** Paths that never leave `dev`. */
const devOnly = [
  ".claude",
  "AGENTS.md",
  "CLAUDE.md",
  "MANIFEST.json",
  "README.main.md",
  "docs",
  "marketing",
  "prompts",
  "scripts/sync-main.mjs",
];

/**
 * `README.main.md` becomes `README.md` on the published branch, so that main
 * never ships links into the `docs/` and `prompts/` trees it does not carry.
 */
const readmeSource = "README.main.md";

function git(args, env = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...env },
  }).trim();
}

function revision(ref) {
  try {
    return git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  } catch {
    return null;
  }
}

const dev = revision("dev");
if (!dev) {
  console.error("Branch `dev` does not exist; nothing to publish.");
  process.exit(1);
}

const dirty = git(["status", "--porcelain"]);
if (dirty) {
  console.error("Uncommitted changes are present; commit them on `dev` first:");
  console.error(dirty);
  process.exit(1);
}

const scratch = mkdtempSync(join(tmpdir(), "sync-main-"));
let tree;
try {
  const env = { GIT_INDEX_FILE: join(scratch, "index") };
  git(["read-tree", dev], env);
  const readmeBlob = git(["rev-parse", `${dev}:${readmeSource}`]);
  git(["rm", "-r", "-f", "--cached", "--quiet", "--ignore-unmatch", "--", ...devOnly], env);
  git(["update-index", "--add", "--cacheinfo", `100644,${readmeBlob},README.md`], env);
  tree = git(["write-tree"], env);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

const main = revision("main");
const fresh = process.argv.includes("--fresh");
if (main && !fresh && git(["rev-parse", `${main}^{tree}`]) === tree) {
  console.log(JSON.stringify({ main: "up-to-date", commit: main, dev }));
  process.exit(0);
}

const subject = git(["log", "-1", "--format=%s", dev]);
// Only the previous `main` is a parent. Linking `dev` would make its whole
// history (and every dev-only path in it) reachable from `main`, so anyone who
// can fetch `main` could read the internal tree. The source commit is recorded
// in the message instead.
const parents = main && !fresh ? ["-p", main] : [];
const commit = git([
  "commit-tree",
  tree,
  ...parents,
  "-m",
  `main: publish ${dev.slice(0, 7)} from dev — ${subject}\n\nSource: dev ${dev}`,
]);
git(["update-ref", "refs/heads/main", commit, main ?? ""]);

console.log(JSON.stringify({ main: commit, dev, excluded: devOnly }));

if (process.argv.includes("--push")) {
  execFileSync("git", ["push", "origin", "dev", "main"], { cwd: root, stdio: "inherit" });
}
