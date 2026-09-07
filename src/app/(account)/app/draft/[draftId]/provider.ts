// BUILD §4.6 — the one read the draft view makes.
//
// The screen calls `readDraft` and nothing else; what it reads behind the
// type is now the signed-in account's own `drafts` row (`store.ts`) and
// this issue's fixture (`fixture.ts`) for the reserved fixture account and
// nothing else — one request-cached read, no second caller, no second
// shape.
//
// **Which account.** The session's, through `_session/account.ts` (issue
// #169). A request with no session is refused before any read: back to
// `/signin`, saying nothing about whether an account or a payment exists.
//
// **An id this account does not own resolves to `null`, never to a
// throw, and never differently from an id that does not exist.** The
// archived BP-044 fixes the behaviour — "a draft the customer does not own,
// or an id that does not exist, resolves to one written line, never a stack
// trace or a vendor payload" — and `store.ts` keeps it by making ownership
// a filter on the query rather than a check afterwards. One nullable value,
// not two distinguishable failures the screen would have to word
// separately, and not an address that tells a stranger which ids exist.
//
// `React.cache` is what makes it one read per request even though the page
// and its siblings each ask.
import { cache } from "react";
import { isReservedFixtureAccount, requireSetUpAccount } from "../../_session/account";
import { assembleDraft, type DraftView } from "./model";
import { FIXTURE_DRAFTS } from "./fixture";

export const readDraft = cache(async function readDraft(
  draftId: string
): Promise<DraftView | null> {
  const account = await requireSetUpAccount();

  if (isReservedFixtureAccount(account)) {
    const facts = FIXTURE_DRAFTS[draftId];
    return facts === undefined ? null : assembleDraft(facts);
  }

  // Imported at the call: `store.ts` resolves `@/lib/db`, which parses the
  // deployment's own bindings at module load, and the reserved account's
  // draft view reaches no database at all.
  const { readDraftRow } = await import("./store");
  const facts = await readDraftRow({
    draftId,
    site: { siteId: account.siteId, timeZone: account.timeZone, mode: account.mode },
  });
  return facts === null ? null : assembleDraft(facts);
});
