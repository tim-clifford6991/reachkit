// The weekly pass's search-engine step for one site: ReachKit verifies every live hosted host in Google Search Console
// under its own account, with no customer step, and reads each page's way toward being found. Only Google is read.
// In order, once a week:
//
//   1. Every live hosted page the feed's hub never accepted is announced, once (`announceUnannounced`).
//   2. The host is verified (the meta method: the hosted index prints the
//      token stored on the destination) and its sitemap submitted. Each step
//      is stored as it lands, so a pass that stops half way resumes where it stopped.
//   3. Per page: URL Inspection, and impressions and clicks (by page alone) and best place by
//      query over `SEARCH_READING_WINDOW_D`; a property younger than `PROPERTY_NEW_D` gets URL Inspection only.
//      An address moved or merged away in the last `RESTORE_WITHIN_D` days that holds impressions, while the page it
//      301s to holds none, serves the version the move took down again, once (SPEC §7, the machine's `RESTORE_EARNING`),
//      and the page it went into answers 301 to it where both are one question.
//   4. A hosted page Google has still not crawled `UNCRAWLED_AFTER_D` days after going live is announced again, once.
//   5. One `search_reading` per live page, assembled by
//      `@/lib/measure/page-reading` from the newest stored report, the
//      reads counted on the page, and Google's reading.
//
// Without credentials steps 1 and 5 still run, so the ladder shows what ReachKit can prove. 0¢: every call is free.
// It never throws: a refusal or failed read stores its reason on each hosted page, logs it once per host, and the verdicts and mail still run.
import { SEARCH_READING_WINDOW_D, GSC_PROPERTIES_PER_ACCOUNT, UNCRAWLED_AFTER_D } from "@/lib/config/constants";
import { gscClient, gscPool, type GscAccount, type GscRefusal, type GscSend } from "@/lib/vendors/gsc";
import { knownPlaces } from "@/lib/measure/known-places";
import { addressOf as pageAddress, assembleReading, engineReadingOf, pageSearchOf, readingOf, statedOf, uncrawled, type GoogleReading, type GoogleUnread } from "@/lib/measure/page-reading";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import { moveAddress } from "../../attempt/move";
import { publishDb } from "../../db";
import { RESTORE_EARNING, transition } from "../../machine";
import { takenDownByCustomer } from "../../take-down/standing";
import type { TransitionRecord } from "../../types";
import { announceHosted, announceUnannounced, type AnnounceSend } from "./announce";
import { invalidateHosted } from "./cache";
import { addressOf, slugOf, type AddressRow } from "./moved";

const DAY_MS = 86_400_000;
// Google starts a new property's data "in a few days" and Search Analytics lags 2–3 days more, so an empty answer before then is not a zero.
const PROPERTY_NEW_D = 4;
const RESTORE_WITHIN_D = 90;

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
  published_at: string | null;
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
  pool: { entries: number; accounts: readonly GscAccount[] };
  send?: GscSend;
  onRefused: (refusal: GscRefusal) => void;
  verification: SearchVerification;
  save: () => Promise<void>;
  /** Restores the addresses Google still shows, from the week's measured totals. */
  restore: (totals: readonly { page: string; impressions: number }[]) => Promise<void>;
}): Promise<Map<string, GoogleReading> | GoogleUnread> {
  const { entries, accounts } = a.pool;
  if (accounts.length < entries) log("gsc_key_unreadable", { entries, usable: accounts.length });
  if (entries === 0) return "no_credentials";
  if (accounts.length === 0) return "bad_credentials";
  let held = a.verification.google;
  const account = accounts.find((candidate) => candidate.client_email === held?.account) ?? (await pickAccount(accounts));
  if (account === null) return "pool_full";
  const client = gscClient(account, a.send, a.onRefused);
  if (held === undefined || held.account !== account.client_email) {
    const token = await client.metaToken(a.siteUrl);
    if (token === null) return "no_token";
    held = { account: account.client_email, token };
    a.verification.google = held;
    await a.save();
  }
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

  const readings = new Map<string, GoogleReading>();
  if (a.now.getTime() - Date.parse(held.sitemapAt) < PROPERTY_NEW_D * DAY_MS) {
    for (const page of a.pages) {
      const inspected = await client.inspect(a.siteUrl, page.url);
      readings.set(page.url, { unread: "property_new", indexed: inspected?.indexed ?? null, lastCrawl: inspected?.lastCrawl ?? null, ...statedOf({ ...inspected }) });
    }
    return readings;
  }
  const start = day(new Date(a.now.getTime() - SEARCH_READING_WINDOW_D * DAY_MS));
  const totals = await client.performance(a.siteUrl, start, day(a.now), false);
  const rows = totals === null ? null : await client.performance(a.siteUrl, start, day(a.now));
  if (totals === null || rows === null) return "performance_unread";
  await a.restore(totals);
  for (const page of a.pages) readings.set(page.url, engineReadingOf(totals, rows, page.url, page.search, await client.inspect(a.siteUrl, page.url)));
  return readings;
}

interface HostedRow {
  id: string;
  draft_id: string;
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  merged_into: string | null;
  search_reading: unknown;
  drafts: {
    first_edited_at?: unknown;
    transitions?: unknown;
    opportunities: { family: string | null; target_ref: string | null; target_query: string | null; cluster_key: string | null } | null;
  } | null;
}

const restoredBy = (transitions: unknown): boolean => Array.isArray(transitions) && (transitions as Partial<TransitionRecord>[]).some((move) => move?.reason === RESTORE_EARNING);

/** Each address moved or merged away within `RESTORE_WITHIN_D` days that Google shows, where the live page it 301s to
 *  shows nothing, serves its newest version the move took down again; the machine refuses a customer's take-down and a
 *  second restore. The page it went into answers 301 to it where both are one question; one the customer edited or took
 *  down, or itself restored, is left alone. */
async function restoreShown(a: { siteId: string; totals: readonly { page: string; impressions: number }[]; now: Date }): Promise<void> {
  const db = publishDb();
  const { data, error } = await db
    .from<HostedRow>("publications")
    .select("id, draft_id, live_url, published_at, unpublished_at, merged_into, search_reading, drafts(first_edited_at:meta->first_edited_at, transitions, opportunities(family, target_ref, target_query, cluster_key))")
    .eq("site_id", a.siteId)
    .eq("destination", "hosted");
  if (error !== null || data === null) return;
  const rows: AddressRow[] = data.map((row) => ({ ...row, updates: row.drafts?.opportunities?.family === "improve" ? row.drafts.opportunities.target_ref : null }));
  const shown = (url: string): number => a.totals.filter((row) => pageAddress(row.page) === pageAddress(url)).reduce((sum, row) => sum + row.impressions, 0);
  const since = a.now.getTime() - RESTORE_WITHIN_D * DAY_MS;
  const left = data.filter((row) => row.live_url !== null && row.unpublished_at !== null && Date.parse(row.unpublished_at) >= since);
  const by = { kind: "system", job: "weekly/refresh" } as const;
  // An address a restore changed this pass is read again next week, from its new rows.
  const changed = new Set<string>();
  for (const slug of new Set(left.map((row) => slugOf(row.live_url!)))) {
    if (slug === null || changed.has(slug)) continue;
    const address = addressOf(rows, slug);
    const holder = address.state === "moved" ? data.find((row) => row.id === address.publicationId) : undefined;
    if (holder?.live_url == null || typeof holder.drafts?.first_edited_at === "string" || takenDownByCustomer(holder.drafts?.transitions) || restoredBy(holder.drafts?.transitions)) continue;
    if (shown(holder.live_url) > 0 || changed.has(slugOf(holder.live_url) ?? "")) continue;
    const version = left.filter((row) => slugOf(row.live_url!) === slug).sort((x, y) => (y.published_at ?? "").localeCompare(x.published_at ?? ""))[0]!;
    const atAddress = data.filter((row) => slugOf(row.live_url ?? "") === slug);
    const restoredBefore = atAddress.some((row) => restoredBy(row.drafts?.transitions)) || data.some((row) => slugOf(readingOf(row.search_reading)?.restored ?? "") === slug);
    const impressions = shown(version.live_url!);
    const back = await transition(version.draft_id, "published", by, { at: a.now, reason: RESTORE_EARNING, earning: { impressions, restoredBefore } });
    if (!back.ok) continue;
    const served = await db.from<{ id: string }>("publications").update({ unpublished_at: null }).eq("id", version.id);
    if (served.error !== null && served.error !== undefined) {
      log("search_engine_restore_row_refused", { siteId: a.siteId, publicationId: version.id, message: served.error.message });
      continue;
    }
    invalidateHosted({ siteId: a.siteId, publicationId: version.id });
    changed.add(slug).add(slugOf(holder.live_url) ?? "");
    // A move is the same page at a new address; a merge's two pages stay two unless they answer one question.
    const was = version.drafts?.opportunities;
    const into = holder.drafts?.opportunities;
    const sameKey = (x?: string | null, y?: string | null): boolean => (x ?? "").trim() !== "" && x!.trim().toLowerCase() === (y ?? "").trim().toLowerCase();
    const oneQuestion = version.merged_into === null || sameKey(was?.cluster_key, into?.cluster_key) || sameKey(was?.target_query, into?.target_query);
    if (oneQuestion) await moveAddress({ from: holder.live_url, to: { publicationId: version.id, url: version.live_url! }, at: a.now, by, merge: true });
    log("search_engine_restored", { siteId: a.siteId, reason: RESTORE_EARNING, address: version.live_url, impressions, from: holder.live_url, redirected: oneQuestion });
  }
}

/** The weekly step for one site. Never throws. */
export async function readSearchEngines(a: { siteId: string; now: Date; deps?: SearchEngineDeps }): Promise<void> {
  const deps = a.deps ?? {};
  try {
    await announceUnannounced({ siteId: a.siteId, at: a.now, ...(deps.announce === undefined ? {} : { send: deps.announce }) });

    const db = publishDb();
    const { data: pageRows, error } = await db
      .from<PageRow>("publications")
      .select("id, live_url, destination, published_at, acceptance, search_reading, drafts(opportunities(acceptance, target_query))")
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
    let refusal: GscRefusal | undefined;
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
        pool: deps.accounts === undefined ? gscPool() : { entries: deps.accounts.length, accounts: deps.accounts },
        ...(deps.gscSend === undefined ? {} : { send: deps.gscSend }),
        onRefused: (last) => (refusal = last),
        verification,
        save,
        // A failed restore leaves the week's Google reading standing.
        restore: (totals) => restoreShown({ siteId: a.siteId, totals, now: a.now }).catch((error: unknown) => log("search_engine_restore_failed", { siteId: a.siteId, message: String(error) })),
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
    for (const [reason, count] of unread) log("search_engine_unread", { reason, host, siteId: a.siteId, pages: count, ...refusal });
    if (typeof google !== "string") log("search_engine_read", { host, siteId: a.siteId, pages: google.size, ...refusal });

    const { data: scans } = await db
      .from<{ report: unknown }>("scans")
      .select("report")
      .eq("site_id", a.siteId)
      .not("report", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    let report: StoredReport | null = null;
    try {
      report = scans?.[0]?.report == null ? null : knownPlaces(readStoredReport(scans[0].report));
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

    const dueAt = a.now.getTime() - UNCRAWLED_AFTER_D * DAY_MS;
    const due = pages
      .filter((page) => page.destination === "hosted" && uncrawled(googleOf(page)) && Date.parse(page.published_at ?? "") <= dueAt && readingOf(page.search_reading)?.reannounced === undefined)
      .map((page) => page.live_url);
    const reannounced = due.length > 0 && (await announceHosted({ siteId: a.siteId, urls: due, at: a.now, ...(deps.announce === undefined ? {} : { send: deps.announce }) }));
    if (reannounced) log("search_engine_reannounced", { host, siteId: a.siteId, pages: due.length });

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
      const stamped = reannounced && due.includes(page.live_url) ? { ...reading, reannounced: a.now.toISOString() } : reading;
      await db.from("publications").update({ search_reading: stamped }).eq("id", page.id);
    }
  } catch (error) {
    log("search_engines_failed", { siteId: a.siteId, message: String(error) });
  }
}
