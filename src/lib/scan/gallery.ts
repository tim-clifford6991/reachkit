// SPEC.md §2 (2026-09-24, owner on #1058) — the free scans, as `/scans` and
// the landing's strip list them.
// src/lib/scan/gallery.ts — issue #1069
//
// Everything here reads `free_scan_listing`, the one view that decides what
// is listed: each domain's newest finished free scan, never a removed or an
// unreadable site (`supabase/migrations/*_scans_gallery.sql`). Search, the
// category filter, the order and the page are all the database's, so the
// page is server-rendered and paged rather than a list shipped whole.
import { dbAdmin } from "@/lib/db";

export const GALLERY_SORTS = ["newest", "highest", "lowest", "az"] as const;
export type GallerySort = (typeof GALLERY_SORTS)[number];

/** One card. `company` falls back to the domain where the site names
 *  itself nowhere; `score` is null on a scan a ceiling cut off. */
export interface GalleryEntry {
  domain: string;
  company: string;
  score: number | null;
  category: string | null;
  scannedAt: Date;
  hasLogo: boolean;
}

export interface GalleryPage {
  entries: readonly GalleryEntry[];
  /** How many scans match the search and the category. */
  total: number;
  /** Every category among the scans the search matches, most first — the
   *  chips and their counts; `all` is the search's own total. */
  categories: readonly { name: string; count: number }[];
  all: number;
}

interface Row {
  domain: string;
  company: string;
  score: number | null;
  category: string | null;
  scanned_at: string;
  has_logo: boolean;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string, options?: { count: "exact" }): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  or(filter: string): MinimalQuery<T>;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): MinimalQuery<T>;
  range(from: number, to: number): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The view is not in the generated `Database` type — the same narrow cast
 *  `src/lib/scan/removal.ts` documents for the takedown list. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const COLUMNS = "domain, company, score, category, scanned_at, has_logo";

/**
 * A search as it may be put into a PostgREST filter: letters, digits and
 * the few marks a company or a domain is written with. Everything else —
 * the commas, parentheses and quotes the filter grammar is made of — is
 * dropped rather than escaped, so no search can change the filter's shape.
 */
export function searchTerm(raw: string | undefined): string {
  return (raw ?? "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} .&'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function toEntry(row: Row): GalleryEntry {
  return {
    domain: row.domain,
    company: row.company,
    score: row.score,
    category: row.category,
    scannedAt: new Date(row.scanned_at),
    hasLogo: row.has_logo,
  };
}

function searched<T>(query: MinimalQuery<T>, term: string): MinimalQuery<T> {
  return term === "" ? query : query.or(`company.ilike."*${term}*",domain.ilike."*${term}*"`);
}

function ordered<T>(query: MinimalQuery<T>, sort: GallerySort): MinimalQuery<T> {
  switch (sort) {
    case "highest":
      return query.order("score", { ascending: false, nullsFirst: false }).order("domain", { ascending: true });
    case "lowest":
      return query.order("score", { ascending: true, nullsFirst: false }).order("domain", { ascending: true });
    case "az":
      return query.order("company_key", { ascending: true }).order("domain", { ascending: true });
    case "newest":
      return query.order("scanned_at", { ascending: false }).order("domain", { ascending: true });
  }
}

/** The gallery's first `shown` cards for one search, category and order. */
export async function readGallery(a: {
  search: string;
  category: string | null;
  sort: GallerySort;
  shown: number;
}): Promise<GalleryPage> {
  let cards = searched(untyped().from<Row>("free_scan_listing").select(COLUMNS, { count: "exact" }), a.search);
  if (a.category !== null) cards = cards.eq("category", a.category);
  const [page, chips] = await Promise.all([
    ordered(cards, a.sort).range(0, a.shown - 1),
    searched(untyped().from<{ category: string | null }>("free_scan_listing").select("category"), a.search),
  ]);
  if (page.error) throw new Error(`gallery: could not read the free scans: ${page.error.message}`);
  if (chips.error) throw new Error(`gallery: could not count the categories: ${chips.error.message}`);

  const counts = new Map<string, number>();
  for (const row of chips.data ?? []) {
    if (row.category === null) continue;
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  }
  return {
    entries: (page.data ?? []).map(toEntry),
    total: page.count ?? page.data?.length ?? 0,
    categories: [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name)),
    all: chips.data?.length ?? 0,
  };
}

/** Whether a domain is listed today — the logo route's one question, so a
 *  removed or unreadable site's logo leaves with its card. */
export async function isListed(domain: string): Promise<boolean> {
  const { data, error } = await untyped()
    .from<{ domain: string }>("free_scan_listing")
    .select("domain")
    .eq("domain", domain)
    .limit(1);
  if (error) throw new Error(`gallery: could not read ${domain}: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
