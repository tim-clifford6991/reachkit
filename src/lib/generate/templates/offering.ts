// SPEC §7 (D42; owner ruling B6, 2026-10-19) — offering: the business's own
// service or product page, for a search whose results are such pages.
import type { Template } from "./types";

export const offering: Template = {
  type: "offering",
  // The business's own offer, so no outside source is required.
  for: "Say what this business offers for this search, from its own facts in `facts` and `profile.knowledge` only — what it is and who it is for, what is included, its price or how it is priced, where and when, how it works and why this business — and point the reader to the one action.",
  titles: ["{the offering in the search's words}: {its price, hours or place from pack}"],
  titleNever: "Never name a place the business's own pages do not state it serves.",
  sections: [
    { key: "what", task: "Say what the offering is and who it is for, in the search's words, from the business's facts." },
    { key: "included", task: "List what the offering includes, from the business's facts only." },
    { key: "price", task: "State the price as the business's own pages state it, linking that page, or how it is priced where they give no figure. Never estimate a price." },
    {
      key: "where_when",
      task: "Say where and when the business offers it: the one place and the hours its own pages state. Leave this section out where they state neither.",
      repeat: { min: 0, max: 1 },
    },
    {
      key: "how_it_works",
      task: "How it works: after the opening paragraph, a numbered list of what the buyer does and what the business then does, from the business's facts.",
      block: "steps",
    },
    { key: "why", task: "Say why this business, from its stated differences in `profile.knowledge` only: no reviews, ratings, awards or counts its own pages do not state." },
  ],
  blocks: { steps: { min: 3, max: 6 }, faq: { min: 3, max: 6 } },
  length: { floor: 500, ceiling: 1200 },
  // Read for what buyers ask beside the search, for the FAQ.
  research: true,
  packMustHold: [{ need: "own_price" }, { need: "facts_on_topic", min: 4 }],
};
