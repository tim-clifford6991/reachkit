// BUILD §7 — which ranked counts may satisfy a bar.
//
// A bar is a comparison against a rival domain's *total* ranked count. The
// product buys `ranked_keywords` at a row cap (`PRICE_BOOK.RANKED_RIVAL_ROWS`),
// so a response that came back **at** the cap is a floor — "at least this
// many" — and not a count. Comparing a floor against a bar reads a large
// rival as a small one, which manufactures targets the customer cannot
// win: the exact harm §7's winnability rule exists to prevent.
//
// So: a count at or above the cap is coerced to `unmeasured`, and an
// `unmeasured` count never satisfies a bar. The honest outcome of not
// knowing is fewer opportunities, never a guessed one — supply is the cap
// (DECISIONS, 2026-08-28).
import { PRICE_BOOK } from "@/lib/config/constants";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";

/**
 * A rival's ranked count as winnability may read it.
 *
 * `null` — we bought no rows for this domain — and a count at the row cap
 * both become `undeterminable`: we tried and cannot tell, which is the
 * stronger and truer of the two unmeasured reasons here. A count below the
 * cap is the vendor's own number and passes through with the date it was
 * measured on.
 */
export function rankedCountFrom(
  raw: { rows: number; at: Date } | null,
  at: Date
): Measured<number> {
  if (raw === null) return unmeasured("undeterminable", at);
  if (raw.rows >= PRICE_BOOK.RANKED_RIVAL_ROWS) return unmeasured("undeterminable", raw.at);
  return measured(raw.rows, raw.at);
}

/** The lookup a derivation is handed: one entry per domain the deep pass
 *  bought ranked rows for. A domain with no entry is not an error and not a
 *  zero — it is `undeterminable`, which `rankedCountsFor` below returns for
 *  it.
 *
 *  This is the seam where issue #37's rival sizing meets §7. #37 was not
 *  merged when this landed (PR #118 open), so its `RivalSize[]` is not yet
 *  a member of `StoredReport` and `bandRivalSize` cannot be called from
 *  here. `RankedCounts` is the interface declared in its place: a
 *  `Measured<number>` per domain is exactly what #37's `sized` arm carries,
 *  so wiring the two together is a projection at the call site and no
 *  change to anything in this directory. Nothing here re-derives a
 *  rival-size band — that is #37's `bandRivalSize` and stays its. */
export type RankedCounts = ReadonlyMap<string, Measured<number>>;

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
