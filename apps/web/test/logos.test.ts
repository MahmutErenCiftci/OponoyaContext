import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../lib/logo-manifest.json";
import { catalogSlugFor, contrastRatio, logoColors, logoForSlug, logoSource, luminance, minimumLogoContrast, monogram } from "../lib/logos";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");
const logoDir = fileURLToPath(new URL("../public/logos/", import.meta.url));

describe("technology logos", () => {
  it("ships Simple Icons metadata for catalog entries", () => {
    expect(logoSource).toMatchObject({ name: "simple-icons", license: "CC0-1.0" });
    expect(logoForSlug("nextjs")).toMatchObject({ icon: "nextdotjs", title: "Next.js" });
    expect(logoForSlug("postgresql")?.hex).toMatch(/^[0-9A-F]{6}$/);
    expect(logoForSlug("not-a-technology")).toBeNull();
    expect(logoForSlug(null)).toBeNull();
  });

  it("keeps the manifest and the served files in step", () => {
    const files = new Set(readdirSync(logoDir).filter((file) => file.endsWith(".svg")).map((file) => file.slice(0, -4)));
    const slugs = Object.keys(manifest.logos);
    for (const slug of slugs) expect(files.has(slug), `${slug}.svg`).toBe(true);
    for (const file of files) expect(slugs, `orphan ${file}.svg`).toContain(file);
    for (const slug of slugs) {
      const svg = readFileSync(`${logoDir}${slug}.svg`, "utf8");
      expect(svg, slug).toMatch(/^<svg[^>]*viewBox="0 0 24 24"/);
      // Served from the app origin: no script, handlers, foreign objects or external references.
      expect(svg, slug).not.toMatch(/<script|\son\w+=|foreignObject|href=|<use|<image|javascript:|data:/i);
    }
    // Name and host matches may point at catalog entries without a mark; the lookup then falls back to the monogram.
    for (const [name, target] of Object.entries(manifest.names)) {
      const resolved = catalogSlugFor({ name });
      expect(resolved === null || existsSync(`${logoDir}${resolved}.svg`), `${name} → ${target}`).toBe(true);
    }
  });

  it("matches Library resources by catalog metadata, documentation host or name", () => {
    expect(catalogSlugFor({ name: "Anything", metadata: { catalogSlug: "react" } })).toBe("react");
    expect(catalogSlugFor({ name: "My framework", sourceUrl: "https://www.nextjs.org/docs" })).toBe("nextjs");
    expect(catalogSlugFor({ name: "Sample · PostgreSQL" })).toBe("postgresql");
    expect(catalogSlugFor({ name: "shadcn/ui" })).toBe("shadcn-ui");
    expect(catalogSlugFor({ name: "Internal design system", sourceUrl: "https://github.com/acme/design" })).toBeNull();
  });

  it("never resolves user data to Object.prototype members", () => {
    for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
      expect(logoForSlug(key)).toBeNull();
      expect(catalogSlugFor({ name: key, metadata: { catalogSlug: key } })).toBeNull();
    }
    expect(catalogSlugFor({ name: "x", sourceUrl: "not a url" })).toBeNull();
  });

  it("paints every brand colour visibly on both themes with an existing token", () => {
    expect(luminance("ffffff")).toBeCloseTo(1, 5);
    expect(luminance("000000")).toBe(0);
    expect(logoColors("000000")).toEqual({ onDark: "var(--ink)", onLight: "#000000" });
    expect(logoColors("FFFFFF")).toEqual({ onDark: "#FFFFFF", onLight: "var(--ink)" });
    // React's pale cyan is too faint on white but reads on the dark surface.
    expect(logoColors("61DAFB")).toEqual({ onDark: "#61DAFB", onLight: "var(--ink)" });
    // The fallback token exists in both palettes (regression: an undefined `--text` made 70 marks transparent).
    expect(css).toMatch(/:root \{[^}]*--ink:/);
    expect(css).toMatch(/:root\[data-theme="dark"\] \{[^}]*--ink:/);
    for (const [slug, entry] of Object.entries(manifest.logos)) {
      const colors = logoColors(entry.hex);
      for (const [surface, value] of [["ffffff", colors.onLight], ["111419", colors.onDark]] as const) {
        if (value.startsWith("var(")) {
          expect(value, slug).toBe("var(--ink)");
          continue;
        }
        expect(contrastRatio(luminance(value), luminance(surface)), `${slug} on ${surface}`).toBeGreaterThanOrEqual(minimumLogoContrast);
      }
    }
  });

  it("builds letter-only monograms", () => {
    expect(monogram("Sample · Better Auth")).toBe("BA");
    expect(monogram("shadcn/ui")).toBe("SU");
    expect(monogram("dbt (Data Build Tool)")).toBe("DD");
    expect(monogram("İYS (İleti Yönetim Sistemi)")).toBe("İİ");
    expect(monogram("(()) ")).toBe("?");
  });
});
