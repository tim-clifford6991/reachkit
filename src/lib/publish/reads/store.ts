// SPEC §6 measure (d) · SPEC §7 — both sides of `publication_reads`: counting a read on the hosted route, and reading a
// window back for the AI answers tab.
// The write never raises or delays: it runs in `after()` once the page is sent, and a miscount is only low, which "at least" says.
// Nothing of the request crosses: a site, a page, an instant and a `BlogRead`. The day is the UTC day, to avoid a second
// round trip. `record_publication_read` increments and trims in one statement.
import { dbAdmin } from "@/lib/db";
import { BLOG_READS_RETENTION_W } from "@/lib/config/constants";
import type { BlogEngine, BlogRead, BlogReadKind } from "./classify";
import { ladderOf, type Ladder } from "@/lib/measure/ladder";
import { readingOf, type PageReading } from "@/lib/measure/page-reading";
import { windowStartDay, type VisitWeek } from "./model";

/** So the retention pin stays in weeks, as §6 states every window here. */
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

/** The cast boundary: `publication_reads` is absent from `src/lib/db/types.generated.ts`. */
function untyped(): MinimalClient & MinimalRpcClient {
  return dbAdmin() as unknown as MinimalClient & MinimalRpcClient;
}

/** Ids and a reason, never a row. */
function logUncounted(publicationId: string, reason: string): void {
  console.warn(JSON.stringify({ event: "blog_read_uncounted", publicationId, reason }));
}

/** The UTC day an instant falls in, as the database's `date`. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** Counts one read; raises nothing, and is awaited only so `after()` keeps the invocation alive. */
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

/** Every cell since `sinceDay` (inclusive), or `null` where unreadable, never an empty window. An `engine` or `kind` this
 *  build does not know is a newer deployment's, dropped rather than drawn without a heading. */
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

/**
 * Visits from Google search to the site's hosted pages, per seven days ending
 * today, oldest first, over the weeks kept; `null` where the counts could not
 * be read. Weeks before the first visit are left out, so a gap is never a 0.
 */
export async function readSearchVisitsWeekly(a: { siteId: string; now: Date }): Promise<readonly VisitWeek[] | null> {
  const { data, error } = await untyped()
    .from<{ day: string; hits: number }>("publication_reads")
    .select("day, hits")
    .eq("site_id", a.siteId)
    .eq("engine", "google")
    .eq("kind", "referral")
    .gte("day", windowStartDay(a.now, BLOG_READS_RETENTION_W * DAYS_PER_WEEK));
  if (error) return null;
  const weeks = Array.from({ length: BLOG_READS_RETENTION_W }, (_, i) => ({
    start: windowStartDay(a.now, (BLOG_READS_RETENTION_W - i) * DAYS_PER_WEEK),
    visits: 0,
  }));
  const today = Date.parse(utcDay(a.now));
  for (const row of data ?? []) {
    const back = Math.floor((today - Date.parse(row.day)) / (DAYS_PER_WEEK * 86_400_000));
    const week = back >= 0 ? weeks[BLOG_READS_RETENTION_W - 1 - back] : undefined;
    if (week !== undefined) week.visits += row.hits;
  }
  const first = weeks.findIndex((week) => week.visits > 0);
  return first === -1 ? [] : weeks.slice(first);
}

/** One live page's ladder, keyed by publication and draft. */
export interface PageLadder {
  publicationId: string;
  draftId: string | null;
  ladder: Ladder;
  reading: PageReading | null;
  /** WordPress keeps no server logs, so the steps only they show are unread. */
  wordpress: boolean;
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
  return (pages.data ?? []).map((row) => {
    const reading = readingOf(row.search_reading);
    return {
      publicationId: row.id,
      draftId: row.draft_id,
      ladder: ladderOf(reading, row.destination === "hosted" && crawls.error === null ? (hits.get(row.id) ?? 0) : null),
      reading,
      wordpress: row.destination === "wordpress",
    };
  });
}
