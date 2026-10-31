// SPEC §7 (D41 stage 4) — what the hard rules read of a page, and the one pass over it: the checks, the
// repairs code can make, and the pages written for other sites. Built here once so a page as written and a stored page
// re-checked (`../recheck.ts`) are read by the same inputs.
import type { CostContext } from "@/lib/costs";
import type { Opportunity } from "@/lib/opportunities";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import type { FitVerdict } from "../claims/fit";
import { lengthRangeFor, sectionWords } from "../length";
import { batteryCleared, runHardRules, type BatteryOutcome } from "../rules";
import { namedRivals } from "../rules/rivals";
import { renderOf } from "../rules/text";
import type { ComparisonSet, HardRule, SiteRuleInputs } from "../rules/types";
import type { SiteFacts } from "../store";
import type { StoredReport } from "@/lib/scan/report";
import { voiceLength } from "../voice/register";
import type { LaidSection } from "./compose";
import { closeElsewhere } from "./elsewhere";
import type { SourcedFact } from "./grounding";
import { builtFromOutside, fittedTemplate, packStatements, type ContextPack, type PackClaim } from "./pack";
import { repairable, repairMechanical, type RepairRecord } from "./repair";
import { reportFactsAllowed } from "./report-scope";
import { withSources } from "./sources";
import { comparisonTable } from "./table";
import { titleRuleFor } from "./title";
import type { FaqEntry } from "./write";

/** The site as the rules read it. The one name the product holds for the business is the brand the profile measured
 *  off their own home page: what the site calls itself. */
export function siteRulesOf(site: Pick<SiteFacts, "domain" | "doNotClaim" | "rivals">, report: StoredReport): SiteRuleInputs {
  const businessName = report.market.kind === "unmeasured" ? null : (report.market.value.profile.brandTokens[0] ?? null);
  return { businessName, domain: site.domain, doNotClaim: site.doNotClaim, rivals: site.rivals };
}

/** What one page's checks read that its words do not change: its pack, its type and the customer's own sets. */
export function batteryBasis(a: {
  pack: ContextPack;
  opportunity: Opportunity;
  site: SiteRuleInputs;
  /** The customer's own passages, each with the page it was read on. */
  facts: readonly SourcedFact[];
  /** The passage the page stands on (§8 hard rule 1). */
  grounding: SourcedFact;
  demoPhrases?: readonly string[];
}) {
  const { pack, site } = a;
  const template = fittedTemplate(pack);
  const liveWords = pack.live === null ? null : sectionWords(pack.live.markdown);
  // Issue 1390: a short answer is capped at its own length, not its type's.
  // Issue 1521: a refresh that may add sections on what the pages above it
  // cover may grow to the update's grown share.
  const length = lengthRangeFor(template, { questions: pack.questions.length, cap: voiceLength(pack.voice)?.ceiling, liveWords, grown: pack.gaps !== undefined });
  // D47: a comparison written as a Q&A for want of two rivals compares
  // nobody, so it is told to answer, not to compare.
  const becameQa = pack.type === "qa" && contentTypeOf(a.opportunity) === "listicle";
  const pageType = becameQa && pageTypeOf(a.opportunity) === "market_comparison" ? "answer" : pageTypeOf(a.opportunity);
  // D47: the listicle's table, laid out from the pack before a word is
  // written. The writer is handed the same one (`./write.ts`).
  const table = pack.type === "listicle" && template.blocks.table !== undefined ? comparisonTable(pack, template.blocks.table.rivals) : null;
  const searches = pack.target.searches;
  const names = [site.businessName ?? "", site.domain.split(".")[0] ?? "", ...site.rivals];
  const passages = [...pack.facts.map((fact) => fact.passage), ...packStatements(pack)];
  const cited = pack.claims.map((claim) => ({ ...claim, readAt: new Date(claim.readAt) }));
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
  /** What `cites_market` holds the page to: the template's own count. */
  const citesMin = template.packMustHold.reduce((most, need) => (need.need === "outside_sources" ? Math.max(most, need.min) : most), 0);
  return { ...a, template, length, pageType, table, searches, names, passages, cited, brief, citesMin, rivalsNamed: namedRivals(site.rivals, pack.business.market) };
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
    grounded: b.grounding.fact,
    sourceText: b.grounding.sourceText,
    brief: b.brief,
    factPages: pack.facts.map((fact) => fact.url),
    blocks: {
      template: b.template,
      sections: page.sections,
      length: b.length,
      faq: page.faq,
      domain: site.domain,
      // D52: the rivals the verdict may name as the better pick.
      // Issue 1508: never the baseline, which no verdict may choose.
      ...(b.table === null ? {} : { rivals: b.table.options.slice(1) }),
      ...(b.table?.baseline == null ? {} : { baseline: b.table.baseline }),
      // Issue 1486: a step that names the business is its own.
      businessName: site.businessName,
      // Issue 1521: what a growing refresh may add, and on what.
      ...(pack.type === "update" && pack.live !== null && pack.gaps !== undefined ? { growth: { live: pack.live.markdown, gaps: pack.gaps } } : {}),
    },
    titleRule: { ...titleRuleFor(pack, { description: page.description, sections: page.sections }), settled },
    // D61: a Q&A's questions are each their own.
    distinctHeadings: pack.type === "qa",
    // Issue 1486: a how-to or a Q&A links the outside pages it is built
    // from.
    ...(builtFromOutside(pack.type) ? { cites: { claimUrls: pack.claims.map((claim) => claim.url), min: b.citesMin } } : {}),
    heading: page.heading,
    rivalsNamed: b.rivalsNamed,
    ...(b.demoPhrases === undefined ? {} : { demoPhrases: b.demoPhrases }),
    // Issue 1390: how the page reads. A passage stated word for word is
    // not the writer's, and the page's own subject may be said as often
    // as it needs.
    prose: {
      language: pack.locale?.language ?? "en",
      passages: [...pack.facts.map((fact) => fact.passage), ...pack.claims.map((claim) => claim.passage)],
      subjects: [...b.searches, ...b.names.filter((name) => name !== ""), ...pack.claims.map((claim) => claim.title), ...pack.links.map((link) => link.label)],
    },
  };
}

/** One page through stage 4: the checks, the repairs code can make (#1178) kept only where the page then passes or
 *  fails fewer checks and no new one, and the pages written for other sites (D13) where the rules passed. Each rule the
 *  first check failed is added to `broken`. */
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
  if (!outcome.passed) for (const failure of outcome.failed) at.broken?.add(failure.rule);
  const repairs: RepairRecord[] = [];
  const tried = outcome.passed || outcome.fit.state === "unrun" ? [] : repairable(outcome.failed);
  if (tried.length > 0) {
    const repaired = withSources(
      repairMechanical(markdown, tried, {
        brief: b.brief,
        sources: [
          ...b.facts.map((sourced) => ({ url: sourced.fact.url, text: sourced.sourceText })),
          ...b.pack.claims.map((claim) => ({ url: claim.url, text: claim.passage })),
        ],
        rivals: b.site.rivals,
        rivalsNamed: b.rivalsNamed,
      }),
      b.cited
    );
    const again = repaired === markdown ? null : await runHardRules(c, batteryInputs(b, page, repaired, at.comparison, settled, outcome.fit));
    const still = new Set(again === null || again.passed ? [] : again.failed.map((failure) => failure.rule));
    for (const rule of tried) repairs.push({ rule, cleared: again !== null && !still.has(rule) });
    console.log(JSON.stringify({ event: "draft_repaired", siteId: at.siteId, draftId: at.draftId, repairs }));
    const before = new Set(outcome.passed ? [] : outcome.failed.map((failure) => failure.rule));
    const fewer = again !== null && !again.passed && again.failed.length < before.size && again.failed.every((failure) => before.has(failure.rule));
    if (again !== null && (batteryCleared(again) || fewer)) {
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
