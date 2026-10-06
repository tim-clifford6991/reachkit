// scripts/spend-log.mjs — the one spend log for testing (SPEC §6, owner, D57,
// 2026-10-06, issue 1286).
//
// Production spend is in the `fetches` ledger, call by call. Test spend made
// from this box was reported only in pull-request text. Every script here
// that makes a paid call appends one JSON line per call to
// `/root/ops/reachkit/spend.jsonl`:
//
//   {"at":"2026-10-06T09:14:02.118Z","issue":"1286","script":"page","source":"llm:writer","cents":4.21}
//
// `issue` is read from the git branch: an `issue-<N>` worktree writes `<N>`,
// any other branch writes its own name. `cents` is the ledger's cent — the US
// cent the vendors bill in, which `scripts/page/ledger.ts` holds a euro
// ceiling against one for one.
//
// Plain JavaScript, because the `.mjs` scripts run on this box's Node, which
// has no type stripping, and the Vite-loaded TypeScript imports it too.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_LOG = "/root/ops/reachkit/spend.jsonl";

/** D34: €2 a day across all live testing, and where `npm run costs` warns. */
export const DAY_CAP_CENTS = 200;
export const DAY_WARN_CENTS = 150;

export function spendLogPath() {
  return process.env.RK_SPEND_LOG ?? DEFAULT_LOG;
}

let branch;
/** The issue number of an `issue-<N>` branch, else the branch's own name. */
export function issueOrBranch() {
  if (branch === undefined) {
    try {
      branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "unknown";
    } catch {
      branch = "unknown";
    }
  }
  return /^issue-(\d+)$/.exec(branch)?.[1] ?? branch;
}

/**
 * One paid call. A call that settled at nothing is not spend and writes no
 * line. Never throws: a log that cannot be written is said on stderr and the
 * run goes on, since the money is already spent.
 *
 * Off the box (no `/root/ops/reachkit`) and under a test runner nothing is
 * written unless `RK_SPEND_LOG` names a file.
 */
export function appendSpend({ script, source, cents, at = new Date() }) {
  if (!(cents > 0)) return;
  const file = spendLogPath();
  if (process.env.RK_SPEND_LOG === undefined && (process.env.VITEST !== undefined || !existsSync(path.dirname(file)))) return;
  try {
    appendFileSync(file, `${JSON.stringify({ at: at.toISOString(), issue: issueOrBranch(), script, source, cents: Math.round(cents * 10000) / 10000 })}\n`);
  } catch (error) {
    console.error(`spend log: could not append to ${file} (${String(error?.message ?? error)}); ${cents}¢ by ${script} is unrecorded.`);
  }
}

/** The log's rows. A line that is not a spend row is skipped, never fatal. */
export function readSpend(file = spendLogPath()) {
  if (!existsSync(file)) return [];
  const rows = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    try {
      const row = JSON.parse(line);
      if (typeof row?.at === "string" && !Number.isNaN(Date.parse(row.at)) && typeof row.cents === "number" && Number.isFinite(row.cents)) {
        rows.push({ at: row.at, issue: String(row.issue ?? "unknown"), script: String(row.script ?? "unknown"), source: String(row.source ?? "unknown"), cents: row.cents });
      }
    } catch {
      // A torn line is one call's record lost, not the report's.
    }
  }
  return rows;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function byIssue(rows) {
  const sums = new Map();
  for (const row of rows) sums.set(row.issue, (sums.get(row.issue) ?? 0) + row.cents);
  return [...sums].map(([issue, cents]) => ({ issue, cents })).sort((a, b) => b.cents - a.cents || a.issue.localeCompare(b.issue));
}

/**
 * Today's and the last seven days' test spend, by issue. A day is a UTC day,
 * as the product's own daily ceiling is; the seven days are today and the six
 * before it.
 */
export function summarize(rows, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const firstDay = new Date(Date.parse(`${today}T00:00:00.000Z`) - 6 * DAY_MS).toISOString().slice(0, 10);
  const days = new Map();
  for (let i = 0; i < 7; i += 1) days.set(new Date(Date.parse(`${firstDay}T00:00:00.000Z`) + i * DAY_MS).toISOString().slice(0, 10), 0);
  const week = rows.filter((row) => days.has(new Date(row.at).toISOString().slice(0, 10)));
  for (const row of week) {
    const day = new Date(row.at).toISOString().slice(0, 10);
    days.set(day, days.get(day) + row.cents);
  }
  const todayRows = week.filter((row) => new Date(row.at).toISOString().slice(0, 10) === today);
  const todayCents = days.get(today);
  return {
    today: { day: today, cents: todayCents, byIssue: byIssue(todayRows), state: todayCents >= DAY_CAP_CENTS ? "over" : todayCents >= DAY_WARN_CENTS ? "warn" : "ok" },
    week: { from: firstDay, to: today, cents: week.reduce((sum, row) => sum + row.cents, 0), byIssue: byIssue(week), days: [...days].map(([day, cents]) => ({ day, cents })) },
  };
}

const money = (cents) => `${cents.toFixed(2)}¢`;

/** What `npm run costs` prints. */
export function report(summary) {
  const lines = [`Test spend today (${summary.today.day} UTC): ${money(summary.today.cents)} of the ${DAY_CAP_CENTS}¢ a day D34 allows`];
  for (const row of summary.today.byIssue) lines.push(`  ${row.issue.padEnd(14)} ${money(row.cents)}`);
  if (summary.today.state === "over") lines.push(`OVER: today's test spend has reached €2. Stop and ask the owner before another live call (D34).`);
  if (summary.today.state === "warn") lines.push(`WARNING: today's test spend is past €1.50 of the €2 a day D34 allows.`);
  lines.push("", `Last 7 days (${summary.week.from} to ${summary.week.to}): ${money(summary.week.cents)}`);
  for (const row of summary.week.byIssue) lines.push(`  ${row.issue.padEnd(14)} ${money(row.cents)}`);
  lines.push("", "By day:");
  for (const row of summary.week.days) lines.push(`  ${row.day}     ${money(row.cents)}${row.cents >= DAY_CAP_CENTS ? "  over €2" : ""}`);
  return lines.join("\n");
}
