// SPEC §7 (D41 stage 4) — what the hard rules read of a page, and the one pass over it: the checks, the
// repairs code can make, and the pages written for other sites. Built here once so a page as written and a stored page
// re-checked (`../recheck.ts`) are read by the same inputs.
import type { CostContext } from "@/lib/costs";
import type { Opportunity } from "@/lib/opportunities";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import { brandSentences, stillAsked, type FitVerdict } from "../claims/fit";
import { lengthRangeFor, sectionWords, typeLength } from "../length";
import { TEMPLATES } from "../templates";
import { batteryCleared, runHardRules, type BatteryOutcome } from "../rules";
import { citesMinOf } from "../rules/brief-lines";
import { namedRivals } from "../rules/rivals";
import { renderOf } from "../rules/text";
import type { ComparisonSet, Completeness, HardRule, SiteRuleInputs } from "../rules/types";
import type { SiteFacts } from "../store";
import type { StoredReport } from "@/lib/scan/report";
import { localeTag } from "@/lib/locale/locales";
import { PAGE_LOCALE } from "@/lib/publish/render/byline";
import { voiceLength } from "../voice/register";
import type { LaidSection } from "./compose";
import { closeElsewhere } from "./elsewhere";
import type { SourcedFact } from "./grounding";
import { ageDays } from "./claims";
import { sourcingUrls } from "./original";
import { packStatements, type ContextPack, type PackClaim } from "./pack";
import { builtFromOutside, fittedTemplate } from "../standard";
import { repairable, repairRecorded, withoutBusiness, type RepairRecord } from "./repair";
import { completenessFor, stops } from "../record";
import { reportFactsAllowed } from "./report-scope";
import { withSources } from "./sources";
import { datesOf } from "./dated";
import { comparisonTable } from "./table";
import { titleRuleFor } from "./title";
import type { FaqEntry } from "./write";

/** The site as the rules read it. The one name the product holds for the business is the brand the profile measured
 *  off their own home page: what the site calls itself. */
export function siteRulesOf(site: Pick<SiteFacts, "domain" | "doNotClaim" | "rivals" | "timeZone">, report: StoredReport, completeness?: Completeness): SiteRuleInputs {
  const businessName = report.market.kind === "unmeasured" ? null : (report.market.value.profile.brandTokens[0] ?? null);
  return { businessName, domain: site.domain, doNotClaim: site.doNotClaim, rivals: site.rivals, timeZone: site.timeZone ?? null, ...(completeness === undefined ? {} : { completeness }) };
}

/** What one page's checks read that its words do not change: its pack, its type and the customer's own sets. */
export function batteryBasis(a: {
  pack: ContextPack;
  opportunity: Opportunity;
  site: SiteRuleInputs;
  /** The customer's own passages, each with the page it was read on. */
  facts: readonly SourcedFact[];
  /** The passage the page stands on (§8 hard rule 1), absent where it stands on research alone. */
  grounding?: SourcedFact;
  demoPhrases?: readonly string[];
}) {
  const { pack, site } = a;
  // D47: a comparison written as another type for want of two rivals compares
  // nobody, so it is told to answer, not to compare.
  const becameQa = pack.type !== "listicle" && contentTypeOf(a.opportunity) === "listicle";
  const pageType = becameQa && pageTypeOf(a.opportunity) === "market_comparison" ? "answer" : pageTypeOf(a.opportunity);
  // Owner Q9/D: a product page keeps its type's former length and sections.
  const kept = pageType === "product";
  const whole = fittedTemplate(pack, kept);
  // D47: the listicle's table, laid out from the pack before a word is
  // written. The writer is handed the same one (`./write.ts`).
  const table = pack.type === "listicle" && whole.blocks.table !== undefined ? comparisonTable(pack, whole.blocks.table.rivals) : null;
  const liveWords = pack.live === null ? null : sectionWords(pack.live.markdown);
  // A new page's length follows the options or gaps it covers; an update's gaps grow it to its grown share.
  const covered = pack.type === "update" ? 0 : table !== null ? table.options.length + (table.baseline === null ? 0 : 1) : (pack.gaps?.length ?? 0);
  // A short answer keeps its own row; an update is held to the type its search reads as.
  const liveType = pack.type === "update" ? typeLength(TEMPLATES[contentTypeOf({ type: "keyword_page", targetQuery: a.opportunity.targetQuery }) ?? "qa"], kept) : undefined;
  // A kept page's own range ignores what it covers, but the room its pack fills counts its options (it has no gap sections).
  const rangeOf = (fitted: boolean) => lengthRangeFor(whole, { questions: pack.questions.length, covered: kept && (!fitted || table === null) ? 0 : covered, voice: voiceLength(pack.voice), liveWords, grown: pack.gaps !== undefined, kept, fitted, ...(liveType === undefined ? {} : { typeOf: liveType }) });
  const held = rangeOf(false);
  const fitted = rangeOf(true);
  // No room: the sections the pack fills leave a ceiling under the type's floor, or none above it, and the page is then never told that floor.
  const noRoomFor = held !== null && fitted !== null && (fitted.ceiling < held.floor || held.ceiling <= held.floor) ? held.floor : null;
  const short = noRoomFor !== null && (site.completeness ?? completenessFor()) !== "stop";
  // The words the pack has room for against the floor the page is held to; a page written short is held to none.
  const room = held === null || fitted === null || short ? null : { have: fitted.ceiling, need: held.floor, short: noRoomFor !== null };
  // A page written short carries its sourced questions as its sections, no more: each a question the pack holds a fact for.
  const sourced = { min: pack.questions.length, max: pack.questions.length };
  const template = short ? { ...whole, sections: whole.sections.map((slot) => (slot.key === "question" ? { ...slot, repeat: sourced } : slot)) } : whole;
  const length = short ? fitted : held;
  const searches = pack.target.searches;
  const names = [site.businessName ?? "", site.domain.split(".")[0] ?? "", ...site.rivals];
  const passages = [...pack.facts.map((fact) => fact.passage), ...packStatements(pack), ...(pack.fitFact === undefined ? [] : [pack.fitFact.passage])];
  const cited = pack.claims.map((claim) => ({ ...claim, readAt: new Date(claim.readAt) }));
  const sourced = (markdown: string): string => withSources(markdown, cited, { language: pack.locale?.language ?? "en", tag: pack.locale === undefined ? PAGE_LOCALE : localeTag(pack.locale), timeZone: site.timeZone ?? null });
  const brief = {
    facts: passages,
    queries: searches,
    marketFacts: pack.claims.map((claim) => ({ url: claim.url, passage: claim.passage, ...scopeOf(claim) })),
    // Issue 1536: the table's own lines are code's, from the pack.
    ...(table === null ? {} : { laid: [table.checked, ...(table.currencies === null ? [] : [table.currencies])] }),
    // Issue 1490: the report's own sentences, withheld from every page that
    // is not research — a refresh's live page among them.
    ...(reportFactsAllowed(pack.type)
      ? {}
      : {
          reportPassages: [
            ...a.facts.filter((sourced) => sourced.report === true).map((sourced) => sourced.fact.passage),
            ...(pack.live?.reportPassages ?? []),
          ],
        }),
  };
  /** What `cites_market` holds the page to: the template's own count, as the writer is told it. */
  const citesMin = citesMinOf(template);
  return { ...a, template, length, noRoomFor, short, room, pageType, table, searches, names, passages, sourced, brief, citesMin, rivalsNamed: namedRivals(site.rivals, pack.business.market) };
}

export type BatteryBasis = ReturnType<typeof batteryBasis>;

/** The page as stage 4 reads it beside its body. */
export interface CheckedPage {
  title: string;
  /** The H1. */
  heading: string;
  description: string;
  sections: readonly LaidSection[];
  faq: readonly FaqEntry[];
}

/** What `required_blocks` reads of the page beside its body. */
export function blockInputs(b: BatteryBasis, page: CheckedPage) {
  const { pack, site } = b;
  return {
    template: b.template,
    sections: page.sections,
    length: b.length,
    faq: page.faq,
    questions: pack.questions,
    domain: site.domain,
    // D52: the rivals the verdict may name as the better pick.
    // Issue 1508: never the baseline, which no verdict may choose.
    ...(b.table === null ? {} : { rivals: b.table.options.slice(1) }),
    ...(b.table?.baseline == null ? {} : { baseline: b.table.baseline }),
    // Issue 1486: a step that names the business is its own.
    businessName: site.businessName,
    // Issue 1521: what a growing refresh may add, and on what.
    ...(pack.type === "update" && pack.live !== null && pack.gaps !== undefined ? { growth: { live: pack.live.markdown, gaps: pack.gaps } } : {}),
  };
}

/** Everything `runHardRules` is handed for one text of the page. `settled` is the page after its fix call, whose
 *  title no longer stops it for want of a specific. */
export function batteryInputs(b: BatteryBasis, page: CheckedPage, markdown: string, comparison: ComparisonSet, settled = false, fit?: FitVerdict) {
  const { pack, site } = b;
  return {
    ...(fit === undefined ? {} : { fit }),
    markdown,
    title: page.title,
    rendered: renderOf(markdown),
    pageType: b.pageType,
    // D44: the one model check, on a listicle or comparison only.
    ...(pack.type === "listicle" && pack.profile?.knowledge !== undefined
      ? { knowledge: pack.profile.knowledge, market: pack.business.market }
      : {}),
    site,
    comparison,
    grounded: b.grounding?.fact ?? null,
    sourceText: b.grounding?.sourceText ?? "",
    brief: b.brief,
    factPages: pack.facts.map((fact) => fact.url),
    blocks: blockInputs(b, page),
    titleRule: { ...titleRuleFor(pack, { description: page.description, sections: page.sections }), settled },
    // D61: a Q&A's questions are each their own.
    distinctHeadings: pack.type === "qa",
    // Issue 1486: a how-to or a Q&A links the outside pages it is built
    // from.
    ...(builtFromOutside(pack.type, pack.own) ? { cites: { claimUrls: sourcingUrls(pack.claims), min: b.citesMin } } : {}),
    heading: page.heading,
    rivalsNamed: b.rivalsNamed,
    ...(b.demoPhrases === undefined ? {} : { demoPhrases: b.demoPhrases }),
    // Issue 1390: how the page reads. A passage stated word for word is
    // not the writer's, and the page's own subject may be said as often
    // as it needs.
    prose: {
      language: pack.locale?.language ?? "en",
      passages: [...pack.facts.map((fact) => fact.passage), ...pack.claims.map((claim) => claim.passage)],
      dated: pack.claims.flatMap((claim) => (claim.timeliness === "dated" && claim.ageAt !== undefined && (ageDays(claim.ageAt, new Date(pack.builtAt)) ?? 0) > 183 ? [{ url: claim.url, ageAt: claim.ageAt }] : [])),
      subjects: [...b.searches, ...b.names.filter((name) => name !== ""), ...pack.claims.map((claim) => claim.title), ...pack.links.map((link) => link.label)],
    },
  };
}

/** One page through stage 4: the checks, the repairs code can make (#1178) kept only where the page then passes or
 *  fails fewer checks, or fewer that stop it, and no new one, and the pages written for other sites (D13) where the
 *  rules passed. A fit check that could not run leaves the page saying nothing of the business. Each rule the first
 *  check failed is added to `broken`. */
export async function checkPage(
  c: CostContext,
  b: BatteryBasis,
  page: CheckedPage,
  written: string,
  at: { siteId: string; draftId: string; comparison: ComparisonSet; broken?: Set<HardRule>; fit?: FitVerdict },
  settled = false
) {
  let markdown = written;
  let outcome: BatteryOutcome = await runHardRules(c, batteryInputs(b, page, markdown, at.comparison, settled, at.fit));
  for (const failure of outcome.failed) at.broken?.add(failure.rule);
  const repairs: RepairRecord[] = [];
  const inputs = batteryInputs(b, page, markdown, at.comparison, settled);
  const reading = (text: string) => ({ title: page.title, markdown: text, businessName: b.site.businessName, domain: b.site.domain, titleOwed: (inputs.titleRule.business?.length ?? 0) > 0 });
  const stopping = (o: BatteryOutcome): Set<HardRule> => new Set(o.failed.filter((failure) => stops(failure, b.site.completeness)).map((failure) => failure.rule));
  if (outcome.fit.state === "unrun") {
    // With no sentence left that names the business, the fit check passes, and no call is made for it.
    const bare = withoutBusiness(markdown, b.site);
    const again = bare.dropped.length === 0 || brandSentences(reading(bare.markdown)).length > 0 ? null : await runHardRules(c, batteryInputs(b, page, bare.markdown, at.comparison, settled, { state: "passed" }));
    if (again !== null && [...stopping(again)].every((rule) => stopping(outcome).has(rule))) {
      repairs.push({ rule: "fit_claim", cleared: true, dropped: bare.dropped });
      markdown = bare.markdown;
      outcome = again;
    }
  }
  const tried = outcome.fit.state === "unrun" ? [] : repairable(outcome.failed);
  if (tried.length > 0) {
    const named = stillAsked(outcome.fit, reading(markdown));
    const mended = repairRecorded(markdown, tried, {
        brief: b.brief,
        sources: [
          ...b.facts.map((sourced) => ({ url: sourced.fact.url, text: sourced.sourceText })),
          ...b.pack.claims.map((claim) => ({ url: claim.url, text: claim.passage })),
        ],
        rivals: b.site.rivals,
        rivalsNamed: b.rivalsNamed,
        prose: inputs.prose,
        // Issue 2375: the sentences the fit check named.
        ...(named.state === "failed" ? { fit: named.sentences } : {}),
      });
    const repaired = b.sourced(mended.markdown);
    // The verdict stands for the sentences the repaired page still asks about; no fit call is bought again.
    const fit = stillAsked(outcome.fit, reading(repaired));
    const again = repaired === markdown ? null : await runHardRules(c, batteryInputs(b, page, repaired, at.comparison, settled, fit));
    const still = new Set(again === null ? [] : again.failed.map((failure) => failure.rule));
    for (const rule of tried) {
      const dropped = mended.dropped[rule];
      repairs.push({ rule, cleared: again !== null && !still.has(rule), ...(dropped === undefined ? {} : { dropped }) });
    }
    console.log(JSON.stringify({ event: "draft_repaired", siteId: at.siteId, draftId: at.draftId, repairs }));
    const narrower = (before: Set<HardRule>, now: Set<HardRule>): boolean => now.size < before.size && [...now].every((rule) => before.has(rule));
    const all = (o: BatteryOutcome): Set<HardRule> => new Set(o.failed.map((failure) => failure.rule));
    const fewer = again !== null && (narrower(all(outcome), all(again)) || narrower(stopping(outcome), stopping(again)));
    if (again !== null && fewer && (again.passed || !outcome.passed)) {
      markdown = repaired;
      outcome = again;
    }
  }
  const close = batteryCleared(outcome) ? await closeElsewhere({ siteId: at.siteId, markdown }) : null;
  return { markdown, outcome, repairs, close };
}

/** What a market fact says of a rival beyond its words (issue 1485): its
 *  kind, the rival it is from or about, and the plan it is true of. */
export function scopeOf(claim: PackClaim): { kind: string; product?: string; about?: string; plan?: string | null } {
  return {
    kind: claim.kind,
    ...(claim.product === undefined ? {} : { product: claim.product }),
    ...(claim.about === undefined ? {} : { about: claim.about }),
    ...(claim.plan === undefined ? {} : { plan: claim.plan }),
  };
}

/** A market fact as the page's row keeps it: its words, page, scope and the source's own dates. */
export const storedClaim = (claim: PackClaim) => ({ passage: claim.passage, url: claim.url, title: claim.title, readAt: claim.readAt, ...scopeOf(claim), ...datesOf(claim) });
