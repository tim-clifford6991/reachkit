// BUILD §6.7 step 2 — the measured market set (issue #26; WO-072's plan)
//
// "**Step 2 — Measured market (1.8¢).** `keyword_suggestions` on the primary
// seed → ~50 real searches with real volumes. This converts guessed language
// into measured language."
//
// This module buys and nothing else. It applies **no** floor, no filter, no
// ranking, no intent classification and no near-duplicate collapse — those
// are `select.ts`'s, pinned there, so there is exactly one place a search can
// be dropped (BP-025 decision 1 keeps selection pure and in one place). The
// only collapse here is transport-level: an exact repeated `keyword` across
// two seeds is one row, kept at its first occurrence.
//
// **Cold-start law (§6.6).** A vendor that returned no rows is `zero`
// with `[]` — a measurement, never an error and never `unmeasured`. No row is
// ever synthesised to make the market look inhabited, so a domain that ranks
// for nothing completes this step with a real, empty answer.
//
// Cache-first is the seam's, not this file's: `keywordSuggestions` runs inside
// `CostContext.recordFetch` (§6.5), which serves the 30-day suggestions
// window from `fetches` before it spends (§6.4).
import type { CostContext } from "@/lib/costs";
import { VENDOR } from "@/lib/config/constants";
import {
  measured,
  measuredZero,
  unmeasured,
  worseReason,
  type Measured,
  type UnmeasuredReason,
} from "@/lib/measure/measured";
import { keywordSuggestions } from "@/lib/vendors/dataforseo";
import type { Profile } from "./profile";

/** BP-025 `## Public interface`. The product's row, not the vendor's: the
 *  vendor's own `SuggestionRow` spells the figure `searchVolume`, and the
 *  mapping between the two happens once, below. */
export interface SuggestionRow {
  keyword: string;
  volume: number;
}

/** The `market` section of the report blob, declared here because this node
 *  writes it (ADR-095). `Measured` wraps the whole set and not its parts: an
 *  unreadable home page yields no profile and therefore no market, so the
 *  three fail together and never apart. The scan pipeline composes it as
 *  `market: Measured<MarketSet>` and declares no shape of its own. */
export interface MarketSet {
  profile: Profile;
  suggestions: readonly SuggestionRow[];
  totalVolume: number;
}

/**
 * The seeds' suggestions as one measured set — as many rows as the vendor
 * returned and no more.
 *
 * Seeds are the caller's (the scan pipeline's): §6.3 seeds them from
 * the profile's buyer-vocabulary terms, and this function neither derives nor
 * second-guesses them. Calls are issued one at a time, never fanned out —
 * `CostContext` tracks one reservation at a time by contract.
 *
 * The arms fold as WO-072 step 3 states them: any `measured` arm makes the
 * whole set `measured` (real market language entered), all-`zero` is `zero`,
 * and a set with no rows and at least one failed seed is `unmeasured` — the
 * honest arm, since "we measured an empty market" is a claim the failed seed
 * does not support. Where more than one seed failed the reasons fold under
 * `worseReason` (BP-024 decision 3: `undeterminable` outranks
 * `not_attempted`), rather than taking the first arm's reason and letting the
 * seed order decide what the product claims.
 */
export async function deriveMarketSet(
  c: CostContext,
  a: { seeds: string[] }
): Promise<Measured<SuggestionRow[]>> {
  const rows: SuggestionRow[] = [];
  const seen = new Set<string>();
  let anyMeasured = false;
  let reason: UnmeasuredReason | undefined;
  let at: Date | undefined;

  for (const seed of a.seeds) {
    const result = await keywordSuggestions(c, { seed, rows: VENDOR.suggestionsRows });
    at ??= result.at;
    if (result.kind === "unmeasured") {
      reason = reason === undefined ? result.reason : worseReason(reason, result.reason);
      continue;
    }
    if (result.kind === "measured") anyMeasured = true;
    for (const row of result.value) {
      if (seen.has(row.keyword)) continue;
      seen.add(row.keyword);
      rows.push({ keyword: row.keyword, volume: row.searchVolume });
    }
  }

  const outcome = foldOutcome({ rows, anyMeasured, reason, at: at ?? new Date() });
  logMarketSet(a.seeds.length, outcome);
  return outcome;
}

function foldOutcome(a: {
  rows: SuggestionRow[];
  anyMeasured: boolean;
  reason: UnmeasuredReason | undefined;
  at: Date;
}): Measured<SuggestionRow[]> {
  if (a.anyMeasured) return measured(a.rows, a.at);
  if (a.reason !== undefined) return unmeasured(a.reason, a.at);
  return measuredZero<SuggestionRow[]>([], a.at);
}

/** BP-025 `## NFR budget`: "suggestion row count". The count and the arm,
 *  never a keyword — the market's own language is the customer's derived
 *  data and has no seam that permits it into a log line. */
function logMarketSet(seeds: number, outcome: Measured<SuggestionRow[]>): void {
  console.log(
    JSON.stringify(
      outcome.kind === "unmeasured"
        ? { event: "market_set", seeds, kind: outcome.kind, reason: outcome.reason, rows: 0 }
        : { event: "market_set", seeds, kind: outcome.kind, rows: outcome.value.length }
    )
  );
}

/** The `market` section, composed from the profile that seeded it and the
 *  suggestions the vendor returned (ADR-095: the leaf that declares the
 *  shape owns its construction, so the scan pipeline composes no shape of
 *  its own and sums nothing). `totalVolume` is the measured market's own
 *  size; the owner removed its footnote from the free report on
 *  2026-09-03, so nothing renders it today — it stays in the blob because
 *  it is what `suggestions` measured, not because a surface reads it. */
export function marketSetOf(a: { profile: Profile; suggestions: readonly SuggestionRow[] }): MarketSet {
  let totalVolume = 0;
  for (const row of a.suggestions) totalVolume += row.volume;
  return { profile: a.profile, suggestions: a.suggestions, totalVolume };
}
