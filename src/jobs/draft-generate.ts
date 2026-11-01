// src/jobs/draft-generate.ts — BUILD §11
//
// "`draft/generate` · daily · Next opportunity → pipeline → `in_review`,
// veto clock starts, daily email." An hourly tick, gated on each site's
// own due hour, on the same grounds ADR-060 states for the weekly one — a
// single UTC hour is a different time of day in every zone. The due hour
// is the one whose veto window ends at the site's publish time on the date
// the page is for (issue 1337, `site-clock.ts`), so a page nobody touches
// publishes on its calendar day.
//
// In the kill switch's scope: `runJob()` stops it before this body's first
// spend and first write, and again before each site's own run.
//
// **One run per site.** The tick selects and sends; each due site is an
// event keyed `draft:{site}:{date}` and a run of its own, bounded to one at
// a time per site and five in all, so one zone's due hour is never one
// invocation's work. A site whose due hour passed with no day recorded — a
// tick the platform missed, a run killed before it wrote — is sent on the
// next tick while its window is still open, under the same key.
//
// It is also where the customer's Regenerate is carried out (#788): the
// restart only moves the page back into `generating`, and every tick —
// not only a site's due hour — writes one restarted page a site again.
//
// **What makes a second delivery of one tick harmless** (issue 886). The
// key: a re-sent `draft:{site}:{date}` is dropped by the platform, and a
// second delivery of one is refused by the per-site run's idempotency. And
// behind it, two things in the engine:
//
//   * **The day's page.** `generateDayPage()` asks first whether the site
//     already holds a draft for the date, before the cost context is opened
//     and before the first model call, and answers `already_drafted` — read
//     here as a day already done, not a degraded tick. That is exact for a
//     redelivery arriving after the first run wrote its row, and it is what
//     keeps the second delivery free. Two deliveries running *together*
//     both pass it, and `drafts_one_per_site_per_date` is what decides
//     them: one row is written, the loser answers `already_drafted` too.
//   * **The restarted pages.** `restartedDrafts()` returns rows whose last
//     recorded move is the customer's restart, and `regenerateRestarted()`
//     rewrites the row it was given — it writes no row of its own, and it
//     refuses a row that has left `generating`, which the first run's own
//     ending moves it out of. So a redelivery rewrites nothing, and two
//     deliveries running together rewrite one row rather than writing two.
import {
  activeSites,
  alertSiteDay,
  generateDraft,
  noticeBrokenDestination,
  recordDraftDay,
  regenerateDraft,
  restartedDrafts,
  missedDays,
} from "@/jobs/engine";
import { JOB_SUBJECT_CONCURRENCY, LLM_RUN_THROTTLE } from "@/lib/config/constants";
import { fanOut, sendSubjects, settle } from "./fan-out";
import { isDraftDue, nextPublishDate, openDraftDays, tickHour } from "./site-clock";
import type { JobDefinition, JobInput, Outcome } from "./types";

/** Hourly at :03, off the minute the other hourly jobs read in; due-ness is
 *  per site, decided from the tick's hour, so the minute changes no draft. */
export const DRAFT_TICK_CRON = "3 * * * *";

type Site = Awaited<ReturnType<typeof activeSites>>["sites"][number];

/** One site's due hour, as its run reads it from the event, and its clock where the event carries it. */
function siteDay(data: JobInput["data"]): { siteId: string; publishDate: string; hour: Date; site: Site | null } {
  const { siteId, publishDate, hour, timeZone, publishTime, vetoHours } = data;
  if (typeof siteId !== "string" || typeof publishDate !== "string" || typeof hour !== "string") {
    throw new TypeError("draft/generate: a site run needs siteId, publishDate and hour");
  }
  const clocked = typeof timeZone === "string" && typeof publishTime === "string" && typeof vetoHours === "number";
  return { siteId, publishDate, hour: new Date(hour), site: clocked ? { siteId, timeZone, publishTime, vetoHours } : null };
}

/** The event a due day is sent as: the site's clock rides along, so its run can check the publish time. */
function dayEvent(site: Site, day: { publishDate: string; hour: Date }) {
  return {
    key: `draft:${site.siteId}:${day.publishDate}`,
    data: { siteId: site.siteId, publishDate: day.publishDate, hour: day.hour.toISOString(), timeZone: site.timeZone, publishTime: site.publishTime, vetoHours: site.vetoHours },
  };
}

/** One site's page for one date: the breakage notice, the page in its own
 *  steps, and how the day ended. The window is counted from the due hour
 *  the event names, so a queued or caught-up run still ends it at or
 *  before the publish time. */
async function draftSite(input: JobInput): Promise<Outcome> {
  const { siteId, publishDate, hour, site } = siteDay(input.data);
  const step = input.step ?? ((_name, body) => body());
  try {
    // BUILD §9's one mail per breakage, before the page this site's broken
    // destination would be holding is prepared. First, and not last: a
    // generation that falls over must not also cost the customer the only
    // telling they get that their pages are going nowhere.
    await step("notice", () => noticeBrokenDestination({ siteId, now: input.now }));
    const result = await generateDraft({ siteId, publishDate, now: hour, ...(input.step === undefined ? {} : { step: input.step }) });
    // Issue 1455: the day keeps its reason after the next tick has run.
    await recordDraftDay(
      "degraded" in result
        ? { siteId, publishDate, outcome: "no_page", reason: result.degraded, at: hour }
        : { siteId, publishDate, outcome: "drafted", reason: null, at: hour }
    );
    // Last, so a page the recheck rescued or the review let through is seen and nothing it covered is mailed.
    if (site !== null) await step("alert", () => alertSiteDay({ site, hour }));
    return "degraded" in result ? { outcome: "degraded", subjectId: siteId, step: result.degraded } : { outcome: "ran", subjectId: siteId };
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    await recordDraftDay({ siteId, publishDate, outcome: "failed", reason, at: hour });
    throw error;
  }
}

export const draftGenerate: JobDefinition = {
  id: "draft/generate",
  trigger: { kind: "cron", cron: DRAFT_TICK_CRON },
  idempotencyKey: [],
  perSubject: draftSite,
  concurrency: [{ key: "siteId", shared: true, limit: 1 }, { limit: JOB_SUBJECT_CONCURRENCY }],
  throttle: LLM_RUN_THROTTLE,
  async run(input): Promise<Outcome> {
    const selection = await activeSites();
    // A tick that could not decide who is paying prepares no page and says
    // so (#201). It is not a skip: a quiet hour and an unanswerable one
    // must not look alike in the run record, because one of them needs an
    // operator. Nothing is moved and the next tick asks again.
    if (selection.held !== null) {
      return { outcome: "degraded", subjectId: null, step: `held:${selection.held}` };
    }

    const restarted = await restartedDrafts(selection.sites.map((site) => site.siteId));
    const regenerated = await fanOut(restarted, (draft) =>
      regenerateDraft({ siteId: draft.siteId, draftId: draft.draftId, now: input.now })
    );

    // The window a due page opens is counted from the tick's own hour, so
    // it ends at or before the publish time however late the tick arrived.
    const hour = tickHour(input.now);
    const dueNow = selection.sites
      .filter((site) => isDraftDue(hour, site))
      .map((site) => ({ site, siteId: site.siteId, publishDate: nextPublishDate(hour, site), hour }));
    const missed = await missedDays(
      selection.sites.flatMap((site) => openDraftDays(hour, site).map((day) => ({ site, siteId: site.siteId, ...day })))
    );
    const due = [...dueNow, ...missed];
    if (due.length === 0) {
      return restarted.length === 0
        ? { outcome: "skipped", subjectId: null, reason: "not-due" }
        : settle(regenerated, null);
    }

    const sent = await sendSubjects(
      input,
      due.map((day) => dayEvent(day.site, day)),
      draftSite
    );
    return settle([...regenerated, ...sent], null);
  },
};
