/**
 * Architecture ratchet (pnpm check:arch).
 *
 * Encodes the layer boundaries documented in docs/architecture.md as
 * machine-checked import rules, so drift fails CI/pre-commit instead of rotting
 * silently. Each rule maps to a CLAUDE.md invariant / known risk. Adding a rule
 * that the current tree violates is forbidden — strengthen forward, never break
 * the baseline (see CLAUDE.md → "Consistency harness + Change Protocol").
 *
 * Note: the "env only in lib/config/env.ts" invariant is NOT enforced here —
 * process.env access is not an import edge (10 call sites read it today). Tracked
 * as a follow-up; enforce via an eslint no-process-env pass once those are moved.
 */
const TESTS = "\\.(test|spec)\\.(ts|tsx)$";

module.exports = {
  forbidden: [
    {
      name: "no-lib-to-app",
      comment: "The engine (lib/) must never import the route/UI layer (app/). One-way dependency — architecture.md Directory map.",
      severity: "error",
      from: { path: "^lib/" },
      to: { path: "^app/" },
    },
    {
      name: "no-domain-to-components",
      comment: "Domain logic (scan/llm/billing) must not import React components. Tests are exempt.",
      severity: "error",
      from: { path: "^lib/(scan|llm|billing)/", pathNot: TESTS },
      to: { path: "^components/" },
    },
    {
      name: "anthropic-only-in-llm",
      comment: "The Anthropic SDK is an adapter — importable only from lib/llm/ (AI is always isolated behind an adapter). CLAUDE.md.",
      severity: "error",
      from: { pathNot: "^lib/llm/" },
      to: { path: "node_modules/@anthropic-ai/sdk" },
    },
    {
      name: "supabase-only-in-db-auth",
      comment: "Supabase is reached only through lib/db, lib/auth, or middleware.ts — the sole DB/session touch-points.",
      severity: "error",
      from: { pathNot: "^(lib/db/|lib/auth/|middleware\\.ts)" },
      to: { path: "node_modules/@supabase/" },
    },
    {
      name: "no-prod-to-scaffolding",
      comment: "Production surfaces must never import dev scaffolding (app/design, app/test-*, app/api/test-*). Guards the 'dev scaffolding surface' open risk.",
      severity: "error",
      from: { path: "^app/", pathNot: "^app/(design/|test-|api/test-)" },
      to: { path: "^app/(design/|test-|api/test-)" },
    },
    {
      name: "no-circular",
      comment: "Circular dependencies — warn (surface without blocking).",
      severity: "warn",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^(\\.next|ds-bundle|\\.design-sync|coverage|node_modules)/" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
