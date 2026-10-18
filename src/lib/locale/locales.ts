// src/lib/locale/locales.ts — the countries and languages a site is measured
// in (SPEC §6, owner D66 of 2026-10-07, issue 1311).
//
// Data, not code: a country is one row of `COUNTRIES`, a language one row of
// `LANGUAGES` plus its pack under `./language/`. Every vendor read, every
// cache key and every sentence written for a site follows the pair chosen
// here, and a pair that is not on this list is never sent to a vendor.
//
// Pure: no I/O, no clock. Safe to import from anywhere, the browser included.

/** The languages ReachKit measures and writes in. */
export const LANGUAGES = Object.freeze({
  en: Object.freeze({ name: "English" }),
  de: Object.freeze({ name: "German" }),
} as const);

export type Language = keyof typeof LANGUAGES;

/**
 * The supported countries. `location` is the search vendor's own name for
 * the country (DataForSEO `location_name`), and `language` the one language
 * the country is measured in.
 *
 * The signals a home page is read by sit beside it: the country domain's
 * endings, the dialling prefix, the currency marks that belong to this
 * country alone, and the names an address spells it with.
 */
export const COUNTRIES = Object.freeze({
  US: Object.freeze({ location: "United States", language: "en", tlds: ["us"], phone: null, currency: ["USD", "US$"], names: ["United States", "USA"] }),
  GB: Object.freeze({ location: "United Kingdom", language: "en", tlds: ["uk"], phone: "44", currency: ["£", "GBP"], names: ["United Kingdom", "England", "Scotland", "Wales", "Northern Ireland"] }),
  IE: Object.freeze({ location: "Ireland", language: "en", tlds: ["ie"], phone: "353", currency: [], names: ["Ireland", "Éire"] }),
  AU: Object.freeze({ location: "Australia", language: "en", tlds: ["au"], phone: "61", currency: ["AUD", "A$", "AU$"], names: ["Australia"] }),
  CA: Object.freeze({ location: "Canada", language: "en", tlds: ["ca"], phone: null, currency: ["CAD", "C$", "CA$"], names: ["Canada"] }),
  DE: Object.freeze({ location: "Germany", language: "de", tlds: ["de"], phone: "49", currency: [], names: ["Deutschland", "Germany"] }),
  AT: Object.freeze({ location: "Austria", language: "de", tlds: ["at"], phone: "43", currency: [], names: ["Österreich", "Austria"] }),
  CH: Object.freeze({ location: "Switzerland", language: "de", tlds: ["ch"], phone: "41", currency: ["CHF"], names: ["Schweiz", "Switzerland", "Suisse", "Svizzera"] }),
} as const satisfies Record<string, CountryRow>);

interface CountryRow {
  location: string;
  language: Language;
  tlds: readonly string[];
  phone: string | null;
  currency: readonly string[];
  names: readonly string[];
}

export type Country = keyof typeof COUNTRIES;

/**
 * The one city or metro a business serves (SPEC §6, owner D67 of
 * 2026-10-07, issue 1318). A business with none sells nationally or online.
 */
export interface Place {
  /** As buyers there say it: "Austin", "Düsseldorf". */
  name: string;
  /** Its state, county or Land where that was read: "Texas". */
  region?: string;
  /** The search vendor's own name for it ("Austin,Texas,United States"),
   *  where the vendor lists it. Absent, a read is made in the country. */
  location?: string;
}

/** Where a site's buyers are and what they search in: one row of the list,
 *  and the place where the business serves one (D67). */
export interface Locale {
  country: Country;
  language: Language;
  place?: Place;
}

/** What a site with no signal is measured in, and what every site was
 *  measured in before D66. */
export const DEFAULT_LOCALE: Locale = Object.freeze({ country: "US", language: "en" });

export const SUPPORTED_LOCALES: readonly Locale[] = Object.freeze(
  (Object.keys(COUNTRIES) as Country[]).map((country) => Object.freeze({ country, language: COUNTRIES[country].language }))
);

export function isCountry(value: unknown): value is Country {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(COUNTRIES, value);
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LANGUAGES, value);
}

/** The locale two stored values name, or `null` where they are not a pair
 *  on the list. A stored row is read through this, never trusted. */
export function localeOf(country: unknown, language: unknown): Locale | null {
  if (!isCountry(country) || !isLanguage(language)) return null;
  return COUNTRIES[country].language === language ? { country, language } : null;
}

/** `"DE/de"`: how a locale is written in a cache key, a form value and a log. */
export function localeKey(locale: Locale): string {
  return `${locale.country}/${locale.language}`;
}

export function localeFromKey(key: unknown): Locale | null {
  if (typeof key !== "string") return null;
  const [country, language, ...rest] = key.split("/");
  return rest.length === 0 ? localeOf(country, language) : null;
}

/** The BCP-47 tag dates, numbers and a page's `lang` are written with. */
export function localeTag(locale: Locale): string {
  return `${locale.language}-${locale.country}`;
}

/** The supported English-speaking country nearest a country that is not on
 *  the list. A country named in neither row is read as the United States. */
const NEAREST_ENGLISH: Readonly<Record<string, Country>> = Object.freeze({
  // The Americas are read as the United States.
  // Europe, Africa and the Middle East are read as the United Kingdom.
  ...Object.fromEntries(
    (
      "AD AL BA BE BG BY CY CZ DK EE ES FI FR GR HR HU IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM TR UA VA " +
      "AE BH EG GH IL JO KE KW MA NG OM QA SA TN TZ UG ZA ZW"
    )
      .split(" ")
      .map((code): [string, Country] => [code, "GB"])
  ),
  // Asia and the Pacific are read as Australia.
  ...Object.fromEntries(
    "BD CN FJ HK ID IN JP KH KR LK MY NP NZ PG PH PK SG TH TW VN".split(" ").map((code): [string, Country] => [code, "AU"])
  ),
});

/** The country a language is at home in, where a page says its language
 *  and nothing says its country. */
const LANGUAGE_HOME: Readonly<Record<string, string>> = Object.freeze({
  de: "DE", fr: "FR", es: "ES", it: "IT", nl: "NL", pt: "PT", sv: "SE", da: "DK", nb: "NO", no: "NO", fi: "FI",
  pl: "PL", cs: "CZ", el: "GR", hu: "HU", ro: "RO", tr: "TR", ja: "JP", ko: "KR", zh: "CN", hi: "IN", id: "ID", he: "IL",
});

/** The language a country's own sites are written in, where that is known:
 *  a supported country's row, else the language whose home it is. India
 *  writes in English as much as in Hindi, so it is not read either way. */
export function homeLanguageOf(country: string): string | null {
  if (isCountry(country)) return COUNTRIES[country].language;
  if (country === "IN") return null;
  return Object.entries(LANGUAGE_HOME).find(([, home]) => home === country)?.[0] ?? null;
}

/** What a home page says of itself, before it is held to the list: any
 *  ISO country and any language, or `null` where nothing said. */
export interface LocaleReading {
  country: string | null;
  language: string | null;
}

/** A reading held to the list. `fellBack` is what the site said that is not
 *  measured — the one line the report owes the reader (D66). */
export interface ResolvedLocale {
  locale: Locale;
  fellBack: { country: string | null; language: string | null } | null;
}

/**
 * The supported locale a reading is measured in (D66).
 *
 * A pair on the list is itself. A German page whose country is not on the
 * list is read in Germany. Anything else falls back to the nearest
 * supported country in English, and says what it fell back from. A reading
 * that says nothing is the United States in English, and that is no
 * fallback: nothing was said that is not being measured.
 */
export function resolveLocale(reading: LocaleReading): ResolvedLocale {
  const language = reading.language === null ? null : reading.language.toLowerCase();
  const country = (reading.country ?? (language === null ? null : (LANGUAGE_HOME[language] ?? null)))?.toUpperCase() ?? null;
  if (country === null && language === null) return { locale: DEFAULT_LOCALE, fellBack: null };

  if (isCountry(country)) {
    const own = COUNTRIES[country].language;
    if (language === null || language === own) return { locale: { country, language: own }, fellBack: null };
  }
  if (language === "en" && country === null) return { locale: DEFAULT_LOCALE, fellBack: null };
  if (language === "de" && !isCountry(country)) {
    return { locale: { country: "DE", language: "de" }, fellBack: country === null ? null : { country, language: null } };
  }
  const near: Country =
    isCountry(country) && COUNTRIES[country].language === "en" ? country : ((country === null ? undefined : NEAREST_ENGLISH[country]) ?? (isCountry(country) ? "GB" : "US"));
  return {
    locale: { country: near, language: "en" },
    fellBack: {
      country: country !== null && country !== near ? country : null,
      language: language !== null && language !== "en" ? language : null,
    },
  };
}

/** The locale a stored record was measured in (`StoredReport.locale`): the
 *  pair it names where that is on the list, else the United States in
 *  English, which is what a record that names none was measured in. */
export function measuredLocale(record: { locale?: { country?: unknown; language?: unknown } | undefined }): Locale {
  return localeOf(record.locale?.country, record.locale?.language) ?? DEFAULT_LOCALE;
}
