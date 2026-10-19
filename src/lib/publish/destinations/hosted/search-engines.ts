// Issue 1553 — the weekly pass's search-engine step, for one site.
//
// The SEO metrics review of 2026-10-19 (R2, owner: "approved for all"):
// ReachKit verifies every live hosted host in Google Search Console and
// Bing Webmaster Tools under its own account, with no customer step, and
// reads each page's way toward being found. In order, once a week:
//
//   1. Every live hosted page IndexNow never accepted is announced, once
//      (`announceUnannounced`): the pages published before issue 1511.
//   2. The host is verified (the meta method: the hosted index prints the
//      token stored on the destination) and its sitemap submitted, in
//      Google and in Bing. Each step is stored as it lands, so a pass that
//      stops half way resumes where it stopped.
//   3. Per page: URL Inspection, and impressions, clicks and best place by
//      query over `SEARCH_READING_WINDOW_D`; Bing's impressions, clicks,
//      best place and last crawl.
//   4. Per page, from rows ReachKit already stored: a verified crawler hit,
//      issue 1538's `seen`, and whether an AI answer to the page's own
//      question cited it.
//   5. One `search_reading` per live page.
//
// **Inert without credentials.** With neither binding the pass asks no
// engine and still writes steps 1, 4 and 5, so the ladder shows what
// ReachKit can prove. 0¢: every call is free, and nothing is bought.
//
// **Never in the way.** It never throws: a refusal or a failed read leaves
// that engine's reading out this week, and the verdicts and mail run after
// it as they did before.
import { SEARCH_READING_WINDOW_D, GSC_PROPERTIES_PER_ACCOUNT } from "@/lib/config/constants";
import { gscAccounts, gscClient, type GscAccount, type GscSend } from "@/lib/vendors/gsc";
import { bingClient, type BingClient } from "@/lib/vendors/bing-wmt";
import { addressOf } from "@/lib/opportunities/verdicts/evaluate";
import { readingOf, type EngineReading, type SearchReading } from "@/lib/publish/reads/ladder";
import { publishDb } from "../../db";
import { announceUnannounced, type AnnounceSend } from "./announce";

const DAY_MS = 86_400_000;

/** `destinations.search_verification`. */
export interface SearchVerification {
  google?: { account: string; token: string; verifiedAt?: string; sitemapAt?: string };
  bing?: { token: string; verifiedAt?: string; sitemapAt?: string };
}

export interface SearchEngineDeps {
  accounts?: readonly GscAccount[];
  gscSend?: GscSend;
  bing?: BingClient | null;
  announce?: AnnounceSend;
  seenUrls?: (siteId: string) => Promise<readonly string[]>;
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
  search_reading: unknown;
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
  const free = accounts.find((account) => (held.get(account.client_email) ?? 0) < GSC_PROPERTIES_PER_ACCOUNT);
  if (free === undefined) log("gsc_pool_full", { accounts: accounts.length });
  return free ?? null;
}

/** The best place over a page's rows, and the query it was shown for. */
function best(rows: readonly { query?: string; position: number }[]): { place: number | null; query: string | null } {
  let found: { position: number; query?: string } | null = null;
  for (const row of rows) if (row.position > 0 && (found === null || row.position < found.position)) found = row;
  return { place: found === null ? null : Math.round(found.position * 10) / 10, query: found?.query ?? null };
}

async function readGoogle(a: {
  siteUrl: string;
  pages: readonly string[];
  now: Date;
  accounts: readonly GscAccount[];
  send?: GscSend;
  verification: SearchVerification;
  save: () => Promise<void>;
}): Promise<Map<string, EngineReading> | null> {
  if (a.accounts.length === 0) return null;
  let held = a.verification.google;
  let account = a.accounts.find((candidate) => candidate.client_email === held?.account) ?? null;
  if (held === undefined || account === null) {
    account = await pickAccount(a.accounts);
    if (account === null) return null;
    const token = await gscClient(account, a.send).metaToken(a.siteUrl);
    if (token === null) return null;
    held = { account: account.client_email, token };
    a.verification.google = held;
    await a.save();
  }
  const client = gscClient(account, a.send);
  if (held.verifiedAt === undefined) {
    if (!(await client.verify(a.siteUrl))) return null;
    held.verifiedAt = a.now.toISOString();
    await a.save();
  }
  if (held.sitemapAt === undefined) {
    if (!(await client.addWithSitemap(a.siteUrl, `${a.siteUrl}sitemap.xml`))) return null;
    held.sitemapAt = a.now.toISOString();
    await a.save();
  }

  const rows = await client.performance(a.siteUrl, day(new Date(a.now.getTime() - SEARCH_READING_WINDOW_D * DAY_MS)), day(a.now));
  const readings = new Map<string, EngineReading>();
  for (const url of a.pages) {
    const inspected = await client.inspect(a.siteUrl, url);
    if (rows === null && inspected === null) continue;
    const own = (rows ?? []).filter((row) => addressOf(row.page) === addressOf(url));
    const top = best(own);
    readings.set(url, {
      indexed: inspected?.indexed ?? null,
      lastCrawl: inspected?.lastCrawl ?? null,
      impressions: own.reduce((sum, row) => sum + row.impressions, 0),
      clicks: own.reduce((sum, row) => sum + row.clicks, 0),
      bestPlace: top.place,
      bestQuery: top.query,
    });
  }
  return readings;
}

async function readBing(a: {
  siteUrl: string;
  pages: readonly string[];
  now: Date;
  bing: BingClient | null;
  verification: SearchVerification;
  save: () => Promise<void>;
}): Promise<Map<string, EngineReading> | null> {
  if (a.bing === null) return null;
  const standing = await a.bing.standing(a.siteUrl);
  if (standing === null) return null;
  let held = a.verification.bing;
  if (held?.token !== standing.code) {
    held = { token: standing.code };
    a.verification.bing = held;
    await a.save();
  }
  if (held.verifiedAt === undefined) {
    if (!standing.verified && !(await a.bing.verify(a.siteUrl))) return null;
    held.verifiedAt = a.now.toISOString();
    await a.save();
  }
  if (held.sitemapAt === undefined && (await a.bing.submitSitemap(a.siteUrl, `${a.siteUrl}sitemap.xml`))) {
    held.sitemapAt = a.now.toISOString();
    await a.save();
  }

  const since = a.now.getTime() - SEARCH_READING_WINDOW_D * DAY_MS;
  const stats = (await a.bing.pageStats(a.siteUrl))?.filter((row) => row.at >= since) ?? null;
  const readings = new Map<string, EngineReading>();
  for (const url of a.pages) {
    const crawledAt = await a.bing.lastCrawl(a.siteUrl, url);
    const own = (stats ?? []).filter((row) => addressOf(row.page) === addressOf(url));
    if (stats === null && crawledAt === null) continue;
    readings.set(url, {
      indexed: null,
      lastCrawl: crawledAt === null ? null : new Date(crawledAt).toISOString(),
      impressions: own.reduce((sum, row) => sum + row.impressions, 0),
      clicks: own.reduce((sum, row) => sum + row.clicks, 0),
      bestPlace: best(own).place,
      bestQuery: null,
    });
  }
  return readings;
}

/** Which live pages an AI answer to their own question cited, from the
 *  newest stored report's page questions. A page with no row is absent. */
export function citedIn(report: unknown): Map<string, boolean> {
  const cited = new Map<string, boolean>();
  const rows = (report as { pageQuestions?: { rows?: unknown } } | null)?.pageQuestions?.rows;
  if (!Array.isArray(rows)) return cited;
  for (const row of rows) {
    const r = row as { publicationId?: unknown; liveUrl?: unknown; cell?: unknown; engines?: unknown };
    if (typeof r.publicationId !== "string" || typeof r.liveUrl !== "string") continue;
    const page = addressOf(r.liveUrl);
    const cells = [r.cell, ...(Array.isArray(r.engines) ? r.engines : [])];
    const hit = cells.some((cell) => {
      const urls = (cell as { ownUrls?: unknown } | null)?.ownUrls;
      return Array.isArray(urls) && urls.some((url) => typeof url === "string" && addressOf(url) === page);
    });
    cited.set(r.publicationId, (cited.get(r.publicationId) ?? false) || hit);
  }
  return cited;
}

/** The weekly step for one site. Never throws. */
export async function readSearchEngines(a: { siteId: string; now: Date; deps?: SearchEngineDeps }): Promise<void> {
  const deps = a.deps ?? {};
  try {
    await announceUnannounced({ siteId: a.siteId, at: a.now, ...(deps.announce === undefined ? {} : { send: deps.announce }) });

    const db = publishDb();
    const { data: pageRows, error } = await db
      .from<PageRow>("publications")
      .select("id, live_url, search_reading")
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

    let google: Map<string, EngineReading> | null = null;
    let bing: Map<string, EngineReading> | null = null;
    if (destination !== undefined && host !== null && host !== "") {
      const siteUrl = `https://${host}/`;
      const hosted = pages.map((page) => page.live_url).filter((url) => url.startsWith(siteUrl));
      const verification: SearchVerification = { ...(destination.search_verification ?? {}) };
      const save = async (): Promise<void> => {
        await db.from("destinations").update({ search_verification: verification }).eq("id", destination.id);
      };
      google = await readGoogle({
        siteUrl,
        pages: hosted,
        now: a.now,
        accounts: deps.accounts ?? gscAccounts(),
        ...(deps.gscSend === undefined ? {} : { send: deps.gscSend }),
        verification,
        save,
      }).catch(() => null);
      bing = await readBing({
        siteUrl,
        pages: hosted,
        now: a.now,
        bing: deps.bing === undefined ? bingClient() : deps.bing,
        verification,
        save,
      }).catch(() => null);
    }

    const seenUrls = await (deps.seenUrls ?? (async (siteId: string) => {
      const { verdictStore } = await import("@/lib/opportunities/verdicts/store");
      return (await verdictStore().seenUrls?.(siteId)) ?? [];
    }))(a.siteId).catch(() => [] as readonly string[]);
    const seen = new Set(seenUrls.map(addressOf));

    const { data: scans } = await db
      .from<{ report: unknown }>("scans")
      .select("report")
      .eq("site_id", a.siteId)
      .not("report", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const cited = citedIn(scans?.[0]?.report ?? null);

    const { data: crawls } = await db
      .from<{ publication_id: string }>("publication_reads")
      .select("publication_id")
      .eq("site_id", a.siteId)
      .eq("kind", "crawl");
    const crawled = new Set((crawls ?? []).map((row) => row.publication_id));

    for (const page of pages) {
      const before = readingOf(page.search_reading);
      const reading: SearchReading = {
        at: a.now.toISOString(),
        // Once counted, always crawled: the hits themselves are kept four
        // weeks, the fact that one happened is not lost with them.
        crawled: before?.crawled === true || crawled.has(page.id),
        seen: seen.has(addressOf(page.live_url)),
        cited: cited.get(page.id) ?? null,
        google: google?.get(page.live_url) ?? null,
        bing: bing?.get(page.live_url) ?? null,
      };
      await db.from("publications").update({ search_reading: reading }).eq("id", page.id);
    }
  } catch (error) {
    log("search_engines_failed", { siteId: a.siteId, message: String(error) });
  }
}
