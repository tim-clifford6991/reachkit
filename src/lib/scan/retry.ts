// "Retry this part": re-runs only the part a ceiling cut off, inside the same budget. A retry starts from the report it retries:
// 1. the market (profile, suggestions, twelve searches, wording) is read back off the stored report, never bought: `llm()` caches at
// `freshnessDays: 0`, and re-deriving could change the twelve, which is a different report, not a retried part;
// 2. every other measurement is re-read through `recordFetch` from `fetches` inside §6.4's window, at zero cents;
// 3. so only the cut-off part is paid for.
// The retry's row opens with `priorCents` = what the retried row spent, so the 12¢ free cap covers the pass and all its retries together,
// as a correction's does. A report whose pass spent the cap is offered no retry: a control that cannot act is not drawn.
// Each pass, a retry included, gets its own `TIMING.reportCeilingS`. The re-measurement is `runScan`, through the seam below, so there is one pipeline.
import { dbAdmin } from "@/lib/db";
import { CAPS } from "@/lib/config/constants";
import { isDomainRemoved } from "./admission";
import type { CanonicalDomain } from "./domain";
import { readStoredReport, type StoredReport } from "./report";
import type { StageName } from "./stages";

/** The three parts of a free report a ceiling can leave absent, one per card drawing `control.retry-part`; closed, since a fourth needs a card, a stage and copy. */
export type RetryPart = "ai_answers" | "presence" | "free_page";

export const RETRY_PARTS: readonly RetryPart[] = Object.freeze([
  "ai_answers",
  "presence",
  "free_page",
]);

export function isRetryPart(value: unknown): value is RetryPart {
  return typeof value === "string" && (RETRY_PARTS as readonly string[]).includes(value);
}

/** The one stage a retry of each part may spend in. `ai_answers` and `presence` share it: both cards count the twelve SERPs.
 *  `free_page` names `scoring`, which buys nothing on the free path, so its retry is free. */
export const RETRY_STAGE: Readonly<Record<RetryPart, StageName>> = Object.freeze({
  ai_answers: "asking_the_twelve",
  presence: "asking_the_twelve",
  free_page: "scoring",
});

/** Whether a stored report is missing the part, asked again on the server so a hand-made request cannot start a pass for a part already there. */
export function partIsAbsent(report: StoredReport, part: RetryPart): boolean {
  switch (part) {
    case "ai_answers":
      return report.aiAnswers === null;
    case "presence":
      return report.presence === null;
    case "free_page":
      return report.freePage === null;
    default: {
      const exhaustive: never = part;
      return exhaustive;
    }
  }
}

/** The facts a retry is decided from: the domain's one current report, as the row holds it. */
export interface RetryFacts {
  scanId: string;
  report: StoredReport;
  /** What that row has already spent, which the retry's own cap counts. */
  spentCents: number;
  domainRemoved: boolean;
}

/** Why a retry was not offered or was refused: handles, rendered through the copy registry. */
export type RetryRefusal =
  | "no_current_report"
  | "not_cut_off"
  | "part_present"
  | "no_budget_left"
  | "domain_removed"
  | "scanning_unavailable";

/** A part is cut off when the pass stopped at one of its two ceilings, the same test the screen makes (`cutByCeiling`), made again for the request. */
function cutByCeiling(report: StoredReport): boolean {
  return report.stoppedReason === "time_ceiling" || report.stoppedReason === "spend_ceiling";
}

/** What the free cap still holds, never below zero, read from the row, whose `cost_cents` is the next pass's `priorCents`. */
export function budgetLeftCents(spentCents: number): number {
  return Math.max(0, CAPS.FREE_C - spentCents);
}

/** Whether this part may be re-run, and why not. Pure, so the route's refusal and the screen's offer are one decision from the same values. */
export function retryOffer(a: {
  facts: RetryFacts | null;
  part: RetryPart;
}): { offered: true } | { offered: false; because: RetryRefusal } {
  const facts = a.facts;
  if (facts === null) return { offered: false, because: "no_current_report" };
  if (facts.domainRemoved) return { offered: false, because: "domain_removed" };
  if (!cutByCeiling(facts.report)) return { offered: false, because: "not_cut_off" };
  if (!partIsAbsent(facts.report, a.part)) return { offered: false, because: "part_present" };
  // A part that buys nothing is offered whatever the row has spent: the
  // first page is derived from measurements already paid for, so refusing it
  // for want of money would be refusing to do free work.
  if (RETRY_STAGE[a.part] !== "scoring" && budgetLeftCents(facts.spentCents) <= 0) {
    return { offered: false, because: "no_budget_left" };
  }
  return { offered: true };
}

// ── The seam over the pipeline ──────────────────────────────────────────

/** `runScan` as this seam calls it: told which report to start from and which part it buys. No ceiling override, deadline or allowance flag. */
export type RetryRunner = (a: {
  domain: string;
  tier: "free";
  retryOf: string;
  part: RetryPart;
}) => Promise<RetryRun>;

/** A started re-measurement: `scanId` is already claimed, so the report can follow its stages at `/api/scan/{scanId}/progress`; `finished` goes to `after()`. */
export interface RetryRun {
  scanId: string;
  finished: Promise<{ scanId: string; status: "done" | "degraded" | "failed" }>;
}

let runner: RetryRunner | null = null;

/** Registered once, by the scan pipeline, at its own module load. */
export function registerRetryRunner(fn: RetryRunner | null): void {
  runner = fn;
}

/** `null` while no pipeline has registered: the caller must refuse before the run rather than claim a row nothing can finish. */
export function retryRunner(): RetryRunner | null {
  return runner;
}

// ── The one read ─────────────────────────────────────────────────────────
// `scans.is_current` is not in the generated `Database` type, so this read uses a narrow cast against a local row shape.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
  update(values: object): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

interface CurrentScanRow {
  id: string;
  cost_cents: number | string | null;
  report: unknown;
}

/** An unanswerable read is not evidence of a removal: it only keeps a retry off a removed report, so it fails open as `correction.ts` does. */
async function removedOrUnanswerable(domain: CanonicalDomain): Promise<boolean> {
  try {
    return await isDomainRemoved(domain);
  } catch {
    return false;
  }
}

/** What one scan row has spent. `CAPS.FREE_C` where unreadable or missing: a retry opened on uncountable money could walk past the cap, so it buys nothing. */
export async function readSpentCents(scanId: string): Promise<number> {
  const { data, error } = await untyped(dbAdmin())
    .from<CurrentScanRow>("scans")
    .select("id, cost_cents, report")
    .eq("id", scanId)
    .limit(1);
  if (error) throw new Error(error.message);
  const spent = Number(data?.[0]?.cost_cents);
  return Number.isFinite(spent) ? spent : CAPS.FREE_C;
}

/** The retried row's spend, carried on the retry's own row so the next retry reads the whole purse (`scans_cost_from_ledger` adds it).
 *  A database without the column has nowhere to carry it, and the pass's close writes the total. */
export async function carrySpentCents(scanId: string, cents: number): Promise<void> {
  if (!(cents > 0)) return;
  const { error } = await untyped(dbAdmin())
    .from<CurrentScanRow>("scans")
    .update({ carried_cents: cents })
    .eq("id", scanId);
  if (error !== null && !error.message.includes("carried_cents")) throw new Error(error.message);
}

/** The domain's current report and what its row spent, or `null`. A blob this build cannot lift throws, as at every reader. */
export async function readRetryFacts(domain: CanonicalDomain): Promise<RetryFacts | null> {
  const { data, error } = await untyped(dbAdmin())
    .from<CurrentScanRow>("scans")
    .select("id, cost_cents, report")
    .eq("domain", domain)
    .is("is_current", true)
    .limit(1);
  if (error) throw new Error(error.message);

  const row = data?.[0];
  if (!row || row.report === null || row.report === undefined) return null;

  // An unreadable total is not a zero: it reads as the whole cap spent and the offer closes.
  const spent = Number(row.cost_cents);
  return {
    scanId: row.id,
    report: readStoredReport(row.report),
    spentCents: Number.isFinite(spent) ? spent : CAPS.FREE_C,
    domainRemoved: await removedOrUnanswerable(domain),
  };
}
