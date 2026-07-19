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
  /**
   * Part C — the site fetch returned a GARBAGE capture (a JS-shell/SPA
   * bootstrap page, `isGarbageFetch`) and the one Tavily Extract escalation
   * either failed or was itself garbage. Set on `get_listing`'s web-mode
   * result; threaded onto `PreliminaryFacts` and, at report assembly, onto
   * `report_payload.fetchDegraded` so the UI can render an honest "we
   * couldn't fully read this page" line instead of implying confident
   * findings over a page we never actually read.
   */
  fetchDegraded?: boolean;
}
