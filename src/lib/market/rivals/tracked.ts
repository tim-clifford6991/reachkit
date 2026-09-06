// BUILD §6.6 — the rivals the customer chose, read back.
//
// §6.6's sizing is "one entry per rival the customer chose", and this is
// the read that says who those are: `sites.competitors`, in the order they
// were handed in at setup (§4.3's third question) or last saved in
// settings (§4.7). The order is the customer's and is preserved — nothing
// here sorts, filters, dedupes against the derived candidates, or tops the
// list up from anywhere. A customer who tracks none tracks none, and the
// honest answer is an empty list.
//
// **The cap is the schema's, not this file's.** `sites_competitors_max_5`
// is a check constraint on the column and `BATTERY.COMPETITORS_MAX` is the
// pin the surfaces read; a second bound here would be a third place the
// same number lives, and the one that eventually disagrees.
//
// **Normalised, and only to the one canonical key.** A rival is a domain
// key, and ADR-020 gives the product one parser for those. A stored value
// that no longer parses — a customer typed something the settings form
// admitted before it was validated — is dropped rather than sent to a
// vendor as a target, because a vendor call for an unparseable host spends
// money to learn nothing.
//
// This module reads and does not measure: no vendor, no cost context, no
// clock. `sizeRivals` is what spends.
import { dbAdmin } from "@/lib/db";
import { registrableDomain } from "./domains";

/** The generated `Database` type predates several of this node's columns;
 *  the same narrow, explicitly cast boundary `src/lib/scan/run.ts` and
 *  `report.ts` already carry. */
interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

interface SiteRivalsRow {
  competitors: unknown;
}

/**
 * The domains one site tracks, in the order the customer chose them, or
 * `null` where there is no such site.
 *
 * "This customer tracks no rivals" and "we could not find out who they
 * are" are different answers and only one of them is safe to act on: an
 * empty list is a measured zero the sizing may store, and `null` — a row
 * that is not there — leaves the pass's sizing on its `unmeasured` arm.
 * A query that failed throws, for the same reason.
 */
export async function trackedRivals(siteId: string): Promise<readonly string[] | null> {
  const { data, error } = await untyped()
    .from<SiteRivalsRow>("sites")
    .select("competitors")
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`trackedRivals: ${error.message}`);

  const row = data?.[0];
  if (row === undefined) return null;

  const stored = row.competitors;
  // The column is `not null default '[]'::jsonb`, so anything else is a
  // value the schema does not admit — read as the empty list rather than
  // guessed at.
  if (!Array.isArray(stored)) return [];

  const domains: string[] = [];
  for (const entry of stored) {
    if (typeof entry !== "string") continue;
    const domain = registrableDomain(entry);
    if (domain === null || domains.includes(domain)) continue;
    domains.push(domain);
  }
  return domains;
}
