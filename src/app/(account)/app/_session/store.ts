// BUILD §4.4 — the one row every `/app` surface needs before it can read
// anything else: the signed-in account's site.
//
// The shell wants the domain, the zone and the mode; the calendar wants the
// site id and the zone; the draft view wants the site id to decide
// ownership; the day panel's writes want the user id and the site id. That
// is one row, read once per request, rather than four reads with four
// shapes that could disagree about which site the customer is looking at.
//
// **The generated `Database` type carries no `sites.timezone`** — the
// column arrives in migration `00000000000004_sites_timezone_column.sql`
// and `types.generated.ts` is regenerated on its own schedule. So this
// module declares the row shape it reads and reaches Postgres through one
// narrow, explicitly cast builder, the same way
// `src/app/(account)/setup/_setup/store.ts` and `src/lib/publish/db.ts` do.
// Regenerating the type deletes the cast and nothing else changes.
//
// **It reads and never writes.** Nothing on this path can change a row.
import { dbAdmin } from "@/lib/db";

/** REQ-073 c1: the zone is the customer's stated one, and no read path
 *  falls back to the server's. A site that has not stated one carries
 *  `null` here and every date on it is held rather than drawn in a zone
 *  nobody chose. */
export interface AppSiteRow {
  id: string;
  user_id: string;
  domain: string;
  timezone: string | null;
  mode: string;
  /** When the site was created — the first week the shell can count from.
   *  §4.4's domain block states "Week n", and n is counted over the weeks
   *  that have existed for this site, not over a fixed window. */
  created_at: string;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The one select list. Written once so no caller can widen it, and
 *  carrying nothing about billing, credentials or any other account. */
const SITE_COLUMNS = "id, user_id, domain, timezone, mode, created_at";

/**
 * The site row, by id, or `null`.
 *
 * `user_id` is selected and returned so the caller can check that the site
 * the session names really belongs to the account the session names. The
 * cookie is signed, so the pair arrives together and neither half is
 * guessed — but a row read by id is still read by id, and confirming the
 * owner costs nothing here and closes the gap if a cookie's site id ever
 * outlives the account it was minted for.
 */
export async function readAppSite(siteId: string): Promise<AppSiteRow | null> {
  const client = dbAdmin() as unknown as MinimalClient;
  const { data, error } = await client
    .from<AppSiteRow>("sites")
    .select(SITE_COLUMNS)
    .eq("id", siteId)
    .limit(1);
  if (error !== null || data === null) return null;
  return data[0] ?? null;
}

/**
 * Whether this site owns this draft.
 *
 * The ownership question the day panel's writes ask before they move
 * anything. It is a `select` keyed on the pair, so a draft belonging to
 * another account does not come back and there is no row in hand for a
 * later `if` to forget — the same shape the draft view's own read uses.
 *
 * A read that fails answers `false`. A write is refused on a fact we could
 * not establish, which costs the customer one retry; the other direction
 * moves another account's page.
 */
export async function siteOwnsDraft(siteId: string, draftId: string): Promise<boolean> {
  const client = dbAdmin() as unknown as MinimalClient;
  const { data, error } = await client
    .from<{ id: string }>("drafts")
    .select("id")
    .eq("id", draftId)
    .eq("site_id", siteId)
    .limit(1);
  if (error !== null || data === null) return false;
  return data.length > 0;
}
