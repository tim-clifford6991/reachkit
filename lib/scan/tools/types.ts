/**
 * Extra fields surfaced by get_listing and find_competitors,
 * depending on mode (app vs web).
 */
export interface FactsExtras {
  /** app mode */
  rating?: number | null;
  ratingCount?: number;
  /** web mode */
  serpResultCount?: number;
  phUpvotes?: number;
  domainAgeYears?: number | null;
}
