// SPEC §7 · issue 475 — one closed outline skeleton per opportunity type.
//
// The outline step used to return an open list of sections, so the model
// chose the page's shape — and a blog post is the shape it reaches for. Here
// the shape is fixed by the opportunity's type: the model is handed the
// sections in order and writes only a heading for each. It cannot add a
// section, drop one or reorder them.
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
import type { OpportunityType } from "@/lib/opportunities/types";

export type SectionRole = "answer" | "detail" | "comparison" | "steps" | "evidence";

/** What each section is for, as the outline and draft prompts state it. */
export const SECTION_TASK: Readonly<Record<SectionRole, string>> = Object.freeze({
  answer: "Answer the target search directly in the section's first paragraph.",
  detail: "Explain what decides the answer, one idea per paragraph.",
  comparison: "Compare the options the search names, criterion by criterion, as a table or a list.",
  steps: "Give the steps a reader takes, in order, as a numbered list.",
  // Not "facts about the business": the section's job is to stand the page
  // on something checkable, and a section briefed to be about the seller is
  // how a page answering the market's question became a brochure (issue 900).
  evidence: "State the selected facts, word for word, each linked to the page it was read from.",
});

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
