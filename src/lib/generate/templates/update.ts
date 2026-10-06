// SPEC §7 (D42, 7) — update: a live page refreshed at the same address.
//
// Its sections are the live page's own, in its type's order, so `sections`
// is one repeated slot: the writer returns every section of the live page
// under its own heading and rewrites only those a new fact touches.
import type { Template } from "./types";

export const update: Template = {
  type: "update",
  for: "Refresh a live page at the same address: keep what still holds, and rewrite only a section a new fact changes.",
  // D51: code keeps the live title and moves its year (`../pipeline/compose.ts`).
  titles: ["The live page's own title."],
  sections: [
    {
      key: "live",
      task: "One section of the live page, under its own heading and in its own place. Return it as it stands unless a new fact changes what it says.",
      repeat: { min: 2, max: 12 },
    },
  ],
  blocks: { faq: { min: 3, max: 6 } },
  length: { withinShareOfLive: 0.2 },
  research: true,
  packMustHold: [{ need: "live_page" }, { need: "new_fact", min: 1 }],
};
