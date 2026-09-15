// SPEC §5 and §12 ruling 4 — the twelve, read again for a category the
// founder corrected at setup.
//
// §6.7 steps 3 and 4 over the market the scan already bought: selection is
// `select.ts`'s one classifier and the wording is the mechanical template.
// Nothing here buys, measures or calls a model, and nothing it imports
// reaches a Node built-in — the setup screen runs it in the browser.
import { SELECTION } from "@/lib/config/constants";
import type { SuggestionRow } from "./market-set";
import type { Profile } from "./profile";
import { selectTwelve } from "./select";
import { templateQuestion } from "./template";

/** What a corrected category re-derives over: the profile the scan read
 *  and the market it bought. */
export interface DerivableMarket {
  profile: Profile;
  market: readonly SuggestionRow[];
}

/** The stored market cut to the rows selection can ever keep — those at or
 *  above the volume floor — so a screen carries no row it could not use.
 *  `selectTwelve` applies the same floor, so the result is unchanged. */
export function derivableMarket(a: { profile: Profile; suggestions: readonly SuggestionRow[] }): DerivableMarket {
  return {
    profile: a.profile,
    market: a.suggestions
      .filter((row) => row.volume >= SELECTION.volumeFloorPerMonth)
      .map((row) => ({ keyword: row.keyword, volume: row.volume })),
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
  return selectTwelve({ profile, market: [...a.market] }).map((search) => ({
    search: search.keyword,
    wording: templateQuestion(search.keyword),
  }));
}
