// src/lib/market/rivals/reach.ts — issue 1468
//
// Whether a pass's market is a local one: the businesses of one town, where
// the map leads and a rival is found on two searches (issue 1449), or a
// national one, where one search finds a rival (issue 1465). Read from what
// the site says of itself, never from the map alone: a national bookkeeping
// or forms company is shown a map on some of its searches too.
//
// Pure: no I/O, no clock. It reads what a pass, or a stored report, holds.
import type { Place } from "@/lib/locale/locales";
import type { PlaceSignals } from "@/lib/locale/place";
import { servingEvidence, type ServingPage } from "@/lib/locale/serving";
import { BUSINESS_KINDS, isBusinessKind } from "../kinds";
import { IN_PERSON_TYPES } from "@/lib/business/identity";
import type { MarketSerp } from "../views";

/** What the free pass's profile read says of the business, as far as reach
 *  goes. `town` is `""` where the pages name none, and absent on a profile
 *  read before it was asked (issue 1441). */
export interface ReachProfile {
  town?: string;
  offeringType?: string;
  category?: string;
  /** How far it sells and what kind of business it is, where the profile
   *  read them (issue 1454). */
  reach?: unknown;
  kind?: unknown;
}

/**
 * The town a profile read, where it is the business's market (issue 1480):
 * none for a business the profile reads as selling across a country or
 * beyond, or as software or teaching, which are bought from anywhere.
 * close.com, a CRM, read "Austin, Texas" off its footer and was stored as
 * local to Austin. `undefined` on a profile read before the town was asked.
 */
export function profileTown(profile: ReachProfile): string | undefined {
  if (profile.town === undefined) return undefined;
  const town = profile.town.trim();
  if (profile.reach !== undefined && profile.reach !== "local") return "";
  if (isBusinessKind(profile.kind) && !BUSINESS_KINDS[profile.kind].placed) return "";
  return town;
}

function inPersonType(type: string | undefined): boolean {
  return type !== undefined && IN_PERSON_TYPE.has(type.toLowerCase());
}

/**
 * Whether a free pass measures in `place` (issue 1480): by the rule a paid
 * pass holds its place to (`servingEvidence`, issue 1370), so the two read
 * one place for one site. A business the profile reads as selling beyond
 * one town, or as software, has none. Otherwise the site has to say it
 * serves the place: an area it lists as served, a page or a sentence that
 * says the service with the place, or a kind carried out in person and the
 * place named at all. An address in a footer is where a business is, not
 * whom it serves. A profile that read no kind keeps the town it named.
 */
export function townHolds(a: {
  place: Place;
  profile: ReachProfile & { offerings?: readonly { category: string }[] };
  stated?: PlaceSignals;
  /** The home page as the free pass read it. */
  home: ServingPage | null;
}): boolean {
  const { profile } = a;
  if (profileTown({ ...profile, town: a.place.name }) === "") return false;
  const service = [profile.category ?? "", ...(profile.offerings ?? []).map((o) => o.category)].filter((name) => name.trim() !== "");
  const inPerson = !isBusinessKind(profile.kind) || BUSINESS_KINDS[profile.kind].inPerson || inPersonType(a.stated?.type);
  return (
    servingEvidence({
      place: a.place,
      ...(a.stated === undefined ? {} : { stated: a.stated }),
      pages: a.home === null ? [] : [a.home],
      service,
      localPack: false,
      inPerson,
    }) !== null
  );
}

/** schema.org's in-person types, as `parse.ts` keeps them (lower case). */
const IN_PERSON_TYPE: ReadonlySet<string> = new Set(IN_PERSON_TYPES.map((type) => type.toLowerCase()));

/** An offering that is bought from anywhere: software, an app, a platform,
 *  anything sold online. */
const ONLINE_OFFERING = /\b(software|saas|apps?|platforms?|cloud|api|plugins?|online|digital)\b/i;

/** An offering carried out or sold where the business is: a restaurant, a
 *  café, a trade, a clinic, a salon, a shop counter. */
const IN_PERSON_OFFERING = new RegExp(
  "(?<![\\p{L}\\p{N}])(?:" +
    "restaurants?|caf[eé]s?|coffee (?:shop|house|bar)s?|bakery|bakeries|bistro|brasserie|diner|pubs?|wine bar|cocktail bar|pizzeria|takeaway|" +
    "hotels?|guest ?house|salons?|barbers?|spa|clinics?|dental|dentists?|doctors?|physio\\p{L}*|chiropract\\p{L}*|veterinar\\p{L}*|opticians?|pharmacy|" +
    "gyms?|fitness studio|plumb\\p{L}*|electricians?|roof\\p{L}*|hvac|locksmiths?|mechanics?|garage|repair shop|cleaning services?|landscap\\p{L}*|" +
    "gardeners?|removals|movers|decorators?|carpenters?|joinery|handyman|builders?|pest control|florists?|butchers?|retail|local|in-person|walk-in" +
    ")(?![\\p{L}\\p{N}])" +
    // German names a trade inside a compound: "Handwerksbäckerei".
    "|\\p{L}*(?:bäckerei|backwaren|konditorei|metzgerei|friseur|zahnarzt|praxis|klempner|sanitär|elektriker|handwerk)\\p{L}*",
  "iu"
);

/**
 * Whether the market is local (owner, 2026-10-16, issue 1468). In order:
 *
 * 1. A pass measured in a town, a profile that read a town it sells in
 *    (`profileTown`), or structured data of a business carried out in
 *    person: local.
 * 2. A profile that read no town: national, whatever the map shows.
 * 3. A report stored before the profile asked for a town: local only where
 *    the profile reads the business as one carried out or sold in person,
 *    and a map on its searches bears that out. The map is corroboration,
 *    never the reason on its own.
 * 4. No profile at all: national.
 */
export function readsLocal(a: {
  /** The pass measured in a town (`locale.place`). */
  measuredInTown: boolean;
  profile: ReachProfile | null;
  /** The home page's schema.org types, as the on-page read kept them. */
  schemaTypes: readonly string[];
  serps: readonly MarketSerp[];
}): boolean {
  if (a.measuredInTown) return true;
  const town = a.profile === null ? undefined : profileTown(a.profile);
  if (town !== undefined && town !== "") return true;
  if (a.schemaTypes.some((type) => inPersonType(type))) return true;
  if (a.profile === null || town !== undefined) return false;
  const offering = `${a.profile.offeringType ?? ""} ${a.profile.category ?? ""}`;
  if (ONLINE_OFFERING.test(offering) || !IN_PERSON_OFFERING.test(offering)) return false;
  return a.serps.some((serp) => (serp.localPack?.length ?? 0) > 0);
}
