// BUILD §6.5, §11 — §11's stop, for one account, read once.
//
// **One home, because two surfaces state it.** ADR-011 point 6: a rule the
// product speaks has one implementation. The shell's own notice
// (`StoppedNotice`) and the calendar's stopped day (`empty.ts` through
// `stopped-account.ts`) are both statements about the same stop, and each
// reading it for itself is how the two come to disagree about whether
// ReachKit stopped. So the read lives here and both import it.
//
// It was `_shell/store.ts`'s private function until issue 113 gave the
// calendar the same fact to state.
//
// **A real stop is one of two facts, and neither is a pass's outcome**
// (issue 841, owner 2026-09-17). The kill switch is engaged, or the
// product's spend for the day has reached its ceiling. This used to read
// the site's last `scans` row too and call a `degraded` or `failed` pass a
// stop — and a pass that found too little market is stored `degraded`, so
// a new site with a thin market was told "ReachKit stopped its own work
// today" with the switch off and 4.41¢ of 5000¢ spent. That site is the
// market-too-small state, which the calendar's supply arms and the
// onboarding panel already state from their own reads.
import { now as clock } from "@/lib/config/now";
import { stopCause, type WorkStop } from "@/lib/presentation/stopped";

/** Whether the day's product-wide spend has reached `CAPS.DAILY_PRODUCT_C`,
 *  over the same ledger the cost seam refuses calls from. A ledger that
 *  could not be read is not a stop the screen can state: the paid path
 *  holds on it (issue 792), but nothing is known to have been reached, and
 *  the founder is not told a fact nobody has. */
async function dayCeilingReached(at: Date): Promise<boolean> {
  const { readDaySpendCents, ceilingReached } = await import("@/lib/costs/daily");
  const spent = await readDaySpendCents(at);
  return spent !== null && ceilingReached(spent);
}

/**
 * §11's stop, for this account.
 *
 * `resumes` and `needs` are the two REQ-092 requires to be stated rather
 * than omitted. Neither stop promises a time here and neither needs anything
 * from the customer — both are ReachKit's own, and REQ-092 c2's "when
 * nothing is, says so" is what the `nothing` arm renders.
 *
 * Both facts are product-wide, so it takes no site: every account states the
 * same stop.
 */
export async function readStop(): Promise<WorkStop | null> {
  const { reachKitStopped } = await import("@/lib/publish/switch");
  const foundAt = clock();
  const [killSwitch, capHit] = await Promise.all([reachKitStopped(), dayCeilingReached(foundAt)]);
  const cause = stopCause({ capHit, killSwitch });
  if (cause === null) return null;
  return {
    // Neither stop writes a row with its moment: the kill switch is an
    // environment binding, and the ceiling is a sum. The moment it was found
    // under-attributes rather than over-attributes earlier days.
    since: foundAt,
    resumes: { promised: false },
    needs: { kind: "nothing" },
    // REQ-092 c6 is a page produced by a pass that was cut short; neither
    // stop is a statement about a page, and every surface reading this has
    // no page produced by the stop.
    partial: false,
  };
}
