// BUILD §7 — which ranked counts may satisfy a bar.
//
// A bar is a comparison against a rival domain's *total* ranked count.
// Sizing stores the vendor's own total where the vendor returned one
// (#117), and that is a measurement at any size — a rival ranking for
// 50,000 searches is a large rival, not an unknown one (#768). Only where
// no total came back is the count the rows bought at
// `PRICE_BOOK.RANKED_RIVAL_ROWS`, and a row count **at** the cap is a floor
// — "at least this many" — not a count. Comparing a floor against a bar
// reads a large rival as a small one, which manufactures targets the
// customer cannot win: the exact harm §7's winnability rule exists to
// prevent.
//
// So: a row count at or above the cap is coerced to `unmeasured`, and an
// `unmeasured` count never satisfies a bar. Which kind a count is travels
// from sizing on the entry (`countIs`); it is never inferred from the
// number. The honest outcome of not knowing is fewer opportunities, never
// a guessed one — supply is the cap (DECISIONS, 2026-08-28).
import { PRICE_BOOK } from "@/lib/config/constants";
import type { RivalSize } from "@/lib/market/rivals/size";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";

/**
 * A rival's ranked count as winnability may read it.
 *
 * `null` — we bought no rows for this domain — and a row count at the cap
 * both become `undeterminable`: we tried and cannot tell, which is the
 * stronger and truer of the two unmeasured reasons here. A vendor total is
 * the vendor's own number at any size, and so is a row count below the
 * cap; both pass through with the date they were measured on.
 *
 * `countIs` absent is an entry stored before #768 said which it was. A
 * count above the cap can only have been a total there, so only a count
 * exactly at the cap stays unknown.
 */
export function rankedCountFrom(
  raw: { count: number; countIs?: "total" | "rows"; at: Date } | null,
  at: Date
): Measured<number> {
  if (raw === null) return unmeasured("undeterminable", at);
  const cap = PRICE_BOOK.RANKED_RIVAL_ROWS;
  const floor =
    raw.countIs === "rows" ? raw.count >= cap : raw.countIs === undefined && raw.count === cap;
  if (floor) return unmeasured("undeterminable", raw.at);
  return measured(raw.count, raw.at);
}

/** The lookup a derivation is handed: one entry per domain the deep pass
 *  sized. A domain with no entry is not an error and not a zero — it is
 *  `undeterminable`, which `rankedCountsFor` below returns for it. */
export type RankedCounts = ReadonlyMap<string, Measured<number>>;

/**
 * #37's rival sizing, projected into what winnability reads.
 *
 * The two modules meet here and nowhere else. Sizing owns the counts and
 * the near/middle/far band a *rival* carries (`bandRivalSize`); this
 * module owns the Winnable/Reach/Not-yet band a *target* carries. No band
 * is re-derived here and no count is re-measured: an entry's
 * `rankedCount` is taken with the date it was measured on, and an
 * `unsized` rival contributes `undeterminable` — never a zero, which
 * would satisfy every bar.
 *
 * `sized` counts still pass through `rankedCountFrom`, so a row count at
 * the cap — the vendor returned no total — is a rival whose size we do not
 * know, and winnability says so. A vendor total is read as the count it is.
 */
export function rankedCountsFromSizes(
  sizes: readonly RivalSize[],
  at: Date
): RankedCounts {
  const counts = new Map<string, Measured<number>>();
  for (const size of sizes) {
    counts.set(
      size.domain,
      size.state === "sized"
        ? rankedCountFrom({ count: size.rankedCount, countIs: size.countIs, at: size.at }, at)
        : unmeasured<number>("undeterminable", at)
    );
  }
  return counts;
}

/** Every top-ten domain's ranked count, in the SERP's own order. A domain
 *  the lookup does not carry contributes an `undeterminable` count rather
 *  than being dropped, so the "no measured count anywhere in this top ten"
 *  case stays visible to the caller as a rejection rather than as an empty
 *  list it cannot tell from a missing SERP. */
export function rankedCountsFor(
  domains: readonly string[],
  counts: RankedCounts,
  at: Date
): Measured<number>[] {
  return domains.map((domain) => counts.get(domain) ?? unmeasured<number>("undeterminable", at));
}
