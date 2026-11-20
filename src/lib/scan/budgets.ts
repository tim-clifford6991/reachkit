// The free pass's per-stage time and spend budget: a stage that spends its own budget ends and the pass carries on, where one overall ceiling let a slow stage starve every stage after it.
// `reading_your_market` and `asking_the_twelve` share one purse (`MARKET_PURSE_CENTS`): an extra seed is bought only while the purse still holds it and the SERPs of the questions it will ask (`affordsSeed`).
// Seconds sum to `TIMING.reportTargetS`, not the ceiling, leaving the ceiling's margin for the ending; cents sum under `CAPS.FREE_C`. `assertBudgetsFit` checks both at load.
// A stage's budget binds tighter than the model client's timeout, so a slow profile call leaves the market `not_attempted` and the twelve still get asked.
// Time is raced preemptively, since a call may never resolve; money is read cooperatively between calls through the stage's `Bounds`.
import { ASYNC_AIO_SURCHARGE_MULTIPLIER, CAPS, PRICE_BOOK, SELECTION, TIMING } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { Bounds } from "./ceilings";
import type { StageName } from "./stages";

/** One stage's two columns. Seconds of wall clock and cents of spend — the
 *  same two ceilings the pass has, sized for one stage of it. */
export interface StageBudget {
  readonly seconds: number;
  readonly cents: number;
}

/** Frozen and keyed by `StageName` through `satisfies`, so a new stage cannot be added without a budget. */
export const STAGE_BUDGETS = Object.freeze({
  reading_your_site: Object.freeze({ seconds: 10, cents: 2.0 }),
  reading_access_rules: Object.freeze({ seconds: 1, cents: 0 }),
  reading_your_market: Object.freeze({ seconds: 14, cents: 5.0 }),
  checking_your_presence: Object.freeze({ seconds: 1, cents: 0 }),
  asking_the_twelve: Object.freeze({ seconds: 13, cents: 5.0 }),
  scoring: Object.freeze({ seconds: 1, cents: 0 }),
}) satisfies Readonly<Record<StageName, StageBudget>>;

/** The most one question's SERP reserves on the free path: the high-priority queue's price with the async-AI-Overview surcharge. */
export const QUESTION_SERP_RESERVE_C = PRICE_BOOK.SERP_STD_HIGH_C * ASYNC_AIO_SURCHARGE_MULTIPLIER;

/** The purse `reading_your_market` spends from on the free path: its own row and the twelve's, since extra seeds are paid from SERPs of questions the pass does not have. */
export const MARKET_PURSE_CENTS = STAGE_BUDGETS.reading_your_market.cents + STAGE_BUDGETS.asking_the_twelve.cents;

/** What the twelve may spend after the market spent `marketCents` of their shared purse: their own row at most, never below zero. */
export function twelveCentsAfter(marketCents: number): number {
  return Math.max(0, Math.min(STAGE_BUDGETS.asking_the_twelve.cents, MARKET_PURSE_CENTS - marketCents));
}

/** What one of the free path's two nano calls is budgeted at — the half of
 *  `reading_your_market`'s row the table above gives the phrasing. */
export const PHRASING_RESERVE_C = 1.3;

/** Whether one more `keyword_suggestions` seed fits: with no questions, while the purse holds the seed; otherwise only while the purse still holds, after it,
 *  the phrasing and a SERP for `SELECTION.freeLadderMinQuestions` or every selected question, whichever is more. Strictly more, so the next read is not spent. */
export function affordsSeed(a: { remainingCents: number; selected: number }): boolean {
  if (a.selected === 0) return a.remainingCents > PRICE_BOOK.SUGGESTIONS_COST_C;
  const asked = Math.max(a.selected, SELECTION.freeLadderMinQuestions);
  return a.remainingCents > PRICE_BOOK.SUGGESTIONS_COST_C + PHRASING_RESERVE_C + asked * QUESTION_SERP_RESERVE_C;
}

/** How many questions `cents` can ask, at a reserve each (the cap is checked against reservations), floored.
 *  Decided before phrasing so the report lists only questions it can pay to answer. The epsilon absorbs IEEE-754 sums of `numeric(12,4)` reserves. */
export function questionsAffordable(cents: number): number {
  if (cents <= 0) return 0;
  return Math.floor((cents + 1e-9) / QUESTION_SERP_RESERVE_C);
}

/** All twelve at once: a paid question is three calls and waves of four overrun an invocation's ceiling; queued free reads would start late waves after the scan's time.
 *  The cap is still checked against every reservation in flight. */
export const PAID_SERP_FANOUT = 12;

/** A stage's result, or that it spent its budget first; `spent` is not an error, its sections stay `not_attempted`.
 *  `reason` is the column that ran out, so a stage the pass cannot continue without ends the pass bounded rather than `complete`. */
export type StageOutcome<T> =
  | { readonly spent: false; readonly value: T }
  | { readonly spent: true; readonly reason: "time_ceiling" | "spend_ceiling" };

/** Both sums, checked at module load, so a budget the pass cannot afford fails at import rather than on a scan. */
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

/** A delay cleared once the race settles: an uncleared timer holds the event loop open on a short-lived invocation. */
function cancellableDelay(ms: number): { promise: Promise<void>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

/** The pass's `Bounds` narrowed to one stage: each member answers for either ceiling, so steps that already re-check `stopNow()` respect the stage budget unchanged.
 *  It never writes to the pass's bounds, so a spent stage does not make the pass read as cut off; `siteUnreadable` and `stageExhausted` delegate through as the pass's ending. */
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
    remainingCents(): number {
      const stageLeft = a.budget.cents - (a.cost.spentCents() - a.spentAtEntryCents);
      return Math.max(0, Math.min(a.bounds.remainingCents(), stageLeft));
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
    stageExhausted(reason): void {
      a.bounds.stageExhausted(reason);
    },
    exhausted() {
      return a.bounds.exhausted();
    },
    abandoned() {
      return a.bounds.abandoned();
    },
  };
  return bounds;
}

/** One line per stage that spent its budget, naming the column and what it had, so the logs show which stage was expensive. */
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

/** Runs one stage's work inside its budget, raced against the stage deadline so a vendor call that never resolves still ends there.
 *  A losing call cannot be cancelled, so `abandoned()` turns true once this returns `{ spent: true }` and a late writer stays out of scored `sections`; its spend is still ledgered.
 *  `applies: false` (paid tiers) runs against the pass's bounds only, passed as a parameter so the pipeline branches on no tier. */
export async function withStageBudget<T>(
  a: {
    stage: StageName;
    bounds: Bounds;
    cost: CostContext;
    applies: boolean;
    /** The cents this stage may spend where not its own row (the shared market purse); seconds are always the row's. */
    cents?: number;
  },
  work: (bounds: Bounds, abandoned: () => boolean) => Promise<T>
): Promise<StageOutcome<T>> {
  // With no stage budgets the predicate is the pass's own, rather than a branch every caller must remember.
  if (!a.applies) return { spent: false, value: await work(a.bounds, () => a.bounds.abandoned()) };

  const row = STAGE_BUDGETS[a.stage];
  const budget: StageBudget = a.cents === undefined ? row : { seconds: row.seconds, cents: a.cents };
  const startedAtMs = Date.now();
  const spentAtEntryCents = a.cost.spentCents();
  const bounds = stageBounds({ bounds: a.bounds, cost: a.cost, budget, startedAtMs, spentAtEntryCents });

  // Flipped only once the race has actually settled against the work, so a
  // stage that answered in time is never told it was abandoned by a timer
  // that fired afterwards.
  let abandoned = false;
  const timer = cancellableDelay(budget.seconds * 1000);
  const done: StageOutcome<T> = await Promise.race([
    // Abandoned by this stage's budget or by the pass's deadline firing inside it: either way nobody waits for the write.
    (async (): Promise<StageOutcome<T>> => ({
      spent: false,
      value: await work(bounds, () => abandoned || a.bounds.abandoned()),
    }))(),
    (async (): Promise<StageOutcome<T>> => {
      await timer.promise;
      // The column that ran out, answered by the stage's own two rather
      // than guessed at the call site — the timer that settles this race is
      // the time column, so that is the usual answer.
      return { spent: true, reason: bounds.stopNow() ?? "time_ceiling" };
    })(),
  ]);
  timer.cancel();

  if (done.spent) {
    abandoned = true;
    logStageBudgetSpent({
      stage: a.stage,
      budget,
      elapsedMs: Date.now() - startedAtMs,
      stageCents: a.cost.spentCents() - spentAtEntryCents,
    });
  }
  return done;
}
