// src/lib/market/prompts/generate.ts — the tracked buyer prompts, built from
// templates over the structured market (SPEC §6, owner D19 of 2026-10-03,
// #1162). The set measured in `docs/walk/d19-cost.md`, as product code.
//
// Pure: no I/O. The prompts are what the engines are asked, in a buyer's
// first person; they are shown to the founder as the questions tracked.
import { TRACKED_PROMPTS } from "@/lib/config/constants";
import { LANGUAGE_PACKS, languagePack } from "@/lib/locale/language";
import type { Language, Place } from "@/lib/locale/locales";
import { withoutPlace } from "@/lib/locale/place";
import { BUSINESS_KINDS, BUSINESS_KIND_NAMES, DEFAULT_KIND, type BusinessKind } from "@/lib/market/kinds";

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
  /** The kind of business (D69). Absent is software: the set every site
   *  had before its kind was recorded. */
  kind?: BusinessKind;
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
 * 1311; `src/lib/locale/language/`); absent, it is English. And it is its
 * kind of business's own (owner D69, issue 1318): a plumber's buyer asks
 * about emergencies, cost and trust, not about a free trial.
 *
 * `place` is the one place the business serves (owner D67): its prompts
 * name it — "the best emergency plumber in Austin" — where its kind is one
 * that is bought in a place. The market's own names are said without it
 * first, since a searched term already holds it ("plumber austin").
 */
export function generatePrompts(market: PromptMarket, siteName: string, language: Language = "en", place?: Place): GeneratedPrompt[] {
  const kind = market.kind ?? DEFAULT_KIND;
  const wording = languagePack(language).prompts[kind];
  const said = (name: string): string => {
    const service = place === undefined ? clean(name) : clean(withoutPlace(clean(name), place));
    if (service === "") return "";
    const where = place !== undefined && BUSINESS_KINDS[kind].placed ? ` in ${place.name}` : "";
    return `${wording.named?.(service) ?? service}${where}`;
  };
  const category = said(market.category);
  if (category === "") return [];
  const others = [...new Set(market.synonyms.map(said).filter((name) => name !== "" && name.toLowerCase() !== category.toLowerCase()))];
  // The buyer is said without the place the market's name already says.
  const who = wording.buyerHead(market.buyer);
  const buyer = place !== undefined && BUSINESS_KINDS[kind].placed ? clean(withoutPlace(who, place)) : who;
  const name = clean(siteName);
  const rivals = market.rivals.map((r) => clean(r.name) || r.domain);
  const out: GeneratedPrompt[] = [];
  const add = (kind: PromptKind, text: string): void => {
    if (out.filter((p) => p.kind === kind).length >= TRACKED_PROMPTS.SPLIT[kind]) return;
    if (!out.some((p) => p.text.toLowerCase() === text.toLowerCase())) out.push({ kind, text });
  };

  add("category", wording.category.best(category));
  for (const synonym of others.slice(0, 3)) {
    add("category", wording.category.recommended(synonym));
  }
  add("category", wording.category.newTo(category));
  // A market with fewer than three other names still asks its five (D19;
  // owner, 2026-10-06, issue 1281): the category itself, asked another way.
  add("category", wording.category.worthPaying(category));
  add("category", wording.category.bestReviewed(category));
  add("category", wording.category.shortlist(category));

  // The market's names in turn, so the seven are not one phrase seven times
  // — for software. Any other kind's seven ask who can do a thing, and its
  // other names are often the thing done ("drain cleaning"), not who does
  // it: they are asked of its most-searched name alone (D69).
  const spoken = kind === DEFAULT_KIND ? [category, ...others.slice(0, 3)] : [category];
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
    // Every kind of business has its own wording (D69). A slot stands for
    // the market's name with its place, so one shape reads both.
    for (const kind of BUSINESS_KIND_NAMES) {
      for (const synonyms of [[], [`${SLOT}2`]]) {
        for (const prompt of generatePrompts({ category: SLOT, synonyms, buyer: SLOT, rivals, kind }, SLOT, pack.language)) {
          // The use cases are one template with seven endings.
          const text = clean(prompt.text).split(`${SLOT}2`).join(SLOT);
          shapes.set(text, prompt.kind === "use-case" ? prompt.kind : text);
        }
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
