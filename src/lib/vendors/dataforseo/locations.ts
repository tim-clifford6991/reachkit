// src/lib/vendors/dataforseo/locations.ts — the vendor's own name for a
// city (SPEC §6, owner D67 of 2026-10-07, issue 1318).
//
// A business that serves one place is measured there: Google's results,
// organic and AI Mode, are read from its city. The vendor takes a location
// only by a name on its own list ("Austin,Texas,United States"), so the
// place a site serves is looked up on that list once and the name is kept
// with the site (`sites.market.area`).
//
// **The list is free** (`GET /v3/serp/google/locations/{country}`, charged
// 0 by the vendor), so nothing is ledgered and no `CostContext` is taken.
// It is large — 19 MB for the United States — which is why it is read once
// a site and never in a request a person is waiting on.
//
// Pure apart from that one GET. Never throws.
import { COUNTRIES, type Country, type Place } from "@/lib/locale/locales";
import { folded } from "@/lib/locale/place";
import { sendGet } from "./transport";

/** How long the list may take: it is one large body. */
const LIST_TIMEOUT_MS = 45_000;

/** The kinds of location a business serves, best first. A postcode, a
 *  neighbourhood or an airport is never a serving area. */
const KINDS = ["City", "Post town", "Municipality", "Borough", "Town"] as const;

/** Cities Google's list names in English where their own language names
 *  them otherwise. */
const EXONYMS: Readonly<Record<string, string>> = Object.freeze({
  munchen: "munich",
  koln: "cologne",
  wien: "vienna",
  nurnberg: "nuremberg",
  hannover: "hanover",
  braunschweig: "brunswick",
  genf: "geneva",
});

/** The United States' states and Canada's provinces by their postal code:
 *  a founder writes "Portland, OR" and the list says "Oregon". */
const REGION_CODES: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    (
      "AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|FL Florida|GA Georgia|" +
      "HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|" +
      "MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|" +
      "NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|" +
      "RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|" +
      "WV West Virginia|WI Wisconsin|WY Wyoming|DC District of Columbia|" +
      "AB Alberta|BC British Columbia|MB Manitoba|NB New Brunswick|NL Newfoundland and Labrador|NS Nova Scotia|ON Ontario|" +
      "PE Prince Edward Island|QC Quebec|SK Saskatchewan|" +
      "NSW New South Wales|VIC Victoria|QLD Queensland|TAS Tasmania|ACT Australian Capital Territory|NRW North Rhine-Westphalia"
    )
      .split("|")
      .map((entry) => {
        const [code, ...name] = entry.split(" ");
        return [code!.toLowerCase(), folded(name.join(" "))] as const;
      })
  )
);

interface ListedLocation {
  name: string;
  kind: string;
}

function listed(payload: unknown): ListedLocation[] {
  const tasks = (payload as { tasks?: unknown } | null)?.tasks;
  const result = Array.isArray(tasks) ? (tasks[0] as { result?: unknown } | undefined)?.result : undefined;
  if (!Array.isArray(result)) return [];
  const out: ListedLocation[] = [];
  for (const row of result) {
    const name = (row as { location_name?: unknown }).location_name;
    const kind = (row as { location_type?: unknown }).location_type;
    if (typeof name === "string" && typeof kind === "string") out.push({ name, kind });
  }
  return out;
}

/**
 * The listed location a place is, or `null` where the list holds none or
 * cannot say which of several it is. The city's own name leads the listed
 * name; a region the place states has to be among the rest. Two cities of
 * one name with no region to tell them apart are not guessed between
 * (Portland in Oregon and in Maine).
 */
export function matchLocation(list: readonly ListedLocation[], place: Place): string | null {
  const name = folded(place.name);
  const wanted = EXONYMS[name] ?? name;
  const stated = place.region === undefined ? "" : folded(place.region);
  const region = REGION_CODES[stated] ?? stated;
  for (const kind of KINDS) {
    const named = list.filter((row) => row.kind === kind && folded(row.name.split(",")[0] ?? "") === wanted);
    if (named.length === 0) continue;
    if (region !== "") {
      const within = named.filter((row) => row.name.split(",").slice(1).some((part) => folded(part) === region));
      if (within.length > 0) return within[0]!.name;
      // A region that matches none of them is a region written another way
      // ("Greater Manchester"): the city stands where it is the only one.
    }
    if (named.length === 1) return named[0]!.name;
    return null;
  }
  return null;
}

/**
 * The vendor's name for `place` in `country`: `{ location }` where its
 * list holds the place, `{ location: null }` where the list was read and
 * does not, and `null` where the list could not be read — the caller then
 * asks again on a later pass.
 */
export async function placeLocation(a: { place: Place; country: Country }): Promise<{ location: string | null } | null> {
  if (!Object.prototype.hasOwnProperty.call(COUNTRIES, a.country)) return null;
  const got = await sendGet<unknown>(`/v3/serp/google/locations/${a.country.toLowerCase()}`, LIST_TIMEOUT_MS);
  if (!got.ok) return null;
  const list = listed(got.payload);
  if (list.length === 0) return null;
  return { location: matchLocation(list, a.place) };
}
