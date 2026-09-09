import { describe, expect, it } from "vitest";
import type { ContextVersion } from "@devcontext/contracts";
import { createZip, crc32, readZip } from "../src/lib/zip.js";
import { buildBundle, bundleCanonicalFileName, bundleManifestFileName } from "../src/modules/context/service.js";

const projectId = "00000000-0000-4000-8000-000000000030";
const version: ContextVersion = {
  id: "00000000-0000-4000-8000-000000000050", version: 3, compilerVersion: "0.4.0", contentHash: "b".repeat(64), decisionCount: 0, warningCount: 0, createdAt: new Date().toISOString(),
  canonical: { compilerVersion: "0.4.0", project: { id: projectId, name: "Atlas Finance", slug: "atlas-finance-1234abcd", description: null, productType: null, stage: "mvp", platforms: [], priorities: [] }, decisions: [], resources: [], rules: ["Keep it boring."], warnings: [] },
  previews: [
    { target: "generic", fileName: "PROJECT_CONTEXT.md", content: "# Project Context — Atlas Finance\n" },
    { target: "agents", fileName: "AGENTS.md", content: "# AGENTS.md — Atlas Finance\n" },
    { target: "claude", fileName: "CLAUDE.md", content: "# CLAUDE.md — Atlas Finance\n" },
    { target: "cursor", fileName: ".cursor/rules/devcontext.mdc", content: "---\nalwaysApply: true\n---\n" },
    { target: "copilot", fileName: ".github/copilot-instructions.md", content: "# Copilot instructions — Atlas Finance\n" },
  ],
};

describe("deterministic zip writer", () => {
  it("round-trips UTF-8 entries with valid checksums and byte-stable output", () => {
    const entries = [{ path: "b/second.md", content: "ünïcödé ✓\n" }, { path: "a.txt", content: Buffer.from([0, 1, 2, 255]) }];
    const archive = createZip(entries);
    expect(archive.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(createZip([...entries].reverse()).equals(archive)).toBe(true);
    const read = readZip(archive);
    expect(read.map((entry) => entry.path)).toEqual(["a.txt", "b/second.md"]);
    expect(Buffer.from(read[1]!.content).toString("utf8")).toBe("ünïcödé ✓\n");
    expect(Buffer.from(read[0]!.content)).toEqual(Buffer.from([0, 1, 2, 255]));
    expect(crc32(Buffer.from("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });

  it("refuses unsafe archive paths", () => {
    for (const path of ["../escape.md", "/abs.md", "dir//x", "bad name.md", "..", "a/../b"]) {
      expect(() => createZip([{ path, content: "x" }]), path).toThrow(/Unsafe archive path/);
    }
  });

  it("bundles every export target with the canonical JSON and a manifest under stable names", () => {
    const bundle = buildBundle(version);
    expect(bundle.fileName).toBe("atlas-finance-1234abcd-context-v3.zip");
    const entries = readZip(bundle.content);
    expect(entries.map((entry) => entry.path)).toEqual([
      ".cursor/rules/devcontext.mdc",
      ".github/copilot-instructions.md",
      "AGENTS.md",
      "CLAUDE.md",
      "PROJECT_CONTEXT.md",
      bundleManifestFileName,
      bundleCanonicalFileName,
    ]);
    const manifest = JSON.parse(Buffer.from(entries.find((entry) => entry.path === bundleManifestFileName)!.content).toString("utf8")) as Record<string, unknown>;
    expect(manifest).toMatchObject({ format: "devcontext-bundle", version: 1, contextVersion: 3, compilerVersion: "0.4.0", contentHash: version.contentHash, project: { id: projectId, name: "Atlas Finance" } });
    expect(manifest.files).toEqual([".cursor/rules/devcontext.mdc", ".github/copilot-instructions.md", "AGENTS.md", "CLAUDE.md", "PROJECT_CONTEXT.md", bundleCanonicalFileName]);
    const canonical = JSON.parse(Buffer.from(entries.find((entry) => entry.path === bundleCanonicalFileName)!.content).toString("utf8")) as { rules: string[] };
    expect(canonical.rules).toEqual(["Keep it boring."]);
    expect(buildBundle(version).content.equals(bundle.content)).toBe(true);
    expect(buildBundle({ ...version, canonical: { ...version.canonical, project: { ...version.canonical.project, slug: null, name: "Ünsafe / name" } } }).fileName).toBe("nsafe-name-context-v3.zip");
  });
});
