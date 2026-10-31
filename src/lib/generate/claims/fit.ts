// SPEC §7 *honesty by page type* (owner, 2026-09-29; D20, 2026-10-02; issue
// 1136) — the fit check.
//
// "The page never claims a fit the knowledge base does not support." Every
// page ReachKit writes is read for it, whatever its type — a Write or an Earn
// page, and an update too: the draft this check was built to stop, "ReachKit
// is the best local SEO software" (2026-09-28), was a refresh of a page
// ReachKit had written, and the knowledge base says ReachKit is no local SEO
// software at all.
//
// **What is asked, and of what.** Only the sentences that name the business
// — its title included, unless the title rule makes it name the business —
// are sent, numbered, beside the knowledge base. A
// sentence that does not name it claims nothing about it. The small tier
// answers with the indexes of the sentences that claim a use, an audience or
// a category the knowledge base does not support, and nothing else: the
// sentences named back are the page's own, read out of the list by index,
// and no word the model wrote is kept.
//
// **A check that cannot decide does not fail a page.** No knowledge base, no
// recorded brand, or a page that never names the business — each passes at no
// cost.
//
// **"We could not check" is not "it passed"** — `claims/check.ts`'s own
// rule. A model that did not answer and the spend ceiling both resolve to
// `unrun`, and an unrun check holds the page without consuming the one
// automatic regeneration.
//
// This is the check SPEC §7's critic makes for fit to the business (*Length
// and the writer*, 2026-09-29). The critic pass itself is issue 1138's; when
// it lands, this is the part of it that stops a page.
import { z } from "zod";
import { FIT_CHECK_MAX_SENTENCES } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import { brandTokens, namesBrand } from "../rules/brand";
import { renderOf, sentencesOf } from "../rules/text";
import type { PromptKnowledge } from "../voice/profile-block";

export type FitVerdict =
  | { state: "passed" }
  /** The page's own sentences, as written. */
  | { state: "failed"; sentences: string[] }
  | { state: "unrun"; reason: "llm_unavailable" | "cap_hit" };

/** The one call site this module reaches the model at. */
export const FIT_CHECK_CALL_SITE = "generate.fit_check";

/** `claims` is the category or use the sentence puts the business in, in a
 *  few words. It is asked for because naming it is what makes the model
 *  compare it with the knowledge base; it is never kept or shown. */
const FIT_CHECK_SCHEMA = z.strictObject({
  unsupported: z.array(z.strictObject({ index: z.number().int(), claims: z.string() })),
});

const TABLE_LINE_RE = /^[ \t]*\|.*\|[ \t]*$/;
const TABLE_RULE_RE = /^[ \t|:-]+$/;

/** The sentences a fit check reads: the title and every sentence of the
 *  body that names the business, once each, in order. A title the title rule
 *  makes name the business ("ReachKit vs Seobility") claims no fit and is
 *  left out. A table is read row
 *  by row — the rules' own splitter takes a whole table as one block, and a
 *  whole comparison is not a claim about one business. */
export function brandSentences(a: {
  title: string;
  markdown: string;
  businessName: string | null;
  domain: string;
  titleOwed?: boolean;
}): string[] {
  const tokens = brandTokens(a);
  const out: string[] = [];
  const lines = a.markdown.split("\n");
  const prose = lines.filter((line) => !TABLE_LINE_RE.test(line)).join("\n");
  const rows = lines
    .filter((line) => TABLE_LINE_RE.test(line) && !TABLE_RULE_RE.test(line))
    .map((line) => renderOf(line).replace(/\s+/g, " ").trim());
  for (const text of [...(a.titleOwed === true ? [] : [a.title]), ...sentencesOf(prose).map((sentence) => sentence.text), ...rows]) {
    if (namesBrand(text, tokens) && !out.includes(text)) out.push(text);
  }
  return out.slice(0, FIT_CHECK_MAX_SENTENCES);
}

export async function fitCheck(
  c: CostContext,
  a: {
    title: string;
    markdown: string;
    businessName: string | null;
    domain: string;
    /** The title rule requires the title to name the business. */
    titleOwed?: boolean;
    /** The knowledge base the writer was handed, or absent where nothing was
     *  read or said of the business. */
    knowledge: PromptKnowledge | undefined;
    /** The market the site is in (`sites.market`, issue 1248): its category,
     *  who buys and the job. A sentence that places the business in its own
     *  market is supported by it. */
    market?: unknown;
  }
): Promise<FitVerdict> {
  if (a.knowledge === undefined) return { state: "passed" };
  const sentences = brandSentences(a);
  if (sentences.length === 0) return { state: "passed" };

  // The ceiling is read before the call, never after.
  if (c.capHit()) return { state: "unrun", reason: "cap_hit" };

  const verdict = await llm(c, {
    site: FIT_CHECK_CALL_SITE,
    tier: "nano",
    schema: FIT_CHECK_SCHEMA,
    input: {
      task:
        "`sentences` are taken from a page written for the business in `business`. `knowledge` is " +
        "everything known about that business: what it sells, who it serves, the problems it solves, " +
        "how it differs, and its proof; `market`, where given, is the market it is in, and placing " +
        "the business in that market or among its named rivals is supported. Find the sentences that say `business` itself is a kind of " +
        "product, or is for a use, an audience or a market, that `knowledge` does not support — for " +
        "example one calling it the best software of a category `knowledge` never places it in. " +
        "Judge only what a sentence claims about `business`: what it says about any other product, " +
        "or about the market, is not your concern. A sentence that describes `business` doing what " +
        "`knowledge` says it does, in other words, is supported. Where you are not sure, do not list " +
        "it. Answer only with the JSON object {unsupported}: for each such sentence its 0-based " +
        "`index` and, in `claims`, the unsupported category or use in a few words; an empty list " +
        "where there is none.",
      business: { name: a.businessName, domain: a.domain },
      knowledge: a.knowledge,
      market: a.market ?? null,
      sentences: sentences.map((sentence, index) => ({ index, sentence })),
    },
  });

  if (verdict.kind === "unmeasured") {
    return { state: "unrun", reason: verdict.reason === "not_attempted" ? "cap_hit" : "llm_unavailable" };
  }
  const named = [...new Set(verdict.value.unsupported.map((entry) => entry.index))]
    .map((index) => sentences[index])
    .filter((sentence): sentence is string => sentence !== undefined);
  return named.length === 0 ? { state: "passed" } : { state: "failed", sentences: named };
}
