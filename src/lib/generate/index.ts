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
//     edge moves a stopped page out of — and its topic rests for 28 days
//     (owner, D26, issue 1179), so the next evening does not fail the same
//     page again;
//   * a stopped draft does not cost its day (D26): the same run writes the
//     next-ranked opportunity for the date, at most once more and inside
//     the one `CAP_DRAFT` context. The stopped row keeps its place in
//     `needs_attention` and gives up its date to the page that replaces it;
//   * a new page that adds too little the web and the site do not already
//     say (owner, D12, issue 1143) is written again, on its own row, as an
//     update of the closest existing page where the site has one; otherwise
//     it rests in `needs_attention`, asking the founder for the missing fact.
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
  restTopic,
  sitePagesFor,
  updateInstead,
  type Opportunity,
} from "@/lib/opportunities";
import type { StoredReport } from "@/lib/scan/report";
import type { CostContext } from "@/lib/costs";
import { DAY_TOPICS_MAX, KNOWN_CONTENT } from "@/lib/config/constants";
import { pageScore } from "@/lib/known-content/match";
import type { KnownPage } from "@/lib/known-content/types";
import type { KnownPageBrief } from "./voice/inputs";
import { withDraftCost } from "./cost";
import { recoveryOutcome } from "./claims/recovery";
import { readRecordedRules } from "./record";
import type { SiteRuleInputs } from "./rules/types";
import { confirmedForWriting } from "./voice/confirmed";
import { writingMarket } from "./voice/market";
import {
  clusterLinkTargets,
  knownLinkTargets as knownContentTargets,
  siteLinkTargets,
} from "./links/select";
import { generateDraft, type GenerateOutcome } from "./pipeline";
import { generatePageFix } from "./pipeline/page-fix";
import type { FixNote } from "./pipeline/repair";
import { NO_RESEARCH, researchMarket } from "./pipeline/research";
import { targetSearches } from "./pipeline/steps";
import { DraftDateTaken, generateStore, type RestartedDraft, type SiteFacts } from "./store";

export type { GroundedFact, HardRule, RuleFailure, ComparisonSet, SiteRuleInputs } from "./rules/types";

/**
 * The pages the site already has that are nearest this one (#928), as the
 * prompt states them.
 *
 * Bounded and ranked by the one measure: a list of everything the site has
 * is not a list the model can use, and the pages worth naming are the ones
 * near the topic. A page still waiting is named too — it has no address and
 * is not a link, but it is a topic this site is about to cover and the page
 * being written must not be the second one about it.
 */
function nearestKnown(pages: readonly KnownPage[], query: string): KnownPageBrief[] {
  if (query.trim() === "") return [];
  return [...pages]
    .map((page) => ({ page, score: pageScore({ query }, page) }))
    .filter((scored) => scored.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, KNOWN_CONTENT.PROMPT_PAGES_MAX)
    .map(({ page }) => ({ title: page.title, url: page.url }));
}
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
  | {
      ok: false;
      because: "rules";
      draftId: string | null;
      attempts: number;
      /** The rules that stopped the last attempt and the sentences that broke
       *  them, where the run that stopped it held them (issue 1187). */
      stopped?: readonly FixNote[];
    }
  | { ok: false; because: "step_failed"; draftId: string | null; step: string };

/** ADR-070: "one automatic regeneration". Two attempts in total, and the
 *  second only where the first was stopped by a rule and the draft had not
 *  entered review — which, on this path, it never has. */
const MAX_AUTOMATIC_ATTEMPTS = 2;

export async function generateDayPage(a: {
  siteId: string;
  /** The site-local calendar date the page is for. */
  publishDate: string;
  /** The run's clock: what a topic's rest is counted from and read against. */
  now?: Date;
}): Promise<DayPageOutcome> {
  const store = generateStore();
  const now = a.now ?? new Date();

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
  await assessFixPages(a.siteId, { report, now });
  // SPEC §6: and every other open row's readiness, so the day is picked
  // from rows with an answer as of tonight.
  await assessReadiness(a.siteId, { at: report.verdict.measuredAt, now });

  const first = await nextForDay(a.siteId);
  if (first === null) return { ok: false, because: "no_opportunity" };

  try {
    // One `CAP_DRAFT` context for the day, whichever topic fills it.
    return await withDraftCost({ scanId: report.scanId }, async (cost): Promise<DayPageOutcome> => {
      let opportunity = first;
      for (let topic = 1; ; topic++) {
        const page = { siteId: a.siteId, site, report, opportunity, publishDate: a.publishDate };
        // Each row carries what its own page cost, not the day's.
        const own = sinceNow(cost);
        // A fix is a metadata-only update: one call, no regeneration loop —
        // the only rule it can fail is the customer's own do-not-claim list,
        // which a second attempt at the same page would read the same way.
        const outcome =
          opportunity.type === "fix_page"
            ? await fixPage(page, own)
            : await writePage({ ...page, attempts: MAX_AUTOMATIC_ATTEMPTS }, own);
        await settle(outcome, opportunity.id, now, site.domain);

        // SPEC §7 (D26, issue 1179): a stopped draft does not cost its day.
        // Only a row that was written and stopped is moved on from — a run
        // that wrote none rested nothing, and its topic is still the head.
        const stopped = stoppedRow(outcome);
        if (stopped === null || topic >= DAY_TOPICS_MAX || cost.capHit()) return outcome;
        // The stopped topic rests by now, so the head is the next one.
        const next = await nextForDay(a.siteId);
        if (next === null || next.id === first.id) return outcome;
        // It keeps its row and gives up its date to the page written next.
        await store.patchDraft(stopped, { scheduled_for: null });
        opportunity = next;
      }
    });
  } catch (error) {
    // Issue 886: another delivery of this tick wrote the date's row while
    // this one was writing its page. The index refused the second row, so
    // the day has exactly one page; this run wrote nothing, moves nothing,
    // and leaves its opportunity open the way any run that wrote no row
    // does.
    if (error instanceof DraftDateTaken) return { ok: false, because: "already_drafted" };
    throw error;
  }
}

/** The row a run wrote and the rules or a step then stopped, if it did. */
function stoppedRow(outcome: DayPageOutcome): string | null {
  if (outcome.ok) return null;
  return outcome.because === "rules" || outcome.because === "step_failed" ? outcome.draftId : null;
}

/** The day's cost context as one page sees it: the same ceiling, and a
 *  spend counted from here. */
function sinceNow(cost: CostContext): CostContext {
  const before = cost.spentCents();
  return before === 0 ? cost : { ...cost, spentCents: () => cost.spentCents() - before };
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
export async function regenerateRestarted(a: {
  siteId: string;
  draftId: string;
  now?: Date;
}): Promise<DayPageOutcome> {
  const store = generateStore();
  const row = await store.draftById(a.draftId);
  // A stopped row that gave up its date (issue 1179) is rewritten without
  // one; `enterReview` gives a passing page the next free date.
  if (row === null || row.site_id !== a.siteId || row.state !== "generating") {
    return { ok: false, because: "no_draft" };
  }
  const site = await store.siteFacts(a.siteId);
  if (site === null) return { ok: false, because: "no_site" };
  const report = await store.latestReport(a.siteId);
  if (report === null) return { ok: false, because: "no_scan" };
  const opportunity = await opportunityById(row.opportunity_id);
  if (opportunity === null) return { ok: false, because: "no_opportunity" };

  const page = { siteId: a.siteId, site, report, opportunity, publishDate: row.scheduled_for, draftId: row.id };
  const outcome = await withDraftCost({ scanId: report.scanId }, (cost) =>
    opportunity.type === "fix_page" ? fixPage(page, cost) : writePage({ ...page, attempts: 1 }, cost)
  );
  await settle(outcome, opportunity.id, a.now ?? new Date(), site.domain);
  return outcome;
}

interface PageInput {
  siteId: string;
  site: SiteFacts;
  report: StoredReport;
  opportunity: Opportunity;
  publishDate: string | null;
  /** The date's row, where one is already written. */
  draftId?: string;
}

/**
 * What a run's outcome does to its row and its opportunity.
 *
 * SPEC §7 (2026-09-15, issue 712): a written draft queues its opportunity.
 * A draft the rules stopped for the last time rests in `needs_attention`
 * (#788), and so does a row a step stopped for the last time (#813), its
 * reason naming the step. Either way its topic rests for 28 days (owner,
 * D26, issue 1179). A run that wrote no row moves neither.
 */
async function settle(outcome: DayPageOutcome, opportunityId: string, now: Date, domain: string): Promise<void> {
  if (outcome.ok) {
    await queueForDraft(opportunityId);
    return;
  }
  if (outcome.because === "rules" && outcome.draftId !== null) {
    const failed = await recordedRules(outcome.draftId);
    await rest(outcome.draftId, opportunityId, `rules:${failed.join(",")}`, now);
    if (outcome.attempts >= 2) {
      await alertStoppedTwice({ domain, draftId: outcome.draftId, attempts: outcome.attempts, failed, stopped: outcome.stopped });
    }
    return;
  }
  if (outcome.because === "step_failed" && outcome.draftId !== null) {
    await rest(outcome.draftId, opportunityId, `step_failed:${outcome.step}`, now);
  }
}

/** The rules on the row: what stopped its last attempt. */
async function recordedRules(draftId: string): Promise<string[]> {
  const row = await generateStore().draftById(draftId);
  return (readRecordedRules(row?.rule_failures) ?? []).map((failure) => failure.rule);
}

/**
 * SPEC §7 (owner, D27, 2026-10-02): "A draft that fails twice is an alert to
 * investigate, never a normal outcome." The owner is mailed the site, the
 * rules and the sentences that broke them — what is needed to tell a bad
 * page from a bad rule. The customer is told by the draft itself (#880).
 *
 * Never a throw: the page is stopped and rested either way, and a report
 * that fails must not fail the run it reports on.
 */
async function alertStoppedTwice(a: {
  domain: string;
  draftId: string;
  attempts: number;
  failed: readonly string[];
  stopped: readonly FixNote[] | undefined;
}): Promise<void> {
  try {
    const { reportIncident } = await import("@/lib/mail/ops");
    await reportIncident({
      occasion: "draft-stopped-twice",
      domain: a.domain,
      draftId: a.draftId,
      attempts: a.attempts,
      failed: a.failed.map((rule) => ({
        rule,
        sentences: a.stopped?.find((note) => note.rule === rule)?.sentences ?? [],
      })),
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "draft_stopped_twice_alert", outcome: "threw", error: error instanceof Error ? error.name : "unknown" }));
  }
}

/**
 * §8 rule 4, "twice = needs-attention" (#788): the stopped page leaves
 * `generating` for the state the customer can act on, and its topic rests
 * (D26, issue 1179). The rules that stopped it are on the row already
 * (`rule_failures`, which the draft view lists); the move's record names
 * them too — or names the step that could not run (#813).
 *
 * Never a throw on a refused move: the page is stopped either way, and a
 * row another mover moved first is logged rather than forced.
 */
async function rest(draftId: string, opportunityId: string, reason: string, now: Date): Promise<void> {
  const { transition } = await import("@/lib/publish/machine");
  const moved = await transition(draftId, "needs_attention", { kind: "system", job: "draft/generate" }, { reason });
  if (!moved.ok) {
    console.log(JSON.stringify({ event: "draft_not_rested", draftId, refused: moved.refused, state: moved.state }));
  }
  await restTopic(opportunityId, now);
}

async function fixPage(a: PageInput, cost: CostContext): Promise<DayPageOutcome> {
  const pageUrl = a.opportunity.targetRef;
  const { readSiteProfile } = await import("@/lib/site-profile/store");
  const profile = await readSiteProfile(a.site.domain);
  const otherTitles = (profile?.inventory ?? [])
    .filter((row) => row.url !== pageUrl && row.title !== "")
    .map((row) => row.title);
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
}

async function writePage(a: PageInput & { attempts: number }, cost: CostContext): Promise<DayPageOutcome> {
  const store = generateStore();
  const { site, report } = a;
  let opportunity = a.opportunity;

  // The one name the product holds for the business is the brand the
  // profile measured off their own home page — what the site calls itself.
  // It is a measurement, and the honest-row and quotation rules read it as
  // one. It is also the byline of a page whose founder gave setup no name
  // (SPEC §7, 2026-09-29: "the founder's name and line from setup, else the
  // business's name").
  const measuredBrand =
    report.market.kind === "unmeasured" ? null : (report.market.value.profile.brandTokens[0] ?? null);

  const ruleInputs: SiteRuleInputs = {
    businessName: measuredBrand,
    domain: site.domain,
    doNotClaim: site.doNotClaim,
    rivals: site.rivals,
  };

  // SPEC §7 (2026-10-04, issue 1248): the page is written for the site's
  // market in force (`sites.market`, D28) — the report's category is the one
  // that pass was bought under, and stands in only where no market is stored.
  const writingFor = writingMarket({
    site: site.market === undefined ? null : { category: site.category, competitors: site.rivals, stored: site.market },
    reportCategory: report.market.kind === "unmeasured" ? "" : report.market.value.profile.category,
  });

  // SPEC §7 (2026-09-20), #927: the **confirmed** business profile joins the
  // writer's inputs — what the business does, sells, promises, serves and
  // says, with the customer's own corrections applied over the crawl
  // (#926's overlay). The owner's bar for this issue: content must be
  // business specific and always relevant to this user, never generic.
  //
  // **Through `readConfirmedBusiness` (#978), which is the read both screens
  // use.** The writer does not get a path of its own: that is how a writer
  // and a screen come to disagree about what a customer confirmed.
  //
  // **It must be the confirmed profile and never the derived row.** An item
  // the customer removed has no path into a page precisely because
  // `confirmedProfile` is the only thing that produces the shape the prompt
  // accepts — the derived row does not fit through `promptProfile`'s door.
  //
  // Read once for the day, beside the links, so a regeneration writes from
  // the same profile as the attempt it replaces.
  const confirmed = await confirmedForWriting({ siteId: a.siteId, domain: site.domain });

  // SPEC §7 (2026-09-12): the site's own pages from the profile's
  // inventory, and the cluster's earlier live pages. Read once for the
  // day, so a regeneration links the same pages as the attempt it replaces.
  const inventory = await store.siteInventory(site.domain);
  const earlier =
    opportunity.clusterKey === null ? [] : await store.clusterPages(a.siteId, opportunity.clusterKey);
  const selfUrl = opportunity.family === "improve" ? opportunity.targetRef : null;
  const chosen = [
    ...siteLinkTargets({
      domain: site.domain,
      inventory,
      query: opportunity.targetQuery ?? "",
      selfUrl,
    }),
    ...clusterLinkTargets(earlier),
  ];
  // SPEC §7 (2026-09-20, #928): "New pages link to known content where it
  // helps the reader." The pages the site already has — theirs as well as
  // ours — after the two lists that were already chosen, and never one of
  // those twice.
  const known = await store.knownPages(a.siteId);
  let links = [
    ...chosen,
    ...knownContentTargets(known, {
      domain: site.domain,
      query: opportunity.targetQuery ?? "",
      selfUrl,
      already: chosen,
    }),
  ];
  // SPEC §7 (2026-09-20, #928): the nearest of those pages are stated to
  // the writer as well — not as pages to link, which `links` already is,
  // but as topics this site has covered, so the page is written beside them
  // and never over them. Titles and addresses only.
  const knownBriefs = nearestKnown(known, opportunity.targetQuery ?? "");
  // SPEC §7 (2026-10-03, D36, issue 1209): and the brief is told every page
  // the site has published or planned. Read once for the day, like the rest.
  const sitePages = await sitePagesFor(a.siteId, { except: opportunity.id });

  // SPEC §7 (2026-09-29, *Two pools of facts*; issue 1135): the market
  // facts, read once for the day — the target's top results, each rival's own
  // pricing and feature pages, and two studies — so a second attempt cites
  // what the first was handed. A read that fails leaves the page to its
  // business facts and never stops it.
  const market = await researchMarket(cost, {
    siteId: a.siteId,
    domain: site.domain,
    searches: targetSearches(opportunity),
    report,
    rivals: site.rivals,
    today: new Date(),
  }).catch((error: unknown) => {
    console.warn(JSON.stringify({ event: "draft_research_failed", siteId: a.siteId, error: String(error).slice(0, 200) }));
    return NO_RESEARCH;
  });

  let last: GenerateOutcome | null = null;
  // #788: one row for the date across every attempt — an attempt after
  // the first rewrites the row the first one wrote.
  let draftId = a.draftId;
  let ruleStopped = false;
  // #1178: what the attempt before told the next one — its failures and
  // the sentences that broke them.
  let fix: FixNote[] | undefined;
  // Issue 1144: set once a page was held for reading like one written for
  // another site — what its one rewrite is told to keep away from.
  let apart: readonly string[] | undefined;
  let attempts = a.attempts;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    last = await generateDraft(cost, {
      siteId: a.siteId,
      opportunity,
      scheduledFor: a.publishDate,
      site: ruleInputs,
      voiceText: site.voiceText,
      category: writingFor.category,
      siteMarket: writingFor.market,
      links,
      known: knownBriefs,
      sitePages,
      profile: confirmed.profile,
      // The founder's own line from setup's fifth question (#1133), else
      // the business's name.
      byline: confirmed.profile?.knowledge?.byline ?? measuredBrand,
      factsOff: confirmed.factsOff,
      scanId: report.scanId,
      market,
      ...(draftId === undefined ? {} : { draftId }),
      ...(fix === undefined ? {} : { fix }),
      ...(apart === undefined ? {} : { apart }),
    });
    if (last.draftId !== null) draftId = last.draftId;
    if (last.ok) return { ok: true, draftId: last.draftId };
    if (last.reason === "step_failed") {
      // A step that did not run before any row was written leaves nothing
      // to rest: the opportunity stays open for the next evening.
      if (draftId === undefined) {
        return { ok: false, because: "step_failed", draftId: null, step: last.step };
      }
      // SPEC §7 (D13, issue 1144): a page too close to one written for
      // another site is written again once, told which of its sentences the
      // two shared, and a page still too close is held. The rewrite is this
      // hold's own, whatever attempts the rules had used.
      if (last.step === "elsewhere") {
        if (apart !== undefined || cost.capHit()) {
          return { ok: false, because: "step_failed", draftId, step: last.step };
        }
        apart = last.apart ?? [];
        ruleStopped = false;
        fix = undefined;
        attempts = attempt + 1;
        continue;
      }
      // After a rule already stopped this date's row, a regeneration that
      // could not run leaves that stop standing: the row rests on it
      // rather than waiting in `generating` for a run nothing will make.
      if (ruleStopped && last.step !== "adds") return { ok: false, because: "rules", draftId, attempts: attempt - 1 };
      // SPEC §7 (D12, issue 1143): a new page short of what it must add is
      // not written again as it was. Where the site has a close page the
      // destination can update, the day becomes an update of it — on the
      // same row, once, and held to no bar of its own; otherwise the row
      // rests and the draft asks the founder for the missing fact.
      if (last.step === "adds") {
        const update = cost.capHit() ? null : await updateInstead(opportunity, known, new Date());
        if (update === null) return { ok: false, because: "step_failed", draftId, step: last.step };
        console.log(JSON.stringify({ event: "draft_became_update", siteId: a.siteId, draftId, page: update.targetRef }));
        opportunity = update;
        links = links.filter((link) => link.url !== update.targetRef);
        ruleStopped = false;
        fix = undefined;
        attempts = attempt + 1;
        continue;
      }
      // #813: a row a step stopped takes the automatic second attempt a
      // rule stop takes — a model that did not answer may answer now. The
      // ceiling would stop that attempt too, so it rests at once.
      // A page held for its length is not that (issue 1138): it was written
      // and written again, and SPEC §7 holds it there.
      if (attempt < attempts && !cost.capHit() && last.step !== "length") continue;
      return { ok: false, because: "step_failed", draftId, step: last.step };
    }
    ruleStopped = true;
    fix = last.fix;
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
    return { ok: false, because: "rules", draftId: draftId ?? null, attempts };
  }
  return {
    ok: false,
    because: "rules",
    draftId: draftId ?? null,
    attempts: stopped.attempt,
    ...(stopped.fix === undefined ? {} : { stopped: stopped.fix }),
  };
}
