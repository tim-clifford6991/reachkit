// src/lib/market/infer/infer.ts — ReachKit concludes a site's market and
// rivals from evidence (#1185; SPEC §0, §5 and §6, owner D28 of
// 2026-10-02).
//
// Two model calls through `llm()`, the one seam every model call's cost
// passes through. The first decides the market from the site's own words,
// with the measurements as a check. The second names the rivals **for that
// market**: the measurements were bought for whatever category the site was
// measured under, and a site measured in the wrong market has a top ten full
// of the wrong market's companies (reachkit.app, measured as "SEO software",
// #1159 and #1161). Asked together, the model took its rivals from those top
// tens; asked second, against the market it has just concluded, it judges
// each domain by the job it does. Only what survives `concludeRivals()` is
// a rival.
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { isOwnDomain, isPlatformDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { boundEvidence, evidenceDomains, type MarketEvidence } from "./evidence";
import { RIVALS_MAX, type MarketConclusion, type RivalBasis, type RivalConclusion } from "./types";

function bounded(min: number, max: number) {
  return z.preprocess(
    (value) => (Array.isArray(value) && value.length > max ? value.slice(0, max) : value),
    z.array(z.string()).min(min).max(max)
  );
}

export const MARKET_SCHEMA = z.strictObject({
  buyer: z.string().min(1),
  job: z.string().min(1),
  category: z.string().min(1),
  synonyms: bounded(2, 4),
  differentiators: bounded(1, 5),
  notOurMarket: bounded(1, 6),
  categoryReason: z.string().min(1),
});

export type MarketAnswer = z.infer<typeof MARKET_SCHEMA>;

export const MARKET_TASK = [
  "You decide which market a business is in.",
  "The site's own words decide it: its headline (the home page's title and first heading) says what it leads with, then its other pages, products and claims. The rest of the evidence — the AI answers measured (each question and the domains its answers cited), the domains in the measured Google top tens, and the searches the site ranks for — was bought for the category named in measuredUnder, which was an earlier guess and may be wrong. Use those measurements to confirm a market, never to override what the site says it does.",
  "The category is named by the outcome the buyer pays for, as the headline states it first, in the words a buyer would search — never by the method the product uses to get there (writing, scanning, automating, a dashboard), which is a differentiator. Prefer the specific category the site's own words support over a broad head category. notOurMarket is adjacent categories whose buyers want a different outcome from this business's buyers — never a category this business itself belongs to, however broad. measuredUnder goes on notOurMarket only when that is true of it.",
  "Every reason is one short plain sentence a founder can read.",
].join(" ");

export const MARKET_FIELDS = Object.freeze({
  buyer: "one string: who buys this, as specifically as the evidence allows",
  job: "one string: the job the buyer hires the product for",
  category: "one string: the category, 2-5 words, in a buyer's search words",
  synonyms:
    "2 to 4 short strings: the established names buyers and vendors use for this same category, each 2-4 words, as a buyer would type it into a search box",
  differentiators: "1 to 5 short strings: what this business does that its rivals do not, from its own pages",
  notOurMarket: "1 to 6 short strings: adjacent categories buyers might confuse this with, whose buyers want a different outcome",
  categoryReason: "one sentence: why this category, citing the evidence",
});

const KINDS = ["product", "publisher", "aggregator", "platform", "agency", "other"] as const;
const BASES = ["ai_answer", "ranks", "same_job"] as const;

/** The second answer. Every candidate carries a `kind` and whether its
 *  main product is in the market, so a publisher or a head-category suite
 *  the model mentions is visible here and dropped, never trusted. */
export const RIVALS_SCHEMA = z.strictObject({
  candidates: z.preprocess(
    (value) => (Array.isArray(value) && value.length > 10 ? value.slice(0, 10) : value),
    z
      .array(
        z.strictObject({
          domain: z.string(),
          name: z.string(),
          // D50: optional, so an answer without it is still an answer.
          searchName: z.string().optional(),
          otherSearches: z.boolean().optional(),
          kind: z.enum(KINDS),
          inMarket: z.boolean(),
          basis: z.enum(BASES),
          reason: z.string(),
        })
      )
      .max(10)
  ),
});

export type RivalsAnswer = z.infer<typeof RIVALS_SCHEMA>;

export const RIVALS_TASK = [
  "You name a business's real competitors in the market given.",
  "A competitor is a company whose main product is this category, sold to this buyer for this job — closest first, at a broadly similar scale where you can tell. Name the real companies in this market from your knowledge of it.",
  "The measured domains were bought for measuredUnder, an earlier guess at the market, so most of them may sell something else. A measured domain is a candidate only when its main product is this market's category; then its basis is ai_answer if an AI answer cited it, or ranks if it is in the top tens. An answer's excerpt is what an AI assistant told a buyer in this market: a product it names there is a candidate with basis ai_answer. A company you name from knowledge has basis same_job.",
  "inMarket is false for a company whose main product is a category on notOurMarket, even when it has a feature in this market, and for a company best known for a product outside this market unless what it sells here has a product name of its own, which is then the name. A publisher, blog, review site, directory, marketplace, forum, social network, agency or general platform is never a competitor: give it its kind if you list it at all. Never list the business itself.",
  "name is the product as buyers say it. otherSearches is true where most people who type that bare name into Google want something else: the name is a dictionary word (\"Linear\", \"Notion\", \"Amplitude\"), or the company is best known for a product outside this market. searchName is what a buyer types to find this product in this market: the name in lower case, with one word added where otherSearches is true — the word buyers really add, such as the one in its domain or its product line (\"linear app\", \"notion calendar\") — never a description of what it does.",
  "Each reason is one short plain sentence a founder can read: what the company sells and why it competes.",
].join(" ");

export const RIVALS_FIELDS = Object.freeze({
  candidates:
    "up to 10 objects {domain, name, searchName, otherSearches, kind, inMarket, basis, reason}: domain is the company's own website; searchName is the name in lower case plus at most one word; otherSearches is a boolean; kind one of product|publisher|aggregator|platform|agency|other; basis one of ai_answer|ranks|same_job",
});

/** The rivals from one checked answer: products in the market only —
 *  never a source, never the site itself, never a domain that is not a
 *  domain — deduplicated, in the model's order, at most five. An
 *  `ai_answer` or `ranks` basis the evidence does not bear out is restated
 *  as `same_job`, so a reason never claims a sighting that did not
 *  happen. */
export function concludeRivals(
  answer: RivalsAnswer,
  evidence: MarketEvidence,
  max: number = RIVALS_MAX
): RivalConclusion[] {
  const seen = evidenceDomains(evidence);
  // An answer names products it does not link (#1195): a name read in an
  // answer's excerpt is a sighting too.
  const said = evidence.answers.map((a) => (a.excerpt ?? "").toLowerCase()).join(" ");
  const named = (name: string): boolean => name.trim().length >= 3 && said.includes(name.trim().toLowerCase());
  const rivals: RivalConclusion[] = [];
  const taken = new Set<string>();
  for (const candidate of answer.candidates) {
    if (rivals.length >= max) break;
    if (candidate.kind !== "product" || !candidate.inMarket) continue;
    const domain = registrableDomain(candidate.domain);
    if (domain === null || taken.has(domain)) continue;
    if (isOwnDomain(domain, evidence.domain) || isPlatformDomain(domain)) continue;
    const sighted = seen.has(domain) || (candidate.basis === "ai_answer" && named(candidate.name));
    const basis: RivalBasis = candidate.basis !== "same_job" && !sighted ? "same_job" : candidate.basis;
    taken.add(domain);
    // D50: the keywords its brand is searched under — its name, unless
    // that mostly means something else, and what a buyer adds to it.
    const spelt = (text: string): string => text.replace(/\s+/g, " ").trim().toLowerCase();
    const bare = spelt(candidate.name);
    const said = spelt(candidate.searchName ?? "");
    // A longer answer ("acme ai visibility") is also read at its first
    // added word ("acme ai"), which is the form buyers type.
    const added = said.startsWith(`${bare} `) ? said.slice(bare.length + 1).split(" ") : [];
    const short = added.length > 1 ? `${bare} ${added[0]}` : "";
    // Only a one-word name can mean something else on its own: "peec ai"
    // is already the qualified form.
    const ambiguous = candidate.otherSearches === true && !bare.includes(" ");
    const searchNames = [...new Set([bare, said, short])].filter(
      (keyword) => keyword !== "" && !(ambiguous && keyword === bare)
    );
    rivals.push({
      domain,
      name: candidate.name.trim() || domain,
      basis,
      reason: candidate.reason.trim(),
      searchNames,
    });
  }
  return rivals;
}

/** The market from one checked answer, every string trimmed. */
export function concludeMarket(answer: MarketAnswer): Omit<MarketConclusion, "rivals"> {
  const list = (items: readonly string[]): string[] => items.map((s) => s.trim()).filter(Boolean);
  return {
    buyer: answer.buyer.trim(),
    job: answer.job.trim(),
    category: answer.category.trim(),
    synonyms: list(answer.synonyms),
    differentiators: list(answer.differentiators),
    notOurMarket: list(answer.notOurMarket),
    categoryReason: answer.categoryReason.trim(),
  };
}

/** The first call: the market, from the site's own words. An answer that
 *  did not come back is handed back unmeasured — no default market is ever
 *  made up in its place. */
export async function inferMarketFields(
  c: CostContext,
  e: MarketEvidence
): Promise<Measured<Omit<MarketConclusion, "rivals">>> {
  const evidence = boundEvidence(e);
  const answer = await llm(c, {
    site: "market-inference",
    input: { task: MARKET_TASK, fields: MARKET_FIELDS, evidence },
    schema: MARKET_SCHEMA,
    tier: "haiku",
  });
  if (answer.kind === "unmeasured") return unmeasured(answer.reason, answer.at, answer.because);
  return measured(concludeMarket(answer.value), answer.at);
}

/** The second call: the rivals for `market`, from the measured AI answers
 *  and top tens and the model's knowledge of the market, checked by
 *  `concludeRivals`. Up to `max` of them, closest first. */
export async function inferRivals(
  c: CostContext,
  e: MarketEvidence,
  market: Omit<MarketConclusion, "rivals">,
  max: number = RIVALS_MAX
): Promise<Measured<RivalConclusion[]>> {
  const evidence = boundEvidence(e);
  const answer = await llm(c, {
    site: "rival-inference",
    input: {
      task: RIVALS_TASK,
      fields: RIVALS_FIELDS,
      business: { domain: evidence.domain, siteName: evidence.siteName },
      market,
      measuredUnder: evidence.measuredUnder,
      measured: { answers: evidence.answers, topTens: evidence.topTens },
    },
    schema: RIVALS_SCHEMA,
    tier: "haiku",
  });
  if (answer.kind === "unmeasured") return unmeasured(answer.reason, answer.at, answer.because);
  return measured(concludeRivals(answer.value, evidence, max), answer.at);
}

/** Both calls in turn, at the `haiku` tier, under the caller's cap — what
 *  setup and the offline proof ask for. Rivals that did not come back
 *  leave the market standing with none, which a caller reads as "keep the
 *  rivals you have". */
export async function inferMarket(c: CostContext, e: MarketEvidence): Promise<Measured<MarketConclusion>> {
  const market = await inferMarketFields(c, e);
  if (market.kind === "unmeasured") return unmeasured(market.reason, market.at, market.because);
  const rivals = await inferRivals(c, e, market.value);
  return measured({ ...market.value, rivals: rivals.kind === "unmeasured" ? [] : rivals.value }, market.at);
}
