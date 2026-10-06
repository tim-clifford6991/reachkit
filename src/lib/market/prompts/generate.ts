// src/lib/market/prompts/generate.ts — the tracked buyer prompts, built from
// templates over the structured market (SPEC §6, owner D19 of 2026-10-03,
// #1162). The set measured in `docs/walk/d19-cost.md`, as product code.
//
// Pure: no I/O. The prompts are what the engines are asked, in a buyer's
// first person; they are shown to the founder as the questions tracked.
import { TRACKED_PROMPTS } from "@/lib/config/constants";

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

function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;
}

/** The buyer without its qualifying clause: "B2B SaaS founders and
 *  marketing leaders", not the sentence the conclusion stores. */
function buyerHead(buyer: string): string {
  return lowerFirst(clean(buyer).split(/\s+(?:whose|who|seeking|that|looking)\s+/)[0] ?? "");
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

/** What a buyer is constrained by, each asked of the market by name. The
 *  market's job is never quoted (issue 1285): it is the conclusion's own
 *  sentence, which no buyer types, and reachkit.app's ten such prompts
 *  asked for tools to "understand where AI and search send buyers". */
const USE_CASES: readonly ((name: string) => string)[] = [
  (name) => `Which ${name} tools work on a small budget?`,
  (name) => `Which ${name} tools can I use without hiring an agency?`,
  (name) => `Which ${name} tools suit a team of one?`,
  (name) => `Which ${name} tools can I set up in a single day?`,
  (name) => `Which ${name} tools need no engineering team?`,
  (name) => `Which ${name} tools work for a brand new website?`,
  (name) => `Which ${name} tools have a free trial?`,
];

/**
 * One site's set: 25 prompts where the market names a category, a buyer
 * and three rivals. A market with fewer than three synonyms asks its
 * category another way in their place. A market with less than that yields
 * fewer: no buyer or rival is invented, and no kind exceeds its share of
 * `TRACKED_PROMPTS.SPLIT`. Empty where the market names no category.
 */
export function generatePrompts(market: PromptMarket, siteName: string): GeneratedPrompt[] {
  const category = clean(market.category);
  if (category === "") return [];
  const buyer = buyerHead(market.buyer);
  const name = clean(siteName);
  const rivals = market.rivals.map((r) => clean(r.name) || r.domain);
  const out: GeneratedPrompt[] = [];
  const add = (kind: PromptKind, text: string): void => {
    if (out.filter((p) => p.kind === kind).length >= TRACKED_PROMPTS.SPLIT[kind]) return;
    if (!out.some((p) => p.text.toLowerCase() === text.toLowerCase())) out.push({ kind, text });
  };

  add("category", `What are the best ${category} tools right now, and what is each one good at?`);
  for (const synonym of market.synonyms.map(clean).filter(Boolean).slice(0, 3)) {
    add("category", `Which ${synonym} platforms do people actually recommend this year?`);
  }
  add("category", `I am new to ${category}. Which products should I look at first?`);
  // A market with fewer than three other names still asks its five (D19;
  // owner, 2026-10-06, issue 1281): the category itself, asked another way.
  add("category", `Which ${category} tools are worth paying for, and why?`);
  add("category", `Which ${category} products get the best reviews from the people who use them?`);
  add("category", `What ${category} software should a first-time buyer shortlist?`);

  // The market's names in turn, so the seven are not one phrase seven times.
  const spoken = [category, ...market.synonyms.map(clean).filter(Boolean).slice(0, 3)];
  USE_CASES.forEach((ask, i) => add("use-case", ask(spoken[i % spoken.length]!)));

  if (buyer !== "") {
    add("persona", `We are ${buyer}. Which ${category} tool fits us best?`);
    add("persona", `Which ${category} software is built for ${buyer}?`);
    add("persona", `What do ${buyer} actually use for ${category}?`);
    add("persona", `I work with ${buyer}. Which ${category} product should I recommend to them?`);
  }

  const [first, second, third] = rivals;
  if (first !== undefined && second !== undefined) {
    add("comparison", `How does ${first} compare with ${second} for ${category}?`);
  }
  if (first !== undefined) {
    add("comparison", `What are the best alternatives to ${first}${buyer === "" ? "" : ` for ${buyer}`}?`);
  }
  if (first !== undefined && second !== undefined && third !== undefined) {
    add("comparison", `${second} or ${third}: which is the better choice for ${category}?`);
    add("comparison", `Which is better value for ${category}: ${first}, ${second} or ${third}?`);
  }

  add("problem", `I am getting nowhere with ${category}. Which tools can fix that?`);
  add("problem", `Nothing I have tried for ${category} is working. What software should I try next?`);
  add("problem", `What is the fastest way to get results from ${category}, and which products do it for me?`);

  if (name !== "") {
    add("branded", `What is ${name}, and is it any good for ${category}?`);
    if (first !== undefined) add("branded", `Is ${name} a good alternative to ${first} for ${category}?`);
  }
  return out;
}
