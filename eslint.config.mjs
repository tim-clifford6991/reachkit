// eslint.config.mjs
//
// Flat config extending `next/core-web-vitals` + `@typescript-eslint`.
// BP-001 decision 2: "`eslint.config.mjs` is where the corpus's
// cross-module lint invariants land," and this node is answerable for
// them. Seven project rules below, each with a comment naming its source.
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

/**
 * A plain `<a>` to an address of the app (SPEC §4, 2026-10-08, issue 1341;
 * issue 1484). An in-app link is `next/link` with `prefetch`, so the shell
 * stays mounted and the next screen is already loaded.
 * `@next/next/no-html-link-for-pages` reads a literal `href` only, and this
 * product's in-app addresses are constants and model fields, so this rule
 * also follows a `const` to its literal. Under `(account)` it also treats a
 * name ending in `href` as an in-app address (option `names`) — that
 * surface's convention, beside `url` for a page that leaves it; a public
 * screen's `href` fields are anchors and sources. A link that must be a
 * full load says so with a disable comment and its reason.
 */
const APP_ADDRESS = /^\/app(?:[/?#]|$)/;

function hrefText(node, scope) {
  if (node.type === "Literal") return typeof node.value === "string" ? node.value : undefined;
  if (node.type === "TemplateLiteral") return node.quasis[0]?.value.cooked ?? undefined;
  if (node.type === "Identifier") {
    for (let at = scope; at; at = at.upper) {
      const variable = at.set.get(node.name);
      if (!variable) continue;
      const def = variable.defs[0];
      const init = def?.node.type === "VariableDeclarator" && def.parent?.kind === "const" ? def.node.init : null;
      return init ? hrefText(init, at) : undefined;
    }
  }
  return undefined;
}

function hrefName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    if (!node.computed && node.property.type === "Identifier") return node.property.name;
    return hrefName(node.object);
  }
  return undefined;
}

const noPlainAppLink = {
  meta: {
    type: "problem",
    docs: { description: "An in-app link is next/link with prefetch (SPEC §4, issue 1341)." },
    schema: [{ type: "object", properties: { names: { type: "boolean" } }, additionalProperties: false }],
  },
  create(context) {
    const names = context.options[0]?.names === true;
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "a") return;
        const href = node.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === "href");
        const value = href?.value?.type === "JSXExpressionContainer" ? href.value.expression : href?.value;
        if (!value) return;
        const text = hrefText(value, context.sourceCode.getScope(value));
        const inApp = text !== undefined ? APP_ADDRESS.test(text) : names && /href$/i.test(hrefName(value) ?? "");
        if (inApp) {
          context.report({
            node,
            message:
              "SPEC §4 (2026-10-08, issue 1341): a link to a screen of the app is next/link with prefetch={true}, not a plain <a>.",
          });
        }
      },
    };
  },
};

/**
 * The daily job reads the week the weekly pass committed and never ranks
 * (SPEC §7, issue 1559): from the plan it may take only the date's page and
 * the committed week, and it may not reach the ranking or the choice.
 */
const DAILY_READS = new Set(["pageForDay", "committedWeek"]);
const DAILY_NEVER = new Set(["planWeek", "rankOpen", "rankScore", "rankedCountsOf"]);
const DAILY_MESSAGE =
  "SPEC §7 (issue 1559): src/lib/generate reads the committed week — only pageForDay and committedWeek from opportunities/plan, and nothing that ranks.";

const dailyReadsCommit = {
  meta: { type: "problem", docs: { description: DAILY_MESSAGE } },
  create(context) {
    const check = (node, spec, names) => {
      if (/^@\/lib\/opportunities\/(rank|choose)(\/|$)/.test(spec)) return context.report({ node, message: DAILY_MESSAGE });
      const plan = /(^@\/lib\/opportunities|\/opportunities)\/plan$/.test(spec);
      const barrel = spec === "@/lib/opportunities";
      if (!plan && !barrel) return;
      // A namespace or default import from the plan could reach any of it.
      if (names === null) return plan ? context.report({ node, message: DAILY_MESSAGE }) : undefined;
      if (names.some((name) => (plan ? !DAILY_READS.has(name) : DAILY_NEVER.has(name)))) context.report({ node, message: DAILY_MESSAGE });
    };
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type" || typeof node.source.value !== "string") return;
        const named = node.specifiers.filter((s) => s.type === "ImportSpecifier" && s.importKind !== "type");
        const whole = node.specifiers.some((s) => s.type !== "ImportSpecifier");
        check(node, node.source.value, whole ? null : named.map((s) => s.imported.name ?? s.imported.value));
      },
      // `const { x } = await import("…")`, the lazy form this tree uses.
      ImportExpression(node) {
        if (node.source.type !== "Literal" || typeof node.source.value !== "string") return;
        const holder = node.parent?.type === "AwaitExpression" ? node.parent.parent : node.parent;
        const pattern = holder?.type === "VariableDeclarator" ? holder.id : null;
        const names =
          pattern?.type === "ObjectPattern" && pattern.properties.every((p) => p.type === "Property" && p.key.type === "Identifier")
            ? pattern.properties.map((p) => p.key.name)
            : null;
        check(node, node.source.value, names);
      },
    };
  },
};

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

    // (f) SPEC §6 (owner, 2026-10-15, issue 1443): screens and mail are
    // English. `copyIn` is the reader for the customer's own pages; app and
    // mail code read `copy()` (issue 1484).
    "no-copy-in-for-ui": importFenceRule(
      (spec) => spec === "@/lib/presentation/copy/translated" || spec.endsWith("/copy/translated") || spec.endsWith("/copy/translated.ts"),
      "SPEC §6 (issue 1443): app and mail text is English — use copy(), not copyIn() from @/lib/presentation/copy/translated."
    ),

    // (g) SPEC §4 (2026-10-08, issue 1341): an in-app link is next/link.
    "no-plain-app-link": noPlainAppLink,

    // (j) SPEC §7 (issue 1559): the daily job reads the commit.
    "daily-reads-commit": dailyReadsCommit,
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
    // (f) — scoped to the screens and the mail.
    files: ["src/app/**/*.{ts,tsx}", "src/lib/mail/**/*.{ts,tsx}"],
    plugins: { local: localImportRules },
    rules: { "local/no-copy-in-for-ui": "error" },
  },
  {
    // (g) — every screen and the shared UI read a literal address; the
    // account screens also read a name ending in `href`.
    files: ["src/app/**/*.tsx", "src/ui/**/*.tsx"],
    plugins: { local: localImportRules },
    rules: { "local/no-plain-app-link": "error" },
  },
  {
    files: ["src/app/(account)/**/*.tsx"],
    plugins: { local: localImportRules },
    rules: { "local/no-plain-app-link": ["error", { names: true }] },
  },
  {
    // (j) — the daily path.
    files: ["src/lib/generate/**/*.{ts,tsx}"],
    plugins: { local: localImportRules },
    rules: { "local/daily-reads-commit": "error" },
  },
  {
    // (h) Issue 1479: a stored site name is read by the name rule, never
    // as the column holds it — `storedSiteName` in src/lib/site-profile/ is
    // its one reader. A placeholder, a protection page's name or a call to
    // action was shown and counted as naming the business.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/site-profile/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='site_name'], ObjectPattern > Property[key.name='site_name']",
          message: "Issue 1479: read site_profiles.site_name through storedSiteName (src/lib/site-profile/site-name.ts), never raw.",
        },
      ],
    },
  },
  {
    // (i) Plan shows the week the weekly pass committed and never ranks
    // again, so a view cannot disagree with the job that writes the days.
    files: ["src/app/(account)/app/calendar/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/opportunities",
              importNames: ["rankOpen", "rankScore", "rankedCountsOf"],
              message: "Plan reads committedWeek and never ranks (SPEC §7, E5).",
            },
          ],
          patterns: [
            {
              group: ["@/lib/opportunities/rank", "@/lib/opportunities/rank/*"],
              message: "Plan reads committedWeek and never ranks (SPEC §7, E5).",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "src/**/*.generated.ts"],
  }
);
