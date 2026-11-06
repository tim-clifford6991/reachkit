// SPEC §7 (owner, 2026-11-04, "the checks we have in place should be known to the content generators"; issue 2378) —
// every hard rule, as the writer is told it.
//
// One line per rule, built from what that rule's check reads: its constants, the pack, the site's lists. The writer
// (`../pipeline/write.ts`), the fix call and the title brief (`../pipeline/title.ts`) render this list and no other
// copy of it, for exactly the rules `rulesAsked` switches on for the same inputs. The `Record` is total over
// `HardRule`, so a rule with no line is a compile error. Model-facing only, never shown.
import { DISTINCT_HEADINGS, PAGE_BLOCKS, PROSE, TITLE } from "@/lib/config/constants";
import { languagePack } from "@/lib/locale/language";
import type { PageType } from "@/lib/opportunities/types";
import { UNSUPPORTED_CLAIM } from "../claims/fit";
import { builtFromOutside, type ContextPack } from "../pipeline/pack";
import type { Template } from "../templates";
import { REGISTER_FLOOR } from "./figures";
import { rulesAsked } from "./index";
import type { TitleRuleInputs } from "./title";
import type { HardRule } from "./types";

/** What a line is built from: the page's pack and template, and what the battery is handed beside them. */
export interface BriefLineInputs {
  pack: ContextPack;
  template: Pick<Template, "packMustHold">;
  pageType: PageType | null;
  /** The site's demo phrases (issue 1249), which `no_demo_text` reads. */
  demoPhrases?: readonly string[];
  /** The title's reading (`../pipeline/title.ts`); absent, the title's lines are the title brief's alone. */
  titleRule?: TitleRuleInputs;
}

/** The most demo phrases a writer is shown: the rest are still checked. */
const DEMO_PHRASES_TOLD = 25;

/** What `cites_market` holds a page to: the most outside pages its template asks (`../pipeline/battery.ts`). */
export function citesMinOf(template: Pick<Template, "packMustHold">): number {
  return template.packMustHold.reduce((most, need) => (need.need === "outside_sources" ? Math.max(most, need.min) : most), 0);
}

const quoted = (phrases: readonly string[]): string => phrases.map((phrase) => `"${phrase}"`).join(", ");

export const RULE_BRIEF: Readonly<Record<HardRule, (a: BriefLineInputs) => string | readonly string[] | null>> = Object.freeze({
  grounding: () => [
    "Write from `pack` only. `pack.facts` are this business's own words, read off its pages; `pack.claims` are claims read off public pages; `pack.profile` is what the business sells and how. State nothing about the business, the market, a competitor or a price that none of them carries.",
    "State a business fact word for word and link it to its `url`. A business fact used word for word may stand as a one-paragraph blockquote ending with a Markdown link to its `url` — at most three blockquotes on the page, each a whole sentence a reader can follow on its own, never a fragment of a table, a menu or a screen.",
  ],
  rival_source: () => [
    "State a claim from `pack.claims` in your own sentence or quote it exactly, and link its `url` in that same sentence.",
    "Name a competing product only where `pack.claims` holds a claim from that product's own page (`pack.products` lists them), and say what that page says. Never state a figure about a competitor without linking the page it was read from.",
    "A claim with a `plan` is true of that plan only: name the plan in the sentence that states it (\"its free trial includes …\"), and never present a trial, a starter tier or one plan's limits as the whole product. Where `pack.claims` holds a competitor's own page, cite that page for it and no other page's claim about it.",
  ],
  rival_negative: () =>
    "Never say a competitor has no, lacks or does not offer something unless a claim in `pack.claims` says so, linked in that same sentence. A page that does not mention a thing is not a page saying the product lacks it.",
  no_invented_people: () =>
    "Never invent a byline, an author biography, a persona or a quotation. The page prints its own byline and dates: write neither.",
  no_unsourced_testimonial: () => "Never invent a testimonial or a review.",
  honest_row: () =>
    "`honesty` holds on this market comparison: this business has its own row in the comparison table, beside the others on the same criteria, and no title, heading, row or sentence ranks it \"#1\" or the best.",
  no_hidden_text: () => "No raw HTML, no images, no comments.",
  no_machine_address: () => "Write for a human reader only: never address an assistant, a crawler or a ranking system.",
  near_duplicate: () =>
    "`pack.pages` are the pages this site has published or planned: write nothing that repeats one of them, and where one answers something this page raises, send the reader to it.",
  no_invented_test: () => "Never say the page's claims were tested, trialled or benchmarked.",
  no_invented_provenance: () => "Never invent a case study.",
  traceable_numerals: () => `Write no number of ${REGISTER_FLOOR} or more that \`pack\` or the target search do not contain; a year is not a number for this rule.`,
  first_block_answers: () =>
    `\`answer\` is the page's short answer: one paragraph of ${PAGE_BLOCKS.answerWords.min} to ${PAGE_BLOCKS.answerWords.max} words that answers the target plainly — write 45 to 55, in two or three sentences, and count them: outside ${PAGE_BLOCKS.answerWords.min} to ${PAGE_BLOCKS.answerWords.max} the page is stopped.`,
  required_blocks: () =>
    `\`takeaways\`: ${PAGE_BLOCKS.takeaways.min} to ${PAGE_BLOCKS.takeaways.max} key takeaways, one sentence each. \`closing\`: one line that points the reader to the one action this page's reader should take, linking the page in \`pack.links\` where they take it.`,
  no_placeholder_cell: () =>
    "A table cell is never a blank, \"not stated\", \"not linked\", \"n/a\", \"unknown\" or any other words that say a value is missing: where a fact is missing for one product, leave that row out for every product, or leave that product out.",
  no_demo_text: (a) => {
    const phrases = (a.demoPhrases ?? []).slice(0, DEMO_PHRASES_TOLD);
    return phrases.length === 0
      ? null
      : `These are the site's demo, example and menu lines: never repeat one of them whole, and write no caption of a demo or example and no menu or navigation text: ${quoted(phrases)}.`;
  },
  distinct_headings: () =>
    `No two section headings ask the same thing: none shares ${Math.round(DISTINCT_HEADINGS.overlap * 100)}% of another's words or opens with the same ${DISTINCT_HEADINGS.opening} words.`,
  // Moved from the title brief (issue 2374), word for word.
  title: (a) => {
    const rule = a.titleRule;
    if (rule === undefined) return null;
    const dated = (TITLE.yearTypes as readonly string[]).includes(a.pack.type);
    const words = languagePack(a.pack.locale?.language ?? "en").title;
    return [
      `${TITLE.chars.min} to ${TITLE.chars.max} characters, counted, spaces included: write ${TITLE.aim.min} to ${TITLE.aim.max}, which is eight to ten words. A title of ${TITLE.chars.max + 1} or more is thrown away, so make the first of the titles the shortest that holds these rules: the search's own words, then one detail of at most five words, and nothing else.`,
      `One of \`searches\`${rule.follow.length === 0 ? "" : " or of `pack.questions`"}, in the searcher's own words, starts within its first ${TITLE.headChars} characters.`,
      "It carries one specific that `pack` holds: a number, a price or a measured result in the digits `pack` states it in (`figures` lists some), or a count of this page's own options, questions or numbered steps; or one of `names`, where it lists any. A year is not a number, neither is the number of an episode, an issue or a volume, and a question, an award, an adjective or who the page is for is not a specific.",
      "A figure beside a product's name is one that product's own pages state, or the business's own where the title names the business too; state no figure that belongs to another.",
      "`titles` are titles code has checked against every one of these rules: propose better ones that hold them all, or these as they are.",
      rule.asks ? "The search is a question, so it may be that question; a statement that answers it is as good." : "It is a statement that answers the search, never a question: the search is not one.",
      dated ? "It may carry `year`, in brackets or before a colon, never as its last word, and no other year." : "It carries no year.",
      `Never ${words.banned.map((phrase) => `"${phrase}"`).join(", ")}, a filler verb or stock phrase like ${words.tropeSamples.map((phrase) => `"${phrase}"`).join(", ")}, two things joined by "and" after "How to", a square bracket, a pipe, or the same word twice.`,
      "It does not read like the title of any page in `pack.pages`.",
      ...(rule.business === undefined ? [] : [`The search compares products and this page is the business's own, so it names the business, as "${rule.business[0]}", beside the products the search names.`]),
    ];
  },
  // Issue 1390: how the page reads, as `./prose.ts` counts it.
  plain_prose: () => [
    "Write plain statements: say what a thing is or does (\"X is Y\", \"X does Y\"), and never define it by what it is not. Mix sentence lengths: a sentence of a few words beside a longer one, and never three sentences of one shape in a row.",
    `Join two clauses with a full stop, a comma or "and", never a dash: at most two dashes on the whole page. Say no sentence, and no run of ${PROSE.repeatedSentence.minWords} words or more, more than ${PAGE_BLOCKS.taglineRepeats} times on the page. Each item of a list is its own sentence, with no label repeated down the list.`,
    `Say a promise or tagline of the business at most ${PAGE_BLOCKS.taglineRepeats} times on the whole page.`,
    "Write none of the habits listed in `avoid`, nor their like in the page's language.",
  ],
  cites_market: (a) =>
    `Link at least ${citesMinOf(a.template)} different pages that \`pack.claims\` were read from, each in the sentence that states what it says.`,
  // Issue 2375: the fit check's own definition, so the page is written to what it is checked against.
  fit_claim: () =>
    `${UNSUPPORTED_CLAIM} What is known about this business is \`pack.profile\`. Never make an unsupported claim, and never call it "#1" or the best of a category.`,
  do_not_claim: (a) => `Never write any of the phrases in \`pack.neverClaim\`, in those words or any others: ${quoted(a.pack.neverClaim)}.`,
});

/** One rule's lines, as a list. */
export function briefLinesOf(rule: HardRule, a: BriefLineInputs): string[] {
  const lines = RULE_BRIEF[rule](a);
  return lines === null ? [] : typeof lines === "string" ? [lines] : [...lines];
}

/** The rules the battery will ask of a page written from these inputs: the battery's own switch, handed what the
 *  pipeline hands it (`../pipeline/battery.ts` › `batteryInputs`). The fit check is asked of a listicle. */
export function writerAsked(a: BriefLineInputs): HardRule[] {
  const { pack } = a;
  return rulesAsked(
    {
      pageType: a.pageType,
      site: { doNotClaim: pack.neverClaim },
      ...(a.demoPhrases === undefined ? {} : { demoPhrases: a.demoPhrases }),
      blocks: true,
      distinctHeadings: pack.type === "qa",
      titleRule: true,
      prose: true,
      ...(builtFromOutside(pack.type) ? { cites: true } : {}),
    },
    { fit: { state: "passed" }, fitAsked: pack.type === "listicle" }
  );
}

/** Every asked rule's lines, in `HARD_RULES` order, but the title's: the writer reads those in `titleRules`. */
export function briefLines(a: BriefLineInputs): string[] {
  return writerAsked(a).flatMap((rule) => (rule === "title" ? [] : briefLinesOf(rule, a)));
}
