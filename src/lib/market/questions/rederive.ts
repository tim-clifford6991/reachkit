// SPEC §5 and §12 ruling 4 — the twelve, read again for a category the
// founder corrected at setup.
//
// §6.7 steps 3 and 4 over the market the scan already bought: selection is
// `select.ts`'s one classifier and the wording is the mechanical template.
// Nothing here buys, measures or calls a model, and nothing it imports
// reaches a Node built-in — the setup screen runs it in the browser.
import type { SuggestionRow } from "./market-set";
import type { Profile } from "./profile";
import { templateQuestion } from "./template";
import { LOWEST_STEP, selectWidened, type PoolRow } from "./widen";

/** What a corrected category re-derives over: the profile the scan read,
 *  the market it bought and the ranked rows it pooled (SPEC §6 thin
 *  markets, #778). */
export interface DerivableMarket {
  profile: Profile;
  market: readonly SuggestionRow[];
  pool?: readonly PoolRow[];
  /** The site's own ranked count the scan measured — the demand ceiling
   *  the pass selected under (issue 830), so a correction never brings
   *  back a search outsized for the site. */
  ownRanked: number;
}

/** The stored market cut to the rows selection can ever keep — those at or
 *  above the lowest volume step — so a screen carries no row it could not
 *  use. Selection applies the same steps, so the result is unchanged. */
export function derivableMarket(a: {
  profile: Profile;
  suggestions: readonly SuggestionRow[];
  pool?: readonly PoolRow[];
  ownRanked: number;
}): DerivableMarket {
  return {
    profile: a.profile,
    ownRanked: a.ownRanked,
    market: a.suggestions
      .filter((row) => row.volume >= LOWEST_STEP)
      .map((row) => ({ keyword: row.keyword, volume: row.volume })),
    pool: (a.pool ?? []).filter((row) => row.volume >= LOWEST_STEP),
  };
}

/**
 * The twelve — or as many as the stored market yields — for `category`.
 *
 * The correction replaces the inferred category and nothing else: every
 * other fact the profile holds was read from the founder's own site and is
 * still true of it. Fewer than twelve is a complete answer (`select.ts`),
 * and a market that supports none yields none.
 */
export function rederiveQuestions(
  a: DerivableMarket & { category: string }
): readonly { search: string; wording: string }[] {
  const profile: Profile = { ...a.profile, category: a.category };
  // The same widening the pass read the market with (SPEC §6 thin markets):
  // the suggestions at 50/mo first, then the pool and the lower steps only
  // while short — never the bare 50/mo cut.
  return selectWidened({ profile, suggestions: a.market, pool: a.pool ?? [], ownRanked: a.ownRanked }).map((search) => ({
    search: search.keyword,
    wording: templateQuestion(search.keyword),
  }));
}
