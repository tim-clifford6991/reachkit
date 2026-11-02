// Issue #926, #970 — the reads behind Settings › Your business.
//
// Three of them are not this screen's: the derived reading
// (`site_profiles`, keyed by domain), the market reading (the newest deep
// report's own `market.profile`) and the customer's corrections
// (`site_profile_edits`, keyed by site) are the confirmed business profile
// itself, and since #970 they are read by
// `@/lib/site-profile/business/confirmed` for **both** screens that edit
// it — this one and setup's step two. What is added here is the fourth: the
// passages a brief may quote, which only this screen offers switches for.
//
// Nothing here decides anything: `../../../lib/site-profile/business/confirm`
// applies the decisions, and this file fetches.
//
// **Each read fails alone**: a site whose market has never been measured
// has no report; one whose crawl has not run has no profile; and the
// passages are their own panel read, so a slow parse blanks only their card.
import type { AppAccount } from "../_session/account";
import type { SiteProfile } from "@/lib/site-profile/types";
import type { BusinessEdits } from "@/lib/site-profile/business/types";
import type { MarketReading } from "@/lib/site-profile/business/confirm";
import type { StoredKnowledge } from "@/lib/site-profile/knowledge/types";

export interface BusinessFacts {
  readonly profile: SiteProfile | null;
  readonly market: MarketReading | null;
  readonly edits: BusinessEdits;
  readonly knowledge: StoredKnowledge;
  readonly edited: boolean;
}

export async function readBusinessFacts(
  account: Pick<AppAccount, "siteId" | "domain">
): Promise<BusinessFacts> {
  const { readConfirmedBusiness } = await import("@/lib/site-profile/business/confirmed");
  const readings = await readConfirmedBusiness({ siteId: account.siteId, domain: account.domain });

  const stored = readings.edits;
  return {
    profile: readings.profile,
    market: readings.market,
    edits: stored,
    knowledge: readings.knowledge,
    // Whether they have ever corrected anything — any decision at all,
    // including a fact switched off.
    edited:
      stored.job !== null ||
      stored.factsOff.length > 0 ||
      Object.keys(stored.answers).length > 0 ||
      Object.values(stored.removed).some((entry) => (entry ?? []).length > 0) ||
      Object.values(stored.added).some((entry) => (entry ?? []).length > 0),
  };
}

/**
 * The passages a brief may quote, in the order a brief meets them, with the
 * customer's refusals beside them. Its own read because it parses every
 * measured page and is the slow one: the rest of the tab never waits on it.
 *
 * `readAllFacts`, the base read, and this is the one surface in the product
 * that wants it. Every path that *writes* a page goes through
 * `readAllowedFacts`, which subtracts the customer's refusals (#927); this
 * screen offers the switch, so it has to see a refused passage in order to
 * offer it back. No target search is passed: this screen is about the
 * business, not one page.
 */
export async function readQuotablePassages(account: Pick<AppAccount, "siteId">): Promise<{
  readonly quotable: readonly { readonly passage: string; readonly url: string }[];
  readonly edits: BusinessEdits;
}> {
  const [{ readAllFacts }, { readBusinessEdits }] = await Promise.all([
    import("@/lib/generate/pipeline/grounding"),
    import("@/lib/site-profile/business/edits"),
  ]);
  const [facts, edits] = await Promise.all([readAllFacts({ siteId: account.siteId }), readBusinessEdits(account.siteId)]);
  return { quotable: facts.map((sourced) => ({ passage: sourced.fact.passage, url: sourced.fact.url })), edits };
}
