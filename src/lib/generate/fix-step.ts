// SPEC §7 (D41 stage 4) — the page's one fix call where its write step had no room left for it: made on the row
// that step saved, from the write it holds, inside the date's one `CAP_DRAFT`.
import { opportunityById, type Opportunity } from "@/lib/opportunities";
import { contentTypeOf } from "@/lib/opportunities/content-type";
import { FIX_OWED } from "./pipeline/fix-call";
import { generateStore, type DraftRow } from "./store";
import type { DayPageOutcome } from ".";

/** The opportunity a row was written for, as the type the day wrote it as (issue 1455). */
export async function writtenFor(row: Pick<DraftRow, "opportunity_id" | "meta">): Promise<Opportunity | null> {
  const found = await opportunityById(row.opportunity_id);
  const writtenAs = (row.meta as { contentType?: unknown } | null)?.contentType;
  return found !== null && ((writtenAs === "qa" && contentTypeOf(found) === "listicle") || writtenAs === "documentation") ? { ...found, writeAs: writtenAs as "qa" | "documentation" } : found;
}

/** `now` is the run's due hour, which the date's spend so far is read since. */
export async function fixOwedPage(a: { draftId: string; now: Date }): Promise<DayPageOutcome> {
  const store = generateStore();
  const row = await store.draftById(a.draftId);
  if (row === null || row.scheduled_for === null) return { ok: false, because: "no_draft" };
  // A replay after the fix was made, or cut off once it began: nothing is bought again, a page that passed goes to review, and one that did not rests.
  if (!(FIX_OWED in ((row.meta as object | null) ?? {}))) {
    if (row.state !== "generating") return { ok: false, because: "rules", draftId: row.id, attempts: row.hard_rule_attempts };
    if (row.hard_rules_passed === true) return { ok: true, draftId: row.id };
    await (await import(".")).rest(row.id, row.opportunity_id, "step_failed:fix", a.now, (await store.siteFacts(row.site_id))?.timeZone);
    return { ok: false, because: "step_failed", draftId: row.id, step: "fix" };
  }
  const [site, report, opportunity] = await Promise.all([store.siteFacts(row.site_id), store.latestReport(row.site_id), writtenFor(row)]);
  if (site === null || report === null || opportunity === null) return { ok: false, because: "no_draft" };
  const { writeFallback } = await import(".");
  return writeFallback({ siteId: row.site_id, site, report, opportunity, publishDate: row.scheduled_for, draftId: row.id, fixStep: "owed" }, a.now);
}
