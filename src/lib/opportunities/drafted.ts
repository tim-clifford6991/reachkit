// SPEC §7 — what a draft's life does to the opportunity it was written from
// (issue 712).
//
// "Opportunity status (2026-09-15): a written draft queues its
// opportunity; a vetoed draft dismisses it." Nothing moved a row out of
// `open` before this, so the daily pick offered the same opportunity every
// evening and §8's near-duplicate gate refused the second page against the
// first: a site left alone got one page and then none.
//
// A published page's row keeps what the weekly verdict already does to it
// (`markDone` on an acceptance test that passed). A draft the generator
// stopped for the last time rests in `needs_attention`, and its topic rests
// with it (owner, D26, 2026-10-02, issue 1179; rewrites issue 833): the row
// is `open` and not ready for `TOPIC_REST_DAYS`, so the next evening ranks
// another topic instead of failing the same one. The founder resolves the
// draft — a rewrite or an edit that passes queues the row as any written
// draft does; Skip rests the topic from that day.
//
// A page drafted folds its open repeats (#1181, SPEC §6 2026-10-02): every
// open Write or Earn row that is the same topic as it — by the stored top
// tens, the cluster key or a search it absorbed — is dismissed and its
// search absorbed into the page's row. The next evening ranks what is left,
// so a week never drafts one question twice in other words.
import { TOPIC_REST_DAYS } from "@/lib/config/constants";
import { nearRepeatsOf } from "./cluster";
import { opportunityStore, readOpportunity } from "./store";

/** A draft that passed now exists for this opportunity: it leaves the open
 *  set, and takes its open repeats with it. */
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

/** A draft for this opportunity is being saved: it leaves the open set
 *  first, so a planned stop that lands later is refused. `false` where a
 *  stop came first and no draft may be saved. */
export async function claimForDraft(opportunityId: string): Promise<boolean> {
  const store = opportunityStore();
  await store.markQueued(opportunityId);
  return (await store.byId(opportunityId))?.status !== "dismissed";
}

/** The customer stopped the draft written from this opportunity: it is not
 *  offered again the next evening, and nothing is spent on it twice. */
export async function dismissForVeto(opportunityId: string): Promise<void> {
  await opportunityStore().markDismissed(opportunityId, { stopped: true });
}

const MS_PER_DAY = 86_400_000;

/** SPEC §7 (D26, issue 1179): the generator stopped this topic's draft for
 *  the last time, or the founder skipped that draft. The target was never
 *  refused, only the page, so the row stays on file — and is not offered
 *  for a day again until the rest is over. */
export async function restTopic(opportunityId: string, at: Date): Promise<void> {
  await opportunityStore().rest(opportunityId, new Date(at.getTime() + TOPIC_REST_DAYS * MS_PER_DAY));
}
