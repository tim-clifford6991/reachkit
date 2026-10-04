// BUILD §8 — the five-step pipeline's model steps.
//
// "brief (nano) → outline (nano) → grounded draft (Haiku) →
// answerability+SEO pass (Haiku) → claim check (nano)". Four of the five
// are here; the fifth is the do-not-claim check and lives in `../claims/`,
// because it is a hard rule as well as a step and one capability has one
// home.
//
// Every call goes through the `llm()` seam, which is the only door to a
// model in this product: the tier decides the model, the seam ledgers the
// spend through the cost context, and neither the prompt nor the response
// text is ever logged. Nothing here names a model id.
//
// **`capHit()` is re-checked before every step.** The ceiling is checked
// before the pipeline runs at all, but a multi-call step re-reads it
// between calls — a step that would spend past the cap is `not_attempted`,
// which is a step that did not run and never a rule that failed.
//
// **The prompt's whole knowledge of the customer is `DraftPromptInputs`.**
// Each step passes the struct it was given, unchanged, plus its own task
// text — there is no second channel through which a derived profile could
// reach a model.
//
// **What the page is *for* is stated, per type** (SPEC §7, 2026-09-19, issue
// 900). `pageJobFor` is carried by every prompt built here, and beside it
// how the business may appear on a page of this type (`HONESTY_INSTRUCTION`,
// SPEC §7 *honesty by page type*, issue 1136). Both are derived from the
// closed struct — the opportunity's own type, search and source — so neither
// is a new channel into a model.
import { z } from "zod";
import { DRAFT_SECTIONS_PER_CALL, PAGE_BLOCKS } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm, type LlmCallSite } from "@/lib/llm";
import type { Tier } from "@/lib/llm/tiers";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import type { SitePage } from "@/lib/opportunities/site-pages";
import type { Acceptance, Opportunity } from "@/lib/opportunities/types";
import { REGISTER_FLOOR } from "../rules/figures";
import { HONESTY_INSTRUCTION } from "../rules/honest";
import type { DraftPromptInputs } from "../voice/inputs";
import type { PromptProfile } from "../voice/profile-block";
import { answerBoxOf, answerBoxWords } from "../rules/blocks";
import type { AnswerabilityOps } from "./answerability";
import { composePage, sentenceCase, tidyText, withAnswer, type TidyInputs } from "./compose";
import type { LengthTarget } from "../length";
import type { FixNote } from "./repair";
import { isQuestionShaped } from "../rules/text";
import { pageJobFor, SECTION_ROLES, SECTION_TASK, type SectionRole } from "./skeletons";

/** §8's five steps, closed. `claim_check` is the fifth and is run by
 *  `claims/check.ts`; it is a member here because a caller reporting "which
 *  step did not run" has to be able to name it. */
export type PipelineStep =
  | "brief"
  | "outline"
  | "draft"
  /** The page was written twice and is still short of its floor (issue
   *  1138). Not a model that did not answer: nothing writes it a third time. */
  | "length"
  | "answerability"
  /** A new page that adds fewer than three things the top results and the
   *  customer's pages do not say (SPEC §7, D12; issue 1143). Not a model
   *  that did not answer: it becomes an update, or waits for the founder. */
  | "adds"
  /** The listing that decides it did not run. */
  | "adds_check"
  /** The page reads too much like one written for another site (SPEC §7,
   *  D13; issue 1144). It is written again once, told what to keep away
   *  from, then held. */
  | "elsewhere"
  | "claim_check"
  | "fit_check"
  | "page_read"
  | "page_fix";

/** The `llm()` call site each step ledgers under. One string per step, so a
 *  cost report reads by step without anyone joining a table. */
export const STEP_CALL_SITES: Readonly<
  Record<
    Exclude<PipelineStep, "claim_check" | "fit_check" | "page_read" | "length" | "adds" | "adds_check" | "elsewhere"> | "sections" | "answer_box" | "critic",
    LlmCallSite
  >
> = Object.freeze({
  brief: "generate.brief",
  outline: "generate.outline",
  draft: "generate.draft",
  // The section bodies, a few to a call. Part of the draft step.
  sections: "generate.sections",
  // Issue 1138: the critic's read of the written page.
  critic: "generate.critic",
  answerability: "generate.answerability",
  page_fix: "generate.page_fix",
  // Issue 1137: the short-answer box alone, rewritten to its word count. It
  // is part of the draft step — a failure of it is the draft's.
  answer_box: "generate.answer_box",
});

/** `factIndexes` is how the brief chooses facts: by position in the list it
 *  was handed. It has no field through which to write one (issue 475). */
const BRIEF_SCHEMA = z.strictObject({
  readerQuestion: z.string(),
  angle: z.string(),
  mustCover: z.array(z.string()),
  factIndexes: z.array(z.number().int()),
  /** SPEC §7 (2026-09-29, issue 1135): the second pool, chosen the same way
   *  — by position in `marketFacts`. Absent is none. */
  marketFactIndexes: z.array(z.number().int()).optional(),
});
export type Brief = z.infer<typeof BRIEF_SCHEMA>;

/** The model chooses the sections: a role from the block set and the
 *  question a reader asks, for each (SPEC §7, 2026-09-29). */
const OUTLINE_SCHEMA = z.strictObject({
  sections: z.array(z.strictObject({ role: z.string(), heading: z.string() })),
});

/** The outline as the draft reads it: six to ten sections, each a block of
 *  the set under the question it answers. */
export interface Outline {
  sections: readonly { role: SectionRole; heading: string }[];
}

/** One buyer question and its answer, as `drafts.meta.faq` holds it. */
export interface FaqEntry {
  question: string;
  answer: string;
}

/** The page's frame: everything the writer returns but the section bodies.
 *  It has no field for a heading, so it cannot write one the outline did
 *  not have. */
const FRAME_SCHEMA = z.strictObject({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  answer: z.string(),
  takeaways: z.array(z.string()),
  closing: z.string(),
  faq: z.array(z.strictObject({ question: z.string(), answer: z.string() })),
});
/** The bodies of the sections one call was asked for, in the order asked. */
const SECTIONS_SCHEMA = z.strictObject({ sections: z.array(z.string()) });

/** What the writer returns: the page in parts, which code lays out
 *  (`./compose.ts`). */
export type DraftParts = z.infer<typeof FRAME_SCHEMA> & { sections: string[] };

/** The page as it is stored and as every later pass reads it. */
export interface DraftBody {
  title: string;
  slug: string;
  description: string;
  bodyMarkdown: string;
}

const SCORE = z.number().int().min(0).max(3);
/** The critic's five scores (SPEC §7, 2026-09-29), and the sections it would
 *  have written again. It writes no text of the page: a section it names is
 *  written again by `sectionsAgain`, on a clock of its own. */
const CRITIC_SCHEMA = z.strictObject({
  adds: SCORE,
  specificity: SCORE,
  fit: SCORE,
  blocks: SCORE,
  length: SCORE,
  revise: z.array(z.strictObject({ section: z.number().int(), instruction: z.string() })),
});
export type CriticRead = z.infer<typeof CRITIC_SCHEMA>;

const ANSWER_BOX_SCHEMA = z.strictObject({ answer: z.string() });

/** The answerability + SEO pass returns operations, never a page: code
 *  applies the ones inside SPEC §7's bound (`./answerability.ts`). */
const ANSWERABILITY_SCHEMA = z.strictObject({
  title: z.string(),
  description: z.string(),
  order: z.array(z.number().int()),
  openings: z.array(z.strictObject({ section: z.number().int(), text: z.string() })),
  insertFacts: z.array(z.strictObject({ section: z.number().int(), fact: z.number().int() })),
});

/**
 * Everything the brief step is handed, and nothing else (issue 475): the
 * cluster, the type, the target and the searches it absorbed, the customer's
 * own passages to choose among, their do-not-claim list, their voice, the
 * acceptance test the page is written to pass, and the confirmed business
 * profile. No business name, domain or evidence blob reaches the brief.
 *
 * **The profile is here so the brief can choose**, in #927's words: "the brief task says to choose which products, audience and
 * promises the page should speak to". A brief that knows what the business
 * sells picks the points that matter to this reader of this business; a
 * brief that does not writes the same page for every site in the market,
 * which is the thing this issue exists to end.
 *
 * It still learns no business *name*: `PromptProfile` carries what the
 * business does, sells, promises, serves and says — never who it is.
 */
export interface BriefProjection {
  cluster: string | null;
  type: Opportunity["type"];
  target: string;
  absorbedQueries: readonly string[];
  facts: readonly string[];
  /** The market facts the research step read (issue 1135): each claim with
   *  the site whose page states it, so the brief can tell a rival's own
   *  price from a third party's remark about it. Empty where nothing was
   *  read. */
  marketFacts: readonly { source: string; claim: string }[];
  doNotClaim: readonly string[];
  voice: string | null;
  acceptance: string;
  /** What a page of this type is for (issue 900). `null` for a type that
   *  writes no body. */
  pageJob: string | null;
  /** How the business may appear on a page of this type (SPEC §7 *honesty
   *  by page type*, issue 1136), and `null` for a page with no type — an
   *  update of the customer's own page. A fixed sentence per type: it names
   *  no business, so the brief still learns nothing of one. */
  honesty: string | null;
  /** The confirmed business profile, bounded, or `null` where nothing has
   *  been read of the site (#927). */
  profile: PromptProfile | null;
  /** SPEC §7 (2026-10-03, D36, issue 1209): every page the site has
   *  published or planned — its title, the question it answers and its kind
   *  — so the brief takes an angle none of them already takes. Empty on a
   *  site with no page yet. */
  sitePages: readonly SitePage[];
}

/** The acceptance test as one line the model can aim at. Model-facing only. */
function acceptanceText(acceptance: Acceptance): string {
  switch (acceptance.form) {
    case "top20":
      return `ranks in the top 20 for "${acceptance.query}"`;
    case "named_on":
      return `is cited by the AI answer to "${acceptance.question}"`;
    case "gate_cleared":
      return `the ${acceptance.gate} access gate passes`;
    case "issues_cleared":
      return `${acceptance.issues.join(", ")} pass for ${acceptance.pageUrl}`;
  }
}

/** The target search and every search the row absorbed — what the page is
 *  written for, as the prompt, the frame rule and the battery all read it. */
export function targetSearches(opportunity: Opportunity): string[] {
  return [
    ...(opportunity.targetQuery === null ? [] : [opportunity.targetQuery]),
    ...opportunity.absorbedQueries,
  ];
}

export function briefProjection(a: {
  opportunity: Opportunity;
  facts: readonly string[];
  doNotClaim: readonly string[];
  voice: string | null;
  profile: PromptProfile | null;
  sitePages?: readonly SitePage[];
  marketFacts?: readonly { source: string; claim: string }[];
}): BriefProjection {
  const o = a.opportunity;
  const pageType = pageTypeOf(o);
  return {
    cluster: o.clusterKey,
    type: o.type,
    target: o.targetQuery ?? o.targetRef,
    absorbedQueries: o.absorbedQueries,
    facts: a.facts,
    marketFacts: a.marketFacts ?? [],
    doNotClaim: a.doNotClaim,
    voice: a.voice,
    acceptance: acceptanceText(o.acceptance),
    pageJob: pageJobFor(o),
    honesty: pageType === null ? null : HONESTY_INSTRUCTION[pageType],
    profile: a.profile,
    sitePages: a.sitePages ?? [],
  };
}

/** The indexes a brief chose that name a fact it was handed, once each, in
 *  the order chosen. Anything else the model returned is dropped. */
export function selectedFactIndexes(brief: Brief, factCount: number): number[] {
  const out: number[] = [];
  for (const index of brief.factIndexes) {
    if (index >= 0 && index < factCount && !out.includes(index)) out.push(index);
  }
  return out;
}

/** The same for the market pool (issue 1135). */
export function selectedMarketIndexes(brief: Brief, factCount: number): number[] {
  const out: number[] = [];
  for (const index of brief.marketFactIndexes ?? []) {
    if (index >= 0 && index < factCount && !out.includes(index)) out.push(index);
  }
  return out;
}

/** `HONESTY_INSTRUCTION` for the row's page type; `null` where it has none. */
function honestyFor(opportunity: DraftPromptInputs["opportunity"]): string | null {
  const pageType = pageTypeOf(opportunity);
  return pageType === null ? null : HONESTY_INSTRUCTION[pageType];
}

/** The one shape a prompt takes: the closed struct, plus this step's own
 *  task text and its own upstream artifacts. The struct is spread at the
 *  top level so a reader of a request body can see that it carries exactly
 *  `DraftPromptInputs` and nothing derived. */
function promptFor(
  task: string,
  inputs: DraftPromptInputs,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    task,
    // §8 hard rule 7: "brand voice = one free-text field appended to the
    // draft prompt. Nothing learned." Appended, verbatim, or absent.
    voice: inputs.voiceText,
    businessName: inputs.businessName,
    domain: inputs.domain,
    category: inputs.category,
    opportunity: inputs.opportunity,
    // SPEC §7 (2026-09-19, issue 900; *honesty by page type*, issue 1136):
    // what this page is for, and how the business may appear on a page of
    // its type.
    pageJob: pageJobFor(inputs.opportunity),
    honesty: honestyFor(inputs.opportunity),
    grounded: {
      url: inputs.grounded.url,
      readAt: inputs.grounded.readAt.toISOString(),
      passage: inputs.grounded.passage,
    },
    links: inputs.links.map((link) => ({ url: link.url, page: link.label })),
    // SPEC §7 (2026-09-20), #927: what the business does, sells, promises,
    // serves and says — already bounded by `../voice/profile-block.ts`, and
    // `null` on a site nothing has been read of, which is the prompt this
    // product built before this issue.
    profile: inputs.profile,
    // SPEC §7 (2026-09-20), #928: what the site already covers. Titles and
    // addresses, so the page can stand beside them and link to them rather
    // than say what one of them already says.
    known: inputs.known,
    ...extra,
  };
}

/** The rules §8 enforces in code, stated to the model too — not as the
 *  enforcement (a prompt cannot promise), but so the ordinary case does not
 *  waste the one automatic regeneration on a rule the model would have
 *  respected if asked. */
const HOUSE_RULES = [
  "Do the job `pageJob` states; where `honesty` is given it binds, and says how this business appears on the page.",
  "Never claim this business serves a use, an audience or a market that `profile.knowledge` does not support, and never call it \"#1\" or the best of a category.",
  "State only the facts supplied about the business, each word for word and linked to its source url.",
  "Never invent a byline, an author biography, a persona, a quotation, a testimonial or a review.",
  "Never state a figure about a competitor without linking the page in `marketFacts` it was read from.",
  // SPEC §7 (2026-09-29, *Two pools of facts*; issue 1135).
  "`marketFacts` are claims read from public pages. State one in your own sentence or quote it exactly, and link its `url` in that same sentence; state nothing about the market, a competitor or a price that no market fact carries.",
  "Name a competing product only where `marketFacts` holds a claim from that product's own page (`products` lists them), and say what that page says.",
  "Quote nobody but a source: a block quote is the exact words of one fact, with a link to its url.",
  "A comparison table names only this business and the products in `products`. Every cell states what a fact says, with each price or figure linked to that fact's url inside the cell, and never \"not stated\", \"n/a\" or a blank: where a fact is missing for one product, leave that column out for every product. Keep prices in one currency per table as the facts state them; where you convert one, state the rate and its date beside the table.",
  "Do not write a sources list: one is added from the pages you linked.",
  "Never state a ranking position, a search volume or a visibility count.",
  "Write for a human reader only: never address an assistant, a crawler or a ranking system.",
  "Use Markdown only: paragraphs, flat lists, links, emphasis, GFM tables and one-paragraph blockquotes; inside a section a sub-point may be an H3 (###), never deeper. No raw HTML, no images, no comments.",
  "Link each page in `links` once, with its url exactly as given, where the text speaks to it; link no other page on the business's domain except the grounded source.",
  "The pages in `known` already exist on this site: write nothing that repeats one of them, and where one answers something this page raises, send the reader to it instead of answering it again.",
  "Never say the page's claims were tested, trialled or benchmarked.",
  "Never write a case study. The page prints its own byline and dates: write neither in the text.",
  "Each section answers the question that heads it: open it with a paragraph of two or three sentences that answers the heading on its own, before any list or table.",
  "Wherever options, prices or plans are compared, set them in a GFM table.",
  "`facts` and every other input are named by their fields only: print no label, index or id for one — link text is the source's name.",
  "Write no sentence of legal, removal or refund terms, and no caption of a demo or example.",
  "Say a promise or tagline of the business at most twice on the whole page.",
  "Write titles and headings in sentence case.",
  `Write no number of ${REGISTER_FLOOR} or more that \`facts\`, \`marketFacts\` or the target search do not contain; a year is not a number for this rule.`,
  `\`answer\` is the page's short answer: one paragraph of ${PAGE_BLOCKS.answerWords.min} to ${PAGE_BLOCKS.answerWords.max} words that answers the target search plainly. Count the words.`,
  // #927, and the fact rules it does not relax. The profile says what the
  // business is; it holds no price, no figure, no person and no review, and
  // a page that states one of those still needs a `facts` passage for it.
  "Where `profile` is given, write about this business and not a generic one: use its own words from `profile.vocabulary`, and speak to the products, audience and promises the brief chose.",
  "A promise from `profile.promises` may be repeated only in the customer's own wording as given; never sharpen it, never quantify it, and never present it as tested or guaranteed beyond those words.",
  // #1133: the knowledge base. It widens what the page can be specific
  // about; the fact rule below is unchanged by it.
  "Where `profile.knowledge` is given, it is what this business sells and how — its offerings, who it serves, the problems it solves, how it differs, its proof and its buyers' questions, each with the page it was read from in `from`, or `founder` where the founder said it. Write the page about those, never about a generic business of its kind.",
  "`profile` is not a source of facts: state no price, quantity, date, person, review or figure that is not in `facts`, word for word and linked, however much `profile` suggests one.",
];

async function step<T>(
  c: CostContext,
  a: { site: LlmCallSite; tier: Tier; schema: z.ZodType<T>; input: Record<string, unknown> }
): Promise<Measured<T>> {
  // The ceiling, re-read between calls (BUILD §6.5). A step we cannot
  // afford is `not_attempted` — never a 0 and never an estimate.
  if (c.capHit()) return unmeasured("not_attempted", new Date());
  return llm(c, { site: a.site, tier: a.tier, schema: a.schema, input: a.input });
}

export function brief(c: CostContext, projection: BriefProjection): Promise<Measured<Brief>> {
  return step(c, {
    site: STEP_CALL_SITES.brief,
    tier: "nano",
    schema: BRIEF_SCHEMA,
    input: {
      task:
        "Write the brief for one page answering the target search, doing the job " +
        "`pageJob` states and obeying `honesty` where one is given: the question a " +
        "reader arrives with, the angle that answers it, and the points the page must " +
        "cover. Choose the facts the page will state by their index in `facts`; you " +
        "cannot write a fact of your own. `marketFacts` are claims read from public pages " +
        "— the top results for this search, competing products' own pricing and feature " +
        "pages, and studies: choose the ones the page will cite by their index, in " +
        "`marketFactIndexes`, at least three where the page compares options. " +
        "Where `profile` is given, choose which of " +
        "its products, audience and promises — and, where `profile.knowledge` is given, " +
        "which of its offerings, problems, differences and buyers' questions — this page " +
        "should speak to, and say so in " +
        "the points — the page must be specific to this business and relevant to its " +
        "readers, never generic. Answer the target search first: the profile tells you " +
        "who is answering, never what the page is about. `sitePages` lists every page " +
        "this site has published or planned, with the question each answers and its " +
        "kind: take an angle none of them already takes, and where one of them answers " +
        "something this page raises, make sending the reader to it one of the points " +
        "rather than answering it again.",
      ...projection,
    },
  });
}

/**
 * The outline code accepts: six to ten sections, each a block of the set
 * under a question, with every block the page's type requires among them.
 * `null` where what the model returned is not one — fewer than six, a
 * required block absent, or a heading that is not a question.
 *
 * What can be put right without writing a word is: a role outside the set
 * is a `detail`; a question written without its mark gets it; a repeated
 * heading is dropped; and past ten, the sections the type does not require
 * are dropped from the end.
 */
export function outlineOf(
  sections: readonly { role: string; heading: string }[],
  required: readonly SectionRole[],
  /** The names that keep their capital when a heading is put in sentence
   *  case (`./compose.ts`). */
  proper: ReadonlySet<string> = new Set()
): Outline | null {
  const seen = new Set<string>();
  const kept: { role: SectionRole; heading: string }[] = [];
  for (const section of sections) {
    // Tidied and cased here, once, so the heading the draft is written
    // under, the page prints and the rules compare is one string.
    const text = sentenceCase(tidyText(section.heading.replace(/^[#\s]+/, "").replace(/\s+/g, " ").trim()), proper);
    if (text === "" || !isQuestionShaped(text)) return null;
    const heading = text.endsWith("?") ? text : `${text.replace(/[.:!]+$/, "")}?`;
    const key = heading.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const role = SECTION_ROLES.find((known) => known === section.role) ?? "detail";
    kept.push({ role, heading });
  }
  const owed = new Set(required);
  for (let index = kept.length - 1; index >= 0 && kept.length > PAGE_BLOCKS.sections.max; index--) {
    const role = kept[index]!.role;
    const only = kept.filter((section) => section.role === role).length === 1;
    if (!(owed.has(role) && only)) kept.splice(index, 1);
  }
  if (kept.length < PAGE_BLOCKS.sections.min || kept.length > PAGE_BLOCKS.sections.max) return null;
  if (required.some((role) => !kept.some((section) => section.role === role))) return null;
  return { sections: kept };
}

export async function outline(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: { brief: Brief; skeleton: readonly SectionRole[]; proper?: ReadonlySet<string> }
): Promise<Measured<Outline>> {
  const written = await step(c, {
    site: STEP_CALL_SITES.outline,
    tier: "nano",
    schema: OUTLINE_SCHEMA,
    input: promptFor(
      `Choose the page's sections: ${PAGE_BLOCKS.sections.min} to ${PAGE_BLOCKS.sections.max} of them, in the order a reader ` +
        "needs them, for the job `pageJob` states and the points the brief must cover. Each section is one " +
        "of `blocks` — give its `role` — under a `heading` written as the question a reader asks, in the " +
        "reader's words, in sentence case, ending in a question mark. Every role in `required` must appear " +
        "at least once; `detail` may appear as often as the page needs. No two headings ask the same thing, " +
        "and none repeats the target search itself: the page's title asks that and its short answer answers it.",
      inputs,
      {
        brief: a.brief,
        blocks: SECTION_ROLES.map((role) => ({ role, task: SECTION_TASK[role] })),
        required: a.skeleton,
      }
    ),
  });
  if (written.kind === "unmeasured") return written;
  // A section list that is not six to ten questions over the required
  // blocks is not an outline of this page.
  const value = outlineOf(written.value.sections, a.skeleton, a.proper);
  return value === null ? unmeasured("undeterminable", written.at) : { ...written, value };
}

/**
 * The draft, written in turn (SPEC §7, 2026-09-29: "sections are written in
 * turn so no single call's clock caps the page"): one call for the page's
 * frame and one for every `DRAFT_SECTIONS_PER_CALL` sections, all asked at
 * once. Each is told the whole outline, so a section is written knowing what
 * stands beside it. Any call that did not answer is the step's failure.
 *
 * **A customer's page is written on the writer tier** (SPEC §7, 2026-09-29,
 * *Length and the writer*; issue 1138): `tier: "writer"`. Its section calls
 * are then made one after another, each handed the bodies already written,
 * and each section is told its share of the page's length in `words`. The
 * lead's free first page (SPEC §2) stays on the small tier, its calls all
 * asked at once: it is paid under `CAPS.FREE_C`, which the writer tier does
 * not fit inside.
 */
export async function draft(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: {
    brief: Brief;
    outline: Outline;
    facts: readonly { url: string; passage: string }[];
    /** The market facts the brief chose, and the products whose own pages
     *  were read (issue 1135). */
    marketFacts?: readonly { url: string; source: string; passage: string; readAt: string }[];
    products?: readonly { domain: string; pages: readonly string[] }[];
    /** #1178: the rules the attempt before this one broke, and the sentences
     *  that broke them. Absent on a first attempt, whose prompt is unchanged. */
    fix?: readonly FixNote[];
    /** Issue 1144: the earlier attempt's own sentences that a page written
     *  for another business also says. Absent unless that stopped it. */
    apart?: readonly string[];
    tier?: "haiku" | "writer";
    /** Each section's share of the page's length target, by index. */
    words?: readonly ({ min: number; max: number } | null)[];
  }
): Promise<Measured<DraftParts>> {
  const tier = a.tier ?? "haiku";
  const fixed =
    a.fix === undefined
      ? ""
      : " An earlier attempt at this page was stopped: `fix` names each rule it broke and the " +
        "sentences that broke it. Write so that none of them recurs and `rules` hold.";
  const apart =
    a.apart === undefined
      ? ""
      : " An earlier attempt at this page read almost the same as a page already written for " +
        "another business. Do not resemble it: `apart` lists sentences the two shared. Use none of " +
        "them, and give this page its own order, examples and wording, built on this business's facts.";
  const shared = {
    brief: a.brief,
    outline: a.outline.sections.map((section, index) => ({
      index,
      ...section,
      task: SECTION_TASK[section.role],
      ...(a.words?.[index] ? { words: a.words[index] } : {}),
    })),
    facts: a.facts,
    marketFacts: a.marketFacts ?? [],
    products: a.products ?? [],
    rules: HOUSE_RULES,
    ...(a.fix === undefined ? {} : { fix: a.fix }),
    ...(a.apart === undefined ? {} : { apart: a.apart }),
  };
  const frame = step(c, {
    site: STEP_CALL_SITES.draft,
    tier,
    schema: FRAME_SCHEMA,
    input: promptFor(
      "Write the page's frame, doing what `pageJob` says the page is for. Its sections are written " +
        "separately from `outline`; write none of them here. `title`: the buyer's question, in the " +
        "buyer's words. `answer`: the short answer. `takeaways`: " +
        `${PAGE_BLOCKS.takeaways.min} to ${PAGE_BLOCKS.takeaways.max} key takeaways, one sentence each. ` +
        "`closing`: one line that points the reader to the one action this page's reader should take, " +
        "linking the page in `links` where they take it. `faq`: " +
        `${PAGE_BLOCKS.faq.min} to ${PAGE_BLOCKS.faq.max} questions buyers ask about the target search that ` +
        "the outline's headings do not already ask, each answered in two or three sentences under the " +
        "same `rules`; they are stored with the page, not printed in it. State the business's `facts` " +
        "word for word, and cite each of `marketFacts` you use beside the sentence that uses it." +
        fixed +
        apart,
      inputs,
      shared
    ),
  });
  const indexes = a.outline.sections.map((_section, index) => index);
  const batches: number[][] = [];
  for (let at = 0; at < indexes.length; at += DRAFT_SECTIONS_PER_CALL) {
    batches.push(indexes.slice(at, at + DRAFT_SECTIONS_PER_CALL));
  }
  const lengthTask =
    a.words === undefined
      ? ""
      : " Each section's `words` in `outline` is the length to write it to: between `min` and `max` " +
        "words, every paragraph telling the reader something they can use — detail, an example, a " +
        "comparison or a consequence drawn from the facts and `profile`. Never pad, and never restate a " +
        "point to reach the length.";
  const batch = (write: number[], written: readonly string[]) =>
    step(c, {
      site: STEP_CALL_SITES.sections,
      tier,
      schema: SECTIONS_SCHEMA,
      input: promptFor(
        "Write the sections of `outline` whose indexes are in `write`, and no others: one Markdown body " +
          "for each, in that order, doing what its task says and what `pageJob` says the page is for — " +
          "the body only, without its heading, which the page already has. The other sections are " +
          "written separately: say nothing here that belongs under another heading. State the business's " +
          "`facts` word for word, and cite each of `marketFacts` you use beside the sentence that uses it." +
          (tier === "writer"
            ? " `written` holds the bodies of the sections before these, in the outline's order: say nothing they already say."
            : "") +
          lengthTask +
          fixed +
          apart,
        inputs,
        { ...shared, write, ...(tier === "writer" ? { written } : {}) }
      ),
    });

  const sections: string[] = [];
  if (tier === "writer") {
    // In turn: each call reads what the ones before it wrote.
    for (const write of batches) {
      const wrote = await batch(write, [...sections]);
      if (wrote.kind === "unmeasured") return wrote;
      if (wrote.value.sections.length !== write.length) return unmeasured("undeterminable", wrote.at);
      sections.push(...wrote.value.sections);
    }
    const framed = await frame;
    return framed.kind === "unmeasured" ? framed : { ...framed, value: { ...framed.value, sections } };
  }

  const [framed, ...written] = await Promise.all([frame, ...batches.map((write) => batch(write, []))]);
  if (framed === undefined || framed.kind === "unmeasured") return framed ?? unmeasured("undeterminable", new Date());
  for (const [index, wrote] of written.entries()) {
    if (wrote.kind === "unmeasured") return wrote;
    // A call that returned other than what it was asked for wrote no page.
    if (wrote.value.sections.length !== batches[index]!.length) return unmeasured("undeterminable", wrote.at);
    sections.push(...wrote.value.sections);
  }
  return { ...framed, value: { ...framed.value, sections } };
}

/**
 * Sections written a second time (issue 1138), on the writer tier: the ones
 * short of their share of the page's floor, or the ones the critic asked
 * for. One call, the bodies back in the order of `write`.
 */
export async function sectionsAgain(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: {
    brief: Brief;
    outline: Outline;
    /** Every section's body as it stands, by index. */
    bodies: readonly string[];
    words: readonly ({ min: number; max: number } | null)[];
    write: readonly { index: number; note: string }[];
    facts: readonly { url: string; passage: string }[];
    marketFacts?: readonly { url: string; source: string; passage: string; readAt: string }[];
    products?: readonly { domain: string; pages: readonly string[] }[];
  }
): Promise<Measured<string[]>> {
  const wrote = await step(c, {
    site: STEP_CALL_SITES.sections,
    tier: "writer",
    schema: SECTIONS_SCHEMA,
    input: promptFor(
      "The page in `outline` is written; each section's `body` is as it stands. Write again the " +
        "sections named in `write`, and no others: one Markdown body for each, in that order, without " +
        "its heading. Each entry's `note` says why — do what it asks, keep what the section states " +
        "where the note does not say otherwise, and keep every link it has. Write each to its `words`, " +
        "between `min` and `max`, never padding and never repeating another section. State the " +
        "business's `facts` word for word, and cite each of `marketFacts` you use beside the sentence " +
        "that uses it.",
      inputs,
      {
        brief: a.brief,
        outline: a.outline.sections.map((section, index) => ({
          index,
          ...section,
          task: SECTION_TASK[section.role],
          ...(a.words[index] ? { words: a.words[index] } : {}),
          body: a.bodies[index] ?? "",
        })),
        write: a.write,
        facts: a.facts,
        marketFacts: a.marketFacts ?? [],
        products: a.products ?? [],
        rules: HOUSE_RULES,
      }
    ),
  });
  if (wrote.kind === "unmeasured") return wrote;
  if (wrote.value.sections.length !== a.write.length) return unmeasured("undeterminable", wrote.at);
  return { ...wrote, value: wrote.value.sections };
}

/**
 * The critic (SPEC §7, 2026-09-29; issue 1138): five scores for the page as
 * written, and the sections it would have written again — to add as well as
 * to cut. `words` is counted in code and `target` is the one the writer was
 * given, so the critic and the writer cannot hold different lengths.
 */
export function critic(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: {
    brief: Brief;
    outline: Outline;
    parts: DraftParts;
    words: number;
    target: LengthTarget | null;
    marketFacts?: readonly { url: string; source: string; passage: string; readAt: string }[];
    maxRevisions: number;
  }
): Promise<Measured<CriticRead>> {
  return step(c, {
    site: STEP_CALL_SITES.critic,
    tier: "writer",
    schema: CRITIC_SCHEMA,
    input: promptFor(
      "Read the page — its `answer`, `takeaways` and `sections` — as its editor and score five things " +
        "from 0 to 3. `adds`: what the page tells a reader that the top results do not — `marketFacts` " +
        "holds what those pages say. `specificity`: concrete detail in place of generalities. `fit`: " +
        "whether it is plainly written for this business's readers, per `profile`. `blocks`: whether " +
        "every section does what its `task` asks. `length`: `words` against `target` — the count is " +
        "exact, do not recount it. Then, in `revise`, name at most `maxRevisions` sections, by `index`, " +
        "whose rewriting would most improve those scores, with one or two sentences each saying what to " +
        "add, cut or change. You may ask for more as well as for less. Never ask for a fact that " +
        "`marketFacts`, `profile` and the page do not already hold, and never for a cut that would take " +
        "the page under `target.floor` words. Leave `revise` empty where the page needs nothing.",
      inputs,
      {
        brief: a.brief,
        answer: a.parts.answer,
        takeaways: a.parts.takeaways,
        sections: a.outline.sections.map((section, index) => ({
          index,
          ...section,
          task: SECTION_TASK[section.role],
          body: a.parts.sections[index] ?? "",
        })),
        words: a.words,
        target: a.target,
        marketFacts: a.marketFacts ?? [],
        maxRevisions: a.maxRevisions,
      }
    ),
  });
}

/** The short-answer box alone, written again to its word count — the
 *  round-1 review's "over the limit, rewrite only the box, with its count
 *  stated" (owner, 2026-10-02). */
export function answerBoxRewrite(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: { answer: string; words: number }
): Promise<Measured<{ answer: string }>> {
  return step(c, {
    site: STEP_CALL_SITES.answer_box,
    tier: "haiku",
    schema: ANSWER_BOX_SCHEMA,
    input: promptFor(
      `\`answer\` is this page's short answer and it is ${a.words} words long. Write it again as one paragraph of ` +
        `${PAGE_BLOCKS.answerWords.min} to ${PAGE_BLOCKS.answerWords.max} words — aim for 50 — that answers the ` +
        "target search plainly. Keep what it states and state nothing it does not; `rules` hold.",
      inputs,
      { answer: a.answer, rules: HOUSE_RULES }
    ),
  });
}

/** The page a draft's parts make, as every later pass reads it. */
export interface WrittenPage {
  body: DraftBody;
  /** The closing line, apart: it is laid out after the body's links. */
  closing: string;
  faq: FaqEntry[];
}

/**
 * The draft's parts laid out as the page (`./compose.ts`), with the short
 * answer held to its 40–60 words: counted here, and outside that the box
 * alone is written again — once. A box still outside it is
 * `first_block_answers`'s to stop.
 */
export async function writtenPage(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: { parts: DraftParts; outline: Outline; tidy: TidyInputs }
): Promise<Measured<WrittenPage>> {
  const at = new Date();
  const composed = composePage(a.parts, a.outline, a.tidy);
  const words = answerBoxWords(composed.body.bodyMarkdown);
  if (words >= PAGE_BLOCKS.answerWords.min && words <= PAGE_BLOCKS.answerWords.max) {
    return { kind: "measured", value: composed, at };
  }
  const again = await answerBoxRewrite(c, inputs, { answer: answerBoxOf(composed.body.bodyMarkdown) ?? "", words });
  if (again.kind === "unmeasured") return again;
  return {
    ...again,
    value: {
      ...composed,
      body: { ...composed.body, bodyMarkdown: withAnswer(composed.body.bodyMarkdown, again.value.answer) },
    },
  };
}

export function answerability(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: { body: DraftBody; facts: readonly string[] }
): Promise<Measured<AnswerabilityOps>> {
  return step(c, {
    site: STEP_CALL_SITES.answerability,
    tier: "haiku",
    schema: ANSWERABILITY_SCHEMA,
    input: promptFor(
      "Make the page easier for an answer engine to lift, using only these operations: " +
        "`order` reorders the page's heading sections (a permutation of their indexes); " +
        "`openings` gives a section, by index, the paragraph of two or three sentences that answers " +
        "its heading on its own — add one where the section opens with a list, a table or anything " +
        "that is not its answer, and write a shorter one where its opening paragraph runs past three " +
        "sentences; leave a section that already opens with its answer out; `insertFacts` adds a fact " +
        "from `facts`, by index, to a section. Also write a title and description that name the " +
        "question. You cannot add a heading, and you cannot change the short answer or the takeaways.",
      inputs,
      { body: a.body, facts: a.facts, rules: HOUSE_RULES }
    ),
  });
}
