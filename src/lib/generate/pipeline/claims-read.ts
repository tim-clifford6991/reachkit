// The research step's claims call, on pages already read. Apart from the claims rules (`./claims.ts`), which many
// modules read, so that only what calls the model loads the model seam.
import { z } from "zod";
import { RESEARCH } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Locale } from "@/lib/locale/locales";
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
 *  page says it, at most `RESEARCH.calls` calls (SPEC §7, D41: "two for research"). Its own function so that stored
 *  page reads can be put through it again without reading the pages. */
export async function readClaims(
  c: CostContext,
  pages: readonly (ReadPage & Wanted)[],
  a: { locale: Locale; search: string; rivals: readonly string[]; today: Date }
): Promise<MarketFact[]> {
  const facts: MarketFact[] = [];
  const perCall = Math.max(1, Math.ceil(Math.min(pages.length, RESEARCH.pagesPerCall * RESEARCH.calls) / RESEARCH.calls));
  for (let at = 0, call = 0; at < pages.length && call < RESEARCH.calls; at += perCall, call++) {
    if (c.capHit()) break;
    const batch = pages.slice(at, at + perCall);
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
    if (answer.kind === "unmeasured") continue;
    facts.push(...admittedClaims(answer.value.claims, batch, a.today, a.rivals));
  }

  return facts;
}
