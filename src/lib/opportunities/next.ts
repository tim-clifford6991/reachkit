// BUILD §7 — the one opportunity a calendar day fills from.
//
// §4.6's calendar requests; it never creates. "Supply is the cap: never
// invent an opportunity to fill a day; the calendar is never padded"
// (DECISIONS, 2026-08-28). This function is the whole of that promise on
// the engine's side: two steps and no third — rank the open set, take the
// head, load it.
//
// It applies **no** filter of its own. The Fix family and every `unblock`
// are already excluded by `rankOpen` (through the store's `openRankable`),
// and a second filter here would be a second statement of the same
// predicate — the copy that eventually disagrees with the count
// `supplyDepth` reports, which is precisely the failure the supply rule
// was written against.
//
// It creates nothing: no draft, no opportunity, no queue entry, no write of
// any kind. An exhausted site answers `null`, and `null` is what an empty
// day is rendered from.
import { rankOpen } from "./rank/open";
import { opportunityStore, readOpportunity } from "./store";
import type { Opportunity } from "./types";

export async function nextForDay(siteId: string): Promise<Opportunity | null> {
  const ranked = await rankOpen(siteId);
  const head = ranked[0];
  if (head === undefined) return null;
  const row = await opportunityStore().byId(head.opportunityId);
  return row === null ? null : readOpportunity(row);
}
