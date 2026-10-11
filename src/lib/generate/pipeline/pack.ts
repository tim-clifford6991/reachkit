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
import { LANGUAGE_PACKS, SHAPES, modelInstruction } from "@/lib/locale/language";
import type { Language, Locale } from "@/lib/locale/locales";
import { ADDS, PACK, RIVAL_PRICE_MAX_AGE_D } from "@/lib/config/constants";
import { promptTemplateOf } from "@/lib/market/prompts/generate";
import { GENERIC_TOKENS, brandOf } from "@/lib/market/questions/select";
import { templateQuestion } from "@/lib/market/questions/template";
import type { ContentType } from "@/lib/opportunities/content-type";
import type { SitePage } from "@/lib/opportunities/site-pages";
import type { Opportunity } from "@/lib/opportunities/types";
import type { StoredReport } from "@/lib/scan/report";
import type { LinkTarget } from "../links/select";
import { alikeHeadings } from "../rules/headings";
import { TEMPLATES, type PackNeed, type PackRequirement } from "../templates";
import type { WritingMarket } from "../voice/market";
import type { PromptKnowledge, PromptProfile } from "../voice/profile-block";
import type { SourcedFact } from "./grounding";
import type { BuyersAsk, JudgedResult, MarketFact, MarketResearch, QuestionsHeld, ResearchedProduct } from "./research";
import { comparisonTable } from "./table";

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
  /** Issue 1391: the newer live page this refresh adds one sentence linking
   *  to. Present on a refresh planned for that, and only there. */
  linkTo?: { url: string; title: string };
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
  /** The site's country and language (SPEC §6, owner D66, issue 1311),
   *  where they are not the United States and English: the page is written
   *  in this language, for buyers in this country, and its questions and
   *  searches are in it. Absent on a pack built before D66 and on every US
   *  English one, which is what every pack was. */
  locale?: Locale;
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
  /** *Current insights* (issue 1262): each dated news result that was read,
   *  and whether it was judged to be about the market. Only one that was has
   *  a claim in `claims`. */
  news?: JudgedResult[];
  /** Every published and planned page of the site. */
  pages: SitePage[];
  /** The site's own pages this page links. */
  links: { url: string; label: string; purpose: string | null }[];
  /** A Q&A's questions: what buyers were seen to ask about the target, each
   *  with a fact in this pack that answers it (issue 1263; D61). */
  questions: string[];
  measurements: PackMeasurements | null;
  live: PackLivePage | null;
  adds: AddsRecord;
  /** What the template's *pack must hold* line asks that this pack lacks. */
  missing: PackNeed[];
}

/** Every statement the pack carries, beside its passages, that a page may
 *  repeat a figure or a phrase from: the knowledge base's own words, what
 *  the pass measured on a research page, and the live page of an update. */
export function packStatements(pack: ContextPack): string[] {
  const knowledge = pack.profile?.knowledge;
  const measured = pack.measurements;
  return [
    ...(pack.profile === null ? [] : [pack.profile.job ?? "", ...pack.profile.products, ...pack.profile.promises]),
    ...(knowledge === undefined
      ? []
      : [
          ...knowledge.offerings.flatMap((offering) => [offering.name, ...offering.features, ...offering.prices, ...offering.uses]),
          ...knowledge.differentiators.map((item) => item.text),
          ...knowledge.proof.map((item) => item.text),
          ...knowledge.audience.map((item) => item.text),
          ...knowledge.problems.map((item) => item.text),
          ...knowledge.questions.map((item) => item.text),
        ]),
    ...(measured === null
      ? []
      : [
          `${measured.score ?? ""} ${measured.questions.length} ${measured.questions.filter((q) => q.answered).length} ` +
            `${measured.questions.filter((q) => q.namesBusiness).length} ${measured.engines.length} ` +
            measured.questions.map((q) => `${q.search} ${q.citedSites}`).join(" "),
        ]),
    ...(pack.live === null ? [] : [pack.live.markdown]),
  ].filter((text) => text !== "");
}

// The English words every pack was read by, and each other supported
// language's function words beside them (D66): a pack does not say which
// language a stored title or question is in.
const STOP = new Set([
  ..."a an and are as at be best but by can do does for from how i in is it my of on or our that the to top vs was we what when which who why will with you your".split(" "),
  ...LANGUAGE_PACKS.filter((pack) => pack.language !== "en").flatMap((pack) => [...pack.stopWords]),
]);

/** The content words of a text: what tells two topics apart. */
export function topicWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
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

/** What a text is about once the words every search shares are set aside
 *  ("best", "tool", "pricing"): what tells one market from another. */
function subjectWords(text: string): Set<string> {
  return new Set([...topicWords(text)].filter((word) => !GENERIC_TOKENS.has(word)));
}

interface NamedRival {
  name: string;
  domain: string;
}

/** A question names a rival by its name, every word of it, or by its
 *  domain's own label ("aeoengine"). */
function namesRival(question: string, rival: NamedRival): boolean {
  const said = new Set(question.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const name = rival.name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return (name.length > 0 && name.every((word) => said.has(word))) || said.has(brandOf(rival.domain));
}

/** The fewest words a related search has to be read as a question (D61). */
const RELATED_MIN_WORDS = 3;

const ASKS_PRICE_RE = SHAPES.asksPrice;

/**
 * A measured question is on the site's current market (issue 1263) where
 * its wording or its search shares a word with the market's category or one
 * of its synonyms, or names one of its rivals. `null` is a site no market
 * was concluded for: the report's own reading is its market, and every
 * question that report measured is on it.
 */
function onMarket(question: { text: string; search: string }, market: WritingMarket | null): boolean {
  if (market === null || market.from === "report") return true;
  const asked = `${question.text} ${question.search}`;
  const words = subjectWords(asked);
  const marketWords = subjectWords([market.category, ...market.synonyms].join(" "));
  return [...words].some((word) => marketWords.has(word)) || (market.market?.rivals ?? []).some((rival) => namesRival(asked, rival));
}

/**
 * The pack holds a fact that answers the question (issue 1263). One that
 * names rivals needs a claim read off each one's own page — its pricing page
 * where the question asks what it costs. Any other needs a business fact or
 * a market claim that shares two of its subject words, or its one.
 */
function answerable(
  question: string,
  a: { facts: readonly PackFact[]; claims: readonly PackClaim[]; knowledge: PromptKnowledge | undefined; rivals: readonly NamedRival[] }
): boolean {
  const named = a.rivals.filter((rival) => namesRival(question, rival));
  if (named.length > 0) {
    const price = ASKS_PRICE_RE.test(question);
    return named.every((rival) => a.claims.some((claim) => claim.product === rival.domain && (!price || claim.kind === "rival_pricing")));
  }
  const words = subjectWords(question);
  if (words.size === 0) return false;
  const need = Math.min(2, words.size);
  const asked = new Set((a.knowledge?.questions ?? []).map((item) => item.text));
  const held = [
    ...a.facts.map((fact) => fact.passage),
    ...a.claims.map((claim) => claim.passage),
    // A question the knowledge base recorded is not a fact that answers one.
    ...knowledgeTexts(a.knowledge).filter((text) => !asked.has(text)),
  ];
  return held.some((text) => {
    const stated = subjectWords(text);
    let shared = 0;
    for (const word of words) if (stated.has(word) && ++shared >= need) return true;
    return false;
  });
}

/**
 * The questions a Q&A may answer (SPEC §7, D42; issue 1263; owner D61, issue
 * 1295). They are questions buyers were seen to ask: Google's "People also
 * ask" for the target, the target's related searches that have a measured
 * volume, and the stored report's measured questions on the site's current
 * market — in that order, those that share a word with the target first.
 * Where those are too few, the first two lists also hold what the research
 * step read beside the market's searched terms (D62), and every rule here
 * is asked of those as of the target's own.
 *
 * **A tracked buyer prompt is never one** (D61): the prompts are templated
 * so they can be measured (D19), and a page headed by them asks one question
 * seven times. Wherever a templated phrasing still arrives, one question a
 * prompt template is kept; and of two questions that would make headings too
 * alike for stage 4 (`../rules/headings.ts`), the first is.
 *
 * Each goes in only where the pack holds a fact that answers it. None is
 * written here.
 */
function buyerQuestions(a: {
  report: StoredReport;
  asked: BuyersAsk | undefined;
  target: string;
  market: WritingMarket | null;
  rivals: readonly string[];
  facts: readonly PackFact[];
  claims: readonly PackClaim[];
  knowledge: PromptKnowledge | undefined;
  language: Language;
}): string[] {
  // Every product a question could name: the rivals in force, the ones the
  // conclusion names beside them, and the stored report's. Only a rival in
  // force is researched, so a question naming any other has no claim.
  const rivals: NamedRival[] = [];
  for (const rival of [
    ...(a.market?.market?.rivals ?? []),
    ...(a.market?.concluded ?? []),
    ...[...a.rivals, ...(a.report.rivals.kind === "unmeasured" ? [] : a.report.rivals.value.map((rival) => rival.domain))].map((domain) => ({
      name: brandOf(domain),
      domain,
    })),
  ]) {
    if (!rivals.some((known) => known.domain === rival.domain)) rivals.push(rival);
  }
  const measured = (a.report.questions.kind === "unmeasured" ? [] : a.report.questions.value)
    .filter((question) => onMarket({ text: question.text, search: question.search.keyword }, a.market))
    .map((question) => question.text);
  // A related search is a search, not a sentence: it is worded as the
  // question it asks, the way a measured search is (`templateQuestion`).
  // One of a word or two is a name or a topic ("hubspot", "apollo ai"), which
  // nobody is asking anything by.
  const related = (a.asked?.related ?? [])
    .filter((row) => row.search.trim().split(/\s+/).length >= RELATED_MIN_WORDS)
    .map((row) => ({ text: templateQuestion(row.search, a.language), search: row.search }));
  // Google lists what people also ask beside any search, on the market or
  // off it ("What is the 30% rule for AI?"): each is held to the market, as
  // a measured question is.
  const seen = [...(a.asked?.peopleAlsoAsk ?? []).map((text) => ({ text, search: "" })), ...related]
    .filter((question) => onMarket(question, a.market))
    .map((question) => question.text);
  // SPEC §6 (D49, issue 1270): a label of the market nobody searches is
  // never printed.
  const flat = (text: string): string => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  const labels = (a.market?.unsearched ?? []).map(flat);
  const printable = (text: string): boolean => !labels.some((label) => flat(text).includes(label));
  // The stored report may carry a tracked prompt among its questions; it is
  // a measuring tool wherever it is stored.
  const tracked = new Set((a.report.prompts?.asked ?? []).map((asked) => flat(asked.text)));
  const all = [...new Set([...seen, ...measured].map((text) => text.replace(/\s+/g, " ").trim()).filter(Boolean))]
    .filter((text) => !tracked.has(flat(text)))
    .filter(printable)
    .filter((text) => answerable(text, { facts: a.facts, claims: a.claims, knowledge: a.knowledge, rivals }));
  const words = topicWords(a.target);
  const kept: string[] = [];
  const templates = new Set<string>();
  for (const text of [...all.filter((each) => shares(words, each)), ...all.filter((each) => !shares(words, each))]) {
    const template = promptTemplateOf(text);
    if (template !== null && templates.has(template)) continue;
    if (kept.some((held) => alikeHeadings(held, text))) continue;
    if (template !== null) templates.add(template);
    kept.push(text);
  }
  return kept.slice(0, PACK.questions);
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
      // D47: the options are the ones code can lay a table out of — the
      // business and that many rivals, each with a fact to set beside it.
      return comparisonTable(pack, requirement.min - 1) !== null;
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
      // Issue 1391: a newer page of the site the live one does not link is
      // what is new to say on a refresh planned to link it.
      const newer = pack.live.linkTo !== undefined && !pack.live.markdown.includes(pack.live.linkTo.url) ? 1 : 0;
      return fresh.length + newer >= requirement.min;
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
  /** The market in force, as the page is written for it (issue 1248): what a
   *  Q&A's measured questions are held to. Absent on a lead's page. */
  writingFor?: WritingMarket | null;
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
  /** The site's country and language (D66). Absent is the United States in
   *  English. */
  locale?: Locale;
}

/** Whether a claim is a rival's price read too long ago to state (D59):
 *  more than `RIVAL_PRICE_MAX_AGE_D` days before `now`. A date that cannot
 *  be read is not an age. */
export function staleRivalPrice(claim: Pick<PackClaim, "kind" | "readAt">, now: Date): boolean {
  if (claim.kind !== "rival_pricing") return false;
  const read = Date.parse(claim.readAt);
  return !Number.isNaN(read) && now.getTime() - read > RIVAL_PRICE_MAX_AGE_D * 86_400_000;
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
  // SPEC §7 (owner D59, issue 1287): a rival's price read more than 30
  // days ago is not handed to the writer. A product left with no claim of
  // its own is no longer one the page may name.
  const current = a.research.facts.filter((fact) => !staleRivalPrice({ kind: fact.kind, readAt: fact.readAt.toISOString() }, a.now));
  const products = a.research.products
    .map((product) => ({ ...product, pages: product.pages.filter((url) => current.some((fact) => fact.product === product.domain && fact.url === url)) }))
    .filter((product) => product.pages.length > 0);
  const claims: PackClaim[] = current.map((fact) => ({
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
    ...(a.locale === undefined || modelInstruction({ country: a.locale.country, language: a.locale.language }) === null ? {} : { locale: { country: a.locale.country, language: a.locale.language } }),
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
    products,
    ...(a.research.news === undefined ? {} : { news: a.research.news }),
    pages: a.sitePages.slice(0, PACK.pages),
    links: a.links.map((link) => ({ url: link.url, label: link.label, purpose: link.source === "site" ? link.purpose : null })),
    questions:
      a.type === "qa"
        ? buyerQuestions({
            report: a.report,
            asked: a.research.asked,
            target: question,
            market: a.writingFor ?? null,
            rivals: a.site.rivals,
            facts,
            claims,
            knowledge: a.profile?.knowledge,
            language: a.locale?.language ?? "en",
          })
        : [],
    measurements: a.type === "research" ? measurementsOf(a.report) : null,
    live: a.live ?? null,
    adds: packAdds({ facts, claims, topResults: a.research.topResults ?? [], newPage: newPage && a.type !== "update" }),
  };
  const missing = missingFrom(pack, a.previousResearch ?? null);
  // SPEC §7 (owner, D47): a comparison with fewer than two rivals that have
  // facts is written as a Q&A, from the same reads. A business with no price
  // of its own is not that case: the page stops and asks for it, as before.
  if (a.type === "listicle" && missing.includes("options") && !missing.includes("own_price")) return buildPack({ ...a, type: "qa" });
  return { ...pack, missing };
}

/** What a pack holds for a Q&A (owner, D62; issue 1297): the questions it
 *  keeps, and whether they are as many as the template asks. It is what the
 *  research step reads to know whether the target's own SERP was enough; a
 *  pack that is not written as a Q&A asks for none. */
export function questionsHeld(pack: ContextPack): QuestionsHeld {
  return { kept: pack.questions.length, enough: pack.type !== "qa" || !pack.missing.includes("buyer_questions") };
}

/** The pack as the row keeps it, read back. `null` on a row written before
 *  the pack, or whose blob this build does not recognise. */
export function readPack(meta: unknown): ContextPack | null {
  const pack = (meta as { pack?: unknown } | null)?.pack as Partial<ContextPack> | undefined;
  if (pack === undefined || pack === null || typeof pack !== "object") return null;
  if (pack.version !== 1 || typeof pack.type !== "string" || !Array.isArray(pack.facts) || !Array.isArray(pack.claims)) return null;
  return pack as ContextPack;
}
