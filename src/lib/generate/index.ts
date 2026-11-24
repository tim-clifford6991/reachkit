// BUILD §8 · SPEC §7 (D41) — the generation engine's public entry point.
//
// Everything a caller outside `src/lib/generate/` may use, and nothing
// else. The individual rule modules, the model steps and the store port are
// internal: a caller that reached them could queue a page the checks never
// saw.
//
// `generateDayPage` is the whole of what the `draft/generate` job calls. It
// is where the day's page is assembled end to end, in D41's five stages:
//
//   1. **decide** — the week the weekly pass committed supplies the
//      opportunity planned for the date (`pageForDay`, issue 1559), or
//      nothing when the week holds none: supply is the cap. Its type is read
//      off the row (`typeTheResearchFills`): new or an update, one of seven;
//   2. **context pack** — the knowledge base and the founder's answers, the
//      market, the site's pages, its own passages and what the research step
//      read (`pipeline/pack.ts`), inside the one `CAP_DRAFT` context;
//   3–4. **write** and **check**, with the one fix call (`pipeline/index.ts`);
//   5. **publish** is the publishing engine's, behind the veto window.
//
//   * a draft the checks stopped rests in `needs_attention` (#788) and its
//     topic rests until the site's next weekly commit;
//   * a stopped draft, a customer's stop or an update that adds nothing over its live page does not cost its day (D26):
//     the one loop writes the week's next spare (`pageForDay`), at most once more, in the one context;
//   * a short pack writes the planned page with what it holds; only a
//     comparison with no first-hand evidence for a product it names, or an
//     update with no live page, writes no row and rests its topic, and the day
//     goes on without using up D26's one more (issue 1477); once no spare is
//     left, the day's fallback updates a page (`refreshForDay`).
//
// `regenerateRestarted` is the customer's Regenerate carried out: the next draft tick rewrites the row for its date.
import { answeredQueries } from "@/lib/measure/page-reading";
import { answeredHere } from "@/lib/opportunities/cluster";
import {
  opportunityById,
  pageForDay,
  queueForDraft,
  restTopic,
  type Opportunity,
} from "@/lib/opportunities";
import type { StoredReport } from "@/lib/scan/report";
import type { CostContext } from "@/lib/costs";
import { DAY_TOPICS_MAX, PIPELINE } from "@/lib/config/constants";
import type { KnownPage } from "@/lib/known-content/types";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import { intentFor } from "@/lib/opportunities/intent";
import { openDayCost, roomForFix, withDraftCost } from "./cost";
import { readRecordedRules } from "./record";
import { COLLECT, askDayResearch, dayTypes, researchFor } from "./research-queue";
import { dayInputs, linkBackOf } from "./day-inputs";
import { repairStructure } from "./rules/structure";
import { addsOverLive, mendPage, plannedTopic, refreshedInCode, rivalsAnswer } from "./day-refresh";
import { writtenFor } from "./fix-step";
import { urlKey, type LinkTarget } from "./links/select";
import { withMovedLink } from "./links/moved";
import { generateDraft, type GenerateOutcome } from "./pipeline";
import type { SourcedFact } from "./pipeline/grounding";
import { buildPack, readPack, type ContextPack, type PackLivePage, type PackMeasurements } from "./pipeline/pack";
import { meetsStandard, researchedAs } from "./standard";
import { generatePageFix } from "./pipeline/page-fix";
import type { FixNote } from "./pipeline/repair";
import type { MarketResearch } from "./pipeline/research";
import { owedToRow, withFirstAsk } from "./interrupted";
import { localDay } from "@/lib/scan/weekly/week";
import { DraftDateTaken, PageStopped, generateStore, pageOf, type RestartedDraft, type SiteFacts } from "./store";
import { inTest } from "./test-draft";
import { recentFacts, storedChanges } from "@/lib/hot/detect";

export type { GroundedFact, HardRule, RuleFailure, ComparisonSet, SiteRuleInputs } from "./rules/types";

export { type BatteryOutcome } from "./rules";

export { type ClaimVerdict } from "./claims/check";
export { claimRecheckOutstanding, outstandingMatch } from "./claims/outstanding";
export { sweepOutstandingRechecks, type SweepOutcome } from "./claims/sweep";
export { type Recovery } from "./claims/recovery";

export { refreshForDay } from "./day-refresh";
export { type GenerateOutcome } from "./pipeline";
export { type NearDuplicateCause } from "./pipeline/rejection";
export { type PipelineStep } from "./pipeline";
export { type ContextPack } from "./pipeline/pack";
export { type Template } from "./templates";
export { PageStopped, setGenerateStore, type GenerateStore, type RestartedDraft } from "./store";

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
  | { ok: false; because: "no_own_facts"; step: string } // Even the site's own facts held no page; `step` names what they lacked.
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
      /** Why it had no fix call, where the budget or the clock is why. */
      stop?: Extract<GenerateOutcome, { reason: "rules" }>["stop"];
    }
  | { ok: false; because: "step_failed"; draftId: string | null; step: string }
  /** Its research is still on the vendor's queue: no row and no rest, and the next tick asks again. */
  | { ok: false; because: "research_pending" }
  /** DataForSEO refused the page's research for lack of credit. */
  | { ok: false; because: "vendor_funds" }
  | { ok: false; because: "fix_owed"; draftId: string }; // Its write step had no room for its fix call (`fixOwedPage`).

type NoPage = Extract<DayPageOutcome, { because: "no_site" | "no_scan" | "already_drafted" | "no_opportunity" }>;

/** What a day's page needs before any topic is read: the site, no page yet
 *  on the date, and a scan to ground it. */
async function dayReady(siteId: string, publishDate: string): Promise<NoPage | { ok: true; site: SiteFacts; report: StoredReport }> {
  const store = generateStore();
  const site = await store.siteFacts(siteId);
  if (site === null) return { ok: false, because: "no_site" };
  // Issue 886: the tick that delivers this twice stops here, before the first paid call. The read is not the whole
  // protection — two deliveries running together both pass it — so the row is unique in the database too.
  if (await store.draftOnDate(siteId, publishDate)) return { ok: false, because: "already_drafted" };
  // §8: "the day's page is generated the evening before from the freshest scan." No scan, no measured pages — and no
  // measured pages is no grounded fact, which §8 leaves no way around.
  const report = await store.latestReport(siteId);
  if (report === null) return { ok: false, because: "no_scan" };
  return { ok: true, site, report };
}

/** D41's decide stage alone, at 0¢: the topic the day's page is written on, or why the day has none. A topic whose rival
 *  check fails is rested and the next taken here, at most `DAY_TOPICS_MAX` times, so the research asked next is the written topic's. */
export async function decideDayPage(a: { siteId: string; publishDate: string; now: Date }): Promise<NoPage | { ok: true; opportunityId: string }> {
  const ready = await dayReady(a.siteId, a.publishDate);
  if (!ready.ok) return ready;
  let first = inTest() ? await plannedTopic(a.siteId, a.publishDate) : await pageForDay(a.siteId, a.publishDate, a.now);
  if (inTest()) return first === null ? { ok: false, because: "no_opportunity" } : { ok: true, opportunityId: first.id };
  for (let tries = 0; first !== null && tries < DAY_TOPICS_MAX && !(await rivalsAnswer(ready, first)); tries++) {
    await restTopic(first.id, a.now, { zone: ready.site.timeZone });
    first = await pageForDay(a.siteId, a.publishDate, a.now);
  }
  return first === null ? { ok: false, because: "no_opportunity" } : { ok: true, opportunityId: first.id };
}

/** #813: a write call that did not answer is tried once more. D41's one fix call is the pipeline's own, not one. */
const MAX_AUTOMATIC_ATTEMPTS = 2;

export async function generateDayPage(a: {
  siteId: string;
  /** The site-local calendar date the page is for. */
  publishDate: string;
  /** The run's due hour: what a topic's rest is counted from, and what the day's spend so far is read since unless `since` says otherwise. */
  now?: Date; since?: Date;
  /** The day's topic as `decideDayPage` chose it, where a step of its own did. */
  opportunityId?: string;
  updatesTried?: boolean;
}): Promise<DayPageOutcome> {
  const store = generateStore();
  const now = a.now ?? new Date();
  const startedAt = Date.now();
  const ready = await dayReady(a.siteId, a.publishDate);
  if (!ready.ok) return ready;
  const { site, report } = ready;

  // The week's page for the date, after a 0¢ check that it still stands — never a re-ranking of the open pool (issue 1559).
  const first = a.opportunityId === undefined ? await pageForDay(a.siteId, a.publishDate, now, a.updatesTried) : await opportunityById(a.opportunityId);
  if (first === null) return { ok: false, because: "no_opportunity" };

  try {
    // One `CAP_DRAFT` context for the day, whichever topic fills it, opened at what the date has already spent.
    return await openDayCost({ scanId: report.scanId, siteId: a.siteId, since: a.since ?? now }, async (cost): Promise<DayPageOutcome> => {
      let opportunity = first;
      // The topics whose page was written: D26's "at most once more" counts these.
      let written = 0;
      for (let topic = 1; ; topic++) {
        const page = { siteId: a.siteId, site, report, opportunity, publishDate: a.publishDate };
        // Each row carries its own page's cost and calls (issue 1478): a second topic is a page with no row yet.
        if (topic > 1) await cost.forDraft?.(null);
        const own = sinceNow(cost);
        // A fix is a metadata-only update: one call, no regeneration loop — the only rule it can fail is the customer's
        // own do-not-claim list, which a second attempt at the same page would read the same way.
        let outcome: DayPageOutcome;
        try {
          outcome =
            opportunity.type === "fix_page"
              ? await fixPage(page, own)
              : (await refreshedInCode(a.siteId, opportunity))
                ? await mendPage(page, own)
                : // A topic this loop picked meets the select's 0¢ rival check before its research is bought.
                  (topic > 1 || a.opportunityId === undefined) && !(await rivalsAnswer(page, opportunity))
                  ? { ok: false, because: "step_failed", draftId: null, step: "pack:rival_evidence" }
                  : await writePage({ ...page, attempts: MAX_AUTOMATIC_ATTEMPTS, startedAt: topic === 1 ? startedAt : Date.now(), ...(inTest() ? {} : { fixStep: "owe" as const }) }, own);
        } catch (error) {
          // The customer stopped this page while it was written: nothing was saved, and the day takes its next topic.
          if (!(error instanceof PageStopped)) throw error;
          outcome = { ok: false, because: "no_opportunity" };
        }
        // A test draft is one page that moves no topic: its row is ended by `writeTestDraft`.
        if (inTest()) return outcome;
        await settle(outcome, opportunity.id, now, site);
        // A committed page that adds nothing over its live version is set aside, and the day moves on as from a stop.
        if (outcome.ok && !(await addsOverLive(outcome.draftId))) outcome = { ok: false, because: "step_failed", draftId: outcome.draftId, step: "adds" };

        // SPEC §7 (D26, issue 1179): a stopped draft does not cost its day.
        // Only a row that was written and stopped is moved on from — a run
        // that wrote none rested nothing, and its topic is still the head.
        const stopped = stoppedRow(outcome);
        // Issue 1477: a page stopped before writing cost its pack alone, so it does not use up D26's one more topic.
        const short = unwritten(outcome);
        if (!short) written += 1;
        // Its topic is one its pack cannot fill, so it rests as a stopped one does; a customer's stop is theirs.
        if (short && stopped === null && "step" in outcome) await restTopic(opportunity.id, now, { zone: site.timeZone });
        // And only while the job's invocation has the time for a second page.
        if ((stopped === null && !short) || written >= DAY_TOPICS_MAX || cost.capHit() || !roomForFix(cost) || Date.now() - startedAt > PIPELINE.nextTopicBeforeMs) return outcome;
        // The stopped topic rests by now, so the date's page is the week's next spare.
        const next = await pageForDay(a.siteId, a.publishDate, now);
        if (next === null || next.id === first.id || next.id === opportunity.id) return outcome;
        // It keeps its row and gives up its date to the page written next.
        if (stopped !== null) await store.patchDraft(stopped, { scheduled_for: null });
        opportunity = next;
      }
    });
  } catch (error) {
    // Issue 886: another delivery of this tick wrote the date's row while this one was writing its page. The index
    // refused the second row, so this run wrote nothing, and the store gave back its claim: its opportunity is open.
    if (error instanceof DraftDateTaken) return { ok: false, because: "already_drafted" };
    throw error;
  }
}

/** The row a run wrote and the rules or a step then stopped, if it did. */
function stoppedRow(outcome: DayPageOutcome): string | null {
  if (outcome.ok) return null;
  return outcome.because === "rules" || outcome.because === "step_failed" ? outcome.draftId : null;
}

/** No page written: the customer stopped it, the pack lacked rival evidence or a live page, or a mend had nothing it may check. */
function unwritten(outcome: DayPageOutcome): boolean {
  return !outcome.ok && (outcome.because === "no_opportunity" || (outcome.because === "step_failed" && (outcome.step.startsWith("pack") || (outcome.step === "mend" && outcome.draftId === null))));
}

/** The day's cost context as one page sees it: the same ceiling, and a spend counted from here. */
function sinceNow(cost: CostContext): CostContext {
  const before = cost.spentCents();
  return before === 0 ? cost : { ...cost, spentCents: () => cost.spentCents() - before };
}

/** Drafts waiting in `generating` for a run — one a site, oldest first, so a tick spends at most one page on each. */
export async function restartedDrafts(siteIds: readonly string[], now: Date): Promise<readonly RestartedDraft[]> {
  const seen = new Set<string>();
  return (await generateStore().restartedDrafts(siteIds, now)).filter((row) => !seen.has(row.siteId) && Boolean(seen.add(row.siteId)));
}

/**
 * The customer's Regenerate (#788), carried out: the page is written again on the row and for the date it already
 * holds, from the opportunity it was written for. One attempt — ADR-070 bounds the *automatic* ones, and this
 * is the customer's. It ends where the evening's run ends: a passing page
 * for review, or a stopped one back in `needs_attention`.
 */
export async function regenerateRestarted(a: { siteId: string; draftId: string; now?: Date }): Promise<DayPageOutcome> {
  const store = generateStore();
  const row = await store.draftById(a.draftId);
  // A stopped row that gave up its date (issue 1179) is rewritten without one; `enterReview` gives it the next free date.
  if (row === null || row.site_id !== a.siteId || row.state !== "generating") {
    return { ok: false, because: "no_draft" };
  }
  const site = await store.siteFacts(a.siteId);
  if (site === null) return { ok: false, because: "no_site" };
  const now = a.now ?? new Date(), owed = owedToRow(row, now);
  if (owed === null) return { ok: false, because: "no_draft" };
  if (owed !== "rewrite") {
    const rested = await rest(row.id, row.opportunity_id, "step_failed:interrupted", now, site.timeZone);
    // An interrupted run's date is freed, and its day re-opened while still ahead, so the next tick writes it with no one's step.
    if (owed === "interrupted" && rested && row.scheduled_for !== null) {
      await store.patchDraft(row.id, { scheduled_for: null });
      if (row.scheduled_for >= localDay(now, site.timeZone)) await (await import("@/lib/publish/daily")).reopenDraftDay(a.siteId, row.scheduled_for);
    }
    return { ok: false, because: "step_failed", draftId: row.id, step: "interrupted" };
  }
  const report = await store.latestReport(a.siteId);
  if (report === null) return { ok: false, because: "no_scan" };
  const opportunity = await writtenFor(row);
  if (opportunity === null) return { ok: false, because: "no_opportunity" };

  const page = { siteId: a.siteId, site, report, opportunity, publishDate: row.scheduled_for, draftId: row.id };
  // Research is asked again (a read left on the queue is read free); a restart's 2 hours run from its first ask.
  const outcome: DayPageOutcome = opportunity.type !== "fix_page" && (await askDayResearch({ siteId: a.siteId, opportunityId: opportunity.id, writeAs: opportunity.writeAs, now, waitMs: COLLECT.askMs })) > 0 ? { ok: false, because: "research_pending" }
    : await withDraftCost({ scanId: report.scanId, draftId: row.id }, (cost) => opportunity.type === "fix_page" ? fixPage(page, cost) : writePage({ ...page, attempts: 1 }, cost));
  const asked = !outcome.ok && outcome.because === "research_pending" ? withFirstAsk(row, now) : null;
  if (asked !== null) await store.patchDraft(row.id, { meta: asked });
  await settle(outcome, opportunity.id, now, site);
  return outcome;
}

/** A page the day's fallback writes in its one cost context (SPEC §7): an update from the day's research, or a row's
 *  owed fix. Its one fix call is the pipeline's own. `now` is the run's due hour. */
export async function writeFallback(page: PageInput & { publishDate: string }, now: Date, day?: CostContext, since = now): Promise<DayPageOutcome> {
  const write = (cost: CostContext) => writePage({ ...page, attempts: 1 }, cost);
  const outcome = day === undefined ? await openDayCost({ scanId: page.report.scanId, siteId: page.siteId, since }, write) : await write(day);
  await settle(outcome, page.opportunity.id, now, page.site);
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
  fixStep?: "owe" | "owed"; // `GenerateInputs.fixStep`
}

/**
 * What a run's outcome does to its row and its opportunity.
 *
 * SPEC §7 (2026-09-15, issue 712): a written draft queues its opportunity.
 * A draft the rules stopped for the last time rests in `needs_attention`
 * (#788), and so does a row a step stopped for the last time (#813), its
 * reason naming the step. Either way its topic rests until the site's next
 * weekly commit, since a stop is not the customer's no. A run that wrote no row moves neither.
 */
async function settle(outcome: DayPageOutcome, opportunityId: string, now: Date, { domain, timeZone }: SiteFacts): Promise<void> {
  if (outcome.ok) {
    await queueForDraft(opportunityId);
    return;
  }
  if (outcome.because === "rules" && outcome.draftId !== null) {
    const failed = await recordedRules(outcome.draftId);
    await rest(outcome.draftId, opportunityId, `rules:${failed.join(",")}`, now, timeZone);
    if (outcome.attempts >= 2) {
      await alertStoppedTwice({ domain, draftId: outcome.draftId, attempts: outcome.attempts, failed, stopped: outcome.stopped });
    }
    return;
  }
  if (outcome.because === "step_failed" && outcome.draftId !== null) {
    await rest(outcome.draftId, opportunityId, `step_failed:${outcome.step}`, now, timeZone);
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
export async function rest(draftId: string, opportunityId: string, reason: `rules:${string}` | `step_failed:${string}`, now: Date, zone?: string | null): Promise<boolean> {
  const { transition } = await import("@/lib/publish/machine");
  const moved = await transition(draftId, "needs_attention", { kind: "system", job: "draft/generate" }, { reason });
  if (!moved.ok) {
    console.log(JSON.stringify({ event: "draft_not_rested", draftId, refused: moved.refused, state: moved.state }));
  }
  await restTopic(opportunityId, now, { zone });
  return moved.ok;
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

/** The page an update refreshes, as the pack holds it: ReachKit's own page live at its address (a planned refresh's
 *  row has no title), by title only where we never published there, else the site's own page as the measurement read it. */
async function livePageOf(
  a: PageInput,
  opportunity: Opportunity,
  known: readonly KnownPage[],
  facts: readonly SourcedFact[]
): Promise<PackLivePage | null> {
  const url = opportunity.targetRef;
  const key = urlKey(url);
  const version = await generateStore().liveVersionAt(a.siteId, url);
  const listed = known.find((page) => page.url !== null && urlKey(page.url) === key);
  const title = version?.draft.title ?? listed?.title ?? opportunity.title ?? "";
  const ours = version !== null ? pageOf(version.draft) : title === "" ? undefined : (await generateStore().publishedPages(a.siteId)).find((page) => page.title === title);
  // A page of ours is refreshed from its text with what code can repair of the consistency rules repaired, never edited live.
  const markdown =
    (ours === undefined ? undefined : repairStructure(ours.markdown, { title: ours.title })) ?? facts.find((sourced) => urlKey(sourced.fact.url) === key)?.sourceText ?? "";
  if (markdown.trim() === "") return null;
  const evidence = opportunity.evidence as { shortfall?: { kind?: unknown; cause?: unknown; place?: unknown } } | undefined;
  const linkTo = linkBackOf(opportunity);
  // The date the live version is dated as, which a refresh that says nothing new keeps.
  const versionMeta = (version?.draft.meta ?? null) as Record<string, unknown> | null;
  const datedAs = version === null ? undefined : typeof versionMeta?.datedAs === "string" ? versionMeta.datedAs : version.publishedAt.toISOString();
  const queries = await answeredHere(a.siteId, opportunity, answeredQueries(version?.reading));
  // A link to a page that moved is pointed at its new address in code, by the name the row records.
  const moved =
    linkTo?.replaces === undefined ? markdown : withMovedLink(markdown, { from: (href) => href === linkTo.replaces, to: linkTo.url, text: linkTo.title }).markdown;
  return {
    url,
    title,
    markdown: moved,
    why: typeof evidence?.shortfall?.kind === "string" ? evidence.shortfall.kind : null,
    // Issue 1521: why one of ours is refreshed, which says whether it may grow.
    ...(evidence?.shortfall?.kind === "due" && typeof evidence.shortfall.cause === "string" ? { cause: evidence.shortfall.cause } : {}),
    ...(evidence?.shortfall?.kind === "due" && typeof evidence.shortfall.place === "number" ? { place: evidence.shortfall.place } : {}),
    ...(datedAs === undefined ? {} : { datedAs }),
    ...(queries.length === 0 ? {} : { queries }),
    ...(linkTo === null ? {} : { linkTo }),
    ...(ours?.reportPassages === undefined ? {} : { reportPassages: ours.reportPassages }),
    // The type it was first written as: an update's own pack carries its live page's.
    ...(typeof versionMeta?.contentType === "string" ? { type: (versionMeta.pack as { live?: { type?: string } } | undefined)?.live?.type ?? versionMeta.contentType } : {}),
  };
}

async function writePage(a: PageInput & { attempts: number; startedAt?: number }, cost: CostContext): Promise<DayPageOutcome> {
  const { site, report } = a;
  const startedAt = a.startedAt ?? Date.now();
  const opportunity = a.opportunity;

  const { ruleInputs, confirmed, locale, writingVoice, writingFor, category, known, linksFor, sitePages, facts, demoPhrases, livePages } = await dayInputs(a);

  /** Stages 1 and 2 for one opportunity: its type, then its context pack. */
  const packFor = async (o: Opportunity): Promise<{ pack: ContextPack; links: LinkTarget[]; pending?: true } | null> => {
    // 1. Decide (code only): new or an update, and which of the seven types.
    // The commit's stored type stands; a row with none takes the type its cached research fills, read at 0¢.
    const { type, own } = await dayTypes(a.siteId, o, new Date(), cost);
    if (type === null) return null;
    const as = researchedAs(type, own);
    const links = linksFor(o).filter((link) => link.url !== o.targetRef);
    const live = type === "update" ? await livePageOf(a, o, known, facts) : null;
    const previousResearch = type === "research" ? await previousResearchOf(a.siteId) : null;
    // SPEC §7: the stored market changes on its topic, read at 0¢; an unreadable store cites only the page's own event.
    const day = a.publishDate ?? new Date().toISOString().slice(0, 10), recent = recentFacts(o, await storedChanges(a.siteId, day).catch(() => []), day);
    const packOf = (research: MarketResearch): ContextPack =>
      buildPack({
        type, ...(own === undefined ? {} : { own }),
        opportunity: o,
        site: ruleInputs,
        category,
        // Issue 1248: the market the page is written for, and whether it is
        // the site's own or the stored report's category.
        market: writingFor.market === null ? { from: "report", category } : { from: "site", ...writingFor.market },
        writingFor,
        // The founder's own line from setup's fifth question (#1133), else the
        // business's name.
        byline: confirmed.profile?.knowledge?.byline ?? ruleInputs.businessName,
        voice: site.voiceText,
        writingVoice,
        profile: confirmed.profile,
        facts,
        research: { ...research, facts: [...recent, ...research.facts] },
        report,
        sitePages,
        links,
        live,
        pageType: pageTypeOf(o),
        previousResearch,
        now: new Date(),
        locale,
        // An update is not held to what its own live text says.
        livePages: livePages.filter((page) => urlKey(page.url) !== urlKey(o.targetRef)).map((page) => page.markdown),
      });
    // 2. Research, for the types that read public pages (`researchFor`).
    const market = await researchFor(cost, { ...a, o, type, as, own, locale, writingFor });
    return { pack: packOf(market), links, ...(market.pending === true ? { pending: true as const } : {}) };
  };

  // #788: one row for the date across every attempt.
  let draftId = a.draftId;
  // The pack is built once for an opportunity: a write call tried again
  // (#813) is written from the pack the first one was.
  const packs = new Map<string, Awaited<ReturnType<typeof packFor>>>();
  let retry: { shorter?: true } = {};
  for (let attempt = 1; ; attempt++) {
    const key = `${opportunity.id}:${opportunity.type}`;
    if (!packs.has(key)) packs.set(key, await packFor(opportunity));
    // Research the vendor refused for credit is unmeasured, and no page is written from it.
    if (cost.fundsRefused?.() === true) return { ok: false, because: "vendor_funds" };
    const built = packs.get(key) ?? null;
    if (built === null) return { ok: false, because: "step_failed", draftId: draftId ?? null, step: "pack" };
    // A short pack whose search is still on the queue is not measured: no row and no rest, and the topic is tried again.
    if (meetsStandard({ pack: built.pack, pending: built.pending === true }).pending) return { ok: false, because: "research_pending" };
    const last: GenerateOutcome = await generateDraft(cost, {
      siteId: a.siteId,
      opportunity,
      scheduledFor: a.publishDate,
      site: ruleInputs,
      pack: built.pack,
      facts,
      links: built.links,
      demoPhrases,
      intent: intentFor({ query: opportunity.targetQuery, volume: opportunity.volume }, site.prompts ?? []),
      startedAt,
      ...(draftId === undefined ? {} : { draftId }), ...(a.fixStep === undefined ? {} : { fixStep: a.fixStep }), ...retry,
    });
    if (last.draftId !== null) draftId = last.draftId;
    if (last.ok) return { ok: true, draftId: last.draftId };
    if ("owed" in last && last.draftId !== null) return { ok: false, because: "fix_owed", draftId: last.draftId };
    if (last.reason === "rules") {
      return { ok: false, because: "rules", draftId: draftId ?? null, attempts: last.attempt, ...(last.fix === undefined ? {} : { stopped: last.fix }), ...(last.stop === undefined ? {} : { stop: last.stop }) };
    }
    // A write call that did not answer is tried once more, its one flag asking a page cut off at its cap for a shorter one,
    // never the same input again; a refused answer is not. The ceiling and the job's clock would stop it too.
    if (last.step === "write" && last.answered !== true && attempt < a.attempts && !cost.capHit() && Date.now() - startedAt < PIPELINE.fixBeforeMs) {
      retry = last.answered === "cut_off" ? { shorter: true } : {};
      continue;
    }
    // A step that did not run before any row was written leaves nothing to
    // rest: the opportunity stays open for the next evening.
    return {
      ok: false,
      because: "step_failed",
      draftId: draftId ?? null,
      // A stop before writing names which of its two needs is missing.
      step: last.step === "pack" && last.missing !== undefined ? `pack:${last.missing.join(",")}` : last.step,
    };
  }
}

/** What the site's last research page was written from, so the next one is
 *  written only when a figure has changed (D42, 4). */
async function previousResearchOf(siteId: string): Promise<PackMeasurements | null> {
  const store = generateStore();
  const meta = await store.lastMetaOfType(siteId, "research");
  return readPack(meta)?.measurements ?? null;
}
