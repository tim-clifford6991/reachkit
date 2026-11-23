// SPEC §7 *A page for what is new in the market*: a page cites, as `recent` facts, its own event's dated reports and
// those of every stored market change on its topic.
import type { MarketFact } from "@/lib/generate/pipeline/research";
import { topicWords } from "@/lib/opportunities/intent";
import type { Opportunity } from "@/lib/opportunities/types";
import { sameTopic, type MarketChange } from "@/lib/scan/weekly/market-changes";
import { HOT, type HotClaim } from "./detect";

type Cited = Pick<Opportunity, "targetQuery" | "absorbedQueries" | "title"> & { evidence?: Opportunity["evidence"] };

const factOf = (claim: HotClaim): MarketFact => ({ url: claim.url, title: claim.publisher, readAt: new Date(`${claim.readOn ?? claim.publishedAt}T00:00:00Z`), passage: claim.quote, kind: "recent", publishedAt: claim.publishedAt, source: claim.publisher });

/** The event's reports a hot page's pack leads with, as the weekly pass read them; none on any other page. Pure. */
export function hotFacts(o: { evidence?: Opportunity["evidence"] }): MarketFact[] {
  return (o.evidence?.family === "write" ? (o.evidence.hot?.claims ?? []) : []).map(factOf);
}

/** The page's own event's reports, then the reports of `HOT.days` before `day` of each stored change that is its topic by
 *  the rule two changes are one story by, newest first and each address once. Pure. */
export function recentFacts(o: Cited, changes: readonly Partial<MarketChange>[], day: string): MarketFact[] {
  const topic = topicWords([o.targetQuery ?? "", ...o.absorbedQueries, o.title ?? ""].join(" "));
  const since = new Date(Date.parse(`${day}T00:00:00Z`) - HOT.days * 86_400_000).toISOString().slice(0, 10);
  const own = hotFacts(o), seen = new Set(own.map((fact) => fact.url));
  const shared = changes.flatMap((change) =>
    !Array.isArray(change.words) || !Array.isArray(change.claims) || !sameTopic(new Set(change.words), topic) ? [] : change.claims.map((claim) => ({ ...claim, ...(change.lastSeen === undefined ? {} : { readOn: change.lastSeen }) }))
  );
  const fresh = shared.filter((claim) => typeof claim?.publishedAt === "string" && claim.publishedAt >= since && claim.publishedAt <= day && !seen.has(claim.url) && seen.add(claim.url));
  return [...own, ...fresh.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map(factOf)];
}
