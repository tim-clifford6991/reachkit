// SPEC §6 (2026-09-20, #908) measure (d) · SPEC §7 (2026-09-20) — issue
// #921. The two calls either side of `publication_reads`: counting one read
// on the hosted route, and reading a window of them back for the AI answers
// tab.
//
// **The write never raises and never delays.** It is called from `after()`
// on a page that has already been sent, so there is no one left to tell and
// nothing left to retry into: a failure is swallowed after it is logged.
// A miscount is a number that is slightly low, which the card's own "at
// least" already says; an exception here would be an error in a served
// request's tail for no reader's benefit.
//
// **Nothing of the request crosses this seam.** The write takes a site, a
// page, an instant and a `BlogRead` — two closed enumerations — so the
// agent string, the referrer and the address are already gone by the time
// anything is stored. `classify.ts` is where they end.
//
// **The day is the UTC day.** Following each site's own zone would mean
// reading the site on a path that must not do a second round trip, and the
// card states the window it draws rather than claiming a local one.
//
// **One statement, in the database.** `record_publication_read` does the
// insert-or-increment and the retention trim together (its own migration
// says why), so this module holds no read-modify-write and no sweep.
import { dbAdmin } from "@/lib/db";
import { BLOG_READS_RETENTION_W } from "@/lib/config/constants";
import type { BlogEngine, BlogRead, BlogReadKind } from "./classify";
import { ladderOf, type Ladder } from "@/lib/measure/ladder";
import { readingOf } from "@/lib/measure/page-reading";

/** Days per week — spelled once so the retention pin can stay in weeks,
 *  which is how §6 states every window on this screen. */
const DAYS_PER_WEEK = 7;

interface MinimalRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  gte(column: string, value: unknown): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  is(column: string, value: null): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The one cast boundary this module needs: `publication_reads` and its
 *  function are this migration's own, and `src/lib/db/types.generated.ts`
 *  is BP-002's generated artifact — the same gap `costs/daily.ts` and
 *  `site-profile/business/edits.ts` name and work around the same way. */
function untyped(): MinimalClient & MinimalRpcClient {
  return dbAdmin() as unknown as MinimalClient & MinimalRpcClient;
}

/** One structured line, the shape every other unreadable-store line in this
 *  product takes (`costs/daily.ts`). Ids and a reason; never a row. */
function logUncounted(publicationId: string, reason: string): void {
  console.warn(JSON.stringify({ event: "blog_read_uncounted", publicationId, reason }));
}

/** The UTC day an instant falls in, as the database's `date`. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Counts one read of one hosted page.
 *
 * Returns nothing, raises nothing, and is `await`ed only so a caller inside
 * `after()` keeps the invocation alive until it has settled.
 */
export async function recordBlogRead(a: {
  siteId: string;
  publicationId: string;
  at: Date;
  read: BlogRead;
}): Promise<void> {
  try {
    const { error } = await untyped().rpc("record_publication_read", {
      p_site_id: a.siteId,
      p_publication_id: a.publicationId,
      p_day: utcDay(a.at),
      p_engine: a.read.engine,
      p_kind: a.read.kind,
      p_keep_days: BLOG_READS_RETENTION_W * DAYS_PER_WEEK,
    });
    if (error) logUncounted(a.publicationId, error.message);
  } catch (cause) {
    logUncounted(a.publicationId, cause instanceof Error ? cause.message : String(cause));
  }
}

/** One stored cell, as the card's model wants it. */
export interface BlogReadRow {
  publicationId: string;
  day: string;
  engine: BlogEngine;
  kind: BlogReadKind;
  hits: number;
}

interface ReadRow {
  publication_id: string;
  day: string;
  engine: string;
  kind: string;
  hits: number;
}

const COLUMNS = "publication_id, day, engine, kind, hits";

/**
 * Every counted cell for one site since `sinceDay` (inclusive), or `null`
 * where the table could not be read.
 *
 * `null` is not an empty window: a site that was read nothing at all and a
 * site whose counts we could not fetch are two different things to say, and
 * the card says the second one rather than drawing zeroes.
 *
 * A row whose `engine` or `kind` is not one this build knows is dropped —
 * the column is checked in the database, so that can only be a value added
 * by a newer deployment, and drawing it under a name this build has no word
 * for would be a column with no heading.
 */
export async function readBlogReads(a: {
  siteId: string;
  sinceDay: string;
  knownEngines: readonly BlogEngine[];
  knownKinds: readonly BlogReadKind[];
}): Promise<readonly BlogReadRow[] | null> {
  const { data, error } = await untyped()
    .from<ReadRow>("publication_reads")
    .select(COLUMNS)
    .eq("site_id", a.siteId)
    .gte("day", a.sinceDay);
  if (error) {
    console.warn(
      JSON.stringify({ event: "blog_reads_unreadable", siteId: a.siteId, reason: error.message })
    );
    return null;
  }
  const engines = new Set<string>(a.knownEngines);
  const kinds = new Set<string>(a.knownKinds);
  const rows: BlogReadRow[] = [];
  for (const row of data ?? []) {
    if (!engines.has(row.engine) || !kinds.has(row.kind)) continue;
    rows.push({
      publicationId: row.publication_id,
      day: row.day,
      engine: row.engine as BlogEngine,
      kind: row.kind as BlogReadKind,
      hits: row.hits,
    });
  }
  return rows;
}

/** One live page's ladder (issue 1553), keyed by its publication and its
 *  draft. */
export interface PageLadder {
  publicationId: string;
  draftId: string | null;
  ladder: Ladder;
}

/**
 * The ladder of every live page of one site, from its stored weekly
 * reading and the verified crawler hits counted on it; `null` where the
 * pages could not be read. A page ReachKit does not serve has no crawler
 * count, so its crawled step stands on the engines alone.
 */
export async function readLadders(siteId: string): Promise<readonly PageLadder[] | null> {
  const pages = await untyped()
    .from<{ id: string; draft_id: string | null; destination: string | null; search_reading: unknown }>("publications")
    .select("id, draft_id, destination, search_reading")
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .is("unpublished_at", null);
  if (pages.error !== null) return null;
  const crawls = await untyped()
    .from<{ publication_id: string; hits: number }>("publication_reads")
    .select("publication_id, hits")
    .eq("site_id", siteId)
    .eq("kind", "crawl");
  const hits = new Map<string, number>();
  for (const row of crawls.data ?? []) hits.set(row.publication_id, (hits.get(row.publication_id) ?? 0) + row.hits);
  return (pages.data ?? []).map((row) => ({
    publicationId: row.id,
    draftId: row.draft_id,
    ladder: ladderOf(
      readingOf(row.search_reading),
      row.destination === "hosted" && crawls.error === null ? (hits.get(row.id) ?? 0) : null
    ),
  }));
}
