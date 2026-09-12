// SPEC.md §2 Rules ("The scan builds the site profile") · §5 Rules ("The
// site profile is confirmed here") · §12 ruling 8 (2026-09-12).
//
// The profile's one order of calls: crawl the site, give every page it
// read a purpose, read the site's name, products, claims and voice off
// those pages, and store the lot under the domain.
//
// **One run per scan** (§2's "Bounded: 100 pages, one run per scan"):
// `src/lib/scan/run.ts` calls this once, inside the stage that already
// read the site, at every tier. The weekly pass is that same pipeline, so
// "refreshed on the weekly pass" needs no second scheduler and no second
// door — it is the same call, under the weekly cap.
//
// **Two degraded arms, both honest.** A crawl that read nothing stores
// nothing and answers `null`: an empty inventory written over a good one
// would delete a real reading. A voice call that did not come back still
// stores the profile with `voice: null` — the inventory is what
// cross-linking needs (§7, 2026-09-12), and it was measured.
//
// **The free pass crawls; it does not infer.** Ruling 8 puts the profile
// in the free scan and the crawl, the purposes, the inventory and the site
// name are all there. The voice summary, the products and the claims are
// the half that needs a model call, and the free pass has no room for a
// third one: two nano calls already hold half the invocation the platform
// allows it (`FREE_PASS_INFERENCE_CALLS`, and `tests/llm/budget.test.ts`
// is that arithmetic). So they derive on the first paid pass — the deep
// pass runs at setup, before the onboarding market step renders its card —
// and refresh every Monday with the weekly pass. A free re-scan after that
// never takes them away again: `writeSiteProfile` leaves a stored voice
// alone when the pass that calls it has none.
//
// This module never writes `sites.voice_text`. Seeding the customer's own
// field from the derived voice is `adoptVoiceText`'s, called where a site
// and its account are known; a scan has neither on the free path.
import type { CostContext } from "@/lib/costs";
import type { Tier } from "@/lib/measure";
import { crawlSite } from "./crawl";
import { derivePurpose } from "./purpose";
import { siteNameFromTitle, siteNameOf } from "./site-name";
import { deriveVoice } from "./summary";
import { writeSiteProfile } from "./store";
import type { InventoryRow, SiteProfile } from "./types";

export { readSiteProfile, writeSiteProfile, adoptVoiceText, saveVoiceText } from "./store";
export { deriveVoice, type SiteReading } from "./summary";
export { derivePurpose } from "./purpose";
export { siteNameFromTitle, siteNameOf } from "./site-name";
export { crawlSite, type CrawledPage, type CrawlOutcome } from "./crawl";
export {
  PAGE_PURPOSES,
  purposeCounts,
  type InventoryRow,
  type PagePurpose,
  type SiteProfile,
  type VoiceSummary,
} from "./types";

/**
 * Builds one site's profile and stores it, or answers `null` where there
 * was nothing to store.
 *
 * `homeHtml` is the home document the measurement already read, handed
 * over rather than re-fetched — §2's cap is on what the scan reads, and a
 * second read of a document in hand spends a page of it for nothing. Where
 * the caller does not hold it (`null`), the crawl reads the home page
 * itself through its own ledgered, cached fetch.
 */
export async function buildSiteProfile(
  c: CostContext,
  a: {
    domain: string;
    homeUrl: string;
    homeHtml: string | null;
    sitemaps: readonly string[];
    tier: Tier;
  }
): Promise<SiteProfile | null> {
  const crawl = await crawlSite(c, {
    domain: a.domain,
    homeUrl: a.homeUrl,
    homeHtml: a.homeHtml ?? "",
    sitemaps: a.sitemaps,
  });

  // Nothing read is nothing stored. Not an empty profile: an inventory of
  // zero pages written over last week's hundred would be this module
  // deleting a measurement, and §2's "records what it has" is about a
  // small site, never about a failed crawl.
  if (crawl.pages.length === 0) return null;

  const inventory: readonly InventoryRow[] = crawl.pages.map((page) => ({
    url: page.url,
    title: page.title,
    h1: page.h1,
    purpose: derivePurpose({ url: page.url, title: page.title, h1: page.h1 }),
  }));

  // The name, read rather than asked for, so a free pass stores one too:
  // the home document where the caller holds it, and otherwise the home
  // page's own title, which the crawl always has as row one.
  const published =
    siteNameOf(a.homeHtml ?? "") ?? siteNameFromTitle(crawl.pages[0]?.title ?? "");

  // The inference half, on the paid tiers only — see the header.
  const reading =
    a.tier === "free"
      ? null
      : await deriveVoice(c, { domain: a.domain, pages: crawl.pages, tier: a.tier });
  const read = reading === null || reading.kind === "unmeasured" ? null : reading.value;

  const profile: SiteProfile = {
    domain: a.domain,
    // The model's reading of the name wins where it answered with one —
    // it has read the whole site, not one document — and the published
    // name is what every other pass stores.
    siteName: read?.siteName ?? published,
    products: read?.products ?? [],
    claims: read?.claims ?? [],
    voice: read?.voice ?? null,
    inventory,
    pagesRead: inventory.length,
    refreshedAt: new Date(),
  };

  await writeSiteProfile(profile);
  return profile;
}
