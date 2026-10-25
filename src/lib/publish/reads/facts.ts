// SPEC §6 measure (d) — the *AI engines on your blog* card's facts. Here, not beside the card, because the Monday mail
// reads them too and `src/lib` never imports `src/app`. It buys nothing: rows the hosted route wrote, plus two site questions.
// Three reads, none per page. A failed count is `null`, never an empty window, so the screen never draws zeroes for it.
import { dbAdmin } from "@/lib/db";
import { BLOG_READS_WINDOW_D } from "@/lib/config/constants";
import { AI_BLOG_ENGINES, BLOG_READS_RETENTION_W } from "@/lib/config/constants";
import { BLOG_READ_KINDS } from "@/lib/publish/reads/classify";
import { readBlogReads } from "@/lib/publish/reads/store";
import { windowStartDay, type BlogReadsFacts } from "./model";

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  is(column: string, value: unknown): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** Does this site publish anywhere ReachKit serves? A WordPress site's visitors reach a server we cannot count on. */
async function hasHostedDestination(siteId: string): Promise<boolean> {
  const { data, error } = await untyped()
    .from<{ id: string }>("destinations")
    .select("id")
    .eq("site_id", siteId)
    .eq("kind", "hosted")
    .is("deleted_at", null)
    .limit(1);
  if (error !== null) return false;
  return (data?.length ?? 0) > 0;
}

/** How many hosted pages are live; ids only. */
async function liveHostedPages(siteId: string): Promise<number> {
  const { data, error } = await untyped()
    .from<{ id: string }>("publications")
    .select("id")
    .eq("site_id", siteId)
    .eq("destination", "hosted")
    .not("published_at", "is", null)
    .is("unpublished_at", null);
  if (error !== null) return 0;
  return data?.length ?? 0;
}

export async function readBlogReadFacts(
  site: { siteId: string },
  at: Date,
  windowDays: number = BLOG_READS_WINDOW_D
): Promise<BlogReadsFacts> {
  const [hosted, livePages, rows] = await Promise.all([
    hasHostedDestination(site.siteId),
    liveHostedPages(site.siteId),
    readBlogReads({
      siteId: site.siteId,
      // This window and the one before, for the change, and every week kept, for the weekly reads.
      sinceDay: windowStartDay(at, Math.max(windowDays * 2, BLOG_READS_RETENTION_W * 7)),
      knownEngines: AI_BLOG_ENGINES,
      knownKinds: BLOG_READ_KINDS,
    }),
  ]);
  return { hosted, livePages, rows };
}
