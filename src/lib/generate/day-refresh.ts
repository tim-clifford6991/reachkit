// SPEC §7 *Every day has new or updated content* (owner, 2026-11-05, 2026-11-17 and 2026-11-18) — a day whose topics
// and spares ended without a page takes, in the same run, the writer's update of the live page furthest below the
// standard, kept only where it adds real substance; else its last step, the committed topic written anyway. It ends
// empty only behind a harm stop, or where nothing can be sourced.
import { DAY_TOPICS_MAX, PIPELINE, REFRESH_MIN_AGE_DAYS, RESEARCH } from "@/lib/config/constants";
import { siteLocale } from "@/lib/locale/site";
import { committedWeek, opportunityById, pageForDay, restTopic, type Opportunity } from "@/lib/opportunities";
import { addressKey, persistAssessed, refreshOfPage, stoppedRefreshes, type OwnLivePage } from "@/lib/opportunities/refresh";
import { opportunityStore, readOpportunity } from "@/lib/opportunities/store";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { isResting } from "@/lib/opportunities/types";
import { serpOrganic } from "@/lib/vendors/dataforseo/serp";
import type { CostContext } from "@/lib/costs";
import type { StoredReport } from "@/lib/scan/report";
import type { DayPageOutcome } from ".";
import { openDayCost, roomForFix } from "./cost";
import { targetSearches } from "./pipeline";
import { siteRulesOf } from "./pipeline/battery";
import { fold, rivalsOnlyVersus, type ContextPack } from "./pipeline/pack";
import { fetchBody, researchSerps } from "./pipeline/research";
import { writingMarket } from "./voice/market";
import { checkStoredAt0, siteSets, type RecheckOutcome } from "./recheck";
import { completenessFor, readRecordedRules, stops } from "./record";
import type { Completeness } from "./rules/types";
import { mendedInCode, repairStructure } from "./rules/structure";
import type { PartMark } from "./standard";
import { DraftDateTaken, PageStopped, generateStore, type DraftRow, type SiteFacts } from "./store";

export interface MendInput {
  siteId: string;
  site: SiteFacts;
  report: StoredReport;
  opportunity: Opportunity;
  publishDate: string | null;
  draftId?: string;
}

/** SPEC §7 (issue 1507): a refresh planned for the consistency rules alone,
 *  each of whose defects code repairs. */
export function mendable(opportunity: Opportunity): boolean {
  const shortfall = (opportunity.evidence as { shortfall?: { cause?: unknown; defects?: unknown } } | undefined)?.shortfall;
  return (
    opportunity.type === "refresh_page" &&
    shortfall?.cause === "structure" &&
    Array.isArray(shortfall.defects) &&
    mendedInCode(shortfall.defects.filter((defect): defect is string => typeof defect === "string"))
  );
}

type Mended = { version: DraftRow; body: string; checked: Extract<RecheckOutcome, { kind: "checked" }> };
type Meta = Record<string, unknown>;
const metaOf = (meta: unknown): Meta => (typeof meta === "object" && meta !== null ? (meta as Meta) : {});

/** The live page's mended new version under today's battery, written nowhere. `null` where nothing changed or there
 *  is nothing the battery may check. */
async function mendedVersion(a: MendInput): Promise<Mended | null> {
  const store = generateStore();
  const url = a.opportunity.targetRef;
  const live = await store.liveVersionAt(a.siteId, url);
  if (live === null) return null;
  const meta = metaOf(live.draft.meta);
  const body = repairStructure(live.draft.body_md ?? "", { title: live.draft.title ?? "" });
  // Mended since it was planned: there is nothing to publish.
  if (body === (live.draft.body_md ?? "")) return null;
  const version = { ...live.draft, meta: { ...meta, datedAs: typeof meta.datedAs === "string" ? meta.datedAs : live.publishedAt.toISOString(), mendOf: live.draft.id } };
  // The live text passed the rules of its own day; its new version enters review only on today's.
  const sets = await siteSets(a.siteId, a.site, a.report);
  const checked = await checkStoredAt0(version, body, { ...sets, opportunity: a.opportunity, now: new Date(), versionsAt: { url, draftIds: await store.versionsAt(a.siteId, url) } });
  return checked.kind === "checked" ? { version, body, checked } : null;
}

async function insertMended(a: MendInput, { version, body, checked }: Mended): Promise<string> {
  const store = generateStore();
  const { title, grounded_fact, attribution } = version;
  const draftId = await store.insertDraft({ site_id: a.siteId, opportunity_id: a.opportunity.id, state: "generating", title, body_md: body, grounded_fact, attribution, scheduled_for: a.publishDate, cost_cents: 0, meta: version.meta });
  await store.patchDraft(draftId, { ...checked.patch, cost_cents: 0 });
  console.log(JSON.stringify({ event: "page_mended", siteId: a.siteId, draftId, mendOf: version.id, passed: checked.passed, failed: checked.failed.map((failure) => failure.rule).join(",") }));
  return draftId;
}

/**
 * The live page mended (SPEC §7, issue 1507): a new version of its own text
 * with what code repairs repaired — a list counted again, a repeated link
 * gone, a stray bracket removed — and nothing written. No model is asked:
 * 0¢. It is a new version through the refresh path, never an edit of the
 * live row (ADR-080), and it is dated as the version it mends (`datedAs`):
 * a renumbered list is not a change of what the page says, so its updated
 * date, `dateModified` and `lastmod` stay. It enters review only where it
 * passes today's whole battery, as a stored page re-checked does, at 0¢.
 */
export async function mendPage(a: MendInput): Promise<DayPageOutcome> {
  const mended = await mendedVersion(a);
  if (mended === null) return { ok: false, because: "step_failed", draftId: a.draftId ?? null, step: "mend" };
  const draftId = await insertMended(a, mended);
  return mended.checked.passed ? { ok: true, draftId } : { ok: false, because: "rules", draftId, attempts: 1 };
}

/** SPEC §7 (owner, 2026-11-17 ~23:45): a committed 0¢ `structure` mend or a `link`/`unseen` refresh never keeps the day.
 *  As an update that adds too little, it gives up its date, keeps its live version's, and never enters review, which would date it again. */
export async function setAside(draftId: string): Promise<boolean> {
  const store = generateStore();
  const row = await store.draftById(draftId);
  const o = row === null ? null : await opportunityById(row.opportunity_id);
  const cause = (o?.evidence as { shortfall?: { cause?: unknown } } | undefined)?.shortfall?.cause;
  if (row === null || o === null || !(mendable(o) || (o.type === "refresh_page" && (cause === "link" || cause === "unseen")))) return false;
  const meta = metaOf(row.meta), live = (meta.pack as ContextPack | undefined)?.live?.datedAs;
  await store.patchDraft(draftId, { scheduled_for: null, meta: typeof meta.datedAs === "string" || live === undefined ? meta : { ...meta, datedAs: live } });
  const { transition } = await import("@/lib/publish/machine");
  await transition(draftId, "needs_attention", { kind: "system", job: "draft/generate" }, { reason: "step_failed:adds" });
  return true;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A version live since `publishedAt` is at least the refresh floor old at `at`: nothing younger is refreshed for a day. */
const pastFloor = (publishedAt: Date, at: Date): boolean => at.getTime() - publishedAt.getTime() >= REFRESH_MIN_AGE_DAYS * DAY_MS;

/** A site none of whose live pages of ours has stood the refresh floor (owner, 2026-11-18): its pages are short by
 *  nature, and its shortfall is not shown. A read that fails reads as an established site, which shows it. */
export async function newSite(siteId: string, at: Date): Promise<boolean> {
  const pages = await opportunityStore().refreshPages(siteId).catch(() => null);
  return pages !== null && !pages.some((page) => page.takenDown !== true && pastFloor(page.publishedAt, at));
}

/** What an incomplete page of this site meets (`completenessFor`): `anyway` for the day's last step. */
export async function completenessOf(siteId: string, at: Date, anyway = false): Promise<Completeness> {
  return completenessFor(anyway ? "anyway" : "customer", await newSite(siteId, at));
}

/** R31's rivals of a `vs` topic, as its pack names them: the domains a page on it must read first-hand. */
export function versusRivals(site: SiteFacts, report: StoredReport, o: Pick<Opportunity, "targetQuery" | "absorbedQueries" | "title">): string[] {
  const market = site.market === undefined ? null : writingMarket({ site: { category: site.category, competitors: site.rivals, stored: site.market }, reportCategory: "" }).market;
  const business = { name: siteRulesOf(site, report).businessName, domain: site.domain, category: "", byline: null, voice: null, market, rivals: site.rivals };
  return rivalsOnlyVersus({ target: { searches: targetSearches(o), question: o.title ?? "" }, business }).map((rival) => rival.domain);
}

/** The day's topic: one whose named rival's own site does not answer gives up its date at 0¢, before its research is bought. */
export async function dayTopic(day: { siteId: string; site: SiteFacts; report: StoredReport }, date: string, now: Date): Promise<Opportunity | null> {
  for (let tries = 0; ; tries++) {
    const topic = await pageForDay(day.siteId, date, now);
    const rivals = topic === null || tries >= DAY_TOPICS_MAX ? [] : versusRivals(day.site, day.report, topic);
    if (topic === null || !(await Promise.all(rivals.map((domain) => fetchBody(`https://${domain}/`)))).includes(null)) return topic;
    await restTopic(topic.id, now, { zone: day.site.timeZone });
  }
}

/** A day the fallback kept no page for: each update candidate's gate, and `harm_stop` where a harm rule ended it. */
type Passed = { ok: false; because: "passed"; why: string };
const HARM_STOP = { ok: false, because: "harm_stop" } as const;
// A last step that tried no topic, which the reason keeps apart from one whose topics all failed.
const NO_TOPIC = { ok: false, because: "no_topic" } as const;

type Day = { siteId: string; site: SiteFacts; report: StoredReport; publishDate: string };
type Candidate = { page: OwnLivePage; standard: { parts: PartMark[]; met: boolean } | null; early: boolean };

/**
 * The live pages a day may update, the one furthest below the standard first (SPEC §7, owner 2026-11-17 ~23:45): the
 * fewest parts its stored `meta.standard` meets, ties to the oldest, and a page with none recorded after every page
 * measured. Each is past the refresh floor, but a page published below the standard, which may take one completing
 * update before it (ruling 14). A page its customer edited, took down or stopped a refresh of is theirs. 0¢.
 */
async function updateCandidates(siteId: string, at: Date, passed: string[] = []): Promise<Candidate[]> {
  const pages = (await opportunityStore().refreshPages(siteId)).filter((page) => page.takenDown !== true);
  const stopped = await stoppedRefreshes(siteId);
  const found: Candidate[] = [];
  for (const page of pages) {
    if (stopped.has(addressKey(page.url))) continue;
    if (page.edited === true || page.row.targetQuery === null) {
      passed.push(page.edited === true ? "edited" : "no_query");
      continue;
    }
    const meta = metaOf((await generateStore().liveVersionAt(siteId, page.url))?.draft.meta);
    const standard = Array.isArray(metaOf(meta.standard).parts) ? (meta.standard as Candidate["standard"]) : null;
    // Its one early update is the live version, so it is not picked again until it is past the floor.
    const early = !pastFloor(page.publishedAt, at) && standard?.met === false && meta.early !== true;
    if (early || pastFloor(page.publishedAt, at)) found.push({ page, standard, early });
    else passed.push("floor");
  }
  const met = (each: Candidate): number => each.standard?.parts.filter((part) => part.state === "met").length ?? Number.POSITIVE_INFINITY;
  return found.sort((x, y) => met(x) - met(y) || x.page.publishedAt.getTime() - y.page.publishedAt.getTime());
}

/** The search of the day's first update candidate, whose one SERP the day's research step asks with its own. */
export async function updateSearch(siteId: string, at: Date): Promise<string | null> {
  return (await updateCandidates(siteId, at).catch(() => []))[0]?.page.row.targetQuery ?? null;
}

/** The candidate's open refresh that is not resting, where it has one, else an `aged` one planned and assessed as
 *  Monday's are, beside any resting row at the address (a retarget); else why none is. */
async function refreshRow(siteId: string, page: OwnLivePage, at: Date, plan = true): Promise<Opportunity | "row_resting" | "row_unready"> {
  const store = opportunityStore();
  const openAt = async () => (await store.openRankable(siteId)).map(readOpportunity).filter((o) => o.type === "refresh_page" && addressKey(o.targetRef ?? "") === addressKey(page.url));
  // Only a harm or customer stop (`resting`) holds a row back from its page's update; a gate on a new topic does not.
  const usable = (rows: Opportunity[]) => rows.find((o) => o.unreadyReason !== "resting" && !isResting(o, at));
  let open = await openAt();
  // Titled as the page is, so the writer finds its live text even before the known-content copy lists it.
  const planned = { ...refreshOfPage(page, "aged", at), title: page.title || null };
  if (plan && usable(open) === undefined && (await persistAssessed(siteId, [planned], at)) > 0) open = await openAt();
  return usable(open) ?? (open.some((o) => isResting(o, at)) ? "row_resting" : "row_unready");
}

/** Real substance (SPEC §7, owner 2026-11-17 ~23:45): three new sourced facts or one new question answered, and two
 *  cited pages, one read in this run. A link, a mend or a page that says little more is not the day's content. */
function substantial(pack: ContextPack | undefined, body: string, since: Date): boolean {
  if (pack === undefined) return false;
  const live = pack.live?.markdown ?? "";
  const cited = pack.claims.filter((claim) => body.includes(claim.url));
  const facts = cited.filter((claim) => !fold(live).includes(fold(claim.passage))).length;
  const asked = (markdown: string): string[] => (markdown.match(/^#{2,3} .*\?\s*$/gm) ?? []).map(fold);
  const question = asked(body).some((heading) => !asked(live).includes(heading));
  return (facts >= 3 || question) && new Set(cited.map((claim) => claim.url)).size >= 2 && cited.some((claim) => Date.parse(claim.readAt) >= since.getTime());
}

/** The writer's update of one candidate, from its research: the day's page where it passes and adds real substance.
 *  One that adds too little keeps the live page's dates, gives up the date and rests as such a page does. */
async function writtenUpdate(page: Day & { opportunity: Opportunity }, marks: Meta, now: Date, cost: CostContext): Promise<{ ok: true; draftId: string } | null> {
  const { writeFallback } = await import(".");
  const store = generateStore();
  const outcome = await writeFallback(page, now, cost);
  const draftId = outcome.ok ? outcome.draftId : "draftId" in outcome ? outcome.draftId : null;
  if (draftId === null) return null;
  const row = await store.draftById(draftId);
  const meta = metaOf(row?.meta);
  const pack = meta.pack as ContextPack | undefined;
  const kept = outcome.ok && substantial(pack, row?.body_md ?? "", now);
  const dated = pack?.live?.datedAs === undefined ? {} : { datedAs: pack.live.datedAs };
  await store.patchDraft(draftId, { meta: { ...meta, ...(kept ? marks : dated) }, ...(kept ? {} : { scheduled_for: null }) });
  if (!outcome.ok || kept) return kept ? { ok: true, draftId } : null;
  const { transition } = await import("@/lib/publish/machine");
  await transition(draftId, "needs_attention", { kind: "system", job: "draft/generate" }, { reason: "step_failed:adds" });
  return null;
}

/** The day's update (SPEC §7): each candidate's one target SERP read on the normal queue, cached or bought inside the
 *  date's cap, and the first whose research reads is written. A page published short is passed over where its research
 *  holds no more questions than it has sections. `null` where none kept the day. */
async function dayUpdate(day: Day, trigger: string, now: Date, cost: CostContext, giveUp: () => Promise<void>, passed: string[]): Promise<{ ok: true; draftId: string } | null> {
  const locale = await siteLocale(day.siteId);
  for (const { page, standard, early } of await updateCandidates(day.siteId, now, passed)) {
    if (cost.capHit() || !roomForFix(cost)) return (passed.push("cap"), null);
    const [read] = researchSerps({ siteId: day.siteId, locale, target: page.row.targetQuery!, study: false }, RESEARCH.queueWaitS * 1000);
    const serp = await serpOrganic(cost, read!);
    if (serp.kind === "unmeasured") {
      passed.push("serp_unmeasured");
      continue;
    }
    const sections = standard?.parts.find((part) => part.part === "sections")?.have ?? 0;
    // The questions its research answers, where the commit checked its update, else the SERP's own count.
    const known = standard?.met === false ? await refreshRow(day.siteId, page, now, false) : null;
    const asked = standard?.met === false ? ((typeof known === "string" ? undefined : known?.planReason?.research?.Q) ?? serp.value.peopleAlsoAsk?.length ?? 0) : Infinity;
    const opportunity = asked <= sections ? "asked<=sections" : await refreshRow(day.siteId, page, now);
    if (typeof opportunity === "string") {
      passed.push(opportunity);
      continue;
    }
    await giveUp();
    const research = serp.value.reusedFrom === undefined ? "bought" : "cached";
    // One update is written for a day, whether or not it kept it.
    const written = await writtenUpdate({ ...day, opportunity }, { fallbackFor: trigger, research, ...(early ? { early: true } : {}) }, now, cost);
    if (written === null) passed.push("thin");
    return written;
  }
  return null;
}

/** The candidates' gates as the day's reason keeps them, `floor×2` for two; `no_candidate` where the site had none. */
function tally(passed: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const why of passed) counts.set(why, (counts.get(why) ?? 0) + 1);
  return counts.size === 0 ? "no_candidate" : `update:${[...counts].map(([why, n]) => (n > 1 ? `${why}×${n}` : why)).join(",")}`;
}

/** The topics a day's last step may write: its own date's first, an update too since it was committed for the date,
 *  then the spares that are new topics. Never a fix. */
async function weekTopics(siteId: string, date: string): Promise<Opportunity[]> {
  const { days, spares } = await committedWeek(siteId);
  const own = days.filter((day) => day.date === date).map((day) => day.opportunity);
  const writable = (o: Opportunity) => o.type !== "fix_page" && !mendable(o) && contentTypeOf(o) !== null;
  return [...own.filter(writable), ...spares.filter((o) => writable(o) && contentTypeOf(o) !== "update")];
}

/**
 * The day's last step (SPEC §7, owner 2026-11-18, rulings 1, 11, 13 and 16). A page a harm rule stopped ends the day
 * empty. One only completeness stopped is read again at 0¢ with completeness a warning and enters review. Otherwise
 * the topic is written anyway, as its type where its research holds the minimum, else as documentation from the
 * site's own facts; a topic neither can source costs no write, and the week's next short topic is tried. One write.
 */
async function lastStep(day: Day, a: { trigger: string; stopped: string | null; giveUp: () => Promise<void> }, now: Date, cost: CostContext): Promise<DayPageOutcome | typeof HARM_STOP | typeof NO_TOPIC> {
  const store = generateStore();
  const row = a.stopped === null ? null : await store.draftById(a.stopped);
  const failures = readRecordedRules(row?.rule_failures) ?? [];
  if (failures.some((failure) => stops(failure, "warn"))) return HARM_STOP;
  const opportunity = row === null || !failures.some((failure) => stops(failure)) ? null : await opportunityById(row.opportunity_id);
  if (row !== null && opportunity !== null) {
    const sets = await siteSets(day.siteId, day.site, day.report);
    const site = { ...sets.site, completeness: sets.site.completeness === "hidden" ? ("hidden" as const) : ("warn" as const) };
    const checked = await checkStoredAt0(row, row.body_md ?? "", { ...sets, site, opportunity, now });
    if (checked.kind === "checked" && checked.passed) {
      await store.patchDraft(row.id, { ...checked.patch, meta: { ...metaOf(checked.patch.meta), fallbackFor: a.trigger } });
      return { ok: true, draftId: row.id };
    }
  }
  await a.giveUp();
  const { writeFallback } = await import(".");
  const startedAt = Date.now();
  let ended: DayPageOutcome | typeof NO_TOPIC = NO_TOPIC;
  for (const topic of await weekTopics(day.siteId, day.publishDate)) {
    // An update is its live page's new version, never a new page beside it.
    for (const opportunity of contentTypeOf(topic) === "documentation" || contentTypeOf(topic) === "update" ? [topic] : [topic, { ...topic, writeAs: "documentation" as const }]) {
      if (cost.capHit() || Date.now() - startedAt > PIPELINE.nextTopicBeforeMs) return ended;
      const outcome = await writeFallback({ ...day, opportunity }, now, cost, "warn");
      const draftId = outcome.ok ? outcome.draftId : "draftId" in outcome ? outcome.draftId : null;
      if (draftId === null) {
        ended = outcome;
        // A documentation page reads no rival, so a topic short of rival evidence gives its turn to the next spare.
        if (!outcome.ok && outcome.because === "step_failed" && outcome.step.includes("rival_evidence")) break;
        continue;
      }
      await store.patchDraft(draftId, { meta: { ...metaOf((await store.draftById(draftId))?.meta), fallbackFor: a.trigger, anyway: true } });
      return outcome;
    }
  }
  return ended;
}

/** The day's page, where its own and its spares did not pass: the writer's update of the live page furthest below the
 *  standard, else the last step. Where neither kept it, `passed` names each update candidate's gate, the last step's
 *  failure and `harm_stop` behind a harm stop. `stopped` is the row that holds the date, which gives it up only to a page written for it. */
export async function refreshForDay(a: {
  siteId: string;
  publishDate: string;
  trigger: string;
  /** Whether the day's run ended before any page was written, so it has spent nothing. */
  from: "select" | "write";
  stopped: string | null;
  /** The run's due hour, which a topic's rest is read against and the day's spend so far is read since unless `since` says otherwise. */
  now?: Date; since?: Date;
}): Promise<{ ok: true; draftId: string } | { ok: false; because: "already_drafted" } | Passed | null> {
  const store = generateStore();
  const [site, report] = await Promise.all([store.siteFacts(a.siteId), store.latestReport(a.siteId)]);
  if (site === null || report === null) return null;
  // A replay after the insert finds the date its own row took.
  const holds = a.stopped !== null && (await store.draftById(a.stopped))?.scheduled_for === a.publishDate;
  if (!holds && (await store.draftOnDate(a.siteId, a.publishDate))) return { ok: false, because: "already_drafted" };
  const now = a.now ?? new Date();
  const day = { siteId: a.siteId, site, report, publishDate: a.publishDate };
  // The row the rules stopped gives up its date to the page written next, as a stopped topic does to its spare.
  const giveUp = async () => void (holds ? await store.patchDraft(a.stopped!, { scheduled_for: null }) : undefined);
  const inDay = <T>(body: (cost: CostContext) => Promise<T>): Promise<T | { ok: false; because: "already_drafted" } | null> =>
    // Opened at what the date has already spent, so the day keeps its one CAP_DRAFT.
    openDayCost({ scanId: report.scanId, siteId: a.siteId, since: a.since ?? now }, body).catch((error: unknown) => {
      if (error instanceof DraftDateTaken) return { ok: false, because: "already_drafted" } as const;
      // The customer stopped this page as it was saved: the day ends as its own did.
      if (error instanceof PageStopped) return null;
      throw error;
    });
  const passed: string[] = [];
  const ended = (outcome: DayPageOutcome | typeof HARM_STOP | typeof NO_TOPIC | null) => {
    if (outcome !== null && (outcome.ok || outcome.because === "already_drafted")) return outcome;
    const last = outcome === null ? "" : outcome.because === "harm_stop" ? ";harm_stop" : `;last:${outcome.because}${"step" in outcome ? `:${outcome.step}` : ""}`;
    return { ok: false, because: "passed", why: `${tally(passed)}${last}` } as const;
  };
  const updated = await inDay((cost) => dayUpdate(day, a.trigger, now, cost, giveUp, passed));
  if (updated !== null) return updated;
  // A day whose select found no topic has spent nothing, so it recommits before its last step.
  if (a.trigger === "generate:no_opportunity" && a.from === "select") {
    const { generateDayPage } = await import(".");
    const page = await generateDayPage({ siteId: a.siteId, publishDate: a.publishDate, updatesTried: true, now, since: a.since });
    if (page.ok || page.because !== "no_opportunity") return ended(page);
  }
  // A topic whose research is still on the queue is not short: the next tick writes it.
  if (a.trigger === "generate:research_pending") return ended(null);
  return ended(await inDay((cost) => lastStep(day, { trigger: a.trigger, stopped: holds ? a.stopped : null, giveUp }, now, cost)));
}
