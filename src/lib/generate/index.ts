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
//   1. **decide** — §7's `nextForDay` supplies the opportunity (and supplies
//      nothing when there is none: supply is the cap), and its type is read
//      off the row (`contentTypeOf`): new or an update, one of seven;
//   2. **context pack** — the knowledge base and the founder's answers, the
//      market, the site's pages, its own passages and what the research step
//      read (`pipeline/pack.ts`), inside the one `CAP_DRAFT` context;
//   3–4. **write** and **check**, with the one fix call (`pipeline/index.ts`);
//   5. **publish** is the publishing engine's, behind the veto window.
//
//   * a draft the checks stopped rests in `needs_attention` (#788) — never
//     left in `generating` — and its topic rests for 28 days (owner, D26,
//     issue 1179);
//   * a stopped draft does not cost its day (D26): the same run writes the
//     next-ranked opportunity for the date, at most once more and inside the
//     one `CAP_DRAFT` context;
//   * a pack short of what its template asks, or a new page whose pack adds
//     too little (D12), writes nothing: the page stops, naming what is
//     missing, and the day goes to the next topic the same way — without
//     using up D26's one more, since nothing was written (issue 1477).
//
// `regenerateRestarted` is the customer's Regenerate carried out: the
// restart moves the row back into `generating`, and the next draft tick
// rewrites that row for the date it already holds.
import { siteLocale } from "@/lib/locale/site";
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
import { DAY_TOPICS_MAX, PIPELINE, RESEARCH } from "@/lib/config/constants";
import type { KnownPage } from "@/lib/known-content/types";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { intentFor } from "@/lib/opportunities/intent";
import { withDraftCost } from "./cost";
import { readRecordedRules, recordedVerdictValue } from "./record";
import type { SiteRuleInputs } from "./rules/types";
import { mendedInCode, repairStructure } from "./rules/structure";
import { claimCheck } from "./claims/check";
import { confirmedForWriting } from "./voice/confirmed";
import {
  clusterLinkTargets,
  knownLinkTargets as knownContentTargets,
  siteLinkTargets,
} from "./links/select";
import { withMovedLink } from "./links/moved";
import { urlKey, type LinkTarget } from "./links/select";
import { generateDraft, targetSearches, type GenerateOutcome } from "./pipeline";
import { allowedFacts, readAllFacts, readDemoPhrases, type SourcedFact } from "./pipeline/grounding";
import { buildPack, builtFromOutside, questionsHeld, readPack, type ContextPack, type PackLivePage, type PackMeasurements } from "./pipeline/pack";
import { generatePageFix } from "./pipeline/page-fix";
import type { FixNote } from "./pipeline/repair";
import { NO_RESEARCH, researchMarket, type MarketResearch } from "./pipeline/research";
import { namedRivals } from "./rules/rivals";
import { TEMPLATES } from "./templates";
import { marketSearches, writingMarket } from "./voice/market";
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
export { type PipelineStep } from "./pipeline";
export { type ContextPack, readPack } from "./pipeline/pack";
export { TEMPLATES, type Template } from "./templates";
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

/** #813: a write call that did not answer is tried once more. The one fix
 *  call of D41 is the pipeline's own and is not an attempt of these. */
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
  const startedAt = Date.now();

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
      // The topics whose page was written: D26's "at most once more" counts these.
      let written = 0;
      for (let topic = 1; ; topic++) {
        const page = { siteId: a.siteId, site, report, opportunity, publishDate: a.publishDate };
        // Each row carries what its own page cost, not the day's, and its
        // own calls (issue 1478): a second topic is a page with no row yet.
        if (topic > 1) await cost.forDraft?.(null);
        const own = sinceNow(cost);
        // A fix is a metadata-only update: one call, no regeneration loop —
        // the only rule it can fail is the customer's own do-not-claim list,
        // which a second attempt at the same page would read the same way.
        const outcome =
          opportunity.type === "fix_page"
            ? await fixPage(page, own)
            : mendable(opportunity)
              ? await mendPage(page)
              : await writePage({ ...page, attempts: MAX_AUTOMATIC_ATTEMPTS, startedAt: topic === 1 ? startedAt : Date.now() }, own);
        await settle(outcome, opportunity.id, now, site.domain);

        // SPEC §7 (D26, issue 1179): a stopped draft does not cost its day.
        // Only a row that was written and stopped is moved on from — a run
        // that wrote none rested nothing, and its topic is still the head.
        const stopped = stoppedRow(outcome);
        // Issue 1477: a topic whose pack was short wrote nothing and cost
        // its pack alone, so it does not use up D26's one more topic — the
        // day goes on to the next ready one, within the same cap and time.
        if (!packShort(outcome)) written += 1;
        // And only while the job's invocation has the time for a second page.
        if (stopped === null || written >= DAY_TOPICS_MAX || cost.capHit() || Date.now() - startedAt > PIPELINE.nextTopicBeforeMs) return outcome;
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

/** A run stopped before its write call because the pack was short of what
 *  its template asks (D41): no page was written. */
function packShort(outcome: DayPageOutcome): boolean {
  return !outcome.ok && outcome.because === "step_failed" && outcome.step.startsWith("pack");
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
  const found = await opportunityById(row.opportunity_id);
  if (found === null) return { ok: false, because: "no_opportunity" };
  // A comparison the day answered as a Q&A (issue 1455) is written again as one.
  const writtenAs = (row.meta as { contentType?: unknown } | null)?.contentType;
  const opportunity = writtenAs === "qa" && contentTypeOf(found) === "listicle" ? { ...found, writeAs: "qa" as const } : found;

  const page = { siteId: a.siteId, site, report, opportunity, publishDate: row.scheduled_for, draftId: row.id };
  const outcome = await withDraftCost({ scanId: report.scanId, draftId: row.id }, (cost) =>
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

/** SPEC §7 (issue 1507): a refresh planned for the consistency rules alone,
 *  each of whose defects code repairs. */
function mendable(opportunity: Opportunity): boolean {
  const shortfall = (opportunity.evidence as { shortfall?: { cause?: unknown; defects?: unknown } } | undefined)?.shortfall;
  return (
    opportunity.type === "refresh_page" &&
    shortfall?.cause === "structure" &&
    Array.isArray(shortfall.defects) &&
    mendedInCode(shortfall.defects.filter((defect): defect is string => typeof defect === "string"))
  );
}

/**
 * The live page mended (SPEC §7, issue 1507): a new version of its own text
 * with what code repairs repaired — a list counted again, a repeated link
 * gone, a stray bracket removed — and nothing written. No model is asked:
 * 0¢. It is a new version through the refresh path, never an edit of the
 * live row (ADR-080), and it is dated as the version it mends (`datedAs`):
 * a renumbered list is not a change of what the page says, so its updated
 * date, `dateModified` and `lastmod` stay. It enters review as every page
 * does, its claim checked against the customer's list.
 */
async function mendPage(a: PageInput): Promise<DayPageOutcome> {
  const store = generateStore();
  const live = (await store.liveVersionAt?.(a.siteId, a.opportunity.targetRef)) ?? null;
  if (live === null) return { ok: false, because: "step_failed", draftId: a.draftId ?? null, step: "mend" };
  const meta = (typeof live.draft.meta === "object" && live.draft.meta !== null ? live.draft.meta : {}) as Record<string, unknown>;
  const title = live.draft.title ?? "";
  const body = repairStructure(live.draft.body_md ?? "", { title });
  // Mended since it was planned: there is nothing to publish.
  if (body === (live.draft.body_md ?? "")) return { ok: false, because: "step_failed", draftId: a.draftId ?? null, step: "mend" };
  const datedAs = typeof meta.datedAs === "string" ? meta.datedAs : live.publishedAt.toISOString();
  const draftId = await store.insertDraft({
    site_id: a.siteId,
    opportunity_id: a.opportunity.id,
    state: "generating",
    title: live.draft.title,
    body_md: body,
    grounded_fact: live.draft.grounded_fact,
    attribution: live.draft.attribution,
    scheduled_for: a.publishDate,
    cost_cents: 0,
    meta: { ...meta, datedAs, mendOf: live.draft.id },
  });
  const claim = claimCheck({ text: [title, body].join("\n"), list: a.site.doNotClaim });
  const passed = claim.state === "passed";
  await store.patchDraft(draftId, { claim_check: recordedVerdictValue(claim), rule_failures: [], cost_cents: 0, hard_rules_passed: passed });
  console.log(JSON.stringify({ event: "page_mended", siteId: a.siteId, draftId, mendOf: live.draft.id, passed }));
  return passed ? { ok: true, draftId } : { ok: false, because: "rules", draftId, attempts: 1 };
}

/** The page an update refreshes, as the pack holds it: ReachKit's own page
 *  as it was written, else the site's own page as the measurement read it. */
async function livePageOf(
  a: PageInput,
  opportunity: Opportunity,
  known: readonly KnownPage[],
  facts: readonly SourcedFact[]
): Promise<PackLivePage | null> {
  const url = opportunity.targetRef;
  const key = urlKey(url);
  const listed = known.find((page) => page.url !== null && urlKey(page.url) === key);
  const title = listed?.title ?? opportunity.title ?? "";
  const ours = title === "" ? undefined : (await generateStore().publishedPages(a.siteId)).find((page) => page.title === title);
  // Issue 1507: a page of ours is refreshed from its text with what code can
  // repair of the consistency rules already repaired — never edited live.
  const markdown =
    (ours === undefined ? undefined : repairStructure(ours.markdown, { title: ours.title })) ??
    facts.find((sourced) => urlKey(sourced.fact.url) === key)?.sourceText ??
    "";
  if (markdown.trim() === "") return null;
  const evidence = opportunity.evidence as { shortfall?: { kind?: unknown } } | undefined;
  const linkTo = linkBackOf(opportunity);
  // Issue 1487: a link to a page that moved is pointed at its new address in
  // code, by the name the row records; the writer returns the page as it is.
  const moved =
    linkTo?.replaces === undefined
      ? markdown
      : withMovedLink(markdown, { from: (href) => href === linkTo.replaces, to: linkTo.url, text: linkTo.title }).markdown;
  return {
    url,
    title,
    markdown: moved,
    why: typeof evidence?.shortfall?.kind === "string" ? evidence.shortfall.kind : null,
    ...(linkTo === null ? {} : { linkTo }),
    ...(ours?.reportPassages === undefined ? {} : { reportPassages: ours.reportPassages }),
  };
}

/** SPEC §7 (2026-10-10, issue 1391): the newer live page a refresh planned
 *  for `link` adds a link to, as its row records it. */
function linkBackOf(opportunity: Opportunity): { url: string; title: string; replaces?: string } | null {
  const shortfall = (opportunity.evidence as { shortfall?: { cause?: unknown; link?: { url?: unknown; title?: unknown; replaces?: unknown } } } | undefined)?.shortfall;
  const link = shortfall?.cause === "link" ? shortfall.link : undefined;
  if (typeof link?.url !== "string" || typeof link.title !== "string") return null;
  return { url: link.url, title: link.title, ...(typeof link.replaces === "string" ? { replaces: link.replaces } : {}) };
}

async function writePage(a: PageInput & { attempts: number; startedAt?: number }, cost: CostContext): Promise<DayPageOutcome> {
  const store = generateStore();
  const { site, report } = a;
  const startedAt = a.startedAt ?? Date.now();
  let opportunity = a.opportunity;

  // The one name the product holds for the business is the brand the
  // profile measured off their own home page — what the site calls itself.
  // It is also the byline of a page whose founder gave setup no name (SPEC
  // §7, 2026-09-29).
  const measuredBrand =
    report.market.kind === "unmeasured" ? null : (report.market.value.profile.brandTokens[0] ?? null);
  const ruleInputs: SiteRuleInputs = {
    businessName: measuredBrand,
    domain: site.domain,
    doNotClaim: site.doNotClaim,
    rivals: site.rivals,
  };
  // SPEC §7 (2026-09-20), #927: the **confirmed** business profile — the
  // knowledge base and the founder's answers, with the customer's own
  // corrections applied over the crawl — through `readConfirmedBusiness`
  // (#978), the read both screens use. Read once for the day.
  const confirmed = await confirmedForWriting({ siteId: a.siteId, domain: site.domain });
  // D66: the page is researched and written in the site's own country and language.
  const locale = await siteLocale(a.siteId);
  // Issue 1390: the voice the customer fixed in Settings, where they did.
  const writingVoice = (await store.writingVoice?.(a.siteId)) ?? null;

  // SPEC §7 (2026-10-04, issue 1248): the page is written for the site's
  // market in force (`sites.market`, D28) — the report's category is the one
  // that pass was bought under, and stands in only where no market is stored.
  const writingFor = writingMarket({
    site: site.market === undefined ? null : { category: site.category, competitors: site.rivals, stored: site.market },
    reportCategory: report.market.kind === "unmeasured" ? "" : report.market.value.profile.category,
    founderBuyer: confirmed.buyers,
  });
  const category = writingFor.category;

  // SPEC §7 (2026-09-12): the site's own pages from the profile's inventory,
  // the cluster's earlier live pages, and the pages the site already has
  // (#928) — what the page links, read once for the day.
  const inventory = await store.siteInventory(site.domain);
  const earlier =
    opportunity.clusterKey === null ? [] : await store.clusterPages(a.siteId, opportunity.clusterKey);
  const known = await store.knownPages(a.siteId);
  const linksFor = (o: Opportunity): LinkTarget[] => {
    const selfUrl = o.family === "improve" ? o.targetRef : null;
    // Issue 1391: a refresh planned to link a newer page links it first.
    const newer = linkBackOf(o);
    const chosen: LinkTarget[] = [
      ...siteLinkTargets({ domain: site.domain, inventory, query: o.targetQuery ?? "", selfUrl }),
      ...(newer === null ? [] : [{ source: "known" as const, url: newer.url, label: newer.title, why: { kind: "newer" as const } }]),
      ...clusterLinkTargets(earlier).filter((target) => newer === null || urlKey(target.url) !== urlKey(newer.url)),
    ];
    return [
      ...chosen,
      ...knownContentTargets(known, { domain: site.domain, query: o.targetQuery ?? "", selfUrl, already: chosen }),
    ];
  };
  // SPEC §7 (2026-10-03, D36, issue 1209): every page the site has published
  // or planned, each with its address where the index knows it.
  const sitePages = (await sitePagesFor(a.siteId, { except: opportunity.id })).map((page) => ({
    ...page,
    url: page.title === null ? null : (known.find((held) => held.title === page.title)?.url ?? null),
  }));

  // The customer's own passages, the pages that speak to the target first
  // (issue 900), minus the ones they switched off (#927).
  const facts = allowedFacts(
    await readAllFacts({ siteId: a.siteId, scanId: report.scanId, target: targetSearches(opportunity)[0] }),
    confirmed.factsOff
  );
  // What no page may repeat whole (issue 1249): the site's demo phrases —
  // the ones kept with its knowledge base ride in `factsOff` — and its menus.
  const demoPhrases = [
    ...(await readDemoPhrases({ siteId: a.siteId, scanId: report.scanId }).catch(() => [])),
    ...confirmed.factsOff,
  ];

  // Issue 1509: what the site's live pages already say, so a fact said on
  // two of them is offered last. A read that fails offers them as before.
  const livePages = (await store.livePages?.(a.siteId).catch(() => [])) ?? [];

  /** Stages 1 and 2 for one opportunity: its type, then its context pack. */
  const packFor = async (o: Opportunity): Promise<{ pack: ContextPack; links: LinkTarget[] } | null> => {
    // 1. Decide (code only): new or an update, and which of the seven types.
    // Issue 1455: the ranking may write a comparison over D52's cap as a Q&A.
    const type = o.writeAs ?? contentTypeOf(o);
    if (type === null) return null;
    const template = TEMPLATES[type];
    const links = linksFor(o).filter((link) => link.url !== o.targetRef);
    const live = type === "update" ? await livePageOf(a, o, known, facts) : null;
    const previousResearch = type === "research" ? await previousResearchOf(a.siteId) : null;
    const packOf = (research: MarketResearch): ContextPack =>
      buildPack({
        type,
        opportunity: o,
        site: ruleInputs,
        category,
        // Issue 1248: the market the page is written for, and whether it is
        // the site's own or the stored report's category.
        market: writingFor.market === null ? { from: "report", category } : { from: "site", ...writingFor.market },
        writingFor,
        // The founder's own line from setup's fifth question (#1133), else the
        // business's name.
        byline: confirmed.profile?.knowledge?.byline ?? measuredBrand,
        voice: site.voiceText,
        writingVoice,
        profile: confirmed.profile,
        facts,
        research,
        report,
        sitePages,
        links,
        live,
        previousResearch,
        now: new Date(),
        locale,
        // An update is not held to what its own live text says.
        livePages: livePages.filter((page) => urlKey(page.url) !== urlKey(o.targetRef)).map((page) => page.markdown),
      });
    // 2. Research, for the types that read public pages (SPEC §7, *Two pools
    //    of facts*; issue 1135): at most two model calls, and for *current
    //    insights* one more that holds its news to the market (issue 1262).
    //    A read that fails leaves the page to its business facts and never
    //    stops it. A Q&A its target's own SERP leaves short of questions is
    //    read beside the market's searched terms too (owner, D62; issue
    //    1297): the pack says when it holds enough.
    const market = !template.research
      ? NO_RESEARCH
      : await researchMarket(cost, {
          siteId: a.siteId,
          locale,
          domain: site.domain,
          searches: targetSearches(o),
          report,
          rivals: site.rivals,
          // Issue 1508: a listicle counts the options its top results name,
          // and an alternatives search's product is its baseline.
          rivalNames: namedRivals(site.rivals, writingFor.market),
          options: type === "listicle",
          marketWords: [category, ...writingFor.synonyms],
          today: new Date(),
          // Issue 1390: every page that is researched reads what buyers
          // ask beside its target, for its headings.
          questions: true,
          // Issue 1486: a how-to or a Q&A is built from cited outside facts,
          // so its one search reads the target's own guidance.
          guidance: builtFromOutside(type),
          borrow: { terms: marketSearches(writingFor), held: (research) => questionsHeld(packOf(research)) },
          ...(type === "insights"
            ? { recent: { searches: [category === "" ? (targetSearches(o)[0] ?? "") : category, ...writingFor.synonyms], days: RESEARCH.recentDays, market: writingFor } }
            : {}),
        }).catch((error: unknown) => {
          console.warn(JSON.stringify({ event: "draft_research_failed", siteId: a.siteId, error: String(error).slice(0, 200) }));
          return NO_RESEARCH;
        });
    return { pack: packOf(market), links };
  };

  // #788: one row for the date across every attempt.
  let draftId = a.draftId;
  let becameUpdate = false;
  // The pack is built once for an opportunity: a write call tried again
  // (#813) is written from the pack the first one was.
  const packs = new Map<string, Awaited<ReturnType<typeof packFor>>>();
  for (let attempt = 1; ; attempt++) {
    const key = `${opportunity.id}:${opportunity.type}`;
    if (!packs.has(key)) packs.set(key, await packFor(opportunity));
    const built = packs.get(key) ?? null;
    if (built === null) return { ok: false, because: "step_failed", draftId: draftId ?? null, step: "pack" };
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
      ...(draftId === undefined ? {} : { draftId }),
    });
    if (last.draftId !== null) draftId = last.draftId;
    if (last.ok) return { ok: true, draftId: last.draftId };
    if (last.reason === "rules") {
      return {
        ok: false,
        because: "rules",
        draftId: draftId ?? null,
        attempts: last.attempt,
        ...(last.fix === undefined ? {} : { stopped: last.fix }),
      };
    }
    // SPEC §7 (D12, issue 1143): a new page whose pack adds too little is not
    // written. Where the site has a close page the destination can update,
    // the day becomes an update of it — on the same row, once, and held to no
    // bar of its own; otherwise the row rests and the draft asks the founder
    // for the missing fact.
    if (last.step === "adds" && !becameUpdate && !cost.capHit()) {
      const update = await updateInstead(opportunity, known, new Date());
      if (update !== null) {
        console.log(JSON.stringify({ event: "draft_became_update", siteId: a.siteId, draftId: draftId ?? null, page: update.targetRef }));
        opportunity = update;
        becameUpdate = true;
        continue;
      }
    }
    // #813: a write call that did not answer is tried once more — a model
    // that did not answer may answer now. The ceiling would stop that
    // attempt too, and a job out of time must not start it.
    if (last.step === "write" && attempt < a.attempts && !cost.capHit() && Date.now() - startedAt < PIPELINE.fixBeforeMs) continue;
    // A step that did not run before any row was written leaves nothing to
    // rest: the opportunity stays open for the next evening.
    return {
      ok: false,
      because: "step_failed",
      draftId: draftId ?? null,
      // A short pack names what is missing (D41).
      step: last.step === "pack" && last.missing !== undefined ? `pack:${last.missing.join(",")}` : last.step,
    };
  }
}

/** What the site's last research page was written from, so the next one is
 *  written only when a figure has changed (D42, 4). */
async function previousResearchOf(siteId: string): Promise<PackMeasurements | null> {
  const store = generateStore();
  const meta = store.lastMetaOfType === undefined ? null : await store.lastMetaOfType(siteId, "research");
  return readPack(meta)?.measurements ?? null;
}
