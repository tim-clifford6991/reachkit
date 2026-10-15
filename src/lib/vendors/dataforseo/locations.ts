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
 * (Portland in Oregon and in Maine) — unless `near` names other towns the
 * business serves, and the region that holds most of them holds one of the
 * two ("Austin" beside "San Antonio" and "Round Rock" is Texas's; issue
 * 1441).
 */
export function matchLocation(list: readonly ListedLocation[], place: Place, near: readonly Place[] = []): string | null {
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
    return nearest(list, named, near);
  }
  return null;
}

/** Of several cities of one name, the one whose region holds the most of
 *  the other towns named beside it; `null` where none or a tie. */
function nearest(list: readonly ListedLocation[], named: readonly ListedLocation[], near: readonly Place[]): string | null {
  if (near.length === 0) return null;
  const regionsOf = (row: ListedLocation): string[] => row.name.split(",").slice(1, -1).map(folded);
  const held = new Map<string, number>();
  for (const other of near) {
    const wanted = folded(other.name);
    const regions = new Set(list.filter((row) => KINDS.includes(row.kind as (typeof KINDS)[number]) && folded(row.name.split(",")[0] ?? "") === wanted).flatMap(regionsOf));
    for (const region of regions) held.set(region, (held.get(region) ?? 0) + 1);
  }
  const scored = named.map((row) => ({ row, score: Math.max(0, ...regionsOf(row).map((region) => held.get(region) ?? 0)) })).sort((a, b) => b.score - a.score);
  const [first, second] = scored;
  return first !== undefined && first.score > 0 && (second === undefined || second.score < first.score) ? first.row.name : null;
}

/** The list, read once a country by an instance: it does not change between
 *  two scans, and a free pass asks it while a person waits (issue 1441). A
 *  read that failed is not kept. */
const LISTS = new Map<Country, Promise<ListedLocation[] | null>>();

function listOf(country: Country, timeoutMs: number): Promise<ListedLocation[] | null> {
  const held = LISTS.get(country);
  if (held !== undefined) return held;
  const reading = sendGet<unknown>(`/v3/serp/google/locations/${country.toLowerCase()}`, timeoutMs).then((got) => {
    const list = got.ok ? listed(got.payload) : [];
    if (list.length === 0) {
      LISTS.delete(country);
      return null;
    }
    return list;
  });
  LISTS.set(country, reading);
  return reading;
}

/**
 * The vendor's name for `place` in `country`: `{ location }` where its
 * list holds the place, `{ location: null }` where the list was read and
 * does not, and `null` where the list could not be read — the caller then
 * asks again on a later pass. `timeoutMs` is shorter for a pass a person is
 * waiting on; `near` is `matchLocation`'s.
 */
export async function placeLocation(a: { place: Place; country: Country; timeoutMs?: number; near?: readonly Place[] }): Promise<{ location: string | null } | null> {
  if (!Object.prototype.hasOwnProperty.call(COUNTRIES, a.country)) return null;
  const list = await listOf(a.country, a.timeoutMs ?? LIST_TIMEOUT_MS);
  if (list === null) return null;
  return { location: matchLocation(list, a.place, a.near) };
}
