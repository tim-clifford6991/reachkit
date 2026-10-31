// SPEC §7 (owner O7, docs/spec/decisions/2026-10-31-2160.md) — a page the rules stopped is read again under today's
// rules at the start of its site's daily run, at 0¢, and the newest that passes enters review with a fresh veto window.
//
// A candidate never entered review, was stopped by the rules at generation, carries no edit of the customer's, has a
// body, and was written from a pack no older than a topic's rest. Its stored words go through the same battery a page
// as written does (`./pipeline/battery.ts`), with every model call refused: the fit check's stored verdict stands for
// the sentences today's reading still asks about. A title carrying the business's promise figure is held (OR4).
import { TOPIC_REST_DAYS } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import type { Opportunity } from "@/lib/opportunities";
import type { Actor, TransitionRecord } from "@/lib/publish/types";
import { brandSentences, type FitVerdict } from "./claims/fit";
import { readRecordedFact } from "./fact";
import { batteryBasis, checkPage, siteRulesOf } from "./pipeline/battery";
import { buildComparisonSet } from "./pipeline/comparison";
import { allowedFacts, readAllFacts, readDemoPhrases, type SourcedFact } from "./pipeline/grounding";
import type { ContextPack } from "./pipeline/pack";
import { promiseFigures, titleRuleFor } from "./pipeline/title";
import { readRecordedRules, readRecordedRun, recordedRulesValue, recordedRunValue, recordedVerdictValue } from "./record";
import { batteryCleared } from "./rules";
import type { HardRule, RuleFailure, SiteRuleInputs } from "./rules/types";
import { generateStore, type DraftPatch, type DraftRow } from "./store";
import { confirmedForWriting } from "./voice/confirmed";

const RECHECK: Actor = { kind: "system", job: "draft/recheck" };
const DAY_MS = 86_400_000;
/** A site's rows short of hand-off are its pages in flight, far fewer than this. */
const ROWS_READ = 200;

/** Every model call refused, so the re-check buys nothing. */
const REFUSED: CostContext = {
  cap: "DRAFT",
  recordFetch: async () => ({ skipped: "cap" }),
  capHit: () => true,
  spentCents: () => 0,
  degraded: () => false,
};

export type NotCandidate = "not_stopped" | "entered_review" | "edited" | "no_page" | "not_rules" | "stale";

export interface RecheckWorld {
  site: SiteRuleInputs;
  facts: readonly SourcedFact[];
  demoPhrases?: readonly string[];
  opportunity: Opportunity;
  now: Date;
}

export type RecheckOutcome =
  | { kind: "skipped"; reason: NotCandidate }
  | { kind: "held"; reason: "title_promise_figure"; figures: string[] }
  | { kind: "checked"; passed: boolean; failed: RuleFailure[]; cleared: HardRule[]; spentCents: number; patch: DraftPatch };

type Meta = Record<string, unknown>;
const metaOf = (row: DraftRow): Meta => (typeof row.meta === "object" && row.meta !== null ? (row.meta as Meta) : {});
const packOf = (row: DraftRow): ContextPack | null => (metaOf(row).pack as ContextPack | undefined) ?? null;
const builtAt = (row: DraftRow): number => Date.parse(packOf(row)?.builtAt ?? "");

/** Why a stored row is not re-checked, or `null` where it is. */
export function candidacy(row: DraftRow, now: Date): NotCandidate | null {
  if (row.state !== "needs_attention") return "not_stopped";
  const moves = Array.isArray(row.transitions) ? (row.transitions as Partial<TransitionRecord>[]) : [];
  if (moves.some((move) => move?.to === "in_review")) return "entered_review";
  if (metaOf(row).first_edited_at !== undefined) return "edited";
  if (!row.body_md || packOf(row) === null || readRecordedFact(row.grounded_fact) === null) return "no_page";
  const last = moves.at(-1);
  if (last?.from !== "generating" || !(last.reason ?? "").startsWith("rules:")) return "not_rules";
  return now.getTime() - builtAt(row) <= TOPIC_REST_DAYS * DAY_MS ? null : "stale";
}

/** One stored row under today's rules: what it fails now, and what to record. Reads only the site's own pages and
 *  the pages written for other sites; writes nothing. */
export async function recheckRow(row: DraftRow, world: RecheckWorld): Promise<RecheckOutcome> {
  const skipped = candidacy(row, world.now);
  if (skipped !== null) return { kind: "skipped", reason: skipped };
  const pack = packOf(row)!;
  const markdown = row.body_md!;
  const title = row.title ?? "";
  const figures = promiseFigures(title, pack);
  if (figures.length > 0) return { kind: "held", reason: "title_promise_figure", figures };

  const meta = metaOf(row);
  const recorded = readRecordedFact(row.grounded_fact)!;
  const grounding = world.facts.find((sourced) => sourced.fact.passage === recorded.passage) ?? {
    fact: { passage: recorded.passage, url: recorded.url, readAt: recorded.readAt ?? new Date(0) },
    sourceText: "",
  };
  const basis = batteryBasis({ pack, opportunity: world.opportunity, site: world.site, facts: world.facts, grounding, ...(world.demoPhrases === undefined ? {} : { demoPhrases: world.demoPhrases }) });
  const page = {
    title,
    heading: typeof meta.heading === "string" ? meta.heading : title,
    description: typeof meta.description === "string" ? meta.description : "",
    sections: Array.isArray(meta.sections) ? meta.sections : [],
    faq: Array.isArray(meta.faq) ? meta.faq : [],
  };
  const stopped = readRecordedRules(row.rule_failures) ?? [];
  const fit = storedFit(row, stopped, { title, markdown, site: world.site, titleOwed: (titleRuleFor(pack, page).business?.length ?? 0) > 0 });
  const comparison = await buildComparisonSet({ siteId: row.site_id, exceptDraftId: row.id });
  const broken = new Set<HardRule>();
  const checked = await checkPage(REFUSED, basis, page, markdown, { siteId: row.site_id, draftId: row.id, comparison, broken, ...(fit === undefined ? {} : { fit }) }, row.hard_rule_attempts >= 2);

  const failed = recordedRulesValue(checked.outcome);
  const passed = batteryCleared(checked.outcome) && checked.close === null;
  const priorRepairs = Array.isArray(meta.repairs) ? meta.repairs : [];
  return {
    kind: "checked",
    passed,
    failed,
    cleared: [...new Set(stopped.map((failure) => failure.rule))].filter((rule) => !failed.some((failure) => failure.rule === rule)),
    spentCents: REFUSED.spentCents(),
    patch: {
      body_md: checked.markdown,
      meta: { ...meta, checks: recordedRunValue(checked.outcome, broken), ...(checked.repairs.length === 0 ? {} : { repairs: [...priorRepairs, ...checked.repairs] }) },
      claim_check: recordedVerdictValue(checked.outcome.claim),
      rule_failures: failed,
      hard_rules_passed: passed,
    },
  };
}

/** The fit check's stored verdict, kept only for the sentences today's reading still asks about. `undefined` where no
 *  fit check was recorded, which a refused call then leaves unrun. */
function storedFit(row: DraftRow, stopped: readonly RuleFailure[], page: { title: string; markdown: string; site: SiteRuleInputs; titleOwed: boolean }): FitVerdict | undefined {
  const failure = stopped.find((each) => each.rule === "fit_claim");
  if (failure?.detail?.rule !== "fit_claim") return readRecordedRun(row.meta)?.asked.includes("fit_claim") === true ? { state: "passed" } : undefined;
  const asked = new Set(brandSentences({ title: page.title, markdown: page.markdown, businessName: page.site.businessName, domain: page.site.domain, titleOwed: page.titleOwed }));
  const still = failure.detail.sentences.filter((sentence) => asked.has(sentence));
  return still.length === 0 ? { state: "passed" } : { state: "failed", sentences: still };
}

/** The daily re-check for one site and date: nothing where the date already holds a page; otherwise the newest
 *  candidate that passes enters review. The id of a page entered and told, or `null`. Never a throw: a re-check that
 *  could not read leaves the day to its own write. */
export async function recheckStopped(a: { siteId: string; publishDate: string; now: Date }): Promise<string | null> {
  try {
    return await rescue(a);
  } catch (error) {
    console.warn(JSON.stringify({ event: "draft_recheck_failed", siteId: a.siteId, error: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

async function rescue(a: { siteId: string; publishDate: string; now: Date }): Promise<string | null> {
  const store = generateStore();
  if (await store.draftOnDate(a.siteId, a.publishDate)) return null;
  const rows = (await store.draftsShortOfHandOff(a.siteId, ROWS_READ)).filter((row) => candidacy(row, a.now) === null).sort((x, y) => builtAt(y) - builtAt(x));
  if (rows.length === 0) return null;
  const site = await store.siteFacts(a.siteId);
  const report = await store.latestReport(a.siteId);
  if (site === null || report === null) return null;

  const confirmed = await confirmedForWriting({ siteId: a.siteId, domain: site.domain });
  const facts = allowedFacts(await readAllFacts({ siteId: a.siteId, scanId: report.scanId }), confirmed.factsOff);
  const demoPhrases = [...(await readDemoPhrases({ siteId: a.siteId, scanId: report.scanId }).catch(() => [])), ...confirmed.factsOff];
  const { opportunityById } = await import("@/lib/opportunities");
  for (const row of rows) {
    const opportunity = await opportunityById(row.opportunity_id);
    if (opportunity === null) continue;
    const outcome = await recheckRow(row, { site: siteRulesOf(site, report), facts, demoPhrases, opportunity, now: a.now });
    console.log(JSON.stringify({ event: "draft_rechecked", siteId: a.siteId, draftId: row.id, outcome: outcome.kind === "checked" ? (outcome.passed ? "passed" : "failed") : outcome.reason, ...(outcome.kind === "checked" ? { failed: outcome.failed.map((failure) => failure.rule).join(",") } : {}) }));
    if (outcome.kind !== "checked") continue;
    await store.patchDraft(row.id, outcome.patch);
    if (!outcome.passed) continue;
    const { enterReview } = await import("@/lib/publish/attempt/window");
    const entry = await enterReview({ draftId: row.id, at: a.now, by: RECHECK, reason: `recheck:${outcome.cleared.join(",")}` });
    // A page that could not enter review is not left marked as one that may.
    if (entry.kind === "not_entered") await store.patchDraft(row.id, { hard_rules_passed: false });
    return entry.kind === "told" ? row.id : null;
  }
  return null;
}
