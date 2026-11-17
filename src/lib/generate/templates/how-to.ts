// SPEC §7 (D42, 2) — how-to.
import { CITES_MARKET, HEADING_GAPS } from "@/lib/config/constants";
import type { SectionFacts, Template, TemplateSection } from "./types";

/** Owner Q9/D (2026-11-16): a section on what two of the top results cover, from its claims. */
export const gapSection: TemplateSection = {
  key: "gap",
  task: "One of `pack.gaps`, a subtopic the pages ranked for this search cover: headed by that gap's `heading` worded as a reader asks it, written only from the `pack.claims` whose `url` is in that gap's `claims`, and linking at least one of them. Leave this section out where `pack.gaps` holds none, or where those claims give nothing to say about it.",
  repeat: { min: 0, max: HEADING_GAPS.sectionsMax },
  when: "gaps",
};

/** Owner P3 (2026-11-16): the page's one section on how this business answers its question, from its own passages. */
export const businessSection = (also: string, onlyWith?: SectionFacts): TemplateSection => ({
  key: "business",
  task: `Say how this business answers the page's question, under a heading in the search's own words that names the business, from \`pack.fitFact\` and the business's passages in \`pack.facts\` and \`pack.profile\` only. Where \`pack.fitFact\` is given, state its \`passage\` word for word, linked to its \`url\`. ${also}`,
  ...(onlyWith === undefined ? {} : { onlyWith: { facts: onlyWith, min: 1 } }),
});

export const howTo: Template = {
  type: "how_to",
  // Issue 1486: the task's own steps, from cited outside facts — the
  // platform's or authority's documentation first — with this business as at
  // most one step.
  for: "Get the reader through one task, step by step, as the outside sources in `pack.claims` describe it — the platform's or authority's own documentation (`primary`) first — with this business's product or process as at most one step.",
  // Issue 1389: the specific is a result, a number or a price the pack holds.
  titles: [
    "How to {outcome in the buyer's words} ({a measured result, number or price from pack})",
    "{the search as typed}: {a measured result, number or price from pack}",
  ],
  sections: [
    { key: "what_you_need", task: "Say what the reader needs before they start." },
    {
      key: "steps",
      task: "The steps: after the opening paragraph, a numbered list, each step an action and its result, drawn from `pack.claims` and linking the claim's `url` in the step. At most one step is this business's own product or process. Where the claims hold no step, say what the reader needs and never invent one.",
      block: "steps",
    },
    { key: "check", task: "Say how the reader checks it worked, from what the outside sources say." },
    { key: "mistakes", task: "Name the mistakes to avoid, from what the outside sources say." },
    gapSection,
    // Issue 1390: what buyers were seen to ask beside the target, where the
    // pack holds a question no other section answers.
    {
      key: "asked",
      task: "One question from `pack.questions` that no other section of this page answers, as its heading in the buyer's words: answer it in two or three sentences from the facts, then the detail. Leave this section out where `pack.questions` holds no such question.",
      repeat: { min: 0, max: 3 },
    },
    businessSection("Link its product page.", "fit"),
    { key: "next_step", task: "Say what the reader does next, linking the product page." },
  ],
  blocks: { steps: { min: 3, max: 10, own: 1 }, faq: { min: 3, max: 6 } },
  length: { floor: 1200, ceiling: 3000, kept: 2000 },
  research: true,
  // Issue 1486: the steps are the outside sources'; a page with no business
  // fact stands on them alone (owner, #2511).
  packMustHold: [{ need: "outside_sources", min: CITES_MARKET.min }],
};
