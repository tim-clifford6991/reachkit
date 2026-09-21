// SPEC §7 (2026-09-20) · issue #926 — the confirmed business profile.
//
// "**What a page is written from.** The confirmed business profile — what the
// business does, sells and promises, who it serves, its vocabulary — joins
// the writer's inputs."
//
// **Confirmed, not derived.** `../types.ts`'s `SiteProfile` is what a crawl
// and one model call read off the site, and every weekly refresh overwrites
// it. What this file describes is that reading *after* the customer's own
// decisions have been applied over it — which items they took out, which
// they put in, and their own wording of what the business does. That is the
// thing the writer is entitled to, and the thing Settings shows.
//
// **Every field here is a field something already stores.** #926 is explicit
// that this screen surfaces "what is already measured and shown nowhere",
// and its own Build names the sources: `site_profiles.products`, `.claims`,
// `.voice.{tone,person,vocabulary,claimsToKeep,claimsToAvoid}`, `.inventory`
// purposes, and the market reading's
// `profile.{job,offeringType,audienceTerms,vocabulary}`. There is no member
// below that nothing writes, and no member that renders a placeholder for a
// field the crawl does not have: a field with nothing in it is absent, and
// the screen says the site has not been read for it rather than drawing an
// empty row.
import type { PagePurpose } from "../types";

/** The six list-shaped fields, as one tuple. The tuple is the set: the
 *  edits table is keyed by these names, the screen draws one group per
 *  entry, and a seventh field is a compile error in both places rather than
 *  a column of JSON nobody reads.
 *
 *  **Every name is the stored field's own name**, which is what makes this
 *  the one vocabulary rather than a second one: `products` and `claims` are
 *  `site_profiles.products` and `.claims`; `vocabulary`, `claimsToKeep` and
 *  `claimsToAvoid` are that row's `voice.*`; `audienceTerms` is the market
 *  reading's. Since #970 it is also setup's step two's vocabulary: that
 *  screen shows four of these six lists, by these names, and writes to this
 *  same table — so a correction made while setting up is in Settings, and
 *  one made in Settings is on the step.
 *
 *  `vocabulary` is the union of the voice's and the market reading's — see
 *  `confirm.ts` for why one list and not two. */
export const BUSINESS_LISTS = [
  "products",
  "claims",
  "audienceTerms",
  "vocabulary",
  "claimsToKeep",
  "claimsToAvoid",
] as const;

export type BusinessList = (typeof BUSINESS_LISTS)[number];

/** One item of one list, with where it came from and whether the customer
 *  has met it before.
 *
 *  `source` is what the screen marks: an item read off the site is the
 *  site's word for itself, and one the customer typed is theirs. `isNew` is
 *  the other half of #926's "the refresh may only add new findings as
 *  **suggestions**" — a derived item the customer has never been shown is
 *  drawn as a suggestion rather than folded into a list they curated. An
 *  item they added is never new: they wrote it. */
export interface BusinessItem {
  readonly text: string;
  readonly source: "site" | "yours";
  readonly isNew: boolean;
}

/** What ReachKit believes about the business, after the customer's
 *  decisions.
 *
 *  Every member is nullable or empty where nothing has been read, and that
 *  is load-bearing: `job` is `null` on a site whose market has not been
 *  measured, and the screen states that rather than offering an empty
 *  sentence to reword. */
export interface BusinessProfile {
  /** What the business does, in one sentence — the market reading's `job`,
   *  or the customer's own wording where they have reworded it. */
  readonly job: { readonly text: string; readonly source: "site" | "yours" } | null;
  /** The kind of offering, beside `job`. Derived only: #926 names it as a
   *  field to surface and not as one to correct, so it carries no controls
   *  and no edits key. */
  readonly offeringType: string | null;
  /** The voice's two one-word readings. Same footing as `offeringType`. */
  readonly tone: string | null;
  readonly person: string | null;
  /** The six lists, each already merged, filtered and marked. */
  readonly lists: Readonly<Record<BusinessList, readonly BusinessItem[]>>;
  /** One entry per page purpose that actually occurs, in the crawl's own
   *  order — `purposeCounts`'s output, carried through unchanged, down to
   *  its own type: the purposes are a closed set, and a screen drawing a
   *  line per purpose is owed the compile error when one is added (#970).
   *  A purpose with no pages has no entry. */
  readonly purposes: readonly { readonly purpose: PagePurpose; readonly count: number }[];
  /** How many of the site's pages were read, and when. `null` where no
   *  profile has ever been written for the domain. */
  readonly pagesRead: number | null;
  readonly readAt: Date | null;
}

/** One passage ReachKit may quote, as the screen offers it.
 *
 *  The passages are read live from measured page text
 *  (`src/lib/generate/pipeline/grounding.ts`) and are never stored, so what
 *  is stored about them is only which ones the customer switched off. */
export interface QuotableFact {
  readonly passage: string;
  /** The page it was read from. */
  readonly url: string;
  /** How many of the site's measured pages this passage was found on —
   *  #926's "how many pages used each". One, for a passage that appears on
   *  one page, which is the ordinary case. */
  readonly pages: number;
  /** Whether ReachKit may quote it. `false` is the customer's switch. */
  readonly on: boolean;
}

/** The customer's stored decisions, as `site_profile_edits` holds them. */
export interface BusinessEdits {
  readonly removed: Readonly<Partial<Record<BusinessList, readonly string[]>>>;
  readonly added: Readonly<Partial<Record<BusinessList, readonly string[]>>>;
  readonly job: string | null;
  readonly seen: Readonly<Partial<Record<BusinessList, readonly string[]>>>;
  readonly factsOff: readonly string[];
}

/** No decisions at all — the state of a site whose customer has never
 *  corrected anything. Every read falls back to it, so no caller has to
 *  distinguish "no row" from "an empty row". */
export const NO_EDITS: BusinessEdits = Object.freeze({
  removed: Object.freeze({}),
  added: Object.freeze({}),
  job: null,
  seen: Object.freeze({}),
  factsOff: Object.freeze([]),
});
