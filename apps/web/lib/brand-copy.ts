import { productDescription, productTagline } from "@devcontext/contracts/brand";
import { defineCopy } from "./i18n";

/** Tagline and description per language; Turkish stays the single source in `@devcontext/contracts/brand`. */
export const brandCopy = defineCopy({
  tr: { tagline: productTagline, description: productDescription },
  en: {
    tagline: "Describe your stack once. Every project remembers it.",
    description: "Turn your tools, preferences and rules into instructions your coding agents understand.",
  },
});
