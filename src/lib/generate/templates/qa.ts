// SPEC §7 (D42, 5) — Q&A.
import { CITES_MARKET } from "@/lib/config/constants";
import type { Template } from "./types";

export const qa: Template = {
  type: "qa",
  // Issue 1486: answered from cited outside facts; the business is one section.
  for: "Answer directly the questions buyers ask on one topic, each from the fact that answers it — the outside sources in `pack.claims` first where it holds them, the platform's or authority's own documentation (`primary`) before others — and say how this business handles the topic in its own one section.",
  // Issue 1389: the question where the search is one, else its answer.
  titles: ["{The buyer's question as typed} {its answer's number, price or place from pack}", "{the search as typed}: {the answer's number, price or place from pack}"],
  sections: [
    {
      key: "question",
      task: "One question from `questions`, as its heading, word for word or tidied into the question a buyer asks; each section takes a different one, and no two headings share their opening or most of their words: open with its answer in two or three sentences, then the detail. Each has a fact in the pack that answers it: answer from that fact, linking a claim's `url` where a claim from `pack.claims` answers it, and never write that a question cannot be answered.",
      repeat: { min: 5, max: 8 },
    },
    { key: "business", task: "Say how this business itself handles the topic, from its facts, linking its product page." },
  ],
  // The 5–8 questions are the page's FAQ data; it stores no others.
  blocks: { faq: null },
  length: { floor: 800, ceiling: 1400 },
  research: true,
  packMustHold: [{ need: "buyer_questions", min: 5 }, { need: "facts_on_topic", min: 5 }, { need: "outside_sources", min: CITES_MARKET.min }],
};
