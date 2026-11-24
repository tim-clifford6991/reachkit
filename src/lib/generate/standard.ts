// SPEC §7 *The content standard* — the one "meets the standard" predicate, 0¢, for its three callers: the draft's pack
// check, the stage-4 rules and the weekly commit.
//
// Its research half reads a pack built from what is already cached: the template's *pack must hold* line
// (`missingFrom`), the room its sections leave for the type's floor, and whether its research is still on the queue.
// Before a pack exists, the weekly commit holds a row's cached reads to its type's pass marks (`READ_MARKS`).
// Its page half reads the battery's failures on a written body. Each part is met, short or pending; a part that was
// not measured is pending, never short. A short part is a warning: recorded and logged, never a stop or a fix call.
import { contentTypeOf, SHAPED, type ContentType } from "@/lib/opportunities/content-type";
import { offeringTopTen, type TopTenRow } from "@/lib/opportunities/derive/top-ten-kind";
import type { Opportunity } from "@/lib/opportunities/types";
import { pageClass, registrableDomain } from "@/lib/market/rivals/domains";
import { bodyWords, lengthRangeFor, sectionWords, typeLength } from "./length";
import type { BatteryBasis } from "./pipeline/battery";
import { fold, knowledgeTexts, ownTopicWords, rivalsOnlyVersus, shares, type ContextPack, type PackClaim, type PackMeasurements } from "./pipeline/pack";
import { sourcingUrls } from "./pipeline/original";
import { comparisonTable } from "./pipeline/table";
import { citedSources } from "./rules/cites";
import type { RuleFailure } from "./rules/types";
import { sectionBounds, TEMPLATES, type PackNeed, type PackRequirement, type SectionFacts, type Template } from "./templates";
import { differenceHeld, ownPriceHeld } from "./templates/listicle";

export type Part = "sections" | "sources" | "words" | "figures" | "title" | "links" | "demand" | "style" | "rival_evidence";
/** `have: null` is not measured, and its state is `pending`. */
export interface PartMark { part: Part; have: number | null; need: number; state: "met" | "short" | "pending" }
/** `unchecked`: a type with no pass marks, whose cached research is never read as met. */
export interface Standard { parts: PartMark[]; met: boolean; pending: boolean; stops: Part[]; unchecked?: true }

/** The deployed standard's fingerprint (`RK_STANDARD`), or `null` where the build carried none. */
export const deployedStandard = (): string | null => process.env.RK_STANDARD || null;

/** The parts a waiting draft is set aside for after a standard deploy (`restandardSites`, `./recheck.ts`). */
const STOPPING: ReadonlySet<Part> = new Set<Part>(["sections", "sources", "words"]);

/** The part each pack need sources: the page's sections, its outside sources, or its facts and figures. */
const NEED_PART: Readonly<Record<PackNeed, Part>> = {
  options: "sections", measured_questions: "sections", buyer_questions: "sections", outside_sources: "sources", recent_results: "sources", rival_evidence: "sources",
  own_price: "figures", difference: "figures", facts_on_topic: "figures", facts_few: "figures", product_page: "figures", changed_figures: "figures", live_page: "figures", new_fact: "figures",
};

const SECTION_BLOCKS: ReadonlySet<string> = new Set(["sections", "steps", "table"]);
const LINK_BLOCKS: ReadonlySet<string> = new Set(["link_markup", "business_section", "closing"]);

/** The parts one battery failure says a written page is short of. */
export function partsOf(failure: RuleFailure): Part[] {
  if (failure.rule === "cites_market") return ["sources"];
  if (failure.rule === "title") return ["title"];
  const detail = failure.detail;
  if (detail?.rule !== "required_blocks") return [];
  const parts: Part[] = [...(SECTION_BLOCKS.has(detail.block) ? ["sections" as const] : []), ...(LINK_BLOCKS.has(detail.block) ? ["links" as const] : [])];
  // A page over its ceiling is not short of words.
  return (detail.block === "length" || detail.length === true) && detail.over !== true ? [...parts, "words"] : parts;
}

const mark = (part: Part, have: number, need: number, short: boolean, pending = false): PartMark => ({ part, have: short && pending ? null : have, need, state: !short ? "met" : pending ? "pending" : "short" });

/** What the research half reads: the pack, whether its research is still queued, and the room for the type's floor. */
interface ResearchHalf { pack: Pick<ContextPack, "type" | "missing" | "own" | "live">; pending?: boolean; words?: { have: number; need: number; short: boolean } | null }
/** What a row's cached research holds: on-topic readable results (`R`) and their addresses, the buyer questions they
 *  answer (`Q`), the results stating a recent figure (`F`), the results laid out in three or more steps, its
 *  "People also ask", its first organic results (`top`), the site's own facts on its topic (`facts`), and on a rival-only
 *  `vs` search (R31), how many of the rivals it names have an own page read. */
export interface ResearchRead { R: number; Q: number; F: number; stepPages: number; asked: number; urls: string[]; top?: readonly TopTenRow[]; facts?: number; rivals?: { need: number; have: number } }
/** What the commit reads: the type a row is written as, its cached read (`null` with nothing cached), and whether it
 *  must show a buyer asks it, having no measured volume. */
interface ReadHalf { type: ContentType; read: ResearchRead | null; demand?: boolean }

const factsNeed = (type: ContentType) => TEMPLATES[type].packMustHold.find((each) => each.need === "facts_on_topic")?.min;
/** The least research a type is written from (seo-master's R/Q/F test); a type not named is unchecked until its draft.
 *  A listicle's options and an update's new facts are read off on-topic results; documentation and an offering are
 *  written from the site's own facts on the topic. */
const READ_MARKS: Partial<Record<ContentType, { R?: number; F?: number; Q?: number; stepPages?: number; facts?: number; key?: string }>> = {
  qa: { R: 3, Q: 5, F: 1, key: "question" },
  how_to: { R: 3, stepPages: 2, F: 1, key: "asked" },
  listicle: { R: 3, F: 1 },
  update: { R: 2, F: 1 },
  documentation: { facts: factsNeed("documentation") },
  offering: { facts: factsNeed("offering") },
};
/** The results a buyer's asking shows as, where no volume is measured: one "People also ask", or this many results. */
const DEMAND_RESULTS = 3;

/** What the page half reads: the battery's failures on a written body, beside what it was written to. */
interface PageHalf { failed: readonly RuleFailure[]; markdown: string; sections: number; basis: Pick<BatteryBasis, "pack" | "template" | "length" | "citesMin">; /** Writer's notes the repair dropped: a style warning. */ notes?: number }

/** The one standard a page is held to, from its research before it is written or from its body after. */
export function meetsStandard(a: ResearchHalf | PageHalf | ReadHalf): Standard {
  let parts: PartMark[];
  const unchecked = "read" in a && READ_MARKS[a.type] === undefined;
  if ("read" in a) {
    parts = readParts(a);
  } else if ("failed" in a) {
    const short = (part: Part) => a.failed.some((failure) => partsOf(failure).includes(part));
    const { pack, template, length } = a.basis;
    parts = [
      mark("sections", a.sections, sectionBounds(template).min, short("sections")),
      mark("sources", citedSources(a.markdown, sourcingUrls(pack.claims)), a.basis.citesMin, short("sources")),
      ...(length === null ? [] : [mark("words", pack.type === "update" ? sectionWords(a.markdown) : bodyWords(a.markdown), length.floor, short("words"))]),
      mark("title", short("title") ? 0 : 1, 1, short("title")),
      mark("links", short("links") ? 0 : 1, 1, short("links")),
      ...((a.notes ?? 0) > 0 ? [mark("style", 0, 1, true)] : []),
    ];
  } else {
    const asked = mustHold(a.pack);
    const missing = a.pack.missing;
    parts = (["sections", "sources", "figures"] as const).flatMap((part) => {
      const need = asked.filter((requirement) => NEED_PART[requirement.need] === part).length;
      const lacking = missing.filter((each) => NEED_PART[each] === part).length;
      return need === 0 ? [] : [mark(part, need - lacking, need, lacking > 0, a.pending === true)];
    });
    if (a.words != null) parts.push(mark("words", a.words.have, a.words.need, a.words.short));
  }
  return { parts, met: !unchecked && parts.every((part) => part.state === "met"), pending: parts.some((part) => part.state === "pending"), stops: parts.filter((part) => part.state === "short" && STOPPING.has(part.part)).map((part) => part.part), ...(unchecked ? { unchecked } : {}) };
}

/** A row's cached research against its type's pass marks, its words the room its questions leave for the type's floor;
 *  with nothing cached every part is pending. */
function readParts({ type, read, demand }: ReadHalf): PartMark[] {
  const marks = READ_MARKS[type];
  const r = read ?? { R: 0, Q: 0, F: 0, stepPages: 0, asked: 0, urls: [] };
  const part = (name: Part, have: number, need: number | undefined, unread = false): PartMark[] => (need === undefined ? [] : [mark(name, have, need, have < need, read === null || unread)]);
  const parts: PartMark[] = [...(demand === true ? part("demand", r.asked > 0 || r.R >= DEMAND_RESULTS ? 1 : 0, 1) : []), ...(r.rivals === undefined ? [] : part("rival_evidence", r.rivals.have, r.rivals.need))];
  if (marks === undefined) return parts;
  const template = TEMPLATES[type];
  const repeat = template.sections.find((slot) => slot.key === marks.key)?.repeat?.max ?? 0;
  // The draft's own room, with the questions its question slots take: its gaps are not known before its research.
  const room = lengthRangeFor(template, { questions: Math.min(r.Q, repeat), fitted: true });
  return [
    ...parts,
    ...part("sources", r.R, marks.R),
    ...part("sections", marks.Q === undefined ? r.stepPages : r.Q, marks.Q ?? marks.stepPages),
    ...part("figures", r.F, marks.F),
    ...part("figures", r.facts ?? 0, marks.facts, r.facts === undefined),
    ...part("words", room?.ceiling ?? 0, marks.key === undefined ? undefined : (typeLength(template)?.floor ?? 0)),
  ];
}

/** Whether a page must show a buyer asks it: documentation or an offering on a search with no measured volume. */
export const mustShowDemand = (o: Pick<Opportunity, "volume">, type: ContentType): boolean => (o.volume?.kind ?? "unmeasured") === "unmeasured" && (type === "documentation" || type === "offering");

/** SPEC §7 *How the type is decided* (owner, 2026-11-17, #2722): the owner's ladder, top down. */
const LADDER: readonly ContentType[] = ["listicle", "how_to", "qa", "documentation"];
/** The first organic results read for vendors' own pages: at least half of them make a results page a vendor one. */
const VENDOR_TOP = 5;

/** The type a row's research fills, 0¢ and with no model: its shape's own, an offering where its own results page asks
 *  for one, else the first type down the ladder its research fills. A vendor results page is never a Q&A or a how-to.
 *  None filled, the first type it may take, which the commit finds short; with nothing cached, its shape's own. */
export function typeTheResearchFills(o: Pick<Opportunity, "type" | "targetQuery" | "evidence" | "volume">, read: ResearchRead | null): ContentType | null {
  const top = read?.top ?? [];
  const start = ownTypeOf(o, read);
  if (read === null || start === null || READ_MARKS[start] === undefined) return start;
  const vendors = top.slice(0, VENDOR_TOP).filter((row) => pageClass(row) === "provider").length;
  const vendor = vendors > 0 && vendors * 2 >= Math.min(VENDOR_TOP, top.length);
  const at = LADDER.indexOf(start);
  const rungs = (start === "update" ? [start] : at < 0 ? [start, "documentation" as const] : LADDER.slice(at)).filter((type) => !(vendor && (type === "qa" || type === "how_to")));
  return rungs.find((type) => meetsStandard({ type, read, demand: mustShowDemand(o, type) }).met) ?? rungs[0]!;
}

/** A query's own type: its shape's, or an offering where its own results page asks for one. */
export const ownTypeOf = (o: Pick<Opportunity, "type" | "targetQuery" | "evidence">, read: ResearchRead | null): ContentType | null =>
  SHAPED.has(o.type) && offeringTopTen({ rows: read?.top ?? [] }, null, o.targetQuery ?? "") ? "offering" : contentTypeOf(o);

/** Whether the ladder falls from a query's own type to `type`: down its rungs, or to documentation, never to an offering. */
export const fellTo = (type: ContentType, own: ContentType | null): own is ContentType =>
  own !== null && own !== type && (type === "documentation" || (LADDER.indexOf(own) >= 0 && LADDER.indexOf(type) > LADDER.indexOf(own)));

/** What a type the ladder fell to keeps of its query's own type: thin research must not drop the page's sources or questions. */
const KEPT: ReadonlySet<PackNeed> = new Set<PackNeed>(["outside_sources", "buyer_questions"]);
/** A type's pack needs, with its query's own type's kept needs where the ladder fell from it, each at the larger count. */
export function packNeeds(type: ContentType, own?: ContentType): readonly PackRequirement[] {
  const needs = TEMPLATES[type].packMustHold;
  const kept = own === undefined ? [] : TEMPLATES[own].packMustHold.filter((each) => KEPT.has(each.need));
  const most = (need: PackRequirement) => ("min" in need ? need.min : 0);
  return [...needs.filter((each) => !kept.some((one) => one.need === each.need && most(one) > most(each))), ...kept.filter((one) => !needs.some((each) => each.need === one.need && most(each) >= most(one)))];
}
/** The type whose research a page buys: its own, else its query's own type's where the ladder fell from a researched one. */
export const researchedAs = (type: ContentType, own?: ContentType): ContentType => (TEMPLATES[type].research || own === undefined ? type : own);

/** What a pack must hold. R31: every page but an update is held to first-hand rival evidence; an update keeps its live type's sources and questions. */
function mustHold(pack: Pick<ContextPack, "type" | "own" | "live">): PackRequirement[] {
  const type = pack.type === "update" ? pack.live?.type : undefined;
  const live = type !== undefined && type !== "update" && Object.hasOwn(TEMPLATES, type) ? (type as ContentType) : undefined;
  return [...packNeeds(pack.type, pack.own ?? live), ...(pack.type === "update" ? [] : [{ need: "rival_evidence" as const }])];
}

/** A claim about a rival read first-hand: off its own site, or off a study
 *  or a primary source about it — never off a top search result. */
function firstHand(claim: PackClaim, domain: string): boolean {
  if (claim.kind === "top_result") return false;
  return claim.product === domain || ((claim.kind === "study" || claim.kind === "primary") && claim.about === domain);
}

/** What a held comparison lacked: the rivals its versus search names that no first-hand claim is about, by domain, and how many products it holds own-page claims for. */
export const evidenceOf = (pack: Pick<ContextPack, "target" | "business" | "claims">): { lacking: string[]; firstHand: number } => ({
  lacking: rivalsOnlyVersus(pack).filter((rival) => !pack.claims.some((claim) => firstHand(claim, rival.domain))).map((rival) => rival.domain),
  firstHand: new Set(pack.claims.flatMap((claim) => (claim.product === undefined ? [] : [claim.product]))).size,
});

/** The business facts a pack holds: its passages and its knowledge base's texts. */
const factTexts = (pack: Omit<ContextPack, "missing">): string[] => [...pack.facts.map((fact) => fact.passage), ...knowledgeTexts(pack.profile?.knowledge)];

function holds(requirement: PackRequirement, pack: Omit<ContextPack, "missing">, previousResearch: PackMeasurements | null): boolean {
  switch (requirement.need) {
    case "rival_evidence":
      return evidenceOf(pack).lacking.length === 0;
    case "options":
      // D47: the options are the ones code can lay a table out of — the
      // business and that many rivals, each with a fact to set beside it.
      return comparisonTable(pack, requirement.min - 1) !== null;
    case "own_price":
      return ownPriceHeld({ profile: pack.profile, passages: pack.facts.map((fact) => fact.passage) });
    case "difference":
      return differenceHeld(pack.profile);
    case "facts_on_topic": {
      // One fact in the target's words is enough: a buyer's words and a site's seldom match fact for fact, so the rest are counted.
      const held = factTexts(pack);
      return held.length >= requirement.min && held.some((text) => shares(ownTopicWords(pack), text));
    }
    case "outside_sources":
      // Claims off one page more than the body must cite, each read off the target's own research, never a rival's own page.
      return sourcingUrls(pack.claims.filter((claim) => claim.product === undefined)).length > requirement.min;
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
      // Issue 1487: a link moved to a page's new address is what is new.
      const linkTo = pack.live.linkTo;
      const newer = linkTo !== undefined && (linkTo.replaces !== undefined || !pack.live.markdown.includes(linkTo.url)) ? 1 : 0;
      return fresh.length + newer >= requirement.min;
    }
  }
}

/** Whether a type's page is built from cited outside facts (issue 1486):
 *  its template asks its pack for outside sources. A how-to and a Q&A. */
export function builtFromOutside(type: ContentType, own?: ContentType): boolean {
  return packNeeds(type, own).some((requirement) => requirement.need === "outside_sources");
}

/** The needs a page written anyway goes without: never first-hand rival evidence, which an ungrounded page would be harm. */
const WAIVED: ReadonlySet<PackNeed> = new Set<PackNeed>(["outside_sources", "buyer_questions", "options", "recent_results", "facts_few"]);

/** What a page still lacks before it is written. Written anyway (SPEC §7, owner 2026-11-18), only what no waiver covers,
 *  once its research holds the minimum: two sourced sections, from two independent sources, the site's own on-topic
 *  facts one of them. Under it, or written as any other page, everything it lacks: nothing is invented. */
export function writtenAnyway(pack: ContextPack, missing: readonly PackNeed[], anyway: boolean): PackNeed[] {
  const sources = new Set(sourcingUrls(pack.claims).map((url) => registrableDomain(url) ?? url.replace(/^\w+:\/\/([^/]+).*$/, "$1")));
  const own = factTexts(pack).some((text) => shares(ownTopicWords(pack), text)) ? 1 : 0;
  return anyway && pack.questions.length >= 2 && sources.size + own >= 2 ? missing.filter((need) => !WAIVED.has(need)) : [...missing];
}

/** What the template asks of the pack that it does not hold, by handle. */
export function missingFrom(pack: Omit<ContextPack, "missing">, previousResearch: PackMeasurements | null = null): PackNeed[] {
  const held = mustHold(pack);
  return held.filter((requirement) => !holds(requirement, pack, previousResearch)).map((requirement) => (requirement.need === "facts_on_topic" && factTexts(pack).length < requirement.min ? "facts_few" : requirement.need));
}

/** How many of a section's facts the pack holds: distinct inclusions, the places the business's own pages state (never
 *  one only the founder gave), and one where it states a difference or a promise or carries a `fitFact`. */
function factsHeld(facts: SectionFacts, pack: ContextPack): number {
  const knowledge = pack.profile?.knowledge;
  switch (facts) {
    case "inclusions":
      return new Set((knowledge?.offerings ?? []).flatMap((offering) => offering.features.map(fold))).size;
    case "places":
      return new Set((knowledge?.places ?? []).filter((place) => place.from !== "founder").map((place) => fold(place.text))).size;
    case "difference":
      return holds({ need: "difference" }, pack, null) ? 1 : 0;
    case "passages": return pack.facts.length;
    case "fit": return pack.fitFact === undefined ? 0 : 1;
  }
}

/**
 * The template a pack's page is written and checked to (E10): a section the
 * pack holds too few facts for is left out, the FAQ holds no more entries
 * than the pack's buyer questions and none without one, and the length's
 * ceiling keeps each section's share, so a page is never padded. A `kept`
 * page (a product page, a lead's free page) keeps its type's former
 * sections and maximum (owner Q9/D, 2026-11-16).
 */
export function fittedTemplate(pack: ContextPack, kept = false): Template {
  const template = pack.own === undefined ? TEMPLATES[pack.type] : { ...TEMPLATES[pack.type], packMustHold: packNeeds(pack.type, pack.own) };
  const sections = template.sections.filter(
    (slot) => (slot.onlyWith === undefined || factsHeld(slot.onlyWith.facts, pack) >= slot.onlyWith.min) && !(kept && slot.when === "gaps")
  );
  const held = template.blocks.faq;
  const faq = held === null ? null : { min: Math.min(held.min, pack.questions.length), max: Math.min(held.max, pack.questions.length) };
  const asked = held === null || faq?.max === held.max;
  const length = template.length;
  const max = "ceiling" in length ? (kept ? (length.kept ?? length.ceiling) : length.ceiling) : null;
  if (sections.length === template.sections.length && asked && (max === null || max === ("ceiling" in length ? length.ceiling : null))) return template;
  // The gap sections are counted in no share, so a page's share is as it was before they existed.
  const counted = (slots: readonly Template["sections"][number][]) => sectionBounds({ ...template, sections: slots.filter((slot) => slot.when !== "gaps") }).max;
  const share = counted(sections) / counted(template.sections);
  return {
    ...template,
    sections,
    blocks: { ...template.blocks, faq },
    length: "ceiling" in length ? { ...length, ceiling: Math.round(max! * share) } : length,
  };
}
