// What a draft's life does to the opportunity it was written from. A written draft queues it and a vetoed draft
// dismisses it, so the daily pick never offers one opportunity twice and §8's near-duplicate gate never refuses the
// second page against the first. A published page's row keeps what the weekly verdict does to it.
//
// A topic whose page the generator stopped rests only until the site's next weekly commit, which ranks it again: a
// stop is not the customer's no. The founder's rewrite or passing edit queues the row as any written draft does, and
// Skip, the customer's no, rests the topic for `TOPIC_REST_DAYS`.
//
// A page drafted folds its open repeats (#1181, SPEC §6 2026-10-02): every
// open Write or Earn row that is the same topic as it — by the stored top
// tens, the cluster key or a search it absorbed — is dismissed and its
// search absorbed into the page's row. The next evening ranks what is left,
// so a week never drafts one question twice in other words.
import { TOPIC_REST_DAYS } from "@/lib/config/constants";
import { nextDueAfter } from "@/lib/scan/weekly/week";
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
 *  first, so a planned stop that lands later is refused. `save` is `false`
 *  where a stop came first and no draft may be saved; `claimed` says this
 *  call moved the row, so only this call may give it back. */
export async function claimForDraft(opportunityId: string): Promise<{ save: boolean; claimed: boolean }> {
  const store = opportunityStore();
  const claimed = await store.markQueued(opportunityId);
  return { save: (await store.byId(opportunityId))?.status !== "dismissed", claimed };
}

/** The draft a claim was taken for was never saved: the page is open again
 *  for the plan, unless a stop or a publish moved it since. */
export async function giveBackClaim(opportunityId: string): Promise<void> {
  await opportunityStore().reopenIfQueued(opportunityId);
}

/** The customer stopped the draft written from this opportunity: it is not
 *  offered again the next evening, and nothing is spent on it twice. */
export async function dismissForVeto(opportunityId: string): Promise<void> {
  await opportunityStore().markDismissed(opportunityId, { stopped: true });
}

/** The page is refused, not the target, so the row stays on file and is not offered for a day until the rest is over:
 *  `TOPIC_REST_DAYS` after the customer's skip, or the site's next weekly commit, in its zone, after a system `stop`. */
export async function restTopic(opportunityId: string, at: Date, stop?: { zone: string | null | undefined }): Promise<void> {
  const store = opportunityStore();
  // A customer's own edit is never written by the generator: resting it would hand the planner a paid refresh nobody asked for.
  const row = await store.byId(opportunityId);
  if ((row?.evidence as { shortfall?: { cause?: unknown } } | null | undefined)?.shortfall?.cause === "edited") {
    await store.markDismissed(opportunityId);
    return;
  }
  const until = stop === undefined ? new Date(at.getTime() + TOPIC_REST_DAYS * 86_400_000) : nextDueAfter({ at, zone: stop.zone ?? "UTC" });
  await store.rest(opportunityId, until);
}
