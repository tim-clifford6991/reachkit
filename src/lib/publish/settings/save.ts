// BUILD §9 · §4.7 — the one writer of the four publishing settings, so every surface's change is the same change
// (REQ-073 c5) and runs the re-deadline pass. In order:
//   1. validate the patch whole, so a mistyped zone changes nothing;
//   2. compute each draft's deadline with `newVetoDeadline` (REQ-073 c4);
//   3. apply the site's values and every deadline in one statement (`save_publishing_settings`), never half-applied.
// A change clears the telling rather than sending one (BP-046 decision 3): no mail here; drafts whose pair changed come
// back in `retellOwed`, held by `customer_told` until told again. Clearing can only delay a page, never publish one untold.
import { publishDb } from "../db";
import type { Actor, GoverningPair, State, ToldRecord } from "../types";
import { STATES } from "../machine/table";
import { isNotYetPublished, newVetoDeadline } from "./apply";
import { pairOf, samePair } from "./pair";
import {
  invalidFields,
  readPublishingSettings,
  type PublishingSettings,
  type SettingsField,
} from "./settings";

export interface SaveApplied {
  /** Every draft the change reached. */
  draftIds: string[];
  /** Those whose governing pair changed, so the telling is owed again. */
  retellOwed: string[];
}

export type SaveResult =
  | { ok: true; settings: PublishingSettings; applied: SaveApplied }
  | { ok: false; invalid: readonly SettingsField[] };

interface DraftSettingsRow {
  id: string;
  state: string;
  veto_deadline: string | null;
  transitions: unknown;
  told: unknown;
  created_at: string | null;
}

/** When the page entered review: the last move to `in_review` in its transition record, written with the state so it
 *  cannot disagree. With none, the row's creation, which rule 3's `max` can only ignore. */
export function enteredReviewAt(transitions: unknown, createdAt: string | null): Date {
  const entries = Array.isArray(transitions) ? transitions : [];
  let latest: string | null = null;
  for (const entry of entries) {
    const record = entry as { to?: unknown; at?: unknown };
    if (record.to === "in_review" && typeof record.at === "string") {
      if (latest === null || record.at > latest) latest = record.at;
    }
  }
  const chosen = latest ?? createdAt;
  return chosen === null ? new Date(0) : new Date(chosen);
}

function stateOf(value: string): State {
  return STATES.find((candidate) => candidate === value) ?? "planned";
}

function toldPairOf(told: unknown): GoverningPair | null {
  const record = told as ToldRecord | null;
  if (record === null || typeof record !== "object" || record.pair === undefined) return null;
  return record.pair;
}

export async function savePublishingSettings(
  siteId: string,
  patch: Partial<PublishingSettings>,
  by: Actor,
  at: Date = new Date()
): Promise<SaveResult> {
  const invalid = invalidFields(patch);
  if (invalid.length > 0) return { ok: false, invalid };

  const previous = await readPublishingSettings(siteId);
  // Only the members the patch names: a spread would let `{ timezone: undefined }` erase the customer's zone.
  const next: PublishingSettings = {
    mode: patch.mode ?? previous.mode,
    vetoHours: patch.vetoHours ?? previous.vetoHours,
    publishTime: patch.publishTime ?? previous.publishTime,
    timezone: patch.timezone === undefined ? previous.timezone : patch.timezone,
  };
  const nextPair = pairOf(next);

  const drafts = await readDrafts(siteId);
  const entries = drafts
    .filter((row) => isNotYetPublished(stateOf(row.state)))
    .map((row) => {
      const currentDeadline =
        row.veto_deadline === null ? new Date(at.getTime()) : new Date(row.veto_deadline);
      const deadline = newVetoDeadline({
        state: stateOf(row.state),
        enteredReviewAt: enteredReviewAt(row.transitions, row.created_at),
        currentDeadline,
        previous,
        next,
        changedAt: at,
      });
      const toldPair = toldPairOf(row.told);
      // Never told: the telling is already owed.
      const clearTold = toldPair !== null && !samePair(toldPair, nextPair);
      return { draft_id: row.id, veto_deadline: deadline.toISOString(), clear_told: clearTold };
    });

  const { error } = await publishDb().rpc<number>("save_publishing_settings", {
    p_site_id: siteId,
    p_mode: next.mode,
    p_veto_hours: next.vetoHours,
    p_publish_time: next.publishTime,
    p_timezone: next.timezone,
    p_drafts: entries,
  });
  if (error !== null) {
    throw new Error(`src/lib/publish/settings: the save was refused: ${error.message}`);
  }

  log({ siteId, actor: by.kind, drafts: entries.length });

  return {
    ok: true,
    settings: next,
    applied: {
      draftIds: entries.map((entry) => entry.draft_id),
      retellOwed: entries.filter((entry) => entry.clear_told).map((entry) => entry.draft_id),
    },
  };
}

async function readDrafts(siteId: string): Promise<DraftSettingsRow[]> {
  const { data, error } = await publishDb()
    .from<DraftSettingsRow>("drafts")
    .select("id, state, veto_deadline, transitions, told, created_at")
    .eq("site_id", siteId);
  if (error !== null || data === null) return [];
  return data;
}

/** Ids and counts only, never a setting's value or a sentence. */
function log(line: { siteId: string; actor: Actor["kind"]; drafts: number }): void {
  console.log(JSON.stringify({ event: "publishing_settings_saved", ...line }));
}
