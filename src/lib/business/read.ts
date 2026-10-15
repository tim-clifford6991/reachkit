// src/lib/business/read.ts — the stored rows `understandBusiness` reads for
// a paying site (issue 1454): its latest report, its crawl's name, its
// market and the customer's own edits. Each read that fails is read as
// nothing, so the understanding says less rather than the screen failing.
import { DEFAULT_LOCALE } from "@/lib/locale/locales";
import { profileOfReport, understandBusiness, type BusinessUnderstanding } from "./understanding";

export async function readBusinessUnderstanding(a: { siteId: string; domain: string }): Promise<BusinessUnderstanding> {
  const [{ readCurrentReport, localeOfReport }, { readSiteProfile }, { readSiteMarket }, { readBusinessEdits }] = await Promise.all([
    import("@/lib/scan/report"),
    import("@/lib/site-profile"),
    import("@/lib/market/infer/stored"),
    import("@/lib/site-profile/business/edits"),
  ]);
  const quietly = <T,>(read: Promise<T>): Promise<T | null> => read.catch(() => null);
  const [report, site, market, edits] = await Promise.all([
    quietly(readCurrentReport(a.domain)),
    quietly(readSiteProfile(a.domain)),
    quietly(readSiteMarket(a.siteId)),
    quietly(readBusinessEdits(a.siteId)),
  ]);
  return understandBusiness({
    domain: a.domain,
    storedName: site?.siteName ?? null,
    profile: profileOfReport(report),
    locale: report === null ? DEFAULT_LOCALE : localeOfReport(report),
    market: market?.stored ?? null,
    category: market?.category ?? null,
    edits:
      edits === null
        ? null
        : { job: edits.job, added: edits.added, removed: edits.removed, buyers: edits.answers.buyers ?? null },
  });
}
