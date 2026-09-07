// BUILD §4.7 — "**Your content** (pages count, Export everything)".
//
// One count, of one thing: the customer's pages that are published and not
// taken down. The same predicate the hosted sitemap and Overview's tile
// read, so the number on this card and the pages actually being served
// cannot disagree.
//
// A count that could not be taken is not a count of zero, so this throws
// rather than answering one — the caller decides what a failed read means,
// and on this screen it means the screen failed rather than that the
// customer has published nothing.
import { dbAdmin } from "@/lib/db";

interface MinimalResult {
  data: { id: string }[] | null;
  error: { message: string } | null;
}

interface MinimalQuery extends PromiseLike<MinimalResult> {
  select(columns: string): MinimalQuery;
  eq(column: string, value: string): MinimalQuery;
  is(column: string, value: null): MinimalQuery;
  not(column: string, operator: string, value: unknown): MinimalQuery;
}

interface MinimalClient {
  from(table: string): MinimalQuery;
}

export async function livePageCount(siteId: string): Promise<number> {
  const client = dbAdmin() as unknown as MinimalClient;
  const { data, error } = await client
    .from("publications")
    .select("id")
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .is("unpublished_at", null);
  if (error !== null || data === null) {
    throw new Error(`livePageCount: could not count this site's published pages`);
  }
  return data.length;
}
