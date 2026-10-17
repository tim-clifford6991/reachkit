#!/usr/bin/env node
// scripts/box.mjs — the ReachKit box, checked by hand.
//
// Default: print findings and exit 1 when any remain. It does not edit.
// --clean removes only leftovers that are not a git worktree and not the
// main checkout: an empty directory on the list, a loadgen folder whose
// only content is a Next cache, and a closed-sessions spreadsheet.
// A dirty worktree, a worktree with no pull request, and a worktree behind
// its remote are reported and left in place.
//
// This is not a merge gate. GitHub's runners do not have this box. Run it
// on the box when the folders look crowded: `node scripts/box.mjs`.
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";

const MAIN = "/root/projects/reachkitv3";
const WT = "/root/projects/reachkitv3-wt";
const REPO = "tim-clifford6991/reachkit";
const EMPTY_DIRS = ["/root/projects/reachkitv3-gates", "/root/projects/wt"];

const clean = process.argv.includes("--clean");
const findings = [];
const removed = [];

function add(detail) {
  findings.push(detail);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    out: (result.stdout || "").trim(),
    err: (result.stderr || "").trim(),
  };
}

function worktrees() {
  const listed = run("git", ["-C", MAIN, "worktree", "list", "--porcelain"]);
  if (!listed.ok) return null;
  const rows = [];
  let current = null;
  for (const line of listed.out.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) rows.push(current);
      current = { path: line.slice("worktree ".length), branch: "", head: "" };
    } else if (current && line.startsWith("HEAD ")) current.head = line.slice(5);
    else if (current && line.startsWith("branch ")) current.branch = line.slice("branch refs/heads/".length);
  }
  if (current) rows.push(current);
  return rows;
}

function dirty(dir) {
  const status = run("git", ["-C", dir, "status", "--porcelain"]);
  if (!status.ok) return `status failed (${status.err || "unknown"})`;
  if (!status.out) return "";
  const n = status.out.split("\n").length;
  return `${n} uncommitted path${n === 1 ? "" : "s"}`;
}

function tracking(dir) {
  const status = run("git", ["-C", dir, "status", "-sb"]);
  if (!status.ok) return "";
  const line = status.out.split("\n")[0] || "";
  const behind = line.match(/behind (\d+)/);
  const ahead = line.match(/ahead (\d+)/);
  const parts = [];
  if (ahead) parts.push(`ahead ${ahead[1]}`);
  if (behind) parts.push(`behind ${behind[1]}`);
  return parts.join(", ");
}

function openPr(branch) {
  const listed = run("gh", [
    "pr", "list",
    "--repo", REPO,
    "--head", branch,
    "--state", "open",
    "--json", "number",
    "--limit", "1",
  ]);
  if (!listed.ok) return { ok: false, number: null };
  try {
    const rows = JSON.parse(listed.out || "[]");
    return { ok: true, number: rows[0]?.number ?? null };
  } catch {
    return { ok: false, number: null };
  }
}

function emptyDir(dir) {
  if (!existsSync(dir)) return false;
  return readdirSync(dir).length === 0;
}

function onlyNextCache(dir) {
  if (!existsSync(dir)) return false;
  const names = readdirSync(dir);
  return names.length > 0 && names.every((name) => name === ".next");
}

function checkMain(rows) {
  if (!existsSync(MAIN)) {
    add(`main checkout missing at ${MAIN}`);
    return;
  }
  const branch = run("git", ["-C", MAIN, "rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch.ok || branch.out !== "main") add(`main checkout is on ${branch.out || "an unreadable branch"}`);
  const dirt = dirty(MAIN);
  if (dirt) add(`main checkout has ${dirt}`);
  const head = run("git", ["-C", MAIN, "rev-parse", "HEAD"]);
  const origin = run("git", ["-C", MAIN, "rev-parse", "origin/main"]);
  if (!head.ok || !origin.ok) add("main checkout cannot be compared with origin/main");
  else if (head.out !== origin.out) add(`main checkout ${head.out.slice(0, 8)} is not origin/main ${origin.out.slice(0, 8)}`);
  if (rows && !rows.some((row) => row.path === MAIN)) add("main checkout is not in the worktree list");
}

function checkWorktrees(rows) {
  if (!rows) {
    add("git worktree list failed");
    return;
  }
  for (const row of rows) {
    if (row.path === MAIN) continue;
    const name = path.basename(row.path);
    const dirt = dirty(row.path);
    const track = tracking(row.path);
    const pr = row.branch ? openPr(row.branch) : { ok: false, number: null };
    const bits = [`branch ${row.branch || "detached"}`];
    if (dirt) bits.push(dirt);
    if (track) bits.push(track);
    if (!pr.ok) bits.push("pull request list failed");
    else if (!pr.number) bits.push("no open pull request");
    else bits.push(`PR #${pr.number}`);
    if (dirt || track || !pr.number) add(`${name}: ${bits.join("; ")}`);
  }

  if (!existsSync(WT)) return;
  const known = new Set(rows.map((row) => row.path));
  for (const name of readdirSync(WT)) {
    const abs = path.join(WT, name);
    if (known.has(abs)) continue;
    const st = lstatSync(abs);
    if (st.isFile() && name.startsWith("closed-sessions-") && name.endsWith(".tsv")) {
      add(`leftover spreadsheet ${abs}`);
      if (clean) {
        unlinkSync(abs);
        removed.push(abs);
      }
      continue;
    }
    if (st.isDirectory() && name.startsWith("loadgen-") && onlyNextCache(abs)) {
      add(`leftover cache ${abs}`);
      if (clean) {
        rmSync(abs, { recursive: true });
        removed.push(abs);
      }
      continue;
    }
    add(`unlisted path ${abs}`);
  }
}

function checkEmpty() {
  for (const dir of EMPTY_DIRS) {
    if (!existsSync(dir)) continue;
    if (!emptyDir(dir)) {
      add(`${dir} is not an empty leftover`);
      continue;
    }
    add(`empty directory ${dir}`);
    if (clean) {
      rmSync(dir, { recursive: true });
      removed.push(dir);
    }
  }
}

if (!existsSync(MAIN)) {
  console.log("box: not the ReachKit box, nothing to check");
  process.exit(0);
}

const rows = worktrees();
checkMain(rows);
checkWorktrees(rows);
checkEmpty();

const left = findings.filter((line) => !removed.some((pathRemoved) => line.includes(pathRemoved)));
if (removed.length) {
  console.log(`box: removed ${removed.length}`);
  for (const line of removed) console.log(`- removed ${line}`);
}
if (left.length === 0) {
  console.log("box: clean");
  process.exit(0);
}
console.log(`box: ${left.length} finding${left.length === 1 ? "" : "s"} left in place`);
for (const line of left) console.log(`- ${line}`);
process.exit(1);
