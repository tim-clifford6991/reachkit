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
  // env-only-in-lib/config (CLAUDE.md consistency harness): all env access goes
  // through lib/config/env.ts. Exempt as literals: NODE_ENV and NEXT_PUBLIC_*
  // (Next.js inlines these at build time — routing them through env.ts would
  // break client bundles).
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^(?!NODE_ENV$|NEXT_PUBLIC_|VERCEL_)/]",
          message:
            "Read env through lib/config/env.ts (CLAUDE.md: env-only-in-lib/config). Only NODE_ENV, NEXT_PUBLIC_* (build-time inlined) and VERCEL_* (platform-injected) may be read as literals.",
        },
      ],
    },
  },
  {
    files: [
      "lib/config/**",
      "**/*.test.*",
      "tests/**",
      "scripts/**",
      "vitest*.config.ts",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
]);

export default eslintConfig;
