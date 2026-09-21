// tests/build/use-server-exports.test.ts
//
// **A `"use server"` module may export only async functions.**
//
// React's rule, and Next enforces it at build time:
//
//   Only async functions are allowed to be exported in a "use server" file.
//
// One constant beside a Server Function costs **nineteen** build errors —
// one for the constant, then one per form that imported it ("Export
// BUSINESS_ITEM_FIELD doesn't exist in target module"), because the
// directive makes the whole module a set of server references and a
// non-function export has nowhere to live. That is what happened on #926,
// and it is the reason this file exists.
//
// **`tsc` cannot see it and neither can lint.** The module type-checks, the
// imports resolve, every test passes, and the only thing that fails is
// `next build` — which does not run in the `typecheck · lint · unit` gate
// and does not run on the build box at all (`docs/PROCESS.md`'s test
// budget). So the rule was invisible until CI tried to build the app, three
// gates later. This asserts it where it is cheap.
//
// The parse is TypeScript's own, not a regular expression: `export const`,
// `export function`, `export { … }`, `export default`, a re-export and a
// type-only export are six different shapes, and only some of them are a
// problem. A **type** export is erased before the directive means anything,
// so it is allowed — `panel-state.ts` is where a value belongs, and every
// one of these modules that needs a constant imports it from a plain module
// exactly as that file's own header says it must.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { REPO_ROOT, SRC_DIR, walkFiles } from "../ui/design/vocabulary";

/** Every module whose first statement is the directive. Read with the
 *  compiler rather than matched, so a directive inside a comment or a
 *  string is not one.
 *
 *  Named `serverModules` and not `useServerModules`: the `use` prefix makes
 *  `react-hooks/rules-of-hooks` read it as a Hook and refuse a call at the
 *  top level of a module. */
function serverModules(): { rel: string; source: ts.SourceFile }[] {
  const found: { rel: string; source: ts.SourceFile }[] = [];
  // `walkFiles` answers repo-relative POSIX paths and takes the predicate
  // that keeps them.
  for (const rel of walkFiles(SRC_DIR, (candidate) => /\.tsx?$/.test(candidate))) {
    const file = path.join(REPO_ROOT, rel);
    const text = readFileSync(file, "utf8");
    if (!text.includes("use server")) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true);
    const first = source.statements[0];
    const isDirective =
      first !== undefined &&
      ts.isExpressionStatement(first) &&
      ts.isStringLiteral(first.expression) &&
      first.expression.text === "use server";
    if (isDirective) found.push({ rel, source });
  }
  return found;
}

/** What one module exports that is **not** an async function, with the
 *  shape it exported it as. A type-only export is not a value and is not
 *  reported. */
function offendingExports(source: ts.SourceFile): string[] {
  const out: string[] = [];
  const exported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && exported(statement)) {
      const isAsync = (ts.getModifiers(statement) ?? []).some(
        (m) => m.kind === ts.SyntaxKind.AsyncKeyword
      );
      if (!isAsync) {
        out.push(`function ${statement.name?.text ?? "(anonymous)"} — not async`);
      }
      continue;
    }
    if (ts.isVariableStatement(statement) && exported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        out.push(`const ${declaration.name.getText(source)} — not a function`);
      }
      continue;
    }
    // `export { a, b }` and `export * from`. A type-only clause (`export
    // type { X }`) is erased and is fine; a value re-export is not, because
    // the module it came from is not a server module.
    if (ts.isExportDeclaration(statement) && statement.isTypeOnly !== true) {
      const clause = statement.exportClause;
      if (clause === undefined) {
        out.push("export * — re-exports values from a module that is not a server module");
        continue;
      }
      if (ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          if (element.isTypeOnly === true) continue;
          out.push(`export { ${element.name.text} } — a re-exported value`);
        }
      }
      continue;
    }
    if (ts.isClassDeclaration(statement) && exported(statement)) {
      out.push(`class ${statement.name?.text ?? "(anonymous)"} — not a function`);
    }
    if (ts.isEnumDeclaration(statement) && exported(statement)) {
      out.push(`enum ${statement.name.text} — not a function`);
    }
  }
  return out;
}

const MODULES = serverModules();

describe('a "use server" module exports async functions and nothing else', () => {
  it("the sweep found the server modules — a rule over nothing is not a rule", () => {
    // Eighteen carry the directive as their first statement today. The
    // assertion is a floor and not that number: a nineteenth is in scope by
    // construction, and the floor is what catches a parse that silently
    // stopped matching.
    //
    // Only a **module-level** directive is swept. The inline form — `"use
    // server"` as the first statement of a function inside a component —
    // marks that one function and puts no rule on the module's exports,
    // which is why `statements[0]` is what decides.
    expect(MODULES.length).toBeGreaterThan(14);
    expect(MODULES.map((module) => module.rel)).toContain(
      "src/app/(account)/app/settings/business-actions.ts"
    );
  });

  it("no module exports a constant, a class or a re-exported value beside its actions", () => {
    const offenders = MODULES.flatMap((module) =>
      offendingExports(module.source).map((what) => `${module.rel}: ${what}`)
    );
    expect(
      offenders,
      'Only async functions are allowed to be exported in a "use server" file. ' +
        "A wire name, a state shape or a refusal map goes in a plain module beside it — " +
        "`src/app/(account)/app/settings/panel-state.ts` is the one this screen uses, and " +
        "its own header says why. `tsc` cannot see this; `next build` fails on it, " +
        "once for the export and once per importer."
    ).toEqual([]);
  });

  it("watch it fail first: the parser reports a fixture that breaks the rule", () => {
    // The mutation this test guards against is the parse quietly matching
    // nothing. A module written the wrong way must be reported.
    const fixture = ts.createSourceFile(
      "fixture.ts",
      '"use server";\nexport const FIELD = "x";\nexport async function go(): Promise<void> {}\n',
      ts.ScriptTarget.ESNext,
      true
    );
    expect(offendingExports(fixture)).toEqual(['const FIELD — not a function']);
  });

  it("and it allows what the rule allows: an async function and a type", () => {
    const fixture = ts.createSourceFile(
      "fixture.ts",
      '"use server";\nexport type Answer = { ok: boolean };\nexport async function go(): Promise<void> {}\n',
      ts.ScriptTarget.ESNext,
      true
    );
    expect(offendingExports(fixture)).toEqual([]);
  });
});
