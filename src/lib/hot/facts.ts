// SPEC §7 *A page for what is new in the market*: a stored report as a dated `recent` fact, and a timely page's own
// event's reports, which its pack leads with.
import type { MarketFact } from "@/lib/generate/pipeline/research";
import type { Opportunity } from "@/lib/opportunities/types";
import type { HotClaim } from "./detect";

/** A stored report as a dated `recent` fact. */
export const factOf = (claim: HotClaim): MarketFact => ({ url: claim.url, title: claim.publisher, readAt: new Date(`${claim.readOn ?? claim.publishedAt}T00:00:00Z`), passage: claim.quote, kind: "recent", publishedAt: claim.publishedAt, source: claim.publisher });

/** The event's reports a hot page's pack leads with, as the weekly pass read them; none on any other page. Pure. */
export function hotFacts(o: { evidence?: Opportunity["evidence"] }): MarketFact[] {
  return (o.evidence?.family === "write" ? (o.evidence.hot?.claims ?? []) : []).map(factOf);
}
