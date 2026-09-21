// Issue #926, #970 — the four reads behind Settings › Your business.
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
// **Each read fails soft, alone**, there and here: a site whose market has
// never been measured has no report; one whose crawl has not run has no
// profile; a substrate that refuses one query must not blank the other
// three. The screen states which parts have not been read rather than
// showing an error where a fact should be — the shape `./store.ts`'s
// `read()` already uses for the rest of Settings.
import type { AppAccount } from "../_session/account";
import type { SiteProfile } from "@/lib/site-profile/types";
import type { BusinessEdits } from "@/lib/site-profile/business/types";
import type { MarketReading } from "@/lib/site-profile/business/confirm";

export interface BusinessFacts {
  readonly profile: SiteProfile | null;
  readonly market: MarketReading | null;
  readonly edits: BusinessEdits;
  readonly quotable: readonly { readonly passage: string; readonly url: string }[];
  readonly edited: boolean;
}

/** One read, or `null` where it could not be made. The screen's "not read
 *  yet" arm and its "could not be read" arm are the same arm on purpose:
 *  both mean *we have nothing to show you here*, and a customer is owed the
 *  same sentence for both. */
async function soft<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

export async function readBusinessFacts(
  account: Pick<AppAccount, "siteId" | "domain">
): Promise<BusinessFacts> {
  const [readings, quotable] = await Promise.all([
    (async () => {
      const { readConfirmedBusiness } = await import("@/lib/site-profile/business/confirmed");
      return readConfirmedBusiness({ siteId: account.siteId, domain: account.domain });
    })(),
    soft(async () => {
      // The passages, in the order a brief meets them. No target search is
      // passed: this screen is about the business, not about one page, so
      // grounding's own page-by-page order is the right one.
      const { readAllFacts } = await import("@/lib/generate/pipeline/grounding");
      const facts = await readAllFacts({ siteId: account.siteId });
      return facts.map((sourced) => ({
        passage: sourced.fact.passage,
        url: sourced.fact.url,
      }));
    }),
  ]);

  const stored = readings.edits;
  return {
    profile: readings.profile,
    market: readings.market,
    edits: stored,
    quotable: quotable ?? [],
    // Whether they have ever corrected anything — any decision at all,
    // including a fact switched off.
    edited:
      stored.job !== null ||
      stored.factsOff.length > 0 ||
      Object.values(stored.removed).some((entry) => (entry ?? []).length > 0) ||
      Object.values(stored.added).some((entry) => (entry ?? []).length > 0),
  };
}
