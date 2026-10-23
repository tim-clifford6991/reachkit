// src/lib/locale/listing.ts — the country a site's own Google listing names,
// where its home page could not be read (SPEC §6, D66).
//
// The rows are the ranked rows a pass already bought with their title and
// snippet (`listing: true`), so the reading costs nothing. Each row names at
// most one country, by the text signals the home page is read by; the
// listing names the country that leads them clearly, or none.
//
// Pure: no fetch, no model call, no clock.
import { COUNTRIES, isCountry, type Country, type Locale } from "./locales";
import { countryOfCurrency, countryOfDomain, countryOfPhone, countryOfPostcode } from "./read";

/** The leading country must be named by at least this many times the rows
 *  of the next, as `languageOfText` asks of a language. */
export const LISTING_LEAD = 3;
/** And by at least this many rows: one snippet is no listing. */
export const LISTING_MIN_ROWS = 3;

const NAMES: readonly (readonly [string, Country])[] = (Object.keys(COUNTRIES) as Country[])
  .flatMap((country) => COUNTRIES[country].names.map((name) => [name, country] as const))
  // Longest first, so "Northern Ireland" is never read as Ireland.
  .sort((a, b) => b[0].length - a[0].length);
const NAMED = new RegExp(`(?<!\\p{L})(?:${NAMES.map(([name]) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?!\\p{L})`, "gu");

/** The supported country a text names most often, or `null`. */
function countryNamedIn(text: string): Country | null {
  const counts = new Map<Country, number>();
  for (const match of text.matchAll(NAMED)) {
    const country = NAMES.find(([name]) => name === match[0])![1];
    counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** The one country a listing row names, strongest signal first. */
function countryOfRow(row: { url: string; title?: string; description?: string }): string | null {
  const text = `${row.title ?? ""}\n${row.description ?? ""}`;
  return (
    countryOfDomain(hostOf(row.url)) ??
    countryOfPhone(text) ??
    countryOfCurrency(text) ??
    countryOfPostcode(text) ??
    countryNamedIn(text)
  );
}

/** The supported locale a site's listing reads as, or `null` where no
 *  country leads its rows clearly. */
export function listingLocaleOf(rows: readonly { url: string; title?: string; description?: string }[]): Locale | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const country = countryOfRow(row);
    if (country !== null) counts.set(country, (counts.get(country) ?? 0) + 1);
  }
  const [first, second] = [...counts].sort((a, b) => b[1] - a[1]);
  if (first === undefined || first[1] < LISTING_MIN_ROWS) return null;
  if (second !== undefined && first[1] < LISTING_LEAD * second[1]) return null;
  const country = first[0];
  return isCountry(country) ? { country, language: COUNTRIES[country].language } : null;
}
