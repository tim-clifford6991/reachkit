// SPEC §7 (D42, 4) — research: what ReachKit measured in this site's market.
import type { Template } from "./types";

export const research: Template = {
  type: "research",
  for: "Publish original data: what was measured in this business's market, with no other customer named and no other company's scan score.",
  titles: ["{Finding, with its number}: {market}, {month year}"],
  sections: [
    { key: "findings", task: "State the findings, each with its figure from `measurements`." },
    { key: "method", task: "Say how it was measured: the questions, the engines, the dates, and what is not measured." },
    { key: "data", task: "The data: after the opening paragraph, one GFM table of the measured figures.", block: "table" },
    { key: "meaning", task: "Say what it means for a buyer." },
    { key: "business", task: "Say where this business stands in the data, linking its product page." },
  ],
  blocks: { table: { rivals: 0 }, faq: { min: 3, max: 6 } },
  length: { floor: 1000, ceiling: 1600 },
  research: false,
  packMustHold: [{ need: "measured_questions", min: 10 }, { need: "changed_figures" }],
};
