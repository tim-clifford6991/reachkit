// Issue #926 — the one read Settings › Your business makes.
//
// The shape `./provider.ts` sets for the rest of Settings: resolve the
// signed-in account, take the one fixture branch, otherwise read live. The
// quotable passages are a second read, `readBusinessQuotable`, drawn in
// their own boundary.
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
import { knowledgeBase } from "@/lib/site-profile/knowledge/merge";
import type { FounderAnswers, KnowledgeBase } from "@/lib/site-profile/knowledge/types";

/** SPEC §7 (2026-09-20, #928) — "Content we already know about": how many
 *  pages this site has, per source. Three numbers and a total, because the
 *  three answer different questions for a reader: what we wrote, what is on
 *  their blog, and what the crawl read of their main site. */
export interface KnownContentCounts {
  readonly ours: number;
  /** `null` where no blog is connected, so it was never read: never shown as 0. */
  readonly wordpress: number | null;
  readonly site: number;
  readonly total: number;
}

export interface BusinessModel {
  readonly profile: BusinessProfile;
  /** Whether the customer has ever corrected anything. The screen's lead
   *  line differs: a first read is "learned from your site", and after an
   *  edit the same card is partly theirs. */
  readonly edited: boolean;
  /** #928's own card. Zeroes where the index has never been built — the
   *  card then says the site has nothing known yet rather than stating
   *  three zeroes as facts. */
  readonly known: KnownContentCounts;
  /** SPEC §0 (#1133): the knowledge base, the founder's answers in it. */
  readonly knowledge: KnowledgeBase;
  /** The five answers as stored, which the fields open on. */
  readonly answers: FounderAnswers;
}

export const readBusiness = cache(async function readBusiness(): Promise<BusinessModel> {
  const account = await requireSetUpAccount();

  if (isReservedFixtureAccount(account)) {
    const { FIXTURE_BUSINESS_PROFILE, FIXTURE_KNOWLEDGE, FIXTURE_MARKET_READING } = await import(
      "./business-fixture"
    );
    const { NO_EDITS } = await import("@/lib/site-profile/business/types");
    const profile = confirmedProfile({
      profile: FIXTURE_BUSINESS_PROFILE,
      market: FIXTURE_MARKET_READING,
      edits: NO_EDITS,
    });
    return {
      profile,
      edited: false,
      // The reserved account's own index: four pages we wrote, six posts on
      // its WordPress and the nine pages the crawl read.
      known: { ours: 4, wordpress: 6, site: 9, total: 19 },
      knowledge: knowledgeBase({ stored: FIXTURE_KNOWLEDGE, answers: {} }),
      answers: {},
    };
  }

  const { readBusinessFacts } = await import("./business-store");
  const [facts, known] = await Promise.all([readBusinessFacts(account), knownCountsFor(account.siteId)]);
  const profile = confirmedProfile({
    profile: facts.profile,
    market: facts.market,
    edits: facts.edits,
  });
  return {
    profile,
    known,
    edited: facts.edited,
    knowledge: knowledgeBase({ stored: facts.knowledge, answers: facts.edits.answers }),
    answers: facts.edits.answers,
  };
});

/** The facts card's own read: every passage parsed off the measured pages,
 *  the slowest read on the tab, so nothing else on it waits for this one. */
export const readBusinessQuotable = cache(async function readBusinessQuotable(): Promise<readonly QuotableFact[]> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) {
    const [{ FIXTURE_QUOTABLE }, { NO_EDITS }] = await Promise.all([
      import("./business-fixture"),
      import("@/lib/site-profile/business/types"),
    ]);
    return quotableFacts({ facts: FIXTURE_QUOTABLE, edits: NO_EDITS });
  }
  const { readQuotablePassages } = await import("./business-store");
  const { quotable, edits } = await readQuotablePassages(account);
  return quotableFacts({ facts: quotable, edits });
});

/** What a failed index read draws: nothing known yet, never a 0 for a blog not read. */
export const UNREAD_INDEX: KnownContentCounts = { ours: 0, wordpress: null, site: 0, total: 0 };

/** The three counts, off the index. */
async function knownCountsFor(siteId: string): Promise<KnownContentCounts> {
  try {
    const [{ knownContentFor }, { destinationOf }] = await Promise.all([
      import("@/lib/known-content"),
      import("@/lib/publish/destinations"),
    ]);
    const [pages, blog] = await Promise.all([knownContentFor(siteId), destinationOf(siteId, "wordpress")]);
    const counts = {
      ours: pages.filter((page) => page.source === "reachkit").length,
      // A blog is read only through its connection: with none, it was not read.
      wordpress: blog === null ? null : pages.filter((page) => page.source === "wordpress").length,
      site: pages.filter((page) => page.source === "site").length,
    };
    return { ...counts, total: pages.length };
  } catch {
    return UNREAD_INDEX;
  }
}
