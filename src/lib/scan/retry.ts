// src/lib/scan/retry.ts — SPEC §2, issue 715 — "Retry this part"
//
// SPEC §2's cut-off rule ends "…measured cards still render with 'Retry
// this part'", and the owner's ruling of 2026-09-22 says what the control
// does: it "re-runs only that part inside the same budget", with everything
// still inside 12¢ and 50 s.
//
// **What "only that part" means here, exactly.** A retry is a pass over the
// same domain that starts from the report it is retrying rather than from
// nothing:
//
//   1. the market — the profile, the suggestions, the twelve selected
//      searches and their wording — is **read back off the stored report**,
//      never bought again. It is the one part of a free pass the ledger
//      cannot return for free: `llm()` caches at `freshnessDays: 0`, so
//      re-deriving a market costs the two nano calls again (≈2.6¢) every
//      time. A retry that re-derived it would also be a retry that could
//      come back with *different* twelve questions, which is not a retry of
//      a part but a different report at the same address;
//   2. every other measurement the report already holds — the site's own
//      documents, the access rules, the crawl, `ranked_keywords`, and every
//      question SERP that was actually bought — is re-read through
//      `recordFetch`, which serves it from `fetches` inside §6.4's window
//      **at zero cents and without touching the cap**;
//   3. so the only thing the pass pays for is the part the ceiling cut off.
//
// **"Inside the same budget" is not a figure of speech.** The retry's row
// opens with `priorCents` set to what the retried row already spent, so the
// 12¢ free cap covers the original pass and every retry of it together —
// the same arrangement a market correction has (§6.7 step 5: "same spend
// ceiling, no second allowance consumed"). A report whose pass already
// spent the cap is offered no retry at all, because there is nothing left
// to buy the part with and a control that cannot act is a control that must
// not be drawn (SPEC §1, 2026-09-20).
//
// **The time ceiling is the pass's, not the pair's.** Each pass is bounded
// by `TIMING.reportCeilingS`; a retry is a new request and gets its own,
// exactly as a correction does. What §2 fixes at 50 s is a scan, and the
// retry is a scan — a short one, since it buys one part.
//
// This module holds the decision and the two things it needs from storage.
// The re-measurement itself is `runScan`, reached through the seam below
// for the same reason `correction.ts` declares one: a second pipeline here
// would be a second answer to "what is a free scan".
import { dbAdmin } from "@/lib/db";
import { CAPS } from "@/lib/config/constants";
import { isDomainRemoved } from "./admission";
import type { CanonicalDomain } from "./domain";
import { readStoredReport, type StoredReport } from "./report";
import type { StageName } from "./stages";

/** The three parts of a free report a ceiling can leave absent, and which
 *  a card of its own draws. One handle per card that renders
 *  `control.retry-part`; a fourth would need a card, a stage and a written
 *  line, which is why this is a closed union rather than a string. */
export type RetryPart = "ai_answers" | "presence" | "free_page";

export const RETRY_PARTS: readonly RetryPart[] = Object.freeze([
  "ai_answers",
  "presence",
  "free_page",
]);

export function isRetryPart(value: unknown): value is RetryPart {
  return typeof value === "string" && (RETRY_PARTS as readonly string[]).includes(value);
}

/**
 * The stage that produces each part — the one stage a retry of it is
 * allowed to spend in.
 *
 * `ai_answers` and `presence` name the same stage, and that is the
 * measurement rather than a shortcut: both cards are counted over the twelve
 * question SERPs (`buildAiAnswersCard`, `buildPresenceCard`), so the part
 * either card is missing is the same purchase. `free_page` names `scoring`,
 * which buys nothing on the free path at all: the first-page proposal is
 * derived from what the pass already measured, so its retry costs nothing
 * and is worth offering for exactly that reason.
 */
export const RETRY_STAGE: Readonly<Record<RetryPart, StageName>> = Object.freeze({
  ai_answers: "asking_the_twelve",
  presence: "asking_the_twelve",
  free_page: "scoring",
});

/** Whether a stored report is missing the part — the question the card on
 *  the screen has already answered by drawing its absent arm, asked again
 *  on the server so a hand-made request cannot start a pass for a part that
 *  is already there. */
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

/** The facts a retry is decided from — the domain's one current report, as
 *  the row holds it. */
export interface RetryFacts {
  scanId: string;
  report: StoredReport;
  /** What that row has already spent, which the retry's own cap counts. */
  spentCents: number;
  domainRemoved: boolean;
}

/** Why a retry was not offered or was turned down. Handles, never
 *  sentences: the surface renders each one through the copy registry. */
export type RetryRefusal =
  | "no_current_report"
  | "not_cut_off"
  | "part_present"
  | "no_budget_left"
  | "domain_removed"
  | "scanning_unavailable";

/** SPEC §2: a part is cut off when the pass stopped at one of its two
 *  ceilings — the same test the report screen makes to decide whether to
 *  draw the control at all (`cutByCeiling`), made again here because a
 *  request is not a screen. */
function cutByCeiling(report: StoredReport): boolean {
  return report.stoppedReason === "time_ceiling" || report.stoppedReason === "spend_ceiling";
}

/** What the free cap still holds for this report, in cents — never below
 *  zero, and read from the row rather than from the report, because the
 *  row's `cost_cents` is what the next pass's `priorCents` will be. */
export function budgetLeftCents(spentCents: number): number {
  return Math.max(0, CAPS.FREE_C - spentCents);
}

/**
 * Whether this part may be re-run, and why not where it may not.
 *
 * Pure, and deliberately so: every input is a fact read once by the caller,
 * so the route's refusal and the screen's offer are the same decision made
 * from the same values.
 */
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

/** `runScan`, as this seam needs to call it: the same pipeline, told which
 *  report to start from and which part it is buying. Nothing else is ever
 *  passed through — no ceiling override, no deadline, no allowance flag. */
export type RetryRunner = (a: {
  domain: string;
  tier: "free";
  retryOf: string;
  part: RetryPart;
}) => Promise<RetryRun>;

/** A started re-measurement. `scanId` is the row the pass writes to,
 *  already claimed when this resolves, so the report can follow its stages
 *  at `/api/scan/{scanId}/progress`; `finished` settles when the pass does
 *  and is what the route hands to `after()`. */
export interface RetryRun {
  scanId: string;
  finished: Promise<{ scanId: string; status: "done" | "degraded" | "failed" }>;
}

let runner: RetryRunner | null = null;

/** Registered once, by the scan pipeline, at its own module load. */
export function registerRetryRunner(fn: RetryRunner | null): void {
  runner = fn;
}

/** `null` while no pipeline has registered — the caller must then refuse
 *  before the run rather than claim a row nothing can finish. */
export function retryRunner(): RetryRunner | null {
  return runner;
}

// ── The one read ────────────────────────────────────────────────────────
//
// `scans.is_current` is on disk in
// `supabase/migrations/20260904110000_scans_current.sql` and is not in the
// generated `Database` type, which has not been regenerated since. The same
// narrow, explicitly cast builder `correction.ts` and `admission.ts` already
// use is used here, against a locally declared row shape.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
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

/** A read that cannot be answered is not evidence of a removal — the same
 *  fail-open `correction.ts` makes, and for the same reason: the report
 *  address decides what a removed domain is served, and this read only
 *  keeps a retry from being started on one. */
async function removedOrUnanswerable(domain: CanonicalDomain): Promise<boolean> {
  try {
    return await isDomainRemoved(domain);
  } catch {
    return false;
  }
}

/**
 * What one scan row has already spent, in cents.
 *
 * `CAPS.FREE_C` where the row cannot be read or carries no total — the
 * fail-closed reading SPEC §2 fixes (#792, "nothing is spent on a count
 * nobody has"): a retry opened on money nobody can count would be a retry
 * that could walk past the cap, so it opens with the cap already spent and
 * buys nothing.
 */
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

/**
 * The domain's one current report and what its row has spent, or `null`
 * where there is no current report to retry a part of.
 *
 * A stored blob this build cannot lift throws, exactly as it does at every
 * other reader (SPEC §2, 2026-09-18 — roll forward only): a retry decided
 * against a report nobody could read would be a pass started against a
 * measurement nobody has.
 */
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

  // An unreadable total is not a zero (SPEC §2's fail-closed rule, #792):
  // a retry opened on money nobody can count is a retry that could walk
  // past the cap, so it reads as the whole cap spent and the offer closes.
  const spent = Number(row.cost_cents);
  return {
    scanId: row.id,
    report: readStoredReport(row.report),
    spentCents: Number.isFinite(spent) ? spent : CAPS.FREE_C,
    domainRemoved: await removedOrUnanswerable(domain),
  };
}
