// src/lib/locale/site.ts — the country and language stored on a site
// (`sites.country`, `sites.language`; SPEC §6, owner D66, issue 1311).
//
// One reader and one writer. What is stored is the founder's answer at
// setup where they gave one, else what a pass read of the site. A stored
// pair is held to the list on the way out: a row that names a pair the
// list does not hold reads as none.
//
// The database is reached only when a row is read or written, never when
// this module is imported, so a caller that imports it needs no binding.
import { DEFAULT_LOCALE, localeOf, type Locale } from "./locales";
import { areaOf } from "./place";

/** Where the pair is kept. The product's is the `sites` row. */
export interface SiteLocaleStore {
  /** `market` is the site's stored market, which holds where it serves
   *  (`sites.market.area`, D67); a store that holds none leaves it out. */
  read(siteId: string): Promise<{ country: unknown; language: unknown; market?: unknown } | null>;
  write(siteId: string, locale: Locale): Promise<void>;
}

interface Row {
  country: unknown;
  language: unknown;
  market?: unknown;
}

interface MinimalClient {
  from(table: "sites"): {
    select(columns: string): {
      eq(column: string, value: string): { limit(n: number): PromiseLike<{ data: Row[] | null; error: { message: string } | null }> };
    };
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

async function client(): Promise<MinimalClient> {
  const { dbAdmin } = await import("@/lib/db");
  return dbAdmin() as unknown as MinimalClient;
}

const sitesRow: SiteLocaleStore = {
  async read(siteId) {
    const { data, error } = await (await client()).from("sites").select("country, language, market").eq("id", siteId).limit(1);
    if (error !== null) throw new Error(error.message);
    return data?.[0] ?? null;
  },
  async write(siteId, locale) {
    const { error } = await (await client()).from("sites").update({ country: locale.country, language: locale.language }).eq("id", siteId);
    if (error !== null) throw new Error(error.message);
  },
};

let store: SiteLocaleStore = sitesRow;

/** Puts another store in the `sites` row's place — a test's, which holds no
 *  database. `null` restores the row. */
export function registerSiteLocaleStore(other: SiteLocaleStore | null): void {
  store = other ?? sitesRow;
}

/** The site's stored locale, or `null` where none is stored yet. */
export async function readStoredLocale(siteId: string): Promise<Locale | null> {
  let row: Row | null;
  try {
    row = await store.read(siteId);
  } catch (error) {
    throw new Error(`readStoredLocale: ${error instanceof Error ? error.message : String(error)}`);
  }
  const locale = row === null ? null : localeOf(row.country, row.language);
  if (locale === null) return null;
  // D67 (issue 1318): a business that serves one place is measured there.
  const market = row?.market;
  const area = typeof market === "object" && market !== null ? areaOf((market as { area?: unknown }).area) : null;
  return area === null || area.place === null ? locale : { ...locale, place: area.place };
}

/**
 * The locale a site's work is done in: the stored one, else the United
 * States in English — what every site was measured in before D66. A read
 * that fails answers the same, and says so in the log: a page is never left
 * unwritten because one column could not be read.
 */
export async function siteLocale(siteId: string): Promise<Locale> {
  try {
    return (await readStoredLocale(siteId)) ?? DEFAULT_LOCALE;
  } catch (error) {
    console.log(
      JSON.stringify({ event: "site_locale_unreadable", siteId, because: error instanceof Error ? error.message : String(error) })
    );
    return DEFAULT_LOCALE;
  }
}

export async function writeSiteLocale(siteId: string, locale: Locale): Promise<void> {
  try {
    await store.write(siteId, locale);
  } catch (error) {
    throw new Error(`writeSiteLocale: ${error instanceof Error ? error.message : String(error)}`);
  }
}
