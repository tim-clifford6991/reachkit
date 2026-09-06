// BUILD §9 — the publishing switch: instant stop, the held set, resume order.
//
// §9: "pause is one click and instant." Instant means the switch is read
// where the decision is made — inside the claim, immediately before the
// write — and never cached: a page whose attempt has not begun when the
// switch is recorded does not begin one.
//
// **A held page is the absence of an edge, not an eleventh state.** Nothing
// here writes a `held` column, and nothing here moves a page: switching off
// takes no transition, and a page held by it keeps the state it holds — it
// is never skipped, discarded or brought to rest as needing the customer on
// account of publishing being off. That is also the shape #116 needs: a
// page prepared before a ReachKit stop is still there, in the state it was
// in, when the stop lifts.
//
// The archived plan is WO-210.
import { publishDb } from "../db";
import type { Actor, State } from "../types";

/** The three states a page can be publishable in and still not have gone
 *  out — §9's four held kinds land in exactly these: one already approved,
 *  one whose veto window expired while the switch was off, one whose
 *  publish time arrived, one whose retry fell due. */
export const HELD_STATES: readonly State[] = Object.freeze([
  "in_review",
  "approved",
  "failed",
] as const);

/** Reads `sites.publishing_enabled`. A site row that cannot be read is not
 *  a site we may publish for: the answer is `false`, never a default that
 *  lets an attempt begin. */
export async function isPublishingOn(siteId: string): Promise<boolean> {
  const { data, error } = await publishDb()
    .from<{ publishing_enabled: boolean | null }>("sites")
    .select("publishing_enabled")
    .eq("id", siteId)
    .single();
  if (error !== null || data === null) return false;
  return data.publishing_enabled === true;
}

/**
 * Records the switch and returns the moment it was recorded.
 *
 * It moves no page and takes no transition — the whole mechanism is that
 * every attempt reads the column, so recording it is the entire act. The
 * returned moment is the boundary §9's promise is stated against.
 */
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

/**
 * The pages a resume would drain — while publishing is off, exactly the
 * pages it is holding.
 *
 * Derived in one query and never stored: a page is held when it is in one
 * of `HELD_STATES` and has become publishable (`drafts.publishable_since`
 * is the moment it did). There is no `held` column to write and none to
 * forget to clear.
 */
export async function heldPages(siteId: string): Promise<HeldPages> {
  const rows = await heldRows(siteId);
  return { count: rows.length, draftIds: rows.map((row) => row.id) };
}

/**
 * The held pages in the order they were held, oldest first, so a resume
 * drains the backlog in the order the customer accrued it and drops none.
 *
 * `publishable_since` ascending, `id` ascending as the tiebreak — a total
 * order, so two pages that became publishable in the same millisecond
 * still resume in a stable one.
 */
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
