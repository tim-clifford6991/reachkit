import { spawnSync } from "node:child_process";

const DAY_MS = 24 * 3600 * 1000;

function git(dir, args) {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  return { status: r.status, out: (r.stdout || "").trim() };
}

// The orchestrator fast-forwards the main checkout by hand, so a lag under a day is the normal state, not drift.
export function mainCheckoutFinding(dir, nowMs) {
  const head = git(dir, ["rev-parse", "HEAD"]);
  const origin = git(dir, ["rev-parse", "origin/main"]);
  const ancestor = git(dir, ["merge-base", "--is-ancestor", "HEAD", "origin/main"]);
  if (head.status !== 0 || origin.status !== 0 || ![0, 1].includes(ancestor.status)) {
    return "main checkout cannot be compared with origin/main";
  }
  const [h, o] = [head.out.slice(0, 8), origin.out.slice(0, 8)];
  if (ancestor.status === 1) return `main checkout ${h} has diverged from origin/main ${o}`;
  const log = git(dir, ["log", "--format=%ct", "HEAD..origin/main"]);
  if (log.status !== 0) return "main checkout cannot be compared with origin/main";
  if (!log.out) return null;
  const lagMs = nowMs - Math.min(...log.out.split("\n").map((s) => Number(s) * 1000));
  if (lagMs <= DAY_MS) return null;
  return `main checkout ${h} is ${Math.floor(lagMs / 3600000)} h behind origin/main ${o}`;
}
