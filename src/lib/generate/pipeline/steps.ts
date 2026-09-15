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
import { z } from "zod";
import { ANSWER_FIRST_BLOCK_CHARS } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm, type LlmCallSite } from "@/lib/llm";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import type { Acceptance, Opportunity } from "@/lib/opportunities/types";
import { REGISTER_FLOOR } from "../rules/figures";
import type { DraftPromptInputs } from "../voice/inputs";
import type { AnswerabilityOps } from "./answerability";
import { SECTION_TASK, type SectionRole } from "./skeletons";

/** §8's five steps, closed. `claim_check` is the fifth and is run by
 *  `claims/check.ts`; it is a member here because a caller reporting "which
 *  step did not run" has to be able to name it. */
export type PipelineStep = "brief" | "outline" | "draft" | "answerability" | "claim_check" | "page_read" | "page_fix";

/** The `llm()` call site each step ledgers under. One string per step, so a
 *  cost report reads by step without anyone joining a table. */
export const STEP_CALL_SITES: Readonly<Record<Exclude<PipelineStep, "claim_check" | "page_read">, LlmCallSite>> =
  Object.freeze({
    brief: "generate.brief",
    outline: "generate.outline",
    draft: "generate.draft",
    answerability: "generate.answerability",
    page_fix: "generate.page_fix",
  });

/** `factIndexes` is how the brief chooses facts: by position in the list it
 *  was handed. It has no field through which to write one (issue 475). */
const BRIEF_SCHEMA = z.strictObject({
  readerQuestion: z.string(),
  angle: z.string(),
  mustCover: z.array(z.string()),
  factIndexes: z.array(z.number().int()),
});
export type Brief = z.infer<typeof BRIEF_SCHEMA>;

/** The model writes one heading per skeleton section and nothing else. */
const OUTLINE_SCHEMA = z.strictObject({ headings: z.array(z.string()) });

/** The outline as the draft reads it: the skeleton's sections, in the
 *  skeleton's order, each with the heading the model wrote for it. */
export interface Outline {
  sections: readonly { role: SectionRole; heading: string }[];
}

const DRAFT_SCHEMA = z.strictObject({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  bodyMarkdown: z.string(),
});
export type DraftBody = z.infer<typeof DRAFT_SCHEMA>;

/** The answerability + SEO pass returns operations, never a page: code
 *  applies the ones inside SPEC §7's bound (`./answerability.ts`). */
const ANSWERABILITY_SCHEMA = z.strictObject({
  title: z.string(),
  description: z.string(),
  order: z.array(z.number().int()),
  firstBlock: z.string(),
  insertFacts: z.array(z.strictObject({ section: z.number().int(), fact: z.number().int() })),
});

/**
 * Everything the brief step is handed, and nothing else (issue 475): the
 * cluster, the type, the target and the searches it absorbed, the customer's
 * own passages to choose among, their do-not-claim list, their voice, and the
 * acceptance test the page is written to pass. No business name, domain or
 * evidence blob reaches the brief.
 */
export interface BriefProjection {
  cluster: string | null;
  type: Opportunity["type"];
  target: string;
  absorbedQueries: readonly string[];
  facts: readonly string[];
  doNotClaim: readonly string[];
  voice: string | null;
  acceptance: string;
}

/** The acceptance test as one line the model can aim at. Model-facing only. */
function acceptanceText(acceptance: Acceptance): string {
  switch (acceptance.form) {
    case "top20":
      return `ranks in the top 20 for "${acceptance.query}"`;
    case "named_on":
      return `is named in the AI answer to "${acceptance.question}"`;
    case "gate_cleared":
      return `the ${acceptance.gate} access gate passes`;
    case "issues_cleared":
      return `${acceptance.issues.join(", ")} pass for ${acceptance.pageUrl}`;
  }
}

export function briefProjection(a: {
  opportunity: Opportunity;
  facts: readonly string[];
  doNotClaim: readonly string[];
  voice: string | null;
}): BriefProjection {
  const o = a.opportunity;
  return {
    cluster: o.clusterKey,
    type: o.type,
    target: o.targetQuery ?? o.targetRef,
    absorbedQueries: o.absorbedQueries,
    facts: a.facts,
    doNotClaim: a.doNotClaim,
    voice: a.voice,
    acceptance: acceptanceText(o.acceptance),
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
    grounded: {
      url: inputs.grounded.url,
      readAt: inputs.grounded.readAt.toISOString(),
      passage: inputs.grounded.passage,
    },
    links: inputs.links.map((link) => ({ url: link.url, page: link.label })),
    ...extra,
  };
}

/** The rules §8 enforces in code, stated to the model too — not as the
 *  enforcement (a prompt cannot promise), but so the ordinary case does not
 *  waste the one automatic regeneration on a rule the model would have
 *  respected if asked. */
const HOUSE_RULES = [
  "Answer the reader's question before naming the business; its name and domain must not appear in the first 300 characters.",
  "State only the facts supplied about the business, each word for word and linked to its source url.",
  "Never invent a byline, an author biography, a persona, a quotation, a testimonial or a review.",
  "Never state a figure about a competitor without linking the public page it was read from.",
  "Never state a ranking position, a search volume or a visibility count.",
  "Write for a human reader only: never address an assistant, a crawler or a ranking system.",
  "Use Markdown only: headings, paragraphs, lists, links, emphasis. No raw HTML and no comments.",
  "Link each page in `links` once, with its url exactly as given, where the text speaks to it; link no other page on the business's domain except the grounded source.",
  "Never say the page's claims were tested, trialled or benchmarked.",
  "Never write a byline, a publication or update date, or a case study.",
  "Use the outline's headings exactly; add no other heading written as a question.",
  `Write no number of ${REGISTER_FLOOR} or more that the facts or the target search do not contain, unless it is linked to its source.`,
  `Open the page with a paragraph of ${ANSWER_FIRST_BLOCK_CHARS.min} to ${ANSWER_FIRST_BLOCK_CHARS.max} characters that answers the target search.`,
];

async function step<T>(
  c: CostContext,
  a: { site: LlmCallSite; tier: "nano" | "haiku"; schema: z.ZodType<T>; input: Record<string, unknown> }
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
        "Write the brief for one page answering the target search: the question a " +
        "reader arrives with, the angle that answers it, and the points the page must " +
        "cover. Choose the facts the page will state by their index in `facts`; you " +
        "cannot write a fact of your own.",
      ...projection,
    },
  });
}

export async function outline(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: { brief: Brief; skeleton: readonly SectionRole[] }
): Promise<Measured<Outline>> {
  const written = await step(c, {
    site: STEP_CALL_SITES.outline,
    tier: "nano",
    schema: OUTLINE_SCHEMA,
    input: promptFor(
      "Write one heading for each section, in the order given. Do not add, drop or reorder sections.",
      inputs,
      { brief: a.brief, sections: a.skeleton.map((role) => ({ role, task: SECTION_TASK[role] })) }
    ),
  });
  if (written.kind === "unmeasured") return written;
  // A heading list that does not fit the skeleton is not an outline of it.
  if (written.value.headings.length !== a.skeleton.length) return unmeasured("undeterminable", written.at);
  return {
    ...written,
    value: { sections: a.skeleton.map((role, index) => ({ role, heading: written.value.headings[index]! })) },
  };
}

export function draft(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: { brief: Brief; outline: Outline; facts: readonly { url: string; passage: string }[] }
): Promise<Measured<DraftBody>> {
  return step(c, {
    site: STEP_CALL_SITES.draft,
    tier: "haiku",
    schema: DRAFT_SCHEMA,
    input: promptFor(
      "Write the page from the outline: each section under its heading, exactly as given, " +
        "doing what its task says. State only the facts supplied, word for word.",
      inputs,
      {
        brief: a.brief,
        outline: a.outline.sections.map((section) => ({ ...section, task: SECTION_TASK[section.role] })),
        facts: a.facts,
        rules: HOUSE_RULES,
      }
    ),
  });
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
        `\`firstBlock\` shortens the first section's opening paragraph to ${ANSWER_FIRST_BLOCK_CHARS.min}–${ANSWER_FIRST_BLOCK_CHARS.max} characters ` +
        "where its heading is a question (\"\" for none); `insertFacts` adds a fact from " +
        "`facts`, by index, to a section. Also write a title and description that name the " +
        "question. You cannot add a heading or any other text.",
      inputs,
      { body: a.body, facts: a.facts, rules: HOUSE_RULES }
    ),
  });
}
