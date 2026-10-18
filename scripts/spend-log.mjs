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
// cent the vendors bill in — and it is the price book's estimate.
//
// `billed` (issue 1408) is what the vendor says it charged for that call, in
// the same cents, where its response carried a charge:
//
//   {"at":"…","issue":"1408","script":"pass","source":"serp/google/organic","cents":0.2,"billed":0.12}
//
// It is absent where the response carried none: a model call, and every line
// from before 2026-10-11. `scripts/costs/report.ts` reads this log for
// `npm run costs`.
//
// `domain` (issue 1478) is the site the call was made for, where the script
// knows it, so box spend can be told apart by site like production's:
//
//   {"at":"…","issue":"1478","script":"panel","source":"serp/google/organic","cents":0.2,"billed":0.2,"domain":"austinplumbery.com"}
//
// Plain JavaScript, because the `.mjs` scripts run on this box's Node, which
// has no type stripping, and the Vite-loaded TypeScript imports it too.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DEFAULT_LOG = "/root/ops/reachkit/spend.jsonl";

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
 * One paid call. A call that settled at nothing and was billed nothing is
 * not spend and writes no line. Never throws: a log that cannot be written
 * is said on stderr and the run goes on, since the money is already spent.
 *
 * `billed` is the vendor's own charge in cents, or absent where its response
 * carried none. It is never filled in from `cents`.
 *
 * Off the box (no `/root/ops/reachkit`) and under a test runner nothing is
 * written unless `RK_SPEND_LOG` names a file.
 *
 * @param {{ script: string, source: string, cents: number, billed?: number | undefined, domain?: string | undefined, at?: Date }} call
 */
export function appendSpend({ script, source, cents, billed, domain, at = new Date() }) {
  const charged = typeof billed === "number" && Number.isFinite(billed) ? billed : undefined;
  if (!(cents > 0) && !(charged > 0)) return;
  const file = spendLogPath();
  if (process.env.RK_SPEND_LOG === undefined && (process.env.VITEST !== undefined || !existsSync(path.dirname(file)))) return;
  const round = (n) => Math.round(n * 10000) / 10000;
  try {
    appendFileSync(
      file,
      `${JSON.stringify({ at: at.toISOString(), issue: issueOrBranch(), script, source, cents: round(cents > 0 ? cents : 0), ...(charged === undefined ? {} : { billed: round(charged) }), ...(typeof domain === "string" && domain !== "" ? { domain } : {}) })}\n`
    );
  } catch (error) {
    console.error(`spend log: could not append to ${file} (${String(error?.message ?? error)}); ${cents}¢ by ${script} is unrecorded.`);
  }
}

/** The log's rows. A line that is not a spend row is skipped, never fatal.
 *  `billed` and `domain` are `null` on a line that carries none. */
export function readSpend(file = spendLogPath()) {
  if (!existsSync(file)) return [];
  const rows = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    try {
      const row = JSON.parse(line);
      if (typeof row?.at === "string" && !Number.isNaN(Date.parse(row.at)) && typeof row.cents === "number" && Number.isFinite(row.cents)) {
        rows.push({
          at: row.at,
          issue: String(row.issue ?? "unknown"),
          script: String(row.script ?? "unknown"),
          source: String(row.source ?? "unknown"),
          cents: row.cents,
          billed: typeof row.billed === "number" && Number.isFinite(row.billed) ? row.billed : null,
          domain: typeof row.domain === "string" ? row.domain : null,
        });
      }
    } catch {
      // A torn line is one call's record lost, not the report's.
    }
  }
  return rows;
}
