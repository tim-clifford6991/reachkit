// src/lib/locale/place.ts — the one place a local business serves, and how
// a search says it (SPEC §6, owner D67 of 2026-10-07, issue 1318).
//
// A plumber in Austin was measured on "emergency plumber" (74,000 searches
// a month across the United States) against Roto-Rooter. A business that
// serves one area is measured where it serves: its searches are the service
// plus the place, and its rivals are the ones found there.
//
// Pure: it reads the text it is handed. No fetch, no model call, no clock.
import type { Place } from "./locales";

/** What is stored of where a site serves (`sites.market.area`). `place` is
 *  `null` for a business that sells nationally or online. */
export interface ServingArea {
  place: Place | null;
  /** Whose answer it is: the founder's at setup, which stands, or what a
   *  pass read of the site. */
  by: "founder" | "read";
  /** True once the search vendor's list was read for `place`, whether or
   *  not it held it: a place the vendor does not list is not asked again. */
  located?: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** A place as it is kept: a name of letters, at most sixty characters. A
 *  founder's "Austin, TX" is the name "Austin" in the region "TX". */
export function placeOf(name: unknown, region?: unknown): Place | null {
  const [head, ...rest] = text(name, 80).split(/\s*,\s*/);
  const named = (head ?? "").replace(/[^\p{L}\p{N}\s.'’-]/gu, "").trim().slice(0, 60);
  if (!/\p{L}{2}/u.test(named)) return null;
  const within = text(region, 60) || (rest[0] ?? "").slice(0, 60);
  return { name: named, ...(within === "" ? {} : { region: within }) };
}

/** The stored value, read defensively: anything else is "not read yet". */
export function areaOf(value: unknown): ServingArea | null {
  if (!isRecord(value) || (value.by !== "founder" && value.by !== "read")) return null;
  const located = value.located === true ? { located: true as const } : {};
  if (value.place === null) return { place: null, by: value.by, ...located };
  if (!isRecord(value.place)) return null;
  const place = placeOf(value.place.name, value.place.region);
  if (place === null) return null;
  const location = text(value.place.location, 160);
  return { place: { ...place, ...(location === "" ? {} : { location }) }, by: value.by, ...located };
}

/** Lower case, accents folded, punctuation to spaces: how a place and a
 *  search are compared. "Düsseldorf" and "Dusseldorf" are one place. */
export function folded(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** The spellings a search names the place by: its name, and a German name
 *  with its umlauts written out ("duesseldorf"). */
function forms(place: Place): string[] {
  const written = folded(place.name.replace(/ä/gi, "ae").replace(/ö/gi, "oe").replace(/ü/gi, "ue"));
  return [...new Set([folded(place.name), written])].filter((form) => form.length >= 2);
}

/** Whether a search names the place. */
export function namesPlace(search: string, place: Place): boolean {
  const said = ` ${folded(search)} `;
  return forms(place).some((form) => said.includes(` ${form} `));
}

const EDGE_BEFORE = "(?<![\\p{L}\\p{N}])";
const EDGE_AFTER = "(?![\\p{L}\\p{N}])";

/** "near me", in every supported language at once: the searcher's own
 *  position stands in for a place. */
const NEAR_ME = new RegExp(
  `${EDGE_BEFORE}(?:near ?by|near me|close to me|around me|in my area|in (?:der|meiner) n(?:ä|ae)he(?: von mir)?|bei mir)${EDGE_AFTER}`,
  "giu"
);

export function saysNearMe(search: string): boolean {
  NEAR_ME.lastIndex = 0;
  return NEAR_ME.test(search);
}

/** Whether a search is asked of one place: it names this one, or says
 *  "near me". */
export function isLocalSearch(search: string, place: Place): boolean {
  return namesPlace(search, place) || saysNearMe(search);
}

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+([,?!.])/g, "$1").trim();
}

/**
 * A search without its place: "emergency plumber austin tx" is "emergency
 * plumber", and so is "emergency plumber near me". What a prompt or a
 * sentence names the service by, before it says the place itself.
 */
export function withoutPlace(search: string, place: Place): string {
  let out = search.replace(NEAR_ME, " ");
  const region = place.region === undefined ? "" : folded(place.region);
  for (const form of forms(place)) {
    // The search's own spelling of the place is found by position: both
    // sides are folded letter for letter where that keeps their length.
    const words = form.split(" ").map((word) => word.split("").map(letterPattern).join("").split("(?:s|ß)(?:s|ß)").join("(?:ss|ß)"));
    // What may follow the name as part of it: its region, or a state's two
    // letters where they close the search ("austin tx").
    const after = `(?:[\\s,]+(?:${region === "" ? "(?!)" : region.split(" ").map(escaped).join("\\s+")}|[A-Za-z]{2}(?=\\s*$)))?`;
    out = out.replace(new RegExp(`${EDGE_BEFORE}(?:in\\s+)?${words.join("[\\s-]+")}${after}${EDGE_AFTER}`, "giu"), " ");
  }
  const left = tidy(out).replace(/^[\s,–-]+|[\s,–-]+$/g, "");
  return left === "" ? tidy(search) : left;
}

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One folded letter as the letters it may have been written with. */
function letterPattern(letter: string): string {
  const variants: Record<string, string> = { a: "[aäàáâ]", e: "[eèéêë]", i: "[iìíîï]", o: "[oöòóô]", u: "[uüùúû]", s: "(?:s|ß)", c: "[cç]", n: "[nñ]" };
  return variants[letter] ?? escaped(letter);
}

/**
 * A search as a local business is measured on it (D67): the service plus
 * the place. One that already names the place stands; "near me" gives way
 * to the place's name; anything else has the name added. Lower case where
 * the search is.
 */
export function localSearch(search: string, place: Place): string {
  const said = tidy(search);
  if (said === "" || namesPlace(said, place)) return said;
  const service = tidy(said.replace(NEAR_ME, " "));
  const name = service === service.toLowerCase() ? place.name.toLowerCase() : place.name;
  return tidy(`${service} ${name}`);
}

/** The words a search may hold because they name where the business is:
 *  the place and its region. They are no part of what it sells. */
export function placeWords(place: Place): string[] {
  return [place.name, ...(place.region === undefined ? [] : [place.region])];
}

// ── What a home page states of where the business is ───────────────────────

/** What a page's structured data says of the business's address: the one
 *  place a site states its town as a field. */
export interface PlaceSignals {
  locality?: string;
  region?: string;
  /** The areas it says it serves (`areaServed`). */
  serves?: readonly string[];
  telephone?: string;
  /** The schema.org type it gives itself: "Plumber", "Restaurant". */
  type?: string;
}

function field(html: string, name: string): string {
  const match = new RegExp(`"${name}"\\s*:\\s*(?:"([^"]{2,80})"|\\{[^}]*?"name"\\s*:\\s*"([^"]{2,80})")`, "i").exec(html);
  return text(match?.[1] ?? match?.[2] ?? "", 80);
}

/** schema.org's types for an organisation that is no local business, and
 *  for things that are not a business at all. */
const NOT_A_BUSINESS_TYPE = /^(?:Organization|Corporation|WebSite|WebPage|Person|Brand|Product|Article|BlogPosting|BreadcrumbList|ImageObject|SearchAction|ItemList|ListItem|FAQPage|Question|Answer|Offer|PostalAddress|GeoCoordinates|OpeningHoursSpecification|AggregateRating|Review|Rating|ContactPoint|Service|Place|Country|City|State|EntryPoint|ReadAction|SiteNavigationElement|WPHeader|WPFooter|CollectionPage|AboutPage|ContactPage|NGO|EducationalOrganization|OnlineBusiness|OnlineStore)$/;

/** The address fields of a page's structured data, each where it is given. */
export function readPlaceSignals(html: string | null): PlaceSignals {
  if (html === null) return {};
  const serves: string[] = [];
  const served = /"areaServed"\s*:\s*(\[[^\]]{0,600}\]|"[^"]{2,80}"|\{[^}]{0,300}\})/i.exec(html)?.[1] ?? "";
  for (const match of served.matchAll(/"(?:name"\s*:\s*")?([^"@{}[\]:]{2,60})"/g)) {
    const name = text(match[1], 60);
    if (name !== "" && !/^(?:name|City|State|Place|Country|AdministrativeArea|GeoCircle)$/.test(name) && !serves.includes(name)) serves.push(name);
  }
  const telephone = field(html, "telephone") || text(/href="tel:([^"]{6,24})"/i.exec(html)?.[1] ?? "", 24);
  const types = [...html.matchAll(/"@type"\s*:\s*(?:"([A-Za-z]{3,40})"|\[\s*"([A-Za-z]{3,40})")/g)].map((m) => m[1] ?? m[2] ?? "");
  const type = types.find((each) => !NOT_A_BUSINESS_TYPE.test(each));
  const locality = field(html, "addressLocality");
  const region = field(html, "addressRegion");
  return {
    ...(locality === "" ? {} : { locality }),
    ...(region === "" ? {} : { region }),
    ...(serves.length === 0 ? {} : { serves: serves.slice(0, 6) }),
    ...(telephone === "" ? {} : { telephone }),
    ...(type === undefined ? {} : { type }),
  };
}

/**
 * The place a home page states for a business that says it is a local one:
 * structured data of a `LocalBusiness` kind (any business type that is not
 * a plain organisation) with a town in its address. `null` where the page
 * states none — which says nothing either way; a pass's market call reads
 * the rest of the site.
 */
export function readPlace(html: string | null): Place | null {
  const signals = readPlaceSignals(html);
  if (signals.type === undefined || signals.locality === undefined) return null;
  return placeOf(signals.locality, signals.region);
}
