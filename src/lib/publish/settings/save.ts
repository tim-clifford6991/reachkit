// BUILD §9 · §4.7 — the one writer of the four publishing settings.
//
// `sites.mode`, `sites.veto_hours`, `sites.publish_time` and
// `sites.timezone` are written here and nowhere else, so the mode a sidebar
// card changes and the mode the Settings screen changes are the same change
// (REQ-073 c5) and both run the re-deadline pass.
//
// Order, and it matters:
//
//   1. validate the patch **whole** — an invalid patch writes nothing at
//      all, so a customer who mistypes a zone does not find their mode
//      changed;
//   2. compute each draft's new deadline with `newVetoDeadline`, the pure
//      function that is REQ-073 c4's four rules;
//   3. apply the site's four values and every draft's deadline in **one**
//      statement (`save_publishing_settings`), so a change is never
//      half-applied across drafts.
//
// **A settings change clears the telling rather than sending one**
// (BP-046 decision 3). This function sends no mail. Every draft whose
// governing pair changed comes back in `applied.retellOwed` with its
// `drafts.told` cleared, and the `customer_told` guard holds it until the
// customer has been told again. A customer stepping the window from 1 to 2
// to 3 days sends no mail at all — and can never cause a publication they
// were not told about, because clearing the record can only delay a page.
//
// The archived plan is WO-220.
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

/**
 * When the page entered review, read from its own append-only transition
 * record — the last move whose target was `in_review`.
 *
 * Read from the record rather than stored a second time on the row: the
 * record is written in the same statement as the state change
 * (`publish_transition`), so it cannot disagree with the state, and a
 * column would need a writer that could forget.
 *
 * A draft with no such record has not entered review; the fallback is the
 * row's own creation, which is the earliest moment any window could have
 * started, and rule 3's `max` means an earlier value can only ever be
 * ignored.
 */
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
  // Only the members the patch actually names are taken. A plain spread
  // would let `{ timezone: undefined }` — which every optional-property
  // caller can produce — overwrite the customer's stated zone with nothing.
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
      // A draft nobody has been told about has nothing to re-open: the
      // telling is already owed and clearing a null record changes nothing.
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

/** One structured line. Ids and counts only — never a setting's value,
 *  which is the customer's, and never a sentence. */
function log(line: { siteId: string; actor: Actor["kind"]; drafts: number }): void {
  console.log(JSON.stringify({ event: "publishing_settings_saved", ...line }));
}
