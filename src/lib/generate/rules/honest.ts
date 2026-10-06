// SPEC §7 *honesty by page type* (owner, 2026-09-29; D20, 2026-10-02; issue
// 1136) — the honest row.
//
// **What it replaced.** `page_frame` and `brand_gap` (issue 900) made
// writing about the product a violation: the business could be named once,
// never in a title or a heading, and not in the first 300 characters. Every
// page they passed was a page about nobody. How the business appears now
// follows the page's type (`@/lib/opportunities/page-type`): on a page
// anchored on the product it is the subject, and no rule here speaks.
//
// **What this rule says**, on a market comparison only. Favourable framing
// is allowed: the business may lead the table and the verdict. Two things
// are not —
//
//   1. *a comparison the business is not in.* A table that names one of the
//      site's rivals compares the market, and the business has a row (or a
//      column) in it, beside the others, on the same criteria. A table that
//      names no rival — the business's own plans, a list of steps — is not
//      that comparison and is not read. Whether the page owes a table at
//      all is its structure, and `required_blocks` asks that (`./blocks.ts`);
//   2. *a self-ranked "#1 best".* The page never ranks the business first
//      by its own word: not "the best X" or "#1" in the title or a heading
//      that names it, and not in a sentence or a table row that does.
//
// "Best fit for small teams" is a recommendation for a case and passes;
// whether that case is one the knowledge base supports is the fit check's
// question (`../claims/fit.ts`), not this rule's.
//
// It decides nothing on any other type of page, and nothing where no brand
// is recorded. Deterministic, no I/O. `HONESTY_INSTRUCTION` is the
// model-facing sentence the drafting prompts carry for each type, held
// beside the rule that enforces it. It is not a customer-visible string.
import type { PageType } from "@/lib/opportunities/types";
import { brandTokens, namesBrand } from "./brand";
import { renderOf, sentencesOf } from "./text";
import type { RuleFailure } from "./types";

/** What the drafting prompts tell the model, per type. Model-facing only. */
export const HONESTY_INSTRUCTION: Readonly<Record<PageType, string>> = Object.freeze({
  product:
    "This page is anchored on this business's product: the product is the page's subject. Name the " +
    "business in the title where it reads naturally, and say plainly what the product does for the " +
    "reader's case — from `facts` and `profile.knowledge` only, with nothing invented.",
  market_comparison:
    "This page compares the market, and may frame it in this business's favour without faking anything. " +
    "Put the options in a Markdown comparison table whose first row is this business, state its " +
    "strengths first, and end on a verdict that recommends it for the audience and the use " +
    "`profile.knowledge` shows it genuinely fits and names a case where a rival is the better pick. " +
    "State each rival's real strengths too, and source " +
    "every claim. Never rank this business \"#1\" or call it the best of the category — not in the " +
    "title, a heading, the table or the text.",
  answer:
    "This page answers the reader's question, and answers it first. This business may be named where " +
    "its product is part of the answer, for the uses `profile.knowledge` supports.",
});

export interface HonestRowInputs {
  /** The title as written — the first place a page ranks itself. */
  title: string;
  markdown: string;
  businessName: string | null;
  domain: string;
  /** The rival domains and names recorded for the site: a table that names
   *  one is the market's comparison. */
  rivals: readonly string[];
  /** The page's type. `null` where the page has none, and then nothing here
   *  decides. */
  pageType: PageType | null;
}

/** A rank the page gives by its own word, wherever it stands. */
const RANK_RE = /#\s?1\b|\bno\.\s?1\b|\bnumber[- ]one\b|\b1st\b|\bbest overall\b|\btop[- ]ranked\b|\branked (?:first|top|highest)\b/i;
/** "… is the best X" — but not "the best fit for …", which recommends the
 *  business for a case rather than ranking it. */
const BEST_OF_RE = /\b(?:is|are|as|remains) the best\b(?! (?:fit|choice|option|pick|match|suited)\b)/i;
/** A title or a heading is a claim about the whole page, so the bare word
 *  is enough there: "Best local SEO software: Acme". */
const HEADLINE_RANK_RE = /\b(?:best|top|winner|leading)\b|^\s*#?1[.):]\s/i;

const HEADING_LINE_RE = /^[ \t]*#{1,6}[ \t]+(.+)$/;

/** Every heading's words, with a leading "1." kept — the rules' own
 *  renderer reads it as a list marker and drops it, and here it is the
 *  rank. */
function rankedHeadingsOf(markdown: string): string[] {
  return markdown
    .split("\n")
    .map((line) => HEADING_LINE_RE.exec(line)?.[1])
    .filter((heading): heading is string => heading !== undefined)
    .map((heading) => {
      const rank = /^\s*#?1[.):]\s/.exec(heading)?.[0] ?? "";
      return `${rank}${renderOf(heading.slice(rank.length)).trim()}`;
    });
}

const TABLE_ROW_RE = /^[ \t]*\|(.+)\|[ \t]*$/;
const TABLE_RULE_RE = /^[ \t]*\|?[ \t:|-]+\|[ \t:|-]*$/;

/** Every row of every table in the page, header rows included — a table
 *  with the options as its columns names the business in its header. */
function tableRowsOf(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => TABLE_ROW_RE.test(line) && !TABLE_RULE_RE.test(line))
    .map((line) => line.replace(/\[([^\]\n]*)\]\([^)\s]+\)/g, "$1"));
}

function ranksItself(text: string, tokens: readonly string[], headline: boolean): boolean {
  if (!namesBrand(text, tokens)) return false;
  return RANK_RE.test(text) || BEST_OF_RE.test(text) || (headline && HEADLINE_RANK_RE.test(text));
}

/** The sentences, headings and rows in which the page ranks the business
 *  first by its own word. Exported for the next attempt's fix note. */
export function selfRankedIn(a: Omit<HonestRowInputs, "rivals">): string[] {
  const tokens = brandTokens(a);
  if (tokens.length === 0) return [];
  const out: string[] = [];
  const add = (text: string): void => {
    if (!out.includes(text)) out.push(text);
  };
  if (ranksItself(a.title, tokens, true)) add(a.title);
  for (const heading of rankedHeadingsOf(a.markdown)) if (ranksItself(heading, tokens, true)) add(heading);
  for (const sentence of sentencesOf(a.markdown)) {
    if (ranksItself(sentence.text, tokens, false)) add(sentence.text);
  }
  for (const row of tableRowsOf(a.markdown)) {
    if (namesBrand(row, tokens) && RANK_RE.test(row)) add(row);
  }
  return out;
}

export function checkHonestRow(a: HonestRowInputs): RuleFailure | null {
  if (a.pageType !== "market_comparison") return null;
  const tokens = brandTokens(a);
  if (tokens.length === 0) return null;
  const rows = tableRowsOf(a.markdown);
  const rivals = a.rivals.flatMap((rival) =>
    rival.includes(".") ? brandTokens({ businessName: null, domain: rival }) : [rival]
  );
  if (rows.some((row) => namesBrand(row, rivals)) && !rows.some((row) => namesBrand(row, tokens))) {
    return { rule: "honest_row" };
  }
  return selfRankedIn(a).length > 0 ? { rule: "honest_row" } : null;
}
