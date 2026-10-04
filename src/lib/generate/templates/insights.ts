// SPEC §7 (D42, 6) — current insights.
import type { Template } from "./types";

export const insights: Template = {
  type: "insights",
  for: "Tell the reader what changed in the market lately, each change dated and sourced.",
  titles: ["{Market}: what changed in {month year}"],
  sections: [
    { key: "in_short", task: "Say what changed, in short." },
    {
      key: "change",
      task:
        "One change from a claim in `pack.claims` whose `kind` is `recent`: what happened, when — its `publishedAt` written out as a date — who published it (`source`), linked to its `url`, and what it means.",
      repeat: { min: 3, max: 5 },
    },
    { key: "what_to_do", task: "Say what the reader should do now." },
    { key: "business", task: "Say how this business responds, from its facts, linking its product page." },
  ],
  blocks: { faq: { min: 3, max: 6 }, datedSources: true },
  length: { floor: 700, ceiling: 1200 },
  research: true,
  packMustHold: [{ need: "recent_results", min: 3, days: 30 }],
};
