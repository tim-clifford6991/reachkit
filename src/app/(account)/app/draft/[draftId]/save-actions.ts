// SPEC §7 (#789) — the Server Function behind the editor's autosave.
//
// The transport between the editor's settled buffer and the engine's one
// writer of an edit (`@/lib/generate/edit`), holding no rule of its own —
// the same footing `calendar/publishing-actions.ts` stands on for §9's
// moves.
//
// **Whose draft.** The session's account, and the draft id arrives from the
// browser: `saveDraftEdit` refuses a row whose `site_id` is not this
// account's site, the same way it refuses a draft that has left review. The
// reserved fixture account has no row to write, so its save is refused too.
//
// **Imported at the call.** This module is imported statically by a client
// component, and the engine reaches `@/lib/db`.
"use server";

import { isReservedFixtureAccount, requireAppAccount } from "../../_session/account";
import type { SaveBody, SaveResult } from "./save";

export async function saveDraft(body: SaveBody): Promise<SaveResult> {
  const account = await requireAppAccount();
  if (isReservedFixtureAccount(account)) return { ok: false, refused: "not_editable" };

  const { saveDraftEdit } = await import("@/lib/generate/edit");
  const outcome = await saveDraftEdit({
    siteId: account.siteId,
    draftId: body.draftId,
    title: body.title,
    bodyMd: body.bodyMd,
    description: body.description,
  });
  if (!outcome.ok) return outcome;

  const { claimStateOf, recordedChecksOf } = await import("./store");
  const { recordedVerdictValue } = await import("@/lib/generate/record");
  return {
    ok: true,
    savedAt: outcome.savedAt,
    claim: claimStateOf(outcome.claim === null ? null : recordedVerdictValue(outcome.claim)),
    recordedChecks: recordedChecksOf(outcome.failed),
    rulesFailed: outcome.failed !== null && outcome.failed.length > 0,
  };
}
