// SPEC §7 (D42, 2) — how-to.
import { CITES_MARKET } from "@/lib/config/constants";
import type { Template } from "./types";

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
    // Issue 1390: what buyers were seen to ask beside the target, where the
    // pack holds a question no other section answers.
    {
      key: "asked",
      task: "One question from `pack.questions` that no other section of this page answers, as its heading in the buyer's words: answer it in two or three sentences from the facts, then the detail. Leave this section out where `pack.questions` holds no such question.",
      repeat: { min: 0, max: 3 },
    },
    { key: "next_step", task: "Say what the reader does next, linking the product page." },
  ],
  blocks: { steps: { min: 3, max: 10, own: 1 }, faq: { min: 3, max: 6 } },
  length: { floor: 1200, ceiling: 2000 },
  research: true,
  // Issue 1486: the steps are the outside sources'; the business is one step
  // and the next step, so one business fact on the topic is enough.
  packMustHold: [{ need: "outside_sources", min: CITES_MARKET.min }, { need: "facts_on_topic", min: 1 }, { need: "product_page" }],
};
