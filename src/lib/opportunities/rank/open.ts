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
//
// **A `not-yet` target never appears here either** (issue 881, SPEC §6's
// right-sizing law): it is excluded before scoring, so no tie-break can
// hand it a day. The score's `fit` term still weighs the two bands that
// remain against each other.
//
// **A ready `fix_page` is placed, not scored** (SPEC §9, owner ruling
// 2026-09-14): it outranks new writing for its cluster. It carries no search
// to score, so it goes immediately ahead of the first Write row in the same
// cluster — and while clusters are not derived, a null key on either side is
// one pool, so it goes ahead of the first Write row at all. Improve and Earn
// keep their scored places. A fix with no Write row to precede goes last. A
// fix that is not ready is not in the list.
import { opportunityStore } from "../store";
import { readOpportunity } from "../store";
import { comparePrecedence } from "../cluster";
import { qualifiesForADay, type Opportunity, type Ranked } from "../types";
import { rankScore } from "./score";

/** The stored band, as the one predicate reads it. A column carrying
 *  anything the product does not band by is read as outsized — the
 *  conservative arm: an unreadable band never fills a day. */
function bandOf(fitBand: string | null): Opportunity["fitBand"] {
  return fitBand === "winnable" || fitBand === "reach" ? fitBand : "not-yet";
}

/** Descending score; ties broken by age, then by id. */
function byScore(
  a: { opportunity: Opportunity; score: number },
  b: { opportunity: Opportunity; score: number }
): number {
  if (b.score !== a.score) return b.score - a.score;
  const age = a.opportunity.createdAt.getTime() - b.opportunity.createdAt.getTime();
  if (age !== 0) return age;
  return a.opportunity.id < b.opportunity.id ? -1 : a.opportunity.id > b.opportunity.id ? 1 : 0;
}

/** SPEC §7's daily decision (2026-09-16): an update of an existing page
 *  (Improve) against a new page (Earn, Write), whichever ranks higher for
 *  this site. The new pages keep their own order — Earn, then Write, and
 *  the Write types in the owner's order (2026-09-15) ahead of the score —
 *  and the updates are in score order; the two lists are merged by score,
 *  an update taking a tie. Both sides carry the same right-sized fit, so a
 *  target outsized for the site weighs nothing on either. Within one
 *  topic an update still wins outright (§6: the cluster step keeps it). */
export function orderRanked(
  scored: readonly { opportunity: Opportunity; score: number }[]
): Ranked[] {
  const updates = scored.filter((entry) => entry.opportunity.family === "improve").sort(byScore);
  const fresh = scored
    .filter((entry) => entry.opportunity.family !== "improve")
    .sort((a, b) => comparePrecedence(a.opportunity, b.opportunity) || byScore(a, b));

  const merged: { opportunity: Opportunity; score: number }[] = [];
  let u = 0;
  let f = 0;
  while (u < updates.length || f < fresh.length) {
    const update = updates[u];
    const next = fresh[f];
    if (update !== undefined && (next === undefined || update.score >= next.score)) {
      merged.push(update);
      u += 1;
    } else {
      merged.push(next!);
      f += 1;
    }
  }
  return merged.map((entry) => ({ opportunityId: entry.opportunity.id, score: entry.score }));
}

function samePool(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}

/** Oldest first, each ahead of the first Write row of its pool. Pure. */
export function placeFixPages(
  scored: readonly { opportunity: Opportunity; score: number }[],
  fixes: readonly Opportunity[]
): Ranked[] {
  const ordered = orderRanked(scored);
  const byId = new Map(scored.map((entry) => [entry.opportunity.id, entry.opportunity]));
  const pending = [...fixes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const out: Ranked[] = [];
  for (const entry of ordered) {
    const opportunity = byId.get(entry.opportunityId);
    if (opportunity?.family === "write") {
      for (let i = 0; i < pending.length; ) {
        const fix = pending[i]!;
        if (samePool(fix.clusterKey, opportunity.clusterKey)) {
          out.push({ opportunityId: fix.id, score: entry.score });
          pending.splice(i, 1);
        } else {
          i += 1;
        }
      }
    }
    out.push(entry);
  }
  for (const fix of pending) out.push({ opportunityId: fix.id, score: 0 });
  return out;
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
  const [rows, profile, fixRows] = await Promise.all([
    store.openRankable(siteId),
    store.profileForSite(siteId),
    store.openFixPages(siteId),
  ]);
  const fixes = fixRows.filter((row) => row.ready).map(readOpportunity);
  // No profile, no score — but a fix needs neither, and still takes its day.
  // SPEC §6: "A day is filled only by an opportunity that passes
  // readiness." The answer is the stored column (`assessReadiness`).
  // SPEC §6's right-sizing law, enforced (issue 881): a target outsized for
  // this site is not in the list at all. It used to be barred by weighing 0
  // in the score, and a zero weight orders without excluding — where every
  // candidate scored 0 the order was a tie and the tie-break handed the day
  // to the biggest keyword. A row that does not qualify is dropped here,
  // once, and `nextForDay` takes the head of what is left.
  const rankable = rows.filter((row) => row.ready && qualifiesForADay(bandOf(row.fit_band)));
  if (profile === null || rankable.length === 0) return placeFixPages([], fixes);

  const scored = rankable.map((row) => {
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
  return placeFixPages(scored, fixes);
}
