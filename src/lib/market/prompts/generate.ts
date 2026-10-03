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
  job: string;
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

/** The job as a buyer says it of themselves, without its purpose clause:
 *  the conclusion stores it in the third person ("get their site …"). */
function jobHead(job: string): string {
  return lowerFirst(clean(job).split(/\s+so\s+|,/)[0] ?? "")
    .replace(/\btheir\b/g, "my")
    .replace(/\bthem\b/g, "me")
    .replace(/\bthey\b/g, "I");
}

const CONSTRAINTS = [
  "on a small budget",
  "without hiring an agency",
  "as a team of one",
  "within a single day of setup",
  "without an engineering team",
  "for a brand new website",
  "with a free trial",
] as const;

/**
 * One site's set: 25 prompts where the market names a category, a buyer, a
 * job, three synonyms and three rivals. A market with fewer yields fewer;
 * nothing is invented to fill a kind, and no kind exceeds its share of
 * `TRACKED_PROMPTS.SPLIT`. Empty where the market names no category.
 */
export function generatePrompts(market: PromptMarket, siteName: string): GeneratedPrompt[] {
  const category = clean(market.category);
  if (category === "") return [];
  const buyer = buyerHead(market.buyer);
  const job = jobHead(market.job);
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

  if (job !== "") for (const constraint of CONSTRAINTS) add("use-case", `Which tools help me ${job} ${constraint}?`);

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

  if (job !== "") {
    add("problem", `I am struggling to ${job}. Which tools can fix that?`);
    add("problem", `Nothing I have tried helps me ${job}. What software should I try next?`);
    add("problem", `What is the fastest way to ${job}, and which products do it for me?`);
  }

  if (name !== "") {
    add("branded", `What is ${name}, and is it any good for ${category}?`);
    if (first !== undefined) add("branded", `Is ${name} a good alternative to ${first} for ${category}?`);
  }
  return out;
}
