// SPEC §7 (D42, 3) — documentation. No research call.
import type { Template } from "./types";

export const documentation: Template = {
  type: "documentation",
  for: "Be the reference page on one feature or concept this business's knowledge base covers.",
  // Issue 1389: a statement that answers; the question only where the search is one.
  titles: ["{Term}: {what it is, with one number, price or place from pack}", "What is {term}? {the answer, with one number, price or place from pack}"],
  sections: [
    { key: "what_it_is", task: "Say what it is." },
    { key: "how_it_works", task: "Say how it works." },
    { key: "options_and_limits", task: "State its options and limits; where there are two or more options, plans or limits, set them in a GFM table." },
    { key: "example", task: "Give one example, from the facts only." },
    { key: "related", task: "Name the related features, linking the pages in `links` that cover them." },
  ],
  blocks: { faq: { min: 3, max: 6 } },
  length: { floor: 800, ceiling: 1500 },
  research: false,
  packMustHold: [{ need: "facts_on_topic", min: 4 }],
};
