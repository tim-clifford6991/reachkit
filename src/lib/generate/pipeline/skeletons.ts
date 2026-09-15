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
  evidence: "State the selected facts about the business, each linked to the page it was read from.",
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
