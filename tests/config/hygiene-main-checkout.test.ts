import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mainCheckoutFinding } from "../../scripts/lib/main-checkout.mjs";

const HOUR = 3600 * 1000;
const T0 = Date.UTC(2026, 9, 20, 12); // the fixture's base commit time
const dirs: string[] = [];

function repo() {
  const dir = mkdtempSync(path.join(tmpdir(), "hygiene-main-"));
  dirs.push(dir);
  const git = (...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
  const commit = (atMs: number) => {
    const date = `@${atMs / 1000} +0000`;
    execFileSync("git", ["-C", dir, "commit", "-q", "--allow-empty", "-m", "c"], {
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
    });
    return git("rev-parse", "HEAD");
  };
  git("init", "-q", "-b", "main");
  const base = commit(T0);
  return { dir, git, commit, base, short: (sha: string) => sha.slice(0, 8) };
}

// Commits on origin/main past `base`, at the given times, leaving HEAD at `base`.
function behindBy(r: ReturnType<typeof repo>, ...times: number[]) {
  let tip = r.base;
  for (const t of times) tip = r.commit(t);
  r.git("update-ref", "refs/remotes/origin/main", tip);
  r.git("reset", "-q", "--hard", r.base);
  return tip;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("mainCheckoutFinding", () => {
  it("equal is clean", () => {
    const r = repo();
    r.git("update-ref", "refs/remotes/origin/main", r.base);
    expect(mainCheckoutFinding(r.dir, T0 + 100 * HOUR)).toBeNull();
  });

  it("behind by commits younger than 24 h is clean", () => {
    const r = repo();
    behindBy(r, T0 + 1 * HOUR, T0 + 2 * HOUR);
    expect(mainCheckoutFinding(r.dir, T0 + 20 * HOUR)).toBeNull();
  });

  it("behind by exactly 24 h is still clean; only more than 24 h is stale", () => {
    const r = repo();
    behindBy(r, T0 + 1 * HOUR);
    expect(mainCheckoutFinding(r.dir, T0 + 25 * HOUR)).toBeNull();
    expect(mainCheckoutFinding(r.dir, T0 + 25 * HOUR + 1000)).not.toBeNull();
  });

  it("behind by a commit older than 24 h is a finding", () => {
    const r = repo();
    const tip = behindBy(r, T0 + 1 * HOUR, T0 + 20 * HOUR);
    expect(mainCheckoutFinding(r.dir, T0 + 27 * HOUR)).toBe(
      `main checkout ${r.short(r.base)} is 26 h behind origin/main ${r.short(tip)}`,
    );
  });

  it("diverged is a finding", () => {
    const r = repo();
    const tip = behindBy(r, T0 + 1 * HOUR);
    const local = r.commit(T0 + 2 * HOUR);
    expect(mainCheckoutFinding(r.dir, T0 + 3 * HOUR)).toBe(
      `main checkout ${r.short(local)} has diverged from origin/main ${r.short(tip)}`,
    );
  });

  it("ahead with a local commit is a finding", () => {
    const r = repo();
    r.git("update-ref", "refs/remotes/origin/main", r.base);
    const local = r.commit(T0 + 1 * HOUR);
    expect(mainCheckoutFinding(r.dir, T0 + 2 * HOUR)).toBe(
      `main checkout ${r.short(local)} has diverged from origin/main ${r.short(r.base)}`,
    );
  });

  it("missing origin/main is a finding", () => {
    const r = repo();
    expect(mainCheckoutFinding(r.dir, T0)).toBe("main checkout cannot be compared with origin/main");
  });
});
