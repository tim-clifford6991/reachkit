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
import { HEADING_GAPS, RESEARCH, RIVAL_PRICE_MAX_AGE_D, TITLE, VOICE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Tier } from "@/lib/llm/tiers";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import type { PageType } from "@/lib/opportunities/types";
import { briefLines } from "../rules/brief-lines";
import { HONESTY_INSTRUCTION } from "../rules/honest";
import { AVOID_LIST } from "../rules/prose-english";
import { AIM, type LengthRange } from "../length";
import { languageRules, sectionBounds, titleFormulas, type Template } from "../templates";
import { voiceRules } from "../voice/register";
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

/** House guidance: how a page is laid out, linked and voiced. Every line that states a hard rule is that rule's own,
 *  in `../rules/brief-lines.ts`, and is told only where the battery asks it (issue 2378). */
const HOUSE_RULES = [
  "A source is cited by a Markdown link and in no other way: never a bare source name in brackets or parentheses after a sentence.",
  // Issue 1248: the market in force. It places the page; it is no fact pool.
  "Where `pack.business.market` is given, it is the market this business is in: its `category`, who buys (`buyer`) and what they hire it for (`job`). Write for that buyer and that job, and never describe the business as one of `notOurMarket`. Its `rivals` say who it competes with and are not a source.",
  "A GFM table is a header row, a delimiter row with one `---` for every column, then one row per option.",
  "Do not write a sources list: one is added from the pages you linked.",
  "Never state a ranking position or a search volume, and never another company's scan score.",
  "A section's `body` is Markdown without its heading: paragraphs, flat lists, links, emphasis, GFM tables and one-paragraph blockquotes; a sub-point may be an H3 (###), never deeper.",
  "Each section's `heading` is the question a reader asks, in the reader's words, in sentence case, ending in a question mark. Open its `body` with a paragraph of two or three sentences that answers the heading on its own, before any list or table.",
  "Link a page in `pack.links` once, with its url exactly as given, inside the sentence that speaks to what that page holds; link at least three of them, and no other page on the business's domain except a fact's own source.",
  "A link's text is words of the sentence that name what the reader finds at the other end — the page's `label` or a plain description of it. Never a bare number, never an address, never \"here\", \"click here\" or \"read more\", and never the page's slogan.",
  "Print no label, index or id for a fact — link text is the source's name. Write no sentence of legal, removal or refund terms.",
  "Write titles and headings in sentence case.",
  "State one opinion of the business's own, once: its judgement on a fact of its own in `pack` (that a number is low, which step it would take first, what it would not bother with), in the paragraph that states that fact and in plain words, without labelling it an opinion. It is never a claim about what most people, businesses or sites do or get wrong: `pack` holds no such fact.",
  "Do not sum the page up at its end, and do not announce what a section is about to say: the last section ends on its last fact or instruction.",
  `Where \`pack.claims\` or \`pack.facts\` hold a statistic or a sentence worth quoting, use ${VOICE.evidence.min} to ${VOICE.evidence.max} of them on the page, each with who measured or said it and its link. Use only the ones \`pack\` holds, as it states them; where it holds fewer, use fewer, and never invent a figure, a quotation or a name.`,
];

/** A table the writer lays out itself: every cell a fact (`no_placeholder_cell` says what a cell never is). */
const WRITTEN_TABLE_RULE =
  "A comparison table names only this business and the products in `pack.products`. Every cell states what a fact says, with each price or figure linked to that fact's url inside the cell. State each price in the currency its fact states it in, and never convert one.";
/** SPEC §7 (owner, D47): the listicle's table is built in code from `pack`
 *  (`./table.ts`), and the writer writes around it. */
const BUILT_TABLE_RULE =
  "`table` is this page's comparison table, built from `pack` and placed in the at-a-glance section as it is: it is the table `honesty` and `template.blocks` ask for. Write no table anywhere on the page, and say nothing of an option that `table` or `pack` does not carry. Where an option's row leaves a criterion out, `pack` holds no fact for it: never guess the value, and never write that it is missing.";

/** Issue 1508: what a listicle counts. Model-facing, never shown. */
const COUNTED_OPTIONS_RULE =
  "`options` are the options this page counts, this business first, and no others: write one `option` section for each, in that order, and never one for a product `options` does not hold. A number in the title or the page that counts the options is exactly how many `options` holds, and `which_to_choose` chooses among them only. Where `alternativesTo` names a product, the page lists alternatives to it: its row in `table` is marked as the one compared against, the `baseline` section says what it offers, and it is never counted, written as an `option` or chosen in the verdict. Where `alternativesTo` is null, write no `baseline` section.";

/** Issue 1508: a listicle that counts fewer options than the pages it
 *  competes with says why, in its method section. Model-facing. */
const fewOptionsRule = (count: number): string =>
  `Only ${count} options qualified. In \`how_we_compared\`, say so in one plain sentence: an option is listed only where its own pricing or product page stated a fact, and only where it sells what this market buys, so the other products searchers see named were left out. Never name a product \`options\` does not hold.`;

/** Issue 1536: a product whose price the pack does not hold is one the page
 *  says nothing about the price of. Model-facing, never shown. */
const UNPRICED_RULE =
  "`unpriced` are products named in `pack.products` whose price `pack.claims` does not hold. Say nothing about the price of any of them, in the body or in `faq`: no figure, no comparison of cost that includes them, and never how they charge or that their price is missing, unstated, unpublished or not among the facts.";

/**
 * Issue 1536: the researched products that have no `rival_pricing` claim in
 * the pack, by name where the market names them. A comparison of two
 * products with one price between them read "Peec AI's own pricing page
 * does not state a plan price", and `rival_negative` stopped it twice.
 */
export function unpricedProducts(pack: Pick<ContextPack, "products" | "claims" | "business">): string[] {
  const rivals = (pack.business.market as { rivals?: unknown } | null)?.rivals;
  const named = Array.isArray(rivals) ? (rivals as { name?: unknown; domain?: unknown }[]) : [];
  return pack.products
    .filter((product) => !pack.claims.some((claim) => claim.product === product.domain && claim.kind === "rival_pricing"))
    .map((product) => {
      const name = named.find((rival) => rival.domain === product.domain)?.name;
      return typeof name === "string" && name.trim() !== "" ? name.trim() : (product.name ?? product.domain);
    });
}

/** SPEC §7 (owner, 2026-10-10; issue 1390): a section is headed by the
 *  question buyers were seen to ask, where the pack holds one it answers. */
const ASKED_HEADINGS_RULE =
  "`pack.questions` are questions buyers were seen to ask about this topic. Where one is what a section answers, use it as that section's `heading`, in the buyer's words, tidied into a sentence; use each at most once. A section none of them fits keeps a heading in the reader's own words, and no two sections ask the same thing.";

/** Issue 1539: a fact of the business an AI answer misstated is stated
 *  plainly on the page that owns it. Model-facing, never shown. */
const CORRECTIONS_RULE =
  "`pack.corrections` are facts about this business that AI answers state wrongly: `says` is what an answer said, `site` is what the business's own page at `url` states. State each `site` fact plainly, in one sentence of its own, with its figure or place as `site` gives it, in the section that speaks most to it. Never repeat, quote or mention what `says` said, and never say an AI answer was wrong.";

/** Issue 1521 (owner, 2026-10-18, amends D42 #7): what a growing refresh
 *  may add. */
const GAPS_TASK =
  `\`pack.gaps\` are subtopics the pages ranked above this one cover and it does not. Add at most ${HEADING_GAPS.sectionsMax} new sections, each on one of them: headed by that gap's \`heading\`, worded as a reader asks it, placed where it fits among the live sections, written only from the \`pack.claims\` whose \`url\` is in that gap's \`claims\`, and linking at least one of those urls. Add none on a gap those claims give nothing to say about, and say in \`updated\` which sections were added.`;

/** Issue 1521: a comparison whose rival prices are older than D59 allows. */
const STALE_PRICES_TASK =
  `The live page states rival prices read more than ${RIVAL_PRICE_MAX_AGE_D} days ago: state each rival's price as \`pack.claims\` now give it, and drop a rival price no claim in \`pack\` states.`;

export interface WriteInputs {
  template: Template;
  pack: ContextPack;
  /** How the business appears on a page of this type (issue 1136). */
  pageType: PageType | null;
  /** The words of body text the page is held to, and aims for where a
   *  target is given. */
  length: Pick<LengthRange, "floor" | "ceiling"> & { target?: number };
  /** The customer's page on the writer tier; a tier is named only by a
   *  caller with another ceiling. */
  tier?: Tier;
  /** The lead's free page (SPEC §2), whose one call is sized to fit
   *  `CAPS.FREE_C`. */
  free?: boolean;
  /** The site's demo phrases (issue 1249): the phrases `no_demo_text` reads, named to the writer (issue 2378). */
  demoPhrases?: readonly string[];
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

/** What the writer is told of the page's length. A new page has no floor:
 *  each section it answers is given an equal share of the maximum. */
function lengthTask(a: WriteInputs): string {
  const { floor, ceiling } = a.length;
  const target = a.length.target ?? Math.round((floor + ceiling) / 2);
  const counted = a.pack.type === "update" ? "The page's sections together — the short answer and the takeaways are not counted —" : "The page's body — the short answer, the takeaways and every section together —";
  const sections = Math.max(1, a.template.sections.reduce((sum, slot) => sum + (slot.repeat?.min ?? 1), 0));
  const each = floor > 0 ? Math.round(target / sections) : Math.round((AIM * ceiling) / sectionBounds(a.template).max);
  const range = floor > 0 ? `between ${floor} and ${ceiling}` : `at most ${ceiling}`;
  const least = floor > 0 ? `, and no section under ${Math.ceil((floor * 1.15) / sections)}` : "";
  return `${counted} must be ${range} words, counted. Write about ${target} words — about ${each} a section${least}: a page ${floor > 0 ? `under ${floor} or ` : ""}over ${ceiling} is stopped. Give every paragraph something the reader can use — detail, an example, a comparison or a consequence drawn from \`pack\` — and never pad or restate a point to reach the length.`;
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
    lengthTask(a),
    faq === null
      ? "`faq` is empty: this page's own questions are its buyer questions."
      : faq.max === 0
      ? "`faq` is empty: too few buyer questions this pack can answer were asked, so the page carries none."
      : `\`faq\`: ${faq.min} to ${faq.max} questions buyers ask about the target that the headings do not already ask, each answered in two or three sentences under the same \`rules\`; they are stored with the page, not printed in it.`,
    a.pack.type === "update"
      ? a.pack.live?.linkTo?.replaces !== undefined
        ? "`pack.live` is the page as it is live, its link to a page that moved already pointed in code at that page's new address (`pack.live.linkTo.url`) and named `pack.live.linkTo.title`. Return every section of it under its own heading, as it stands, that link included. Change nothing else, and say in `updated`, in one sentence, that a link now points at the page's new address."
        : a.pack.live?.linkTo !== undefined
        ? "`pack.live` is the page as it is live. Return every section of it under its own heading, as it stands. Add exactly one sentence, in the section that speaks most to it, that links `pack.live.linkTo.url` with link text naming what that newer page covers (`pack.live.linkTo.title`); the sentence states no figure and no fact that is not in `pack`. Change nothing else, and say in `updated`, in one sentence, that a link to the newer page was added."
        : [
            "`pack.live` is the page as it is live. Return every section of it under its own heading; rewrite only a section a fact in `pack` changes, and say in `updated`, in one sentence, what changed.",
            // Issue 1521: the answer box moves only with the answer.
            "Return the live page's short answer (its `:::answer` box) word for word unless a fact in `pack` changes the answer to `pack.target.question`; then rewrite it to the new answer.",
            ...(a.pack.gaps === undefined ? [] : [GAPS_TASK]),
            ...(a.pack.live?.cause === "stale_prices" ? [STALE_PRICES_TASK] : []),
          ].join(" ")
      : "`updated` is empty.",
    "`rules` hold throughout, and `honesty` says how this business appears on the page.",
  ].join(" ");
}

function inputFor(a: WriteInputs, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const table = a.template.blocks.table === undefined || a.pack.type !== "listicle" ? null : comparisonTable(a.pack, a.template.blocks.table.rivals);
  const unpriced = unpricedProducts(a.pack);
  return {
    task: taskFor(a),
    template: templateFor(a),
    honesty: a.pageType === null ? null : HONESTY_INSTRUCTION[a.pageType],
    // SPEC §8 hard rule 7: the voice is the customer's own text, verbatim.
    voice: a.pack.business.voice,
    pack: a.pack,
    titleRules: titleBrief(a.pack),
    ...(table === null ? {} : { table: table.markdown, options: table.options, alternativesTo: table.baseline }),
    ...(unpriced.length === 0 ? {} : { unpriced }),
    // Issue 1390: the habits stage 4 counts, so the page is asked not to
    // write what it would be stopped for.
    avoid: AVOID_LIST,
    rules: [
      ...HOUSE_RULES,
      // Issue 2378: each hard rule the battery will ask of this page, from its own line.
      ...briefLines(a),
      ...((a.pack.corrections ?? []).length === 0 ? [] : [CORRECTIONS_RULE]),
      ...(a.pack.voice === undefined ? [] : voiceRules(a.pack.voice)),
      ...(a.pack.type === "qa" || a.pack.type === "update" || a.pack.questions.length === 0 ? [] : [ASKED_HEADINGS_RULE]),
      ...(table === null ? [WRITTEN_TABLE_RULE] : [BUILT_TABLE_RULE, COUNTED_OPTIONS_RULE]),
      ...(table !== null && table.options.length < RESEARCH.optionsAim ? [fewOptionsRule(table.options.length)] : []),
      ...(unpriced.length === 0 ? [] : [UNPRICED_RULE]),
      ...languageRules(a.pack.locale?.language ?? "en"),
    ],
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
