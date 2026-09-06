// BUILD §7 — at most one statement of supply.
//
// ADR-061: "'Nothing worth publishing' is a proven arm, never the
// fallback; an unattributed empty day is ReachKit's own stop." Exhausted
// supply is a *positive* claim and this module makes it one: the
// `exhausted` arm is returned only where the count was actually read and
// came back zero, and it carries the date supply hit zero. A read that
// cannot answer produces no notice at all, and the surface's own
// stopped-work arm speaks instead — never this one.
//
// **At most one notice is the return type, not a convention.** One
// function, one value, `SupplyNotice | null` — never an array. "The
// customer reads one statement of supply, not two" is a promise that dies
// quietly if two producers each emit a line and a surface renders both, so
// the precedence lives here, once, and is total: `exhausted` > `short` >
// `arrival_shortfall`.
//
// **Derived on every read.** No stored flag, no dismissal, no expiry, no
// job that has to remember to clear it. The `short` notice stands exactly
// while unused supply is under the threshold and stops on the first read
// after it is not; a customer returning after a Monday that added nothing
// reads the same statement with the same date, because `since` does not
// move while supply stays at zero.
//
// **No sentence.** The three lines are the owner's, in the copy registry
// (`cause.supply-exhausted` is already a key there). This module emits
// handles and a count.
import { SUPPLY_SHORT_BELOW, SUPPLY_TARGET_DEPTH } from "@/lib/config/constants";
import { supplyDepth } from "./depth";

export type SupplyNotice =
  | { kind: "exhausted"; days: 0; since: Date | null }
  /** 1..SUPPLY_SHORT_BELOW-1 */
  | { kind: "short"; days: number }
  /** The customer's first arrival after a pass that fell short. */
  | { kind: "arrival_shortfall"; days: number };

export async function supplyNotice(a: {
  siteId: string;
  /** The scan the customer is arriving after, where this read is that
   *  first arrival. Absent on every ordinary read. */
  firstArrivalAfter?: string;
}): Promise<SupplyNotice | null> {
  const { unused, exhaustedSince } = await supplyDepth(a.siteId);

  if (unused === 0) return { kind: "exhausted", days: 0, since: exhaustedSince };
  if (unused < SUPPLY_SHORT_BELOW) return { kind: "short", days: unused };

  // Supply stands. The only thing left to say is to someone arriving for
  // the first time after a pass that did not reach a month of depth: they
  // are about to see a calendar that stops before the month does, and the
  // honest thing is to say so once rather than let them find it. Above the
  // target there is nothing to tell, first arrival or not.
  //
  // A customer arriving at 3 days of supply reads the `short` line above
  // and not this one — it already carries `days`, so the arrival's content
  // is conveyed by the short statement and there is one statement, not
  // two. That is the whole of the precedence: it is an `if` chain in one
  // function, and no surface has to remember it.
  if (a.firstArrivalAfter !== undefined && unused < SUPPLY_TARGET_DEPTH) {
    return { kind: "arrival_shortfall", days: unused };
  }
  return null;
}
