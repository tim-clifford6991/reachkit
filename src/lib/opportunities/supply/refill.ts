// SPEC §7 (issues 1549, 1559) — a pass leaves the site with a week it can
// commit.
//
// reachkit.app held six ready topics, every one a listicle or comparison,
// and D52 lets one of those out a week: "Pages left: 6" was one day, and no
// page went out for three. Where a pass leaves fewer than `PLAN_DEPTH`
// writable days (`writableDays`: a week of seven and its three spares), this
// writes down answer and how-to topics from what buyers were seen asking
// beside the site's searches — the "People also ask" questions and related
// searches on the SERPs the passes already bought, the market's own
// searched terms' first (issue 1519) — until the days are there or the
// questions run out. It runs inside a pass and nowhere else.
//
// It buys nothing and asks no model: the questions are stored, the fit is
// the one the pass already judged (`DeriveOutcome.spare`), and one the pass
// never reached is written unjudged, for the next pass's judgement. A
// question is observed demand (issue 1519), never one ReachKit composed, so
// supply is still the cap: where the questions run out first, the site is
// left short and the count says so.
import { ASKED_TOPICS, CONTENT_MIX, PLAN_DEPTH } from "@/lib/config/constants";
import { passesRelevanceGuard } from "@/lib/market/questions/select";
import { malformedSearch } from "@/lib/market/questions/well-formed";
import type { MarketConclusion } from "@/lib/market/infer/types";
import type { StoredReport } from "@/lib/scan/report";
import { brandTokensOf, clusterKey, queryKey, sameTopic, type ClusteredCandidate } from "../cluster";
import { contentTypeOf } from "../content-type";
import { ownRankedValue, type DeriveInput, type SpareTopic } from "../derive";
import { persist } from "../derive/persist";
import {
  askedOfReport,
  askedOnMarket,
  askedTopics,
  brandsOf,
  candidateFor,
  namesAnyBrand,
  rivalBrandOnly,
  sourceOf,
  type AskedBeside,
  type ProposedTopic,
} from "../derive/topics";
import { assessReadiness } from "../readiness";
import { opportunityStore, readOpportunity } from "../store";
import type { BusinessFit } from "../types";
import { supplyDepth } from "./depth";

/** A topic the refill may write, with the fit the pass judged for it —
 *  `null` where no pass has judged it. */
export interface RefillTopic {
  topic: ProposedTopic;
  fit: BusinessFit | null;
}

/**
 * The topics a short site may be refilled from, best first. Pure.
 *
 * The questions the pass judged to help, then the ones it never reached —
 * those asked beside the market's own searched terms first, and only where
 * the business's vocabulary supports every word and no rival is named. Each
 * is on the market (`askedOnMarket`), a search a buyer would type, not a
 * rival's bare name, written as a Q&A, how-to or documentation page (D52
 * caps the rest), and on no search the site already holds or dismissed.
 */
export function refillTopics(a: {
  report: StoredReport;
  market: MarketConclusion | null;
  asked: readonly AskedBeside[];
  spare: readonly SpareTopic[];
  refused: readonly string[];
  /** Every search the site already holds a row on, or absorbed. */
  taken: readonly string[];
  /** The searches of its dismissed rows. */
  dismissed: readonly string[];
  now: Date;
}): RefillTopic[] {
  const { own, rivals } = brandsOf(a);
  const brands = [...own, ...rivals];
  const seen = new Set([...a.taken, ...a.dismissed, ...a.refused].map(queryKey));
  const answers = (query: string): boolean =>
    (CONTENT_MIX.NON_COMMERCIAL_TYPES as readonly string[]).includes(contentTypeOf({ type: "keyword_page", targetQuery: query }) ?? "");
  const usable = (query: string): boolean =>
    !seen.has(queryKey(query)) &&
    answers(query) &&
    askedOnMarket(query, { market: a.market, own, rivals }) &&
    malformedSearch(query, a.market?.rivals) === null &&
    !rivalBrandOnly(query, { market: a.market, own, rivals });

  // A question no pass judged is written only where every word of it the
  // business's own vocabulary supports (§6.7's relevance guard) and it names
  // no rival: "what is aeo in medical terms" and "is profound ai good" sat
  // beside reachkit.app's searches. With no profile, nothing unjudged is.
  const profile = a.report.market.kind === "unmeasured" ? null : a.report.market.value.profile;
  const marketWords = [a.market?.category ?? "", ...(a.market?.synonyms ?? [])].filter((word) => word.trim() !== "").join(" ");
  const onTopic = (query: string): boolean =>
    profile !== null &&
    passesRelevanceGuard(query, profile, marketWords === "" ? undefined : marketWords) &&
    !namesAnyBrand(query, rivals);

  const out: RefillTopic[] = [];
  const take = (topic: ProposedTopic, fit: BusinessFit | null): void => {
    if (!usable(topic.query) || (fit === null && !onTopic(topic.query))) return;
    seen.add(queryKey(topic.query));
    out.push({ topic, fit });
  };
  for (const spare of a.spare) take(spare.topic, spare.fit);

  const terms = new Set(
    a.report.questions.kind === "unmeasured"
      ? []
      : a.report.questions.value.filter((question) => question.search.term === true).map((question) => queryKey(question.search.keyword))
  );
  const byTerm = [...a.asked].sort((x, y) => Number(terms.has(queryKey(y.term))) - Number(terms.has(queryKey(x.term))));
  for (const asked of askedTopics(byTerm, a.now, Number.POSITIVE_INFINITY)) {
    take(
      {
        query: queryKey(asked.query),
        source: sourceOf(asked.query, { brands }),
        volume: null,
        rival: null,
        asked: { term: asked.term, serpAt: asked.serpAt },
      },
      null
    );
  }
  return out;
}

/**
 * Tops a short site up to `target` writable days from `refillTopics`, and
 * returns how many rows it wrote and the days the site now holds. A site
 * already at the target is left as it is, and a second run over the same
 * rows writes nothing: every topic it wrote is a search the site now holds.
 * Database reads and writes only, run by each pass (`deriveForPass`).
 */
export async function refillSupply(
  a: Pick<DeriveInput, "siteId" | "scanId" | "report" | "ownRanked" | "market"> & {
    spare?: readonly SpareTopic[];
    refused?: readonly string[];
    target?: number;
  }
): Promise<{ added: number; unused: number }> {
  const target = a.target ?? PLAN_DEPTH;
  const at = a.report.verdict.measuredAt;
  let { unused } = await supplyDepth(a.siteId, at);
  if (unused >= target) return { added: 0, unused };

  const store = opportunityStore();
  const [held, dismissed, stored] = await Promise.all([
    store.clusterable(a.siteId).then((rows) => rows.map(readOpportunity)),
    store.dismissedSearches === undefined ? [] : store.dismissedSearches(a.siteId).catch(() => []),
    store.askedBeside === undefined ? [] : store.askedBeside(a.siteId, ASKED_TOPICS.maxAgeDays).catch(() => []),
  ]);
  // A pass hands its market in; without one, the one in force is read.
  const market = a.market !== undefined ? a.market : (await store.marketFor(a.siteId)).market;
  const pool = refillTopics({
    report: a.report,
    market,
    asked: [...askedOfReport(a.report), ...stored],
    spare: a.spare ?? [],
    refused: a.refused ?? [],
    taken: held.flatMap((row) => [...(row.targetQuery === null ? [] : [row.targetQuery]), ...row.absorbedQueries]),
    dismissed: dismissed.map((row) => row.query),
    now: at,
  });
  if (pool.length === 0) return logRefill(a, { added: 0, unused, target });

  const ownRanked = ownRankedValue(a.ownRanked);
  const brandTokens = brandTokensOf(a.report);
  const topTens = await store.topTens([...new Set(held.map((row) => row.scanId))]);
  const placed: Pick<ClusteredCandidate, "targetQuery" | "clusterKey" | "absorbedQueries">[] = held.map((row) => ({
    targetQuery: row.targetQuery,
    clusterKey: row.clusterKey ?? clusterKey(row.targetQuery, brandTokens),
    absorbedQueries: row.absorbedQueries,
  }));
  const queue: ClusteredCandidate[] = pool.flatMap(({ topic, fit }) => {
    const candidate = candidateFor(topic, { siteId: a.siteId, scanId: a.scanId, report: a.report, market, ownRanked });
    if (candidate === null) return [];
    return [{ ...candidate, businessFit: fit, clusterKey: clusterKey(topic.query, brandTokens), absorbedQueries: [] }];
  });

  let added = 0;
  while (unused < target && queue.length > 0) {
    const batch: ClusteredCandidate[] = [];
    while (batch.length < target - unused && queue.length > 0) {
      const candidate = queue.shift()!;
      if (placed.some((row) => sameTopic(row, candidate, topTens))) continue;
      placed.push(candidate);
      batch.push(candidate);
    }
    if (batch.length === 0) break;
    const { created } = await persist({ candidates: batch });
    added += created.length;
    await assessReadiness(a.siteId, { at, only: new Set(created.map((row) => row.id)) });
    unused = (await supplyDepth(a.siteId, at)).unused;
  }
  return logRefill(a, { added, unused, target });
}

function logRefill(a: { siteId: string; scanId: string }, r: { added: number; unused: number; target: number }): { added: number; unused: number } {
  console.log(JSON.stringify({ event: "supply_refill", siteId: a.siteId, scanId: a.scanId, ...r, short: r.unused < r.target }));
  return { added: r.added, unused: r.unused };
}
