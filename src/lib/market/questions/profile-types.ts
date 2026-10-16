// src/lib/market/questions/profile-types.ts — the profile's shape, apart
// from the call that reads it (`./profile.ts`, which reaches the model seam).
// A screen or a pure stage that only names the shape imports it from here,
// so its module graph reaches no language model.
import type { Language } from "@/lib/locale/locales";
import type { BusinessKind } from "@/lib/market/kinds";

/** Issue 1454: how far a business sells. `local` is one town or city and
 *  its surroundings, served in person or delivered there; `national` is
 *  one country; `international` is several countries or anywhere online. */
export const REACHES = ["local", "national", "international"] as const;
export type Reach = (typeof REACHES)[number];

/** One line the business sells (issue 1454): what it is called on the
 *  site, its category in a buyer's search words, and its share of the
 *  site, 0–1, the offerings' shares summing to 1. */
export interface Offering {
  name: string;
  category: string;
  weight: number;
}

/** BP-025 `## Public interface`, verbatim. */
export interface Profile {
  category: string; // buyer vocabulary, never the site's marketing language
  job: string;
  offeringType: string;
  audienceTerms: readonly string[]; // 2–4
  namedRivals: readonly string[]; // rivals the site itself names
  vocabulary: readonly string[]; // the relevance guard's support set
  brandTokens: readonly string[]; // the own-brand drop set
  /** The town or city the pages say the business serves its customers in
   *  ("Leeds", "Austin, Texas"), `""` where they name none (owner ruling
   *  2026-10-15, issue 1441). A free pass measures there only once the
   *  search vendor's list of the country's towns holds it. Absent on a
   *  profile read before it was asked. */
  town?: string;
  /** Every line the business sells, 1–4, most of the site first (issue
   *  1454). The first one's category is `category`. Absent on a profile
   *  read before it was asked: that profile sells one line, `category`. */
  offerings?: readonly Offering[];
  /** The kind of business, from the closed list the paid pass's market
   *  uses (`src/lib/market/kinds.ts`). Absent where the model named none
   *  of the list, and on a profile read before it was asked. */
  kind?: BusinessKind;
  /** How far it sells (issue 1454). Absent as `kind` is. */
  reach?: Reach;
  /** The language the site's buyers search in (SPEC §6, owner D66, issue
   *  1311), where that is not English: the selection reads a search's stop
   *  words, endings and compounds by it. Never asked of the model — the
   *  pass sets it from the site's locale. Absent is English. */
  language?: Language;
}

