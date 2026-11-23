// SPEC §7 *A page for what is new in the market*: a hot page cites the dated reports of its event as `recent` facts.
import type { MarketFact } from "@/lib/generate/pipeline/research";
import type { Opportunity } from "@/lib/opportunities/types";

/** The event's reports a hot page's pack leads with, as the weekly pass read them; none on any other page. Pure. */
export function hotFacts(o: { evidence?: Opportunity["evidence"] }): MarketFact[] {
  const claims = o.evidence?.family === "write" ? (o.evidence.hot?.claims ?? []) : [];
  return claims.map((claim) => ({ url: claim.url, title: claim.publisher, readAt: new Date(`${claim.readOn ?? claim.publishedAt}T00:00:00Z`), passage: claim.quote, kind: "recent", publishedAt: claim.publishedAt, source: claim.publisher }));
}
