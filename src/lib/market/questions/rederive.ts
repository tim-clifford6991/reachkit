// §6.7 steps 3 and 4, read again for a category the founder corrected.
// Selection is `select.ts`'s one classifier and the wording is the
// mechanical template: nothing here buys, measures or calls a model.
import { selectTwelve } from "./select";
import { templateQuestion } from "./template";
import type { SuggestionRow } from "./market-set";
import type { Profile } from "./profile";
import type { SetupQuestion } from "../setup/state";

/**
 * The twelve — or as many as the stored market yields — for `category`.
 *
 * The correction replaces the inferred category and nothing else: every
 * other fact the profile holds was read from the founder's own site and is
 * still true of it. Fewer than twelve is a complete answer, never a
 * shortfall (`select.ts`), and a market that supports none yields none.
 */
export function rederiveQuestions(a: {
  profile: Profile;
  market: readonly SuggestionRow[];
  category: string;
}): readonly SetupQuestion[] {
  const profile: Profile = { ...a.profile, category: a.category };
  return Object.freeze(
    selectTwelve({ profile, market: [...a.market] }).map((search) => ({
      wording: templateQuestion(search.keyword),
      search: search.keyword,
    }))
  );
}
