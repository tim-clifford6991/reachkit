// Issue 1525: `no overflow · axe` sweeps a pull request only where a screen can
// change. Runs `scripts/ci-changes.mjs` over sample diffs the way ci.yml's
// `what changed` job pipes `git diff --name-only` into it.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "../../scripts/ci-changes.mjs");

function changes(...files: string[]) {
  // Without GITHUB_OUTPUT, so a run inside CI does not write this job's outputs.
  const env = { ...process.env, GITHUB_OUTPUT: "" };
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", input: files.join("\n") + "\n", env });
  const out = (name: string) => new RegExp(`^${name}=(true|false)$`, "m").exec(r.stdout)?.[1];
  return { status: r.status, code: out("code"), ui: out("ui") };
}

describe("what a pull request changed", () => {
  it.each([
    ["a content-only diff", ["src/lib/generate/brief.ts", "tests/generate/brief.test.ts"]],
    ["a job", ["src/jobs/engine.ts", "tests/jobs/engine.test.ts"]],
    ["a script", ["scripts/costs.mjs"]],
    ["the WordPress destination", ["src/lib/publish/destinations/wordpress/adapter.ts"]],
  ])("%s runs the code gates and skips the sweep", (_, files) => {
    expect(changes(...files)).toEqual({ status: 0, code: "true", ui: "false" });
  });

  it.each([
    ["a hosted page", "src/app/(hosted)/[...slug]/page.tsx"],
    ["a presentation module", "src/lib/presentation/copy/keys/app.ts"],
    ["the markdown renderer", "src/lib/publish/render/markdown.ts"],
    ["the hosted destination", "src/lib/publish/destinations/hosted/index.ts"],
    ["a page template", "src/lib/generate/templates/how-to.ts"],
    ["the mark", "src/lib/brand/mark.ts"],
    ["a stylesheet", "src/ui/theme.css"],
    ["the middleware", "src/middleware.ts"],
    ["the lockfile", "package-lock.json"],
    ["the layout suite", "tests/ui/layout/sweep.test.ts"],
    ["a migration the sweep seeds", "supabase/migrations/20261018000000_x.sql"],
    ["the workflow", ".github/workflows/ci.yml"],
  ])("%s runs the sweep", (_, file) => {
    expect(changes("src/lib/generate/brief.ts", file)).toMatchObject({ status: 0, code: "true", ui: "true" });
  });

  it("a documentation-only diff skips everything but audit", () => {
    expect(changes("docs/SPEC.md", "docs/spec/decisions/2026-10-18-1525.md", "README.md")).toEqual({
      status: 0,
      code: "false",
      ui: "false",
    });
  });

  it("an empty diff runs everything", () => {
    expect(changes()).toEqual({ status: 0, code: "true", ui: "true" });
  });
});
