// SPEC §7 — what a draft's life does to the opportunity it was written from
// (issue 712).
//
// "Opportunity status (2026-09-15): a written draft queues its
// opportunity; a vetoed draft dismisses it." Nothing moved a row out of
// `open` before this, so `nextForDay` offered the same opportunity every
// evening and §8's near-duplicate gate refused the second page against the
// first: a site left alone got one page and then none.
//
// A published page's row keeps what the weekly verdict already does to it
// (`markDone` on an acceptance test that passed). A draft the generator
// stopped for the last time rests in `needs_attention` and counts as queued
// (owner, 2026-09-17, issue 833): its row stays `queued`, so the evening
// does not write a second page for the same target. The founder resolves
// it — Regenerate keeps the one row; Skip releases the row back to `open`.
//
// A page drafted folds its open repeats (#1181, SPEC §6 2026-10-02): every
// open Write or Earn row that is the same topic as it — by the stored top
// tens, the cluster key or a search it absorbed — is dismissed and its
// search absorbed into the page's row. The next evening ranks what is left,
// so a week never drafts one question twice in other words.
import { nearRepeatsOf } from "./cluster";
import { opportunityStore, readOpportunity } from "./store";

/** A draft now exists for this opportunity — written, or stopped and
 *  resting in `needs_attention` (issue 833): it leaves the open set, and
 *  takes its open repeats with it. */
export async function queueForDraft(opportunityId: string): Promise<void> {
  const store = opportunityStore();
  await store.markQueued(opportunityId);
  const row = await store.byId(opportunityId);
  if (row === null || row.family === "fix") return;
  const page = readOpportunity(row);
  const open = (await store.openRankable(page.siteId)).map(readOpportunity);
  const topTens = await store.topTens([...new Set([page.scanId, ...open.map((o) => o.scanId)])]);
  const repeats = nearRepeatsOf(page, open, topTens);
  if (repeats.length === 0) return;
  const own = page.targetQuery === null ? null : page.targetQuery.trim().toLowerCase();
  const absorbed = new Set(page.absorbedQueries);
  for (const repeat of repeats) {
    await store.markDismissed(repeat.id);
    for (const query of [repeat.targetQuery, ...repeat.absorbedQueries]) {
      if (query !== null && query.trim().toLowerCase() !== own) absorbed.add(query);
    }
  }
  if (page.clusterKey !== null) await store.setCluster(page.id, page.clusterKey, [...absorbed].sort());
}

/** The customer stopped the draft written from this opportunity: it is not
 *  offered again the next evening, and nothing is spent on it twice. */
export async function dismissForVeto(opportunityId: string): Promise<void> {
  await opportunityStore().markDismissed(opportunityId);
}

/** The founder skipped a draft the generator stopped (issue 833): the
 *  target was never refused, only the page, so the row goes back to the
 *  open set. Only `queued` moves. */
export async function releaseForDraft(opportunityId: string): Promise<void> {
  await opportunityStore().markOpen(opportunityId);
}
