import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

describe("hygiene holds the line budgets against the pull request's base", () => {
  const BUDGETS = path.join(ROOT, "scripts/budgets.json");
  const lines = (n: number, tag = "a") => Array.from({ length: n }, (_, i) => `// ${tag} ${i}`).join("\n") + "\n";
  const findings = (out: string) => out.split("\n").filter((l) => /lines|budgets\.json/.test(l));

  function seeded() {
    const dir = mkdtempSync(path.join(tmpdir(), "hygiene-lines-"));
    dirs.push(dir);
    for (const rel of ["scripts/hygiene.mjs", "scripts/lib", "scripts/budgets.json"]) {
      cpSync(path.join(ROOT, rel), path.join(dir, rel), { recursive: true });
    }
    const write = (rel: string, text: string) => {
      mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      writeFileSync(path.join(dir, rel), text);
    };
    const git = (...args: string[]) =>
      execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" });
    write("src/big.ts", lines(700));
    for (let i = 0; i < 19; i++) write(`src/lib/opportunities/o${i}.ts`, lines(500));
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("commit", "-q", "-m", "base");
    // Each case is one pull request on the base, as CI's merge commit sees it.
    const pr = (change: () => void) => {
      git("reset", "-q", "--hard", "main");
      git("clean", "-qfd");
      git("checkout", "-q", "-B", "pr", "main");
      change();
      git("add", "-A");
      git("commit", "-q", "--allow-empty", "-m", "pr");
      return findings(spawnSync(process.execPath, [path.join(dir, "scripts/hygiene.mjs")], { encoding: "utf8" }).stdout);
    };
    return { write, pr };
  }

  it("fails each seeded growth and passes each shrink, swap and proportionate test", () => {
    const r = seeded();
    expect(r.pr(() => r.write("src/new.ts", lines(601)))).toEqual([
      "- repo: src/new.ts has 601 lines, over the 600-line file cap; split it by concept",
    ]);
    expect(r.pr(() => r.write("src/big.ts", lines(701)))).toEqual([
      "- repo: src/big.ts grows from 700 to 701 lines; a file over 600 may only shrink",
    ]);
    expect(r.pr(() => r.write("src/lib/opportunities/o0.ts", lines(501)))).toEqual([
      "- repo: src/lib/opportunities grows by 1 to 9501 lines; it may not grow while over 9000",
    ]);
    expect(r.pr(() => r.write("tests/a.test.ts", lines(201)))).toEqual([
      "- repo: tests grow by 201 net lines, over the 200 this pull request's src allows",
    ]);

    expect(r.pr(() => r.write("src/big.ts", lines(699)))).toEqual([]);
    expect(r.pr(() => r.write("src/big.ts", lines(700).replace(/^\/\/ a [0-4]$/gm, "// b")))).toEqual([]);
    expect(r.pr(() => (r.write("tests/a.test.ts", lines(300)), r.write("src/feature.ts", lines(600))))).toEqual([]);
  });

  it("changes a lines number only beside a new dated decision file", () => {
    const r = seeded();
    const raise = () => r.write("scripts/budgets.json", readFileSync(BUDGETS, "utf8").replace('"fileMax": 600', '"fileMax": 650'));
    expect(r.pr(raise)).toEqual([
      "- repo: scripts/budgets.json changes lines.fileMax from 600 to 650 without a new docs/spec/decisions/ file",
    ]);
    expect(r.pr(() => (raise(), r.write("docs/spec/decisions/2026-10-25-1626.md", "# ruling\n")))).toEqual([]);
  });
});
