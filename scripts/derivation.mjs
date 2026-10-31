// scripts/derivation.mjs — issue 1481
//
// The re-score's derivation: one fingerprint of the code under `src/lib` that
// `src/lib/scan/rescore-run.ts` executes — the scoring, the drivers, the
// rivals, the markets and the reading a stored scan is given again (issues
// 1426, 1433, 1470). `next.config.ts` computes it at build and the deployment
// carries it as `RK_DERIVATION`, so the `scan/rescore` tick knows when a
// deploy changed how a scan is read, and asks for the dry run and the apply
// itself.
//
// The walk is by declaration, not by file: from every statement of the entry
// it follows each value name a statement uses to the top-level statement that
// defines it, through imports and through a barrel's re-exports. A barrel so
// brings in only the declarations the re-score uses, a sibling it also
// re-exports is not read, and a registry only an unused function calls is not
// reached. A top-level statement that declares nothing runs whenever its file
// loads, so it is always kept. Types, comments, layout, a dynamic `import()` (how the
// re-score reaches the database) and code outside `src/lib` are not part of
// it. Plain JavaScript, so the build can import it without TypeScript; the
// parser is the `typescript` package the build already has.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

const ENTRY = "src/lib/scan/rescore-run.ts";
const SCOPE = "src/lib/";
const ALL = "*";

function resolved(root, from, specifier) {
  const base = specifier.startsWith("@/")
    ? join(root, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (base === null) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return relative(root, candidate).startsWith(SCOPE) ? candidate : null;
    }
  }
  return null;
}

const modifier = (node, kind) => (ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : []).some((m) => m.kind === kind);
const erased = (node) =>
  ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || modifier(node, ts.SyntaxKind.DeclareKeyword);
const printer = ts.createPrinter({ removeComments: true });
// Printed without comments or layout, so a reworded comment or a reflowed line is the same code.
const statement = (node, names = [], uses = new Set(), loads = null) => ({
  text: printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()),
  names,
  uses,
  loads,
});

function bindings(name, out) {
  if (ts.isIdentifier(name)) out.push(name.text);
  else for (const element of name.elements) if (!ts.isOmittedExpression(element)) bindings(element.name, out);
  return out;
}

/** The value names a node mentions, leaving out types, property names and keys. */
function mentions(node, out = new Set()) {
  if (ts.isHeritageClause(node) && node.token === ts.SyntaxKind.ImplementsKeyword) return out;
  if (ts.isExpressionWithTypeArguments(node)) return mentions(node.expression, out);
  if (ts.isTypeNode(node) || ts.isTypeParameterDeclaration(node)) return out;
  if (ts.isIdentifier(node)) out.add(node.text);
  else if (ts.isPropertyAccessExpression(node)) mentions(node.expression, out);
  else if ((ts.isPropertyAssignment(node) || ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) && !ts.isComputedPropertyName(node.name)) {
    node.forEachChild((child) => void (child !== node.name && mentions(child, out)));
  } else node.forEachChild((child) => void mentions(child, out));
  return out;
}

/** One file's top-level statements, what each declares, and where its imported and re-exported names come from. */
function parse(root, file) {
  const text = readFileSync(file, "utf8");
  const mod = { statements: [], locals: new Map(), imports: new Map(), exports: new Map(), stars: [] };
  if (file.endsWith(".json")) {
    mod.statements.push({ text, names: [], uses: new Set(), loads: null });
    return mod;
  }
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  for (const node of source.statements) {
    if (ts.isImportDeclaration(node)) {
      const target = resolved(root, file, node.moduleSpecifier.text);
      const clause = node.importClause;
      if (target === null || clause?.isTypeOnly) continue;
      if (clause === undefined) {
        mod.statements.push(statement(node, [], new Set(), target));
        continue;
      }
      if (clause.name) mod.imports.set(clause.name.text, { target, name: "default" });
      const named = clause.namedBindings;
      if (named && ts.isNamespaceImport(named)) mod.imports.set(named.name.text, { target, name: ALL });
      else for (const spec of named?.elements ?? []) {
        if (!spec.isTypeOnly) mod.imports.set(spec.name.text, { target, name: (spec.propertyName ?? spec.name).text });
      }
    } else if (ts.isExportDeclaration(node)) {
      const target = node.moduleSpecifier ? resolved(root, file, node.moduleSpecifier.text) : undefined;
      if (node.isTypeOnly || target === null) continue;
      const via = statement(node);
      const clause = node.exportClause;
      if (clause === undefined) mod.stars.push({ target, via });
      else if (ts.isNamespaceExport(clause)) mod.exports.set(clause.name.text, { target, name: ALL, via });
      else for (const spec of clause.elements) {
        if (spec.isTypeOnly) continue;
        const name = (spec.propertyName ?? spec.name).text;
        mod.exports.set(spec.name.text, target ? { target, name, via } : { local: name });
      }
    } else if (!erased(node)) {
      const names = [];
      if (ts.isVariableStatement(node)) for (const d of node.declarationList.declarations) bindings(d.name, names);
      else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node)) && node.name) names.push(node.name.text);
      const exported = modifier(node, ts.SyntaxKind.ExportKeyword) || ts.isExportAssignment(node);
      if (modifier(node, ts.SyntaxKind.DefaultKeyword) || ts.isExportAssignment(node)) names.push("default");
      const s = statement(node, names, mentions(node));
      mod.statements.push(s);
      for (const name of names) mod.locals.set(name, s);
      if (exported) for (const name of names) mod.exports.set(name, { local: name });
    }
  }
  return mod;
}

/** The statement texts the entry executes, by repository-relative file. */
function walk(root) {
  const modules = new Map();
  const kept = new Map();
  const answers = new Map();
  const open = (file) => {
    if (!modules.has(file)) {
      modules.set(file, parse(root, file));
      kept.set(file, new Set());
      for (const s of modules.get(file).statements) if (s.names.length === 0) keep(file, s);
    }
    return modules.get(file);
  };
  const keep = (file, s) => {
    if (kept.get(file).has(s)) return;
    kept.get(file).add(s);
    if (s.loads) open(s.loads);
    const { locals, imports } = modules.get(file);
    for (const name of s.uses) {
      if (locals.has(name)) keep(file, locals.get(name));
      else if (imports.has(name)) need(imports.get(name).target, imports.get(name).name);
    }
  };
  // Whether `file` exports `name`, keeping on the way the statements that give it.
  const need = (file, name) => {
    const key = `${file}\0${name}`;
    if (!answers.has(key)) {
      answers.set(key, false);
      answers.set(key, give(file, name));
    }
    return answers.get(key);
  };
  const give = (file, name) => {
    const mod = open(file);
    if (name === ALL) {
      for (const s of mod.statements) keep(file, s);
      for (const exported of mod.exports.keys()) need(file, exported);
      for (const star of mod.stars) {
        keep(file, star.via);
        need(star.target, ALL);
      }
      return true;
    }
    const exported = mod.exports.get(name);
    if (exported?.local !== undefined) {
      const local = exported.local;
      if (mod.locals.has(local)) keep(file, mod.locals.get(local));
      else if (mod.imports.has(local)) need(mod.imports.get(local).target, mod.imports.get(local).name);
      return true;
    }
    if (exported) {
      keep(file, exported.via);
      need(exported.target, exported.name);
      return true;
    }
    const giving = mod.stars.filter((star) => need(star.target, name));
    for (const star of giving) keep(file, star.via);
    return giving.length > 0;
  };
  need(join(root, ENTRY), ALL);
  const executed = new Map();
  for (const [file, mod] of modules) {
    const order = [...mod.statements, ...mod.stars.map((s) => s.via), ...[...mod.exports.values()].map((e) => e.via)];
    const texts = [...new Set(order)].filter((s) => s && kept.get(file).has(s)).map((s) => s.text);
    if (texts.length > 0) executed.set(relative(root, file), texts);
  }
  return executed;
}

/** The files the re-score executes code from, repository-relative and sorted. */
export function derivationFiles(root = process.cwd()) {
  return [...walk(root).keys()].sort();
}

/** Twelve hex characters: the same executed code gives the same value. */
export function derivation(root = process.cwd()) {
  const executed = walk(root);
  const hash = createHash("sha256");
  for (const file of [...executed.keys()].sort()) {
    hash.update(file).update("\0");
    for (const text of executed.get(file)) hash.update(text).update("\0");
  }
  return hash.digest("hex").slice(0, 12);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = derivationFiles();
  if (process.argv.includes("--files")) for (const file of files) console.log(file);
  console.log(`${derivation()} (${files.length} files)`);
}
