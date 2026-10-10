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
import { isProtectionName } from "@/lib/measure/challenge";
import { isPlaceholder } from "@/lib/measure/placeholder";
import { brandName, domainBrand } from "@/lib/site-profile/site-name";

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
  /** Every category among the scans the search matches, most first, with
   *  its count (`splitCategories` decides which are chips); `all` is the
   *  search's own total. */
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
  order(
    column: string,
    options: { ascending: boolean; nullsFirst?: boolean },
  ): MinimalQuery<T>;
  in(column: string, values: readonly unknown[]): MinimalQuery<T>;
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

/** A stored category as the gallery may show it: a placeholder the
 *  inference once stored (`<UNKNOWN>`, issue 1377) is no category — on a
 *  card, as a chip, or as the `?cat=` a link asks for. */
export function listedCategory(raw: string | null | undefined): string | null {
  const category = (raw ?? "").trim();
  return isPlaceholder(category) ? null : category;
}

/** At most this many category chips beside *All*, on every width. */
export const CHIPS_MAX = 8;
/** A category is a chip from this many scans. */
const CHIP_FROM = 2;

/**
 * The categories as the toolbar holds them (issue 1377): the chips are the
 * ones with at least two scans, most first, at most `CHIPS_MAX` — so the
 * toolbar's size never follows the number of categories — and every other
 * one is under *More*, A to Z. The category being shown is always the
 * first chip, wherever it would have stood and even where the search
 * leaves it no scan, so the filter in force is on screen on a phone, whose
 * row shows two or three chips, and can be left.
 */
export function splitCategories(
  categories: GalleryPage["categories"],
  current: string | null,
): { chips: GalleryPage["categories"]; more: GalleryPage["categories"] } {
  const most = categories.filter((c) => c.count >= CHIP_FROM).slice(0, CHIPS_MAX);
  const chips =
    current === null
      ? most
      : [
          categories.find((c) => c.name === current) ?? { name: current, count: 0 },
          ...most.filter((c) => c.name !== current),
        ];
  const shown = new Set(chips.map((c) => c.name));
  return {
    chips,
    more: categories
      .filter((c) => !shown.has(c.name))
      .sort((x, y) => x.name.localeCompare(y.name)),
  };
}

/** The stored name as a card shows it: the brand, never a page title's
 *  tagline (issue 1380), and never the name a bot-protection page gave the
 *  site (issue 1379: sage.com was listed as "Cloudflare"). The view answers
 *  the domain where no name is stored; a card with no name of the site's
 *  own shows the domain's brand. A stored call to action or category is no
 *  name either, and the domain's brand is cased as the site's own home
 *  title cases it — "HubSpot" (issue 1384). */
export function shownCompany(row: { company: string; domain: string }, homeTitle?: string): string {
  const unnamed = row.company === row.domain || isProtectionName(row.company, row.domain);
  return brandName([unnamed ? domainBrand(row.domain) : row.company], row.domain, [homeTitle]) ?? row.domain;
}

/**
 * Each listed site's stored home title — row one of the inventory its scan
 * kept — which says how the site cases its own name. The view does not
 * carry it. A card is still a card without it, so a failed read is no
 * titles, never a failed gallery.
 */
async function homeTitles(domains: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (domains.length === 0) return new Map();
  const { data, error } = await untyped()
    .from<{ domain: string; home_title: string | null }>("site_profiles")
    .select("domain, home_title:inventory->0->>title")
    .in("domain", domains);
  if (error) return new Map();
  return new Map((data ?? []).flatMap((row) => (row.home_title === null ? [] : [[row.domain, row.home_title] as const])));
}

function toEntry(row: Row, homeTitle?: string): GalleryEntry {
  return {
    domain: row.domain,
    company: shownCompany(row, homeTitle),
    score: row.score,
    category: listedCategory(row.category),
    scannedAt: new Date(row.scanned_at),
    hasLogo: row.has_logo,
  };
}

function searched<T>(query: MinimalQuery<T>, term: string): MinimalQuery<T> {
  return term === ""
    ? query
    : query.or(`company.ilike."*${term}*",domain.ilike."*${term}*"`);
}

function ordered<T>(
  query: MinimalQuery<T>,
  sort: GallerySort,
): MinimalQuery<T> {
  switch (sort) {
    case "highest":
      return query
        .order("score", { ascending: false, nullsFirst: false })
        .order("domain", { ascending: true });
    case "lowest":
      return query
        .order("score", { ascending: true, nullsFirst: false })
        .order("domain", { ascending: true });
    case "az":
      return query
        .order("company_key", { ascending: true })
        .order("domain", { ascending: true });
    case "newest":
      return query
        .order("scanned_at", { ascending: false })
        .order("domain", { ascending: true });
  }
}

/** The gallery's first `shown` cards for one search, category and order. */
export async function readGallery(a: {
  search: string;
  category: string | null;
  sort: GallerySort;
  shown: number;
}): Promise<GalleryPage> {
  let cards = searched(
    untyped()
      .from<Row>("free_scan_listing")
      .select(COLUMNS, { count: "exact" }),
    a.search,
  );
  if (a.category !== null) cards = cards.eq("category", a.category);
  const [page, chips] = await Promise.all([
    ordered(cards, a.sort).range(0, a.shown - 1),
    searched(
      untyped()
        .from<{ category: string | null }>("free_scan_listing")
        .select("category"),
      a.search,
    ),
  ]);
  if (page.error)
    throw new Error(
      `gallery: could not read the free scans: ${page.error.message}`,
    );
  if (chips.error)
    throw new Error(
      `gallery: could not count the categories: ${chips.error.message}`,
    );

  const titles = await homeTitles((page.data ?? []).map((row) => row.domain));
  const counts = new Map<string, number>();
  for (const row of chips.data ?? []) {
    const category = listedCategory(row.category);
    if (category === null) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return {
    entries: (page.data ?? []).map((row) => toEntry(row, titles.get(row.domain))),
    total: page.count ?? page.data?.length ?? 0,
    categories: [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name)),
    all: chips.data?.length ?? 0,
  };
}

/** One logo in the landing's strip: the company and whether it has a logo
 *  — no score, no date (SPEC §1, owner on #1058). */
export type StripEntry = Pick<GalleryEntry, "domain" | "company" | "hasLogo">;

/** The `n` most recently scanned sites, newest first, for the landing's
 *  *Recently scanned* strip — the same view as `/scans`, so a removed site
 *  leaves both at once. */
export async function readRecent(n: number): Promise<readonly StripEntry[]> {
  const { data, error } = await untyped()
    .from<Pick<Row, "domain" | "company" | "has_logo">>("free_scan_listing")
    .select("domain, company, has_logo")
    .order("scanned_at", { ascending: false })
    .order("domain", { ascending: true })
    .limit(n);
  if (error)
    throw new Error(`gallery: could not read the recent scans: ${error.message}`);
  const titles = await homeTitles((data ?? []).map((row) => row.domain));
  return (data ?? []).map((row) => ({
    domain: row.domain,
    company: shownCompany(row, titles.get(row.domain)),
    hasLogo: row.has_logo,
  }));
}

/** Whether a domain is listed today — the logo route's one question, so a
 *  removed or unreadable site's logo leaves with its card. */
export async function isListed(domain: string): Promise<boolean> {
  const { data, error } = await untyped()
    .from<{ domain: string }>("free_scan_listing")
    .select("domain")
    .eq("domain", domain)
    .limit(1);
  if (error)
    throw new Error(`gallery: could not read ${domain}: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
