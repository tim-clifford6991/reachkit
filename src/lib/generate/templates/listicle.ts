// SPEC §7 (D42, 1) — listicle / comparison.
import type { Template } from "./types";

export const listicle: Template = {
  type: "listicle",
  for: "Help a buyer choose among options, with this business as an honest row: what the options are, what distinguishes them, and which case each one suits.",
  // D51: a listicle, a comparison of named products, or an alternatives page.
  titles: [
    "{N} best {term} for {audience} ({year})",
    "{A} vs {B} ({year}): {criteria or who it fits}",
    // D50: where the search names two rivals, this business is the third.
    "{A} vs {B} vs {this business} ({year}): {criteria}",
    "{N} {rival} alternatives for {audience} ({year})",
  ],
  titleNever: "Never name this business as \"#1\" or \"best\".",
  sections: [
    { key: "what_to_look_for", task: "Say what a buyer should look for when choosing, criterion by criterion." },
    {
      key: "at_a_glance",
      task: "The options at a glance: one opening paragraph saying what `table` compares and how to read it, then what stands out between the options. Write no table — `table` is placed under your opening paragraph as it is.",
      block: "table",
    },
    // D52: the page says how it compared, and the line under `table` dates it.
    {
      key: "how_we_compared",
      task: "Say in a few sentences how these options were compared: from each option's own pricing and product pages, read on the dates the sources list gives, and on the criteria above. Say plainly that the products were not tried or tested. This section is short and may run under the length asked of the others.",
    },
    {
      key: "option",
      task: "One option: what it does, its price, who it suits, and one limit — each from a fact about that product.",
      repeat: { min: 3, max: 6 },
    },
    // D52: the verdict is honest about where the business is not the pick.
    {
      key: "which_to_choose",
      task: "The verdict: say which option to choose for which case, and name at least one case where a rival, by its name, is the better pick than this business — from a fact about that rival.",
    },
    { key: "business", task: "Say how this business itself handles the question, from its facts, linking its product and pricing pages." },
  ],
  blocks: { table: { rivals: 2 }, faq: { min: 3, max: 6 } },
  length: { floor: 1500, ceiling: 2500 },
  research: true,
  packMustHold: [{ need: "options", min: 3 }, { need: "own_price" }, { need: "difference" }],
};
