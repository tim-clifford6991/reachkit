// Issue 1525: `no overflow · axe` sweeps a pull request only where a screen can
// change. Runs `scripts/ci-changes.mjs` over sample diffs the way ci.yml's
// `what changed` job pipes `git diff --name-only` into it.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { classify, related, walkers } from "../../scripts/ci-changes.mjs";
import { LIVE_SCHEMA_TESTS } from "../../scripts/live-schema-tests.mjs";

const ROOT = path.resolve(__dirname, "../..");
const SCRIPT = path.join(ROOT, "scripts/ci-changes.mjs");

function changes(...files: string[]) {
  // Without GITHUB_OUTPUT, so a run inside CI does not write this job's outputs.
  const env = { ...process.env, GITHUB_OUTPUT: "" };
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", input: files.join("\n") + "\n", env });
  const out = (name: string) => new RegExp(`^${name}=(\\w+)$`, "m").exec(r.stdout)?.[1];
  return { status: r.status, code: out("code"), ui: out("ui"), db: out("db"), unit: out("unit") };
}

describe("what a pull request changed", () => {
  it.each([
    ["a content-only diff", ["src/lib/generate/brief.ts", "tests/generate/brief.test.ts"]],
    ["a job", ["src/jobs/engine.ts", "tests/jobs/engine.test.ts"]],
    ["a script", ["scripts/costs.mjs"]],
    ["the WordPress destination", ["src/lib/publish/destinations/wordpress/adapter.ts"]],
  ])("%s runs the code gates and skips the sweep", (_, files) => {
    expect(changes(...files)).toMatchObject({ status: 0, code: "true", ui: "false" });
  });

  it.each([
    ["a hosted page", "src/app/(hosted)/[...slug]/page.tsx"],
    ["a presentation module", "src/lib/presentation/copy/keys/app.ts"],
    ["the markdown renderer", "src/lib/publish/render/markdown.ts"],
    ["the hosted destination", "src/lib/publish/destinations/hosted/index.ts"],
    ["a page template", "src/lib/generate/templates/how-to.ts"],
    ["the mark", "src/lib/brand/mark.ts"],
    ["the hosted render seam", "src/lib/mail/shell/render.ts"],
    ["a stylesheet", "src/ui/theme.css"],
    ["the middleware", "src/middleware.ts"],
    ["the lockfile", "package-lock.json"],
    ["the layout suite", "tests/ui/layout/sweep.test.ts"],
    ["a migration the sweep seeds", "supabase/migrations/20261018000000_x.sql"],
    ["the workflow", ".github/workflows/ci.yml"],
  ])("%s runs the sweep", (_, file) => {
    expect(changes("src/lib/generate/brief.ts", file)).toMatchObject({ status: 0, code: "true", ui: "true" });
  });

  it.each([
    ["a canvas board", "docs/design/boards/canvas/X.dc.html"],
    ["the parity baseline", "docs/design/parity/baseline.json"],
    ["the parity script", "scripts/design/parity.mjs"],
  ])("%s alone runs the sweep", (_, file) => {
    expect(changes(file)).toMatchObject({ status: 0, ui: "true" });
  });

  it.each([
    ["a canvas board", "docs/design/boards/canvas/OptOut.dc.html"],
    ["an allow file", "docs/design/parity/OptOut.allow"],
  ])("%s alone runs the unit tests that render the state boards", (_, file) => {
    expect(changes(file)).toMatchObject({ status: 0, code: "true", unit: "affected" });
    const r = spawnSync(process.execPath, [SCRIPT, "--related"], { cwd: ROOT, encoding: "utf8", input: `${file}\n` });
    expect(r.status).toBe(0);
    const renders = Object.values(JSON.parse(readFileSync(path.join(ROOT, "docs/design/parity/boards.json"), "utf8")) as { render?: string }[])
      .flatMap((row) => (row.render ? [row.render] : []));
    expect(renders).toContain("tests/app/opt-out/board.test.tsx");
    expect(r.stdout.trim().split("\n")).toEqual(expect.arrayContaining(renders));
  });

  it("a documentation-only diff skips everything but audit", () => {
    expect(changes("docs/SPEC.md", "docs/spec/decisions/2026-10-18-1525.md", "README.md")).toEqual({
      status: 0,
      code: "false",
      ui: "false",
      db: "false",
      unit: "affected",
    });
  });

  it("an empty diff runs everything", () => {
    expect(changes()).toEqual({ status: 0, code: "true", ui: "true", db: "true", unit: "full" });
  });

  it.each([
    ["a screen", "src/app/(account)/app/page.tsx"],
    ["a job", "src/jobs/engine.ts"],
    ["a unit test", "tests/generate/brief.test.ts"],
  ])("%s runs only the unit tests its change reaches and skips the database job", (_, file) => {
    expect(changes(file)).toMatchObject({ status: 0, code: "true", db: "false", unit: "affected" });
  });

  it.each([
    ["the manifest", "package.json"],
    ["the lockfile", "package-lock.json"],
    ["the vitest config", "vitest.config.ts"],
    ["the live-schema list", "scripts/live-schema-tests.mjs"],
    ["the TypeScript config", "tsconfig.json"],
    ["the test setup", "tests/setup.ts"],
    ["the env fixture", "tests/generate/env.ts"],
    ["a shared fixture", "tests/scan/fixtures/report.json"],
    ["the workflow", ".github/workflows/ci.yml"],
    ["this classifier", "scripts/ci-changes.mjs"],
  ])("%s runs the full unit suite", (_, file) => {
    expect(changes("src/jobs/engine.ts", file)).toMatchObject({ status: 0, unit: "full" });
  });

  it.each([
    ["a migration", "supabase/migrations/20261019000000_x.sql"],
    ["the db client", "src/lib/db/topics.ts"],
    ["a db suite helper", "tests/db/substrate.ts"],
    ["a live-schema suite outside tests/db", "tests/costs/attribution-schema.test.ts"],
    ["the substrate", "scripts/db-substrate/up.sh"],
    ["any SQL", "scripts/costs/report.sql"],
    ["the lockfile", "package-lock.json"],
    ["the vitest config", "vitest.config.ts"],
    ["the live-schema list", "scripts/live-schema-tests.mjs"],
    ["a workflow", ".github/workflows/layout-nightly.yml"],
    ["the opportunity types", "src/lib/opportunities/types.ts"],
    ["the verdict types", "src/lib/opportunities/verdicts/types.ts"],
    ["the opportunity store", "src/lib/opportunities/store.ts"],
    ["the sweep's seed rows", "tests/ui/layout/seed-rows.ts"],
    ["the env the db client reads", "src/lib/config/env.ts"],
  ])("%s runs the database job", (_, file) => {
    expect(changes("src/app/(account)/app/page.tsx", file)).toMatchObject({ status: 0, db: "true" });
  });

  it("every module a live-schema suite imports at run time runs the database job", () => {
    const reached = liveSchemaImports();
    expect(reached.length).toBeGreaterThan(LIVE_SCHEMA_TESTS.length);
    const skipped = reached.filter((f) => !classify([f]).db);
    expect(skipped).toEqual([]);
  });
});

describe("what an affected unit run hands vitest related", () => {
  it("finds the suites that walk the tree, and none of the layout gate's", () => {
    const found = walkers(ROOT);
    expect(found).toEqual(expect.arrayContaining(["tests/ui/design/strategy.test.ts", "tests/ui/design/vocabulary.ts"]));
    expect(found.filter((f) => f.startsWith("tests/ui/layout/"))).toEqual([]);
  });

  it("finds a new walker by what it calls, not by a list", () => {
    const root = mkdtempSync(path.join(tmpdir(), "walkers-"));
    try {
      const put = (file: string, body: string) => {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), body);
      };
      put("tests/new/walks.test.ts", 'import { readdirSync } from "node:fs";\nreaddirSync("src");\n');
      put("tests/new/imports.test.ts", 'import { x } from "../../src/x";\n');
      put("tests/ui/layout/sweep.test.ts", 'readdirSync("src");\n');
      expect(walkers(root)).toEqual(["tests/new/walks.test.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("a theme.css-only diff runs every design suite", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "--related"], { cwd: ROOT, encoding: "utf8", input: "src/ui/theme.css\n" });
    expect(r.status).toBe(0);
    const files = r.stdout.trim().split("\n");
    const suites = readdirSync(path.join(ROOT, "tests/ui/design")).filter((f) => f.endsWith(".test.ts"));
    expect(suites).toEqual(expect.arrayContaining(["contrast.test.ts", "heading-layer.test.ts", "mark-and-glyphs.test.ts"]));
    expect(files).toEqual(expect.arrayContaining(suites.map((f) => `tests/ui/design/${f}`)));
  });

  it("covers a new design suite without a list to edit", () => {
    const root = mkdtempSync(path.join(tmpdir(), "design-"));
    try {
      mkdirSync(path.join(root, "tests/ui/design"), { recursive: true });
      writeFileSync(path.join(root, "tests/ui/design/zz-probe.test.ts"), 'readFileSync("src/ui/theme.css");\n');
      writeFileSync(path.join(root, "tests/ui/design/helper.ts"), "export const x = 1;\n");
      expect(related(["src/ui/theme.css"], root)).toEqual(["src/ui/theme.css", "tests/config/ci-changes.test.ts", "tests/ui/design/zz-probe.test.ts"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("always runs this classifier's own test, for a diff that does not touch it", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "--related"], {
      cwd: ROOT,
      encoding: "utf8",
      input: "src/lib/presentation/copy/keys/review.ts\n",
    });
    expect(r.status).toBe(0);
    const files = r.stdout.trim().split("\n");
    expect(files).toEqual(expect.arrayContaining(["src/lib/presentation/copy/keys/review.ts", "tests/config/ci-changes.test.ts", "tests/ui/design/strategy.test.ts"]));
  });
});

// Static imports are followed to the end; a dynamic `import()` counts only the
// module it names, because following those reaches most of src/lib.
function liveSchemaImports(): string[] {
  const seen = new Set<string>();
  const queue = LIVE_SCHEMA_TESTS.map((f) => path.join(ROOT, f));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const { spec, dynamic } of runtimeImports(file)) {
      const target = resolveImport(file, spec);
      if (!target) continue;
      if (dynamic) seen.add(target);
      else queue.push(target);
    }
  }
  return [...seen].map((f) => path.relative(ROOT, f)).sort();
}

function runtimeImports(file: string): { spec: string; dynamic: boolean }[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const out: { spec: string; dynamic: boolean }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const typeOnly =
        clause?.isTypeOnly ||
        (!!clause && !clause.name && !!named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((e) => e.isTypeOnly));
      if (!typeOnly) out.push({ spec: node.moduleSpecifier.text, dynamic: false });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      out.push({ spec: node.moduleSpecifier.text, dynamic: false });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteralLike(arg)) out.push({ spec: arg.text, dynamic: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  const candidates = [base, ...[".ts", ".tsx", ".mjs", ".js"].map((x) => base + x), path.join(base, "index.ts"), path.join(base, "index.tsx")];
  const found = candidates.find((c) => existsSync(c) && statSync(c).isFile());
  if (!found) throw new Error(`${path.relative(ROOT, from)} imports ${spec}, which resolves to no file`);
  return found;
}
