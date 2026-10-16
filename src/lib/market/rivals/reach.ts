// src/lib/market/rivals/reach.ts — issue 1468
//
// Whether a pass's market is a local one: the businesses of one town, where
// the map leads and a rival is found on two searches (issue 1449), or a
// national one, where one search finds a rival (issue 1465). Read from what
// the site says of itself, never from the map alone: a national bookkeeping
// or forms company is shown a map on some of its searches too.
//
// Pure: no I/O, no clock. It reads what a pass, or a stored report, holds.
import type { MarketSerp } from "../views";

/** What the free pass's profile read says of the business, as far as reach
 *  goes. `town` is `""` where the pages name none, and absent on a profile
 *  read before it was asked (issue 1441). */
export interface ReachProfile {
  town?: string;
  offeringType?: string;
  category?: string;
}

/** schema.org's types for a business carried out in person, where it is,
 *  as `parse.ts` keeps them (lower case). A plain `LocalBusiness`, a
 *  `Store` or a `ProfessionalService` says only where it is (issue 1370). */
const IN_PERSON_TYPE =
  /^(?:restaurant|fastfoodrestaurant|cafeorcoffeeshop|bakery|barorpub|brewery|winery|icecreamshop|foodestablishment|hotel|motel|hostel|bedandbreakfast|lodgingbusiness|resort|plumber|electrician|roofingcontractor|hvacbusiness|locksmith|housepainter|generalcontractor|homeandconstructionbusiness|movingcompany|autorepair|autobodyshop|automotivebusiness|dentist|physician|medicalclinic|optician|pharmacy|veterinarycare|beautysalon|hairsalon|nailsalon|dayspa|healthandbeautybusiness|exercisegym|healthclub|childcare|drycleaningorlaundry|florist|tattooparlor)$/;

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
 * 1. A pass measured in a town, a profile that read a town, or structured
 *    data of a business carried out in person: local.
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
  const town = a.profile?.town;
  if (town !== undefined && town.trim() !== "") return true;
  if (a.schemaTypes.some((type) => IN_PERSON_TYPE.test(type.toLowerCase()))) return true;
  if (a.profile === null || town !== undefined) return false;
  const offering = `${a.profile.offeringType ?? ""} ${a.profile.category ?? ""}`;
  if (ONLINE_OFFERING.test(offering) || !IN_PERSON_OFFERING.test(offering)) return false;
  return a.serps.some((serp) => (serp.localPack?.length ?? 0) > 0);
}
