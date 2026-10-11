// SPEC §1 (2026-10-10, issue 1396) — the live examples and the founder's
// line, read from stored rows at render.
//
// ReachKit is its own customer: its pages are published like any site's,
// and each carries the byline setup recorded. So the newest live page of
// ReachKit's own site is the real published page `/how-it-works` links to,
// and its byline is who `/about` says builds the product. That is the row
// the article itself prints (`drafts.attribution`), read the way the
// article reads it (`personOf`), so the two cannot name different people.
//
// **Nothing stored, nothing said.** A deployment with no such site, no live
// page, or a database that does not answer draws neither line.
import { PREVIEW_HOST_SUFFIX } from "@/lib/config/constants";
import { hostedHostOfSite, hostedSiteForDomain, livePagesForSite } from "@/lib/publish/destinations/hosted/store";
import { isListed } from "@/lib/scan/gallery";
import { personOf } from "@/app/(hosted)/hosted-page/[[...slug]]/seo";

/** ReachKit's own domain, the one its preview hosts hang off. */
const OWN_DOMAIN = PREVIEW_HOST_SUFFIX;

/** The report the owner named as the example (issue 1396). It is linked
 *  only while it is listed, so a removed report is never the example. */
const EXAMPLE_REPORT_DOMAIN = "podia.com";

export interface LiveExamples {
  /** A listed free report's domain, or `null`. */
  report: string | null;
  /** The newest live page of ReachKit's own site, or `null`. */
  page: { title: string; url: string } | null;
  /** Who that page's byline names, or `null` where it names no person. */
  founder: { name: string; place: string | null } | null;
}

const NONE: LiveExamples = Object.freeze({ report: null, page: null, founder: null });

async function ownNewestPage(): Promise<Pick<LiveExamples, "page" | "founder">> {
  const site = await hostedSiteForDomain(OWN_DOMAIN);
  if (site === null) return NONE;
  const host = (await hostedHostOfSite(site.siteId)) ?? site.host;
  const newest = (await livePagesForSite(site.siteId, host))[0];
  if (newest === undefined) return NONE;
  const byline = newest.byline === null ? null : personOf(newest.byline);
  return {
    page: { title: newest.title, url: newest.liveUrl },
    // A byline that is the business's own name is no person.
    founder:
      byline === null || byline.name === "" || byline.jobTitle === null
        ? null
        : { name: byline.name, place: byline.place },
  };
}

export async function readLiveExamples(): Promise<LiveExamples> {
  const [report, own] = await Promise.all([
    isListed(EXAMPLE_REPORT_DOMAIN).then((listed) => (listed ? EXAMPLE_REPORT_DOMAIN : null)).catch(() => null),
    ownNewestPage().catch(() => NONE),
  ]);
  return { report, page: own.page, founder: own.founder };
}
