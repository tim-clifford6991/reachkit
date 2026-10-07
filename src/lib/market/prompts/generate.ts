// src/lib/market/prompts/generate.ts — the tracked buyer prompts, built from
// templates over the structured market (SPEC §6, owner D19 of 2026-10-03,
// #1162). The set measured in `docs/walk/d19-cost.md`, as product code.
//
// Pure: no I/O. The prompts are what the engines are asked, in a buyer's
// first person; they are shown to the founder as the questions tracked.
import { TRACKED_PROMPTS } from "@/lib/config/constants";
import { LANGUAGE_PACKS, languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";

export type PromptKind = keyof typeof TRACKED_PROMPTS.SPLIT;

export const PROMPT_KINDS = Object.freeze(Object.keys(TRACKED_PROMPTS.SPLIT) as PromptKind[]);

export interface GeneratedPrompt {
  kind: PromptKind;
  text: string;
}

/** The market's members a prompt is built from — `MarketConclusion`'s own,
 *  named structurally so this file imports nothing from the market leaf. */
export interface PromptMarket {
  category: string;
  synonyms: readonly string[];
  buyer: string;
  rivals: readonly { name: string; domain: string }[];
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
}

/** The name a branded prompt asks about and an answer is read for: the
 *  site's own where it is a name, else the domain's first label. A title
 *  that is a sentence is not a name an answer would repeat. */
export function promptSiteName(siteName: string | null, domain: string): string {
  const name = (siteName ?? "").trim();
  if (name !== "" && name.length <= 40 && name.split(/\s+/).length <= 4) return name;
  const label = domain.toLowerCase().replace(/^www\./, "").split(".")[0] ?? domain;
  return label.length === 0 ? domain : label[0]!.toUpperCase() + label.slice(1);
}

/**
 * One site's set: 25 prompts where the market names a category, a buyer
 * and three rivals. A market with fewer than three synonyms asks its
 * category another way in their place. A market with less than that yields
 * fewer: no buyer or rival is invented, and no kind exceeds its share of
 * `TRACKED_PROMPTS.SPLIT`. Empty where the market names no category.
 *
 * The wording is the site's language's own (SPEC §6, owner D66, issue
 * 1311; `src/lib/locale/language/`); absent, it is English.
 */
export function generatePrompts(market: PromptMarket, siteName: string, language: Language = "en"): GeneratedPrompt[] {
  const wording = languagePack(language).prompts;
  const category = clean(market.category);
  if (category === "") return [];
  const buyer = wording.buyerHead(market.buyer);
  const name = clean(siteName);
  const rivals = market.rivals.map((r) => clean(r.name) || r.domain);
  const out: GeneratedPrompt[] = [];
  const add = (kind: PromptKind, text: string): void => {
    if (out.filter((p) => p.kind === kind).length >= TRACKED_PROMPTS.SPLIT[kind]) return;
    if (!out.some((p) => p.text.toLowerCase() === text.toLowerCase())) out.push({ kind, text });
  };

  add("category", wording.category.best(category));
  for (const synonym of market.synonyms.map(clean).filter(Boolean).slice(0, 3)) {
    add("category", wording.category.recommended(synonym));
  }
  add("category", wording.category.newTo(category));
  // A market with fewer than three other names still asks its five (D19;
  // owner, 2026-10-06, issue 1281): the category itself, asked another way.
  add("category", wording.category.worthPaying(category));
  add("category", wording.category.bestReviewed(category));
  add("category", wording.category.shortlist(category));

  // The market's names in turn, so the seven are not one phrase seven times.
  const spoken = [category, ...market.synonyms.map(clean).filter(Boolean).slice(0, 3)];
  wording.useCases.forEach((ask, i) => add("use-case", ask(spoken[i % spoken.length]!)));

  if (buyer !== "") {
    for (const ask of wording.persona) add("persona", ask(buyer, category));
  }

  const [first, second, third] = rivals;
  if (first !== undefined && second !== undefined) {
    add("comparison", wording.comparison.compare(first, second, category));
  }
  if (first !== undefined) {
    add("comparison", wording.comparison.alternatives(first, buyer));
  }
  if (first !== undefined && second !== undefined && third !== undefined) {
    add("comparison", wording.comparison.better(second, third, category));
    add("comparison", wording.comparison.value(category, first, second, third));
  }

  for (const ask of wording.problem) add("problem", ask(category));

  if (name !== "") {
    add("branded", wording.branded.what(name, category));
    if (first !== undefined) add("branded", wording.branded.alternative(name, first, category));
  }
  return out;
}

const SLOT = "\u0001";

/** Every prompt shape `generatePrompts` can write, each with its slots open.
 *  Built from the set itself — once with no other name for the market and
 *  once with one, which between them write every shape — so a template added
 *  above is known here without a second list. */
const SHAPES: readonly { template: string; shape: RegExp }[] = (() => {
  const rivals = [1, 2, 3].map(() => ({ name: SLOT, domain: SLOT }));
  const shapes = new Map<string, string>();
  for (const pack of LANGUAGE_PACKS) {
    for (const synonyms of [[], [SLOT]]) {
      for (const prompt of generatePrompts({ category: SLOT, synonyms, buyer: SLOT, rivals }, SLOT, pack.language)) {
        // The use cases are one template with seven endings.
        shapes.set(clean(prompt.text), prompt.kind === "use-case" ? prompt.kind : clean(prompt.text));
      }
    }
  }
  return [...shapes].map(([text, template]) => ({
    template,
    shape: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").split(SLOT).join(".+")}$`, "i"),
  }));
})();

/**
 * The prompt template a question is written from, or `null` where it is
 * from none (SPEC §7, owner D61; issue 1295). The tracked prompts are
 * templated so they can be measured (D19); a page that asks one template
 * twice asks one question twice.
 */
export function promptTemplateOf(question: string): string | null {
  const text = clean(question);
  return SHAPES.find((each) => each.shape.test(text))?.template ?? null;
}
