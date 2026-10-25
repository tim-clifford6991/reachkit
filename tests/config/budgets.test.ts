import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { budgetFindings, unresolvedCitations } from "../../scripts/lib/budgets.mjs";

const ROOT = path.resolve(__dirname, "../..");
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("unresolvedCitations", () => {
  it("counts each citation that no heading of a docs page names", () => {
    const files = [
      { rel: "docs/SPEC.md", text: "## §7 Calendar\n### ADR-080 The publish machine\nADR-080 again, BP-005 here\n" },
      { rel: "src/lib/a.ts", text: "// ADR-080, ADR-084, WO-041, BUILD §4.7 and BUILD §4\n" },
      { rel: "src/notes.md", text: "## BP-005 a heading outside docs defines nothing\n" },
    ];
    const { count, byFile } = unresolvedCitations(files);
    expect(count).toBe(6);
    expect(Object.fromEntries(byFile)).toEqual({ "docs/SPEC.md": 1, "src/lib/a.ts": 4, "src/notes.md": 1 });
  });
});

describe("budgetFindings", () => {
  const files = [{ rel: "src/a.ts", text: "// ADR-050 and BP-002\n" }];

  it("passes at the budget and fails one citation over it", () => {
    expect(budgetFindings({ budgets: { citations: 2 }, base: null, files })).toEqual([]);
    expect(budgetFindings({ budgets: { citations: 1 }, base: null, files })).toEqual([
      "2 unresolved ADR-/BUILD §/BP-/WO- citations, over the budget of 1 in scripts/budgets.json (most in src/a.ts 2)",
    ]);
  });

  it("lets a budget fall and never rise from the base commit's", () => {
    expect(budgetFindings({ budgets: { citations: 3 }, base: { citations: 4 }, files })).toEqual([]);
    expect(budgetFindings({ budgets: { citations: 3 }, base: { citations: 2 }, files })).toEqual([
      "scripts/budgets.json raises citations from 2 to 3; a budget only goes down",
    ]);
  });

  it("fails a budgets file without a citations count", () => {
    expect(budgetFindings({ budgets: null, base: null, files })).toEqual(["scripts/budgets.json has no citations count"]);
  });
});

describe("hygiene reads scripts/budgets.json", () => {
  function repo() {
    const dir = mkdtempSync(path.join(tmpdir(), "hygiene-budgets-"));
    dirs.push(dir);
    cpSync(path.join(ROOT, "scripts/hygiene.mjs"), path.join(dir, "scripts/hygiene.mjs"));
    cpSync(path.join(ROOT, "scripts/lib"), path.join(dir, "scripts/lib"), { recursive: true });
    mkdirSync(path.join(dir, "src"));
    const write = (rel: string, text: string) => writeFileSync(path.join(dir, rel), text);
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" });
    git("init", "-q", "-b", "main");
    const hygiene = () => spawnSync(process.execPath, [path.join(dir, "scripts/hygiene.mjs")], { encoding: "utf8" }).stdout;
    return { write, git, hygiene };
  }

  it("fails a seeded citation over the budget and a raised budget, and passes today's count", () => {
    const r = repo();
    r.write("scripts/budgets.json", '{ "citations": 1 }\n');
    r.write("src/a.ts", "// ADR-050\n");
    r.git("add", "-A");
    r.git("commit", "-q", "-m", "base");
    expect(r.hygiene()).not.toMatch(/citations|budgets\.json/);

    r.write("src/a.ts", "// ADR-050 and ADR-051\n");
    expect(r.hygiene()).toContain("- repo: 2 unresolved ADR-/BUILD §/BP-/WO- citations, over the budget of 1");

    r.write("scripts/budgets.json", '{ "citations": 2 }\n');
    r.git("commit", "-q", "-am", "raise");
    const out = r.hygiene();
    expect(out).toContain("- repo: scripts/budgets.json raises citations from 1 to 2; a budget only goes down");
    expect(out).not.toContain("over the budget");
  });
});
