// SPEC §7 *The content standard* — the one "meets the standard" predicate, 0¢, for its three callers: the draft's pack
// check, the stage-4 rules and the weekly commit.
//
// Its research half reads a pack built from what is already cached: the template's *pack must hold* line
// (`missingFrom`), the room its sections leave for the type's floor, and whether its research is still on the queue.
// Before a pack exists, the weekly commit holds a row's cached reads to its type's pass marks (`READ_MARKS`).
// Its page half reads the battery's failures on a written body. Each part is met, short or pending; a part that was
// not measured is pending, never short. Only a short section, source or word count is ever a stop, and whether it
// stops is the completeness switch's (`completenessFor`, `./record.ts`); title and links are recorded and never stop.
import type { ContentType } from "@/lib/opportunities/content-type";
import { registrableDomain } from "@/lib/market/rivals/domains";
import { bodyWords, lengthRangeFor, sectionWords, typeLength } from "./length";
import type { BatteryBasis } from "./pipeline/battery";
import { fold, knowledgeTexts, ownTopicWords, rivalsOnlyVersus, shares, type ContextPack, type PackClaim, type PackMeasurements } from "./pipeline/pack";
import { comparisonTable } from "./pipeline/table";
import { citedSources } from "./rules/cites";
import type { RuleFailure } from "./rules/types";
import { sectionBounds, TEMPLATES, type PackNeed, type PackRequirement, type SectionFacts, type Template } from "./templates";
import { differenceHeld, ownPriceHeld } from "./templates/listicle";

export type Part = "sections" | "sources" | "words" | "figures" | "title" | "links" | "demand";
/** `have: null` is not measured, and its state is `pending`. */
export interface PartMark { part: Part; have: number | null; need: number; state: "met" | "short" | "pending" }
export interface Standard { parts: PartMark[]; met: boolean; pending: boolean; stops: Part[] }

/** The deployed standard's fingerprint (`RK_STANDARD`), or `null` where the build carried none. */
export const deployedStandard = (): string | null => process.env.RK_STANDARD || null;

/** The parts that may ever stop a page. */
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
  return detail.block === "length" || detail.length === true ? [...parts, "words"] : parts;
}

/** Whether a failure is a page missing its sections, sources or words: what earns the one fix call. */
export function incomplete(failure: RuleFailure): boolean {
  return partsOf(failure).some((part) => STOPPING.has(part));
}

const mark = (part: Part, have: number, need: number, short: boolean, pending = false): PartMark => ({ part, have: short && pending ? null : have, need, state: !short ? "met" : pending ? "pending" : "short" });

/** What the research half reads: the pack, whether its research is still queued, and the room for the type's floor. */
interface ResearchHalf { pack: Pick<ContextPack, "type" | "missing">; pending?: boolean; words?: { have: number; need: number; short: boolean } | null }
/** What a row's cached research holds: on-topic readable results (`R`) and their addresses, the buyer questions they
 *  answer (`Q`), the results stating a recent figure (`F`), the results laid out in three or more steps, and its
 *  "People also ask". */
export interface ResearchRead { R: number; Q: number; F: number; stepPages: number; asked: number; urls: string[] }
/** What the commit reads: the type a row is written as, its cached read (`null` with nothing cached), and whether it
 *  must show a buyer asks it, having no measured volume. */
interface ReadHalf { type: ContentType; read: ResearchRead | null; demand?: boolean }

/** The least research a type is written from (seo-master's R/Q/F test); a type not named is checked at its draft. */
const READ_MARKS: Partial<Record<ContentType, { R: number; F: number; Q?: number; stepPages?: number; key: string }>> = {
  qa: { R: 3, Q: 5, F: 1, key: "question" },
  how_to: { R: 3, stepPages: 2, F: 1, key: "asked" },
};
/** The results a buyer's asking shows as, where no volume is measured: one "People also ask", or this many results. */
const DEMAND_RESULTS = 3;

/** What the page half reads: the battery's failures on a written body, beside what it was written to. */
interface PageHalf { failed: readonly RuleFailure[]; markdown: string; sections: number; basis: Pick<BatteryBasis, "pack" | "template" | "length" | "citesMin"> }

/** The one standard a page is held to, from its research before it is written or from its body after. */
export function meetsStandard(a: ResearchHalf | PageHalf | ReadHalf): Standard {
  let parts: PartMark[];
  if ("read" in a) {
    parts = readParts(a);
  } else if ("failed" in a) {
    const short = (part: Part) => a.failed.some((failure) => partsOf(failure).includes(part));
    const { pack, template, length } = a.basis;
    parts = [
      mark("sections", a.sections, sectionBounds(template).min, short("sections")),
      mark("sources", citedSources(a.markdown, pack.claims.map((claim) => claim.url)), a.basis.citesMin, short("sources")),
      ...(length === null ? [] : [mark("words", pack.type === "update" ? sectionWords(a.markdown) : bodyWords(a.markdown), length.floor, short("words"))]),
      mark("title", short("title") ? 0 : 1, 1, short("title")),
      mark("links", short("links") ? 0 : 1, 1, short("links")),
    ];
  } else {
    const asked = mustHold(a.pack.type);
    const missing = a.pack.missing;
    parts = (["sections", "sources", "figures"] as const).flatMap((part) => {
      const need = asked.filter((requirement) => NEED_PART[requirement.need] === part).length;
      const lacking = missing.filter((each) => NEED_PART[each] === part).length;
      return need === 0 ? [] : [mark(part, need - lacking, need, lacking > 0, a.pending === true)];
    });
    if (a.words != null) parts.push(mark("words", a.words.have, a.words.need, a.words.short));
  }
  return { parts, met: parts.every((part) => part.state === "met"), pending: parts.some((part) => part.state === "pending"), stops: parts.filter((part) => part.state === "short" && STOPPING.has(part.part)).map((part) => part.part) };
}

/** A row's cached research against its type's pass marks, its words the room its questions leave for the type's floor;
 *  with nothing cached every part is pending. */
function readParts({ type, read, demand }: ReadHalf): PartMark[] {
  const marks = READ_MARKS[type];
  const r = read ?? { R: 0, Q: 0, F: 0, stepPages: 0, asked: 0, urls: [] };
  const part = (name: Part, have: number, need: number) => mark(name, have, need, have < need, read === null);
  const parts: PartMark[] = demand === true ? [part("demand", r.asked > 0 || r.R >= DEMAND_RESULTS ? 1 : 0, 1)] : [];
  if (marks === undefined) return parts;
  const template = TEMPLATES[type];
  const repeat = template.sections.find((slot) => slot.key === marks.key)?.repeat?.max ?? 0;
  // The draft's own room, with the questions its question slots take: its gaps are not known before its research.
  const room = lengthRangeFor(template, { questions: Math.min(r.Q, repeat), fitted: true });
  return [
    ...parts,
    part("sources", r.R, marks.R),
    part("sections", marks.Q === undefined ? r.stepPages : r.Q, marks.Q ?? marks.stepPages!),
    part("figures", r.F, marks.F),
    part("words", room?.ceiling ?? 0, typeLength(template)?.floor ?? 0),
  ];
}

/** What a type's pack must hold. R31: every page but an update, whatever its template, is held to first-hand rival evidence. */
function mustHold(type: ContentType): PackRequirement[] {
  return [...TEMPLATES[type].packMustHold, ...(type === "update" ? [] : [{ need: "rival_evidence" as const }])];
}

/** A claim about a rival read first-hand: off its own site, or off a study
 *  or a primary source about it — never off a top search result. */
function firstHand(claim: PackClaim, domain: string): boolean {
  if (claim.kind === "top_result") return false;
  return claim.product === domain || ((claim.kind === "study" || claim.kind === "primary") && claim.about === domain);
}

/** The business facts a pack holds: its passages and its knowledge base's texts. */
const factTexts = (pack: Omit<ContextPack, "missing">): string[] => [...pack.facts.map((fact) => fact.passage), ...knowledgeTexts(pack.profile?.knowledge)];

function holds(requirement: PackRequirement, pack: Omit<ContextPack, "missing">, previousResearch: PackMeasurements | null): boolean {
  switch (requirement.need) {
    case "rival_evidence":
      return rivalsOnlyVersus(pack).every((rival) => pack.claims.some((claim) => firstHand(claim, rival.domain)));
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
      return new Set(pack.claims.filter((claim) => claim.product === undefined).map((claim) => claim.url)).size > requirement.min;
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
export function builtFromOutside(type: ContentType): boolean {
  return TEMPLATES[type].packMustHold.some((requirement) => requirement.need === "outside_sources");
}

/** The needs a page written anyway goes without: never first-hand rival evidence, which an ungrounded page would be harm. */
const WAIVED: ReadonlySet<PackNeed> = new Set<PackNeed>(["outside_sources", "buyer_questions", "options", "recent_results", "facts_few"]);

/** What a page still lacks before it is written. Written anyway (SPEC §7, owner 2026-11-18), only what no waiver covers,
 *  once its research holds the minimum: two sourced sections, from two independent sources, the site's own on-topic
 *  facts one of them. Under it, or written as any other page, everything it lacks: nothing is invented. */
export function writtenAnyway(pack: ContextPack, missing: readonly PackNeed[], anyway: boolean): PackNeed[] {
  const sources = new Set(pack.claims.map((claim) => registrableDomain(claim.url) ?? claim.url.replace(/^\w+:\/\/([^/]+).*$/, "$1")));
  const own = factTexts(pack).some((text) => shares(ownTopicWords(pack), text)) ? 1 : 0;
  return anyway && pack.questions.length >= 2 && sources.size + own >= 2 ? missing.filter((need) => !WAIVED.has(need)) : [...missing];
}

/** What the template asks of the pack that it does not hold, by handle. */
export function missingFrom(pack: Omit<ContextPack, "missing">, previousResearch: PackMeasurements | null = null): PackNeed[] {
  const held = mustHold(pack.type);
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
 * pack holds too few facts for is left out, questions buyers asked fewer than
 * the template's least leave no FAQ, and the length's ceiling keeps each
 * section's share, so a page with fewer sections is never padded. A `kept`
 * page (a product page, a lead's free page) keeps its type's former
 * sections and maximum (owner Q9/D, 2026-11-16).
 */
export function fittedTemplate(pack: ContextPack, kept = false): Template {
  const template = TEMPLATES[pack.type];
  const sections = template.sections.filter(
    (slot) => (slot.onlyWith === undefined || factsHeld(slot.onlyWith.facts, pack) >= slot.onlyWith.min) && !(kept && slot.when === "gaps")
  );
  const faq = template.blocks.faq;
  const asked = faq === null || faq.asked !== true || holds({ need: "buyer_questions", min: faq.min }, pack, null);
  const length = template.length;
  const max = "ceiling" in length ? (kept ? (length.kept ?? length.ceiling) : length.ceiling) : null;
  if (sections.length === template.sections.length && asked && (max === null || max === ("ceiling" in length ? length.ceiling : null))) return template;
  // The gap sections are counted in no share, so a page's share is as it was before they existed.
  const counted = (slots: readonly Template["sections"][number][]) => sectionBounds({ ...template, sections: slots.filter((slot) => slot.when !== "gaps") }).max;
  const share = counted(sections) / counted(template.sections);
  return {
    ...template,
    sections,
    blocks: { ...template.blocks, faq: asked ? faq : { min: 0, max: 0 } },
    length: "ceiling" in length ? { ...length, ceiling: Math.round(max! * share) } : length,
  };
}
