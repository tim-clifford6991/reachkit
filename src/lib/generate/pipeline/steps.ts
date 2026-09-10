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
import type { CostContext } from "@/lib/costs";
import { llm, type LlmCallSite } from "@/lib/llm";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import type { DraftPromptInputs } from "../voice/inputs";

/** §8's five steps, closed. `claim_check` is the fifth and is run by
 *  `claims/check.ts`; it is a member here because a caller reporting "which
 *  step did not run" has to be able to name it. */
export type PipelineStep = "brief" | "outline" | "draft" | "answerability" | "claim_check";

/** The `llm()` call site each step ledgers under. One string per step, so a
 *  cost report reads by step without anyone joining a table. */
export const STEP_CALL_SITES: Readonly<Record<Exclude<PipelineStep, "claim_check">, LlmCallSite>> =
  Object.freeze({
    brief: "generate.brief",
    outline: "generate.outline",
    draft: "generate.draft",
    answerability: "generate.answerability",
  });

const BRIEF_SCHEMA = z.strictObject({
  readerQuestion: z.string(),
  angle: z.string(),
  mustCover: z.array(z.string()),
});
export type Brief = z.infer<typeof BRIEF_SCHEMA>;

const OUTLINE_SCHEMA = z.strictObject({
  sections: z.array(z.strictObject({ heading: z.string(), covers: z.string() })).min(1),
});
export type Outline = z.infer<typeof OUTLINE_SCHEMA>;

const DRAFT_SCHEMA = z.strictObject({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  bodyMarkdown: z.string(),
});
export type DraftBody = z.infer<typeof DRAFT_SCHEMA>;

/** The answerability + SEO pass returns the same shape the draft step does:
 *  it rewrites a page, it does not annotate one. A pass that returned notes
 *  would need a second writer to apply them, and that writer would be a
 *  place for an unchecked instruction to enter. */
const ANSWERABILITY_SCHEMA = DRAFT_SCHEMA;

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
    ...extra,
  };
}

/** The rules §8 enforces in code, stated to the model too — not as the
 *  enforcement (a prompt cannot promise), but so the ordinary case does not
 *  waste the one automatic regeneration on a rule the model would have
 *  respected if asked. */
const HOUSE_RULES = [
  "Answer the reader's question before naming the business; its name and domain must not appear in the first 300 characters.",
  "State the grounded passage as the page's one fact about the business, and link its source url.",
  "Never invent a byline, an author biography, a persona, a quotation, a testimonial or a review.",
  "Never state a figure about a competitor without linking the public page it was read from.",
  "Never state a ranking position, a search volume or a visibility count.",
  "Write for a human reader only: never address an assistant, a crawler or a ranking system.",
  "Use Markdown only: headings, paragraphs, lists, links, emphasis. No raw HTML and no comments.",
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

export function brief(c: CostContext, inputs: DraftPromptInputs): Promise<Measured<Brief>> {
  return step(c, {
    site: STEP_CALL_SITES.brief,
    tier: "nano",
    schema: BRIEF_SCHEMA,
    input: promptFor(
      "Write the brief for one page answering the opportunity's target query: " +
        "the question a reader arrives with, the angle that answers it, and the " +
        "points the page must cover.",
      inputs
    ),
  });
}

export function outline(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: { brief: Brief }
): Promise<Measured<Outline>> {
  return step(c, {
    site: STEP_CALL_SITES.outline,
    tier: "nano",
    schema: OUTLINE_SCHEMA,
    input: promptFor("Turn the brief into an outline: one section per point, in reading order.", inputs, {
      brief: a.brief,
    }),
  });
}

export function draft(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: { brief: Brief; outline: Outline }
): Promise<Measured<DraftBody>> {
  return step(c, {
    site: STEP_CALL_SITES.draft,
    tier: "haiku",
    schema: DRAFT_SCHEMA,
    input: promptFor("Write the page from the outline, grounded in the passage supplied.", inputs, {
      brief: a.brief,
      outline: a.outline,
      rules: HOUSE_RULES,
    }),
  });
}

export function answerability(
  c: CostContext,
  inputs: DraftPromptInputs,
  a: { body: DraftBody }
): Promise<Measured<DraftBody>> {
  return step(c, {
    site: STEP_CALL_SITES.answerability,
    tier: "haiku",
    schema: ANSWERABILITY_SCHEMA,
    input: promptFor(
      "Rewrite the page so an answer engine can lift its answer whole: the " +
        "reader's question answered in the opening lines, one idea per heading, " +
        "and a title and description that name the question. Change nothing the " +
        "rules forbid and keep the grounded passage word for word.",
      inputs,
      { body: a.body, rules: HOUSE_RULES }
    ),
  });
}
