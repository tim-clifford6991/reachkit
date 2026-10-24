// eslint.config.mjs
//
// Flat config extending `next/core-web-vitals` + `@typescript-eslint`.
// BP-001 decision 2: "`eslint.config.mjs` is where the corpus's
// cross-module lint invariants land," and this node is answerable for
// them. Each project rule below carries a comment naming its source.
//
// ADR-050's other half is not recast here (WO-001 step 3, verbatim):
// "'Computes no access predicate' is not a lexical property an import rule
// can decide: a rule claiming to enforce it would report nothing on a
// hand-rolled `paid_through > now()` comparison in a job body and would
// read, in CI, exactly like a rule that holds." That half stays ADR-050
// point 4's three mutation tests in `tests/account/billing/`.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextConfig from "eslint-config-next";
import ts from "typescript";
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

/**
 * A rule over the file's text, for a guard that is a property of the text
 * and not of one node. `code: true` blanks comments first, so prose may
 * name what code may not.
 *
 * @param {{ pattern: RegExp, message: string, code?: boolean }[]} fences
 */
function textFenceRule(fences) {
  return {
    meta: { type: "problem", docs: { description: fences.map((f) => f.message).join(" ") } },
    create(context) {
      return {
        Program(node) {
          const source = context.sourceCode;
          let codeOnly;
          for (const { pattern, message, code } of fences) {
            if (code && codeOnly === undefined) {
              codeOnly = source.text;
              for (const c of source.getAllComments()) {
                codeOnly = codeOnly.slice(0, c.range[0]) + " ".repeat(c.range[1] - c.range[0]) + codeOnly.slice(c.range[1]);
              }
            }
            const match = pattern.exec(code ? codeOnly : source.text);
            if (match) context.report({ node, loc: source.getLocFromIndex(match.index), message });
          }
        },
      };
    },
  };
}

/** The module-level directive, read from the AST so one in a comment or a string is not one. */
function directiveOf(program) {
  const first = program.body[0];
  return first?.type === "ExpressionStatement" && first.expression.type === "Literal" ? first.expression.value : undefined;
}

/**
 * A "use server" module exports async functions only. `next build` fails on
 * anything else, once per importer, and tsc does not see it. A type export
 * is erased, so it is allowed.
 */
const USE_SERVER_MESSAGE =
  'Only async functions may be exported from a "use server" module; a constant, class or re-exported value goes in a plain module beside it.';

const useServerExportsAsync = {
  meta: { type: "problem", docs: { description: USE_SERVER_MESSAGE } },
  create(context) {
    return {
      Program(program) {
        if (directiveOf(program) !== "use server") return;
        for (const node of program.body) {
          if (node.type === "ExportAllDeclaration" && node.exportKind !== "type") {
            context.report({ node, message: USE_SERVER_MESSAGE });
          }
          if (node.type !== "ExportNamedDeclaration" || node.exportKind === "type") continue;
          const decl = node.declaration;
          const bad = decl
            ? (decl.type === "FunctionDeclaration" && !decl.async) ||
              ["VariableDeclaration", "ClassDeclaration", "TSEnumDeclaration"].includes(decl.type)
            : node.specifiers.some((s) => s.exportKind !== "type");
          if (bad) context.report({ node, message: USE_SERVER_MESSAGE });
        }
      },
    };
  },
};

/**
 * A module with no "use client" reads no literal constant from one that has
 * it: Next hands it a client reference, so a string arrives as a function.
 * Follows `@/` and relative specifiers to the file they name.
 */
const CLIENT_CONSTANT_MESSAGE =
  'A server module may not read a constant from a "use client" module: it arrives as a client reference, not the value. Move the constant to a plain module.';

const parsedClientModules = new Map();

function clientConstantsOf(file) {
  const mtime = statSync(file).mtimeMs;
  const hit = parsedClientModules.get(file);
  if (hit?.mtime === mtime) return hit.names;
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const first = source.statements[0];
  const client =
    first !== undefined && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use client";
  const names = new Set();
  const literal = (n) =>
    ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n)
      ? literal(n.expression)
      : ts.isStringLiteral(n) ||
        ts.isNoSubstitutionTemplateLiteral(n) ||
        ts.isTemplateExpression(n) ||
        ts.isNumericLiteral(n) ||
        ts.isObjectLiteralExpression(n) ||
        ts.isArrayLiteralExpression(n) ||
        (ts.isPrefixUnaryExpression(n) && ts.isNumericLiteral(n.operand)) ||
        n.kind === ts.SyntaxKind.TrueKeyword ||
        n.kind === ts.SyntaxKind.FalseKeyword;
  for (const s of client ? source.statements : []) {
    if (!ts.isVariableStatement(s) || !s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of s.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer && literal(d.initializer)) names.add(d.name.text);
    }
  }
  parsedClientModules.set(file, { mtime, names });
  return names;
}

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "src");

function resolveSource(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC_DIR, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const noClientConstantInServer = {
  meta: { type: "problem", docs: { description: CLIENT_CONSTANT_MESSAGE } },
  create(context) {
    let server = false;
    const check = (node, kind) => {
      if (!server || kind === "type" || typeof node.source?.value !== "string") return;
      const target = resolveSource(context.filename, node.source.value);
      const constants = target ? clientConstantsOf(target) : null;
      if (!constants?.size) return;
      for (const s of node.specifiers) {
        const name = s.type === "ImportSpecifier" ? s.imported : s.type === "ExportSpecifier" ? s.local : null;
        if (name && (s.importKind ?? s.exportKind) !== "type" && constants.has(name.name ?? name.value)) {
          context.report({ node: s, message: CLIENT_CONSTANT_MESSAGE });
        }
      }
    };
    return {
      Program(program) {
        server = directiveOf(program) !== "use client";
      },
      ImportDeclaration: (node) => check(node, node.importKind),
      ExportNamedDeclaration: (node) => check(node, node.exportKind),
    };
  },
};

/**
 * A surface writes no product sentence: JSX text, a literal JSX child, a
 * literal attribute not on `allow`, and with `mail` a literal mail body
 * field. Every literal attribute is voice unless `allow` names it.
 */
const VOICE_MESSAGE = "REQ-093: a product sentence on a surface is read through copy(), never written as a literal.";
const MAIL_BODY_FIELDS = new Set(["subject", "html", "text", "body"]);

function isVoice(node) {
  if (node.type === "Literal") return typeof node.value === "string";
  if (node.type === "TemplateLiteral") return node.expressions.length === 0;
  return node.type === "BinaryExpression" && node.operator === "+" && isVoice(node.left) && isVoice(node.right);
}

const noVoiceLiteral = {
  meta: {
    type: "problem",
    docs: { description: VOICE_MESSAGE },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } }, mail: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const { allow = [], mail = false } = context.options[0] ?? {};
    const report = (node) => context.report({ node, message: VOICE_MESSAGE });
    return {
      JSXText(node) {
        if (node.raw.trim().length > 0) report(node);
      },
      JSXExpressionContainer(node) {
        const parent = node.parent.type;
        if ((parent === "JSXElement" || parent === "JSXFragment") && isVoice(node.expression)) report(node.expression);
      },
      JSXAttribute(node) {
        const value = node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        if (!value || !isVoice(value)) return;
        const name = node.name.type === "JSXNamespacedName" ? `${node.name.namespace.name}:${node.name.name.name}` : node.name.name;
        if (!name.startsWith("aria-") && !allow.includes(name)) report(value);
      },
      Property(node) {
        if (mail && !node.computed && node.key.type === "Identifier" && MAIL_BODY_FIELDS.has(node.key.name) && isVoice(node.value)) {
          report(node.value);
        }
      },
    };
  },
};

// Structural attributes: class names, test ids, DOM ids and wire names,
// HTML and ARIA tokens, URLs, a component's own discriminant or size token,
// and a chart's dimensions. `aria-*` is always allowed.
const STRUCTURAL_ATTRIBUTES = [
  "className", "data-testid", "testId", "data-theme", "data-tone", "data-surface", "data-waiting", "data-layout",
  "id", "htmlFor", "name", "type", "href", "src", "rel", "target", "scope", "role", "method", "action", "lang", "key",
  "state", "variant", "tone", "size", "direction", "terms", "tab", "kind", "mode", "width", "height",
];

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

    // (k) React and next build: a "use server" module exports async functions only.
    "use-server-exports-async": useServerExportsAsync,

    // (l) Issue 1510: a server module reads no constant from a client module.
    "no-client-constant-in-server": noClientConstantInServer,

    // (m) REQ-093 / ADR-010 decision 1: a surface's sentences are copy()'s.
    "no-voice-literal": noVoiceLiteral,

    // (n) BP-002: src/lib/db alone chooses how the database is reached.
    "no-create-client-outside-db": textFenceRule([
      { pattern: /createClient\(/, message: "BP-002: only src/lib/db calls createClient( — use db() or dbAdmin() from '@/lib/db'." },
    ]),
    "no-db-admin-in-client": textFenceRule([
      {
        pattern: /^\s*['"]use client['"][\s\S]*import\s*\{[^}]*\bdbAdmin\b[^}]*\}\s*from\s*['"][^'"]*\/db(\/index)?['"]/,
        message: "BP-002: a client component may not import dbAdmin — it is server-only.",
      },
    ]),
    "db-logs-no-rows": textFenceRule(
      ["console.log", "console.debug", "console.info", "console.warn", ".subscribe(", "onQuery", "debug: true"].map((word) => ({
        pattern: new RegExp(word.replace(/[.()]/g, "\\$&")),
        message: `BP-002: the db clients install no logger that could capture row content (${word}).`,
      }))
    ),

    // (o) BP-005: constants.ts imports nothing and holds no customer-visible string.
    "constants-hold-no-copy": textFenceRule([
      { pattern: /^\s*import\s/m, message: "BP-005: constants.ts imports nothing." },
      { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, message: "BP-005 decision 3: constants.ts holds no email address." },
      { pattern: /[€$£]|\bVAT\b|per month/, message: "BP-005 decision 5: the price sentence is the registry's — no currency sign or tax word here." },
      { pattern: /["'`]price\.[a-z_]/, message: "BP-005 decision 5: constants.ts names no copy key." },
      { pattern: /\bCopyKey\b/, message: "BP-005: constants.ts stays free of CopyKey.", code: true },
    ]),
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
    // (k), (l) and (n) — every source file.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { local: localImportRules },
    rules: {
      "local/use-server-exports-async": "error",
      "local/no-client-constant-in-server": "error",
      "local/no-db-admin-in-client": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/db/**"],
    plugins: { local: localImportRules },
    rules: { "local/no-create-client-outside-db": "error" },
  },
  {
    files: ["src/lib/db/index.ts"],
    plugins: { local: localImportRules },
    rules: { "local/db-logs-no-rows": "error" },
  },
  {
    // (m) — the four surface roots; mail also sweeps its body fields.
    files: ["src/app/**/*.{ts,tsx}", "src/ui/**/*.{ts,tsx}"],
    plugins: { local: localImportRules },
    rules: { "local/no-voice-literal": ["error", { allow: STRUCTURAL_ATTRIBUTES }] },
  },
  {
    files: ["src/lib/mail/**/*.{ts,tsx}"],
    plugins: { local: localImportRules },
    rules: { "local/no-voice-literal": ["error", { allow: STRUCTURAL_ATTRIBUTES, mail: true }] },
  },
  {
    // (o)
    files: ["src/lib/config/constants.ts", "src/lib/config/constants/*.ts"],
    plugins: { local: localImportRules },
    rules: { "local/constants-hold-no-copy": "error" },
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
