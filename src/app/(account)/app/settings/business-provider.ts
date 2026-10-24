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
import { knowledgeBase } from "@/lib/site-profile/knowledge/merge";
import type { FounderAnswers, KnowledgeBase } from "@/lib/site-profile/knowledge/types";
import { DEFAULT_LOCALE, localeTag } from "@/lib/locale/locales";
import { showsOnAPage, type LivePage, type OnAPage } from "./on-a-page";

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
  /** What the site is called, where the crawl read a name. The heading
   *  names the business, and says so in general terms where it has none. */
  readonly siteName: string | null;
  readonly profile: BusinessProfile;
  readonly facts: readonly QuotableFact[];
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
  /** "How it shows on a page", or `null` where no live page uses a promise or word. */
  readonly onAPage: OnAPage | null;
}

export const readBusiness = cache(async function readBusiness(): Promise<BusinessModel> {
  const account = await requireSetUpAccount();

  if (isReservedFixtureAccount(account)) {
    const { FIXTURE_BUSINESS_PROFILE, FIXTURE_KNOWLEDGE, FIXTURE_LIVE_PAGES, FIXTURE_MARKET_READING, FIXTURE_QUOTABLE } =
      await import("./business-fixture");
    const { NO_EDITS } = await import("@/lib/site-profile/business/types");
    const profile = confirmedProfile({
      profile: FIXTURE_BUSINESS_PROFILE,
      market: FIXTURE_MARKET_READING,
      edits: NO_EDITS,
    });
    return {
      siteName: FIXTURE_BUSINESS_PROFILE.siteName,
      profile,
      facts: quotableFacts({ facts: FIXTURE_QUOTABLE, edits: NO_EDITS }),
      edited: false,
      // The reserved account's own index: four pages we wrote, six posts on
      // its WordPress and the nine pages the crawl read.
      known: { ours: 4, wordpress: 6, site: 9, total: 19 },
      knowledge: knowledgeBase({ stored: FIXTURE_KNOWLEDGE, answers: {} }),
      answers: {},
      onAPage: onAPageOf(profile, FIXTURE_LIVE_PAGES, localeTag(DEFAULT_LOCALE)),
    };
  }

  const { readBusinessFacts } = await import("./business-store");
  const [facts, known, live] = await Promise.all([
    readBusinessFacts(account),
    knownCountsFor(account.siteId),
    liveBodiesOf(account.siteId),
  ]);
  const profile = confirmedProfile({
    profile: facts.profile,
    market: facts.market,
    edits: facts.edits,
  });
  return {
    siteName: facts.profile?.siteName ?? null,
    profile,
    facts: quotableFacts({ facts: facts.quotable, edits: facts.edits }),
    known,
    edited: facts.edited,
    knowledge: knowledgeBase({ stored: facts.knowledge, answers: facts.edits.answers }),
    answers: facts.edits.answers,
    onAPage: live === null ? null : onAPageOf(profile, live.pages, live.lang),
  };
});

function onAPageOf(profile: BusinessProfile, pages: readonly LivePage[], lang: string): OnAPage | null {
  return showsOnAPage({
    pages,
    claims: profile.lists.claims.map((item) => item.text),
    vocabulary: profile.lists.vocabulary.map((item) => item.text),
    lang,
  });
}

/** The site's live pages and the language they are written in; `null` where
 *  they could not be read, so the block is not drawn. */
async function liveBodiesOf(siteId: string): Promise<{ pages: LivePage[]; lang: string } | null> {
  try {
    const [{ readOurLiveBodies }, { siteLocale }] = await Promise.all([
      import("@/lib/known-content/store"),
      import("@/lib/locale/site"),
    ]);
    const [pages, locale] = await Promise.all([readOurLiveBodies(siteId), siteLocale(siteId)]);
    return { pages, lang: localeTag(locale) };
  } catch {
    return null;
  }
}

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
