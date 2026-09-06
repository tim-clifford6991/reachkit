// BUILD §7, §6.3 — what a paid pass does with what it measured.
//
// One function, two tiers, and no third caller: the deep pass at
// onboarding pursues a month of depth out of the evidence it just bought
// (`pursueDepth`), and every weekly measurement adds what the week newly
// found (`topUp`). Both run inside the pass's own cost context, under the
// pass's own cap — §6.3 puts "Haiku ×~4 for opportunity typing" in the
// deep and weekly budgets and nowhere else — and both persist through the
// same partial unique index, so a re-derived target adds nothing.
//
// **This module reads the report and decides nothing.** The two inputs
// §7's winnability needs are projections of the blob and are taken here
// rather than in `derive/`, which must not know where a report comes
// from:
//
//   `ownRanked`     the customer's own ranked count. **Not a member of
//                   the blob** — `scans.drivers.searchPresence` is the
//                   0–100 sub-measure, not the count — so it is
//                   `undeterminable` here, which `ownRankedValue` reads
//                   as the cold-start 0. That is the conservative
//                   reading, not a convenient one: at 0 the bars are 500
//                   and 100, the tightest they go, so fewer targets
//                   qualify rather than more (`winnability/bars.ts`).
//   `rankedCounts`  `rankedCountsFromSizes` over `report.rivalSizes` —
//                   #37's sizing, projected. `unmeasured` (nothing sizes
//                   rivals yet, issue #140) yields an empty lookup, and
//                   an absent domain is `undeterminable`, never a zero
//                   that would satisfy every bar.
//
// Nothing here writes a sentence, reads a clock, or decides whether the
// customer has paid: `hasActiveAccess` is the caller's answer, exactly as
// `topUp`'s own header requires.
import type { CostContext } from "@/lib/costs";
import { unmeasured } from "@/lib/measure/measured";
import type { StoredReport } from "@/lib/scan/report";
import type { DeriveInput } from "./derive";
import { pursueDepth, type DepthStop } from "./supply/pursue";
import { topUp } from "./supply/topup";
import { rankedCountsFromSizes, type RankedCounts } from "./winnability/counts";

/** Which pass is asking. The free tier is absent by construction: §6.6
 *  keeps sizing and typing off the free path, and a free scan has no site
 *  to hold supply for. */
export type PassTier = "deep" | "weekly";

export type PassOutcome =
  | { tier: "deep"; created: number; unused: number; stop: DepthStop }
  | { tier: "weekly"; added: number; unused: number };

/** #37's sizing as winnability reads it. An `unmeasured` arm is an empty
 *  lookup and not an error: every top-ten domain then reads
 *  `undeterminable`, which is what "we have not sized this market" means
 *  and is counted as a rejection rather than guessed at. */
export function rankedCountsOf(report: StoredReport): RankedCounts {
  const at = report.verdict.measuredAt;
  if (report.rivalSizes.kind === "unmeasured") return rankedCountsFromSizes([], at);
  return rankedCountsFromSizes(report.rivalSizes.value, at);
}

function inputFor(a: { siteId: string; report: StoredReport }): DeriveInput {
  return {
    siteId: a.siteId,
    scanId: a.report.scanId,
    report: a.report,
    ownRanked: unmeasured<number>("undeterminable", a.report.verdict.measuredAt),
    rankedCounts: rankedCountsOf(a.report),
  };
}

/**
 * Derives and persists one pass's opportunities.
 *
 * The deep pass pursues depth: one derivation over everything the pass
 * measured, and then it stops — `pursueDepth` buys nothing beyond it, so
 * where the evidence runs out before a month of days does the answer is a
 * shorter calendar and a truthful line (§14's volume-follows-supply
 * guardrail). The weekly pass tops up: additive only, and nothing at all
 * where access has lapsed.
 */
export async function deriveForPass(
  c: CostContext,
  a: {
    tier: PassTier;
    siteId: string;
    report: StoredReport;
    /** ADR-050's gate, answered by the caller. Read by the weekly arm
     *  alone: onboarding's deep pass runs on a payment that has just
     *  cleared. */
    hasActiveAccess: boolean;
  }
): Promise<PassOutcome> {
  const input = inputFor({ siteId: a.siteId, report: a.report });

  if (a.tier === "deep") {
    const { created, unused, stop } = await pursueDepth(c, input);
    return { tier: "deep", created, unused, stop };
  }

  const { added, unused } = await topUp(c, { ...input, hasActiveAccess: a.hasActiveAccess });
  return { tier: "weekly", added, unused };
}
