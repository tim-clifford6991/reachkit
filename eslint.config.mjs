// eslint.config.mjs
//
// Flat config extending `next/core-web-vitals` + `@typescript-eslint`.
// BP-001 decision 2: "`eslint.config.mjs` is where the corpus's
// cross-module lint invariants land," and this node is answerable for
// them. Five project rules below, each with a comment naming its source.
//
// ADR-050's other half is not recast here (WO-001 step 3, verbatim):
// "'Computes no access predicate' is not a lexical property an import rule
// can decide: a rule claiming to enforce it would report nothing on a
// hand-rolled `paid_through > now()` comparison in a job body and would
// read, in CI, exactly like a rule that holds." That half stays ADR-050
// point 4's three mutation tests in `tests/account/billing/`.
import nextConfig from "eslint-config-next";
import tseslint from "typescript-eslint";

/**
 * A single-purpose local rule factory. Every invariant below is a lexical
 * property of the import specifier string — no type information is ever
 * needed to decide it, which is exactly the property ADR-050 point 3's
 * invariant does *not* have (see the comment above and the fixture
 * `tests/app/lint-rules.test.ts` asserts is not reported).
 *
 * @param {(specifier: string) => boolean} test
 * @param {string} message
 */
function importFenceRule(test, message) {
  return {
    meta: { type: "problem", docs: { description: message } },
    create(context) {
      return {
        ImportDeclaration(node) {
          const spec = node.source.value;
          if (typeof spec === "string" && test(spec)) {
            context.report({ node, message });
          }
        },
      };
    },
  };
}

/**
 * A single-purpose local rule factory for a bare-identifier call, e.g.
 * `fetch(...)`. Unlike `importFenceRule`, this needs no type information
 * either — a `CallExpression` whose callee is the identifier named `name`
 * is a lexical property of the AST, decidable without a type checker.
 *
 * @param {string} name
 * @param {string} message
 */
function callFenceRule(name, message) {
  return {
    meta: { type: "problem", docs: { description: message } },
    create(context) {
      return {
        CallExpression(node) {
          const callee = node.callee;
          if (callee.type === "Identifier" && callee.name === name) {
            context.report({ node, message });
          }
        },
      };
    },
  };
}

// Exported (not just used below) so tests/app/lint-rules.test.ts and
// tests/egress/policy.test.ts can be pointed at the exact rule objects this
// file defines, without needing a second copy of the invariant text.
export const localImportRules = {
  rules: {
    // (a) BP-002 boundary: "no import of src/lib/db internals outside
    // src/lib/db". Only `src/lib/db`'s own two clients (`db()`,
    // `dbAdmin()`, imported from the bare `@/lib/db` entry point) may be
    // reached from outside the module.
    "no-db-internal-import": importFenceRule(
      (spec) => spec.startsWith("@/lib/db/"),
      "BP-002: only src/lib/db's own public entry ('@/lib/db') may be imported outside src/lib/db — this imports an internal module."
    ),

    // (b) structure.md rule 6: "No `src/lib/` module imports from
    // `src/app/`." (Dependency direction is one-way.)
    "no-lib-importing-app": importFenceRule(
      (spec) => spec === "@/app" || spec.startsWith("@/app/"),
      "structure.md rule 6: src/lib/ may not import from src/app/ — dependency direction is one-way."
    ),

    // (c) BP-062 decision 1, verbatim, REQ-078 in the message: "an import
    // that looks harmless fails CI with the requirement id in the
    // message."
    "no-export-importing-billing": importFenceRule(
      (spec) => spec === "@/lib/account/billing" || spec.startsWith("@/lib/account/billing/"),
      "REQ-078 / BP-062 decision 1: src/lib/account/export/** may not import from src/lib/account/billing/**."
    ),

    // (d) ADR-050's lintable half only: "nothing outside
    // src/lib/account/billing/** may import users.paid_through's reader or
    // re-derive access from plan_status." The invariant itself (BP-003,
    // BP-012, BP-015, BP-063 compute no access predicate of their own) is
    // ADR-050 point 4's mutation tests, not this rule.
    "no-billing-internal-import": importFenceRule(
      (spec) => spec.startsWith("@/lib/account/billing/"),
      "ADR-050: nothing outside src/lib/account/billing/** may import users.paid_through's reader or re-derive access from plan_status. Only src/lib/account/billing's own public interface (hasActiveAccess) may be imported elsewhere."
    ),

    // (e) BP-006 NFR budget, verbatim: "A `fetch(` call anywhere else under
    // `src/lib/` that is not BP-008's vendor client is a lint error."
    // `src/lib/egress/**` is the audited boundary itself (BP-006);
    // `src/lib/vendors/**` is BP-008's vendor client. Scoped below to every
    // other `src/lib/**` file.
    "no-fetch-outside-egress": callFenceRule(
      "fetch",
      "BP-006: a fetch( call anywhere under src/lib/ that is not src/lib/egress/** (the audited boundary) or src/lib/vendors/** (BP-008's vendor client) is a lint error — route it through safeFetch()."
    ),
  },
};

export default tseslint.config(
  ...nextConfig,
  ...tseslint.configs.recommended,
  {
    // (b) — scoped to every file under src/lib/**.
    files: ["src/lib/**/*.{ts,tsx}"],
    plugins: { local: localImportRules },
    rules: { "local/no-lib-importing-app": "error" },
  },
  {
    // (a) — scoped to everything except src/lib/db/** itself.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/db/**"],
    plugins: { local: localImportRules },
    rules: { "local/no-db-internal-import": "error" },
  },
  {
    // (c) — scoped to the export leaf only.
    files: ["src/lib/account/export/**/*.{ts,tsx}"],
    plugins: { local: localImportRules },
    rules: { "local/no-export-importing-billing": "error" },
  },
  {
    // (d) — scoped to everything except src/lib/account/billing/** itself.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/account/billing/**"],
    plugins: { local: localImportRules },
    rules: { "local/no-billing-internal-import": "error" },
  },
  {
    // (e) — scoped to every src/lib/** file except the audited boundary
    // itself and the vendor client.
    files: ["src/lib/**/*.{ts,tsx}"],
    ignores: ["src/lib/egress/**", "src/lib/vendors/**"],
    plugins: { local: localImportRules },
    rules: { "local/no-fetch-outside-egress": "error" },
  },
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "src/**/*.generated.ts"],
  }
);
