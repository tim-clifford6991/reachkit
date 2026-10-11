// SPEC §7 (2026-09-20, #928) — the known-content index's rows.
//
// Three reads and one write, and every one of them takes a site id: nothing
// in this file can reach another customer's pages, which is the property the
// whole index rests on.
//
//   `writeKnownSource`  replaces one source's rows for one site, whole. A
//                       refresh is the same fact re-read, not a second fact:
//                       a post deleted on the customer's blog must leave the
//                       index, and a per-row upsert would leave it behind
//                       for ever.
//   `readKnownContent`  the site's whole index, for the readers that do no
//                       matching — the link candidates and the count.
//   `nearKnownContent`  the rows worth scoring against one planned topic,
//                       narrowed by the database's own full-text and trigram
//                       indexes (`known_content_near`).
//   `countKnownContent` how many pages the site has, for the one line
//                       Settings states.
//
// **Nothing here scores and nothing here decides.** The threshold lives in
// `KNOWN_CONTENT.COVERED_MIN` and the measure in `./similarity.ts`; this file
// moves rows. That is what lets the whole net-new rule be asserted with no
// database at all.
import { dbAdmin } from "@/lib/db";
import { KNOWN_CONTENT } from "@/lib/config/constants";
import type { KnownPage, KnownSource } from "./types";

/** The generated `Database` type does not carry `known_content` — the same
 *  narrow cast `@/lib/site-profile/store` documents, kept to the surface
 *  these four functions use. */
interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string, options?: { count: "exact"; head: true }): MinimalQuery<T>;
  insert(values: Record<string, unknown>[]): MinimalQuery<T>;
  delete(): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  in(column: string, values: readonly unknown[]): MinimalQuery<T>;
  is(column: string, value: unknown): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface CountResult {
  count: number | null;
  error: { message: string } | null;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<MinimalResult<KnownRow>>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface KnownRow {
  source: string;
  ref: string;
  url: string | null;
  title: string;
  /** One heading per line — the column's own shape (its migration says
   *  why). Split on the way out, joined on the way in, in this file alone. */
  headings: string | null;
  excerpt: string | null;
  live: boolean;
  published_at: string | null;
}

function headingsOf(value: string | null): string[] {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

const COLUMNS = "source, ref, url, title, headings, excerpt, live, published_at";

/** A row as the rest of the product reads it. A source the enum does not
 *  name is dropped rather than carried: the column has a check constraint,
 *  so such a row cannot exist, and reading one as a fourth source would be
 *  a shape nothing else handles. */
function pageOf(row: KnownRow): KnownPage | null {
  if (!isSource(row.source)) return null;
  return {
    source: row.source,
    ref: row.ref,
    url: row.url,
    title: row.title,
    headings: headingsOf(row.headings),
    live: row.live,
    publishedAt: row.published_at === null ? null : new Date(row.published_at),
  };
}

function isSource(value: string): value is KnownSource {
  return value === "reachkit" || value === "wordpress" || value === "site";
}

function rowOf(siteId: string, page: KnownPage): Record<string, unknown> {
  return {
    site_id: siteId,
    source: page.source,
    ref: page.ref,
    url: page.url,
    title: page.title,
    headings: page.headings.join("\n"),
    live: page.live,
    published_at: page.publishedAt === null ? null : page.publishedAt.toISOString(),
  };
}

/**
 * Replaces everything this site holds from one source.
 *
 * Delete then insert, in that order and not as an upsert: the index must
 * mirror the source, and a post the customer deleted is gone from their blog
 * the moment they delete it. A refresh that could only add would make the
 * index grow for ever and would answer "already covered" about a page that
 * no longer exists.
 *
 * One source at a time, so a WordPress read that fails leaves our own pages
 * and the crawl's exactly as they were.
 */
export async function writeKnownSource(a: {
  siteId: string;
  source: KnownSource;
  pages: readonly KnownPage[];
}): Promise<void> {
  const client = untyped();
  const removed = await client
    .from<KnownRow>("known_content")
    .delete()
    .eq("site_id", a.siteId)
    .eq("source", a.source);
  if (removed.error) {
    throw new Error(`known content: clearing ${a.source} for ${a.siteId}: ${removed.error.message}`);
  }
  if (a.pages.length === 0) return;

  const inserted = await client
    .from<KnownRow>("known_content")
    .insert(a.pages.map((page) => rowOf(a.siteId, page)));
  if (inserted.error) {
    throw new Error(`known content: writing ${a.source} for ${a.siteId}: ${inserted.error.message}`);
  }
}

/** The site's whole index, newest first. Bounded by what the refresh writes
 *  (`KNOWN_CONTENT.WORDPRESS_POSTS_MAX` + `INVENTORY_MAX` + the site's own
 *  pages), so there is no page here to page through. */
export async function readKnownContent(siteId: string): Promise<KnownPage[]> {
  const { data, error } = await untyped()
    .from<KnownRow>("known_content")
    .select(COLUMNS)
    .eq("site_id", siteId)
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`known content: reading ${siteId}: ${error.message}`);
  return atCurrentHost(siteId, (data ?? []).map(pageOf).filter((page): page is KnownPage => page !== null));
}

/**
 * Our own pages, at the address they answer at now (SPEC §7, 2026-09-18;
 * issue 1182).
 *
 * This table is a copy, written when the site was last re-read, and a
 * hosted page follows its site's host: a host that moves after the copy was
 * written leaves the row naming the old one until the next refresh. A new
 * page links to these addresses and a refresh is derived against them, so
 * they are read through the current host. The customer's own pages and a
 * WordPress post are theirs and are handed back as stored.
 */
async function atCurrentHost(siteId: string, pages: KnownPage[]): Promise<KnownPage[]> {
  if (!pages.some((page) => page.source === "reachkit" && page.url !== null)) return pages;
  const { storedAddressesNow } = await import("@/lib/publish/destinations/hosted/store");
  const now = await storedAddressesNow(siteId);
  return pages.map((page) => {
    if (page.source !== "reachkit" || page.url === null) return page;
    const url = now(page.url);
    return url === page.url ? page : { ...page, url, ref: page.ref === page.url ? url : page.ref };
  });
}

/**
 * The rows worth scoring against one planned topic.
 *
 * The narrowing is the database's — full text for a shared word, trigram for
 * a title spelled almost the same — and the scoring is the caller's. An
 * empty query narrows to nothing rather than to everything: a planned page
 * with no topic is not a repeat of every page the site has.
 */
export async function nearKnownContent(a: { siteId: string; query: string }): Promise<KnownPage[]> {
  if (a.query.trim() === "") return [];
  const { data, error } = await untyped().rpc("known_content_near", {
    p_site_id: a.siteId,
    p_query: a.query,
    p_limit: KNOWN_CONTENT.NEAR_ROWS,
  });
  if (error) throw new Error(`known content: matching ${a.siteId}: ${error.message}`);
  return atCurrentHost(a.siteId, (data ?? []).map(pageOf).filter((page): page is KnownPage => page !== null));
}

/** How many pages the site already has, all sources. The one number
 *  Settings and the draft's checks state. */
export async function countKnownContent(siteId: string): Promise<number> {
  const { count, error } = (await untyped()
    .from<KnownRow>("known_content")
    .select("ref", { count: "exact", head: true })
    .eq("site_id", siteId)) as unknown as CountResult;
  if (error) throw new Error(`known content: counting ${siteId}: ${error.message}`);
  return count ?? 0;
}

// ── Our own pages, as the index holds them ──────────────────────────────
//
// Two reads, because ours are two things: the pages that went live, which a
// reader can open and a new page may link to, and the pages waiting — a
// draft in review, one the rules stopped, one scheduled. Both are topics
// this site covers, and #928's rule is about topics: a page must not be
// written twice, and a page must not be written that one already waiting
// covers.

/** A draft state short of hand-off: written or being written, not yet
 *  published. The same five `generate/store.ts` calls short of hand-off,
 *  restated here because this file must not depend on that module's
 *  internals to know what "waiting" means. */
const WAITING_STATES = ["generating", "in_review", "approved", "failed", "needs_attention"] as const;

interface PublicationRow {
  live_url: string | null;
  destination: string | null;
  published_at: string | null;
  drafts: { title: string | null } | { title: string | null }[] | null;
}

interface DraftRow {
  id: string;
  title: string | null;
}

function titleOf(drafts: PublicationRow["drafts"]): string {
  const row = Array.isArray(drafts) ? drafts[0] : drafts;
  return (row?.title ?? "").trim();
}

/**
 * The pages ReachKit itself has for this site: live publications first,
 * then the drafts still waiting.
 *
 * A publication the day-after check found gone is left out — `live_url` and
 * `published_at` present, `unpublished_at` null, which is the same three
 * conditions `generate/store.ts`'s `clusterPages` uses for a link target.
 * The waiting drafts carry no address, which is what marks them as topics
 * rather than link targets.
 */
export async function readOurPages(siteId: string): Promise<KnownPage[]> {
  const client = untyped();
  const live = await client
    .from<PublicationRow>("publications")
    .select("live_url, destination, published_at, drafts(title)")
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .not("live_url", "is", null)
    .is("unpublished_at", null);
  if (live.error) throw new Error(`known content: reading publications for ${siteId}: ${live.error.message}`);

  const waiting = await client
    .from<DraftRow>("drafts")
    .select("id, title")
    .eq("site_id", siteId)
    .in("state", [...WAITING_STATES]);
  if (waiting.error) throw new Error(`known content: reading drafts for ${siteId}: ${waiting.error.message}`);

  // SPEC §7 (2026-09-18): a hosted page is at its site's host now. A new
  // page links to this address and a refresh is derived against it, so the
  // one stored on the day it was published would send both to a host that
  // may no longer serve it (issue 1182).
  const { hostedAddressesNow } = await import("@/lib/publish/destinations/hosted/store");
  const addressNow = await hostedAddressesNow(siteId);

  const pages: KnownPage[] = [];
  for (const row of live.data ?? []) {
    const title = titleOf(row.drafts);
    if (row.live_url === null || title === "") continue;
    const url = addressNow({ destination: row.destination, liveUrl: row.live_url });
    pages.push({
      source: "reachkit",
      ref: url,
      url,
      title,
      headings: [],
      live: true,
      publishedAt: row.published_at === null ? null : new Date(row.published_at),
    });
  }
  for (const row of waiting.data ?? []) {
    const title = (row.title ?? "").trim();
    // A page being written has no title yet. It is not a topic anyone can
    // match against, and a row titled "" would match every empty query.
    if (title === "") continue;
    pages.push({
      source: "reachkit",
      ref: row.id,
      url: null,
      title,
      headings: [],
      live: false,
      publishedAt: null,
    });
  }
  return pages;
}

/**
 * Every live page ReachKit wrote for this site, as it is served: its
 * address now, its title and its body. One page per address — an update is
 * a later publication at the same one, and the newest is the page (issue
 * 781). What the site link map reads (issue 1391).
 */
export async function readOurLiveBodies(siteId: string): Promise<{ url: string; title: string; markdown: string }[]> {
  const live = await untyped()
    .from<{
      live_url: string | null;
      destination: string | null;
      published_at: string | null;
      drafts: { title: string | null; body_md: string | null } | { title: string | null; body_md: string | null }[] | null;
    }>("publications")
    .select("live_url, destination, published_at, drafts(title, body_md)")
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .not("live_url", "is", null)
    .is("unpublished_at", null)
    .order("published_at", { ascending: false });
  if (live.error) throw new Error(`known content: reading live pages for ${siteId}: ${live.error.message}`);

  const { hostedAddressesNow } = await import("@/lib/publish/destinations/hosted/store");
  const addressNow = await hostedAddressesNow(siteId);
  const pages = new Map<string, { url: string; title: string; markdown: string }>();
  for (const row of live.data ?? []) {
    const draft = Array.isArray(row.drafts) ? row.drafts[0] : row.drafts;
    if (row.live_url === null || draft === null || draft === undefined) continue;
    const url = addressNow({ destination: row.destination, liveUrl: row.live_url });
    if (!pages.has(url)) pages.set(url, { url, title: (draft.title ?? "").trim(), markdown: draft.body_md ?? "" });
  }
  return [...pages.values()];
}

/** The site's own domain — the address the crawl's reading is keyed by, and
 *  the one host a link candidate may be on. `null` for a site id that names
 *  no row, which is a caller with nothing to refresh rather than an error. */
export async function siteDomainOf(siteId: string): Promise<string | null> {
  const { data, error } = await untyped()
    .from<{ domain: string | null }>("sites")
    .select("domain")
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`known content: reading site ${siteId}: ${error.message}`);
  const domain = data?.[0]?.domain ?? null;
  return domain === null || domain.trim() === "" ? null : domain;
}
