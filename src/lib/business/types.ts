// src/lib/business/types.ts — what ReachKit understands of one business
// (issue 1454), as a shape alone: a screen names it without reaching the
// reader's own imports.
import type { Country, Language, Place } from "@/lib/locale/locales";
import type { BusinessKind } from "@/lib/market/kinds";
import type { Offering, Reach } from "@/lib/market/questions/profile-types";

export interface BusinessUnderstanding {
  /** The business's name, as the name rule reads it (issue 1380). */
  name: string | null;
  /** What it does, in one line. */
  job: string | null;
  /** Every line it sells, most of the site first. Empty where no market
   *  was read. */
  sells: readonly Offering[];
  /** Who buys, in the business's buyers' terms. */
  buyers: readonly string[];
  /** How far it sells, where that is known, and where it is measured. */
  where: {
    reach: Reach | null;
    /** The town or city a local business serves. */
    place: Place | null;
    country: Country;
  };
  kind: BusinessKind | null;
  /** The language its buyers search in. */
  language: Language;
}

/** The customer's own corrections, as `site_profile_edits` holds them. */
export interface UnderstandingEdits {
  job?: string | null;
  added?: { audienceTerms?: readonly string[]; vocabulary?: readonly string[] };
  removed?: { audienceTerms?: readonly string[]; vocabulary?: readonly string[] };
  /** Their answer to "who buys" at setup. */
  buyers?: string | null;
}

