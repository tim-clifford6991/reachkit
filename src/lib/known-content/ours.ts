// SPEC §5 (2026-10-15, issue 1456) — the pages ReachKit wrote for a site.
//
// A fact is read only off the customer's own pages and their own edits,
// never off a page ReachKit wrote. Quoting our own page back into the next
// one adds nothing the customer said and compounds whatever it got wrong.
// The crawl and the measurement read the customer's whole domain, and a
// hosted page (`<label>.<domain>`) or a WordPress post we published is on
// it, so every reader of facts asks this module which addresses are ours.
//
// Ours is any address a publication of the site was delivered at (live or
// since taken down: what it said was still ours) and anything on the host a
// live hosted destination serves, which only ever serves our pages.
//
// **A read that fails throws.** A reader that cannot tell our pages from
// the customer's does not read them as the customer's.
import { dbAdmin } from "@/lib/db";
import { hostFor } from "@/lib/publish/destinations/hosted/label";

export interface OurPages {
  /** Addresses as `addressKey` spells them. */
  readonly addresses: ReadonlySet<string>;
  /** Hosts as `hostKey` spells them. */
  readonly hosts: ReadonlySet<string>;
}

export const NO_PAGES_OF_OURS: OurPages = Object.freeze({ addresses: new Set<string>(), hosts: new Set<string>() });

/** A host with no case and no `www.`, which two spellings of one site share. */
function hostKey(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

/** An address in the form every spelling of one page shares: no scheme, no
 *  `www.`, no query or fragment, no trailing slash, no case. `null` where it
 *  is not an address. */
export function addressKey(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  return `${hostKey(parsed.hostname)}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();
}

/** Whether ReachKit wrote the page at `url`. */
export function isOurPage(ours: OurPages, url: string): boolean {
  const key = addressKey(url);
  if (key === null) return false;
  const host = key.split("/")[0] ?? "";
  return ours.addresses.has(key) || ours.hosts.has(host);
}

/** The same narrow cast `./store.ts` documents. */
interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  in(column: string, values: readonly unknown[]): MinimalQuery<T>;
  is(column: string, value: unknown): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
}
function table<T>(name: string): MinimalQuery<T> {
  return (dbAdmin() as unknown as { from(table: string): MinimalQuery<T> }).from(name);
}

function rowsOf<T>(result: MinimalResult<T>, what: string): T[] {
  if (result.error) throw new Error(`our pages: could not read ${what}: ${result.error.message}`);
  return result.data ?? [];
}

/**
 * The pages ReachKit wrote for one site, or for every site of one domain —
 * `site_profiles` and a free scan are keyed by domain, and a page any
 * account published on it is not that domain's own words.
 */
export async function readOurPages(a: { siteId: string } | { domain: string }): Promise<OurPages> {
  const sites = rowsOf(
    await ("siteId" in a
      ? table<{ id: string; domain: string | null }>("sites").select("id, domain").eq("id", a.siteId)
      : table<{ id: string; domain: string | null }>("sites").select("id, domain").eq("domain", a.domain)),
    "sites"
  );
  if (sites.length === 0) return NO_PAGES_OF_OURS;
  const ids = sites.map((site) => site.id);
  const domainOf = new Map(sites.map((site) => [site.id, site.domain]));

  const [publications, destinations] = await Promise.all([
    table<{ live_url: string | null }>("publications").select("live_url").in("site_id", ids).not("live_url", "is", null),
    table<{ site_id: string; hostname: string | null }>("destinations")
      .select("site_id, hostname")
      .in("site_id", ids)
      .eq("kind", "hosted")
      .is("deleted_at", null),
  ]);

  const addresses = new Set<string>();
  for (const row of rowsOf(publications, "publications")) {
    const key = row.live_url === null ? null : addressKey(row.live_url);
    if (key !== null) addresses.add(key);
  }
  const hosts = new Set<string>();
  for (const row of rowsOf(destinations, "destinations")) {
    const chosen = row.hostname?.trim() ?? "";
    const domain = domainOf.get(row.site_id)?.trim() ?? "";
    const host = chosen !== "" ? hostKey(chosen) : domain !== "" ? hostKey(hostFor({ label: null, domain })) : "";
    // A `www` label is the customer's own site once `www.` is dropped: its
    // pages are told apart by address, never by host.
    if (host !== "" && host !== hostKey(domain)) hosts.add(host);
  }
  return { addresses, hosts };
}

/** `pages` without the ones ReachKit wrote. */
export function withoutOurPages<P extends { url: string }>(pages: readonly P[], ours: OurPages): P[] {
  return pages.filter((page) => !isOurPage(ours, page.url));
}
