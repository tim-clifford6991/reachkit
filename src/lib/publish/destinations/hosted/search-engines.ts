// The weekly pass's search-engine step for one site: ReachKit verifies every live hosted host in Google Search Console
// under its own account, with no customer step, and reads each page's way toward being found. Only Google is read.
// In order, once a week:
//
//   1. Every live hosted page the feed's hub never accepted is announced, once (`announceUnannounced`).
//   2. The host is verified (the meta method: the hosted index prints the
//      token stored on the destination) and its sitemap submitted. Each step
//      is stored as it lands, so a pass that stops half way resumes where it stopped.
//   3. Per page: URL Inspection, and impressions, clicks and best place by
//      query over `SEARCH_READING_WINDOW_D`.
//   4. One `search_reading` per live page, assembled by
//      `@/lib/measure/page-reading` from the newest stored report, the
//      reads counted on the page, and Google's reading.
//
// Without credentials steps 1 and 4 still run, so the ladder shows what ReachKit can prove. 0¢: every call is free.
// It never throws: a refusal or failed read stores its reason on each hosted page, logs it once per host, and the verdicts and mail still run.
import { SEARCH_READING_WINDOW_D, GSC_PROPERTIES_PER_ACCOUNT } from "@/lib/config/constants";
import { gscAccounts, gscClient, type GscAccount, type GscSend } from "@/lib/vendors/gsc";
import { assembleReading, engineReadingOf, pageSearchOf, readingOf, type GoogleReading, type GoogleUnread } from "@/lib/measure/page-reading";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { publishDb } from "../../db";
import { announceUnannounced, type AnnounceSend } from "./announce";

const DAY_MS = 86_400_000;

/** `destinations.search_verification`. */
export interface SearchVerification {
  google?: { account: string; token: string; verifiedAt?: string; sitemapAt?: string };
}

export interface SearchEngineDeps {
  accounts?: readonly GscAccount[];
  gscSend?: GscSend;
  announce?: AnnounceSend;
}

interface DestinationRow {
  id: string;
  hostname: string | null;
  hostname_state: string | null;
  search_verification: SearchVerification | null;
}

interface PageRow {
  id: string;
  live_url: string | null;
  destination: string | null;
  acceptance: unknown;
  search_reading: unknown;
  drafts: { opportunities: { acceptance: unknown; target_query: string | null } | null } | null;
}

interface ReadRow {
  publication_id: string;
  kind: string;
  hits: number;
}

function log(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

const day = (at: Date): string => at.toISOString().slice(0, 10);

/** The pool account a new host goes to: the first below the limit. */
async function pickAccount(accounts: readonly GscAccount[]): Promise<GscAccount | null> {
  const { data, error } = await publishDb()
    .from<{ search_verification: SearchVerification | null }>("destinations")
    .select("search_verification")
    .not("search_verification", "is", null);
  if (error !== null) return null;
  const held = new Map<string, number>();
  for (const row of data ?? []) {
    const account = row.search_verification?.google?.account;
    if (account !== undefined) held.set(account, (held.get(account) ?? 0) + 1);
  }
  return accounts.find((account) => (held.get(account.client_email) ?? 0) < GSC_PROPERTIES_PER_ACCOUNT) ?? null;
}

/** Each hosted page's Google reading, or the one reason the host was not read. */
async function readGoogle(a: {
  siteUrl: string;
  pages: readonly { url: string; search: string | null }[];
  now: Date;
  accounts: readonly GscAccount[];
  send?: GscSend;
  verification: SearchVerification;
  save: () => Promise<void>;
}): Promise<Map<string, GoogleReading> | GoogleUnread> {
  if (a.accounts.length === 0) return "no_credentials";
  let held = a.verification.google;
  let account = a.accounts.find((candidate) => candidate.client_email === held?.account) ?? null;
  if (held === undefined || account === null) {
    account = await pickAccount(a.accounts);
    if (account === null) return "pool_full";
    const token = await gscClient(account, a.send).metaToken(a.siteUrl);
    if (token === null) return "no_token";
    held = { account: account.client_email, token };
    a.verification.google = held;
    await a.save();
  }
  const client = gscClient(account, a.send);
  if (held.verifiedAt === undefined) {
    if (!(await client.verify(a.siteUrl))) return "verify_refused";
    held.verifiedAt = a.now.toISOString();
    await a.save();
  }
  if (held.sitemapAt === undefined) {
    if (!(await client.addWithSitemap(a.siteUrl, `${a.siteUrl}sitemap.xml`))) return "sitemap_refused";
    held.sitemapAt = a.now.toISOString();
    await a.save();
  }

  const rows = await client.performance(a.siteUrl, day(new Date(a.now.getTime() - SEARCH_READING_WINDOW_D * DAY_MS)), day(a.now));
  if (rows === null) return "performance_unread";
  const readings = new Map<string, GoogleReading>();
  for (const page of a.pages) readings.set(page.url, engineReadingOf(rows, page.url, page.search, await client.inspect(a.siteUrl, page.url)));
  return readings;
}

/** The weekly step for one site. Never throws. */
export async function readSearchEngines(a: { siteId: string; now: Date; deps?: SearchEngineDeps }): Promise<void> {
  const deps = a.deps ?? {};
  try {
    await announceUnannounced({ siteId: a.siteId, at: a.now, ...(deps.announce === undefined ? {} : { send: deps.announce }) });

    const db = publishDb();
    const { data: pageRows, error } = await db
      .from<PageRow>("publications")
      .select("id, live_url, destination, acceptance, search_reading, drafts(opportunities(acceptance, target_query))")
      .eq("site_id", a.siteId)
      .not("published_at", "is", null)
      .is("unpublished_at", null);
    if (error !== null) return;
    const pages = (pageRows ?? []).filter((row): row is PageRow & { live_url: string } => typeof row.live_url === "string");
    if (pages.length === 0) return;

    const { data: destinations } = await db
      .from<DestinationRow>("destinations")
      .select("id, hostname, hostname_state, search_verification")
      .eq("site_id", a.siteId)
      .eq("kind", "hosted")
      .is("deleted_at", null)
      .limit(1);
    const destination = destinations?.[0];
    const host = destination?.hostname_state === "live" ? (destination.hostname?.trim().toLowerCase() ?? null) : null;

    const searchOf = (page: PageRow): string | null =>
      pageSearchOf(page.acceptance ?? page.drafts?.opportunities?.acceptance, page.drafts?.opportunities?.target_query);
    // Every live hosted page ends the pass with a reading or the reason it has none.
    let google: Map<string, GoogleReading> | GoogleUnread = "not_in_property";
    const siteUrl = host === null || host === "" ? null : `https://${host}/`;
    if (destination !== undefined && siteUrl !== null) {
      const verification: SearchVerification = { ...(destination.search_verification ?? {}) };
      const save = async (): Promise<void> => {
        await db.from("destinations").update({ search_verification: verification }).eq("id", destination.id);
      };
      google = await readGoogle({
        siteUrl,
        pages: pages.filter((page) => page.live_url.startsWith(siteUrl)).map((page) => ({ url: page.live_url, search: searchOf(page) })),
        now: a.now,
        accounts: deps.accounts ?? gscAccounts(),
        ...(deps.gscSend === undefined ? {} : { send: deps.gscSend }),
        verification,
        save,
      }).catch((): GoogleUnread => "performance_unread");
    }
    const googleOf = (page: PageRow & { live_url: string }): GoogleReading | null => {
      if (page.destination !== "hosted") return null;
      if (typeof google === "string") return { unread: google };
      return google.get(page.live_url) ?? { unread: "not_in_property" };
    };
    const unread = new Map<string, number>();
    for (const page of pages) {
      const reason = googleOf(page)?.unread;
      if (reason !== undefined) unread.set(reason, (unread.get(reason) ?? 0) + 1);
    }
    for (const [reason, count] of unread) log("search_engine_unread", { reason, host, siteId: a.siteId, pages: count });
    if (typeof google !== "string") log("search_engine_read", { host, siteId: a.siteId, pages: google.size });

    const { data: scans } = await db
      .from<{ report: unknown }>("scans")
      .select("report")
      .eq("site_id", a.siteId)
      .not("report", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    let report: StoredReport | null = null;
    try {
      report = scans?.[0]?.report == null ? null : readStoredReport(scans[0].report);
    } catch {
      report = null;
    }

    const { data: reads, error: readsError } = await db
      .from<ReadRow>("publication_reads")
      .select("publication_id, kind, hits")
      .eq("site_id", a.siteId)
      // Bing's rows from before only Google counted stay on file, unread.
      .neq("engine", "bing");
    const hitsOf = (id: string, kinds: readonly string[]): number =>
      (reads ?? []).filter((row) => row.publication_id === id && kinds.includes(row.kind)).reduce((sum, row) => sum + row.hits, 0);

    for (const page of pages) {
      // Reads are counted on the pages ReachKit serves; elsewhere they are not measured.
      const counted = page.destination === "hosted" && readsError === null;
      const reading = assembleReading({
        before: readingOf(page.search_reading),
        report,
        page: {
          id: page.id,
          liveUrl: page.live_url,
          search: searchOf(page),
          crawled: hitsOf(page.id, ["crawl"]) > 0,
          aiReads: counted ? hitsOf(page.id, ["answer_fetch", "index_fetch"]) : null,
          aiVisits: counted ? hitsOf(page.id, ["referral"]) : null,
          google: googleOf(page),
        },
        now: a.now,
      });
      await db.from("publications").update({ search_reading: reading }).eq("id", page.id);
    }
  } catch (error) {
    log("search_engines_failed", { siteId: a.siteId, message: String(error) });
  }
}
