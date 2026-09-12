// §2 — the free pass's per-stage time and spend budget, and the seam that
// enforces it (issue #539).
//
// **The defect this file exists to close.** `run.ts`'s `runStages` walked
// the six `StageName` handles strictly in sequence inside one overall bound
// (`ceilings.ts`'s `withFreeBounds`, `TIMING.reportCeilingS`), and no stage
// had a budget of its own. So whichever stage was slow — a model that took
// its whole 15 s, twelve live SERPs bought one after another — consumed the
// *whole* ceiling, and every stage after it read `not_attempted`. On
// production 2026-09-11, 0 of 17 free scans had ever reached
// `stopped_reason=complete`. One overall ceiling cannot stop that: by the
// time it fires the pass is already over.
//
// **A stage that spends its own budget ends, and the pass carries on.**
// That is the whole difference. The overall ceiling still ends the pass —
// it is ADR-021's promise and nothing here weakens it — but a stage now
// also has a bound it alone can exhaust, and exhausting it costs the pass
// that stage's own drivers and nothing else. The stages after it still run,
// still buy, and still measure.
//
// **The budget, and why it adds up.** Two columns per stage, both stated
// here and asserted at module load:
//
// | stage                   | seconds | cents | what the budget covers |
// |-------------------------|---------|-------|------------------------|
// | `reading_your_site`     |      10 |   2.0 | the home and pricing documents, the robots policy, and the one `ranked_keywords`@50 (`RANKED_FREE_COST_C` = 1.8¢) |
// | `reading_access_rules`  |       1 |   0   | reports a read stage one already made — it buys nothing and waits for nothing |
// | `reading_your_market`   |      12 |   4.7 | `keyword_suggestions` (1.8¢) and the free path's two nano calls — the profile and the phrasing (≈2.6¢ together at Haiku's row) |
// | `checking_your_presence`|       2 |   0   | the free tier's `sizesRivals` is `false`: per-rival `ranked_keywords` is on §6.4's never-pull list for this path |
// | `asking_the_twelve`     |      13 |   5.0 | twelve live SERPs, each reserving the async-AI-Overview surcharge (12 × `SERP_LIVE_C` × `ASYNC_AIO_SURCHARGE_MULTIPLIER` = 4.8¢) |
// | `scoring`               |       2 |   0   | both cards, the rivals and the coherence verdict, all counted over SERPs already paid for (§6.6's "zero extra cost") |
//
// The seconds sum to `TIMING.reportTargetS` — 40, the p95 the pass aims at,
// which is itself ten seconds under `TIMING.reportCeilingS`. Budgeting to
// the *target* rather than the ceiling is what leaves the overall ceiling
// something to be: a pass whose every stage spends its whole budget still
// finishes inside 40 s, and the ten seconds above that are the margin the
// ending and the stored report are written in. The cents sum to 11.7,
// under `CAPS.FREE_C`. `assertBudgetsFit` below is both sums, checked when
// this module loads, so a stage whose budget is widened past what the pass
// can afford fails at import rather than on a customer's scan.
//
// **The budget binds tighter than the vendor's own timeout, on purpose.**
// `INFERENCE_TIMEOUT_MS.nano` is 15 s and the free path makes two such
// calls (`FREE_PASS_INFERENCE_CALLS`), so `reading_your_market`'s worst
// case at the seam below it is 30 s — three quarters of the whole target.
// Its budget here is 12. The stage's bound is therefore this file's, not
// the model client's: a profile call that runs long is cut off with the
// market `not_attempted` and the twelve still get asked, which is the
// trade §2 asks for ("a cut-off factor shows '—' with one line per
// unmeasured driver") and the opposite of what shipped.
//
// **Time is preemptive here too.** `ceilings.ts` races the whole body
// against the overall deadline because the delay can be inside a call that
// never resolves; a stage's budget is raced the same way and for the same
// reason (`runInStageBudget` below). Money stays cooperative: it is read
// between calls through the stage's own `Bounds`, exactly as the overall
// cap is.
import { CAPS, TIMING } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { Bounds } from "./ceilings";
import type { StageName } from "./stages";

/** One stage's two columns. Seconds of wall clock and cents of spend — the
 *  same two ceilings the pass has, sized for one stage of it. */
export interface StageBudget {
  readonly seconds: number;
  readonly cents: number;
}

/** The table above, as the value the seam reads. Frozen, and keyed by
 *  `StageName` through `satisfies`, so a seventh stage cannot be added to
 *  `stages.ts` without a budget being decided for it — the compiler asks. */
export const STAGE_BUDGETS = Object.freeze({
  reading_your_site: Object.freeze({ seconds: 10, cents: 2.0 }),
  reading_access_rules: Object.freeze({ seconds: 1, cents: 0 }),
  reading_your_market: Object.freeze({ seconds: 12, cents: 4.7 }),
  checking_your_presence: Object.freeze({ seconds: 2, cents: 0 }),
  asking_the_twelve: Object.freeze({ seconds: 13, cents: 5.0 }),
  scoring: Object.freeze({ seconds: 2, cents: 0 }),
}) satisfies Readonly<Record<StageName, StageBudget>>;

/** How many of the twelve question-SERPs one pass has in flight at once
 *  (issue #539).
 *
 *  The twelve were bought one after another, which is what made
 *  `asking_the_twelve` unaffordable in time: at a live SERP's ordinary
 *  couple of seconds, twelve in sequence is most of the pass's whole
 *  target on its own. They are independent of each other — twelve separate
 *  queries, no call reading another's answer — so they are bought
 *  concurrently, and the stage's 13-second budget is a bound the fan-out
 *  can actually finish inside.
 *
 *  Four is a parameter, chosen here and reversible in one line: wide
 *  enough that the twelve take three waves rather than twelve, narrow
 *  enough that one pass never opens twelve sockets at the vendor at once
 *  and that the cap is re-read between waves while there is still headroom
 *  to protect. `JOB_FANOUT` is the *job runner's* bound across customers
 *  and is deliberately not reused: this is one pass's own. */
export const SERP_FANOUT = 4;

/** What a stage's work came back with, or the fact that the stage spent its
 *  budget before the work finished. `spent` is never an error: the stage's
 *  sections keep the arm they were initialised with — `not_attempted`, "we
 *  did not get to it" — and the pass moves to the next stage. */
export type StageOutcome<T> = { readonly spent: false; readonly value: T } | { readonly spent: true };

/** Both sums, checked when this module loads — the same discipline
 *  `stages.ts` uses for "exactly six stages". A widened budget that the
 *  pass cannot afford is a defect at import, not on a scan. */
function assertBudgetsFit(): void {
  const budgets = Object.values(STAGE_BUDGETS);
  const seconds = budgets.reduce((total, budget) => total + budget.seconds, 0);
  const cents = budgets.reduce((total, budget) => total + budget.cents, 0);
  if (seconds > TIMING.reportTargetS) {
    throw new Error(
      `src/lib/scan/budgets.ts: the per-stage time budgets sum to ${seconds}s, past TIMING.reportTargetS (${TIMING.reportTargetS}s).`
    );
  }
  if (cents > CAPS.FREE_C) {
    throw new Error(
      `src/lib/scan/budgets.ts: the per-stage spend budgets sum to ${cents}¢, past CAPS.FREE_C (${CAPS.FREE_C}¢).`
    );
  }
}

assertBudgetsFit();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The pass's own `Bounds`, narrowed to one stage.
 *
 * Every member answers for *either* ceiling — the pass's or this stage's —
 * so a multi-call step that already re-checks `stopNow()` between calls
 * (the twelve SERPs, the paid battery's two engines) starts respecting its
 * stage's budget without a line of its own changing. `stopNow()` reads
 * time before money for the same reason `ceilings.ts` does: the time bound
 * is the one §2 states absolutely.
 *
 * It never writes to the pass's bounds. A stage that exhausts its own
 * budget must not make the *pass* read as cut off — the pass still ends
 * `complete` where no overall ceiling fired, with the cut-off stage's
 * drivers `not_attempted` and every other stage's measured, which is
 * exactly the report §2 describes. `siteUnreadable` is the one member that
 * is deliberately delegated through: it is the pass's ending, not a
 * ceiling, and stage one is where it is decided.
 */
function stageBounds(a: {
  bounds: Bounds;
  cost: CostContext;
  budget: StageBudget;
  startedAtMs: number;
  spentAtEntryCents: number;
}): Bounds {
  const deadlineMs = a.startedAtMs + a.budget.seconds * 1000;
  const bounds: Bounds = {
    expired(): boolean {
      return a.bounds.expired() || Date.now() >= deadlineMs;
    },
    remainingMs(): number {
      return Math.min(a.bounds.remainingMs(), Math.max(0, deadlineMs - Date.now()));
    },
    capHit(): boolean {
      return a.bounds.capHit() || a.cost.spentCents() - a.spentAtEntryCents >= a.budget.cents;
    },
    stopNow(): "time_ceiling" | "spend_ceiling" | null {
      if (bounds.expired()) return "time_ceiling";
      if (bounds.capHit()) return "spend_ceiling";
      return null;
    },
    siteUnreadable(refusal): void {
      a.bounds.siteUnreadable(refusal);
    },
    unreadable() {
      return a.bounds.unreadable();
    },
  };
  return bounds;
}

/** One line per stage that spent its budget, carrying which column ran out
 *  and what the stage had. The pass's own ending line is `ceilings.ts`'s
 *  and says nothing about a stage; this is where a reader of the logs sees
 *  *which* stage was the expensive one — the thing 36 hours of fix-forward
 *  issues could not see. */
function logStageBudgetSpent(a: {
  stage: StageName;
  budget: StageBudget;
  elapsedMs: number;
  stageCents: number;
}): void {
  console.log(
    JSON.stringify({
      event: "stage_budget_spent",
      stage: a.stage,
      budgetSeconds: a.budget.seconds,
      budgetCents: a.budget.cents,
      elapsedMs: a.elapsedMs,
      stageCents: a.stageCents,
    })
  );
}

/**
 * Runs one stage's work inside that stage's own budget.
 *
 * `work` is handed a `Bounds` that answers for the stage's ceilings as well
 * as the pass's, and is raced against the stage's own deadline — so a stage
 * stuck inside a vendor call that never resolves still ends at its budget
 * and the pass still reaches the stages after it. The losing side is not
 * cancelled (nothing in this pipeline is cancellable: the vendor client
 * takes no signal from here), and it does not need to be — its result is
 * discarded, the sections it would have filled keep their `not_attempted`
 * arm, and its spend is already ledgered by `recordFetch`, which is what
 * "bounded and ledgered" means.
 *
 * `applies: false` — the two paid tiers, whose passes are released at ten
 * minutes or run on the standard queue — runs `work` against the pass's own
 * bounds and adds nothing. The budget is the free path's, because the two
 * sums it fits inside (`TIMING.reportTargetS`, `CAPS.FREE_C`) are the free
 * path's; it reaches this function as a parameter rather than a tier test,
 * so `run.ts` keeps its own rule that the pipeline branches on no tier.
 */
export async function withStageBudget<T>(
  a: {
    stage: StageName;
    bounds: Bounds;
    cost: CostContext;
    applies: boolean;
  },
  work: (bounds: Bounds) => Promise<T>
): Promise<StageOutcome<T>> {
  if (!a.applies) return { spent: false, value: await work(a.bounds) };

  const budget = STAGE_BUDGETS[a.stage];
  const startedAtMs = Date.now();
  const spentAtEntryCents = a.cost.spentCents();
  const bounds = stageBounds({ bounds: a.bounds, cost: a.cost, budget, startedAtMs, spentAtEntryCents });

  const done: StageOutcome<T> = await Promise.race([
    (async (): Promise<StageOutcome<T>> => ({ spent: false, value: await work(bounds) }))(),
    (async (): Promise<StageOutcome<T>> => {
      await delay(budget.seconds * 1000);
      return { spent: true };
    })(),
  ]);

  if (done.spent) {
    logStageBudgetSpent({
      stage: a.stage,
      budget,
      elapsedMs: Date.now() - startedAtMs,
      stageCents: a.cost.spentCents() - spentAtEntryCents,
    });
  }
  return done;
}
