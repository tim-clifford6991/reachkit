// BUILD §8 — the generation engine's public entry point.
//
// Everything a caller outside `src/lib/generate/` may use, and nothing
// else. The individual rule modules, the model steps and the store port are
// internal: a caller that reached them could queue a page the battery never
// saw.
//
// `generateDayPage` is the whole of what the `draft/generate` job calls.
// It is the one place the day's page is assembled end to end:
//
//   * the freshest scan is found — §8: "the day's page is generated the
//     evening before from the freshest scan";
//   * the `CAP_DRAFT` context is opened around everything that spends;
//   * §7's `nextForDay` supplies the opportunity, and supplies nothing when
//     there is none: supply is the cap, and the calendar is never padded;
//   * the pipeline runs, and ADR-070's one automatic regeneration is
//     performed here — once, on the same row, and never for a draft that
//     has entered review;
//   * a draft the rules stopped for the last time rests in
//     `needs_attention` (#788) — it is never left in `generating`, which no
//     edge moves a stopped page out of — and its opportunity stays queued
//     behind it (issue 833), so no second page is written for that target
//     while the first waits for the founder.
//
// `regenerateRestarted` is the customer's Regenerate carried out: the
// restart moves the row back into `generating`, and the next draft tick
// rewrites that row for the date it already holds.
import {
  assessFixPages,
  assessReadiness,
  nextForDay,
  opportunityById,
  queueForDraft,
  type Opportunity,
} from "@/lib/opportunities";
import type { StoredReport } from "@/lib/scan/report";
import { withDraftCost } from "./cost";
import { recoveryOutcome } from "./claims/recovery";
import { readRecordedRules } from "./record";
import type { SiteRuleInputs } from "./rules/types";
import { clusterLinkTargets, siteLinkTargets } from "./links/select";
import { generateDraft, type GenerateOutcome } from "./pipeline";
import { generatePageFix } from "./pipeline/page-fix";
import { DraftDateTaken, generateStore, type RestartedDraft, type SiteFacts } from "./store";

export type { GroundedFact, HardRule, RuleFailure, ComparisonSet, SiteRuleInputs } from "./rules/types";
export { HARD_RULES } from "./rules/types";
export { runHardRules, type BatteryOutcome } from "./rules";
export { similarity } from "./rules/similarity";
export { renderOf } from "./rules/text";

export { claimCheck, type ClaimVerdict } from "./claims/check";
export { listHash } from "./claims/hash";
export { claimRecheckOutstanding, outstandingMatch } from "./claims/outstanding";
export { sweepOutstandingRechecks, type SweepOutcome } from "./claims/sweep";
export { recoveryOutcome, type Recovery } from "./claims/recovery";

export { generateDraft, type GenerateOutcome } from "./pipeline";
export { rejectionCause, type NearDuplicateCause } from "./pipeline/rejection";
export { type PipelineStep } from "./pipeline/steps";
export { type DraftPromptInputs, DRAFT_PROMPT_KEYS } from "./voice/inputs";
export { DraftDateTaken, setGenerateStore, type GenerateStore, type RestartedDraft } from "./store";
export { withDraftCost } from "./cost";

/** Why a day has no page. Every arm is a fact, and none of them is a
 *  sentence: the calendar's own module owns the words. */
export type DayPageOutcome =
  | { ok: true; draftId: string }
  | { ok: false; because: "no_site" }
  | { ok: false; because: "no_scan" }
  /** SPEC §7: a date holds at most one asset, and this one already has its
   *  draft — the first draft's kickoff wrote it, or a tick ran twice.
   *  Reached two ways (issue 886): the read below, which is what saves a
   *  second delivery's model calls, and `drafts_one_per_site_per_date`,
   *  which decides two deliveries that both read no row. */
  | { ok: false; because: "already_drafted" }
  /** §7: supply is the cap. Nothing was invented to fill the day. */
  | { ok: false; because: "no_opportunity" }
  /** A restart that is no longer waiting: the row is gone, is another
   *  site's, or has left `generating` since it was found. */
  | { ok: false; because: "no_draft" }
  | { ok: false; because: "rules"; draftId: string | null; attempts: number }
  | { ok: false; because: "step_failed"; draftId: string | null; step: string };

/** ADR-070: "one automatic regeneration". Two attempts in total, and the
 *  second only where the first was stopped by a rule and the draft had not
 *  entered review — which, on this path, it never has. */
const MAX_AUTOMATIC_ATTEMPTS = 2;

export async function generateDayPage(a: {
  siteId: string;
  /** The site-local calendar date the page is for. */
  publishDate: string;
}): Promise<DayPageOutcome> {
  const store = generateStore();

  const site = await store.siteFacts(a.siteId);
  if (site === null) return { ok: false, because: "no_site" };
  // Issue 886: the tick that delivers this twice stops here, before the
  // first paid call. The read is not the whole protection — two deliveries
  // running together both pass it — so the day's row is unique in the
  // database too, and the loser of that race is caught below.
  if (await store.draftOnDate(a.siteId, a.publishDate)) return { ok: false, because: "already_drafted" };

  // §8: "the day's page is generated the evening before from the freshest
  // scan." No scan, no measured pages — and no measured pages is no
  // grounded fact, which §8 leaves no way around.
  const report = await store.latestReport(a.siteId);
  if (report === null) return { ok: false, because: "no_scan" };

  // SPEC §9 (#690): the freshest scan retires the fixes it shows cleared,
  // and the rest have their readiness read against today's destination —
  // before the day is picked, so a fix the destination can no longer make
  // is not the page chosen.
  await assessFixPages(a.siteId, { report });
  // SPEC §6: and every other open row's readiness, so the day is picked
  // from rows with an answer as of tonight.
  await assessReadiness(a.siteId, { at: report.verdict.measuredAt });

  const opportunity = await nextForDay(a.siteId);
  if (opportunity === null) return { ok: false, because: "no_opportunity" };

  const page = { siteId: a.siteId, site, report, opportunity, publishDate: a.publishDate };
  // A fix is a metadata-only update: one call, no regeneration loop — the
  // only rule it can fail is the customer's own do-not-claim list, which a
  // second attempt at the same page would read the same way.
  let outcome: DayPageOutcome;
  try {
    outcome =
      opportunity.type === "fix_page"
        ? await fixPage(page)
        : await writePage({ ...page, attempts: MAX_AUTOMATIC_ATTEMPTS });
  } catch (error) {
    // Issue 886: another delivery of this tick wrote the date's row while
    // this one was writing its page. The index refused the second row, so
    // the day has exactly one page; this run wrote nothing, moves nothing,
    // and leaves its opportunity open the way any run that wrote no row
    // does.
    if (error instanceof DraftDateTaken) return { ok: false, because: "already_drafted" };
    throw error;
  }
  await settle(outcome, opportunity.id);
  return outcome;
}

/** Drafts the customer restarted and no run has regenerated yet — one a
 *  site, oldest first, so a tick spends at most one page on each. */
export async function restartedDrafts(siteIds: readonly string[]): Promise<readonly RestartedDraft[]> {
  const seen = new Set<string>();
  return (await generateStore().restartedDrafts(siteIds)).filter((row) => {
    if (seen.has(row.siteId)) return false;
    seen.add(row.siteId);
    return true;
  });
}

/**
 * The customer's Regenerate (#788), carried out: the page is written again
 * on the row and for the date it already holds, from the opportunity it was
 * written for. One attempt — ADR-070 bounds the *automatic* ones, and this
 * is the customer's. It ends where the evening's run ends: a passing page
 * for review, or a stopped one back in `needs_attention`.
 */
export async function regenerateRestarted(a: { siteId: string; draftId: string }): Promise<DayPageOutcome> {
  const store = generateStore();
  const row = await store.draftById(a.draftId);
  if (row === null || row.site_id !== a.siteId || row.state !== "generating" || row.scheduled_for === null) {
    return { ok: false, because: "no_draft" };
  }
  const site = await store.siteFacts(a.siteId);
  if (site === null) return { ok: false, because: "no_site" };
  const report = await store.latestReport(a.siteId);
  if (report === null) return { ok: false, because: "no_scan" };
  const opportunity = await opportunityById(row.opportunity_id);
  if (opportunity === null) return { ok: false, because: "no_opportunity" };

  const page = { siteId: a.siteId, site, report, opportunity, publishDate: row.scheduled_for, draftId: row.id };
  const outcome =
    opportunity.type === "fix_page" ? await fixPage(page) : await writePage({ ...page, attempts: 1 });
  await settle(outcome, opportunity.id);
  return outcome;
}

interface PageInput {
  siteId: string;
  site: SiteFacts;
  report: StoredReport;
  opportunity: Opportunity;
  publishDate: string;
  /** The date's row, where one is already written. */
  draftId?: string;
}

/**
 * What a run's outcome does to its row and its opportunity.
 *
 * SPEC §7 (2026-09-15, issue 712): a written draft queues its opportunity.
 * A draft the rules stopped for the last time rests in `needs_attention`
 * (#788), and so does a row a step stopped for the last time (#813), its
 * reason naming the step. Either way the stopped draft counts as queued
 * (owner, 2026-09-17, issue 833): its opportunity is queued too, and only
 * the founder's Skip releases it. A run that wrote no row moves neither.
 */
async function settle(outcome: DayPageOutcome, opportunityId: string): Promise<void> {
  if (outcome.ok) {
    await queueForDraft(opportunityId);
    return;
  }
  if (outcome.because === "rules" && outcome.draftId !== null) {
    await rest(outcome.draftId, opportunityId, await rulesReason(outcome.draftId));
    return;
  }
  if (outcome.because === "step_failed" && outcome.draftId !== null) {
    await rest(outcome.draftId, opportunityId, `step_failed:${outcome.step}`);
  }
}

/** The move's reason for a rule stop: the rules on the row. */
async function rulesReason(draftId: string): Promise<string> {
  const row = await generateStore().draftById(draftId);
  const failed = readRecordedRules(row?.rule_failures) ?? [];
  return `rules:${failed.map((failure) => failure.rule).join(",")}`;
}

/**
 * §8 rule 4, "twice = needs-attention" (#788): the stopped page leaves
 * `generating` for the state the customer can act on, and its opportunity
 * is held `queued` behind it (issue 833). The rules that stopped it are on the row already
 * (`rule_failures`, which the draft view lists); the move's record names
 * them too — or names the step that could not run (#813).
 *
 * Never a throw on a refused move: the page is stopped either way, and a
 * row another mover moved first is logged rather than forced.
 */
async function rest(draftId: string, opportunityId: string, reason: string): Promise<void> {
  const { transition } = await import("@/lib/publish/machine");
  const moved = await transition(draftId, "needs_attention", { kind: "system", job: "draft/generate" }, { reason });
  if (!moved.ok) {
    console.log(JSON.stringify({ event: "draft_not_rested", draftId, refused: moved.refused, state: moved.state }));
  }
  await queueForDraft(opportunityId);
}

async function fixPage(a: PageInput): Promise<DayPageOutcome> {
  const pageUrl = a.opportunity.targetRef;
  const { readSiteProfile } = await import("@/lib/site-profile/store");
  const profile = await readSiteProfile(a.site.domain);
  const otherTitles = (profile?.inventory ?? [])
    .filter((row) => row.url !== pageUrl && row.title !== "")
    .map((row) => row.title);
  return withDraftCost({ scanId: a.report.scanId }, async (cost): Promise<DayPageOutcome> => {
    const fixed = await generatePageFix(cost, {
      siteId: a.siteId,
      opportunity: a.opportunity,
      scheduledFor: a.publishDate,
      domain: a.site.domain,
      doNotClaim: a.site.doNotClaim,
      voiceText: a.site.voiceText,
      otherTitles,
      ...(a.draftId === undefined ? {} : { draftId: a.draftId }),
    });
    if (fixed.ok) return { ok: true, draftId: fixed.draftId };
    if (fixed.reason === "step_failed") {
      return { ok: false, because: "step_failed", draftId: fixed.draftId, step: fixed.step };
    }
    return { ok: false, because: "rules", draftId: fixed.draftId, attempts: fixed.attempt };
  });
}

async function writePage(a: PageInput & { attempts: number }): Promise<DayPageOutcome> {
  const store = generateStore();
  const { site, report, opportunity } = a;

  // The one name the product holds for the business is the brand the
  // profile measured off their own home page — what the site calls itself.
  // It is a measurement, and the brand-gap and quotation rules read it as
  // one. It is deliberately **not** written to `drafts.attribution`: an
  // attribution has to be a name the customer recorded, and no column
  // records one yet, so a page publishes with no attribution rather than a
  // derived one (§8 hard rule 2).
  const measuredBrand =
    report.market.kind === "unmeasured" ? null : (report.market.value.profile.brandTokens[0] ?? null);

  const ruleInputs: SiteRuleInputs = {
    businessName: measuredBrand,
    domain: site.domain,
    doNotClaim: site.doNotClaim,
    rivals: site.rivals,
    report,
    // The register's other half. Every figure an opportunity carries was
    // copied out of the scan that derived it, so the report walk above
    // already registers it; the list is passed so a target that outlives
    // its report still contributes its own evidence.
    opportunities: [opportunity],
  };

  const category =
    report.market.kind === "unmeasured" ? "" : report.market.value.profile.category;

  // SPEC §7 (2026-09-12): the site's own pages from the profile's
  // inventory, and the cluster's earlier live pages. Read once for the
  // day, so a regeneration links the same pages as the attempt it replaces.
  const inventory = await store.siteInventory(site.domain);
  const earlier =
    opportunity.clusterKey === null ? [] : await store.clusterPages(a.siteId, opportunity.clusterKey);
  const links = [
    ...siteLinkTargets({
      domain: site.domain,
      inventory,
      query: opportunity.targetQuery ?? "",
      selfUrl: opportunity.family === "improve" ? opportunity.targetRef : null,
    }),
    ...clusterLinkTargets(earlier),
  ];

  return withDraftCost({ scanId: report.scanId }, async (cost): Promise<DayPageOutcome> => {
    let last: GenerateOutcome | null = null;
    // #788: one row for the date across every attempt — an attempt after
    // the first rewrites the row the first one wrote.
    let draftId = a.draftId;
    let ruleStopped = false;
    for (let attempt = 1; attempt <= a.attempts; attempt++) {
      last = await generateDraft(cost, {
        siteId: a.siteId,
        opportunity,
        scheduledFor: a.publishDate,
        site: ruleInputs,
        voiceText: site.voiceText,
        category,
        links,
        scanId: report.scanId,
        ...(draftId === undefined ? {} : { draftId }),
      });
      if (last.draftId !== null) draftId = last.draftId;
      if (last.ok) return { ok: true, draftId: last.draftId };
      if (last.reason === "step_failed") {
        // A step that did not run before any row was written leaves nothing
        // to rest: the opportunity stays open for the next evening.
        if (draftId === undefined) {
          return { ok: false, because: "step_failed", draftId: null, step: last.step };
        }
        // After a rule already stopped this date's row, a regeneration that
        // could not run leaves that stop standing: the row rests on it
        // rather than waiting in `generating` for a run nothing will make.
        if (ruleStopped) return { ok: false, because: "rules", draftId, attempts: attempt - 1 };
        // #813: a row a step stopped takes the automatic second attempt a
        // rule stop takes — a model that did not answer may answer now. The
        // ceiling would stop that attempt too, so it rests at once.
        if (attempt < a.attempts && !cost.capHit()) continue;
        return { ok: false, because: "step_failed", draftId, step: last.step };
      }
      ruleStopped = true;
      if (
        recoveryOutcome({
          failed: last.failed.map((failure) => failure.rule),
          automaticAttempts: attempt - 1,
          enteredReview: false,
        }) === "rest"
      ) {
        break;
      }
    }
    const stopped = last;
    if (stopped === null || stopped.ok || stopped.reason !== "rules") {
      return { ok: false, because: "rules", draftId: draftId ?? null, attempts: a.attempts };
    }
    return { ok: false, because: "rules", draftId: draftId ?? null, attempts: stopped.attempt };
  });
}
