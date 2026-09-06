// BUILD §7 — the model labels; it never decides what an opportunity is.
//
// §7's first sentence: "Derived mechanically — **no LLM decides what an
// opportunity is** (Haiku only labels/classifies)."
//
// `refineType` takes exactly one already-derived candidate and returns
// exactly one. It cannot create a candidate, drop one, re-target one, or
// touch its evidence or its acceptance test — those are copied through by
// construction below, not by a rule someone has to keep. The only two
// fields a response can move are the `type`, within the family the
// evidence already put the candidate in, and the proposed slug and title
// of a Write target.
//
// Three ways a call yields nothing, all identical in effect: a response
// naming a type outside the closed enum does not parse (the schema is the
// enum), a model that is unavailable returns `unmeasured`, and a cost
// ceiling reached before the call returns `unmeasured` too. In every case
// the deterministic candidate stands unchanged. The call goes through
// `llm()`, which is the cost seam — reserved, capped, settled and
// ledgered — and there is no other path to a model from this directory.
import { z } from "zod";
import { EFFORT_BY_TYPE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import { FAMILY_OF, OPPORTUNITY_TYPES, type OpportunityType } from "../types";
import { slugify, type Candidate } from "./candidate";

/** BP-009's call sites are string literals; this is §7's one. */
export const TYPING_CALL_SITE = "opportunity-typing";

/** `.strictObject`: a response carrying a query, a volume, an acceptance
 *  test or an evidence blob does not parse, so the model has no field
 *  through which to re-target or re-justify a candidate. */
const TYPING_SCHEMA = z.strictObject({
  type: z.enum(OPPORTUNITY_TYPES as [OpportunityType, ...OpportunityType[]]),
  slug: z.string(),
  title: z.string(),
});

/** What the model is shown: the trigger's own facts, and nothing that
 *  would let it invent a different target. No customer page text, no
 *  rival's, no acceptance test. */
function promptFor(candidate: Candidate): Record<string, unknown> {
  return {
    task: "Label an already-derived content opportunity. Choose the type that best names the page to write, from the allowed list, and propose a slug and a title for it. Do not change the search.",
    family: candidate.family,
    derivedType: candidate.type,
    allowedTypes: OPPORTUNITY_TYPES.filter((type) => FAMILY_OF[type] === candidate.family),
    targetQuery: candidate.targetQuery,
    derivedSlug: candidate.targetRef,
  };
}

/** A slug that is not URL-safe, or empty, is not a slug. Re-slugified
 *  rather than rejected: the model's words are the contribution, the shape
 *  is ours. */
function safeSlug(proposed: string, fallback: string): string {
  const slug = slugify(proposed);
  return slug === "" ? fallback : slug;
}

/**
 * One `llm()` call, or none.
 *
 * The Fix family is never sent: an `unblock` is an instruction with no
 * page, no slug and no title, and spending a model call to label one would
 * buy nothing. The Improve family is never sent either — its target is a
 * page the customer already has, whose url and title are theirs, and a
 * proposed slug for it would be a page they did not ask for.
 */
export async function refineType(c: CostContext, candidate: Candidate): Promise<Candidate> {
  if (candidate.family !== "write") return candidate;

  const labelled = await llm(c, {
    site: TYPING_CALL_SITE,
    input: promptFor(candidate),
    schema: TYPING_SCHEMA,
    tier: "haiku",
  });
  if (labelled.kind === "unmeasured") return candidate;

  const { type, slug, title } = labelled.value;
  // A type from another family is a re-classification, not a label: the
  // family was fixed by measured evidence, and the model does not get to
  // move it. The deterministic type stands.
  const refined = FAMILY_OF[type] === candidate.family ? type : candidate.type;

  return {
    ...candidate,
    type: refined,
    effort: EFFORT_BY_TYPE[refined as Exclude<OpportunityType, "unblock">],
    targetRef: safeSlug(slug, candidate.targetRef),
    title: title.trim() === "" ? null : title,
  };
}
