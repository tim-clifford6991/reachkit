// SPEC §7 (2026-09-29, D12) *A new page adds what the web does not say* ·
// issue 1143 — what a page adds, listed and held to a bar.
//
// Grounding stops an invented fact. It does not stop a page that restates
// the customer's site, or the target's top results, under a new address.
// So the finished page is read once more, beside the top results the
// research step read and the customer's own pages, and each claim it makes
// that neither of them states is listed.
//
// **A listed claim is a sentence of the page, checked in code.** The model
// copies the sentence that makes the claim; it is kept only where its words
// are on the page, and dropped where the same words are on a top result or
// on one of the customer's pages — a sentence copied from either is not
// something the page adds, whatever the model made of it. So the list
// under-reports and never over-reports: a model that paraphrased, or listed
// a quotation, yields nothing.
//
// **The bar is a new page's.** At least `ADDS.min` claims, at least
// `ADDS.businessMin` of them a fact about the business itself. An update is
// listed the same way and held to no bar. What a page short of it becomes
// is the caller's (`../index.ts`): an update of the closest existing page,
// or a page that waits for the founder.
import { z } from "zod";
import { ADDS } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Measured } from "@/lib/measure/measured";
import type { Opportunity } from "@/lib/opportunities/types";
import { renderOf } from "../rules/text";

/** One thing the page says that the web and the site do not. */
export interface AddedClaim {
  /** The sentence of the page that makes the claim, as the page has it. */
  claim: string;
  /** A fact about the business itself: its price, how it works, a result,
   *  or something its founder says. */
  business: boolean;
}

/** What the row keeps (`drafts.meta.adds`), and the review screen lists. */
export interface AddsRecord {
  claims: AddedClaim[];
  /** A new page short of the bar. Always `false` on an update. */
  short: boolean;
}

const ADDS_SCHEMA = z.strictObject({
  claims: z.array(z.strictObject({ quote: z.string(), business: z.boolean() })),
});

const squash = (text: string): string => text.replace(/\s+/g, " ").trim();
/** Two spellings of one sentence: case, and the quotation marks and dashes a
 *  model straightens when it copies. */
const fold = (text: string): string =>
  squash(text)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-");

function words(text: string, limit: number): string {
  return text.split(/\s+/).filter(Boolean).slice(0, limit).join(" ");
}

/** Whether this opportunity's page is written from nothing. An update of a
 *  page that exists, and a fix, are not held to the bar. */
export function plansNewPage(opportunity: Pick<Opportunity, "family">): boolean {
  return opportunity.family === "write" || opportunity.family === "earn";
}

/** The bar (D12): three claims, one of them a business fact. */
export function addsEnough(claims: readonly AddedClaim[]): boolean {
  return claims.length >= ADDS.min && claims.filter((each) => each.business).length >= ADDS.businessMin;
}

/**
 * The claims the listing returned that are sentences of the page and of
 * nothing it was compared with, once each, at most `ADDS.maxClaims`.
 */
export function admittedAdds(
  listed: readonly { quote: string; business: boolean }[],
  a: { markdown: string; compared: readonly string[] }
): AddedClaim[] {
  const page = fold(renderOf(a.markdown));
  const compared = a.compared.map(fold);
  const out: AddedClaim[] = [];
  for (const each of listed) {
    const claim = squash(each.quote);
    const folded = fold(claim);
    if (claim.length < 20 || claim.length > 400) continue;
    if (!page.includes(folded)) continue;
    if (compared.some((text) => text.includes(folded))) continue;
    if (out.some((kept) => fold(kept.claim) === folded)) continue;
    out.push({ claim, business: each.business });
    if (out.length >= ADDS.maxClaims) break;
  }
  return out;
}

/**
 * What the finished page adds. One call on the small tier — the tier the
 * 2026-09-29 comparison listed these on — and `unmeasured` where it did not
 * answer: a page whose list could not be made is not a page that passed.
 */
export async function listAdds(
  c: CostContext,
  a: {
    search: string;
    markdown: string;
    /** The target's top results, as the research step read them. */
    topResults: readonly { url: string; text: string }[];
    /** The customer's own pages, each one's text whole. */
    sitePages: readonly { url: string; text: string }[];
  }
): Promise<Measured<AddedClaim[]>> {
  let left: number = ADDS.siteWords;
  const site = a.sitePages.flatMap((page) => {
    const text = words(page.text, Math.min(ADDS.sitePageWords, left));
    left -= text.split(" ").length;
    return text === "" ? [] : [{ url: page.url, text }];
  });
  const answer = await llm(c, {
    site: "generate.adds",
    tier: "haiku",
    schema: ADDS_SCHEMA,
    input: {
      task:
        "`page` was written for `search`. `topResults` is the text of that search's top results and " +
        "`site` is the text of the business's own pages. Copy out every claim `page` makes — a fact, a " +
        "figure, a named finding or a specific recommendation — that neither `topResults` nor `site` " +
        "states or plainly implies. Copy each as the one sentence of `page` that makes it, exactly, " +
        "character for character; never paraphrase and never join two sentences. Leave out generic " +
        "advice any of the results already gives, anything `page` quotes or cites from another page, " +
        "and headings. Set `business` true where the claim is a fact about this business itself — its " +
        "price, how it works, a result it measured or delivered, or something its founder says — and " +
        `false for a fact about the market or a recommendation. At most ${ADDS.maxClaims}. An empty ` +
        "list is a fine answer.",
      search: a.search,
      topResults: a.topResults,
      site,
      page: squash(renderOf(a.markdown)),
    },
  });
  if (answer.kind === "unmeasured") return answer;
  return {
    ...answer,
    value: admittedAdds(answer.value.claims, {
      markdown: a.markdown,
      compared: [...a.topResults, ...a.sitePages].map((each) => each.text),
    }),
  };
}
