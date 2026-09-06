// BUILD §8 — "`CAP_DRAFT` enforced before the pipeline runs."
//
// One cost context per day's page, opened here and nowhere else in this
// engine. Two things it settles, and both are §8's own words:
//
//   * **The cap is `CAP_DRAFT` (45¢).** One day of content costs about
//     6.5¢ — nano brief, nano outline, Haiku draft, Haiku answerability
//     pass, nano claim check — so 45¢ is enforced headroom, not a budget to
//     spend. It is read before the first call and re-read between steps.
//   * **The spend is ledgered against the scan that grounds the page.**
//     `fetches.scan_id` is `not null` and a draft has no scan of its own,
//     so the freshest scan — the one §8 says the day's page is generated
//     from — is the row every ledger entry is keyed to. The roll-up is
//     turned off: the *draft's* cost belongs on the draft
//     (`drafts.cost_cents`), and writing it onto the scan would overstate
//     what the scan cost and flip a degraded scan back to done.
import { withCostContext, type CostContext } from "@/lib/costs";

/** The cache-invalidation generation this engine's `recordFetch` reads are
 *  keyed against. Nothing in the product pins a "current generation policy"
 *  number, and no derivation change yet needs its cache aged out, so `1` is
 *  the first generation. Reversal cost: bump this one constant, which ages
 *  out every generation cache entry at once. It lives in exactly one file,
 *  which is what keeps it out of `constants.ts`. */
export const DRAFT_POLICY_VERSION = 1;

export function withDraftCost<T>(
  a: { scanId: string },
  body: (cost: CostContext) => Promise<T>
): Promise<T> {
  return withCostContext(
    { scanId: a.scanId, cap: "DRAFT", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none" },
    body
  );
}
