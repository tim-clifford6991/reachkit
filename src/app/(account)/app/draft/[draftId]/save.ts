// SPEC §7 (#789) — "Edits save with no save button", and the seam behind it.
//
// The editor saves when the founder pauses or leaves, and where two sessions
// edit one draft the most recently saved version is the draft (last write
// wins — no merge, no conflict prompt, no version list). The write is
// `saveDraft` (`./save-actions.ts`), which stores the title, the body and
// the meta description and re-runs the hard rules and the claim check on
// the edited text (`@/lib/generate/edit`).
//
// **A refused or failed save is not a dead end.** Every refusal is
// retryable and none discards the buffer: the editor keeps the text, shows
// the unsaved indicator and saves again on the next change — REQ-045
// criterion 7. A save that threw (the network, the server) answers
// `store_unavailable` rather than rejecting, so the screen has one shape to
// read.
import type { ClaimState } from "./model";
import type { RailCheck } from "./checks";
import { saveDraft } from "./save-actions";

/** The one text write this screen can ask for. Every field is whole, never
 *  a patch: last write wins is stated by sending the whole text, and a diff
 *  would be a merge by another name. */
export interface SaveBody {
  draftId: string;
  title: string;
  bodyMd: string;
  description: string;
}

/**
 * What a save answers. The refusals are the three a store can give, and
 * every one of them is **retryable** — none is a redirect and none
 * discards the buffer:
 *
 *  - `not_editable` — the draft has left review and its text is fixed.
 *  - `too_large` — the text is past what a draft may hold; refused rather
 *    than truncated, because truncating is losing the customer's words.
 *  - `store_unavailable` — the store could not be reached.
 *
 * A saved text carries what the re-check found: the claim badge's state,
 * the rules the rail may draw as passed, and whether a rule held the page.
 */
export type SaveResult =
  | {
      ok: true;
      savedAt: Date;
      claim: ClaimState;
      recordedChecks: readonly RailCheck[];
      rulesFailed: boolean;
    }
  | { ok: false; refused: "not_editable" | "too_large" | "store_unavailable" };

export interface DraftStore {
  save(body: SaveBody): Promise<SaveResult>;
}

/** The declared seam. One module-level constant; no caller constructs its own. */
export const draftStore: DraftStore = Object.freeze({
  async save(body: SaveBody): Promise<SaveResult> {
    try {
      return await saveDraft(body);
    } catch {
      return { ok: false, refused: "store_unavailable" };
    }
  },
});
