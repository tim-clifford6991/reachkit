// Where the page reading may reach. The hosted destination's weekly step and
// the reading itself never load the opportunities engine, and the backfill
// never loads a vendor client or the database: each walked through every
// runtime import, at any depth. Type-only imports are erased and not followed.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

function resolve(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(ROOT, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The modules a file loads at run time: value imports, re-exports and `import()`. */
function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.importClause?.isTypeOnly !== true) {
      const named = node.importClause?.namedBindings;
      const onlyTypes =
        node.importClause !== undefined &&
        node.importClause.name === undefined &&
        named !== undefined &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((element) => element.isTypeOnly);
      if (!onlyTypes) out.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      out.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0]!)) {
      out.push((node.arguments[0] as ts.StringLiteral).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** The first import path from `entry` into `forbidden`, or `null`. */
export function reaches(entry: string, forbidden: readonly string[]): string[] | null {
  const seen = new Set<string>();
  const walk = (file: string, via: string[]): string[] | null => {
    if (seen.has(file)) return null;
    seen.add(file);
    for (const specifier of runtimeImports(file)) {
      const next = resolve(file, specifier);
      if (next === null) continue;
      const relative = path.relative(ROOT, next);
      if (forbidden.some((area) => relative.startsWith(area))) return [...via, relative];
      const found = walk(next, [...via, relative]);
      if (found !== null) return found;
    }
    return null;
  };
  return walk(path.join(ROOT, entry), [entry]);
}

describe("the checker", () => {
  it("finds a forbidden module reached at depth", () => {
    // Through the verdict judge, the reading's own module and the engine.
    expect(reaches("src/lib/opportunities/verdicts/judge.ts", ["src/lib/measure/page-reading"])).not.toBeNull();
    expect(reaches("src/lib/opportunities/verdicts/store.ts", ["src/lib/publish/"])).not.toBeNull();
  });
});

describe("where the page reading reaches", () => {
  it.each(["src/lib/publish/destinations/hosted/search-engines.ts", "src/lib/measure/page-reading.ts", "src/lib/measure/ladder.ts"])(
    "%s never loads the opportunities engine",
    (entry) => {
      expect(reaches(entry, ["src/lib/opportunities/"])).toBeNull();
    }
  );

  it("the backfill loads no vendor client and no database", () => {
    expect(reaches("scripts/backfill-page-reading/run.ts", ["src/lib/vendors/", "src/lib/db"])).toBeNull();
  });
});
