// §0 "Site profile" · §2 Rules ("The scan builds the site profile") · §5
// Rules ("The site profile is confirmed here") · §12 ruling 8 (2026-09-12).
//
// What ReachKit has read of the customer's own site, as one closed shape.
//
// **Domain-keyed, not site-keyed.** The profile is built by the *free*
// scan, which has no account behind it (§2: "no account and no payment"),
// so there is no `sites` row to hang it on when it is first written. The
// domain is the one identity both a free scan and a paid site share, and
// the account reads its own profile by the domain it set up with.
//
// **Two things, kept apart on purpose.** The profile is *derived* — every
// field is what a crawl and one model call read off the site, and a
// refresh may overwrite any of it. `sites.voice_text` is the *customer's*
// — the voice they confirmed or edited at setup and in settings, which a
// refresh must never overwrite (§5 done-when, 2026-09-12). The derived
// voice seeds that field once, while it is untouched; after that the two
// are separate facts and the customer's wins.
//
// Nothing here is a sentence the product speaks: a purpose token is an
// identifier the screen renders through its own copy key, and the voice
// text is the model's reading of the customer's site, not product voice.

/** §2's closed purpose set, in the order the ruling states it. One page
 *  carries exactly one purpose; `other` is the honest arm, never a
 *  fallback that hides a miss. */
export const PAGE_PURPOSES = [
  "pricing",
  "about",
  "features",
  "product",
  "blog",
  "contact",
  "legal",
  "other",
] as const;

export type PagePurpose = (typeof PAGE_PURPOSES)[number];

/** One page the crawl read. Every member is a fact off that page — a row
 *  is only written for a page that was actually fetched and parsed, so a
 *  site of fewer pages than the bound records what it has and nothing is
 *  invented to fill the list (§2, issue #577 done-when 8). */
export interface InventoryRow {
  url: string;
  /** The `<title>`, trimmed; empty where the page carries none. */
  title: string;
  /** The first `<h1>`, trimmed; empty where the page carries none. */
  h1: string;
  purpose: PagePurpose;
}

/** §2's brand-voice summary, five members and no sixth, plus the one
 *  rendering the customer reads and edits.
 *
 *  `text` is the model's own prose — the paragraph shown in the voice box
 *  at setup and in settings, and the string drafting reads once it is
 *  stored on the site. The five structured members are what that
 *  paragraph was composed from, kept so a refresh can be compared field by
 *  field rather than as one opaque blob. */
export interface VoiceSummary {
  text: string;
  tone: string;
  person: string;
  vocabulary: readonly string[];
  claimsToKeep: readonly string[];
  claimsToAvoid: readonly string[];
}

/** The whole profile, as stored. `voice` is null where the pass read the
 *  site but the model call did not come back — a degraded profile still
 *  carries its inventory, which is what cross-linking needs. */
export interface SiteProfile {
  domain: string;
  siteName: string | null;
  /** What the site sells, in the site's own words. */
  products: readonly string[];
  /** Claims the site makes about itself, in the site's own words. */
  claims: readonly string[];
  voice: VoiceSummary | null;
  inventory: readonly InventoryRow[];
  /** `inventory.length`, stored so the screen's "pages read" count is read
   *  rather than derived from a list it may not have loaded. */
  pagesRead: number;
  refreshedAt: Date;
}

/** The counts a screen renders beside the inventory: one entry per purpose
 *  that actually occurs, in `PAGE_PURPOSES` order. A purpose with no pages
 *  has no chip — an empty count is not a fact worth a chip. */
export function purposeCounts(
  inventory: readonly InventoryRow[]
): readonly { purpose: PagePurpose; count: number }[] {
  return PAGE_PURPOSES.map((purpose) => ({
    purpose,
    count: inventory.filter((row) => row.purpose === purpose).length,
  })).filter((entry) => entry.count > 0);
}
