// SPEC §7 (owner, 2026-11-05: "each day must have new or updated content, no exceptions") — a day whose run ends
// without a page takes a ready update from the committed week in the same run, and only where today's whole battery
// passes it. Here that is the live page mended in code: no model is asked, 0¢. Nothing ranks here.
import { REFRESH_MIN_AGE_DAYS } from "@/lib/config/constants";
import { committedWeek, queueForDraft, type Opportunity } from "@/lib/opportunities";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { isOwnRefresh } from "@/lib/opportunities/types";
import type { CostContext } from "@/lib/costs";
import type { StoredReport } from "@/lib/scan/report";
import type { DayPageOutcome } from ".";
import { checkStoredAt0, siteSets, type RecheckOutcome } from "./recheck";
import { mendedInCode, repairStructure } from "./rules/structure";
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

/** The live page's mended new version under today's battery, written nowhere. `null` where nothing changed or there
 *  is nothing the battery may check. */
async function mendedVersion(a: MendInput, extra: Record<string, unknown> = {}): Promise<Mended | null> {
  const store = generateStore();
  const url = a.opportunity.targetRef;
  const live = await store.liveVersionAt(a.siteId, url);
  if (live === null) return null;
  const meta = (typeof live.draft.meta === "object" && live.draft.meta !== null ? live.draft.meta : {}) as Record<string, unknown>;
  const body = repairStructure(live.draft.body_md ?? "", { title: live.draft.title ?? "" });
  // Mended since it was planned: there is nothing to publish.
  if (body === (live.draft.body_md ?? "")) return null;
  const version = { ...live.draft, meta: { ...meta, datedAs: typeof meta.datedAs === "string" ? meta.datedAs : live.publishedAt.toISOString(), mendOf: live.draft.id, ...extra } };
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

/** The committed week's ready updates a day may take: the spares, then the rows planned for a later date, latest
 *  first so the nearest days stay as shown; within each, ReachKit's own refresh first (SPEC §7 Pace). */
async function candidates(siteId: string, date: string): Promise<Opportunity[]> {
  const { days, spares } = await committedWeek(siteId);
  const ownFirst = (rows: Opportunity[]) => rows.filter((o) => o.ready && o.family === "improve").sort((x, y) => Number(isOwnRefresh(y)) - Number(isOwnRefresh(x)));
  const later = days.filter((day) => day.date > date).sort((x, y) => y.date.localeCompare(x.date));
  return [...ownFirst([...spares]), ...ownFirst(later.map((day) => day.opportunity))];
}

/** The committed week's first ready update the writer refreshes from stored research: one of our pages past its floor. */
async function writableUpdate(siteId: string, date: string, week?: Opportunity[]): Promise<Opportunity | null> {
  for (const opportunity of week ?? (await candidates(siteId, date))) {
    if (!mendable(opportunity) && contentTypeOf(opportunity) === "update" && (await pastFloor(siteId, opportunity.targetRef))) return opportunity;
  }
  return null;
}

/** The day's last rung once its topics and spares came up short, inside its one context: a new page's topic as a
 *  reference page of the site's own facts, which reads no research, else an update of one of our live pages. A day
 *  neither fills ends `no_own_facts`, naming what the reference page's pack lacked, else as its own topic did. */
export async function ownFactsPage(page: MendInput & { publishDate: string }, cost: CostContext, now: Date, ended: DayPageOutcome): Promise<DayPageOutcome> {
  const { writeStoredUpdate } = await import(".");
  // The rung's page has no row yet, so its calls are counted as one's.
  await cost.forDraft?.(null);
  const short = (outcome: DayPageOutcome): outcome is Extract<DayPageOutcome, { because: "step_failed" }> =>
    !outcome.ok && outcome.because === "step_failed" && outcome.draftId === null && outcome.step.startsWith("pack");
  const documented = contentTypeOf(page.opportunity) === "update" ? null : await writeStoredUpdate({ ...page, opportunity: { ...page.opportunity, writeAs: "documentation" } }, now, cost);
  if (documented !== null && !short(documented)) return documented;
  // The update carries the reason the day's own page ended on, as the update fallback's always does.
  const update = await writableUpdate(page.siteId, page.publishDate);
  const trigger = ended.ok ? "" : `generate:${ended.because === "step_failed" ? `step_failed:${ended.step}` : ended.because}`;
  const updated = update === null ? null : await writtenUpdate({ ...page, opportunity: update }, trigger, now, cost);
  if (updated !== null) return updated;
  return documented === null ? ended : { ok: false, because: "no_own_facts", step: documented.step };
}

/** The day's page, where its own did not pass, from the committed week's updates; `null` where none passes, and then
 *  nothing is written, claimed or rested. `stopped` is the row that holds the date, which gives it up only here. */
export async function refreshForDay(a: {
  siteId: string;
  publishDate: string;
  trigger: string;
  /** Whether the day's run ended before any page was written, so it has spent nothing. */
  from: "select" | "write";
  stopped: string | null;
  /** The run's due hour, which a topic's rest is read against and the day's spend so far is read since. */
  now?: Date;
}): Promise<DayPageOutcome | null> {
  const store = generateStore();
  const [site, report] = await Promise.all([store.siteFacts(a.siteId), store.latestReport(a.siteId)]);
  if (site === null || report === null) return null;
  // A replay after the insert finds the date its own row took.
  const holds = a.stopped !== null && (await store.draftById(a.stopped))?.scheduled_for === a.publishDate;
  if (!holds && (await store.draftOnDate(a.siteId, a.publishDate))) return { ok: false, because: "already_drafted" };
  const week = await candidates(a.siteId, a.publishDate);
  for (const opportunity of week) {
    if (!mendable(opportunity)) continue;
    const page = { siteId: a.siteId, site, report, opportunity, publishDate: a.publishDate };
    const mended = await mendedVersion(page, { fallbackFor: a.trigger });
    if (mended === null || !mended.checked.passed) continue;
    if (holds) await store.patchDraft(a.stopped!, { scheduled_for: null });
    try {
      const draftId = await insertMended(page, mended);
      await queueForDraft(opportunity.id);
      return { ok: true, draftId };
    } catch (error) {
      if (error instanceof DraftDateTaken) return { ok: false, because: "already_drafted" };
      // The customer stopped this one as it was saved: the week's next is read.
      if (error instanceof PageStopped) continue;
      throw error;
    }
  }
  // Only a day whose select found no topic has spent nothing, so the writer's one context is the day's only one.
  if (a.trigger !== "generate:no_opportunity" || a.from !== "select") return null;
  const update = await writableUpdate(a.siteId, a.publishDate, week);
  if (update !== null) return writtenUpdate({ siteId: a.siteId, site, report, opportunity: update, publishDate: a.publishDate }, a.trigger, a.now ?? new Date());
  // No update passed and none was written: the day goes on down its ladder, the recommit then its own facts.
  const { generateDayPage } = await import(".");
  const page = await generateDayPage({ siteId: a.siteId, publishDate: a.publishDate, updatesTried: true, ...(a.now === undefined ? {} : { now: a.now }) });
  return !page.ok && page.because === "no_opportunity" ? null : page;
}

/** One of ReachKit's own pages, live at `url` for at least the refresh floor: nothing else is refreshed for a day. */
async function pastFloor(siteId: string, url: string): Promise<boolean> {
  const live = await generateStore().liveVersionAt(siteId, url);
  return live !== null && Date.now() - live.publishedAt.getTime() >= REFRESH_MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/** The writer's refresh of one candidate, from stored research: today's page where the battery passes it, else a
 *  stopped row that gives up the date while the day keeps its own reason. */
async function writtenUpdate(page: MendInput & { publishDate: string }, trigger: string, now: Date, cost?: CostContext): Promise<{ ok: true; draftId: string } | { ok: false; because: "already_drafted" } | null> {
  const { writeStoredUpdate } = await import(".");
  const store = generateStore();
  try {
    const outcome = await writeStoredUpdate(page, now, cost);
    const draftId = outcome.ok ? outcome.draftId : "draftId" in outcome ? outcome.draftId : null;
    if (draftId === null) return null;
    const meta = (await store.draftById(draftId))?.meta;
    await store.patchDraft(draftId, { meta: { ...(typeof meta === "object" && meta !== null ? meta : {}), fallbackFor: trigger, research: "stored" }, ...(outcome.ok ? {} : { scheduled_for: null }) });
    return outcome.ok ? { ok: true, draftId } : null;
  } catch (error) {
    if (error instanceof DraftDateTaken) return { ok: false, because: "already_drafted" };
    if (error instanceof PageStopped) return null;
    throw error;
  }
}
