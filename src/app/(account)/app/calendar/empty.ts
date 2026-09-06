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
import type { CopyKey } from "@/lib/presentation/copy";

/** REQ-043 criteria 3, 4 and 5. One account per date, resolved in one fixed
 *  order, total. */
export type EmptyAccount =
  | { cause: "instruction"; opportunityId: string }
  | { cause: "reachkit_stopped" }
  | { cause: "page_cannot_go_live"; state: "skipped" | "unpublished" }
  | { cause: "customer_change_holds_pages"; setting: "publishing_off" | "destination_disconnected" }
  | { cause: "supply_exhausted" }
  | { cause: "unattributed" };

export type EmptyCause = EmptyAccount["cause"];

/** ADR-061's decision block, transcribed. `instruction` outranks everything
 *  (REQ-043 c5); `reachkit_stopped` outranks the customer's own causes
 *  (REQ-092 c7); `supply_exhausted` is second to last and proven only; and
 *  `unattributed` is the last arm, never a widened one. */
export const EMPTY_PRECEDENCE: readonly EmptyCause[] = Object.freeze([
  "instruction",
  "reachkit_stopped",
  "page_cannot_go_live",
  "customer_change_holds_pages",
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
  /**
   * `supplyDepth().unused` — **read**, or `null` where it could not be
   * read. ADR-061 point 1: the exhausted-supply arm fires only when this is
   * read *and is zero*. `null` is not zero and must never be treated as it:
   * a depth nobody could read is exactly the case the fallback exists for.
   */
  unusedSupply: number | null;
}

/** The line each cause is spoken from. `reachkit_stopped` and
 *  `unattributed` share `stopped.work.line` — ADR-061 point 2, on the
 *  merits and not as a safe default: "a date the product cannot explain is
 *  a date on which something of the product's failed", and REQ-092 c1
 *  already covers a day on which a step failed. */
export const EMPTY_COPY_KEY: Record<EmptyCause, CopyKey> = {
  instruction: "calendar.empty.instruction",
  reachkit_stopped: "stopped.work.line",
  page_cannot_go_live: "calendar.empty.page-cannot-go-live",
  customer_change_holds_pages: "calendar.empty.customer-change-holds-pages",
  supply_exhausted: "cause.supply-exhausted",
  unattributed: "stopped.work.line",
};

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
