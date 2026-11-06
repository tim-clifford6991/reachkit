// SPEC §7 (owner, 2026-11-05: "each day must have new or updated content, no exceptions") — a day whose run ends
// without a page takes a ready update from the committed week in the same run, and only where today's whole battery
// passes it. Here that is the live page mended in code: no model is asked, 0¢. Nothing ranks here.
import { committedWeek, queueForDraft, type Opportunity } from "@/lib/opportunities";
import { isOwnRefresh } from "@/lib/opportunities/types";
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

/** The day's page, where its own did not pass, from the committed week's updates; `null` where none passes, and then
 *  nothing is written, claimed or rested. `stopped` is the row that holds the date, which gives it up only here. */
export async function refreshForDay(a: {
  siteId: string;
  publishDate: string;
  trigger: string;
  /** Whether the day's run ended before any page was written, so it has spent nothing. */
  from: "select" | "write";
  stopped: string | null;
}): Promise<{ ok: true; draftId: string } | { ok: false; because: "already_drafted" } | null> {
  const store = generateStore();
  const [site, report] = await Promise.all([store.siteFacts(a.siteId), store.latestReport(a.siteId)]);
  if (site === null || report === null) return null;
  // A replay after the insert finds the date its own row took.
  const holds = a.stopped !== null && (await store.draftById(a.stopped))?.scheduled_for === a.publishDate;
  if (!holds && (await store.draftOnDate(a.siteId, a.publishDate))) return { ok: false, because: "already_drafted" };
  for (const opportunity of await candidates(a.siteId, a.publishDate)) {
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
  return null;
}
