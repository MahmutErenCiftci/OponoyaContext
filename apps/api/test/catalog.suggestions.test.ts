import { describe, expect, it } from "vitest";
import { suggestFromLibrary } from "../src/modules/catalog/service.js";

describe("overview catalog suggestions", () => {
  it("ranks companions before alternatives and never suggests what the Library holds", () => {
    const owned = new Set(["nextjs", "shadcn-ui"]);
    const result = suggestFromLibrary(owned);
    const slugs = result.technologies.map((item) => item.technology.slug);
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.some((slug) => owned.has(slug))).toBe(false);
    expect(result.technologies[0]?.reason).toBe("pairs_with");
    const firstAlternative = result.technologies.findIndex((item) => item.reason === "alternative");
    if (firstAlternative !== -1) expect(result.technologies.slice(firstAlternative).every((item) => item.reason === "alternative")).toBe(true);
    expect(result.technologies.every((item) => item.because.every((reference) => owned.has(reference.slug)))).toBe(true);
    expect(result.stacks.every((item) => item.matched > 0)).toBe(true);
    expect(suggestFromLibrary(owned)).toEqual(result);
  });

  it("offers curated starter stacks to an empty Library", () => {
    const result = suggestFromLibrary(new Set());
    expect(result.technologies).toEqual([]);
    expect(result.stacks.length).toBeGreaterThan(0);
    expect(result.stacks.every((item) => item.matched === 0)).toBe(true);
  });
});
