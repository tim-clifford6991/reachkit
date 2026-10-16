// src/lib/business/read.ts — the stored rows `understandBusiness` reads for
// a paying site (issue 1454): its own newest pass, its crawl's name, its
// market and the customer's own edits. Each read that fails is read as
// nothing, so the understanding says less rather than the screen failing.
//
// The pass is read by the site's id, as Overview's other stores read
// theirs: one select through the client imported here, never the domain's
// current free report, which is the address's to read.
import { dbAdmin } from "@/lib/db";
import { DEFAULT_LOCALE } from "@/lib/locale/locales";
import { localeOfReport, readStoredReport, type StoredReport } from "@/lib/scan/report";
import { profileOfReport, understandBusiness, type BusinessUnderstanding } from "./understanding";

interface Result<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface Query<T> extends PromiseLike<Result<T>> {
  select(columns: string): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  not(column: string, operator: string, value: unknown): Query<T>;
  order(column: string, opts: { ascending: boolean }): Query<T>;
  limit(count: number): Query<T>;
}

/** The site's newest pass that stored a report, or `null`. */
async function newestPass(siteId: string): Promise<StoredReport | null> {
  const { data, error } = await (dbAdmin() as unknown as { from<R>(table: string): Query<R> })
    .from<{ report: unknown }>("scans")
    .select("report")
    .eq("site_id", siteId)
    .not("report", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error !== null) throw new Error(`readBusinessUnderstanding: ${error.message}`);
  const report = data?.[0]?.report;
  return report == null ? null : readStoredReport(report);
}

export async function readBusinessUnderstanding(a: { siteId: string; domain: string }): Promise<BusinessUnderstanding> {
  const [{ readSiteProfile }, { readSiteMarket }, { readBusinessEdits }] = await Promise.all([
    import("@/lib/site-profile"),
    import("@/lib/market/infer/stored"),
    import("@/lib/site-profile/business/edits"),
  ]);
  const quietly = <T,>(read: Promise<T>): Promise<T | null> => read.catch(() => null);
  const [report, site, market, edits] = await Promise.all([
    quietly(newestPass(a.siteId)),
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
