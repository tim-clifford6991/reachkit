// tests/app/client-constants.test.ts — issue 1510
//
// A module with no `"use client"` must not read a constant from one that has
// it. Next hands a server module every export of a client module as a client
// reference: a component renders, but a string arrives as a function that
// throws, and `/#${WHY_SECTION_ID}` printed that function's source into the
// public header's href. Nothing in `tsc`, eslint or a jsdom render sees it,
// so this scans the imports.
//
// A constant is an exported `const` or `let` whose value is a literal — a
// string, number, boolean, template, object or array. A component made with
// `memo(…)` or `dynamic(…)` is a call and is left alone.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SRC = path.join(ROOT, "src");

function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function isClient(source: ts.SourceFile): boolean {
  const first = source.statements[0];
  return (
    first !== undefined &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "use client"
  );
}

function isLiteral(node: ts.Expression): boolean {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    return isLiteral(node.expression);
  }
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node) ||
    ts.isNumericLiteral(node) ||
    ts.isObjectLiteralExpression(node) ||
    ts.isArrayLiteralExpression(node) ||
    (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  );
}

/** The names a module exports as literal constants. */
function exportedConstants(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer && isLiteral(decl.initializer)) names.add(decl.name.text);
    }
  }
  return names;
}

/** The value names a module imports or re-exports, per specifier. */
function valueImports(source: ts.SourceFile): { spec: string; names: string[] }[] {
  const out: { spec: string; names: string[] }[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly) continue;
      const bindings = clause.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      const names = bindings.elements.filter((e) => !e.isTypeOnly).map((e) => (e.propertyName ?? e.name).text);
      out.push({ spec: statement.moduleSpecifier.text, names });
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.isTypeOnly || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
      const names = statement.exportClause.elements
        .filter((e) => !e.isTypeOnly)
        .map((e) => (e.propertyName ?? e.name).text);
      out.push({ spec: statement.moduleSpecifier.text, names });
    }
  }
  return out;
}

/** A server module's imports of constants from client modules, as `name from file`. */
function constantsFromClient(
  server: ts.SourceFile,
  resolve: (spec: string) => ts.SourceFile | null,
): string[] {
  if (isClient(server)) return [];
  const found: string[] = [];
  for (const { spec, names } of valueImports(server)) {
    const target = resolve(spec);
    if (!target || !isClient(target)) continue;
    const constants = exportedConstants(target);
    for (const name of names) if (constants.has(name)) found.push(`${name} from ${spec}`);
  }
  return found;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) && !entry.endsWith(".d.ts") ? [full] : [];
  });
}

const parsed = new Map<string, ts.SourceFile>();
function load(file: string): ts.SourceFile {
  let source = parsed.get(file);
  if (!source) {
    source = parse(file, readFileSync(file, "utf8"));
    parsed.set(file, source);
  }
  return source;
}

function resolverFor(from: string): (spec: string) => ts.SourceFile | null {
  return (spec) => {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
    else return null;
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return load(candidate);
    }
    return null;
  };
}

describe("issue 1510 — no server module reads a constant from a client module", () => {
  it("reports the shape that broke the header: a section id read from a client module", () => {
    const client = parse("FieldCta.tsx", `"use client";\nexport const WHY_SECTION_ID = "why";\nexport function FieldCta() { return null; }\n`);
    const header = parse("Header.tsx", `import { WHY_SECTION_ID, FieldCta } from "../_landing/FieldCta";\n`);
    expect(constantsFromClient(header, () => client)).toEqual(["WHY_SECTION_ID from ../_landing/FieldCta"]);
  });

  it("leaves a client module importing the same constant alone", () => {
    const client = parse("FieldCta.tsx", `"use client";\nexport const WHY_SECTION_ID = "why";\n`);
    const arm = parse("HeaderArm.tsx", `"use client";\nimport { WHY_SECTION_ID } from "../_landing/FieldCta";\n`);
    expect(constantsFromClient(arm, () => client)).toEqual([]);
  });

  it("finds no such import anywhere under src/", () => {
    const offenders = walk(SRC).flatMap((file) =>
      constantsFromClient(load(file), resolverFor(file)).map((hit) => `${path.relative(ROOT, file)}: ${hit}`),
    );
    expect(offenders).toEqual([]);
  });
});
