// SPEC §5 and §7 (2026-09-20) · issues #926, #970 — the confirmed business
// profile, read and written in one place.
//
// **Why this file exists.** Two screens edit the same facts about a
// business: setup's step two, *what we learned about your business*, and
// Settings › Your business. Until #970 each had its own reading — setup's
// off `site_profiles` alone, held in the browser for the length of a setup
// and stored nowhere; Settings' off the same row with `site_profile_edits`
// over it. Two readings of one fact is two answers to "what does this
// business sell", and a correction made on one screen was invisible on the
// other. So the three reads behind that profile, and the one write that
// records a screen's final lists, live here and both screens go through
// them.
//
// **It decides nothing.** `./confirm.ts` applies the customer's decisions
// and is pure; `./edits.ts` moves the row. This file fetches the three
// readings those two need and composes them.
//
// **Each read fails soft, alone** — the shape Settings' own store already
// used: a site whose crawl has not run has no profile, one whose market has
// never been measured has no report, and a substrate that refuses one query
// must not blank the others. A screen states which parts have not been read
// rather than showing an error where a fact should be.
import type { SiteProfile } from "../types";
import type { FounderAnswers, StoredKnowledge } from "../knowledge/types";
import type { BusinessEdits, BusinessList } from "./types";
import type { MarketReading } from "./confirm";

/** The three readings the confirmed profile is made of. */
export interface ConfirmedReadings {
  readonly profile: SiteProfile | null;
  readonly market: MarketReading | null;
  readonly edits: BusinessEdits;
  /** What the pages were read to say (#1133); nothing where no read ran. */
  readonly knowledge: StoredKnowledge;
  /**
   * Whether the customer's decisions were actually read (#927).
   *
   * `edits` falls back to `NO_EDITS` when the read fails, which is right for
   * a **screen**: it draws the crawl's reading and the customer corrects it
   * again. It is not right for the **writer**, where "we could not read what
   * they removed" and "they removed nothing" are the difference between a
   * page that is generic and a page that names a service they deleted. So
   * the two states are distinguishable, and
   * `src/lib/generate/voice/confirmed.ts` is what acts on the difference.
   */
  readonly editsRead: boolean;
}

/** One read, or `null` where it could not be made. "Not read yet" and
 *  "could not be read" are the same answer on purpose: both mean *we have
 *  nothing to show you here*. */
async function soft<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** A string off the stored report blob, or `""`. Every field is read
 *  defensively: a blob written by an older pass may not carry one. */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A list of strings off the blob, with anything else dropped. */
function list(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/**
 * The market reading off a stored deep report.
 *
 * **Read off the blob rather than through the market module.** `report` is
 * stored JSON and its `market.profile` is the four fields #926 names;
 * reaching `@/lib/market/questions/profile` for its type would put the
 * language-model seam into the module graph of both screens that draw this
 * (`./confirm.ts` says why that matters).
 *
 * `market` is a `Measured<MarketSet>`, so the profile sits under `.value` —
 * and is absent on a pass that could not measure the market at all, which
 * is `null` here rather than a shape of empties.
 */
export function marketReadingOf(report: unknown): MarketReading | null {
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
 *  `../store.ts` documents for `site_profiles`: the generated `Database`
 *  type does not describe `scans.report` as anything this file can read,
 *  and a cast kept to four methods is smaller than one to the whole
 *  client. */
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
export async function newestDeepReport(siteId: string): Promise<unknown> {
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
  if (error !== null) throw new Error(`business profile: scans read failed: ${error.message}`);
  return data?.[0]?.report ?? null;
}

/**
 * The three readings behind one site's confirmed business profile.
 *
 * `domain` keys the crawl's reading (`site_profiles` is shared with free
 * scans of the same domain) and `siteId` keys the other two — which is the
 * whole reason the customer's decisions are a table of their own: one
 * account's corrections can never reach a stranger's report.
 */
export async function readConfirmedBusiness(a: {
  siteId: string;
  domain: string;
}): Promise<ConfirmedReadings> {
  const [profile, report, edits, knowledge] = await Promise.all([
    soft(async () => {
      const { readSiteProfile } = await import("../store");
      return a.domain === "" ? null : readSiteProfile(a.domain);
    }),
    soft(() => (a.siteId === "" ? Promise.resolve(null) : newestDeepReport(a.siteId))),
    soft(async () => {
      const { readBusinessEdits } = await import("./edits");
      return a.siteId === "" ? null : readBusinessEdits(a.siteId);
    }),
    soft(async () => {
      const { readStoredKnowledge } = await import("../knowledge/store");
      return a.domain === "" ? null : readStoredKnowledge(a.domain);
    }),
  ]);

  const { NO_EDITS } = await import("./types");
  const { NO_KNOWLEDGE } = await import("../knowledge/types");
  return {
    profile,
    market: marketReadingOf(report),
    edits: edits ?? NO_EDITS,
    knowledge: knowledge ?? NO_KNOWLEDGE,
    editsRead: edits !== null,
  };
}

/**
 * Records a screen's final lists as decisions over the derived reading.
 *
 * **Setup's step two hands over whole lists, and Settings hands over one
 * press at a time** — but the stored shape is the same either way, because
 * what is stored is never a list: it is what the customer took out and what
 * they put in. So the lists that arrive here are turned back into those two
 * decisions against the reading the screen was drawn from
 * (`editsForLists`), and every list this screen does not edit is carried
 * through untouched.
 *
 * Only the lists named are touched. A screen that shows five of the six
 * fields cannot silently clear the sixth. `job` is the same: absent, the
 * stored wording stands; present, it is *What you do* as the screen left
 * it (`editsForJob`).
 */
export async function saveChosenLists(a: {
  siteId: string;
  domain: string;
  chosen: Readonly<Partial<Record<BusinessList, readonly string[]>>>;
  job?: string;
  /** The five questions as the screen left them (#1133). Absent, the
   *  stored answers stand; present, an emptied field clears its answer. */
  answers?: FounderAnswers;
}): Promise<void> {
  const readings = await readConfirmedBusiness({ siteId: a.siteId, domain: a.domain });
  const { editsForJob, editsForLists, seenNow } = await import("./confirm");
  const { writeBusinessEdits } = await import("./edits");
  const lists = editsForLists({
    stored: readings.edits,
    profile: readings.profile,
    market: readings.market,
    chosen: a.chosen,
  });
  const worded =
    a.job === undefined ? lists : editsForJob({ stored: lists, market: readings.market, chosen: a.job });
  await writeBusinessEdits({
    siteId: a.siteId,
    edits: a.answers === undefined ? worded : { ...worded, answers: a.answers },
    seen: seenNow({ profile: readings.profile, market: readings.market }),
  });
}
