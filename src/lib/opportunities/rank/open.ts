// BUILD §7 — the one ranked list.
//
// "Ranking: `demand × intent × (1−effort) × fit`, one list." One list, and
// one order: the score descending, then `created_at` ascending, then the
// id. The last two keys are what make it a *total* order — without them
// two opportunities with identical scores would come back in whatever
// order Postgres happened to return them, and the day a calendar fills
// from would move between two reads that measured nothing new.
//
// Nothing is stored. `rankOpen` computes from the evidence already on the
// row, so retuning a coefficient changes tomorrow's order and rewrites no
// history.
//
// `unblock` never appears here: the store's `openRankable` excludes the
// Fix family, once, and no caller downstream restates that predicate.
import { opportunityStore } from "../store";
import { readOpportunity } from "../store";
import type { Opportunity, Ranked } from "../types";
import { rankScore } from "./score";

/** Descending score; ties broken by age, then by id. */
export function orderRanked(
  scored: readonly { opportunity: Opportunity; score: number }[]
): Ranked[] {
  return [...scored]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const age = a.opportunity.createdAt.getTime() - b.opportunity.createdAt.getTime();
      if (age !== 0) return age;
      return a.opportunity.id < b.opportunity.id ? -1 : a.opportunity.id > b.opportunity.id ? 1 : 0;
    })
    .map((entry) => ({ opportunityId: entry.opportunity.id, score: entry.score }));
}

/**
 * The site's open, rankable opportunities in ranked order.
 *
 * The profile is loaded once per call and passed to every row — the intent
 * term is §6.7's classifier and its second parameter is not optional. A
 * site with no readable profile ranks nothing: an empty list, which the
 * caller reads as "no supply to order", never as an order derived from a
 * classification we could not make.
 */
export async function rankOpen(siteId: string): Promise<Ranked[]> {
  const store = opportunityStore();
  const [rows, profile] = await Promise.all([
    store.openRankable(siteId),
    store.profileForSite(siteId),
  ]);
  if (profile === null || rows.length === 0) return [];

  const scored = rows.map((row) => {
    const opportunity = readOpportunity(row);
    return {
      opportunity,
      score: rankScore({
        volume: opportunity.volume,
        // Every rankable opportunity has a target query: `targetQuery` is
        // null only for `unblock`, which `openRankable` already excluded.
        query: opportunity.targetQuery ?? "",
        type: opportunity.type,
        fit: opportunity.fitBand ?? "not-yet",
        profile,
      }),
    };
  });
  return orderRanked(scored);
}
