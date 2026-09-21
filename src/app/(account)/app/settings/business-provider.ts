// Issue #926 — the one read Settings › Your business makes.
//
// The shape `./provider.ts` sets for the rest of Settings: resolve the
// signed-in account, take the one fixture branch, otherwise read live.
//
// **A read of its own, not a member of `readSettings`.** Every one of the
// seven tabs calls `readSettings`, and this read is the expensive one — the
// site profile, the newest deep report's market section, the customer's
// corrections, and the grounding passages of every measured page. Folding
// it into the shared model would make Billing pay for it. `cache()` still
// makes it one read per request for the tab that does want it.
//
// **It reaches no language model.** The grounding passages are read from
// stored page text; the market reading is taken off the stored report blob.
// `MarketReading` is declared in `@/lib/site-profile/business/confirm`
// rather than imported from `@/lib/market/questions/profile` for exactly
// that reason — see that file's note, and the guard in
// `tests/app/overview/page.test.tsx` that the Overview was once broken by.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { confirmedProfile, quotableFacts } from "@/lib/site-profile/business/confirm";
import type { BusinessProfile, QuotableFact } from "@/lib/site-profile/business/types";

export interface BusinessModel {
  /** What the site is called, where the crawl read a name. The heading
   *  names the business, and says so in general terms where it has none. */
  readonly siteName: string | null;
  readonly profile: BusinessProfile;
  readonly facts: readonly QuotableFact[];
  /** Whether the customer has ever corrected anything. The screen's lead
   *  line differs: a first read is "learned from your site", and after an
   *  edit the same card is partly theirs. */
  readonly edited: boolean;
}

export const readBusiness = cache(async function readBusiness(): Promise<BusinessModel> {
  const account = await requireSetUpAccount();

  if (isReservedFixtureAccount(account)) {
    const { FIXTURE_BUSINESS_PROFILE, FIXTURE_MARKET_READING, FIXTURE_QUOTABLE } = await import(
      "./business-fixture"
    );
    const { NO_EDITS } = await import("@/lib/site-profile/business/types");
    return {
      siteName: FIXTURE_BUSINESS_PROFILE.siteName,
      profile: confirmedProfile({
        profile: FIXTURE_BUSINESS_PROFILE,
        market: FIXTURE_MARKET_READING,
        edits: NO_EDITS,
      }),
      facts: quotableFacts({ facts: FIXTURE_QUOTABLE, edits: NO_EDITS }),
      edited: false,
    };
  }

  const { readBusinessFacts } = await import("./business-store");
  const facts = await readBusinessFacts(account);
  return {
    siteName: facts.profile?.siteName ?? null,
    profile: confirmedProfile({
      profile: facts.profile,
      market: facts.market,
      edits: facts.edits,
    }),
    facts: quotableFacts({ facts: facts.quotable, edits: facts.edits }),
    edited: facts.edited,
  };
});
