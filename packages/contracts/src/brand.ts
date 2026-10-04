/**
 * Product identity shown to people: UI, page titles, icons, legal pages and
 * the header of exported context files. Renaming the product changes these
 * constants only (and `GENERATOR_NAME` in the context compiler, which a test
 * keeps equal). Technical identifiers (the `devcontext` cookie prefix, export
 * format ids, package names, file names inside bundles) are separate on
 * purpose and must stay stable: changing them would sign everyone out and
 * break imports of earlier exports.
 *
 * This module has no dependencies, so browser code that only needs the name
 * (`@devcontext/contracts/brand`) does not pull every schema and Zod along.
 */
export const productName = "hooliee";
export const productTagline = "Teknolojilerini bir kez anlat. Her projede hatırlansın.";
export const productDescription = "Araçlarını, tercihlerini ve kurallarını kodlama ajanlarının anlayacağı talimatlara dönüştür.";
/** The studio that builds the product (owner decision 2026-10-05): credited in the landing footer, linking to its own site. */
export const developerName = "Oponoya";
export const developerUrl = "https://oponoya.com";
