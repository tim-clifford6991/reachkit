// SPEC §7 (2026-10-04, D41 stage 2) — the context pack.
//
// One JSON object per page: everything the writer is handed, and nothing
// else it may write from. It is stored with the draft (`drafts.meta.pack`),
// shown on the draft screen under *written from your business*, and cached
// on disk by `npm run page` (D43) — so a page can always be read beside
// what it was written from.
//
// It holds the knowledge base and the founder's answers with the never-claim
// list, the market and the rivals, the target question, every published and
// planned page of the site, the business facts read off the site's own
// pages, the research claims with their addresses and read dates, and — by
// type — the questions buyers were recorded asking, what the latest pass
// measured, the web results of the last 30 days, or the live page an update
// refreshes.
//
// **Code then holds the pack against the template's *pack must hold* line**
// (`missingFrom`). A pack short of it writes nothing: the page stops, naming
// what is missing by its handle. And **what a new page adds** (D12, issue
// 1143) is counted here, over the pack, before the write call: the facts
// whose words are on none of the top results the research step read.
//
// Pure. The reads are the caller's (`../index.ts`, `scripts/page/`).
import { ADDS, PACK } from "@/lib/config/constants";
import type { ContentType } from "@/lib/opportunities/content-type";
import type { SitePage } from "@/lib/opportunities/site-pages";
import type { Opportunity } from "@/lib/opportunities/types";
import type { StoredReport } from "@/lib/scan/report";
import type { LinkTarget } from "../links/select";
import { TEMPLATES, type PackNeed, type PackRequirement } from "../templates";
import type { PromptKnowledge, PromptProfile } from "../voice/profile-block";
import type { SourcedFact } from "./grounding";
import type { MarketFact, MarketResearch, ResearchedProduct } from "./research";

export interface PackFact {
  passage: string;
  url: string;
  readAt: string;
  /** A measurement of the report's own (issue 1163), not a page of theirs. */
  report?: true;
}

export interface PackClaim {
  passage: string;
  url: string;
  title: string;
  readAt: string;
  kind: MarketFact["kind"];
  product?: string;
  publishedAt?: string;
  /** Who published a `recent` page, as the news search names it (D48). */
  source?: string;
}

/** What the latest complete pass measured, as a research page states it. */
export interface PackMeasurements {
  measuredAt: string;
  score: number | null;
  engines: string[];
  /** One row a measured question: whether an AI answer appeared, whether it
   *  named the business, and how many other sites — or, for a tracked buyer
   *  prompt, how many of the market's rivals — it named. */
  questions: { search: string; answered: boolean; namesBusiness: boolean; citedSites: number }[];
}

/** The live page an update refreshes. */
export interface PackLivePage {
  url: string;
  title: string;
  markdown: string;
  /** Why it is refreshed (issue 1139), as the row records it. */
  why: string | null;
}

/** One fact the pack holds that the top results do not state (D12). */
export interface AddedClaim {
  claim: string;
  business: boolean;
}

/** What the row keeps (`drafts.meta.adds`), and the review screen lists. */
export interface AddsRecord {
  claims: AddedClaim[];
  /** A new page short of the bar. Always `false` on an update. */
  short: boolean;
}

export interface ContextPack {
  version: 1;
  type: ContentType;
  builtAt: string;
  target: { question: string; searches: string[] };
  business: {
    name: string | null;
    domain: string;
    category: string;
    byline: string | null;
    voice: string | null;
    /** The site's market in force (`sites.market`), where one is stored. */
    market: unknown;
    rivals: string[];
  };
  /** The knowledge base and the founder's answers, bounded for a prompt. */
  profile: PromptProfile | null;
  neverClaim: string[];
  /** Business facts: passages of the site's own pages, word for word. */
  facts: PackFact[];
  /** Market facts: claims read off public pages, word for word. */
  claims: PackClaim[];
  /** The rivals whose own pages yielded a claim. */
  products: ResearchedProduct[];
  /** Every published and planned page of the site. */
  pages: SitePage[];
  /** The site's own pages this page links. */
  links: { url: string; label: string; purpose: string | null }[];
  /** The questions the pass measured or buyers were recorded asking. */
  questions: string[];
  measurements: PackMeasurements | null;
  live: PackLivePage | null;
  adds: AddsRecord;
  /** What the template's *pack must hold* line asks that this pack lacks. */
  missing: PackNeed[];
}

const STOP = new Set(
  "a an and are as at be best but by can do does for from how i in is it my of on or our that the to top vs was we what when which who why will with you your".split(" ")
);

/** The content words of a text: what tells two topics apart. */
export function topicWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOP.has(word))
      .map((word) => word.replace(/(?:ies|es|s)$/, (end) => (end === "ies" ? "y" : "")))
  );
}

function shares(words: ReadonlySet<string>, text: string): boolean {
  if (words.size === 0) return true;
  for (const word of topicWords(text)) if (words.has(word)) return true;
  return false;
}

const fold = (text: string): string =>
  text.replace(/\s+/g, " ").trim().toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");

const PRICE_RE = /(?:[$€£]\s?\d|\d\s?(?:usd|eur|gbp|€|\$|£)|\bfree\b)/i;

/** Every statement the knowledge base makes, as text. */
function knowledgeTexts(knowledge: PromptKnowledge | undefined): string[] {
  if (knowledge === undefined) return [];
  return [
    ...knowledge.offerings.flatMap((offering) => [offering.name, ...offering.features, ...offering.prices, ...offering.uses]),
    ...knowledge.differentiators.map((item) => item.text),
    ...knowledge.audience.map((item) => item.text),
    ...knowledge.problems.map((item) => item.text),
    ...knowledge.proof.map((item) => item.text),
    ...knowledge.questions.map((item) => item.text),
    ...knowledge.integrations.map((item) => item.text),
  ];
}

/** What the latest complete pass measured, or `null` where none is. */
export function measurementsOf(report: StoredReport): PackMeasurements | null {
  if (!report.complete) return null;
  const score = report.verdict.scoreAndBand;
  // The tracked buyer prompts are the weekly AI measure (SPEC §6, D19): where
  // the pass asked them, they are what it measured.
  const prompts = report.prompts;
  if (prompts !== undefined && prompts.asked.length > 0) {
    return {
      measuredAt: new Date(report.verdict.measuredAt).toISOString(),
      score: score.kind === "unmeasured" ? null : score.value.score,
      engines: [...new Set(prompts.answers.map((answer) => answer.engine))],
      questions: prompts.asked.map((asked) => {
        const answers = prompts.answers.filter((answer) => answer.promptId === asked.id);
        return {
          search: asked.text,
          answered: answers.length > 0,
          namesBusiness: answers.some((answer) => answer.named || answer.linked),
          citedSites: new Set(answers.flatMap((answer) => answer.rivals)).size,
        };
      }),
    };
  }
  if (report.aiAnswers === null) return null;
  const rows = report.aiAnswers.rows;
  const engines = [
    ...new Set(rows.flatMap((row) => row.engines.filter((cell) => cell.cell.kind !== "unmeasured").map((cell) => cell.engine))),
  ];
  return {
    measuredAt: new Date(report.verdict.measuredAt).toISOString(),
    score: score.kind === "unmeasured" ? null : score.value.score,
    engines,
    questions: rows.map((row) => {
      const answered = row.engines.map((engine) => engine.cell).filter((cell) => cell.kind === "answered");
      return {
        search: row.question.search,
        answered: answered.length > 0,
        namesBusiness: answered.some((cell) => cell.namesCustomer),
        citedSites: new Set(answered.flatMap((cell) => cell.citedDomains)).size,
      };
    }),
  };
}

/** The questions buyers ask on the target's topic: the ones the pass
 *  measured and the ones the knowledge base recorded, those that share a
 *  word with the target first. None is written here. */
function buyerQuestions(report: StoredReport, knowledge: PromptKnowledge | undefined, target: string): string[] {
  const measured = [
    ...(report.questions.kind === "unmeasured" ? [] : report.questions.value.map((question) => question.text)),
    // The tracked buyer prompts (SPEC §6, D19) are questions the pass asked.
    ...(report.prompts?.asked ?? []).map((asked) => asked.text),
  ];
  const recorded = (knowledge?.questions ?? []).map((item) => item.text);
  const all = [...new Set([...measured, ...recorded].map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean))];
  const words = topicWords(target);
  return [...all.filter((text) => shares(words, text)), ...all.filter((text) => !shares(words, text))].slice(0, PACK.questions);
}

/**
 * What a new page adds (SPEC §7, D12; a check over the pack since D41): the
 * pack's facts whose words are on none of the top results the research step
 * read. A business fact is the customer's own; a market claim counts where
 * it was read off a rival's own page or a study, never off a top result.
 */
export function packAdds(a: {
  facts: readonly PackFact[];
  claims: readonly PackClaim[];
  topResults: readonly { url: string; text: string }[];
  newPage: boolean;
}): AddsRecord {
  const top = a.topResults.map((result) => fold(result.text));
  const absent = (passage: string): boolean => !top.some((text) => text.includes(fold(passage)));
  const claims: AddedClaim[] = [
    ...a.facts.filter((fact) => absent(fact.passage)).map((fact) => ({ claim: fact.passage, business: true })),
    ...a.claims
      .filter((claim) => claim.kind !== "top_result" && absent(claim.passage))
      .map((claim) => ({ claim: claim.passage, business: false })),
  ].slice(0, ADDS.maxClaims);
  const enough = claims.length >= ADDS.min && claims.filter((each) => each.business).length >= ADDS.businessMin;
  return { claims, short: a.newPage && !enough };
}

function holds(requirement: PackRequirement, pack: Omit<ContextPack, "missing">, previousResearch: PackMeasurements | null): boolean {
  const knowledge = pack.profile?.knowledge;
  const words = topicWords(pack.target.searches.join(" "));
  switch (requirement.need) {
    case "options":
      return pack.products.length >= requirement.min - 1;
    case "own_price":
      return (
        (knowledge?.offerings ?? []).some((offering) => offering.prices.length > 0) ||
        pack.facts.some((fact) => PRICE_RE.test(fact.passage))
      );
    case "difference":
      return (knowledge?.differentiators.length ?? 0) > 0 || (pack.profile?.promises.length ?? 0) > 0;
    case "facts_on_topic": {
      // That many business facts, one of them at least in the target's own
      // words. Whether the topic is the business's at all was judged when it
      // was ranked (issue 1134); a buyer's words and a site's seldom match
      // fact for fact ("ChatGPT" and "AI answers"), so the rest are counted.
      const held = [...pack.facts.map((fact) => fact.passage), ...knowledgeTexts(knowledge)];
      return held.length >= requirement.min && held.some((text) => shares(words, text));
    }
    case "product_page":
      return pack.links.some((link) => link.purpose === "product" || link.purpose === "features" || link.purpose === "pricing");
    case "measured_questions":
      return (pack.measurements?.questions.length ?? 0) >= requirement.min;
    case "changed_figures": {
      const now = pack.measurements;
      if (now === null) return false;
      if (previousResearch === null) return true;
      const named = (m: PackMeasurements) => m.questions.filter((question) => question.namesBusiness).length;
      return now.measuredAt > previousResearch.measuredAt && (now.score !== previousResearch.score || named(now) !== named(previousResearch));
    }
    case "buyer_questions":
      return pack.questions.length >= requirement.min;
    case "recent_results":
      return new Set(pack.claims.filter((claim) => claim.kind === "recent").map((claim) => claim.url)).size >= requirement.min;
    case "live_page":
      return pack.live !== null && pack.live.markdown.trim() !== "";
    case "new_fact": {
      if (pack.live === null) return false;
      const live = fold(pack.live.markdown);
      const fresh = [...pack.facts, ...pack.claims].filter((fact) => !live.includes(fold(fact.passage)));
      return fresh.length >= requirement.min;
    }
  }
}

/** What the template asks of the pack that it does not hold, by handle. */
export function missingFrom(pack: Omit<ContextPack, "missing">, previousResearch: PackMeasurements | null = null): PackNeed[] {
  return TEMPLATES[pack.type].packMustHold.filter((requirement) => !holds(requirement, pack, previousResearch)).map((requirement) => requirement.need);
}

export interface PackInputs {
  type: ContentType;
  opportunity: Pick<Opportunity, "family" | "targetQuery" | "targetRef" | "absorbedQueries" | "title">;
  site: { businessName: string | null; domain: string; doNotClaim: readonly string[]; rivals: readonly string[] };
  category: string;
  market?: unknown;
  byline: string | null;
  voice: string | null;
  profile: PromptProfile | null;
  /** The customer's own passages, the ones about the target first. */
  facts: readonly SourcedFact[];
  research: MarketResearch;
  report: StoredReport;
  sitePages: readonly SitePage[];
  links: readonly LinkTarget[];
  live?: PackLivePage | null;
  /** The measurements the site's last research page was written from. */
  previousResearch?: PackMeasurements | null;
  now: Date;
}

export function buildPack(a: PackInputs): ContextPack {
  const searches = [...(a.opportunity.targetQuery === null ? [] : [a.opportunity.targetQuery]), ...a.opportunity.absorbedQueries];
  const question = searches[0] ?? a.opportunity.title ?? a.opportunity.targetRef;
  const facts: PackFact[] = a.facts.slice(0, PACK.facts).map((sourced) => ({
    passage: sourced.fact.passage,
    url: sourced.fact.url,
    readAt: sourced.fact.readAt.toISOString(),
    ...(sourced.report === true ? { report: true as const } : {}),
  }));
  const claims: PackClaim[] = a.research.facts.map((fact) => ({
    passage: fact.passage,
    url: fact.url,
    title: fact.title,
    readAt: fact.readAt.toISOString(),
    kind: fact.kind,
    ...(fact.product === undefined ? {} : { product: fact.product }),
    ...(fact.publishedAt === undefined ? {} : { publishedAt: fact.publishedAt }),
    ...(fact.source === undefined ? {} : { source: fact.source }),
  }));
  const newPage = a.opportunity.family === "write" || a.opportunity.family === "earn";
  const pack: Omit<ContextPack, "missing"> = {
    version: 1,
    type: a.type,
    builtAt: a.now.toISOString(),
    target: { question, searches },
    business: {
      name: a.site.businessName,
      domain: a.site.domain,
      category: a.category,
      byline: a.byline,
      voice: a.voice,
      market: a.market ?? null,
      rivals: [...a.site.rivals],
    },
    profile: a.profile,
    neverClaim: [...a.site.doNotClaim],
    facts,
    claims,
    products: a.research.products,
    pages: a.sitePages.slice(0, PACK.pages),
    links: a.links.map((link) => ({ url: link.url, label: link.label, purpose: link.source === "site" ? link.purpose : null })),
    questions: a.type === "qa" ? buyerQuestions(a.report, a.profile?.knowledge, question) : [],
    measurements: a.type === "research" ? measurementsOf(a.report) : null,
    live: a.live ?? null,
    adds: packAdds({ facts, claims, topResults: a.research.topResults ?? [], newPage: newPage && a.type !== "update" }),
  };
  return { ...pack, missing: missingFrom(pack, a.previousResearch ?? null) };
}

/** The pack as the row keeps it, read back. `null` on a row written before
 *  the pack, or whose blob this build does not recognise. */
export function readPack(meta: unknown): ContextPack | null {
  const pack = (meta as { pack?: unknown } | null)?.pack as Partial<ContextPack> | undefined;
  if (pack === undefined || pack === null || typeof pack !== "object") return null;
  if (pack.version !== 1 || typeof pack.type !== "string" || !Array.isArray(pack.facts) || !Array.isArray(pack.claims)) return null;
  return pack as ContextPack;
}
