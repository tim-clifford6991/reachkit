// src/lib/generate/templates/de.ts — the templates' words for a German page
// (SPEC §7 D51 titles; SPEC §6, owner D66, issue 1311).
//
// A template's sections and tasks are instructions to the writer and are the
// same for every language: the writer is told the page's language once
// (`pack.locale`). What a language has of its own is here: the title
// formulas, whose fixed words are German words, what a title never does,
// and the rules a German page follows beside the house rules.
//
// Drafted wording (issue 759): the pull request lists every formula.
import type { TemplateWords } from "./types";

export const DE_TEMPLATES: TemplateWords = {
  titles: {
    listicle: {
      titles: [
        "Die {N} besten {term} für {audience} ({year})",
        "{A} vs. {B} ({year}): {Kriterien oder für wen es passt}",
        // D50: where the search names two rivals, this business is the third.
        "{A} vs. {B} vs. {dieses Unternehmen} ({year}): {Kriterien}",
        "{N} Alternativen zu {rival} für {audience} ({year})",
      ],
      titleNever: 'Never name this business as "Nr. 1", "Nummer 1" or "beste", "bester", "bestes".',
    },
    how_to: { titles: ["So gelingt {outcome in the buyer's words}", "{outcome in the buyer's words}: Schritt für Schritt erklärt"] },
    documentation: { titles: ["Was ist {term}? {plain qualifier}"] },
    research: { titles: ["{finding with its number}: {scope} ({year})"] },
    qa: { titles: ["The buyer's question as typed, in German"] },
    insights: { titles: ["{platform} {change} ({Monat Jahr}): Was das für {audience} bedeutet"] },
    update: { titles: ["The live page's own title."] },
  },
  rules: [
    "Write the whole page in German: the title, the heading, the description, every section, takeaway and FAQ entry, and the slug. Address the reader as the business's own pages and `voice` do, with \"Sie\" or with \"du\"; where they do not show, use \"Sie\", and never mix the two.",
    "Where a rule asks for sentence case, write German capitalisation: nouns and the first word keep their capital and nothing else has one.",
    "Quote a fact in the words and the language its page states it in. Write prices, dates and numbers as German does (\"1.299 €\", \"3. Mai 2026\") without changing a figure or its currency.",
    "In `slug`, write ä, ö, ü and ß as ae, oe, ue and ss.",
  ],
};
