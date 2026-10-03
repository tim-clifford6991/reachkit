// SPEC §7 (2026-09-29, D12; issue 1143) — "Short of that, the day becomes an
// update of the closest existing page where one exists."
//
// A new page was written and adds too little that the web and the site do
// not already say. Where the site has a page close to its topic that the
// destination can update, the row becomes a `refresh_page` update of that
// page — the same conversion a topic the site already covers takes before
// it is ever written (`./derive/known.ts`, #928), reached later and on a
// lower bar: `ADDS.updateMin`, because at `KNOWN_CONTENT.COVERED_MIN` and
// above it would have been an update already.
//
// `null` is the other half of the ruling: no such page, so the page waits
// and the founder is asked. A page younger than `REFRESH_MIN_AGE_DAYS` is
// left alone, as it is there (#1181), and a row the database will not take
// as an update — the site already plans one of that page — is not forced.
import { ADDS } from "@/lib/config/constants";
import { closestKnown } from "@/lib/known-content/match";
import type { KnownPage } from "@/lib/known-content/types";
import { asUpdate, tooYoungToRefresh } from "./derive/known";
import { canUpdateFrom } from "./readiness";
import { opportunityStore } from "./store";
import type { Opportunity } from "./types";

export async function updateInstead(
  opportunity: Opportunity,
  known: readonly KnownPage[],
  at: Date
): Promise<Opportunity | null> {
  if (opportunity.family !== "write" && opportunity.family !== "earn") return null;
  const match = closestKnown(
    { query: opportunity.targetQuery, title: opportunity.title },
    known.filter((page) => page.live && page.url !== null)
  );
  if (match === null || match.page.url === null || match.score < ADDS.updateMin) return null;
  if (tooYoungToRefresh(match.page, at)) return null;
  const store = opportunityStore();
  if (!canUpdateFrom(await store.hostedOwnPages(opportunity.siteId))(match.page.url)) return null;

  const update = { ...opportunity, ...asUpdate(opportunity, match, at) };
  try {
    await store.becomeUpdate(opportunity.id, {
      type: update.type,
      family: update.family,
      target_ref: update.targetRef,
      proposed_slug: null,
      title: update.title,
      effort: update.effort,
      evidence: update.evidence,
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "update_instead_refused", opportunityId: opportunity.id, error: String(error).slice(0, 200) }));
    return null;
  }
  return update;
}
