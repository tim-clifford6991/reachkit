// The repository is public: a job on a self-hosted runner would run a fork's
// pull request on the production box, so every job is GitHub-hosted and no
// repository variable can choose its runner.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../../.github/workflows");
const WORKFLOWS = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));

describe("every CI job runs GitHub-hosted", () => {
  it.each(WORKFLOWS)("%s names only ubuntu-latest and reads no runner variable", (file) => {
    const text = readFileSync(path.join(DIR, file), "utf8");
    const runners = [...text.matchAll(/^\s*runs-on:\s*(.+)$/gm)].map((m) => m[1]?.trim());
    for (const runner of runners) expect(runner).toBe("ubuntu-latest");
    expect(text).not.toMatch(/vars\.CI_/);
  });
});

const doc = (name: string) => readFileSync(path.resolve(__dirname, "../../docs", name), "utf8");
const BOX_RUNNER = /reachkit-box|reachkit-light|self-hosted/;

describe("the documents never offer a box runner", () => {
  it("RUNBOOK names no box runner as stopped, a fallback or a switch", () => {
    const runbook = doc("RUNBOOK.md");
    expect(runbook).not.toContain("fallback only");
    expect(runbook).not.toContain("Those are stopped");
    const offers = runbook.split("\n").filter((l) => BOX_RUNNER.test(l) && /fallback/i.test(l));
    expect(offers).toEqual([]);
  });

  it("every History line before 2026-10-22 that puts CI on the box is marked superseded", () => {
    const history = doc("PROCESS.md").split("\n## History")[1] ?? "";
    const onBox = history
      .split("\n")
      .filter((l) => /^\d{4}-\d{2}-\d{2}/.test(l) && l.slice(0, 10) < "2026-10-22")
      .filter((l) => /CI_LIGHT_RUNNER|reachkit-box|reachkit-light|self-hosted|CI runs[^.]*on the box/.test(l));
    expect(onBox.length).toBeGreaterThan(0);
    for (const line of onBox) expect(line).toContain("Superseded 2026-10-22");
  });
});
