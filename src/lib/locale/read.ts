// src/lib/locale/read.ts — a site's country and language, read from its own
// address and home page (SPEC §6, owner D66 of 2026-10-07, issue 1311).
//
// Five signals, the ones D66 names: the country domain, `<html lang>`, the
// currency, the address and the phone prefix. Each names a country or
// nothing; the country is the one the strongest signal names. The language
// is the page's own `lang`, else the country's.
// The hreflang entry the home page declares for the address asked for
// outranks them all: a geo redirect changes the page served, not that.
//
// Pure: it reads the bytes it is handed. No fetch, no model call, no clock.
import { parse, type HTMLElement } from "node-html-parser";
import { COUNTRIES, homeLanguageOf, resolveLocale, type Country, type Locale, type LocaleReading, type ResolvedLocale } from "./locales";

/** Country endings sold as generic names: they say nothing of where a
 *  business is (issue 1480: nifty.pm is project software, not St Pierre and
 *  Miquelon). The page's other signals still say where it is. */
const GENERIC_CC_TLDS: ReadonlySet<string> = new Set([
  "ai", "io", "co", "me", "tv", "cc", "fm", "ly", "gg", "to", "sh", "so", "im", "la", "ws", "vc", "eu",
  "pm", "am", "gl", "md", "ms", "nu", "st", "tk", "cx", "ag", "bz",
]);

/** ISO 3166-1's two-letter codes, which is every country ending but `.uk`
 *  (Britain's code is GB). An ending that is no country's (`.ac`, `.su`)
 *  names none. */
const ISO_COUNTRIES: ReadonlySet<string> = new Set(
  (
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
    "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
    "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
    "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
    "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
    "UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
  ).split(" ")
);

const TLD_COUNTRY: ReadonlyMap<string, string> = new Map(
  (Object.keys(COUNTRIES) as Country[]).flatMap((country) => COUNTRIES[country].tlds.map((tld) => [tld, country] as const))
);

/** The country an address's ending names: `.de`, `.co.uk`, `.com.au`. A
 *  generic ending names none; any other country's ending names it. */
export function countryOfDomain(domain: string): string | null {
  const tld = domain.toLowerCase().replace(/\.$/, "").split(".").pop() ?? "";
  if (!/^[a-z]{2}$/.test(tld) || GENERIC_CC_TLDS.has(tld)) return null;
  const country = TLD_COUNTRY.get(tld) ?? tld.toUpperCase();
  return ISO_COUNTRIES.has(country) ? country : null;
}

/** `de-AT` → German, Austria. `en` → English, no country. */
function ofLangTag(tag: string | undefined): LocaleReading {
  const match = /^\s*([a-z]{2,3})(?:[-_]([a-z]{2}))?\b/i.exec(tag ?? "");
  if (match === null) return { country: null, language: null };
  return { language: match[1]!.toLowerCase(), country: match[2] === undefined ? null : match[2].toUpperCase() };
}

const PHONE_COUNTRY: ReadonlyMap<string, Country> = new Map(
  (Object.keys(COUNTRIES) as Country[]).flatMap((country) => {
    const prefix = COUNTRIES[country].phone;
    return prefix === null ? [] : [[prefix, country] as const];
  })
);
/** Longest first, so `+353` is Ireland and never `+35…`. */
const PHONE_PREFIXES = [...PHONE_COUNTRY.keys()].sort((a, b) => b.length - a.length);

/** The country the first international number names. `+1` names two
 *  countries, so it names none. */
function countryOfPhone(text: string): Country | null {
  for (const match of text.matchAll(/(?:\+|\b00)\s?(\d[\d\s().\-/]{6,18}\d)/g)) {
    const digits = match[1]!.replace(/\D/g, "");
    const prefix = PHONE_PREFIXES.find((each) => digits.startsWith(each));
    if (prefix !== undefined) return PHONE_COUNTRY.get(prefix)!;
  }
  return null;
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The country whose own currency mark the page shows most. The dollar and
 *  the euro belong to no one country and are not read. */
function countryOfCurrency(text: string): Country | null {
  let best: { country: Country; count: number } | null = null;
  for (const country of Object.keys(COUNTRIES) as Country[]) {
    let count = 0;
    for (const mark of COUNTRIES[country].currency) {
      const pattern = /^[A-Z]{3}$/.test(mark) ? `\\b${mark}\\b` : escaped(mark);
      count += [...text.matchAll(new RegExp(`${pattern}\\s?\\d|\\d\\s?${pattern}`, "g"))].length;
    }
    if (count > 0 && (best === null || count > best.count)) best = { country, count };
  }
  return best?.country ?? null;
}

/** How each country writes a postcode beside a town, where that is its own:
 *  a British postcode, a Canadian one, an Australian state and its four
 *  digits. The five German digits are also Austria's four and Switzerland's,
 *  near enough, so those are told apart by the country's name. */
const POSTCODES: readonly (readonly [Country, RegExp])[] = [
  ["GB", /\b[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}\b/],
  ["CA", /\b[ABCEGHJ-NPRSTVXY]\d[A-Z] \d[A-Z]\d\b/],
  ["AU", /\b(?:NSW|VIC|QLD|TAS|ACT)\s+\d{4}\b/],
];

/** The country an address on the page names: its name on an address line,
 *  or a postcode only that country writes. A country named in a sentence
 *  ("we ship to Canada") is no address: the name counts where it is a line
 *  of its own, or shares a short line with a postcode. */
function countryOfAddress(text: string): Country | null {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line !== "" && line.length <= 80);
  let best: { country: Country; count: number } | null = null;
  for (const country of Object.keys(COUNTRIES) as Country[]) {
    const names = COUNTRIES[country].names.map(escaped).join("|");
    const alone = new RegExp(`^(?:${names})$`, "iu");
    const within = new RegExp(`(?<![\\p{L}])(?:${names})(?![\\p{L}])`, "u");
    const count = lines.filter((line) => alone.test(line) || (/\b\d{4,5}\b/.test(line) && within.test(line))).length;
    if (count > 0 && (best === null || count > best.count)) best = { country, count };
  }
  if (best !== null) return best.country;
  for (const [country, pattern] of POSTCODES) if (pattern.test(text)) return country;
  return null;
}

/** The words only one language uses all the time. A page is in the language
 *  whose words it mostly uses, whatever its `lang` attribute was left at. */
const FUNCTION_WORDS: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  en: new Set(["the", "and", "for", "with", "our", "you", "your", "are", "from", "that", "this", "have", "we", "of"]),
  de: new Set(["und", "der", "die", "das", "für", "mit", "nicht", "wir", "sie", "ist", "unsere", "auf", "von", "eine", "sich", "auch"]),
});
const WORDS_TO_DECIDE = 12;

/** The supported language the page's own words are in, or `null` where
 *  there are too few to say or no one language leads three to one. */
export function languageOfText(text: string): string | null {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/\p{L}+/gu) ?? []) {
    for (const [language, words] of Object.entries(FUNCTION_WORDS)) {
      if (words.has(word)) counts.set(language, (counts.get(language) ?? 0) + 1);
    }
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (first === undefined || first[1] < WORDS_TO_DECIDE) return null;
  return second === undefined || first[1] >= 3 * second[1] ? first[0] : null;
}

/** A structured `addressCountry` as a country code. */
function countryOfStated(value: string): string | null {
  if (/^[A-Za-z]{2}$/.test(value)) return value.toUpperCase() === "UK" ? "GB" : value.toUpperCase();
  for (const country of Object.keys(COUNTRIES) as Country[]) {
    if (COUNTRIES[country].names.some((name) => name.toLowerCase() === value.toLowerCase())) return country;
  }
  return null;
}

/** `addressCountry` out of the page's structured data: the one place a
 *  site states its country as a field. A firm that lists offices in several
 *  countries states none of them as its own (issue 1480: stripe.com lists
 *  24, Singapore first, and was measured in Australia for it). */
function countryOfStructuredData(html: string): string | null {
  const stated = new Set<string>();
  for (const match of html.matchAll(/"addressCountry"\s*:\s*(?:"([^"]{2,40})"|\{[^}]*?"name"\s*:\s*"([^"]{2,40})")/gi)) {
    const country = countryOfStated((match[1] ?? match[2] ?? "").trim());
    if (country !== null) stated.add(country);
  }
  return stated.size === 1 ? [...stated][0]! : null;
}

/** The `<link rel="alternate" hreflang>` entries of a home document: each
 *  value lowercased, beside the address it names. */
function alternatesOf(root: HTMLElement, base: string): { tag: string; url: URL }[] {
  return root.querySelectorAll("link").flatMap((link) => {
    const tag = link.getAttribute("hreflang")?.trim().toLowerCase().replace(/_/g, "-");
    const href = link.getAttribute("href");
    if (!/\balternate\b/i.test(link.getAttribute("rel") ?? "") || tag === undefined || tag === "" || href === undefined) return [];
    try {
      return [{ tag, url: new URL(href, base) }];
    } catch {
      return [];
    }
  });
}

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

/** The market the site declares for the address it was asked for, whatever
 *  variant was served: its hreflang entry for `https://<domain>/`, a
 *  language and region ahead of a language alone. `x-default` names none. */
function declaredFor(alternates: readonly { tag: string; url: URL }[], domain: string): LocaleReading | null {
  const own = alternates
    .filter((a) => a.tag !== "x-default" && bareHost(a.url.hostname) === bareHost(domain) && (a.url.pathname === "/" || a.url.pathname === ""))
    .map((a) => ofLangTag(a.tag))
    .filter((reading) => reading.language !== null)
    .sort((a, b) => Number(b.country !== null) - Number(a.country !== null));
  return own[0] ?? null;
}

/**
 * What the site says of itself (D66). Where its hreflang entries name a
 * market for the address asked for, that market's language is the
 * language, and its region the country where the domain has no country
 * ending. Otherwise the country, strongest signal first:
 * its country domain, the country its structured data states, the phone
 * prefix, the address, the region of `<html lang>`, the currency. The
 * language is the one the page's own words are in, where they say; else
 * `<html lang>`'s. Many sites leave `lang` at their builder's "en-US".
 *
 * After the domain, a country is read in the page's language (issue 1480):
 * an office in a country whose sites are written in another language says
 * where the firm is, not where the buyers it writes for are: monday.com's
 * English page states an address in Israel, and typeform.com's one in Spain.
 *
 * `html` is `null` where the home page was not read: the address alone is
 * read then.
 */
export function readLocaleSignals(a: { domain: string; html: string | null }): LocaleReading {
  const fromDomain = countryOfDomain(a.domain);
  if (a.html === null) return { country: fromDomain, language: null };

  const root = parse(a.html, { blockTextElements: { script: false, style: false, noscript: false } });
  const lang = ofLangTag(root.querySelector("html")?.getAttribute("lang"));
  const telephones = root.querySelectorAll('a[href^="tel:"]').map((link) => link.getAttribute("href") ?? "").join(" ");
  const text = root.querySelector("body")?.structuredText ?? root.structuredText;

  // What the site declares for this address outranks the variant a geo redirect served.
  const declared = declaredFor(alternatesOf(root, `https://${a.domain}/`), a.domain);
  // A `lang` the page's own words contradict says nothing of its country either.
  const written = languageOfText(text);
  const language = declared?.language ?? written ?? lang.language;
  const langHolds = written === null || written === lang.language;
  const inLanguage = (country: string | null): string | null => {
    const home = country === null ? null : homeLanguageOf(country);
    return language === null || home === null || home === language ? country : null;
  };
  const country =
    fromDomain ??
    declared?.country ??
    inLanguage(countryOfStructuredData(a.html)) ??
    inLanguage(countryOfPhone(`${telephones} ${text}`)) ??
    inLanguage(countryOfAddress(text)) ??
    (langHolds ? lang.country : null) ??
    inLanguage(countryOfCurrency(text));
  return { country, language };
}

/** The supported locale a site is measured in, read from its address and
 *  home page, and what of the reading is not measured. */
export function readLocale(a: { domain: string; html: string | null }): ResolvedLocale {
  return resolveLocale(readLocaleSignals(a));
}

/** English words that are also language codes: a path that starts with one
 *  is no language switcher unless it carries a region (`/it-it/`). */
const WORD_CODES: ReadonlySet<string> = new Set(
  "it do be me no is am as at in on or so to us we my an go hi id up".split(" ")
);
const LANGUAGE_NAMES = new Intl.DisplayNames("en", { type: "language", fallback: "none" });

function isLanguageCode(code: string): boolean {
  try {
    return LANGUAGE_NAMES.of(code) !== undefined;
  } catch {
    return false;
  }
}

/** The locale a path's first segment names (`/de/`, `/en-gb/`), as a
 *  lowercase tag, or `null`. A bare English word that is also a code is
 *  none unless it carries a region. */
function pathLocaleOf(pathname: string): string | null {
  const match = /^([a-z]{2})(?:[-_]([a-z]{2}))?$/i.exec(pathname.split("/")[1] ?? "");
  if (match === null || !isLanguageCode(match[1]!.toLowerCase())) return null;
  if (match[2] === undefined && WORD_CODES.has(match[1]!.toLowerCase())) return null;
  return match[2] === undefined ? match[1]!.toLowerCase() : `${match[1]!.toLowerCase()}-${match[2].toLowerCase()}`;
}

/** Whether a tag names the measured market: its language, in its country
 *  or in none. */
function measuredBy(measured: Locale): (tag: string) => boolean {
  return (tag) => {
    const reading = ofLangTag(tag);
    return reading.language === measured.language && (reading.country === null || reading.country === measured.country);
  };
}

/** The same-host addresses a home document links to. */
function ownLinksOf(root: HTMLElement, base: string, host: string): URL[] {
  return root.querySelectorAll("a[href]").flatMap((link) => {
    try {
      const url = new URL(link.getAttribute("href") ?? "", base);
      return (url.protocol === "https:" || url.protocol === "http:") && bareHost(url.hostname) === host ? [url] : [];
    } catch {
      return [];
    }
  });
}

/**
 * The other markets a home document says its site serves, as BCP-47 tags
 * without the one measured: its hreflang values where it declares any,
 * else its language switcher — two or more same-host locale paths, and the
 * same name under other country endings. Under-reports by design: it reads
 * only the bytes handed to it.
 */
export function marketsServed(a: { domain: string; html: string; measured: Locale }): string[] {
  const base = `https://${a.domain}/`;
  const root = parse(a.html, { blockTextElements: { script: false, style: false, noscript: false } });
  const measured = measuredBy(a.measured);
  const alternates = alternatesOf(root, base);
  if (alternates.length > 0) return [...new Set(alternates.map((each) => each.tag))].filter((tag) => tag !== "x-default" && !measured(tag));

  const host = bareHost(a.domain);
  const name = host.split(".")[0]!;
  const paths = new Set(ownLinksOf(root, base, host).flatMap((url) => pathLocaleOf(url.pathname) ?? []));
  const endings = new Set<string>();
  for (const link of root.querySelectorAll("a[href]")) {
    let url: URL;
    try {
      url = new URL(link.getAttribute("href") ?? "", base);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const other = bareHost(url.hostname);
    if (other !== host && other.split(".")[0] === name) {
      const country = countryOfDomain(other);
      if (country !== null && country !== a.measured.country) endings.add(`und-${country.toLowerCase()}`);
    }
  }
  return [...(paths.size >= 2 ? [...paths] : []), ...endings].filter((tag) => !measured(tag));
}

/**
 * Whether an address stands in another market's section of a site that
 * splits its markets by path or subdomain, as its home document shows it:
 * a first path segment naming another market, or a host its hreflang gives
 * only to other markets. Answers `false` for every address of a site that
 * shows no split, so a single-market site loses no page.
 */
export function outsideMarket(a: { domain: string; html: string; measured: Locale }): (url: string) => boolean {
  const base = `https://${a.domain}/`;
  const host = bareHost(a.domain);
  const root = parse(a.html, { blockTextElements: { script: false, style: false, noscript: false } });
  const measured = measuredBy(a.measured);
  const alternates = alternatesOf(root, base).filter((each) => each.tag !== "x-default");
  const sections = new Set([
    ...ownLinksOf(root, base, host).flatMap((url) => pathLocaleOf(url.pathname) ?? []),
    ...alternates.flatMap((each) => (bareHost(each.url.hostname) === host ? (pathLocaleOf(each.url.pathname) ?? []) : [])),
  ]);
  const ours = new Set(alternates.filter((each) => measured(each.tag)).map((each) => bareHost(each.url.hostname)));
  const otherHosts = new Set(
    alternates.map((each) => bareHost(each.url.hostname)).filter((other) => other !== host && !ours.has(other))
  );
  const byPath = sections.size >= 2 || (sections.size === 1 && alternates.length > 0);
  if (!byPath && otherHosts.size === 0) return () => false;
  return (raw) => {
    let url: URL;
    try {
      url = new URL(raw, base);
    } catch {
      return false;
    }
    const other = bareHost(url.hostname);
    if (otherHosts.has(other)) return true;
    const section = other === host && byPath ? pathLocaleOf(url.pathname) : null;
    return section !== null && !measured(section);
  };
}
