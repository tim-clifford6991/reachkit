// SPEC §7 (issue 1262): the call that holds news results to events in the site's market, for the weekly pass's market
// changes, and names what each reports. An explainer or a story naming nothing new is still a change, ranked lower.
import { z } from "zod";
import { RESEARCH } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Locale } from "@/lib/locale/locales";
import type { WritingMarket } from "@/lib/generate/voice/market";

const NEWS_FIT_SCHEMA = z.strictObject({
  results: z.array(z.strictObject({ result: z.number().int(), about: z.boolean(), event: z.boolean(), names: z.string().nullable() })),
});

/** Why a story in the market ranks lower: it reports no dated event, or names no new product, model, version, rule or price. */
export type Weak = "not_an_event" | "not_named";

/** What the judge held of a result: what it names, null and why where it is weak, or that it is not of the market. */
export type NewsVerdict = { names: string; weak?: never } | { names: null; weak: Weak } | { not: "our_market" };

/** Each index of `results` the judge answered for; `null` where the call could not be made or did not answer. */
export async function newsFit(
  c: CostContext,
  a: { locale: Locale; market: Pick<WritingMarket, "category" | "synonyms" | "market">; fallback: string; results: readonly { title: string; source: string; text: string }[] }
): Promise<Map<number, NewsVerdict> | null> {
  const job = a.market.market?.job ?? null;
  const answer = await llm(c, {
    site: "generate.news_fit",
    tier: "haiku",
    locale: a.locale,
    schema: NEWS_FIT_SCHEMA, instructions: ["task", "locale"],
    input: {
      task:
        "Each of `results` is a news story a search returned for `market.category` or for something that moves it. Say for each whether it " +
        "is about that market: the one named `market.category`, also called `market.synonyms`" +
        (job === null ? "" : ", where a product is hired for `market.job`") +
        ". A story is about the market when it reports something that changes what someone buying or selling in " +
        "this market does, and they would read it as news of their own market. A " +
        "story that only shares words with the category, or is about one of `market.notOurMarket` or another " +
        "neighbouring market, is not. Answer for every result by its number; where you cannot tell, answer false. " +
        "Say for each whether it is an `event`: it reports something that happened on a stated day — a launch, an update, a rule, " +
        "a price change, a study, a ruling. An explainer, a guide, an opinion, a list or a press release about a vendor's own " +
        "service is not an event. Give each result's `names`: the new product, model, version, rule or price it reports, as the story names it, or null.",
      market: {
        category: a.market.category.trim() === "" ? a.fallback : a.market.category,
        synonyms: a.market.synonyms,
        ...(job === null ? {} : { job }),
        notOurMarket: a.market.market?.notOurMarket ?? [],
      },
      results: a.results.slice(0, RESEARCH.recentJudged).map((page, index) => ({
        result: index + 1,
        title: page.title,
        source: page.source,
        text: page.text.split(/\s+/).filter(Boolean).slice(0, RESEARCH.judgedWords).join(" "),
      })),
    },
  });
  if (answer.kind === "unmeasured") return null;
  return new Map(answer.value.results.map((row): [number, NewsVerdict] => [row.result - 1,
    !row.about ? { not: "our_market" } : !row.event ? { names: null, weak: "not_an_event" } : row.names === null || row.names.trim() === "" ? { names: null, weak: "not_named" } : { names: row.names.trim() }]));
}
