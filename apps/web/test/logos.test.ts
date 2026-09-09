import { describe, expect, it } from "vitest";
import { catalogSlugFor, logoColors, logoForSlug, logoSource, luminance, monogram } from "../lib/logos";

describe("technology logos", () => {
  it("ships Simple Icons metadata for catalog entries", () => {
    expect(logoSource).toMatchObject({ name: "simple-icons", license: "CC0-1.0" });
    expect(logoForSlug("nextjs")).toMatchObject({ icon: "nextdotjs", title: "Next.js" });
    expect(logoForSlug("postgresql")?.hex).toMatch(/^[0-9A-F]{6}$/);
    expect(logoForSlug("not-a-technology")).toBeNull();
    expect(logoForSlug(null)).toBeNull();
  });

  it("matches Library resources by catalog metadata, documentation host or name", () => {
    expect(catalogSlugFor({ name: "Anything", metadata: { catalogSlug: "react" } })).toBe("react");
    expect(catalogSlugFor({ name: "My framework", sourceUrl: "https://www.nextjs.org/docs" })).toBe("nextjs");
    expect(catalogSlugFor({ name: "Sample · PostgreSQL" })).toBe("postgresql");
    expect(catalogSlugFor({ name: "shadcn/ui" })).toBe("shadcn-ui");
    expect(catalogSlugFor({ name: "Internal design system", sourceUrl: "https://github.com/acme/design" })).toBeNull();
  });

  it("keeps brand colours readable on both themes and builds monograms", () => {
    expect(luminance("ffffff")).toBeCloseTo(1, 5);
    expect(luminance("000000")).toBe(0);
    expect(logoColors("000000")).toEqual({ onDark: "var(--text)", onLight: "#000000" });
    expect(logoColors("FFFFFF")).toEqual({ onDark: "#FFFFFF", onLight: "var(--text)" });
    expect(logoColors("61DAFB").onDark).toBe("#61DAFB");
    expect(monogram("Sample · Better Auth")).toBe("BA");
    expect(monogram("shadcn/ui")).toBe("SU");
  });
});
