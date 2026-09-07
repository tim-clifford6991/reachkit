// BUILD §4.6 — "autosaved", and the machine behind it.
//
// §4.6 gives the editor an autosave: no explicit save control exists in the
// view, the change is written when the customer pauses or leaves, and where
// two sessions edit one draft the most recently saved version is the draft
// (last write wins — no merge, no conflict prompt, no version list). That
// write is a write against §10's `drafts` row and §8's claim re-check —
// `src/lib/generate/` and the `PATCH /api/drafts/{id}` adapter, issues that
// do not exist yet.
//
// So this file declares the interface the editor calls and **stubs it
// honestly**, on exactly the footing the calendar's `publishing.ts` stubs
// §9's state machine: the one method rejects with an error naming what is
// missing. It does not pretend to succeed, it does not write
// the body somewhere else, and it does not quietly resolve — a stub that
// resolved would tell the customer their words were saved when nothing had
// been written anywhere, which is the one lie this screen must not tell.
//
// The rejection is not a dead end for the customer: a refused save is
// exactly the case REQ-045 criterion 7 already designs for. The editor
// keeps the buffer, shows the unsaved indicator, and retries on the next
// tick — so today's behaviour on this screen is the behaviour a real store
// outage produces, and the customer's words are never discarded.
//
// The shape is the real one, so the issue that lands `PATCH
// /api/drafts/{id}` replaces this module's implementation and no caller
// changes.
import type { ClaimState } from "./model";

/** The one text write this screen can ask for. `bodyMd` is the whole body,
 *  never a patch: last write wins is stated by sending the whole text, and
 *  a diff would be a merge by another name. */
export interface SaveBody {
  draftId: string;
  bodyMd: string;
}

/**
 * What a save answers. The refusals are the three a store can give, and
 * every one of them is **retryable** — none is a redirect and none
 * discards the buffer:
 *
 *  - `not_editable` — the draft has left review and its text is fixed.
 *  - `too_large` — the body is past what a draft may hold; refused rather
 *    than truncated, because truncating is losing the customer's words.
 *  - `store_unavailable` — the store could not be reached.
 */
export type SaveResult =
  | { ok: true; savedAt: Date; grounded: { present: boolean }; claim: ClaimState }
  | { ok: false; refused: "not_editable" | "too_large" | "store_unavailable" };

export interface DraftStore {
  save(body: SaveBody): Promise<SaveResult>;
}

/** Thrown by the stub. It names what was asked and which spec section
 *  supplies it, so a save that cannot go anywhere says exactly that in the
 *  one place a developer looks — and never to the customer, who is told
 *  only what REQ-045 criterion 7 promises them: the change is unsaved. */
export class DraftSaveNotBuiltError extends Error {
  constructor(public readonly draftId: string) {
    super(
      `The draft store is not built: saving "${draftId}" needs §10's drafts row and §8's ` +
        `claim re-check behind PATCH /api/drafts/{id}. The draft view renders the editor and ` +
        `calls this interface; nothing writes a body until that lands.`
    );
    this.name = "DraftSaveNotBuiltError";
  }
}

/** The declared seam. One module-level constant, so a later issue swaps the
 *  implementation in one place; no caller constructs its own. */
export const draftStore: DraftStore = Object.freeze({
  save(body: SaveBody): Promise<SaveResult> {
    return Promise.reject(new DraftSaveNotBuiltError(body.draftId));
  },
});
