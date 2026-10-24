// "ReachKit this week" is built from git, the decision files, GitHub answers
// and the box spend log, all fixtures in a temporary checkout. A source it
// could not read is said to be not read, never shown as nothing.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { decided, render, shipped, spend } from "../../scripts/this-week.mjs";

const SCRIPT = path.resolve(__dirname, "../../scripts/this-week.mjs");

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function checkout() {
  const root = mkdtempSync(path.join(tmpdir(), "rk-this-week-"));
  dirs.push(root);
  const write = (rel: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };
  write("docs/spec/decisions/2026-10-01-900.md", "---\nsection: §7\n---\n\n2026-10-01  **An old ruling** (owner, #900).\n");
  write("docs/spec/decisions/2026-10-16-1001.md", "---\nsection: §6\n---\n\n2026-10-16  **A plumber's service asked for in its town is commercial** (owner, #1001).\n");
  write("docs/spec/decisions/README.md", "# Dated SPEC rulings\n");
  write("docs/PROCESS.md", "# Process\n\n## History\n\n2026-10-17  **One weekly review run** (owner, C7, #1002). Stated in Current.\n\n2026-09-01  **Older** (owner, #1).\n");
  write("spend.jsonl", [
    { at: "2026-10-15T09:00:00.000Z", issue: "1001", script: "panel", source: "serp/google/organic", cents: 2.5, billed: 2 },
    { at: "2026-10-18T09:00:00.000Z", issue: "1003", script: "page", source: "llm:writer", cents: 4 },
    { at: "2026-10-01T09:00:00.000Z", issue: "900", script: "page", source: "llm:writer", cents: 99 },
  ].map((r) => JSON.stringify(r)).join("\n") + "\n");
  const git = (date: string, ...args: string[]) =>
    spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
  git("2026-10-01T10:00:00Z", "init", "-q", "-b", "main");
  git("2026-10-01T10:00:00Z", "commit", "-q", "--allow-empty", "-m", "feat(scan): an old change (#900)");
  git("2026-10-15T10:00:00Z", "commit", "-q", "--allow-empty", "-m", "fix(billing): a failed month read never breaks the Billing tab (#1001)");
  git("2026-10-19T10:00:00Z", "commit", "-q", "--allow-empty", "-m", "a pull request runs only the tests it reaches (#1003)");
  return root;
}

const GITHUB = {
  found: [{ number: 1100, title: "Delete the second date helper", state: "OPEN" }],
  launch: [
    { number: 1200, title: "Stripe goes live", labels: [{ name: "blocked-on-owner" }] },
    { number: 1150, title: "A dentist's first page goes live", labels: [] },
  ],
  blocked: [{ number: 1200, title: "Stripe goes live" }],
  open: [{ number: 1300, title: "[nightly] main is red" }, { number: 1150, title: "A dentist's first page goes live" }],
};

describe("ReachKit this week", () => {
  it("reads each section from its own record, inside the week only", () => {
    const root = checkout();
    const page = render({
      since: "2026-10-14",
      until: "2026-10-20",
      shipped: shipped(root, "main", "2026-10-14", "2026-10-20"),
      decided: decided(root, "2026-10-14", "2026-10-20"),
      github: GITHUB,
      spend: spend(path.join(root, "spend.jsonl"), "2026-10-14", "2026-10-20"),
      spendFile: path.join(root, "spend.jsonl"),
    });
    const section = (name: string) => page.split(`## ${name}\n`)[1]!.split("\n## ")[0]!;

    expect(section("Shipped")).toContain("- **billing** (1)\n  - a failed month read never breaks the Billing tab (#1001)");
    expect(section("Shipped")).toContain("- **other** (1)\n  - a pull request runs only the tests it reaches (#1003)");
    expect(section("Shipped")).not.toContain("#900");
    expect(section("Decided")).toContain("- 2026-10-16 SPEC §6: A plumber's service asked for in its town is commercial (#1001)");
    expect(section("Decided")).toContain("- 2026-10-17 PROCESS: One weekly review run (#1002)");
    expect(section("Decided")).not.toMatch(/old ruling|Older/);
    expect(section("Found")).toContain("Delete the second date helper (#1100)");
    expect(section("Next")).toContain("- A dentist's first page goes live (#1150)");
    expect(section("Next")).toContain("- Waiting on the owner: Stripe goes live (#1200)");
    expect(section("Next")).not.toMatch(/^- Stripe goes live/m);
    expect(section("Health")).toContain("- Red: [nightly] main is red (#1300)");
    expect(section("Spend")).toContain("6.5¢ recorded, 2¢ billed");
    expect(section("Spend")).not.toContain("99");
  });

  it("says a source was not read instead of showing nothing", () => {
    const root = checkout();
    writeFileSync(path.join(root, "github.json"), JSON.stringify({ found: null, launch: null, blocked: null, open: null }));
    const ok = spawnSync(
      process.execPath,
      [SCRIPT, "--root", root, "--ref", "no-such-ref", "--until", "2026-10-20", "--github", path.join(root, "github.json"), "--spend-log", path.join(root, "absent.jsonl")],
      { cwd: root, encoding: "utf8" }
    );
    expect(ok.status, ok.stderr).toBe(0);
    for (const name of ["Shipped", "Found", "Next", "Health", "Spend"]) {
      expect(ok.stdout.split(`## ${name}\n`)[1]!.split("\n## ")[0]).toMatch(/^- Not read: /m);
    }
    expect(ok.stdout).not.toMatch(/No pull request merged|filed no issue|Nothing is waiting|No open \[|0¢ recorded/);
  });
});
