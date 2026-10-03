// SPEC §7 (2026-09-29, *What every page carries*; issue 1137) — the block
// set a page's outline is chosen from, and the blocks each type requires.
//
// Issue 475 fixed one outline per opportunity type: the model was handed
// three or four sections and wrote a heading for each. The 2026-09-29 ruling
// ends that — "the outline is chosen per page from these blocks and the
// type's job, six to ten sections; no type has one fixed outline". So the
// outline step now chooses the sections, each of them one of the roles
// below, and what stays fixed per type is the blocks a page of that type
// cannot go without: `outlineOf` (`./steps.ts`) refuses an outline that
// lacks one, or that is not six to ten question headings.
//
// Total over the type enum, so a new type is a compile error here. `null` is
// a type that writes no page body: an `unblock` is an instruction, and a
// `fix_page` is a metadata-only update with a pipeline of its own.
//
// **`PAGE_JOB` is the second half of the same idea** (SPEC §7, 2026-09-19,
// issue 900). The skeleton fixed the page's *shape* per type and nothing
// stated its *job*, so a page whose shape was answer → comparison → evidence
// could be filled as an advertisement and still fit. Each type now says, in
// one sentence the brief, the outline and the draft all carry, what the page
// is for. Where the target search is the market's question rather than the
// customer's own brand, `FRAME_INSTRUCTION` (`../rules/frame.ts`) is carried
// beside it — held there, next to the rule that enforces it, so the sentence
// the model is given and the bar it is judged against cannot drift apart.
//
// Nothing here is a customer-facing sentence. `SECTION_TASK` is what the
// model is told a section is for, and the model's heading is what the reader
// meets.
import { contentKindOf, type ContentKind } from "@/lib/opportunities/content-kind";
import type { Opportunity, OpportunityType } from "@/lib/opportunities/types";

export type SectionRole = "answer" | "detail" | "comparison" | "steps" | "evidence" | "business";

/** The block set, in the order the outline prompt lists it. */
export const SECTION_ROLES: readonly SectionRole[] = Object.freeze([
  "answer",
  "detail",
  "comparison",
  "steps",
  "evidence",
  "business",
] as const);

/** What each section is for, as the outline and draft prompts state it. */
export const SECTION_TASK: Readonly<Record<SectionRole, string>> = Object.freeze({
  answer: "Answer the target search in full: what the short answer says, with what a reader needs to act on it.",
  detail: "Explain one thing that decides the answer, one idea per paragraph.",
  comparison:
    "Compare the options, prices or plans the search names, criterion by criterion: after the opening paragraph, a GFM table — a header row, a delimiter row with one `---` for every column, then one row per option.",
  steps: "Say in an opening paragraph what the steps achieve, then give the steps a reader takes, in order, as a numbered list.",
  // Not "facts about the business": the section's job is to stand the page
  // on something checkable, and a section briefed to be about the seller is
  // how a page answering the market's question became a brochure (issue 900).
  evidence: "State the selected facts, word for word, each linked to the page it was read from.",
  // SPEC §7 (2026-09-29): "a section on how the business itself handles the
  // question, with links to its product, pricing and the cluster's hub page".
  business:
    "Say how this business itself handles the question, from the selected facts only, linking its product and pricing pages from `links`.",
});

/** The block every page carries whatever its type (SPEC §7, 2026-09-29). */
const EVERY_PAGE: readonly SectionRole[] = Object.freeze(["business"] as const);

export const SKELETONS: Readonly<Record<OpportunityType, readonly SectionRole[] | null>> = Object.freeze({
  answer_page: ["answer", "detail", "evidence"],
  keyword_page: ["answer", "detail", "steps", "evidence"],
  comparison_page: ["answer", "comparison", "evidence"],
  format_page: ["answer", "comparison", "steps", "evidence"],
  listed_page: ["answer", "comparison", "evidence"],
  expand_page: ["answer", "detail", "steps", "evidence"],
  answerable_page: ["answer", "detail", "evidence"],
  refresh_page: ["answer", "detail", "evidence"],
  unblock: null,
  fix_page: null,
});

/** SPEC §7 (2026-09-19, issue 900) — what the page is for, per type, in one
 *  sentence the drafting prompts carry. Total over the type enum, so a new
 *  type is a compile error here. `null` where the type writes no page body,
 *  the same two as `SKELETONS`. */
export const PAGE_JOB: Readonly<Record<OpportunityType, string | null>> = Object.freeze({
  answer_page:
    "Answer the question the search asks, fully enough that the reader can act on it without opening another page.",
  keyword_page:
    "Explain the subject the search names to a reader new to it: what it is, what decides it, and what they do next.",
  comparison_page:
    "Put the options the search compares side by side on the criteria a reader would actually use, and say which case each one suits.",
  format_page:
    "Give the reader the shape the search asks for — the options compared and the steps to follow — with nothing they have to look up elsewhere.",
  listed_page:
    "Help the reader choose: what the options are, what distinguishes them, and which case each one suits.",
  expand_page:
    "Fill the gaps in the page as it stands: the parts of the question it leaves a reader still asking.",
  answerable_page:
    "Rewrite the page so its answer can be lifted whole: the question asked, then answered, before anything else.",
  refresh_page:
    "Bring the page up to date with what is true now, keeping what still holds and replacing what no longer does.",
  unblock: null,
  fix_page: null,
});

/** SPEC §7 (2026-10-03, D36, issue 1209) — the blocks each kind of new page
 *  the weekly mix rotates requires. An update keeps its type's own above:
 *  what it does to a page is the type's, not the mix's. */
export const KIND_SKELETON: Readonly<Record<Exclude<ContentKind, "update">, readonly SectionRole[]>> =
  Object.freeze({
    comparison: ["answer", "comparison", "evidence"],
    explainer: ["answer", "detail", "evidence"],
    how_to: ["answer", "steps", "detail", "evidence"],
  });

/** What each kind of new page is for, in the one sentence the prompts carry. */
export const KIND_JOB: Readonly<Record<Exclude<ContentKind, "update">, string>> = Object.freeze({
  comparison:
    "Help the reader choose: put the options side by side on the criteria a reader would actually use, say what distinguishes them, and say which case each one suits.",
  explainer:
    "Explain the subject the search names to a reader new to it: what it is, why it matters, what decides it, and what they do next.",
  how_to:
    "Show the reader how to do what the search asks, as numbered steps in order, each drawn from the business's own product or process as the facts state it; where the facts hold no step, say what the reader needs and never invent one.",
});

type Typed = Pick<Opportunity, "type" | "targetQuery">;

/** The blocks the page's outline must carry: its kind's for a new page, its
 *  type's for an update, and the business's own section on both. `null`
 *  where the type writes no body. */
export function skeletonFor(o: Typed): readonly SectionRole[] | null {
  const kind = contentKindOf(o);
  const required = kind === null || kind === "update" ? SKELETONS[o.type] : KIND_SKELETON[kind];
  return required === null ? null : [...required, ...EVERY_PAGE];
}

/** The page's job, chosen as `skeletonFor` chooses its outline. */
export function pageJobFor(o: Typed): string | null {
  const kind = contentKindOf(o);
  return kind === null || kind === "update" ? PAGE_JOB[o.type] : KIND_JOB[kind];
}
