import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / vendored bundles (mirrors tsconfig.json exclude):
    // ds-bundle is a gitignored generated bundle; .design-sync is committed
    // generated design-system output managed via the /design-sync pipeline.
    "ds-bundle/**",
    ".design-sync/**",
  ]),
]);

export default eslintConfig;
