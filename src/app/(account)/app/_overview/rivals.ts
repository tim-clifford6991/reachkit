// BUILD §4.5 — how far ahead each rival is: absolute at cold start, a ratio
// only once a ratio means something.
//
// §4.5 item 4, verbatim: "**How far ahead each rival is**: per rival — name
// · falling sparkline (gray, accent endpoint) · `78×` big mono · `was 276×`
// success badge. One dim line: 'Every line pointing down is the gap
// shrinking.'"
//
// §6.6 is what stops that from being the only arm, verbatim: "Overview 'how
// far ahead' ratios: when the customer's count is 0, render the rivals'
// absolute numbers with `you: 0` — **never a ratio** (division by zero
// renders as ∞× and reads as broken). The ratio module unlocks at ranked ≥
// 10." So the module has two arms and `RATIO_UNLOCK` decides between them.
//
// **The cold-start arm may not use the gap-shrinking line.** Below the
// threshold what moves over time is the *rival's own count* — the customer
// has no count for it to be shrinking against — and a screen that said "the
// gap is shrinking" there would be describing something that has not
// happened. The arm carries its own `lineKey`, and the resolver never
// returns the shrinking key on it.
//
// **A previous ratio that was never measured is never computed.** On the
// measurement that first crosses the threshold there is no previous ratio,
// because the customer was below it last week and no ratio was taken. That
// case carries the crossing measurement's absolute counts instead, under
// its own `first_ratio` arm — never a ratio derived after the fact from two
// numbers nobody compared at the time.
//
// **Only the confirmed set appears.** A rival the product derived but the
// customer never confirmed is a candidate, not a competitor, and this
// resolver filters on the flag rather than trusting the caller's ordering.
import type { Measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import type { ChangeMarker } from "@/lib/market/changes/markers";
import { changeWithin } from "./changes";
import { RATIO_UNLOCK } from "@/lib/config/constants";

/** One rival, as the screen needs it. `series` is how the gap has moved:
 *  the ratio over time on the warm arm, the rival's own count over time on
 *  the cold one. `null` is a break in the series — a domain change — and is
 *  never a zero. */
export interface RivalFact {
  domain: string;
  /** Only the set the customer confirmed renders (REQ-041 c8). */
  confirmed: boolean;
  ranked: Measured<number>;
  previousRanked?: Measured<number>;
  series: readonly (number | null)[];
  /** Required wherever `series` holds a break — the account the row states
   *  beside the sparkline, because the plot has no room for a sentence. */
  breakAccount?: string;
}

export interface RivalFacts {
  /** The customer's own ranked count — the number the arm is chosen by. */
  own: Measured<number>;
  previousOwn?: Measured<number>;
  rivals: readonly RivalFact[];
}

export interface AbsoluteRival {
  domain: string;
  ranked: Measured<number>;
  series: readonly (number | null)[];
  breakAccount?: string;
}

export interface RatioRival {
  domain: string;
  ratio: Measured<number>;
  /** The reading this one is compared against, or why there is none.
   *
   *  `spans_change` is REQ-071 c12 (issue #205): a change fell between the
   *  two readings, so the difference between them is not movement and may
   *  not be drawn, counted or described. The card states the window it
   *  would have compared over instead of comparing across it — which is
   *  c13's "say which span" rather than a silent omission. */
  previous:
    | Measured<number>
    | { kind: "first_ratio"; counts: { own: Measured<number>; rival: Measured<number> } }
    | { kind: "spans_change"; marker: ChangeMarker };
  series: readonly (number | null)[];
  breakAccount?: string;
}

export type RivalGapModule =
  | { kind: "absolute"; own: Measured<number>; rivals: readonly AbsoluteRival[]; lineKey: CopyKey }
  | { kind: "ratio"; rivals: readonly RatioRival[]; lineKey: CopyKey };

/** The one line the cold-start arm states. Named separately from the arm so
 *  the inequality with the shrinking line is a property a test can read
 *  rather than a string two people have to keep apart. */
export const ABSOLUTE_LINE_KEY = "overview.rivals.line.absolute" satisfies CopyKey;
export const SHRINKING_LINE_KEY = "overview.rivals.line.shrinking" satisfies CopyKey;

export function resolveRivals(
  facts: RivalFacts,
  /** The dates the site's answers changed. Absent means the same as empty
   *  — most sites never change one. */
  changes: readonly ChangeMarker[] = []
): RivalGapModule {
  const confirmed = facts.rivals.filter((rival) => rival.confirmed);
  const ownCount = facts.own.kind === "unmeasured" ? 0 : facts.own.value;

  if (ownCount < RATIO_UNLOCK) {
    return {
      kind: "absolute",
      own: facts.own,
      rivals: confirmed.map((rival) => ({
        domain: rival.domain,
        ranked: rival.ranked,
        series: rival.series,
        ...(rival.breakAccount === undefined ? {} : { breakAccount: rival.breakAccount }),
      })),
      lineKey: ABSOLUTE_LINE_KEY,
    };
  }

  return {
    kind: "ratio",
    rivals: confirmed.map((rival) => ({
      domain: rival.domain,
      ratio: ratioOf(rival.ranked, facts.own),
      previous: previousOf(facts, rival, changes),
      series: rival.series,
      ...(rival.breakAccount === undefined ? {} : { breakAccount: rival.breakAccount }),
    })),
    lineKey: SHRINKING_LINE_KEY,
  };
}

/** How many times the rival's count the customer's is. Only ever called on
 *  the warm arm, where the customer's own count is at least `RATIO_UNLOCK`,
 *  so the divisor is never zero on any reachable path. */
function ratioOf(rival: Measured<number>, own: Measured<number>): Measured<number> {
  if (rival.kind === "unmeasured") return rival;
  if (own.kind === "unmeasured") return { ...own, at: rival.at };
  if (own.value <= 0) return { kind: "unmeasured", reason: "undeterminable", at: rival.at };
  const value = Math.round(rival.value / own.value);
  return value === 0
    ? { kind: "zero", value, at: rival.at }
    : { kind: "measured", value, at: rival.at };
}

/** The previous ratio — or, where the customer was below the threshold at
 *  the previous measurement and no previous ratio was ever taken, that
 *  measurement's absolute counts. */
function previousOf(
  facts: RivalFacts,
  rival: RivalFact,
  changes: readonly ChangeMarker[]
): RatioRival["previous"] {
  const previousOwn = facts.previousOwn;
  const previousRanked = rival.previousRanked;
  if (previousOwn === undefined || previousRanked === undefined) {
    return {
      kind: "first_ratio",
      counts: { own: previousOwn ?? facts.own, rival: previousRanked ?? rival.ranked },
    };
  }
  const previousCount = previousOwn.kind === "unmeasured" ? 0 : previousOwn.value;
  if (previousCount < RATIO_UNLOCK) {
    return { kind: "first_ratio", counts: { own: previousOwn, rival: previousRanked } };
  }

  // REQ-071 c12, before any comparison is made: the two readings carry the
  // dates they were taken, and a change between them means they measured
  // two different markets. The difference is then not movement and this
  // card says so rather than printing it.
  const spanned = changeWithin([previousRanked.at, rival.ranked.at], changes);
  if (spanned !== null) return { kind: "spans_change", marker: spanned };

  return ratioOf(previousRanked, previousOwn);
}
