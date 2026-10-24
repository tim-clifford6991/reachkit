// SPEC §7 (D42; owner ruling B6, 2026-10-19) — offering: the business's own
// service or product page, for a search whose results are such pages.
// E10 (2026-10-24): it carries, in this order, only the sections its stored
// facts support; the short answer leads, the questions and the guides follow.
import type { Template } from "./types";

const SEARCH_WORDS = "Headings are written in the search's words.";

export const offering: Template = {
  type: "offering",
  // The business's own offer, so no outside source is required.
  for: `Say what this business offers for this search, from its own facts in \`facts\` and \`profile.knowledge\` only — what it is and who it is for, its price or how it is priced, and each other section \`template.sections\` holds — and point the reader to the one action. ${SEARCH_WORDS}`,
  titles: ["{the offering in the search's words}: {its price or a place from pack}"],
  titleNever: "Never name a place the business's own pages do not state it serves. Never state opening hours, days or availability times; the business has no stored hours fact.",
  sections: [
    { key: "what", task: `Say what the offering is and who it is for, from the business's facts. ${SEARCH_WORDS}` },
    {
      key: "included",
      task: `List what the offering includes, from the offerings' features in \`profile.knowledge\` only. ${SEARCH_WORDS}`,
      onlyWith: { facts: "inclusions", min: 2 },
    },
    {
      key: "price",
      task: `State the price as the business's own pages state it, linking that page, or how it is priced where they give no figure. Never estimate a price. ${SEARCH_WORDS}`,
    },
    {
      key: "where_when",
      task: `Say where the business offers it: open with one sentence that it serves the places below; then a bulleted list of the places in \`profile.knowledge.places\` read from its own pages, one place an item, word for word, and no other. Its heading asks where only. ${SEARCH_WORDS}`,
      onlyWith: { facts: "places", min: 1 },
    },
    {
      key: "how_it_works",
      task: `How it works: after the opening paragraph, a numbered list of what the buyer does and what the business then does, each step stated by the business's facts. Leave this section out where the facts state fewer than three steps. ${SEARCH_WORDS}`,
      block: "steps",
      repeat: { min: 0, max: 1 },
    },
    {
      key: "why",
      task: `Say why this business, from its stated differences in \`profile.knowledge\` and its \`profile.promises\` only: no reviews, ratings, awards or counts its own pages do not state. ${SEARCH_WORDS}`,
      onlyWith: { facts: "difference", min: 1 },
    },
  ],
  blocks: { steps: { min: 3, max: 6 }, faq: { min: 3, max: 6, asked: true } },
  length: { floor: 500, ceiling: 1200 },
  // No outside read: its questions are the stored search's "People also ask".
  research: false,
  packMustHold: [{ need: "own_price" }, { need: "facts_on_topic", min: 4 }],
};
