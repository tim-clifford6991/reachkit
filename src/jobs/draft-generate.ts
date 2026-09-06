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
import { activeSites, generateDraft, noticeBrokenDestination } from "@/jobs/engine";
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
    const due = (await activeSites()).filter((site) => isDraftDue(input.now, site.timeZone));
    if (due.length === 0) return { outcome: "skipped", subjectId: null, reason: "not-due" };

    const results = await fanOut(due, async (site) => {
      // BUILD §9's one mail per breakage, before the page this site's
      // broken destination would be holding is prepared. First, and not
      // last: a generation that falls over must not also cost the customer
      // the only telling they get that their pages are going nowhere.
      await noticeBrokenDestination({ siteId: site.siteId, now: input.now });
      return generateDraft({
        siteId: site.siteId,
        publishDate: nextPublishDate(input.now, site.timeZone),
      });
    });
    return settle(results, null);
  },
};
