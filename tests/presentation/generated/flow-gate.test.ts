// tests/presentation/generated/flow-gate.test.ts — ADR-010 decision 1,
// WO-279 (supersedes WO-044)
//
// REQ-093 criteria 2 and 3, quoted verbatim in WO-279 `## Test plan`. Walks
// the same governed surface tree `string-literal-sweep.test.ts` walks and
// fails on two lexical patterns, both scoped to the "same expression" the
// interface's own wording uses (BP-020 `## Public interface`):
//
//   (A) a raw two-level property-access chain naming one of
//       `GeneratedColumn`'s seven `table.column` pairs (e.g. `drafts.body`)
//       reaching a JSX text or attribute position;
//   (B) a raw three-level chain `<expr>.field.text`, where `field` is one
//       of PageIdentity's/`renderQuestion`'s own field names (`title`,
//       `slug`, `body`, `description`, `wording`) — a `GeneratedText`
//       value's `.text` unwrapped directly, bypassing `renderGenerated`/
//       `renderQuestion` even though the identity holding it is right
//       there in scope (BP-020 `## Error & edge behavior`, tenth bullet).
//
// Recorded limit (WO-279 rests-on row 2, ADR-010 rests-on row 1): this is
// name-matching, not type inference — a real column read through a
// differently-named variable (`d.body` instead of `drafts.body`) is
// invisible to rule (A), and an unrelated object that happens to expose a
// `.title.text`/`.slug.text`/… shape is a false positive rule (B) accepts
// as its cost for not requiring a full type-checked program. WO-279's own
// return states this trade-off; it is not silently assumed.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { GOVERNED_GLOBS, surfaceTree } from "../copy/surface-tree.ts";
import { COPY_SWEEP_BUDGET_MS } from "../copy/budget.ts";

const REAL_ROOT = path.resolve(__dirname, "../../..");
const FIXTURE_ROOT = path.resolve(__dirname, "../copy/__fixtures__/surfaces");

/** `GeneratedColumn`'s seven members (BP-020 `## Public interface`),
 *  split into [table, column] pairs. This module holds no import of
 *  `../../../src/lib/presentation/generated/text.ts` — the sweep reads
 *  source trees at test time only (ADR-010 `## Consequences`; no
 *  `depends-on` edge) — so the union is transcribed here, not derived from
 *  the type. */
const GENERATED_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["drafts", "body"],
  ["drafts", "title"],
  ["drafts", "slug"],
  ["drafts", "description"],
  ["opportunities", "proposed_title"],
  ["opportunities", "proposed_slug"],
  ["questions", "wording"],
];

/** PageIdentity's own GeneratedText-typed field names, plus `wording` for
 *  `renderQuestion`'s equivalent bypass. */
const GENERATED_TEXT_FIELDS = new Set(["title", "slug", "body", "description", "wording"]);

interface Violation {
  file: string;
  line: number;
  column: number;
  rule: "raw-column-read" | "generated-text-no-identity";
  snippet: string;
}

function baseName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return undefined;
}

function isJsxReachingPosition(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isJsxExpression(parent)) {
    return ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent) || ts.isJsxAttribute(parent.parent);
  }
  return false;
}

function findFlowGateViolations(filePath: string, sourceText: string): Violation[] {
  const sf = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const violations: Violation[] = [];

  function posOf(node: ts.Node): { line: number; column: number } {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return { line: line + 1, column: character + 1 };
  }

  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node) && isJsxReachingPosition(node)) {
      const tail = node.name.text;

      // Rule (A): a two-level `table.column` chain naming one of the seven
      // GeneratedColumn pairs (e.g. `drafts.body`), reaching JSX directly.
      const base = baseName(node.expression);
      if (base) {
        const hit = GENERATED_COLUMNS.find(([table, column]) => table === base && column === tail);
        if (hit) {
          const { line, column } = posOf(node);
          violations.push({
            file: filePath,
            line,
            column,
            rule: "raw-column-read",
            snippet: node.getText(sf),
          });
        }
      }

      // Rule (B): a three-level `<expr>.field.text` chain — a
      // GeneratedText field's raw `.text` reaching JSX with no
      // renderGenerated()/renderQuestion() call in the same expression.
      if (
        tail === "text" &&
        ts.isPropertyAccessExpression(node.expression) &&
        GENERATED_TEXT_FIELDS.has(node.expression.name.text)
      ) {
        const { line, column } = posOf(node);
        violations.push({
          file: filePath,
          line,
          column,
          rule: "generated-text-no-identity",
          snippet: node.getText(sf),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return violations;
}

function sweepRoot(root: string): { filesWalked: number; perGlob: Record<string, number>; violations: Violation[] } {
  const tree = surfaceTree(root);
  let violations: Violation[] = [];
  for (const file of tree.files) {
    violations = violations.concat(findFlowGateViolations(file, readFileSync(file, "utf8")));
  }
  return { filesWalked: tree.files.length, perGlob: tree.perGlob, violations };
}

function relativeSignature(root: string, violations: Violation[]): Array<{ file: string; rule: string }> {
  return violations
    .map((v) => ({ file: path.relative(root, v.file).split(path.sep).join("/"), rule: v.rule }))
    .sort((a, b) => (a.file === b.file ? a.rule.localeCompare(b.rule) : a.file.localeCompare(b.file)));
}

/** TST-028 finding 3, same rationale as `string-literal-sweep.test.ts`'s
 *  twin helper: an aggregate non-zero file count cannot tell a mistyped
 *  glob from a governed directory that is genuinely empty today.
 *  `GOVERNED_GLOBS`' exact strings are asserted against ADR-010's decision,
 *  independent of file-system state; given the glob list is right,
 *  `expectedEmpty` is asserted `0` explicitly, not merely un-asserted. */
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

describe("REQ-093 c2/c3 — flow gate, over the fixture tree", () => {
  const start = performance.now();
  const result = sweepRoot(FIXTURE_ROOT);
  const elapsedMs = performance.now() - start;

  console.log(
    `tests/presentation/generated/flow-gate.test.ts (fixture tree): ` +
      `${result.filesWalked} file(s) walked ${JSON.stringify(result.perGlob)}, ` +
      `${result.violations.length} violation(s)`
  );

  it("walks a non-empty fixture tree — an empty walk would pass vacuously", () => {
    expect(result.filesWalked).toBeGreaterThan(0);
  });

  it("reports coverage per governed glob — the fixture tree seeds all four", () => {
    assertGovernedCoverage(result, ["src/app", "src/app/(hosted)", "src/lib/mail", "src/ui"], []);
  });

  it("a stored column reaching JSX directly is flagged by file and position", () => {
    expect(
      relativeSignature(FIXTURE_ROOT, result.violations).filter((v) => v.rule === "raw-column-read")
    ).toEqual([
      { file: "src/app/violation-drafts-body.tsx", rule: "raw-column-read" },
      { file: "src/app/violation-questions-wording.tsx", rule: "raw-column-read" },
    ]);
  });

  it("questions.wording reaches a surface only through renderQuestion — the same rule, named", () => {
    // WO-044's own row: "questions.wording reaches a surface only through
    // renderQuestion". questions.wording is one of the seven
    // GeneratedColumn pairs; its sanctioned sink is renderQuestion(), never
    // renderGenerated(). Reaching JSX raw — as this dedicated fixture does
    // — is the same raw-column-read violation as drafts.body, caught by
    // the same rule (A), not a second one.
    const wordingViolations = result.violations.filter(
      (v) => v.rule === "raw-column-read" && v.snippet === "questions.wording"
    );
    expect(wordingViolations).toHaveLength(1);
    expect(path.relative(FIXTURE_ROOT, wordingViolations[0]!.file).split(path.sep).join("/")).toBe(
      "src/app/violation-questions-wording.tsx"
    );
  });

  it("a GeneratedText field's raw .text reaching JSX with no renderGenerated() call is flagged", () => {
    expect(
      relativeSignature(FIXTURE_ROOT, result.violations).filter(
        (v) => v.rule === "generated-text-no-identity"
      )
    ).toEqual([{ file: "src/app/violation-generated-no-identity.tsx", rule: "generated-text-no-identity" }]);
  });

  it("flags exactly these three — nothing else in the fixture tree", () => {
    expect(relativeSignature(FIXTURE_ROOT, result.violations)).toEqual([
      { file: "src/app/violation-drafts-body.tsx", rule: "raw-column-read" },
      { file: "src/app/violation-generated-no-identity.tsx", rule: "generated-text-no-identity" },
      { file: "src/app/violation-questions-wording.tsx", rule: "raw-column-read" },
    ]);
  });

  it("stays inside the wall-clock budget", () => {
    expect(elapsedMs).toBeLessThan(COPY_SWEEP_BUDGET_MS);
  });
});

describe("REQ-093 c2/c3 — flow gate, over the real surface globs", () => {
  const start = performance.now();
  const result = sweepRoot(REAL_ROOT);
  const elapsedMs = performance.now() - start;

  console.log(
    `tests/presentation/generated/flow-gate.test.ts (real tree): ` +
      `${result.filesWalked} file(s) walked ${JSON.stringify(result.perGlob)}, ` +
      `${result.violations.length} violation(s)`
  );

  it("walks a non-empty real tree — an empty walk would pass vacuously (constitution rule 5.5)", () => {
    expect(result.filesWalked).toBeGreaterThan(0);
  });

  it("reports coverage per governed glob — every governed glob holds files, and the empty list is asserted empty rather than left unasserted (TST-028 finding 3)", () => {
    // 2026-09-05, issue #30: `src/lib/mail` now holds the mail seam.
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

  it("no GeneratedColumn value or GeneratedText field reaches a surface outside renderGenerated/renderQuestion", () => {
    expect(relativeSignature(REAL_ROOT, result.violations)).toEqual([]);
  });

  it("stays inside the wall-clock budget", () => {
    expect(elapsedMs).toBeLessThan(COPY_SWEEP_BUDGET_MS);
  });
});
