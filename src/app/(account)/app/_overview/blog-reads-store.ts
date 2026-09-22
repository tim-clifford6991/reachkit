// SPEC §6 (2026-09-20, #908) measure (d) — the *AI engines on your blog*
// card's facts, for a real account.
//
// The other half of `blog-reads-provider.ts`. It measures nothing and buys
// nothing: every value is a projection of rows the hosted route already
// wrote, plus two cheap questions about the site — does it publish anywhere
// we host, and has it published anything yet.
//
// **Three reads, none of them per page.** The counts come back as one
// window of roll-up cells (`publication_reads`, already one row per page,
// day, engine and reason), and the two site questions are a single row and
// a column of ids.
//
// **A failed count is `null`, never an empty window.** A site nobody has
// read and a site whose counts could not be fetched are two different
// sentences on the screen, and the model draws the second one rather than
// zeroes.
import { dbAdmin } from "@/lib/db";
import { BLOG_READS_WINDOW_D } from "@/lib/config/constants";
import { AI_BLOG_ENGINES } from "@/lib/config/constants";
import { BLOG_READ_KINDS } from "@/lib/publish/reads/classify";
import { readBlogReads } from "@/lib/publish/reads/store";
import { windowStartDay, type BlogReadsFacts } from "./blog-reads-model";

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

/** Does this site publish anywhere ReachKit serves? A WordPress site's
 *  visitors reach a server this product does not own, and counting them
 *  would be a measurement we cannot take. */
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

/** How many hosted pages are live. Ids only — the card needs a count, not a
 *  page. */
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
      sinceDay: windowStartDay(at, windowDays),
      knownEngines: AI_BLOG_ENGINES,
      knownKinds: BLOG_READ_KINDS,
    }),
  ]);
  return { hosted, livePages, rows };
}
