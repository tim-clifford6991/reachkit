// SPEC §0 *Business fit*, §6 *Topics by business fit* (owner, 2026-09-29,
// 2026-10-02 and 2026-10-03; issue 1134) — the pass's one judgement of fit.
//
// One call a pass, over every search the pass would write, update or
// propose: how much is this business's own offering the answer to it? The
// answer is stored on the row (`business_fit`); readiness and the ranking
// read the column and nothing downstream judges it again (#884).
//
// The scale is anchored, because an unanchored one scored 22 candidates at
// the top (round 1 review, 2026-10-02): 3 means the searcher would buy this
// product instead of what the top results list. And the top is bounded in
// code, not only in the prompt: at most `TOPIC_FIT.topShare` of the searches
// keep a 3, in the order the model itself ranked them, and the rest are 2.
//
// The model scores and words a title; it cannot add a search, drop one or
// change one — a score for an index it was not shown does not count. An
// unavailable model or a reached cap is no judgement at all: nothing is
// scored, nothing is proposed, and the pass derives what it derived before.
import type { KnowledgeDigest } from "@/lib/site-profile/knowledge/read";
import { z } from "zod";
import { TOPIC_FIT } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { MarketConclusion } from "@/lib/market/infer/types";
import type { Profile } from "@/lib/market/questions/profile";
import type { BusinessFit, TopicSource } from "../types";

export const FIT_CALL_SITE = "topic-fit";

const FIT_SCHEMA = z.strictObject({
  scores: z.array(
    z.strictObject({
      i: z.number().int(),
      fit: z.number().int().min(0).max(3),
      title: z.string(),
    })
  ),
  strongest: z.array(z.number().int()),
});

const TASK = [
  "Score each search's business fit for this product, 0 to 3: how much the product itself is the answer to the search.",
  "3 — the searcher would buy this product instead of what the top results list. The product against a named rival, a rival's alternatives, the product's category for its own buyer, its price, or the exact problem the product exists to solve end to end.",
  "2 — the product plainly helps with what is asked, but the searcher is not yet choosing a product like it.",
  "1 — the product could only be mentioned in passing. A generic 'best' or 'free' list for a neighbouring or broader category is 1 at most.",
  "0 — no relation, or the search belongs to one of the markets in `notOurMarket`.",
  "Judge against `market` and `product` only. Volume, and how the search is worded, say nothing about fit.",
  "At most a quarter of the searches may be 3. List the indexes you scored 3 in `strongest`, strongest first.",
  "For each search scored 2 or 3, give `title`: the angle of the page that would answer it for this buyer, under 70 characters — what the page shows or argues, not the search restated, and naming the product only where the search does. For 0 and 1, an empty string.",
].join(" ");

export interface FitSearch {
  query: string;
  source: TopicSource;
}

export interface FitJudgement {
  fit: BusinessFit;
  /** The page's angle, where the model gave one for a fit of 2 or 3. */
  title: string | null;
}

/** How many of `count` searches may keep the top fit. */
export function topFitAllowance(count: number): number {
  return Math.max(TOPIC_FIT.topMin, Math.ceil(count * TOPIC_FIT.topShare));
}

/**
 * The scores as stored: one per index shown, the top fit kept only by the
 * first `topFitAllowance` of them in the model's own `strongest` order (a 3
 * it did not rank comes after every 3 it did), the rest held at 2. Pure.
 */
export function boundTopFit(
  scores: readonly { i: number; fit: number; title: string }[],
  strongest: readonly number[],
  count: number
): Map<number, FitJudgement> {
  const out = new Map<number, FitJudgement>();
  for (const score of scores) {
    if (score.i < 0 || score.i >= count || out.has(score.i)) continue;
    const title = score.fit >= TOPIC_FIT.gate && score.title.trim() !== "" ? score.title.trim() : null;
    out.set(score.i, { fit: score.fit as BusinessFit, title });
  }
  const order = new Map<number, number>();
  strongest.forEach((index, place) => {
    if (!order.has(index)) order.set(index, place);
  });
  const top = [...out.entries()]
    .filter(([, judged]) => judged.fit === 3)
    .map(([index]) => index)
    .sort((x, y) => (order.get(x) ?? Infinity) - (order.get(y) ?? Infinity) || x - y);
  for (const index of top.slice(topFitAllowance(count))) {
    out.set(index, { ...out.get(index)!, fit: 2 });
  }
  return out;
}

/**
 * Fit for each of `searches`, by its index. Empty where there is nothing to
 * judge, nothing to judge against, or no judgement came back.
 */
export async function judgeFit(
  c: CostContext,
  a: {
    searches: readonly FitSearch[];
    market: MarketConclusion | null;
    profile: Profile | null;
    domain: string;
    knowledge?: KnowledgeDigest | null;
  }
): Promise<ReadonlyMap<number, FitJudgement>> {
  const searches = a.searches.slice(0, TOPIC_FIT.maxCandidates);
  if (searches.length === 0 || (a.market === null && a.profile === null)) return new Map();

  const market =
    a.market === null
      ? { category: a.profile!.category, job: a.profile!.job, buyer: a.profile!.audienceTerms.join(", ") }
      : {
          buyer: a.market.buyer,
          job: a.market.job,
          category: a.market.category,
          synonyms: a.market.synonyms,
          differentiators: a.market.differentiators,
          notOurMarket: a.market.notOurMarket,
          rivals: a.market.rivals.map((rival) => rival.name || rival.domain),
        };

  const answer = await llm(c, {
    site: FIT_CALL_SITE,
    input: {
      task: TASK,
      product: {
        domain: a.domain,
        offering: a.profile?.offeringType ?? null,
        // The knowledge base, where the site has one (SPEC §6, 2026-09-29).
        ...(a.knowledge == null ? {} : { knowledge: a.knowledge }),
      },
      market,
      searches: searches.map((search, i) => ({ i, search: search.query, source: search.source })),
    },
    schema: FIT_SCHEMA,
    tier: "sonnet",
  });
  if (answer.kind === "unmeasured") return new Map();
  return boundTopFit(answer.value.scores, answer.value.strongest, searches.length);
}
