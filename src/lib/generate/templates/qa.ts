// SPEC §7 (D42, 5) — Q&A.
import type { Template } from "./types";

export const qa: Template = {
  type: "qa",
  for: "Answer directly the questions buyers ask on one topic.",
  titles: ["{Topic}: {n} buyer questions, answered"],
  sections: [
    {
      key: "question",
      task: "One question from `questions`, as its heading, word for word or tidied: open with its answer in two or three sentences, then the detail.",
      repeat: { min: 5, max: 8 },
    },
    { key: "business", task: "Say how this business itself handles the topic, from its facts, linking its product page." },
  ],
  // The 5–8 questions are the page's FAQ data; it stores no others.
  blocks: { faq: null },
  length: { floor: 800, ceiling: 1400 },
  research: true,
  packMustHold: [{ need: "buyer_questions", min: 5 }, { need: "facts_on_topic", min: 5 }],
};
