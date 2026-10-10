// SPEC §2 (owner, 2026-10-10, issue 1387) — a site whose bot protection kept
// the reader off its own pages has its market read from how it appears in
// search: the searches it ranks for, and the title and snippet Google shows
// for each page that ranks. The pass already buys those rows
// (`ranked_keywords`), so nothing more is bought.
//
// This file turns the rows into the text the profile call reads in place of
// the home page, or says that they are too thin to name a market from. It
// reads no domain list and no rule about one site: the brand is the
// domain's own label.
import { SEARCH_FOOTPRINT } from "@/lib/config/constants";
import { domainBrand } from "@/lib/site-profile/site-name";
import type { RankedRow } from "@/lib/vendors/dataforseo/types";

/** Why a listing names no market (the pass's log and the report's record). */
export type ThinFootprint = "few_ranked_searches" | "brand_only" | "market_not_named";

export type SearchFootprint =
  | { kind: "read"; text: string; searches: number; descriptive: number; pages: number }
  | { kind: "thin"; because: Exclude<ThinFootprint, "market_not_named">; searches: number; descriptive: number };

function wordsOf(text: string): string[] {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ß/g, "ss").match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** The domain as searches spell it: its label ("sage" of `sage.com`), the
 *  words of a hyphenated one, and the parts of its address ("www", "com"). */
function brandOf(domain: string): { label: string; words: ReadonlySet<string> } {
  const parts = wordsOf(domainBrand(domain) ?? "");
  return { label: parts.join(""), words: new Set([...parts, ...wordsOf(domain), "www"]) };
}

/**
 * Whether a search says anything beyond the brand's own name: after the
 * brand's words are taken out, a word of three letters or more is left.
 * "sage accounting software" does; "sage", "sage.com" and "sage 50" do not.
 * A brand written as several words ("home depot" of `homedepot.com`) is
 * taken out as one.
 */
function isDescriptive(keyword: string, brand: { label: string; words: ReadonlySet<string> }): boolean {
  const words = wordsOf(keyword);
  const kept = words.map(() => true);
  for (let from = 0; from < words.length; from += 1) {
    let joined = "";
    for (let to = from; to < words.length && joined.length < brand.label.length; to += 1) {
      joined += words[to];
      if (joined === brand.label) for (let i = from; i <= to; i += 1) kept[i] = false;
    }
  }
  return words.some((word, i) => kept[i] === true && !brand.words.has(word) && /\p{L}{3}/u.test(word));
}

function cut(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const head = flat.slice(0, max);
  const at = head.lastIndexOf(" ");
  return `${(at > max / 2 ? head.slice(0, at) : head).trimEnd()}…`;
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" ? parsed.hostname : `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * The site's listing in search as one text, or why it is too thin.
 *
 * `rows` are the site's ranked rows in the vendor's order (most visited
 * first), bought with `listing`. A row with no title is still a search the
 * site ranks for; a page is listed once, by its first row.
 */
export function searchFootprintOf(a: { domain: string; rows: readonly RankedRow[] }): SearchFootprint {
  const brand = brandOf(a.domain);
  const seen = new Set<string>();
  const searches = a.rows.filter((row) => {
    const key = row.keyword.trim().toLowerCase();
    if (key === "" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const descriptive = searches.filter((row) => isDescriptive(row.keyword, brand)).length;
  if (searches.length < SEARCH_FOOTPRINT.minSearches) {
    return { kind: "thin", because: "few_ranked_searches", searches: searches.length, descriptive };
  }
  if (descriptive < SEARCH_FOOTPRINT.minDescriptive) {
    return { kind: "thin", because: "brand_only", searches: searches.length, descriptive };
  }

  const pages: string[] = [];
  const listed = new Set<string>();
  for (const row of a.rows) {
    if (pages.length >= SEARCH_FOOTPRINT.maxPages) break;
    const title = row.title?.trim() ?? "";
    if (title === "" || row.url === "" || listed.has(row.url)) continue;
    listed.add(row.url);
    const snippet = row.description === undefined ? "" : cut(row.description, SEARCH_FOOTPRINT.snippetChars);
    pages.push(`- ${cut(title, 160)}${snippet === "" ? "" : ` — ${snippet}`} (${pathOf(row.url)})`);
  }

  const text = [
    `Site: ${a.domain}`,
    "",
    "Pages Google lists for this site, the most visited first, each as Google shows it (title — snippet):",
    ...(pages.length === 0 ? ["- none held"] : pages),
    "",
    "Searches this site ranks for on Google, the most visited first:",
    ...searches.slice(0, SEARCH_FOOTPRINT.maxSearches).map((row) => `- ${row.keyword}`),
  ].join("\n");
  return { kind: "read", text, searches: searches.length, descriptive, pages: pages.length };
}
