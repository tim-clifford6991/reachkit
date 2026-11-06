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
import { untypedFetches, type FetchesRow } from "@/lib/costs/ledger";
import { dbAdmin } from "@/lib/db";
import { CAPS, INFERENCE_MAX_OUTPUT_TOKENS } from "@/lib/config/constants";
import { costCentsFor } from "@/lib/llm/tiers";

/** The cache-invalidation generation this engine's `recordFetch` reads are
 *  keyed against. Nothing in the product pins a "current generation policy"
 *  number, and no derivation change yet needs its cache aged out, so `1` is
 *  the first generation. Reversal cost: bump this one constant, which ages
 *  out every generation cache entry at once. It lives in exactly one file,
 *  which is what keeps it out of `constants.ts`. */
export const DRAFT_POLICY_VERSION = 1;

/** `draftId` where the draft already has a row (issue 1478): an edit, or a
 *  rewrite of the date's row. A new page names its row with `forDraft` once
 *  the pipeline has written it. */
export function withDraftCost<T>(
  a: { scanId: string; draftId?: string },
  body: (cost: CostContext) => Promise<T>
): Promise<T> {
  return withCostContext(
    {
      scanId: a.scanId,
      cap: "DRAFT",
      policyVersion: DRAFT_POLICY_VERSION,
      rollUp: "none",
      ...(a.draftId === undefined ? {} : { draftId: a.draftId }),
    },
    body
  );
}

/** The day's one `CAP_DRAFT` context, opened at what the site's drafts ledgered since the run's due hour, so a replayed
 *  attempt spends only what its date has left. A ledger it cannot read leaves it nothing: not measured is never 0. */
export async function openDayCost<T>(a: { scanId: string; siteId: string; since: Date }, body: (cost: CostContext) => Promise<T>): Promise<T> {
  const priorCents = await draftSpendSince(a.siteId, a.since).catch(() => null);
  if (priorCents === null) console.warn(JSON.stringify({ event: "draft_spend_unread", siteId: a.siteId }));
  return withCostContext({ scanId: a.scanId, cap: "DRAFT", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", priorCents: priorCents ?? CAPS.DRAFT_C }, body);
}

async function draftSpendSince(siteId: string, since: Date): Promise<number | null> {
  const { data, error } = await untypedFetches(dbAdmin()).from<Pick<FetchesRow, "cost_cents">>("fetches").select("cost_cents").eq("site_id", siteId).eq("activity", "draft").gte("created_at", since.toISOString());
  const total = (data ?? []).reduce((sum, row) => sum + Number(row.cost_cents), 0);
  return error !== null || data === null || !Number.isFinite(total) ? null : total;
}

/** The least a page's write and its one fix reserve: their output budgets on the writer's tier. */
const WRITE_AND_FIX_CENTS = costCentsFor("writer", 0, INFERENCE_MAX_OUTPUT_TOKENS["generate.write"] + INFERENCE_MAX_OUTPUT_TOKENS["generate.fix"]);

/** Whether the day's context can still pay for a page and its fix, so a second topic is never written unrepairable. */
export function roomForFix(cost: CostContext): boolean {
  return CAPS.DRAFT_C - cost.spentCents() >= WRITE_AND_FIX_CENTS;
}
