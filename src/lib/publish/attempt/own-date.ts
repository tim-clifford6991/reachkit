// A page the interrupted rewrite sent into review on a later date than its plan's returns to that date, once it is free:
// entering review no longer moves a date, and a page moved before that rule must not leave its day empty.
import { VETO } from "@/lib/config/constants";
import { REWRITTEN } from "@/lib/generate/interrupted";
import { publishDb } from "../db";
import { machineDraftFor } from "../machine";
import { keepsDate, reviewDeadline } from "../settings/clock";
import { settingsOf } from "../settings/pair";

interface ReviewRow {
  id: string;
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
    .select("id, opportunity_id, scheduled_for, veto_deadline, meta")
    .in("site_id", siteIds)
    .eq("state", "in_review");
  if (error !== null) throw new Error(`publish/own-date: could not read the pages in review: ${error.message}`);
  let moved = 0;
  for (const row of data ?? []) {
    if (typeof row.meta !== "object" || row.meta === null || !(REWRITTEN in row.meta) || row.opportunity_id === null) continue;
    const plan = await publishDb().from<{ planned_for: string | null }>("opportunities").select("planned_for").eq("id", row.opportunity_id).limit(1);
    const date = plan.data?.[0]?.planned_for ?? null;
    const draft = await machineDraftFor(row.id);
    if (date === null || row.scheduled_for === null || date >= row.scheduled_for || draft === null) continue;
    const settings = settingsOf(draft.governing);
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
