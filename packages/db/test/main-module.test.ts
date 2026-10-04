import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { isMainModule } from "../src/main-module.js";

const originalEntry = process.argv[1];
let root: string | undefined;

afterEach(() => {
  process.argv[1] = originalEntry as string;
  if (root) rmSync(root, { recursive: true, force: true });
  root = undefined;
});

/** A script inside `real/` that is also reachable through the directory link `link/`, like a pnpm package. */
function linkedScript() {
  root = mkdtempSync(join(tmpdir(), "main-module-"));
  const real = join(root, "real");
  mkdirSync(real);
  const script = join(real, "migrate.js");
  writeFileSync(script, "");
  symlinkSync(real, join(root, "link"), "junction");
  return { script, viaLink: join(root, "link", "migrate.js") };
}

describe("isMainModule", () => {
  it("recognises a script started through a symlinked package directory", () => {
    const { script, viaLink } = linkedScript();
    process.argv[1] = viaLink;
    expect(isMainModule(pathToFileURL(script).href)).toBe(true);
    process.argv[1] = script;
    expect(isMainModule(pathToFileURL(script).href)).toBe(true);
  });

  it("is false for another entry script, a missing one or none", () => {
    const { script } = linkedScript();
    process.argv[1] = join(root as string, "real", "other.js");
    expect(isMainModule(pathToFileURL(script).href)).toBe(false);
    process.argv.splice(1, 1);
    expect(isMainModule(pathToFileURL(script).href)).toBe(false);
  });
});
