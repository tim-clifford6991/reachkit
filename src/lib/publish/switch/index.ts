// BUILD §9 — the publishing switch: instant stop, the held set, resume order. "Pause is one click and instant": the
// switch is read inside the claim, just before the write, never cached.
// A held page is the absence of an edge, not an eleventh state: no `held` column, no transition, never skipped or
// brought to rest as needing the customer.
// A ReachKit stop (REQ-092 c5) is a second reason, not a second mechanism: `reachKitStopped()` feeds the
// `reachkit_not_stopped` guard, and the held set and resume order are blind to which reason holds a page.
import { publishDb } from "../db";
import type { Actor, State } from "../types";

/** The states a page can be publishable in and not yet out; §9's four held kinds land in exactly these. */
export const HELD_STATES: readonly State[] = Object.freeze([
  "in_review",
  "approved",
  "failed",
] as const);

/** Reads `sites.publishing_enabled`; an unreadable row is `false`, never a default that lets an attempt begin. */
export async function isPublishingOn(siteId: string): Promise<boolean> {
  const { data, error } = await publishDb()
    .from<{ publishing_enabled: boolean | null }>("sites")
    .select("publishing_enabled")
    .eq("id", siteId)
    .single();
  if (error !== null || data === null) return false;
  return data.publishing_enabled === true;
}

/** Has ReachKit stopped publishing (REQ-092 c1)? Only the halt stops an attempt: §11's kill switch binds
 *  "scan+generate+publish", while the spend ceiling refuses paid vendor calls only (§6.5), and delivery buys none.
 *  A dynamic import, read per call: `env` throws at load on a missing binding, and every machine suite imports this leaf. */
export async function reachKitStopped(): Promise<boolean> {
  const { env } = await import("@/lib/config/env");
  return env.KILL_SWITCH;
}

/** Records the switch and returns when; every attempt reads the column, so no page moves. §9's promise is stated
 *  against the returned moment. */
export async function setPublishing(
  siteId: string,
  on: boolean,
  by: Actor
): Promise<{ recordedAt: Date }> {
  const recordedAt = new Date();
  const { error } = await publishDb()
    .from<never>("sites")
    .update({
      publishing_enabled: on,
      publishing_changed_at: recordedAt.toISOString(),
      publishing_changed_by: by.kind,
    })
    .eq("id", siteId);
  if (error !== null) {
    throw new Error(`src/lib/publish/switch: could not record the switch: ${error.message}`);
  }
  return { recordedAt };
}

export interface HeldPages {
  count: number;
  draftIds: string[];
}

/** The pages a resume would drain: in `HELD_STATES` with `publishable_since` set, derived in one query, never stored.
 *  Cause-agnostic, as REQ-092 c5 needs, so the switch and a ReachKit stop hold one set in one order. */
export async function heldPages(siteId: string): Promise<HeldPages> {
  const rows = await heldRows(siteId);
  return { count: rows.length, draftIds: rows.map((row) => row.id) };
}

/** The held pages oldest first, so a resume drops none: REQ-092 c5's "normal schedule" after a stop. `publishable_since`
 *  then `id`, a total order. */
export async function resumeOrder(siteId: string): Promise<string[]> {
  return (await heldRows(siteId)).map((row) => row.id);
}

interface HeldRow {
  id: string;
}

async function heldRows(siteId: string): Promise<HeldRow[]> {
  const { data, error } = await publishDb()
    .from<HeldRow>("drafts")
    .select("id, publishable_since")
    .eq("site_id", siteId)
    .in("state", [...HELD_STATES])
    .not("publishable_since", "is", null)
    .order("publishable_since", { ascending: true })
    .order("id", { ascending: true });
  if (error !== null || data === null) return [];
  return data.map((row) => ({ id: row.id }));
}
