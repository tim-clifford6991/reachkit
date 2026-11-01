// SPEC.md §2 (2026-09-24, owner on #1058) — the free scans, as `/scans` and
// the landing's strip list them.
// src/lib/scan/gallery.ts — issue #1069
//
// Everything here reads `free_scan_listing`, the one view that decides what
// is listed: each domain's newest finished free scan, never a removed or an
// unreadable site (`supabase/migrations/*_scans_gallery.sql`). Search, the
// kind filter, the order and the page are all the database's, so the page
// is server-rendered and paged rather than a list shipped whole.
//
// A view's read is cached, keyed by the view and by an uncached fingerprint
// of what may change the listing at once, so a crawler walking every filter
// costs one read per view per window and a removal still shows at once.
import { unstable_cache } from "next/cache";
import { kindOfProfile } from "@/lib/business/retrofit";
import { dbAdmin } from "@/lib/db";
import type { BusinessKind } from "@/lib/market/kinds";
import { isProtectionName } from "@/lib/measure/challenge";
import { isPlaceholder } from "@/lib/measure/placeholder";
import { brandName, domainBrand } from "@/lib/site-profile/site-name";
import { challengedHomes } from "./challenged";
import { removalsMark } from "./removal";

export const GALLERY_SORTS = ["newest", "highest", "lowest", "az"] as const;
export type GallerySort = (typeof GALLERY_SORTS)[number];

/** Cards per page, and per *Show more reports*: four rows of four. */
export const GALLERY_PAGE = 16;
/** However far *Show more* is followed, one response stays bounded. */
export const GALLERY_MOST = GALLERY_PAGE * 20;

/** A requested card count as whole pages within the bound, so every way of
 *  asking for one view is one view. */
export function galleryShown(raw: number): number {
  if (!Number.isFinite(raw)) return GALLERY_PAGE;
  const bounded = Math.min(Math.max(raw, GALLERY_PAGE), GALLERY_MOST);
  return Math.floor(bounded / GALLERY_PAGE) * GALLERY_PAGE;
}

/** One card. `company` falls back to the domain where the site names
 *  itself nowhere; `score` is null on a scan a ceiling cut off. */
export interface GalleryEntry {
  domain: string;
  company: string;
  score: number | null;
  category: string | null;
  /** The kind the stored category names, `null` where it names none. */
  kind: BusinessKind | null;
  scannedAt: Date;
  hasLogo: boolean;
}

export interface GalleryPage {
  entries: readonly GalleryEntry[];
  /** How many scans match the search and the kind. */
  total: number;
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
 *  inference once stored (`<UNKNOWN>`, issue 1377) is no category, on a
 *  card or as a kind. */
export function listedCategory(raw: string | null | undefined): string | null {
  const category = (raw ?? "").trim();
  return isPlaceholder(category) ? null : category;
}

/** The kind a stored category names on its own, read as the profile's kind
 *  is (`kindOfProfile`): a category that decides none is listed under none. */
export function kindOfCategory(category: string | null): BusinessKind | null {
  return category === null ? null : kindOfProfile(category, "", false);
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
  const category = listedCategory(row.category);
  return {
    domain: row.domain,
    company: shownCompany(row, homeTitle),
    score: row.score,
    category,
    kind: kindOfCategory(category),
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

interface GalleryView {
  search: string;
  kind: BusinessKind | null;
  sort: GallerySort;
  shown: number;
}

async function readListing(a: GalleryView): Promise<GalleryPage> {
  let cards = searched(
    untyped()
      .from<Row>("free_scan_listing")
      .select(COLUMNS, { count: "exact" }),
    a.search,
  );
  if (a.kind !== null) {
    const categories = await categoriesOf(a.kind, a.search);
    if (categories.length === 0) return { entries: [], total: 0 };
    cards = cards.in("category", categories);
  }
  const page = await ordered(cards, a.sort).range(0, a.shown - 1);
  if (page.error)
    throw new Error(
      `gallery: could not read the free scans: ${page.error.message}`,
    );

  const titles = await homeTitles((page.data ?? []).map((row) => row.domain));
  // Issue 1383: a card never states a score measured off a bot-protection
  // page. Only a scored card is asked about; an unscored one states none.
  const entries = (page.data ?? []).map((row) => toEntry(row, titles.get(row.domain)));
  const challenged = await challengedHomes(
    entries.filter((entry) => entry.score !== null).map((entry) => ({ domain: entry.domain, at: entry.scannedAt })),
  );
  return {
    entries: entries.map((entry) => (challenged.has(entry.domain) ? { ...entry, score: null } : entry)),
    total: page.count ?? page.data?.length ?? 0,
  };
}

/** The stored categories, among the scans the search matches, that name
 *  this kind: the view stores a category, never a kind. */
async function categoriesOf(kind: BusinessKind, search: string): Promise<string[]> {
  const { data, error } = await searched(
    untyped()
      .from<{ category: string | null }>("free_scan_listing")
      .select("category"),
    search,
  );
  if (error) throw new Error(`gallery: could not read the categories: ${error.message}`);
  const stored = new Set((data ?? []).flatMap((row) => (row.category === null ? [] : [row.category])));
  return [...stored].filter((category) => kindOfCategory(listedCategory(category)) === kind);
}

/**
 * What may change the listing at once: the takedown list's size and newest
 * row, and the newest finished free scan. Read uncached on every request,
 * so a removal or a new scan is a new key, never a wait (#1069).
 */
async function listingFingerprint(): Promise<string> {
  const [blocks, newest] = await Promise.all([
    removalsMark().catch((e: unknown) => {
      throw new Error(`gallery: ${e instanceof Error ? e.message : String(e)}`);
    }),
    untyped()
      .from<{ finished_at: string | null }>("scans")
      .select("finished_at")
      .eq("tier", "free")
      .in("status", ["done", "degraded"])
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(1),
  ]);
  if (newest.error) throw new Error(`gallery: could not read the newest scan: ${newest.error.message}`);
  return [blocks, newest.data?.[0]?.finished_at ?? ""].join("|");
}

// The fingerprint is in the arguments so it is in the key; the read ignores it.
const cachedListing = unstable_cache(
  (key: { view: GalleryView; fingerprint: string }) => readListing(key.view),
  ["scan-gallery"],
  { revalidate: 300 },
);

/** The gallery's first `shown` cards for one search, kind and order. */
export async function readGallery(a: GalleryView): Promise<GalleryPage> {
  const view: GalleryView = { search: a.search, kind: a.kind, sort: a.sort, shown: galleryShown(a.shown) };
  const page = await cachedListing({ view, fingerprint: await listingFingerprint() });
  // The data cache stores JSON, so a cached card's date comes back a string.
  return { ...page, entries: page.entries.map((entry) => ({ ...entry, scannedAt: new Date(entry.scannedAt) })) };
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

/** A listed domain's score as its gallery card states it: `null` where it is
 *  not listed, unscored, or scored off a bot-protection page. */
export async function listedScore(domain: string): Promise<number | null> {
  return (await listedCard(domain))?.score ?? null;
}

/** A listed domain's score and whether its logo is stored, as its gallery
 *  card draws them: `null` wherever `listedScore` is. */
export async function listedCard(domain: string): Promise<{ score: number; hasLogo: boolean } | null> {
  const { data, error } = await untyped()
    .from<Pick<Row, "score" | "scanned_at" | "has_logo">>("free_scan_listing")
    .select("score, scanned_at, has_logo")
    .eq("domain", domain)
    .limit(1);
  if (error)
    throw new Error(`gallery: could not read ${domain}'s score: ${error.message}`);
  const row = data?.[0];
  if (row === undefined || row.score === null) return null;
  const challenged = await challengedHomes([{ domain, at: new Date(row.scanned_at) }]);
  return challenged.has(domain) ? null : { score: row.score, hasLogo: row.has_logo };
}
