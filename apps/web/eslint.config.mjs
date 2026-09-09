import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import { fixupConfigRules } from "@eslint/compat";
import tseslint from "typescript-eslint";

export default defineConfig([
  ...fixupConfigRules(nextVitals),
  { languageOptions: { parser: tseslint.parser } },
  globalIgnores([".next/**"]),
]);
