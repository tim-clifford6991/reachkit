// BUILD §4.6 — "when opportunities run out, future days are empty and the
// empty state says so — the calendar is never padded."
//
// **Read ADR-061 before simplifying this file** (DECISIONS 2026-08-31:
// "'Nothing worth publishing' is a proven arm, never the fallback; an
// unattributed empty day is ReachKit's own stop"). Collapsing the last two
// arms into one `else` that says the market offered nothing is the obvious
// cleanup, and it makes the product tell a customer their market is empty
// on a day it merely broke. REQ-043 criterion 3's second sentence forbids
// it in terms: "No date emptied by any other cause, whether or not a
// requirement names that cause, ever carries that line."
//
// ADR-011 is the shape: one arbiter, a closed cause union, a fixed
// precedence, first match. The precedence is data, not the order of a chain
// of `if`s that a later editor can re-sort without noticing. It is the same
// shape as the shell's `NO_PUBLISH_PRECEDENCE` (`../_shell/nopublish.ts`),
// and ADR-061 point 4 requires the two orders to agree: ReachKit's own stop
// outranks every cause that is also true.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-08-31: "Nothing worth publishing" is a proven arm, never the fallback; an
//   unattributed empty day is ReachKit's own stop. — ADR-061

import type { CopyKey } from "@/lib/presentation/copy";
import type { WorkStop } from "@/lib/presentation/stopped";

/** REQ-043 criteria 3, 4 and 5. One account per date, resolved in one fixed
 *  order, total. */
export type EmptyAccount =
  | { cause: "instruction"; opportunityId: string }
  | { cause: "reachkit_stopped" }
  | { cause: "page_cannot_go_live"; state: "skipped" | "unpublished" }
  | { cause: "customer_change_holds_pages"; setting: "publishing_off" | "destination_disconnected" }
  /** REQ-071 c11 (issue #204): a market answer the customer replaced is
   *  holding generation until the pass that adopts it. It carries the one
   *  held answer and the date pages resume — `generationHold()`'s own two
   *  values, and never a third derived here. */
  | { cause: "change_holds_generation"; because: "domain" | "category"; resumesOn: Date }
  | { cause: "page_held" }
  | { cause: "supply_exhausted" }
  | { cause: "unattributed" };

export type EmptyCause = EmptyAccount["cause"];

/**
 * **Why this union is not `place/account.ts`'s `CauseTag`** (ADR-011 point
 * 6, and issue #113's fourth question).
 *
 * They answer two different questions and are arbitrated over two
 * different subjects. `CAUSE_PRECEDENCE` orders the causes a *place* is
 * empty for — REQ-091's "why does this market/answer/page-set show
 * nothing" — and its members (`named`, `unrecognised`, `no-presence-yet`)
 * are facts about a measurement. This one orders the causes a *date* is
 * empty for (REQ-043 c3–c5), and its members (`page_cannot_go_live`,
 * `page_held`, `customer_change_holds_pages`) are facts about a page's
 * passage through §9. Neither union's members are statable of the other's
 * subject, so merging them would produce one list on which most members
 * are unreachable from most callers — which is how a precedence stops
 * being readable as a decision.
 *
 * What the two **do** share is ADR-061 point 4's one requirement, and it
 * is a property rather than a shared list: ReachKit's own stop is first in
 * both. `tests/app/calendar/law-lines.test.ts` asserts that over both
 * orders, so the agreement is checked rather than remembered.
 */

/** ADR-061's decision block, transcribed. `instruction` outranks everything
 *  (REQ-043 c5); `reachkit_stopped` outranks the customer's own causes
 *  (REQ-092 c7); `supply_exhausted` is second to last and proven only; and
 *  `unattributed` is the last arm, never a widened one.
 *
 *  **`change_holds_generation` (#204) sits between the customer's saved
 *  settings and `page_held`.** Below `customer_change_holds_pages` because
 *  that one the customer can undo with a click and this one resolves on a
 *  date they have already been given; above `page_held` because it says
 *  *why* no page exists for the date at all, where `page_held` says only
 *  that a page which does exist did not go out. REQ-071 c11 names the
 *  change and the resumption date, so it is the more actionable fact of
 *  the two and the date's one account.
 *
 *  **`page_held` (#116) is directly above `supply_exhausted` and nowhere
 *  else.** Below the three attributed causes, because each of them says
 *  *why* the page did not go out and this one says only that it did not:
 *  where ReachKit's own stop, a page that can no longer go live, or a change
 *  the customer saved is true of the date, that is the account, and putting
 *  the weaker fact above any of them would lose the actionable one. Above
 *  `supply_exhausted`, because that is the arm REQ-043 c3 reserves and a
 *  date a page was planned for is exactly the date whose supply was *not*
 *  exhausted — "there was nothing worth publishing" is a false statement
 *  about a market that produced a page. */
export const EMPTY_PRECEDENCE: readonly EmptyCause[] = Object.freeze([
  "instruction",
  "reachkit_stopped",
  "page_cannot_go_live",
  "customer_change_holds_pages",
  "change_holds_generation",
  "page_held",
  "supply_exhausted",
  "unattributed",
] as const);

/**
 * What is known about one empty date, before it is an account. Every member
 * is required: a cause that was not established is stated `false` or `null`,
 * never an absent field that reads the same as "no".
 */
export interface EmptyFacts {
  /** REQ-047 c5's outstanding instruction against this date, or `null`. */
  instruction: { opportunityId: string } | null;
  /** REQ-092 c1: a cap, a halt, or a step that failed on this date. */
  reachkitStopped: boolean;
  /** A draft on this date in a state that occupies no date (`STAGE_OF` maps
   *  both to `null`), or `null` where there is no such draft. */
  pageCannotGoLive: "skipped" | "unpublished" | null;
  /** A change the customer saved that holds pages back, or `null`. */
  customerChangeHoldsPages: "publishing_off" | "destination_disconnected" | null;
  /** REQ-071 c11: the market answer being replaced, and the date pages
   *  resume — `generationHold()`'s `held: true` arm, or `null` where
   *  nothing is being replaced. Read, never derived here. */
  changeHoldsGeneration: { because: "domain" | "category"; resumesOn: Date } | null;
  /**
   * REQ-092 c5: a page was planned for this date and did not go live on it,
   * because it was held — the publishing machine refused every route into
   * an attempt and took no transition, so the page is still there, in the
   * state it was in, waiting its turn in the resume order
   * (`src/lib/publish/switch`'s `resumeOrder`).
   *
   * It is not `pageCannotGoLive`. That arm is for a page that can no longer
   * go live at all — `skipped` or `unpublished`, both terminal — and a held
   * page is the opposite: it still publishes, on a later date. Telling a
   * customer their page can no longer go live while it is queued to go out
   * is a false statement, which is why this is its own arm and its own
   * sentence.
   */
  pageHeld: boolean;
  /**
   * `supplyDepth().unused` — **read**, or `null` where it could not be
   * read. ADR-061 point 1: the exhausted-supply arm fires only when this is
   * read *and is zero*. `null` is not zero and must never be treated as it:
   * a depth nobody could read is exactly the case the fallback exists for.
   */
  unusedSupply: number | null;
}

/**
 * The two causes this module does **not** speak for (issue #113).
 *
 * REQ-092 is a law over surfaces, and ADR-011 gives it one home:
 * `stoppedWorkStatement()` in `src/lib/presentation/stopped/`. It returns
 * three lines — c1's "ReachKit stopped its own work", c2's what is needed
 * from the customer (and, when nothing is, that nothing is) and c4's
 * resumption date or the explicit statement that none is promised. A
 * direct read of `stopped.work.line` returns the first of the three and
 * silently drops the other two, which is what this file used to do.
 *
 * `unattributed` is in the pair because ADR-061 point 2 puts it there on
 * the merits: "a date the product cannot explain is a date on which
 * something of the product's failed". It is not a weaker statement of the
 * same thing — it *is* ReachKit's own stop, and it is owed all three lines
 * for the same reason.
 */
export const LAW_CAUSES: readonly EmptyCause[] = Object.freeze([
  "reachkit_stopped",
  "unattributed",
] as const);

export type CalendarOwnCause = Exclude<EmptyCause, "reachkit_stopped" | "unattributed">;

export function isLawCause(cause: EmptyCause): cause is "reachkit_stopped" | "unattributed" {
  return cause === "reachkit_stopped" || cause === "unattributed";
}

/** The line each cause the **calendar** speaks is spoken from **in a grid
 *  cell**. The two law causes are absent by type, so this file cannot name
 *  their key again: adding one back is a compile error, not a review
 *  comment. */
export const EMPTY_COPY_KEY: Record<CalendarOwnCause, CopyKey> = {
  instruction: "calendar.empty.instruction",
  page_cannot_go_live: "calendar.empty.page-cannot-go-live",
  customer_change_holds_pages: "calendar.empty.customer-change-holds-pages",
  change_holds_generation: "calendar.empty.change-holds-pages",
  page_held: "calendar.empty.page-held",
  supply_exhausted: "cause.supply-exhausted",
};

/**
 * The same causes as the **day panel** speaks them: the whole account,
 * where the cell states its first line alone.
 *
 * That split is DECISIONS 2026-09-07 (#209) — "the grid cell states the
 * first line alone, the panel all three" — generalised from the law causes
 * to the calendar's own, because the approved screen set draws exactly the
 * same shape for supply (issue #354). S14's cell reads `nothing worth
 * publishing`; S15's `empty` panel reads the whole of it: "Nothing worth
 * publishing on this date — the supply of opportunities in your market is
 * used up until Monday's re-measure finds more."
 *
 * **Total over the causes, and mostly the same map.** Only
 * `supply_exhausted` has a fuller form drawn for it; every other cause has
 * one sentence and states it in both places, so it names the same key
 * twice rather than gaining a second, unwritten one. A cause that grows a
 * panel form later changes one row here and nothing else — and a cause
 * added to the union fails both maps on the day it is added, which is what
 * `Record<CalendarOwnCause, …>` is for.
 */
export const EMPTY_ACCOUNT_COPY_KEY: Record<CalendarOwnCause, CopyKey> = {
  ...EMPTY_COPY_KEY,
  supply_exhausted: "calendar.empty.supply-exhausted",
};

/**
 * The stop a law-caused empty day states, as `stoppedWorkStatement` needs
 * it.
 *
 * Two arms and no invention in either:
 *
 *   · `reachkit_stopped` — the site's own stop, read once by
 *     `_shell/stop.ts` and carried on the facts. Where that read found no
 *     stop, or could not be made at all — `calendar/store.ts` catches it to
 *     `null`, because a read that threw is not a claim that nothing stopped
 *     — the day is exactly as explicable as an unattributed one and takes
 *     the same answer.
 *   · `unattributed` — ADR-061 point 2's stop, which has no record behind
 *     it. `needs: nothing` and `resumes: no time promised` are the two
 *     **true** statements about a day nobody can account for: nothing is
 *     known to be needed from the customer, and no resumption is promised.
 *     Neither is a placeholder, and c4's "never neither" is exactly the
 *     case this arm exists to satisfy.
 *
 * `partial` is false on both: a partial pass is REQ-092 c6's *page
 * produced anyway*, and every day reaching here produced none.
 */
export function stopForEmptyDay(a: {
  cause: "reachkit_stopped" | "unattributed";
  stop: WorkStop | null;
  /** The date itself, as the moment the day's own stop is dated from. */
  since: Date;
}): WorkStop {
  if (a.cause === "reachkit_stopped" && a.stop !== null) return a.stop;
  return {
    since: a.since,
    resumes: { promised: false },
    needs: { kind: "nothing" },
    partial: false,
  };
}

/**
 * First match over `EMPTY_PRECEDENCE`, total. Returns exactly one account
 * for every date, whatever the facts say — including facts that say nothing
 * at all, which is `unattributed`.
 *
 * Pure: facts in, account out. Reading the facts is the provider's; keeping
 * the resolution pure is what lets every ADR-061 case be decided by a test
 * with no database.
 */
export function accountFor(facts: EmptyFacts): EmptyAccount {
  for (const cause of EMPTY_PRECEDENCE) {
    switch (cause) {
      case "instruction":
        if (facts.instruction !== null) {
          return { cause: "instruction", opportunityId: facts.instruction.opportunityId };
        }
        break;
      case "reachkit_stopped":
        if (facts.reachkitStopped) return { cause: "reachkit_stopped" };
        break;
      case "page_cannot_go_live":
        if (facts.pageCannotGoLive !== null) {
          return { cause: "page_cannot_go_live", state: facts.pageCannotGoLive };
        }
        break;
      case "customer_change_holds_pages":
        if (facts.customerChangeHoldsPages !== null) {
          return {
            cause: "customer_change_holds_pages",
            setting: facts.customerChangeHoldsPages,
          };
        }
        break;
      case "change_holds_generation":
        if (facts.changeHoldsGeneration !== null) {
          return {
            cause: "change_holds_generation",
            because: facts.changeHoldsGeneration.because,
            resumesOn: facts.changeHoldsGeneration.resumesOn,
          };
        }
        break;
      case "page_held":
        if (facts.pageHeld) return { cause: "page_held" };
        break;
      case "supply_exhausted":
        // ADR-061 point 1, and the one mutation this file is most likely to
        // suffer: `=== 0`, never `!facts.unusedSupply` and never a
        // fall-through. `null` — a depth that could not be read — does not
        // fire this arm.
        if (facts.unusedSupply === 0) return { cause: "supply_exhausted" };
        break;
      case "unattributed":
        return { cause: "unattributed" };
    }
  }
  // Unreachable: `unattributed` is the last member of the precedence and
  // returns unconditionally. Stated rather than left to a compiler that
  // cannot see it through the loop.
  return { cause: "unattributed" };
}
