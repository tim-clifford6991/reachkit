// tests/presentation/copy/string-literal-sweep.test.ts — ADR-010 decision 1,
// WO-279 (supersedes WO-044)
//
// REQ-093 criterion 1, quoted verbatim in WO-279 `## Test plan`. Parses
// every file `surfaceTree()` enumerates with the TypeScript compiler API
// and fails on a string literal in a JSX text position, in a JSX
// expression child (`{"literal"}`), in a JSX attribute, or in a mail
// template body position — unless the attribute is on
// `ATTRIBUTE_ALLOWLIST`.
//
// Attribute detection is fail-closed by design (not a maintained
// "text-bearing prop" list): every JSX attribute holding a literal is
// presumed voice unless `ATTRIBUTE_ALLOWLIST` names it. A future component
// introducing a new prop like `errorMessage="..."` is flagged the moment
// it lands — the allow-list only grows for genuinely structural attributes
// (WO-279's own return states this trade-off explicitly, per the dispatch
// instruction to name it rather than leave it implicit).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { GOVERNED_GLOBS, surfaceTree } from "./surface-tree.ts";
import { isAllowlistedAttribute } from "./allowlist.ts";
import { COPY_SWEEP_BUDGET_MS } from "./budget.ts";

const REAL_ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_ROOT = path.resolve(__dirname, "__fixtures__/surfaces");

/** Resend's own payload field names (`{ from, to, subject, html, text }`)
 *  plus `body`, the generic term BP-020's own prose uses for the same
 *  idea. A mail file's other string literals (an import specifier, a
 *  from-address, a header name) are not swept — only these four, which is
 *  where a written sentence would land. */
const MAIL_BODY_FIELDS = new Set(["subject", "html", "text", "body"]);

interface Violation {
  file: string;
  line: number;
  column: number;
  rule: "jsx-text" | "jsx-expression-string" | "jsx-attribute" | "mail-body";
  snippet: string;
}

interface SweepResult {
  violations: Violation[];
  literalsInspected: number;
  allowlistHits: number;
}

function isMailFile(root: string, filePath: string): boolean {
  const rel = path.relative(root, filePath).split(path.sep).join("/");
  return rel.startsWith("src/lib/mail/");
}

function sweepFile(filePath: string, sourceText: string, mailFile: boolean): SweepResult {
  const sf = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const violations: Violation[] = [];
  let literalsInspected = 0;
  let allowlistHits = 0;

  function posOf(node: ts.Node): { line: number; column: number } {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return { line: line + 1, column: character + 1 };
  }

  function isVoiceLiteral(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
    return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  }

  /** TST-028 finding 1: a bare literal and a `+`-concatenation of literals
   *  are the same violation — `"a" + "b"` composes a string exactly as
   *  much as `"ab"` does, and copy() is bypassed either way. Recurses
   *  through a chain (`"a" + "b" + "c"`) so it is not defeated by adding a
   *  third term. Scoped to *both* operands being literals (or literal
   *  chains) — `name + "!"`, a literal concatenated with a variable, is
   *  not this rule's concern (BP-020 does not forbid interpolating a
   *  customer-written value; only a hand-composed *sentence* is voice). */
  function isVoiceExpression(node: ts.Node): node is ts.Expression {
    if (isVoiceLiteral(node)) return true;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return isVoiceExpression(node.left) && isVoiceExpression(node.right);
    }
    return false;
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxText(node)) {
      if (node.text.trim().length > 0) {
        literalsInspected++;
        const { line, column } = posOf(node);
        violations.push({ file: filePath, line, column, rule: "jsx-text", snippet: node.text.trim() });
      }
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      isVoiceExpression(node.expression) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      // A bare string literal, or a `+`-concatenation of literals, written
      // as a JSX child through an expression container — `{"literal"}` or
      // `{"a" + "b"}` — the same violation as JsxText, spelled differently
      // to dodge a text-node-only check.
      literalsInspected++;
      const { line, column } = posOf(node.expression);
      violations.push({
        file: filePath,
        line,
        column,
        rule: "jsx-expression-string",
        snippet: node.expression.getText(sf),
      });
    } else if (ts.isJsxAttribute(node)) {
      let literal: ts.Expression | undefined;
      if (node.initializer) {
        if (ts.isJsxExpression(node.initializer)) {
          if (node.initializer.expression && isVoiceExpression(node.initializer.expression)) {
            literal = node.initializer.expression;
          }
        } else if (isVoiceExpression(node.initializer)) {
          literal = node.initializer;
        }
      }
      if (literal) {
        literalsInspected++;
        const name = node.name.getText(sf);
        if (isAllowlistedAttribute(name)) {
          allowlistHits++;
        } else {
          const { line, column } = posOf(literal);
          violations.push({
            file: filePath,
            line,
            column,
            rule: "jsx-attribute",
            snippet: `${name}=${literal.getText(sf)}`,
          });
        }
      }
    } else if (mailFile && ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      if (MAIL_BODY_FIELDS.has(node.name.text) && isVoiceExpression(node.initializer)) {
        literalsInspected++;
        const { line, column } = posOf(node.initializer);
        violations.push({
          file: filePath,
          line,
          column,
          rule: "mail-body",
          snippet: node.initializer.getText(sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return { violations, literalsInspected, allowlistHits };
}

function sweepRoot(root: string): {
  filesWalked: number;
  perGlob: Record<string, number>;
  violations: Violation[];
  literalsInspected: number;
  allowlistHits: number;
} {
  const tree = surfaceTree(root);
  let violations: Violation[] = [];
  let literalsInspected = 0;
  let allowlistHits = 0;
  for (const file of tree.files) {
    const result = sweepFile(file, readFileSync(file, "utf8"), isMailFile(root, file));
    violations = violations.concat(result.violations);
    literalsInspected += result.literalsInspected;
    allowlistHits += result.allowlistHits;
  }
  return { filesWalked: tree.files.length, perGlob: tree.perGlob, violations, literalsInspected, allowlistHits };
}

function relativeSignature(root: string, violations: Violation[]): Array<{ file: string; rule: string }> {
  return violations
    .map((v) => ({ file: path.relative(root, v.file).split(path.sep).join("/"), rule: v.rule }))
    .sort((a, b) => (a.file === b.file ? a.rule.localeCompare(b.rule) : a.file.localeCompare(b.file)));
}

/** TST-028 finding 3: an aggregate non-zero file count cannot tell a
 *  mistyped glob (e.g. `"src/lib/mails"`) from a governed directory that
 *  is genuinely empty today — both walk to zero files, aggregated or not.
 *  What actually distinguishes them is independent of today's file-system
 *  state: `GOVERNED_GLOBS`' exact strings, asserted against ADR-010's
 *  decision verbatim. A typo changes that string and fails here regardless
 *  of whether the directory it now points at happens to exist. Given the
 *  glob list is right, `expectedEmpty` is asserted `0` explicitly — not
 *  merely un-asserted — so a later regression that silently empties one of
 *  the globs expected to hold files (`expectedNonEmpty`) is caught, and a
 *  glob that is expected empty today (WO-279 rests-on row 1: `src/lib/mail`
 *  does not exist yet; `src/app/(hosted)` holds only `.gitkeep`) is
 *  reported as exactly that, not hidden inside an aggregate.
 *
 *  Both globs that list once held have since been built — `src/lib/mail`
 *  by the mail block and `src/app/(hosted)` by issue #49 — so
 *  `expectedEmpty` is empty today. The mechanism stays: it is what would
 *  report a glob that quietly stopped matching. */
function assertGovernedCoverage(
  tree: { perGlob: Record<string, number> },
  expectedNonEmpty: readonly string[],
  expectedEmpty: readonly string[]
): void {
  expect(GOVERNED_GLOBS).toEqual(["src/app", "src/app/(hosted)", "src/lib/mail", "src/ui"]);
  expect([...expectedNonEmpty, ...expectedEmpty].sort()).toEqual([...GOVERNED_GLOBS].sort());
  for (const glob of expectedNonEmpty) {
    expect(tree.perGlob[glob], `expected ${glob} to hold at least one file`).toBeGreaterThan(0);
  }
  for (const glob of expectedEmpty) {
    expect(tree.perGlob[glob], `expected ${glob} to be empty today`).toBe(0);
  }
}

describe("REQ-093 c1 — string-literal sweep, over the fixture tree", () => {
  const start = performance.now();
  const result = sweepRoot(FIXTURE_ROOT);
  const elapsedMs = performance.now() - start;

  // Rule 5.5: stated unconditionally, not only when there is something to
  // report.
  console.log(
    `tests/presentation/copy/string-literal-sweep.test.ts (fixture tree): ` +
      `${result.filesWalked} file(s) walked ${JSON.stringify(result.perGlob)}, ` +
      `${result.literalsInspected} literal(s) inspected, ${result.violations.length} violation(s), ` +
      `${result.allowlistHits} allow-list hit(s)`
  );

  it("walks a non-empty fixture tree — an empty walk would pass vacuously", () => {
    expect(result.filesWalked).toBeGreaterThan(0);
  });

  it("reports coverage per governed glob — the fixture tree seeds all four", () => {
    assertGovernedCoverage(result, ["src/app", "src/app/(hosted)", "src/lib/mail", "src/ui"], []);
  });

  it("flags exactly the known violations, by file and rule, and nothing else", () => {
    // Discriminates: deleting the JSX-text rule (or any other rule) drops
    // an entry below and this assertion fails; the allow-listed attribute
    // fixture is intentionally absent from this list — it must pass.
    expect(relativeSignature(FIXTURE_ROOT, result.violations)).toEqual([
      { file: "src/app/violation-jsx-text.tsx", rule: "jsx-text" },
      { file: "src/app/violation-string-concat.tsx", rule: "jsx-expression-string" },
      { file: "src/app/violation-text-prop.tsx", rule: "jsx-attribute" },
      { file: "src/lib/mail/violation-mail-body.ts", rule: "mail-body" },
    ]);
  });

  it("does not flag the clean files", () => {
    const flaggedFiles = new Set(result.violations.map((v) => v.file));
    for (const clean of [
      "src/app/clean.tsx",
      "src/app/(hosted)/clean.tsx",
      "src/lib/mail/clean.ts",
      "src/ui/clean.tsx",
    ]) {
      expect(flaggedFiles.has(path.join(FIXTURE_ROOT, ...clean.split("/")))).toBe(false);
    }
  });

  it("does not flag the allow-listed attribute fixture", () => {
    const flaggedFiles = new Set(result.violations.map((v) => v.file));
    expect(flaggedFiles.has(path.join(FIXTURE_ROOT, "src/ui/violation-allowlisted-attr.tsx"))).toBe(
      false
    );
    expect(result.allowlistHits).toBeGreaterThan(0);
  });

  it("stays inside the wall-clock budget", () => {
    expect(elapsedMs).toBeLessThan(COPY_SWEEP_BUDGET_MS);
  });
});

describe("REQ-093 c1 — string-literal sweep, over the real surface globs", () => {
  const start = performance.now();
  const result = sweepRoot(REAL_ROOT);
  const elapsedMs = performance.now() - start;

  console.log(
    `tests/presentation/copy/string-literal-sweep.test.ts (real tree): ` +
      `${result.filesWalked} file(s) walked ${JSON.stringify(result.perGlob)}, ` +
      `${result.literalsInspected} literal(s) inspected, ${result.violations.length} violation(s), ` +
      `${result.allowlistHits} allow-list hit(s)`
  );

  it("walks a non-empty real tree — an empty walk would pass vacuously (constitution rule 5.5)", () => {
    expect(result.filesWalked).toBeGreaterThan(0);
  });

  it("reports coverage per governed glob — every governed glob holds files, and the empty list is asserted empty rather than left unasserted (TST-028 finding 3)", () => {
    // 2026-09-05, issue #30: `src/lib/mail` now holds the mail seam, so it
    // moves from the expected-empty list to the expected-non-empty one —
    // the assertion that keeps a mistyped glob from reading as coverage
    // still holds, on the other side.
    // Every governed glob now holds files. `src/app/(hosted)` held only a
    // `.gitkeep` until issue #49 built the hosted edge, and `src/lib/mail`
    // was WO-279's other empty row; both are swept like the rest, and the
    // empty list is asserted empty so a glob that quietly stops matching
    // still fails here.
    assertGovernedCoverage(
      result,
      ["src/app", "src/app/(hosted)", "src/lib/mail", "src/ui"],
      []
    );
  });

  it("no surface holds a product sentence", () => {
    // The "surfaces added after this requirement" clause is carried by the
    // scope being a glob, not a list: surface-tree.ts holds no file names,
    // so a file that lands tomorrow under a governed path is swept
    // tomorrow without this suite changing.
    expect(relativeSignature(REAL_ROOT, result.violations)).toEqual([]);
  });

  it("stays inside the wall-clock budget", () => {
    expect(elapsedMs).toBeLessThan(COPY_SWEEP_BUDGET_MS);
  });
});
