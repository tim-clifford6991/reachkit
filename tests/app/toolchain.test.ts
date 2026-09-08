// tests/app/toolchain.test.ts
//
// WO-001 test plan — criteria quoted from BP-001 (satisfies: []) and BUILD.md,
// not from a requirement (see WO-001 `## Test plan` header note).
//
//   - BUILD.md §1: "Next.js (App Router) + TypeScript"
//   - BUILD.md §1: "Repo shape: standard Next.js."
//   - BP-005 NFR budget: "The pins test runs in under a second and is the
//     first check in CI."
//
// Every path this file reads is NEW as of WO-001 (see the work order's
// "Provenance of this file plan"); before WO-001 lands, every assertion in
// this file fails because the file or directory it reads does not exist.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

function readJson(relPath: string): unknown {
  return JSON.parse(readFileSync(path.join(ROOT, relPath), "utf8"));
}

describe("BUILD.md §1 — Next.js (App Router) + TypeScript", () => {
  it("package.json declares next and typescript", () => {
    const pkg = readJson("package.json") as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps).toHaveProperty("next");
    expect(deps).toHaveProperty("typescript");
  });

  it("tsconfig.json sets strict: true", () => {
    const tsconfig = readJson("tsconfig.json") as {
      compilerOptions?: { strict?: boolean };
    };
    expect(tsconfig.compilerOptions?.strict).toBe(true);
  });
});

describe('BUILD.md §1 — "Repo shape: standard Next.js."', () => {
  const requiredDirs = ["src/app", "src/lib", "src/jobs", "src/ui", "supabase", "tests"];

  it.each(requiredDirs)("%s exists", (rel) => {
    expect(existsSync(path.join(ROOT, rel))).toBe(true);
  });

  it("no top-level directory outside structure.md rule 7's set is present", () => {
    // ARCHITECTURE.md rule 7: the committed top-level set is closed at
    // `src/`, `supabase/`, `tests/`, `public/`, `scripts/`, `docs/`,
    // `archive/` (the frozen sdlc-factory corpus, 2026-09-04), `.github/`
    // and `.claude/`. Tooling/VCS
    // directories that are never committed (node_modules, .next, coverage,
    // .git) are excluded here the same way .gitignore excludes them.
    //
    // `docs/` is the ninth, and rule 7 names it: the documentation corpus —
    // the authority map, the process and deployment notes, and the approved
    // design under `design/approved/**` (issues #364, #367, #378).
    const allowed = new Set([
      "src",
      "supabase",
      "tests",
      "public",
      "scripts",
      "archive",
      "docs",
      ".github",
      ".claude",
    ]);
    const toolingOnly = new Set(["node_modules", ".next", "coverage", ".git"]);
    const entries = readdirSync(ROOT, { withFileTypes: true }).filter((e) => e.isDirectory());
    const unexpected = entries
      .map((e) => e.name)
      .filter((name) => !allowed.has(name) && !toolingOnly.has(name));
    expect(unexpected).toEqual([]);
  });
});

describe("BP-005 NFR budget — the pins test runs first", () => {
  it("vitest.config.ts orders tests/pins.test.ts first", async () => {
    const [{ default: config }, { BaseSequencer }] = await Promise.all([
      import("../../vitest.config.ts"),
      import("vitest/node"),
    ]);
    const Sequencer = (config as { test?: { sequence?: { sequencer?: unknown } } }).test?.sequence
      ?.sequencer as (new (ctx: unknown) => InstanceType<typeof BaseSequencer>) | undefined;
    expect(Sequencer, "vitest.config.ts must configure test.sequence.sequencer").toBeDefined();
    // A custom sequencer, not the framework default — the default does not
    // discriminate pins.test.ts from any other file.
    expect(Sequencer).not.toBe(BaseSequencer);

    // BaseSequencer#sort only needs `ctx.config` for a glob-based comparator
    // it falls back to when neither file declares a `sequence.shuffle`
    // seed; passing an empty object is enough for this test's shape.
    const instance = new Sequencer!({ config: {} } as never);
    const files = [
      { moduleId: "/repo/tests/app/toolchain.test.ts" },
      { moduleId: "/repo/tests/account/billing/gate.test.ts" },
      { moduleId: "/repo/tests/pins.test.ts" },
      { moduleId: "/repo/tests/app/env-example.test.ts" },
    ] as unknown as Parameters<InstanceType<typeof BaseSequencer>["sort"]>[0];
    const sorted = await instance.sort(files);
    expect(sorted[0]?.moduleId).toBe("/repo/tests/pins.test.ts");
  });
});

describe("tests/setup.ts — no test process may make a real network call", () => {
  it("throws when fetch() is called", async () => {
    const setupPath = path.join(ROOT, "tests/setup.ts");
    expect(existsSync(setupPath)).toBe(true);
    await import("../setup.ts");
    expect(() => (globalThis.fetch as unknown as () => void)()).toThrow();
  });
});
