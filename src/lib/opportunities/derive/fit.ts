// SPEC §0 *Business fit*, §6 *Topics by business fit* — the pass's one judgement of fit: one call over every search the
// pass would write, update or propose, stored on the row (`business_fit`) so nothing downstream judges it again.
//
// The scale is anchored (3: the searcher would buy this product instead of what the top results list), and the top is
// bounded in code: at most `TOPIC_FIT.topShare` keep a 3, in the model's own order, and the rest are 2. A new topic of
// 2 or 3 names the knowledge-base passage that answers it, and one naming none it was shown is stored as 1. The model
// cannot add, drop or change a search. An unavailable model or a reached cap is no judgement, and every search stays unscored.
import type { Language, Locale } from "@/lib/locale/locales";
import type { FitFact, KnowledgeDigest } from "@/lib/site-profile/knowledge/read";
import { z } from "zod";
import { TOPIC_FIT } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { MarketConclusion } from "@/lib/market/infer/types";
import type { Profile } from "@/lib/market/questions/profile";
import type { BusinessFit, TopicSource } from "../types";
import { ANGLE_ASK, ANGLE_PATTERNS, pickAngle, type ProposedAngle, type TopicAngle } from "@/lib/market/questions/angle";

export const FIT_CALL_SITE = "topic-fit";

const FIT_SCHEMA = z.strictObject({
  scores: z.array(
    z.strictObject({
      i: z.number().int(),
      fit: z.number().int().min(0).max(3),
      fact: z.number().int().nullable(),
      angles: z.array(
        z.strictObject({ pattern: z.enum(ANGLE_PATTERNS), title: z.string(), promise: z.string(), fact: z.number().int().nullable() })
      ),
    })
  ),
  strongest: z.array(z.number().int()),
});

const TASK = [
  "Score each search's business fit for this product, 0 to 3: how much the product itself is the answer to the search.",
  "3 — the searcher would buy this product instead of what the top results list. The product against a named rival, a rival's alternatives, the product's category for its own buyer, its price, or the exact problem the product exists to solve end to end.",
  "2 — the product plainly helps with what is asked, but the searcher is not yet choosing a product like it.",
  "1 — the product could only be mentioned in passing. A generic 'best' or 'free' list for a neighbouring or broader category is 1 at most.",
  // A site's own category, such as "best AI visibility tools for small businesses", was scored 1 as a generic list.
  "`market.category` and `market.synonyms` are the names buyers search this one market under. A search for the tools, software or services of any of them, or of a plain rewording of one, is the product's own category and not a neighbouring one: a 'best' list for it is 3 where it also names the product's buyer, and 2 otherwise.",
  "0 — no relation, or the search belongs to one of the markets in `notOurMarket`.",
  "Judge against `market` and `product` only. Volume, and how the search is worded, say nothing about fit.",
  "At most a quarter of the searches may be 3. List the indexes you scored 3 in `strongest`, strongest first.",
  "For each search scored 2 or 3, give `fact`: the `i` of the `product.knowledge` passage that shows this business can answer it from what it sells, does or knows. A search no passage answers is 1 at most. For 0 and 1, null.",
  `For each search scored 3, give \`angles\`: ${ANGLE_ASK.pages}`,
  `${ANGLE_ASK.title} For 0, 1 and 2, no angles.`,
].join(" ");

export interface FitSearch {
  query: string;
  /** The first titles of its stored top ten: what already ranks, which an angle must not merely repeat. */
  ranks?: readonly string[];
  source: TopicSource;
  update?: boolean; // An update of the site's own page is no new topic, so it needs no passage.
}

export interface FitJudgement {
  fit: BusinessFit;
  /** The page's angle title, where one of the model's angles passed for a fit of 3: only a 3 is written, so only a 3 is given angles. */
  title: string | null;
  /** The angle kept; `null` where none passed. */
  angle: TopicAngle | null;
  fact: FitFact | null; // The passage that answers a new topic of fit 2 or 3.
}

/** How many of `count` searches may keep the top fit. */
export function topFitAllowance(count: number): number {
  return Math.max(TOPIC_FIT.topMin, Math.ceil(count * TOPIC_FIT.topShare));
}

/** The scores as stored: one per index shown, a new topic of 2 or 3 naming no passage shown held at 1, and the top fit
 *  kept by the first `topFitAllowance` in the model's `strongest` order (an unranked 3 last), the rest at 2. Pure. */
export function boundTopFit(
  scores: readonly { i: number; fit: number; fact?: number | null; angles?: readonly ProposedAngle[] }[],
  strongest: readonly number[],
  searches: readonly Pick<FitSearch, "update" | "query" | "ranks">[],
  knowledge: KnowledgeDigest | null = null,
  names: { own: readonly string[]; rivals: readonly string[]; language?: Language } = { own: [], rivals: [] }
): Map<number, FitJudgement> {
  const sources = [...(knowledge ?? []).map((passage) => passage.text), ...names.own, ...names.rivals];
  const out = new Map<number, FitJudgement>();
  for (const score of scores) {
    if (score.i < 0 || score.i >= searches.length || out.has(score.i)) continue;
    const newTopic = score.fit >= TOPIC_FIT.gate && searches[score.i]!.update !== true;
    const passage = newTopic ? (knowledge?.[score.fact ?? -1] ?? null) : null;
    const fit = (newTopic && passage === null ? 1 : score.fit) as BusinessFit;
    const search = searches[score.i]!;
    const chosen = fit < TOPIC_FIT.gate ? null : pickAngle(score.angles ?? [], { search: search.query ?? "", sources, ranks: search.ranks ?? [], rivals: names.rivals, ...(names.language === undefined ? {} : { language: names.language }), ...(knowledge === null ? {} : { passages: knowledge.length }) });
    const angle = chosen && { pattern: chosen.pattern, promise: chosen.promise, gap: chosen.gap };
    out.set(score.i, { fit, title: chosen?.title ?? null, angle, fact: passage === null || passage.about === "offering" || passage.unquoted ? null : { text: passage.text, source: passage.source } });
  }
  const order = new Map<number, number>();
  strongest.forEach((index, place) => {
    if (!order.has(index)) order.set(index, place);
  });
  const top = [...out.entries()]
    .filter(([, judged]) => judged.fit === 3)
    .map(([index]) => index)
    .sort((x, y) => (order.get(x) ?? Infinity) - (order.get(y) ?? Infinity) || x - y);
  for (const index of top.slice(topFitAllowance(searches.length))) {
    out.set(index, { ...out.get(index)!, fit: 2 });
  }
  return out;
}

/** Fit for each of `searches`, by its index. Empty where there is nothing to judge, nothing to judge against, or no judgement came back. */
export async function judgeFit(
  c: CostContext,
  a: {
    searches: readonly FitSearch[];
    market: MarketConclusion | null;
    /** The site's country and language (D66): the searches are in it. */
    locale?: Locale;
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

  const ask = () => llm(c, {
    site: FIT_CALL_SITE,
    input: {
      task: TASK,
      product: {
        domain: a.domain,
        offering: a.profile?.offeringType ?? null,
        // The knowledge base, where the site has one (SPEC §6, 2026-09-29).
        ...(a.knowledge == null ? {} : { knowledge: a.knowledge.map((passage, i) => ({ i, about: passage.about, text: passage.text })) }),
      },
      market,
      searches: searches.map((search, i) => ({ i, search: search.query, source: search.source, ...(search.ranks?.length ? { ranks: search.ranks } : {}) })),
    },
    schema: FIT_SCHEMA,
    tier: "sonnet",
    ...(a.locale === undefined ? {} : { locale: a.locale }),
  });
  // Asked once more only where the answer came back unreadable, never cut off or refused; the cap still decides.
  const first = await ask(), answer = first.kind === "unmeasured" && first.because === "parse" ? await ask() : first;
  if (answer.kind === "unmeasured") return new Map();
  return boundTopFit(answer.value.scores, answer.value.strongest, searches, a.knowledge ?? null, { own: [a.domain], rivals: a.market?.rivals.flatMap((rival) => [rival.name, rival.domain]) ?? [], ...(a.locale === undefined ? {} : { language: a.locale.language }) });
}
