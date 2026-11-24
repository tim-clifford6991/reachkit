// A draft's `CAP_DRAFT` contexts. Its calls are ledgered against the scan that grounds the page, since `fetches.scan_id`
// is `not null`, with the roll-up off: the draft's cost is `drafts.cost_cents`, and on the scan it would overstate the scan.
import { withCostContext, type CostContext } from "@/lib/costs";
import { untypedFetches, type FetchesRow } from "@/lib/costs/ledger";
import { dbAdmin } from "@/lib/db";
import { CAPS, INFERENCE_MAX_OUTPUT_TOKENS } from "@/lib/config/constants";
import { costCentsFor } from "@/lib/llm/tiers";
import { testSpend } from "./test-draft";

/** The generation this engine's cached reads are keyed against: bumping it ages out every generation cache entry at once. */
export const DRAFT_POLICY_VERSION = 1;

/** `draftId` where the draft already has a row: an edit, or a rewrite of the date's row. A new page names its row with `forDraft`. */
export function withDraftCost<T>(a: { scanId: string; draftId?: string }, body: (cost: CostContext) => Promise<T>): Promise<T> {
  return withCostContext({ scanId: a.scanId, cap: "DRAFT", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", ...(a.draftId === undefined ? {} : { draftId: a.draftId }) }, body);
}

/** The day's one `CAP_DRAFT` context, opened at what the site's drafts ledgered since the run's due hour, so a replayed
 *  attempt spends only what its date has left. A ledger it cannot read leaves it nothing: not measured is never 0.
 *  A test draft's opens at its own spend alone, since tests sent together share the site's ledger. */
export async function openDayCost<T>(a: { scanId: string; siteId: string; since: Date }, body: (cost: CostContext) => Promise<T>): Promise<T> {
  const test = testSpend();
  const priorCents = test !== undefined ? test.cents : await draftSpendSince(a.siteId, a.since).catch(() => null);
  if (priorCents === null) console.warn(JSON.stringify({ event: "draft_spend_unread", siteId: a.siteId }));
  const prior = priorCents ?? CAPS.DRAFT_C;
  return withCostContext({ scanId: a.scanId, cap: "DRAFT", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none", priorCents: prior }, (cost) => (test === undefined ? body(cost) : body(cost).finally(() => void (test.cents += cost.spentCents() - prior))));
}

export async function draftSpendSince(siteId: string, since: Date): Promise<number | null> {
  const { data, error } = await untypedFetches(dbAdmin()).from<Pick<FetchesRow, "cost_cents">>("fetches").select("cost_cents").eq("site_id", siteId).eq("activity", "draft").gte("created_at", since.toISOString());
  const total = (data ?? []).reduce((sum, row) => sum + Number(row.cost_cents), 0);
  return error !== null || data === null || !Number.isFinite(total) ? null : total;
}

/** The least a page's write and its one fix reserve: their output budgets on the writer's tier. */
const WRITE_AND_FIX_CENTS = costCentsFor("writer", 0, INFERENCE_MAX_OUTPUT_TOKENS["generate.write"] + INFERENCE_MAX_OUTPUT_TOKENS["generate.fix"]);

/** Whether the day's context can still pay for a page and its fix, so a second topic is never written unrepairable. */
export function roomForFix(cost: Pick<CostContext, "spentCents">): boolean {
  return CAPS.DRAFT_C - cost.spentCents() >= WRITE_AND_FIX_CENTS;
}
