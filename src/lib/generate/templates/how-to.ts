// SPEC §7 (D42, 2) — how-to.
import type { Template } from "./types";

export const howTo: Template = {
  type: "how_to",
  for: "Get the reader through one task with this business's product or process, step by step.",
  titles: ["How to {outcome in the buyer's words}"],
  sections: [
    { key: "what_you_need", task: "Say what the reader needs before they start." },
    {
      key: "steps",
      task: "The steps: after the opening paragraph, a numbered list, each step an action and its result, drawn from the facts. Where the facts hold no step, say what the reader needs and never invent one.",
      block: "steps",
    },
    { key: "check", task: "Say how the reader checks it worked." },
    { key: "mistakes", task: "Name the mistakes to avoid." },
    // Issue 1390: what buyers were seen to ask beside the target, where the
    // pack holds a question no other section answers.
    {
      key: "asked",
      task: "One question from `pack.questions` that no other section of this page answers, as its heading in the buyer's words: answer it in two or three sentences from the facts, then the detail. Leave this section out where `pack.questions` holds no such question.",
      repeat: { min: 0, max: 3 },
    },
    { key: "next_step", task: "Say what the reader does next, linking the product page." },
  ],
  blocks: { steps: { min: 3, max: 10 }, faq: { min: 3, max: 6 } },
  length: { floor: 1200, ceiling: 2000 },
  research: true,
  packMustHold: [{ need: "facts_on_topic", min: 3 }, { need: "product_page" }],
};
