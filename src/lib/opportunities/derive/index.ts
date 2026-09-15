// BUILD §7 — the derivation, end to end.
//
// Order, and there is no other: derive deterministically (Write, Improve,
// Earn, Fix), keeping one candidate per search → qualify and band (already
// applied inside each family module, over the same top tens) → label through
// the model → persist. **Nothing after
// the derivation step may add a candidate.** The model runs after
// qualification so that no candidate it touches is one measured evidence
// did not produce, and persistence runs last so that de-duplication is the
// index's.
//
// Returning `created: []` is a normal return with counts, never an error
// and never a throw: empty is a success state (§2.5), and the three
// rejection counters are what let §4.6's "supply ran out" day line be told
// apart from "we could not read this market".
//
// The engine spends nothing here beyond the rows the scan already bought:
// winnability reads counts already in `fetches`, and the only model call is
// `opportunity-typing`, inside the pass's own cap.
import type { CostContext } from "@/lib/costs";
import type { Measured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import type { RankedCounts } from "../winnability/counts";
import { addRejections, noRejections, type Opportunity, type RejectionCount } from "../types";
import type { Candidate } from "./candidate";
import { earnCandidates } from "./earn";
import { fixCandidates } from "./fix";
import { improveCandidates } from "./improve";
import { persist } from "./persist";
import { refineType } from "./typing";
import { writeCandidates } from "./write";

export interface DeriveInput {
  siteId: string;
  scanId: string;
  report: StoredReport;
  /** The customer's own measured ranked count. `unmeasured` reads as the
   *  cold-start 0 — which is the honest reading: the bars are then 500 and
   *  100, both positive, so every band stays assignable and the winnable
   *  set stays non-empty for a domain that ranks for nothing. Reading it
   *  as a large number instead would silently widen the bars for exactly
   *  the customers the product exists to serve. */
  ownRanked: Measured<number>;
  /** One ranked count per domain the deep pass sized — issue #37's
   *  `RivalSize[]`, projected by `rankedCountsFromSizes`. It stays a
   *  parameter now that `rivalSizes` is a member of `StoredReport`
   *  (issue #126, DECISIONS 2026-09-06): the projection is the caller's
   *  — `rankedCountsOf` in `../pass.ts` — so this directory reads a
   *  lookup and never the blob's sizing arm, and a suite can hand it a
   *  market of any shape without assembling a report for it. A missing
   *  entry is `undeterminable` and never a zero — see
   *  `winnability/counts.ts`. */
  rankedCounts: RankedCounts;
  /** The host the site's hosted destination serves at, whose pages get no
   *  `fix_page` (SPEC §9, 2026-09-14). Absent where the caller has none. */
  hostedHost?: string | null;
}

export interface DeriveOutcome {
  created: Opportunity[];
  /** Targets looked at, whether or not they became opportunities. */
  assessed: number;
  rejected: RejectionCount;
}

export function ownRankedValue(ownRanked: Measured<number>): number {
  return ownRanked.kind === "unmeasured" ? 0 : ownRanked.value;
}

/** SPEC §6: "Improve of an owned URL outranks a new page", and an Earn
 *  asset outranks a plain Write for the same search (issue 474's order).
 *  Handed candidates in that precedence, it keeps the first for each search,
 *  so one search never plans two pages. Pure. */
export function onePerSearch(ordered: readonly Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return ordered.filter((candidate) => {
    const key = candidate.targetQuery?.trim().toLowerCase();
    if (key === undefined || key === "") return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function deriveOpportunities(
  c: CostContext,
  a: DeriveInput
): Promise<DeriveOutcome> {
  const ownRanked = ownRankedValue(a.ownRanked);
  const base = { siteId: a.siteId, scanId: a.scanId, report: a.report };

  const write = writeCandidates({ ...base, ownRanked, rankedCounts: a.rankedCounts });
  const improve = improveCandidates({ ...base, ownRanked, rankedCounts: a.rankedCounts });
  const earn = earnCandidates({ ...base, ownRanked, rankedCounts: a.rankedCounts });
  const fix = fixCandidates({ ...base, hostedHost: a.hostedHost ?? null });

  const rejected = [write, improve, earn, fix]
    .map((result) => result.rejected)
    .reduce(addRejections, noRejections());
  const assessed = write.assessed + improve.assessed + earn.assessed + fix.assessed;

  const derived: Candidate[] = [
    ...onePerSearch([...improve.candidates, ...earn.candidates, ...write.candidates]),
    ...fix.candidates,
  ];
  const labelled: Candidate[] = [];
  for (const candidate of derived) {
    // Sequential, not `Promise.all`: the cost seam's cap is re-checked
    // between calls, and a parallel fan-out would issue every call before
    // the first settled against it.
    labelled.push(await refineType(c, candidate));
  }

  const { created, duplicates } = await persist({ candidates: labelled });
  return {
    created,
    assessed,
    rejected: { ...rejected, duplicate_open: rejected.duplicate_open + duplicates },
  };
}
