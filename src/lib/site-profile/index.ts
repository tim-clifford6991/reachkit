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
// pass, in the background after setup is submitted, which is why setup
// usually shows no voice yet and invites one (issue 839) — and refresh
// every Monday with the weekly pass. A free re-scan after that
// never takes them away again: `writeSiteProfile` leaves a stored voice
// alone when the pass that calls it has none.
//
// This module never writes `sites.voice_text`. Seeding the customer's own
// field from the derived voice is `adoptVoiceText`'s, called where a site
// and its account are known; a scan has neither on the free path.
import type { Locale } from "@/lib/locale/locales";
import type { CostContext } from "@/lib/costs";
import type { Tier } from "@/lib/measure";
import { crawlSite, type CrawlOutcome } from "./crawl";
import { derivePurpose } from "./purpose";
import { brandName, imageAlts, publishedNames } from "./site-name";
import { deriveVoice } from "./summary";
import { writeSiteLogo, writeSiteProfile } from "./store";
import { captureLogo } from "./logo";
import type { InventoryRow, SiteProfile } from "./types";

export { readSiteProfile, writeSiteProfile, adoptVoiceText, saveVoiceText, saveWritingVoice, readSiteLogo } from "./store";
export { captureLogo, logoCandidates, sniffLogo, type SiteLogo } from "./logo";
export { deriveVoice, type SiteReading } from "./summary";
export { derivePurpose } from "./purpose";
export { brandName, publishedNames } from "./site-name";
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
export async function buildSiteProfile(c: CostContext, a: ProfileArgs): Promise<SiteProfile | null> {
  return (await buildSiteProfileWithCrawl(c, a)).profile;
}

interface ProfileArgs {
  domain: string;
  homeUrl: string;
  homeHtml: string | null;
  sitemaps: readonly string[];
  tier: Tier;
  /** The site's country and language (D66): what was read of the site is
   *  recorded in its own language. Absent is the United States in English. */
  locale?: Locale;
}

/**
 * `buildSiteProfile`, handing back the crawl it read as well — SPEC §9's
 * technical-issue checks run over exactly that set (2026-09-12), so the
 * scan reads the site once and both consumers share the one run.
 */
export async function buildSiteProfileWithCrawl(
  c: CostContext,
  a: ProfileArgs
): Promise<{ profile: SiteProfile | null; crawl: CrawlOutcome }> {
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
  if (crawl.pages.length === 0) return { profile: null, crawl };

  const inventory: readonly InventoryRow[] = crawl.pages.map((page) => ({
    url: page.url,
    title: page.title,
    h1: page.h1,
    purpose: derivePurpose({ url: page.url, title: page.title, h1: page.h1 }),
  }));

  // The name, read rather than asked for, so a free pass stores one too:
  // the home document — the caller's, or the one the crawl read, which is
  // how the free pass reads og:site_name (issue 609) — and otherwise the
  // home page's own title, which the crawl always has as row one.
  const published = [...publishedNames(a.homeHtml ?? ""), ...publishedNames(crawl.homeHtml ?? ""), crawl.pages[0]?.title];

  // The inference half, on the paid tiers only — see the header.
  const reading =
    a.tier === "free"
      ? null
      : await deriveVoice(c, { domain: a.domain, pages: crawl.pages, tier: a.tier, ...(a.locale === undefined ? {} : { locale: a.locale }) });
  const read = reading === null || reading.kind === "unmeasured" ? null : reading.value;

  const profile: SiteProfile = {
    domain: a.domain,
    // The model's reading of the name wins where it answered with one —
    // it has read the whole site, not one document — and the published
    // name is what every other pass stores. Either way it is the brand,
    // never a title's tagline (issue 1380).
    // Where it is the domain's label, it is cased as the site's logo and
    // titles case it (issue 1384).
    siteName: brandName([read?.siteName, ...published], a.domain, [
      ...imageAlts(a.homeHtml ?? ""),
      ...imageAlts(crawl.homeHtml ?? ""),
    ]),
    products: read?.products ?? [],
    claims: read?.claims ?? [],
    voice: read?.voice ?? null,
    inventory,
    pagesRead: inventory.length,
    refreshedAt: new Date(),
  };

  await writeSiteProfile(profile);

  // The site's own mark for the gallery and the landing's strip (#1069),
  // read off the same home document: 0¢ and inside `SITE_LOGO.BUDGET_MS`.
  // A logo that could not be stored is not the profile's failure.
  const homeHtml = a.homeHtml ?? crawl.homeHtml;
  if (homeHtml !== null && homeHtml !== "") {
    const logo = await captureLogo({ html: homeHtml, homeUrl: a.homeUrl });
    if (logo !== null) {
      await writeSiteLogo(a.domain, logo).catch((error: unknown) => {
        console.log(
          JSON.stringify({
            event: "site_logo_unstored",
            because: error instanceof Error ? error.message : String(error),
          })
        );
      });
    }
  }
  return { profile, crawl };
}
