// SPEC §7 *honesty by page type* — the fit check: the page never claims a fit or a promise the knowledge base does not
// support.
//
// **What is asked, and of what.** The sentences that name the business or speak as it ("we", "our") — its title
// included, unless the title rule makes it name the business — are sent, numbered, beside the knowledge base. The small
// tier answers with the indexes of those that claim a use, an audience or a category, or promise a step, a timeline or
// a result, the knowledge base does not support: the sentences named back are the page's own, and no word the model
// wrote is kept.
//
// **A check that cannot decide does not fail a page.** No knowledge base, or no such sentence, passes at no cost. A
// model that did not answer and the spend ceiling both resolve to `unrun`, which the battery reads as failed on every
// business sentence (`../rules/index.ts`), so the fit drop removes them and the page is never stopped for it.
import { z } from "zod";
import { FIT_CHECK_MAX_SENTENCES } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
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

/** What an unsupported claim is: the one wording the fit check judges by and the writer is told
 *  (`../pipeline/write.ts`), so what is written and what is checked cannot drift apart (owner, 2026-11-04,
 *  "only generate content that complies"; issue 2375). */
export const UNSUPPORTED_CLAIM =
  "An unsupported claim says the business itself is a kind of product, or is for a use, an audience or a market, " +
  "that what is known about the business does not support — for example, calling it the best software of a category " +
  "what is known about it never places it in; or promises the reader a step, a timeline or a result from the business " +
  "that what is known about the business does not state.";

/** `claims` is the category or use the sentence puts the business in, in a
 *  few words. It is asked for because naming it is what makes the model
 *  compare it with the knowledge base; it is never kept or shown. */
const FIT_CHECK_SCHEMA = z.strictObject({
  unsupported: z.array(z.strictObject({ index: z.number().int(), claims: z.string() })),
});

const TABLE_LINE_RE = /^[ \t]*\|.*\|[ \t]*$/;
const TABLE_RULE_RE = /^[ \t|:-]+$/;
const LINK_LINE_RE = /^[ \t]*(?:[-*+]|\d+\.)?[ \t]*\[[^\]]+\]\([^)]+\)[ \t]*$/;

/** The sentences a fit check reads: the title and every sentence of the
 *  body that names the business or speaks as it, once each, in order. A title the title rule
 *  makes name the business ("ReachKit vs Seobility") claims no fit and is
 *  left out, and so is a line that is only a link: its label is another
 *  page's title, not a claim of this one. A table is read row
 *  by row — the rules' own splitter takes a whole table as one block, and a
 *  whole comparison is not a claim about one business. */
export function brandSentences(a: {
  title: string;
  markdown: string;
  businessName: string | null;
  domain: string;
  titleOwed?: boolean;
  /** The page's language: a sentence in its business's own voice ("we", "our") is read too. */
  language?: Language;
}): string[] {
  const tokens = brandTokens(a);
  const own = a.language === undefined ? undefined : languagePack(a.language).ownVoice;
  const out: string[] = [];
  const lines = a.markdown.split("\n");
  const prose = lines.filter((line) => !TABLE_LINE_RE.test(line) && !LINK_LINE_RE.test(line)).join("\n");
  const rows = lines
    .filter((line) => TABLE_LINE_RE.test(line) && !TABLE_RULE_RE.test(line))
    .map((line) => renderOf(line).replace(/\s+/g, " ").trim());
  for (const text of [...(a.titleOwed === true ? [] : [a.title]), ...sentencesOf(prose).map((sentence) => sentence.text), ...rows]) {
    if ((namesBrand(text, tokens) || own?.test(text) === true) && !out.includes(text)) out.push(text);
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
    language?: Language;
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
    instructions: ["task"],
    input: {
      task:
        "`sentences` are taken from a page written for the business in `business`. `knowledge` is " +
        "everything known about that business: what it sells, who it serves, the problems it solves, " +
        "how it differs, and its proof; `market`, where given, is the market it is in, and placing " +
        "the business in that market or among its named rivals is supported. " +
        UNSUPPORTED_CLAIM +
        " What is known about `business` is `knowledge`. Find the sentences that make an unsupported claim. " +
        "Judge only what a sentence claims about `business`, which a sentence in the first person speaks as: what it says about any other product, " +
        "or about the market, is not your concern. A sentence that describes `business` doing what " +
        "`knowledge` says it does, in other words, is supported. Where you are not sure, do not list " +
        "it. Answer only with the JSON object {unsupported}: for each such sentence its 0-based " +
        "`index` and, in `claims`, the unsupported category, use or promise in a few words; an empty list " +
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

/** A verdict an earlier read reached, kept only for the sentences today's reading of the page still asks about: a
 *  sentence dropped since claims nothing (issue 2375). No call is made. */
export function stillAsked(
  verdict: FitVerdict,
  page: { title: string; markdown: string; businessName: string | null; domain: string; titleOwed?: boolean }
): FitVerdict {
  if (verdict.state !== "failed") return verdict;
  const asked = new Set(brandSentences(page));
  const still = verdict.sentences.filter((sentence) => asked.has(sentence));
  return still.length === 0 ? { state: "passed" } : { state: "failed", sentences: still };
}
