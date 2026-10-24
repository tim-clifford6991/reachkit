// src/lib/scan/pass/place.ts — where a pass is: the report's locale, a stated place and a town read from the site.
import type { Profile } from "@/lib/market/questions/profile";
import { townHolds } from "@/lib/market/rivals/reach";
import { DEFAULT_LOCALE, type Locale, type Place } from "@/lib/locale/locales";
import { listingLocaleOf } from "@/lib/locale/listing";
import { placeCandidates, placeOf, type PlaceFrom } from "@/lib/locale/place";
import type { DomainMeasurement } from "@/lib/measure";
import type { ReportLocale } from "../report";
import type { Sections } from "./sections";

/** What the report records of where it was measured (D66): nothing for the
 *  United States in English with no fallback, which is what every report
 *  before D66 was. */
export function reportLocale(m: DomainMeasurement): ReportLocale | null {
  const usual = m.locale.country === DEFAULT_LOCALE.country && m.locale.language === DEFAULT_LOCALE.language;
  const place = m.locale.place;
  const alsoServes = m.alsoServes ?? [];
  const guessed = m.localeBasis === "default";
  if (usual && !guessed && m.localeFellBack === null && place === undefined && alsoServes.length === 0) return null;
  const listing = guessed ? listingLocaleOf(m.ownRankedRows) : null;
  return {
    country: m.locale.country,
    language: m.locale.language,
    // D67 (issue 1441): the town the pass was measured in, which the
    // measurement line names.
    ...(place === undefined ? {} : { place }),
    ...(m.localeFellBack === null ? {} : { fellBack: m.localeFellBack }),
    ...(alsoServes.length === 0 ? {} : { alsoServes }),
    ...(guessed ? { basis: "default" as const } : {}),
    ...(listing === null || listing.country === m.locale.country ? {} : { listingReads: listing.country }),
  };
}

/** What a pass stores as the site's market where the founder set none: what
 *  it read of the site, else the country its listing reads as, and never a
 *  guess (D66). */
export function readSiteLocale(m: DomainMeasurement): Locale | null {
  return m.localeBasis === "default" ? listingLocaleOf(m.ownRankedRows) : m.locale;
}

/** The pass measures in `placed` from here on (issue 1441). */
export function inPlace(sections: Sections, placed: PassPlace): void {
  if (sections.measurement === null) return;
  sections.measurement = { ...sections.measurement, locale: { ...sections.measurement.locale, place: placed.place } };
  sections.placeFrom = placed.from;
}

/** The pass measures in its country again (issues 1454, 1480): the town
 *  `inPlace` set is not this business's market. */
export function outOfPlace(sections: Sections): void {
  if (sections.measurement === null) return;
  const locale: Locale = { ...sections.measurement.locale };
  delete locale.place;
  sections.measurement = { ...sections.measurement, locale };
  sections.placeFrom = null;
}

/** How long a free pass waits for the search vendor's list of cities: it
 *  answers in under a second, and a pass that does not have it measures in
 *  the country. */
const FREE_PLACE_LOOKUP_MS = 6_000;

/** A town a free pass measures in, and which evidence named it. */
interface PassPlace {
  place: Place;
  from: PlaceFrom;
}

/** The search vendor's name for `place` in the pass's country, or `null`
 *  where the list does not hold it or could not be read. Never throws. */
async function locatedIn(place: Place, m: DomainMeasurement, near: readonly Place[] = []): Promise<{ location: string | null } | null> {
  try {
    const { placeLocation } = await import("@/lib/vendors/dataforseo");
    return await placeLocation({ place, country: m.locale.country, timeoutMs: FREE_PLACE_LOOKUP_MS, near });
  } catch (error) {
    console.log(JSON.stringify({ event: "free_place_unlocated", because: error instanceof Error ? error.message : String(error) }));
    return null;
  }
}

function logPassPlace(fields: { from: PlaceFrom | null; place: string | null; location: string | null }): void {
  console.log(JSON.stringify({ event: "free_place_located", ...fields }));
}

/**
 * The town a free pass measures in from the home page's structured data
 * (D67; owner ruling 2026-10-15, issue 1441), in the order of the
 * evidence, stopping at the first that holds: the structured address
 * `statedPlace` reads, which stands even where the vendor's list does not
 * hold it (the town is searched by name and read in its country); then a
 * business's `areaServed`, and an address written as one string, each only
 * where the list holds the town in the site's country. `null` where none
 * holds or the pass already has a place: the profile call's reading of the
 * page is tried next (`townFromPage`). Never throws.
 */
export async function statedPlaceOfPass(m: DomainMeasurement): Promise<PassPlace | null> {
  if (m.locale.place !== undefined || m.stated === undefined) return null;
  const candidates = placeCandidates(m.stated);
  const served = candidates.filter((c) => c.from === "area_served").map((c) => c.place);
  for (const candidate of candidates) {
    const near = candidate.from === "area_served" ? served.filter((other) => other !== candidate.place) : [];
    const found = await locatedIn(candidate.place, m, near);
    if (candidate.from === "address" || (found !== null && found.location !== null)) {
      const location = found?.location ?? null;
      logPassPlace({ from: candidate.from, place: candidate.place.name, location });
      return { place: location === null ? candidate.place : { ...candidate.place, location }, from: candidate.from };
    }
  }
  return null;
}

/** Whether a free pass measures in `place` (issue 1480): `townHolds` over
 *  the profile and the home page the pass read, the paid path's rule. */
export function holdsTown(place: Place, profile: Profile, m: DomainMeasurement, domain: string): boolean {
  const held = townHolds({
    place,
    profile,
    ...(m.stated === undefined ? {} : { stated: m.stated }),
    home: m.text.home === null ? null : { url: `https://${domain}/`, title: "", text: m.text.home },
  });
  if (!held) console.log(JSON.stringify({ event: "free_place_dropped", because: "not_served" }));
  return held;
}

/** The town the profile call read off the home page's own words (rule 4 of
 *  issue 1441), where the vendor's list holds it in the site's country: a
 *  town the model made up, or one abroad, is dropped. */
export async function townFromPage(town: string | undefined, m: DomainMeasurement): Promise<PassPlace | null> {
  const place = placeOf(town);
  if (place === null) return null;
  const found = await locatedIn(place, m);
  if (found === null || found.location === null) {
    logPassPlace({ from: null, place: place.name, location: null });
    return null;
  }
  logPassPlace({ from: "page_text", place: place.name, location: found.location });
  return { place: { ...place, location: found.location }, from: "page_text" };
}
