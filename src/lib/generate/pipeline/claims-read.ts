// The research step's claims call, on pages already read. Apart from the claims rules (`./claims.ts`), which many
// modules read, so that only what calls the model loads the model seam.
import { z } from "zod";
import { RESEARCH } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Locale } from "@/lib/locale/locales";
import { recordOpsEvent } from "@/lib/ops/events";
import { admittedClaims } from "./claims";
import type { MarketFact, ReadPage, Wanted } from "./research";

export const CLAIMS_SCHEMA = z.strictObject({
  claims: z.array(
    z.strictObject({
      page: z.number().int(),
      quote: z.string(),
      /** For a statistic, the year its data is from. */
      year: z.number().int().nullable(),
      /** What the claim states (D56): the price of the page's own product,
       *  what that product does, or neither. */
      about: z.enum(["price", "product", "other"]),
      /** Issue 1485: the plan or tier the claim belongs to, as the page
       *  names it, or null where it is true of every plan. */
      plan: z.string().nullable(),
      /** Issue 1485: the domain of the one of `rivals` the claim is about,
       *  or null. */
      rival: z.string().nullable(),
    })
  ),
});

/** The claims call of the research step, on pages already read: a few pages a call, each claim kept only where its
 *  page says it, at most `RESEARCH.calls` calls (SPEC §7, D41: "two for research"), and a call that times out tried
 *  once more as two halves. Its own function so that stored page reads can be put through it again without reading them. */
export async function readClaims(
  c: CostContext,
  pages: readonly (ReadPage & Wanted)[],
  a: { locale: Locale; search: string; rivals: readonly string[]; today: Date; siteId?: string; page?: string }
): Promise<MarketFact[]> {
  const facts: MarketFact[] = [];
  const read = pages.slice(0, RESEARCH.pagesPerCall * RESEARCH.calls);
  // Dealt in turn, so the first pages read, the top results, never all ride the one call that can time out.
  const batches = Array.from({ length: Math.min(RESEARCH.calls, read.length) }, (_, call) => read.filter((_, at) => at % RESEARCH.calls === call));
  const claimsOf = async (batch: readonly (ReadPage & Wanted)[]) => {
    if (c.capHit()) return { lost: batch, because: "cap" };
    const answer = await llm(c, {
      site: "generate.research",
      tier: "haiku",
      locale: a.locale,
      schema: CLAIMS_SCHEMA,
      instructions: ["task", "locale"],
      input: {
        task:
          "Copy out the claims a writer answering `search` could cite from these pages: prices and what " +
          "each plan includes, features, limits, statistics, dates, named findings, definitions. At most " +
          `${RESEARCH.claimsPerPage} a page, each one or two sentences copied exactly, character for ` +
          "character — never paraphrase, never join text from two places. On a pricing page copy each " +
          "plan's name with its price. Skip menus, cookie notices, author biographies and calls to action. " +
          "For a statistic give the year its data is from; otherwise null. Give each claim's `plan`: the name " +
          "of the plan, tier or trial it belongs to, copied as the page writes it (\"Free trial\", \"Starter\", " +
          "\"Enterprise\"), or null only where it is true of every plan. On a pricing page a limit, an engine " +
          "list or an allowance listed under one plan belongs to that plan. Give each claim's `rival`: the " +
          "domain of the one of `rivals` it is about, or null. Say what each claim is `about`: " +
          "`price` where it states what the product whose page it is on costs, or how it is priced; `product` " +
          "where it says what that product does, includes or limits; `other` for anything else — a customer " +
          "count, a slogan, a statistic about the market or about another company's product.",
        search: a.search,
        rivals: a.rivals,
        today: a.today.toISOString().slice(0, 10),
        pages: batch.map((page, index) => ({ page: index + 1, url: page.url, text: page.text })),
      },
    });
    if (answer.kind === "unmeasured") return { lost: batch, because: answer.because ?? answer.reason };
    facts.push(...admittedClaims(answer.value.claims, batch, a.today, a.rivals));
    return { lost: [], because: "" };
  };
  // Together, batches and halves alike, so a retry adds one call's time and never two to the job's ceiling.
  await Promise.all(batches.map(async (batch) => {
    const first = await claimsOf(batch);
    const half = Math.ceil(batch.length / 2);
    const tried = first.because === "timeout" && batch.length > 1 ? await Promise.all([claimsOf(batch.slice(0, half)), claimsOf(batch.slice(half))]) : [first];
    const lost = tried.flatMap((each) => each.lost.map((page) => page.url));
    // A page whose claims were never read is counted by the daily check, never dropped unseen.
    if (lost.length > 0) void recordOpsEvent("research_claims_dropped", JSON.stringify({ page: a.page ?? a.search, lost }), tried.find((each) => each.lost.length > 0)!.because.slice(0, 40), a.siteId ?? null);
  }));

  return facts;
}
