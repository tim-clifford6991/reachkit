// src/lib/market/questions/buyer-prompts.ts — the questions a buyer in the
// site's market asks an AI assistant, built from templates over the
// structured market (#1159, #1162's design, D19), asked by a paid pass
// beside the twelve so its rivals are concluded from answers in the market
// it measures (#1195).
//
// Pure: no I/O. The prompts are what the engines are asked, never a
// customer-visible sentence, and they are never counted in the score — the
// twelve stay the AI measure until D19 takes effect (§6).
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import type { MarketConclusion } from "@/lib/market/infer/types";

type Market = Pick<MarketConclusion, "category" | "synonyms" | "buyer" | "job" | "rivals">;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
}

/**
 * Up to `max` prompts, in the order they are worth asking: the category,
 * each synonym, the buyer's own case, the job, then an alternative to each
 * standing rival. Distinct by wording; empty where the market names no
 * category.
 */
export function buyerPrompts(market: Market, max: number, language: Language = "en"): string[] {
  const wording = languagePack(language).buyerPrompts;
  const category = clean(market.category);
  if (category === "" || max <= 0) return [];
  const out: string[] = [];
  const add = (prompt: string): void => {
    if (!out.some((held) => held.toLowerCase() === prompt.toLowerCase())) out.push(prompt);
  };
  add(wording.best(category));
  for (const synonym of market.synonyms.map(clean).filter(Boolean)) add(wording.best(synonym));
  const buyer = clean(market.buyer);
  if (buyer !== "") add(wording.forBuyer(category, buyer));
  const job = clean(market.job);
  if (job !== "") add(wording.job(job));
  for (const rival of market.rivals) add(wording.alternatives(clean(rival.name) || rival.domain));
  return out.slice(0, max);
}
