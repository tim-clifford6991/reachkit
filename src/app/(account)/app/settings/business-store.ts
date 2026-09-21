// Issue #926 — the four reads behind Settings › Your business.
//
// The derived reading (`site_profiles`, keyed by domain), the market reading
// (the newest deep report's own `market.profile`), the customer's
// corrections (`site_profile_edits`, keyed by site), and the passages a
// brief may quote (read live from measured page text). Nothing here decides
// anything: `@/lib/site-profile/business/confirm` applies the decisions, and
// this file fetches.
//
// **Each read fails soft, alone.** A site whose market has never been
// measured has no report; one whose crawl has not run has no profile; a
// substrate that refuses one query must not blank the other three. So each
// is caught on its own and answers `null`, and the screen states which parts
// have not been read rather than showing an error where a fact should be —
// the shape `./store.ts`'s `read()` already uses for the rest of Settings.
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

/** A string, or null. The stored report blob is JSON: every field is read
 *  defensively, because a blob written by an older pass may not carry one. */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A list of strings off the blob, with anything else dropped. */
function list(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/**
 * The market reading off the newest deep report.
 *
 * **Read off the blob rather than through the market module.** `report`
 * is stored JSON and its `market.profile` is the four fields #926 names;
 * reaching `@/lib/market/questions/profile` for its type would put the
 * language-model seam in this screen's module graph for the sake of an
 * interface that is four strings (`confirm.ts` says why that matters).
 *
 * `market` is a `Measured<MarketSet>`, so the profile sits under `.value`
 * — and is absent on a pass that could not measure the market at all,
 * which is a state this returns `null` for rather than a shape of empties.
 */
function marketReadingOf(report: unknown): MarketReading | null {
  if (report === null || typeof report !== "object") return null;
  const market = (report as { market?: unknown }).market;
  if (market === null || typeof market !== "object") return null;
  const value = (market as { value?: unknown }).value;
  if (value === null || typeof value !== "object") return null;
  const profile = (value as { profile?: unknown }).profile;
  if (profile === null || typeof profile !== "object") return null;
  const p = profile as Record<string, unknown>;
  const reading: MarketReading = {
    job: text(p.job),
    offeringType: text(p.offeringType),
    audienceTerms: list(p.audienceTerms),
    vocabulary: list(p.vocabulary),
  };
  // A profile with nothing in any of the four is not a reading.
  const empty =
    reading.job === "" &&
    reading.offeringType === "" &&
    reading.audienceTerms.length === 0 &&
    reading.vocabulary.length === 0;
  return empty ? null : reading;
}

/** The narrow slice of the service client this file uses. The same shape
 *  `@/lib/site-profile/store` documents for `site_profiles`: the generated
 *  `Database` type does not describe `scans.report` as anything this file
 *  can read, and a cast kept to four methods is smaller than one to the
 *  whole client. */
interface ScanQuery {
  select(columns: string): ScanQuery;
  eq(column: string, value: unknown): ScanQuery;
  not(column: string, operator: string, value: unknown): ScanQuery;
  order(column: string, options: { ascending: boolean }): ScanQuery;
  limit(n: number): PromiseLike<{
    data: { report: unknown }[] | null;
    error: { message: string } | null;
  }>;
}

/** The newest deep pass's stored report for this site, or `null`.
 *
 *  The same query `_overview/store.ts`'s `deepPassReading` makes, and for
 *  the same reason it makes it: a site re-measured by a second deep pass is
 *  shown the reading that stands. */
async function newestDeepReport(siteId: string): Promise<unknown> {
  const { dbAdmin } = await import("@/lib/db");
  const client = dbAdmin() as unknown as { from(table: string): ScanQuery };
  const { data, error } = await client
    .from("scans")
    .select("report")
    .eq("site_id", siteId)
    .eq("tier", "deep")
    .not("report", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error !== null) throw new Error(`business store: scans read failed: ${error.message}`);
  return data?.[0]?.report ?? null;
}

export async function readBusinessFacts(account: AppAccount): Promise<BusinessFacts> {
  const [profile, report, edits, quotable] = await Promise.all([
    soft(async () => {
      const { readSiteProfile } = await import("@/lib/site-profile/store");
      return readSiteProfile(account.domain);
    }),
    soft(() => newestDeepReport(account.siteId)),
    soft(async () => {
      const { readBusinessEdits } = await import("@/lib/site-profile/business/edits");
      return readBusinessEdits(account.siteId);
    }),
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

  const { NO_EDITS } = await import("@/lib/site-profile/business/types");
  const stored = edits ?? NO_EDITS;
  return {
    profile,
    market: marketReadingOf(report),
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
