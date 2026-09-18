// src/jobs/draft-generate.ts — BUILD §11
//
// "`draft/generate` · daily, evening · Next opportunity → pipeline →
// `in_review`, veto clock starts, daily email." Evening is the site's own
// evening: an hourly tick, gated on each site's local due hour, on the same
// grounds ADR-060 states for the weekly one — a single UTC hour is a
// different time of day in every zone, and the run must finish before the
// site's own veto window would open on the next publish date.
//
// In the kill switch's scope: `runJob()` stops it before this body's first
// spend and first write.
//
// It is also where the customer's Regenerate is carried out (#788): the
// restart only moves the page back into `generating`, and every tick —
// not only a site's evening — writes one restarted page a site again.
//
// **What makes a second delivery of one tick harmless** (issue 886).
// Delivery is at-least-once and a clock tick carries no payload, so there
// is no natural key to dedupe on and `idempotencyKey` is empty, exactly as
// `types.ts` describes for a tick: "whose idempotency is a database
// constraint owned by the engine, not by the trigger". Two things hold it,
// and neither is in this file:
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
  generateDraft,
  noticeBrokenDestination,
  regenerateDraft,
  restartedDrafts,
} from "@/jobs/engine";
import { fanOut, settle } from "./fan-out";
import { isDraftDue, nextPublishDate } from "./site-clock";
import type { JobDefinition, Outcome } from "./types";

/** Hourly, on the hour; due-ness is per site, inside the run. */
export const DRAFT_TICK_CRON = "0 * * * *";

export const draftGenerate: JobDefinition = {
  id: "draft/generate",
  trigger: { kind: "cron", cron: DRAFT_TICK_CRON },
  idempotencyKey: [],
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

    const due = selection.sites.filter((site) => isDraftDue(input.now, site.timeZone));
    if (due.length === 0) {
      return restarted.length === 0
        ? { outcome: "skipped", subjectId: null, reason: "not-due" }
        : settle(regenerated, null);
    }

    const results = await fanOut(due, async (site) => {
      // BUILD §9's one mail per breakage, before the page this site's
      // broken destination would be holding is prepared. First, and not
      // last: a generation that falls over must not also cost the customer
      // the only telling they get that their pages are going nowhere.
      await noticeBrokenDestination({ siteId: site.siteId, now: input.now });
      return generateDraft({
        siteId: site.siteId,
        publishDate: nextPublishDate(input.now, site.timeZone),
        now: input.now,
      });
    });
    return settle([...regenerated, ...results], null);
  },
};
