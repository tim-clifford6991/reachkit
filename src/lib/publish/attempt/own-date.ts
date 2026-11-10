// A page the interrupted rewrite sent into review on a later date than its plan's returns to that date, once it is free:
// entering review no longer moves a date, and a page moved before that rule must not leave its day empty.
import { VETO } from "@/lib/config/constants";
import { type DecidedDay, REWRITTEN, emptyDraftedDay } from "@/lib/generate/interrupted";
import { publishDb } from "../db";
import { machineDraftFor } from "../machine";
import { keepsDate, localDateOf, reviewDeadline } from "../settings/clock";
import { settingsOf } from "../settings/pair";

interface ReviewRow {
  id: string;
  site_id: string;
  opportunity_id: string | null;
  scheduled_for: string | null;
  veto_deadline: string | null;
  meta: unknown;
}

/** Moves each such page back and returns how many moved; a page already on its plan's date is left, so a rerun moves none. */
export async function returnToPlannedDate(siteIds: readonly string[], now: Date): Promise<number> {
  if (siteIds.length === 0) return 0;
  const { data, error } = await publishDb()
    .from<ReviewRow>("drafts")
    .select("id, site_id, opportunity_id, scheduled_for, veto_deadline, meta")
    .in("site_id", siteIds)
    .eq("state", "in_review");
  if (error !== null) throw new Error(`publish/own-date: could not read the pages in review: ${error.message}`);
  let moved = 0;
  for (const row of data ?? []) {
    if (typeof row.meta !== "object" || row.meta === null || !(REWRITTEN in row.meta) || row.opportunity_id === null) continue;
    const plan = await publishDb().from<{ planned_for: string | null }>("opportunities").select("planned_for").eq("id", row.opportunity_id).limit(1);
    const draft = await machineDraftFor(row.id);
    if (row.scheduled_for === null || draft === null) continue;
    const settings = settingsOf(draft.governing);
    const date = plan.data?.[0]?.planned_for ?? (await leftDay(row, localDateOf(now, settings)));
    if (date === null || date >= row.scheduled_for) continue;
    // A date already gone, or one another page holds (the unique index), leaves the page where it is.
    if (!keepsDate(now, date, settings)) continue;
    const ends = reviewDeadline(now, draft.governing.vetoHours > 0 ? draft.governing.vetoHours : VETO.defaultHours, date, settings);
    const deadline = row.veto_deadline !== null && Date.parse(row.veto_deadline) < ends.getTime() ? row.veto_deadline : ends.toISOString();
    const update = await publishDb()
      .from<{ id: string }>("drafts")
      .update({ scheduled_for: date, veto_deadline: deadline })
      .eq("id", row.id)
      .eq("state", "in_review")
      .eq("scheduled_for", row.scheduled_for);
    if (update.error === null) moved++;
    else if (update.error.code !== "23505") throw new Error(`publish/own-date: could not move the page back: ${update.error.message}`);
  }
  return moved;
}

// A rewrite of a spare has no plan date: the day it left empty is the `drafted` day no page holds.
async function leftDay(row: ReviewRow, today: string): Promise<string | null> {
  const markedAt = (row.meta as Record<string, unknown>)[REWRITTEN];
  if (typeof markedAt !== "string" || row.scheduled_for === null) return null;
  const days = await publishDb()
    .from<DecidedDay>("draft_days")
    .select("publish_date, decided_at")
    .eq("site_id", row.site_id)
    .eq("outcome", "drafted")
    .gte("publish_date", today)
    .lte("publish_date", row.scheduled_for);
  if (days.error !== null) throw new Error(`publish/own-date: could not read the decided days: ${days.error.message}`);
  const dates = (days.data ?? []).map((d) => d.publish_date);
  if (dates.length === 0) return null;
  const pages = await publishDb().from<{ scheduled_for: string }>("drafts").select("scheduled_for").eq("site_id", row.site_id).in("scheduled_for", dates);
  if (pages.error !== null) throw new Error(`publish/own-date: could not read the pages on those days: ${pages.error.message}`);
  return emptyDraftedDay(days.data ?? [], new Set((pages.data ?? []).map((p) => p.scheduled_for)), today, row.scheduled_for, markedAt);
}
