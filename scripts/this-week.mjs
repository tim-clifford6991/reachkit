#!/usr/bin/env node
// scripts/this-week.mjs — "ReachKit this week", the owner's one page.
//
//   node scripts/this-week.mjs                      # the 7 days to today (UTC)
//   node scripts/this-week.mjs --until 2026-10-20 --days 7
//   node scripts/this-week.mjs --github <file.json> --spend-log <file> --ref main --root <dir>
//
// Shipped is read from git (squash-merge subjects on --ref), Decided from
// docs/spec/decisions/ and the dated History lines of PROCESS and RUNBOOK,
// Found / Next / Health from GitHub, and Spend from the box's spend log.
// `--github` takes the GitHub answers from a file instead of `gh`. It reads
// only; it never writes to GitHub and never makes a paid call. A source that
// cannot be read is printed as not read, never as nothing.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { readSpend, spendLogPath } from "./spend-log.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const ALARMS = ["[hygiene]", "[nightly]", "[layout]", "[flaky]"];
const NEXT_COUNT = 5;

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
};

/** Merged pull requests, from the squash subjects `type(scope): what (#n)`. */
export function shipped(root, ref, since, until) {
  const out = run("git", ["log", ref, "--first-parent", `--since=${since}T00:00:00Z`, `--until=${until}T23:59:59Z`, "--format=%s"], root);
  if (out === null) return null;
  return out
    .split("\n")
    .filter(Boolean)
    .map((subject) => {
      const m = /^\w+(?:\(([^)]+)\))?!?:\s*(.+?)\s*\(#(\d+)\)$/.exec(subject);
      return m ? { area: m[1] ?? null, what: m[2], pr: Number(m[3]) } : { area: null, what: subject, pr: null };
    });
}

/** Decision files dated in the window, and dated History lines in PROCESS and RUNBOOK. */
export function decided(root, since, until) {
  const inWindow = (day) => day >= since && day <= until;
  const rows = [];
  const dir = path.join(root, "docs/spec/decisions");
  for (const name of existsSync(dir) ? readdirSync(dir).sort() : []) {
    const m = /^(\d{4}-\d{2}-\d{2})-(\d+)(?:-[\w-]+)?\.md$/.exec(name);
    if (!m || !inWindow(m[1])) continue;
    const text = readFileSync(path.join(dir, name), "utf8");
    const section = /^section:\s*(\S+)/m.exec(text)?.[1] ?? null;
    const body = text.replace(/^---[\s\S]*?---\s*/, "");
    const ruling = /\*\*(.+?)\*\*/.exec(body)?.[1] ?? body.split("\n").find((l) => l.trim())?.trim() ?? name;
    rows.push({ day: m[1], where: section ? `SPEC ${section}` : "SPEC", what: ruling, issue: Number(m[2]) });
  }
  for (const [doc, where] of [["docs/PROCESS.md", "PROCESS"], ["docs/RUNBOOK.md", "RUNBOOK"]]) {
    const file = path.join(root, doc);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = /^(\d{4}-\d{2}-\d{2})\s{2}\*\*(.+?)\*\*(?:\s*\(([^)]*)\))?/.exec(line);
      if (m && inWindow(m[1])) rows.push({ day: m[1], where, what: m[2], issue: Number(/#(\d+)/.exec(m[3] ?? "")?.[1]) || null });
    }
  }
  return rows.sort((a, b) => a.day.localeCompare(b.day));
}

/** The GitHub answers the page needs. Each is a list, or null when `gh` failed. */
export function readGithub(since) {
  const list = (args) => {
    const out = run("gh", ["issue", "list", ...args, "--limit", "500"]);
    try {
      return out === null ? null : JSON.parse(out);
    } catch {
      return null;
    }
  };
  return {
    found: list(["--label", "from-weekly", "--state", "all", "--search", `created:>=${since}`, "--json", "number,title,state"]),
    launch: list(["--milestone", "Launch", "--state", "open", "--json", "number,title,labels"]),
    blocked: list(["--label", "blocked-on-owner", "--state", "open", "--json", "number,title"]),
    open: list(["--state", "open", "--json", "number,title"]),
  };
}

/** Box test spend in the window. null when there is no log to read. */
export function spend(file, since, until) {
  if (!existsSync(file)) return null;
  const rows = readSpend(file).filter((r) => r.at.slice(0, 10) >= since && r.at.slice(0, 10) <= until);
  const byIssue = new Map();
  for (const r of rows) byIssue.set(r.issue, (byIssue.get(r.issue) ?? 0) + r.cents);
  return {
    cents: rows.reduce((s, r) => s + r.cents, 0),
    billed: rows.some((r) => r.billed !== null) ? rows.reduce((s, r) => s + (r.billed ?? 0), 0) : null,
    byIssue: [...byIssue].sort((a, b) => b[1] - a[1]),
  };
}

const notRead = (what) => `- Not read: ${what}.`;
const cents = (n) => `${Math.round(n * 100) / 100}¢`;
const issue = (i) => `${i.title} (#${i.number})`;

export function render({ since, until, shipped, decided, github, spend, spendFile }) {
  const lines = [`# ReachKit this week`, ``, `${since} to ${until} (UTC)`, ``, `## Shipped`, ``];
  if (shipped === null) lines.push(notRead("git log failed"));
  else if (shipped.length === 0) lines.push("- No pull request merged.");
  else {
    const byArea = Map.groupBy(shipped, (s) => s.area ?? "other");
    for (const [area, rows] of [...byArea].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
      lines.push(`- **${area}** (${rows.length})`);
      for (const s of rows) lines.push(`  - ${s.what}${s.pr ? ` (#${s.pr})` : ""}`);
    }
  }

  lines.push(``, `## Decided`, ``);
  if (decided.length === 0) lines.push("- No dated ruling.");
  else for (const d of decided) lines.push(`- ${d.day} ${d.where}: ${d.what}${d.issue ? ` (#${d.issue})` : ""}`);

  lines.push(``, `## Found`, ``);
  if (github.found == null) lines.push(notRead("GitHub issues labelled from-weekly"));
  else if (github.found.length === 0) lines.push("- The weekly review filed no issue.");
  else for (const i of github.found) lines.push(`- ${issue(i)}${i.state === "CLOSED" ? ", closed" : ""}`);

  lines.push(``, `## Next`, ``);
  const blockedNumbers = new Set((github.blocked ?? []).map((i) => i.number));
  if (github.launch == null) lines.push(notRead("the Launch milestone"));
  else {
    const ready = github.launch.filter((i) => !blockedNumbers.has(i.number) && !(i.labels ?? []).some((l) => l.name === "blocked-on-owner"));
    const top = ready.sort((a, b) => a.number - b.number).slice(0, NEXT_COUNT);
    if (top.length === 0) lines.push("- No open Launch issue that can be worked.");
    else for (const i of top) lines.push(`- ${issue(i)}`);
    if (ready.length > top.length) lines.push(`- and ${ready.length - top.length} more in Launch.`);
  }
  if (github.blocked == null) lines.push(notRead("issues labelled blocked-on-owner"));
  else if (github.blocked.length === 0) lines.push("- Nothing is waiting on the owner.");
  else for (const i of github.blocked) lines.push(`- Waiting on the owner: ${issue(i)}`);

  lines.push(``, `## Health`, ``);
  if (github.open == null) lines.push(notRead("open alarm issues"));
  else {
    const alarms = github.open.filter((i) => ALARMS.some((a) => i.title.startsWith(a)));
    if (alarms.length === 0) lines.push(`- No open ${ALARMS.join(", ")} issue.`);
    else for (const i of alarms) lines.push(`- Red: ${issue(i)}`);
  }

  lines.push(``, `## Spend`, ``);
  if (spend === null) lines.push(notRead(`box test spend, no log at ${spendFile}`));
  else {
    lines.push(`- Box test spend: ${cents(spend.cents)} recorded${spend.billed === null ? ", billed not reported" : `, ${cents(spend.billed)} billed`}.`);
    for (const [who, c] of spend.byIssue) lines.push(`  - ${/^\d+$/.test(who) ? `#${who}` : who}: ${cents(c)}`);
  }
  lines.push("- Production vendor spend is not read here: `npm run costs` reads it.");
  return `${lines.join("\n")}\n`;
}

function main(argv) {
  const flag = (name, fallback) => {
    const at = argv.indexOf(name);
    return at === -1 || at + 1 >= argv.length ? fallback : argv[at + 1];
  };
  const root = path.resolve(flag("--root", path.join(path.dirname(new URL(import.meta.url).pathname), "..")));
  const until = flag("--until", new Date().toISOString().slice(0, 10));
  const days = Number(flag("--days", "7"));
  const since = new Date(Date.parse(`${until}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  const githubFile = flag("--github", null);
  const spendFile = flag("--spend-log", spendLogPath());
  process.stdout.write(
    render({
      since,
      until,
      shipped: shipped(root, flag("--ref", "origin/main"), since, until),
      decided: decided(root, since, until),
      github: githubFile ? JSON.parse(readFileSync(githubFile, "utf8")) : readGithub(since),
      spend: spend(spendFile, since, until),
      spendFile,
    })
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main(process.argv.slice(2));
