// BUILD §6.6 — one entry per tracked rival, a date on every band.
//
// The archived plan is WO-087. Every rival the customer chose gets exactly
// one entry, in the order they were handed in: sized with its counts, its
// date and whether that measurement is current, or unsized for one of two
// named reasons. **There is no code path in this module that filters,
// reorders, excludes, hides or truncates a rival** — that absence is how
// REQ-096 c7 is held ("no band ever removes a rival, hides it, drops it
// from a comparison, or stops it being measured"), and the property test
// asserts the array's length and order over every arm, failures included.
//
// **Paid path only, and no new spend site.** Sizing reads the rows the
// deep and monthly passes already buy — `rankedKeywords` at
// `PRICE_BOOK.RANKED_RIVAL_ROWS`, cached on §6.4's 30-day rival window,
// inside `CAPS.DEEP_C`/`CAPS.WEEKLY_C`. §6.4's never-pull list forbids
// per-rival `ranked_keywords` on the free path, and that is held by the
// module graph rather than by a runtime check: nothing in the free
// report's card (`derive.ts`, `presence.ts`) resolves an import into this
// file, and this file resolves none into theirs. The test asserts both
// directions.
//
// **Cold start.** `ownRanked: 0` is an ordinary input: `bandRivalSize`
// bands against the floors, every rival still gets an entry, and no arm
// here reads the customer's own presence to decide whether a rival is
// worth measuring.
//
// **`rankedCount` is the vendor's own total, not the rows bought** (#117).
// The call still buys `PRICE_BOOK.RANKED_RIVAL_ROWS` rows and costs what
// it always did; `total_count` rides back beside them. That is what makes
// the `far` band — a rival above `max(500, 5×C)` — reachable at all, and
// with it `swapOffer`. Where the vendor reports no total the count falls
// back to the rows, which understates a large rival and therefore bands it
// nearer: fewer `far` rivals, fewer swap offers, never more. The error
// direction is the one §7 asks for.
//
// No sentence is written here. `RivalSize`'s arms are states; the words
// each state picks are the copy registry's and the surface's.
import { CACHE_WINDOWS_D, PRICE_BOOK } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { measured, measuredZero, type Measured } from "@/lib/measure/measured";
import { rankedKeywords } from "@/lib/vendors/dataforseo";
import { bandRivalSize, type RivalSizeBand } from "./band";

/**
 * One tracked rival's size, or the named reason it has none.
 *
 * The `unsized` arm carries **no** band and **no** count, so no surface
 * can print a band for a rival that has not been measured — the arm is a
 * state with a reason on it, never a `null`, an `undefined` or an omitted
 * element (REQ-096 c5).
 *
 * `current` is required on the `sized` arm: a surface cannot omit the
 * distinction between a count taken in this pass and one carried forward
 * from an earlier one by omitting a field.
 */
export type RivalSize =
  | {
      domain: string;
      state: "sized";
      /** Searches this rival appears in: the vendor's own total, or — where
       *  it reported none — the rows this call bought, which understates
       *  and so bands nearer (#117). A plain number either way: the
       *  stored blob's shape is unchanged, so no report version moves. */
      rankedCount: number;
      /** Derived from `rankedCount` and the customer's own count, never
       *  stored independently of them: re-deriving from the two counts
       *  reproduces this value, and a test asserts it. */
      band: RivalSizeBand;
      at: Date;
      current: boolean;
    }
  | {
      domain: string;
      state: "unsized";
      because: "awaiting_deep_pass" | "added_since_last_sizing";
    };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * REQ-096 c3. True when this rival has never been measured, or when its
 * last measurement is a rival cache window or more behind `now` — one
 * number, `CACHE_WINDOWS_D.rival`, read from the pins rather than
 * restated, so the monthly cadence §6.3 gives rival `ranked_keywords`
 * moves here when it moves there.
 *
 * Pure and total: no clock is read, `now` is the caller's.
 */
export function dueForResizing(a: { lastMeasuredAt?: Date; now: Date }): boolean {
  if (a.lastMeasuredAt === undefined) return true;
  const elapsedDays = (a.now.getTime() - a.lastMeasuredAt.getTime()) / MS_PER_DAY;
  return elapsedDays >= CACHE_WINDOWS_D.rival;
}

/**
 * Sizes every rival handed in, in the order handed in.
 *
 * `ownRanked` is the customer's own measured count **from the same pass**
 * and is one value for the whole call, so a band can never mix a rival's
 * count from one pass with a customer count from another. `at` is one
 * stamp for the whole call, for the same reason.
 *
 * `previous` is the entries the last sizing produced, supplied by the
 * caller. It decides what an unmeasurable rival becomes:
 *
 *   - it was sized before → that entry is carried forward unchanged but
 *     for `current: false`, keeping its **earlier** date. It never falls
 *     back to `unsized`, which would read as "we have never measured
 *     this" about a rival we have (REQ-096 c4).
 *   - it was unsized before → that reason stands.
 *   - it is not in `previous`, and `previous` was supplied → it was
 *     `added_since_last_sizing`.
 *   - `previous` was not supplied at all → no pass has run for this
 *     customer, so it is `awaiting_deep_pass`.
 *
 * The returned `Measured` is `zero` for an empty rival set and `measured`
 * otherwise, and never `unmeasured`: the array is always a complete,
 * honest value — one entry per rival, each stating for itself whether it
 * was measured and why not. Folding a per-rival failure into an
 * `unmeasured` arm would throw the other rivals' entries away, which is
 * exactly what c7 forbids.
 */
export async function sizeRivals(
  c: CostContext,
  a: {
    rivals: readonly string[];
    ownRanked: number;
    at: Date;
    previous?: readonly RivalSize[];
  }
): Promise<Measured<RivalSize[]>> {
  const previousBy = new Map((a.previous ?? []).map((entry) => [entry.domain, entry]));
  const entries: RivalSize[] = [];

  for (const domain of a.rivals) {
    const before = previousBy.get(domain);

    // §6.5: `capHit()` is re-checked between calls in any multi-call step.
    // A rival reached after the ceiling is not measured; it keeps what it
    // had, exactly as one whose fetch failed does.
    if (c.capHit()) {
      entries.push(carriedForward(domain, before, a.previous !== undefined));
      continue;
    }

    const rows = await rankedKeywords(c, { domain, rows: PRICE_BOOK.RANKED_RIVAL_ROWS });
    if (rows.kind === "unmeasured") {
      entries.push(carriedForward(domain, before, a.previous !== undefined));
      continue;
    }

    // The vendor's total where there is one; the rows otherwise. Never
    // both, and never a count assembled from the two.
    const rankedCount = rows.value.total ?? rows.value.rows.length;
    const band = bandRivalSize({ rivalRanked: rankedCount, ownRanked: a.ownRanked });
    entries.push({ domain, state: "sized", rankedCount, band, at: a.at, current: true });
    logSizing({
      rankedCount,
      ownRanked: a.ownRanked,
      band,
      at: a.at,
      resizing: before?.state === "sized",
    });
  }

  if (entries.length === 0) return measuredZero<RivalSize[]>([], a.at);
  return measured(entries, a.at);
}

/** What a rival that could not be measured in this call becomes. Never a
 *  dropped element: every branch returns an entry for `domain`. */
function carriedForward(
  domain: string,
  before: RivalSize | undefined,
  hadPreviousPass: boolean
): RivalSize {
  if (before?.state === "sized") return { ...before, current: false };
  if (before?.state === "unsized") return before;
  return {
    domain,
    state: "unsized",
    because: hadPreviousPass ? "added_since_last_sizing" : "awaiting_deep_pass",
  };
}

/** WO-087's observability line: the two counts, the derived band, the
 *  measurement date, and whether it was a re-measurement or a first
 *  sizing. Counts only — no domain reaches a log line from here, the same
 *  discipline `derive.ts` keeps. */
function logSizing(record: {
  rankedCount: number;
  ownRanked: number;
  band: RivalSizeBand;
  at: Date;
  resizing: boolean;
}): void {
  console.log(
    JSON.stringify({
      event: "rival_sizing",
      rankedCount: record.rankedCount,
      ownRanked: record.ownRanked,
      band: record.band,
      at: record.at.toISOString(),
      resizing: record.resizing,
    })
  );
}
