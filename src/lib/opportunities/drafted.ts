// What a draft's life does to the opportunity it was written from. A written draft queues it and a vetoed draft
// dismisses it, so the daily pick never offers one opportunity twice and §8's near-duplicate gate never refuses the
// second page against the first. A published page's row keeps what the weekly verdict does to it.
//
// A topic whose page the generator stopped rests until the site's next weekly commit: a stop is not the customer's no.
// While the newest draft on a topic is one the checks stopped, the commit plans it again only once what that draft's
// research read has changed (`newestStop`). The founder's rewrite or passing edit queues the row as any written draft
// does, and Skip rests it `TOPIC_REST_DAYS`.
//
// A page drafted folds its open repeats (SPEC §6): every open Write or Earn row of the same topic, by the stored top
// tens, the cluster key or an absorbed search, is dismissed into it, so a week never drafts one question twice.
import { TOPIC_REST_DAYS } from "@/lib/config/constants";
import { nextDueAfter } from "@/lib/scan/weekly/week";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { nearRepeatsOf, queryKey, sameTopic } from "./cluster";
import { opportunityStore, readOpportunity } from "./store";
import type { Opportunity, StoppedInputs } from "./types";

/** A draft that passed now exists for this opportunity: it leaves the open set, and takes its open repeats with it. */
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

/** A draft for this opportunity is being saved: it leaves the open set first, so a planned stop that lands later is
 *  refused. `save` is `false` where a stop came first and no draft may be saved; `claimed` says this call moved the
 *  row, so only this call may give it back. */
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

/** One of the site's drafts, newest first, as Q8 reads it: the row it was written from, whether the checks stopped it
 *  on a blocking rule (its last move into `needs_attention` came from `generating` on a `rules:` reason and it went no
 *  further), and what its pack's research read. */
export interface DraftOnTopic {
  id: string;
  at: string;
  row: Opportunity;
  stopped: boolean;
  read: StoppedInputs;
}

/** A stored draft as `DraftOnTopic`; its pack's top results are the addresses its `top_result` claims were read off. */
export function draftOnTopic(d: { id: string; created_at: string; state: string; transitions: unknown; rivals: unknown; claims: unknown; products: unknown; searches: unknown }, row: Opportunity): DraftOnTopic {
  const moves = Array.isArray(d.transitions) ? (d.transitions as { from?: string; to?: string; reason?: string }[]) : [];
  const rested = [...moves].reverse().find((move) => move?.to === "needs_attention");
  const claims = Array.isArray(d.claims) ? (d.claims as { kind?: unknown; url?: unknown }[]) : [];
  const urls = claims.flatMap((claim) => (claim?.kind === "top_result" && typeof claim.url === "string" ? [canonicalUrl(claim.url)] : []));
  const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === "string").map((one) => one.toLowerCase()) : []);
  // The rivals it read are the ones in force whose own pages it researched; a product a top result named is not one.
  const inForce = new Set(strings(d.rivals));
  const read = strings(Array.isArray(d.products) ? d.products.map((product) => (product as { domain?: unknown } | null)?.domain) : []).filter((domain) => inForce.has(domain));
  return {
    id: d.id,
    at: d.created_at,
    row,
    stopped: (d.state === "needs_attention" || d.state === "skipped") && rested?.from === "generating" && (rested.reason ?? "").startsWith("rules:"),
    read: { topResults: [...new Set(urls)], rivals: [...new Set(read)].sort(), searches: strings(d.searches) },
  };
}

/** Q8 (SPEC §6 *How long a topic rests*): the newest draft on the row's topic — the row, its cluster, its absorbed
 *  searches, or the same page for a refresh — where that draft is one the checks stopped; `null` otherwise. Pure. */
export function newestStop(o: Opportunity, drafts: readonly DraftOnTopic[]): DraftOnTopic | null {
  if (o.family === "fix") return null;
  const page = o.family === "improve" && o.targetRef !== null ? canonicalUrl(o.targetRef) : null;
  const samePage = (d: DraftOnTopic) => page !== null && d.row.family === "improve" && d.row.targetRef !== null && canonicalUrl(d.row.targetRef) === page;
  const newest = drafts.find((d) => d.row.id === o.id || sameTopic(o, d.row, new Map()) || samePage(d));
  return newest?.stopped === true ? newest : null;
}

/** Whether what the stopped draft read is still there to read: the site of each top result it quoted still ranks in
 *  today's stored top ten of one of its searches (research quotes the address a listed one redirects to), and each
 *  rival whose pages it read is still in force. A rival it never read does not count. A pack that read neither, or
 *  rivals that cannot be read today, has changed. Pure. */
export function readsAsBefore(was: StoppedInputs, topTens: ReadonlyMap<string, readonly string[]>, inForce: readonly string[] | null): boolean {
  if (inForce === null || was.topResults.length + was.rivals.length === 0) return false;
  const host = (url: string) => canonicalUrl(url).split("/")[0];
  const today = new Set(was.searches.flatMap((search) => topTens.get(queryKey(search)) ?? []).map(host));
  const rivals = new Set(inForce.map((rival) => rival.toLowerCase()));
  return was.topResults.every((url) => today.has(host(url))) && was.rivals.every((rival) => rivals.has(rival));
}
