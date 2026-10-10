// SPEC §7 (2026-10-04, D41 stages 3 and 4) — the write call and the fix call.
//
// **One call writes the page.** The writer is handed the type's template and
// the context pack, and nothing else: there is no brief, no outline, no call
// per section, no critic and no answerability pass. It returns the page in
// the template's parts — its title, short answer, takeaways, each section
// under the template's key, closing line and buyer questions — and code lays
// them out (`./compose.ts`).
//
// **One call fixes it.** A page a stage-4 check still fails after the repairs
// in code is handed back once, whole, with each check it failed and the
// sentences that failed it. There is no second fix.
//
// Every call goes through the `llm()` seam: the tier decides the model, the
// seam ledgers the spend through the cost context, and neither the prompt nor
// the response is ever logged. The ceiling is read before each call; a call
// the page cannot afford is `not_attempted`, never a rule that failed.
import { z } from "zod";
import { PAGE_BLOCKS, TITLE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Tier } from "@/lib/llm/tiers";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import type { PageType } from "@/lib/opportunities/types";
import { REGISTER_FLOOR } from "../rules/figures";
import { HONESTY_INSTRUCTION } from "../rules/honest";
import { languageRules, titleFormulas, type Template } from "../templates";
import type { ContextPack } from "./pack";
import type { FixNote } from "./repair";
import { comparisonTable } from "./table";
import { titleBrief } from "./title";

/** One buyer question and its answer, as `drafts.meta.faq` holds it. */
export interface FaqEntry {
  question: string;
  answer: string;
}

const TITLES = z.array(z.string());
const TAKEAWAYS = z.array(z.string());
const SECTIONS = z.array(z.strictObject({ key: z.string(), heading: z.string(), body: z.string() }));
const FAQ = z.array(z.strictObject({ question: z.string(), answer: z.string() }));

/** A list as the model's forced tool returns it. On a long answer the model
 *  sometimes hands a list back as its JSON text (seen 2026-10-04: a whole
 *  page lost twice to `sections` arriving as a string), so the text is
 *  admitted here and parsed against the list's own schema by `partsOf`. */
const listOrText = <T extends z.ZodType>(list: T) => z.union([list, z.string()]);

const ANSWER_SCHEMA = z.strictObject({
  /** The titles the writer proposes (issue 1389): code picks one, and it is
   *  the page's `<title>` and its H1. */
  titles: listOrText(TITLES),
  slug: z.string(),
  description: z.string(),
  answer: z.string(),
  takeaways: listOrText(TAKEAWAYS),
  sections: listOrText(SECTIONS),
  closing: z.string(),
  faq: listOrText(FAQ),
  /** An update's note of what changed, in one sentence; empty otherwise. */
  updated: z.string(),
});

/** What the writer returns: the page in the template's parts. */
export interface PageParts {
  titles: z.infer<typeof TITLES>;
  slug: string;
  description: string;
  answer: string;
  takeaways: z.infer<typeof TAKEAWAYS>;
  sections: z.infer<typeof SECTIONS>;
  closing: string;
  faq: z.infer<typeof FAQ>;
  updated: string;
}

function listOf<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> | null {
  let list = value;
  if (typeof value === "string") {
    try {
      list = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const read = schema.safeParse(list);
  return read.success ? read.data : null;
}

/** The answer as the page's parts, or `undeterminable` where a list that
 *  came back as text is not that list. */
function partsOf(answer: Measured<z.infer<typeof ANSWER_SCHEMA>>): Measured<PageParts> {
  if (answer.kind === "unmeasured") return answer;
  const titles = listOf(TITLES, answer.value.titles);
  const takeaways = listOf(TAKEAWAYS, answer.value.takeaways);
  const sections = listOf(SECTIONS, answer.value.sections);
  const faq = listOf(FAQ, answer.value.faq);
  if (titles === null || takeaways === null || sections === null || faq === null) return unmeasured("undeterminable", answer.at);
  return { ...answer, value: { ...answer.value, titles, takeaways, sections, faq } };
}

/** The page as it is stored and as every check reads it. */
export interface DraftBody {
  /** The `<title>`: the search form (D51). */
  title: string;
  /** The H1: the title (issue 1389). */
  heading: string;
  slug: string;
  description: string;
  bodyMarkdown: string;
}

/** The rules stage 4 enforces in code, stated to the writer too — not as the
 *  enforcement (a prompt cannot promise), but so the ordinary page does not
 *  spend its one fix call on a rule the model would have respected if asked. */
const HOUSE_RULES = [
  "Write from `pack` only. `pack.facts` are this business's own words, read off its pages; `pack.claims` are claims read off public pages; `pack.profile` is what the business sells and how. State nothing about the business, the market, a competitor or a price that none of them carries.",
  "State a business fact word for word and link it to its `url`. A business fact used word for word may stand as a one-paragraph blockquote ending with a Markdown link to its `url` — at most three blockquotes on the page, each a whole sentence a reader can follow on its own, never a fragment of a table, a menu or a screen.",
  "State a claim from `pack.claims` in your own sentence or quote it exactly, and link its `url` in that same sentence.",
  "A source is cited by a Markdown link and in no other way: never a bare source name in brackets or parentheses after a sentence.",
  "Never claim this business serves a use, an audience or a market that `pack.profile` does not support, and never call it \"#1\" or the best of a category.",
  // Issue 1248: the market in force. It places the page; it is no fact pool.
  "Where `pack.business.market` is given, it is the market this business is in: its `category`, who buys (`buyer`) and what they hire it for (`job`). Write for that buyer and that job, and never describe the business as one of `notOurMarket`. Its `rivals` say who it competes with and are not a source.",
  "Never write any of the phrases in `pack.neverClaim`, in those words or any others.",
  "Never invent a byline, an author biography, a persona, a quotation, a testimonial, a review or a case study, and never say the page's claims were tested, trialled or benchmarked. The page prints its own byline and dates: write neither.",
  "Name a competing product only where `pack.claims` holds a claim from that product's own page (`pack.products` lists them), and say what that page says. Never state a figure about a competitor without linking the page it was read from.",
  "A GFM table is a header row, a delimiter row with one `---` for every column, then one row per option.",
  "Do not write a sources list: one is added from the pages you linked.",
  "Never state a ranking position or a search volume, and never another company's scan score.",
  "Write for a human reader only: never address an assistant, a crawler or a ranking system.",
  "A section's `body` is Markdown without its heading: paragraphs, flat lists, links, emphasis, GFM tables and one-paragraph blockquotes; a sub-point may be an H3 (###), never deeper. No raw HTML, no images, no comments.",
  "Each section's `heading` is the question a reader asks, in the reader's words, in sentence case, ending in a question mark. Open its `body` with a paragraph of two or three sentences that answers the heading on its own, before any list or table.",
  "Link each page in `pack.links` once, with its url exactly as given, where the text speaks to it; link no other page on the business's domain except a fact's own source.",
  "`pack.pages` are the pages this site has published or planned: write nothing that repeats one of them, and where one answers something this page raises, send the reader to it.",
  "Print no label, index or id for a fact — link text is the source's name. Write no sentence of legal, removal or refund terms, no caption of a demo or example, and no menu or navigation text.",
  "Say a promise or tagline of the business at most twice on the whole page. Write titles and headings in sentence case.",
  `Write no number of ${REGISTER_FLOOR} or more that \`pack\` or the target search do not contain; a year is not a number for this rule.`,
  `\`answer\` is the page's short answer: one paragraph of ${PAGE_BLOCKS.answerWords.min} to ${PAGE_BLOCKS.answerWords.max} words that answers the target plainly — write 45 to 55, in two or three sentences, and count them: outside ${PAGE_BLOCKS.answerWords.min} to ${PAGE_BLOCKS.answerWords.max} the page is stopped.`,
  `\`takeaways\`: ${PAGE_BLOCKS.takeaways.min} to ${PAGE_BLOCKS.takeaways.max} key takeaways, one sentence each. \`closing\`: one line that points the reader to the one action this page's reader should take, linking the page in \`pack.links\` where they take it.`,
];

/** A table the writer lays out itself: every cell a fact, never a blank. */
const WRITTEN_TABLE_RULE =
  "A comparison table names only this business and the products in `pack.products`. Every cell states what a fact says, with each price or figure linked to that fact's url inside the cell — never a blank, \"not stated\", \"not linked\", \"n/a\", \"unknown\" or any other words that say a value is missing: where a fact is missing for one product, leave that row out for every product, or leave that product out. State each price in the currency its fact states it in, and never convert one.";
/** SPEC §7 (owner, D47): the listicle's table is built in code from `pack`
 *  (`./table.ts`), and the writer writes around it. */
const BUILT_TABLE_RULE =
  "`table` is this page's comparison table, built from `pack` and placed in the at-a-glance section as it is: it is the table `honesty` and `template.blocks` ask for. Write no table anywhere on the page, and say nothing of an option that `table` or `pack` does not carry. Where an option's row leaves a criterion out, `pack` holds no fact for it: never guess the value, and never write that it is missing.";

export interface WriteInputs {
  template: Template;
  pack: ContextPack;
  /** How the business appears on a page of this type (issue 1136). */
  pageType: PageType | null;
  /** The words of body text the page is held to. */
  length: { floor: number; ceiling: number };
  /** The customer's page on the writer tier; a tier is named only by a
   *  caller with another ceiling. */
  tier?: Tier;
  /** The lead's free page (SPEC §2), whose one call is sized to fit
   *  `CAPS.FREE_C`. */
  free?: boolean;
}

/** What the writer is told about the page's shape: the template, as data. */
function templateFor(a: WriteInputs): Record<string, unknown> {
  const { template } = a;
  // D51's formulas in the page's own language (D66).
  const words = titleFormulas(template.type, a.pack.locale?.language ?? "en");
  return {
    for: template.for,
    titles: words?.titles ?? template.titles,
    ...(template.titleNever === undefined ? {} : { titleNever: words?.titleNever ?? template.titleNever }),
    sections: template.sections,
    blocks: template.blocks,
    words: a.length,
  };
}

function taskFor(a: WriteInputs): string {
  const faq = a.template.blocks.faq;
  return [
    "Write one page for `pack.target.question`, doing what `template.for` says the page is for.",
    "`template.sections` are the page's sections, in order: return each as one entry of `sections` with its `key` exactly as the template spells it, in that order — a section with `repeat` between `min` and `max` times, one after another — each under its own `heading` and doing what its `task` says.",
    a.pack.type === "update"
      ? "`titles` is one entry: `pack.live.title`."
      : `\`titles\` is ${TITLE.candidates} different titles for the page, each one you would publish: the page's \`<title>\` and its H1 are the one of them that best holds \`titleRules\`, chosen in code. Each is the form a searcher types, follows one of \`template.titles\` and holds every rule in \`titleRules\`; make them differ in the specific they carry or in how they lead, not in a word.`,
    `\`description\` is the meta description: ${TITLE.description.min} to ${TITLE.description.max} characters, counted — write about 140 — in whole sentences, and its first sentence answers the target.`,
    `${a.pack.type === "update" ? "The page's sections together — the short answer and the takeaways are not counted —" : "The page's body — the short answer, the takeaways and every section together —"} must be between ${a.length.floor} and ${a.length.ceiling} words, counted. Write about ${Math.round((a.length.floor + a.length.ceiling) / 2)} words — about ${Math.round((a.length.floor + a.length.ceiling) / 2 / Math.max(1, a.template.sections.reduce((sum, slot) => sum + (slot.repeat?.min ?? 1), 0)))} a section, and no section under ${Math.ceil((a.length.floor * 1.15) / Math.max(1, a.template.sections.reduce((sum, slot) => sum + (slot.repeat?.min ?? 1), 0)))}: a page under ${a.length.floor} or over ${a.length.ceiling} is stopped. Give every paragraph something the reader can use — detail, an example, a comparison or a consequence drawn from \`pack\` — and never pad or restate a point to reach the length.`,
    faq === null
      ? "`faq` is empty: this page's own questions are its buyer questions."
      : `\`faq\`: ${faq.min} to ${faq.max} questions buyers ask about the target that the headings do not already ask, each answered in two or three sentences under the same \`rules\`; they are stored with the page, not printed in it.`,
    a.pack.type === "update"
      ? "`pack.live` is the page as it is live. Return every section of it under its own heading; rewrite only a section a fact in `pack` changes, and say in `updated`, in one sentence, what changed."
      : "`updated` is empty.",
    "`rules` hold throughout, and `honesty` says how this business appears on the page.",
  ].join(" ");
}

function inputFor(a: WriteInputs, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const table = a.template.blocks.table === undefined || a.pack.type !== "listicle" ? null : comparisonTable(a.pack, a.template.blocks.table.rivals);
  return {
    task: taskFor(a),
    template: templateFor(a),
    honesty: a.pageType === null ? null : HONESTY_INSTRUCTION[a.pageType],
    // SPEC §8 hard rule 7: the voice is the customer's own text, verbatim.
    voice: a.pack.business.voice,
    pack: a.pack,
    titleRules: titleBrief(a.pack),
    ...(table === null ? {} : { table: table.markdown }),
    rules: [...HOUSE_RULES, table === null ? WRITTEN_TABLE_RULE : BUILT_TABLE_RULE, ...languageRules(a.pack.locale?.language ?? "en")],
    ...extra,
  };
}

/** Stage 3: the page, in one call. */
export async function writePage(c: CostContext, a: WriteInputs): Promise<Measured<PageParts>> {
  if (c.capHit()) return unmeasured("not_attempted", new Date());
  return partsOf(
    await llm(c, {
      site: a.free === true ? "generate.write_free" : "generate.write",
      tier: a.tier ?? "writer",
      schema: ANSWER_SCHEMA,
      input: inputFor(a),
      ...(a.pack.locale === undefined ? {} : { locale: a.pack.locale }),
    })
  );
}

/**
 * Stage 4's one fix call: the page as written, each check it failed and the
 * sentences that failed it, and — where it read almost the same as a page
 * written for another business (D13) — its own sentences the two shared.
 */
export async function fixPage(
  c: CostContext,
  a: WriteInputs & { parts: PageParts; fix: readonly FixNote[]; apart?: readonly string[] }
): Promise<Measured<PageParts>> {
  if (c.capHit()) return unmeasured("not_attempted", new Date());
  const apart =
    a.apart === undefined
      ? ""
      : " The page also read almost the same as a page already written for another business: `apart` lists " +
        "sentences the two shared. Use none of them, and give this page its own order, examples and wording, " +
        "built on this business's facts.";
  return partsOf(await llm(c, {
    site: "generate.fix",
    tier: a.tier ?? "writer",
    schema: ANSWER_SCHEMA,
    ...(a.pack.locale === undefined ? {} : { locale: a.pack.locale }),
    input: inputFor(a, {
      task:
        `${taskFor(a)} \`page\` is the page as it was written, and it was stopped: \`fix\` names each check it ` +
        "failed and the sentences or the block that failed it. Return the whole page again with every one of " +
        "them put right, and change nothing else." +
        apart,
      page: a.parts,
      fix: a.fix,
      ...(a.apart === undefined ? {} : { apart: a.apart }),
    }),
  }));
}
