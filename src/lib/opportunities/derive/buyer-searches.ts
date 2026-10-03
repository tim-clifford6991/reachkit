// SPEC §6 *Write targets in the buyer's words* (2026-10-03, issue 1208).
//
// A market's category and synonyms are what ReachKit calls the market, not
// what its buyer types: reachkit.app's pass of 2026-10-03 proposed "buyer
// discovery tracking pricing" and "search and ai ranking pricing", and the
// fit judgement — which is told wording says nothing about fit — kept them
// at 3. Two small-tier calls a pass, both before that judgement:
//
//   `writeBuyerSearches`  the searches a buyer types for the job and its
//                         problems, written from the market's buyer and job
//                         and the site's tracked buyer prompts (D19).
//   `judgeTyped`          "would a buyer search this?" — over every search
//                         nothing measured, whoever worded it.
//
// Neither decides a write target: a search still needs the top fit. An
// unavailable model or a reached cap writes no search and passes none, so
// the pass proposes less, never something unchecked.
import { z } from "zod";
import { BUYER_SEARCHES } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { queryKey } from "../cluster";

export const BUYER_SEARCHES_CALL_SITE = "topic-buyer-searches";
export const TYPED_CALL_SITE = "topic-typed";

const WRITTEN_SCHEMA = z.strictObject({
  problems: z.array(z.string()),
  solutions: z.array(z.string()),
});

const WRITE_TASK = [
  "Write the searches this product's buyers type into Google, or ask an AI assistant, in the buyer's own words.",
  "`market` is the product's buyer, the job they hire it for and how the vendor names its category; `prompts` are questions those buyers put to answer engines.",
  "The category and its synonyms are the vendor's labels. Do not copy one into a search unless buyers really say it that way.",
  `Give at least ${BUYER_SEARCHES.minProblems} \`problems\`: a how-to or a why about the pain itself, as someone who has never heard of the category would type it, naming the everyday things they use.`,
  "Give `solutions`: what they type to find a tool or a service for the job, for their own kind of business.",
  `At most ${BUYER_SEARCHES.max} in all. Each is ${BUYER_SEARCHES.minWords + 1} to ${BUYER_SEARCHES.maxWords - 1} lowercase words, names neither the product nor a rival, and no two ask the same question.`,
].join(" ");

function shaped(text: string): string | null {
  const search = queryKey(text).replace(/[.?!"]+/g, "").replace(/\s+/g, " ").trim();
  const words = search === "" ? 0 : search.split(" ").length;
  return words < BUYER_SEARCHES.minWords || words > BUYER_SEARCHES.maxWords ? null : search;
}

/**
 * The buyer's own searches for this market, problems first. Empty where
 * there is no market to write from or no answer came back. A search naming
 * one of `brands` is dropped: the product against a rival is the templates'
 * (`derive/topics.ts`), built from the rivals the market concluded.
 */
export async function writeBuyerSearches(
  c: CostContext,
  a: { market: MarketConclusion | null; prompts: readonly string[]; brands: readonly string[] }
): Promise<string[]> {
  if (a.market === null) return [];
  const answer = await llm(c, {
    site: BUYER_SEARCHES_CALL_SITE,
    input: {
      task: WRITE_TASK,
      market: {
        buyer: a.market.buyer,
        job: a.market.job,
        category: a.market.category,
        synonyms: a.market.synonyms,
        differentiators: a.market.differentiators,
      },
      prompts: a.prompts,
    },
    schema: WRITTEN_SCHEMA,
    tier: "haiku",
  });
  if (answer.kind === "unmeasured") return [];

  const out: string[] = [];
  for (const text of [...answer.value.problems, ...answer.value.solutions]) {
    const search = shaped(text);
    if (search === null || out.includes(search) || out.length >= BUYER_SEARCHES.max) continue;
    const padded = ` ${search} `;
    if (a.brands.some((brand) => padded.includes(` ${brand} `))) continue;
    out.push(search);
  }
  return out;
}

const TYPED_SCHEMA = z.strictObject({ typed: z.array(z.number().int()) });

const TYPED_TASK = [
  "For each search, by its index `i`: would a real buyer type these words into Google or ask them of an AI assistant? List the indexes that would in `typed`.",
  "A search passes when it reads as something a person types: plain words for their own problem, or for the products they are choosing between.",
  "It fails when it is a vendor's own category label or positioning phrase — with or without 'pricing', 'for …' or 'vs …' attached — that buyers do not say, when it joins with 'and' two things nobody searches together, or when no person would word it that way.",
  "A product named in `brands` with 'alternatives', 'vs' another product, or 'pricing' passes.",
  "Judge the wording only, never whether the topic matters to this business.",
].join(" ");

/**
 * The indexes of `searches` a buyer would type, or `null` where no
 * judgement came back — which passes none of them.
 */
export async function judgeTyped(
  c: CostContext,
  a: { searches: readonly string[]; market: MarketConclusion | null; brands: readonly string[] }
): Promise<ReadonlySet<number> | null> {
  const searches = a.searches.slice(0, BUYER_SEARCHES.maxChecked);
  if (searches.length === 0) return new Set();
  const answer = await llm(c, {
    site: TYPED_CALL_SITE,
    input: {
      task: TYPED_TASK,
      buyer: a.market?.buyer ?? null,
      brands: a.brands,
      searches: searches.map((search, i) => ({ i, search })),
    },
    schema: TYPED_SCHEMA,
    tier: "haiku",
  });
  if (answer.kind === "unmeasured") return null;
  return new Set(answer.value.typed.filter((i) => i >= 0 && i < searches.length));
}
