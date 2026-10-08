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
import type { Language, Place } from "@/lib/locale/locales";
import { withoutPlace } from "@/lib/locale/place";
import { BUSINESS_KINDS, DEFAULT_KIND } from "@/lib/market/kinds";
import type { MarketConclusion } from "@/lib/market/infer/types";

type Market = Pick<MarketConclusion, "category" | "synonyms" | "buyer" | "job" | "rivals" | "kind">;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
}

/**
 * Up to `max` prompts, in the order they are worth asking: the category,
 * each synonym, the buyer's own case, the job, then an alternative to each
 * standing rival. Distinct by wording; empty where the market names no
 * category.
 */
export function buyerPrompts(market: Market, max: number, language: Language = "en", place?: Place): string[] {
  const kind = market.kind ?? DEFAULT_KIND;
  const out: string[] = [];
  const add = (prompt: string): void => {
    if (!out.some((held) => held.toLowerCase() === prompt.toLowerCase())) out.push(prompt);
  };
  // D69 (issue 1318): a business that is not software is asked about as
  // its tracked prompts ask — and where it serves, where it serves one
  // place (D67).
  if (kind !== DEFAULT_KIND) {
    const tracked = languagePack(language).prompts[kind];
    const said = (name: string): string => {
      const service = place === undefined ? clean(name) : clean(withoutPlace(clean(name), place));
      if (service === "") return "";
      return `${tracked.named?.(service) ?? service}${place !== undefined && BUSINESS_KINDS[kind].placed ? ` in ${place.name}` : ""}`;
    };
    const named = said(market.category);
    if (named === "" || max <= 0) return [];
    add(tracked.category.best(named));
    for (const synonym of market.synonyms.map(said).filter(Boolean)) add(tracked.category.recommended(synonym));
    const who = tracked.buyerHead(market.buyer);
    if (who !== "") add(tracked.persona[1]!(who, named));
    add(tracked.category.shortlist(named));
    for (const rival of market.rivals) add(tracked.comparison.alternatives(clean(rival.name) || rival.domain, ""));
    return out.slice(0, max);
  }
  const wording = languagePack(language).buyerPrompts;
  const category = clean(market.category);
  if (category === "" || max <= 0) return [];
  add(wording.best(category));
  for (const synonym of market.synonyms.map(clean).filter(Boolean)) add(wording.best(synonym));
  const buyer = clean(market.buyer);
  if (buyer !== "") add(wording.forBuyer(category, buyer));
  const job = clean(market.job);
  if (job !== "") add(wording.job(job));
  for (const rival of market.rivals) add(wording.alternatives(clean(rival.name) || rival.domain));
  return out.slice(0, max);
}
