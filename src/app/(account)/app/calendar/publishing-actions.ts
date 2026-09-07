// BUILD §4.6 — the Server Functions behind the day panel's writes.
//
// §4.6's controls change a page's state, and a page's state is moved by
// exactly one thing: `transition()` in `src/lib/publish/` (§9). That module
// reaches Postgres, so it cannot be imported into a client bundle — hence
// this file, which is the transport adapter between the panel's click and
// the engine's one mover, and holds no engine logic of its own
// (`ARCHITECTURE.md` rule 1).
//
// **This file exports one thing per command and nothing else.** A `"use
// server"` module may export only async functions; the command union, the
// error and the seam the panel calls all live in `./publishing`, which both
// this file and the screen import.
//
// **Which account is acting, and whose page it is.** `src/middleware.ts`
// has already refused this request unless it carried a session cookie;
// *which* account it is, is the session's, through `_session/account.ts`
// (issue #169). The actor on every transition this file writes is that
// customer's own user id — a transition is never anonymous, and until this
// issue it carried a fixture id, so every move a real customer made was
// recorded against an account that was not theirs.
//
// **And the page has to be theirs.** A Server Function is an addressable
// endpoint: the draft id arrives from the browser, and nothing about being
// signed in makes an id the caller's. So the pair is checked before the
// machine is asked, as a `select` keyed on `(id, site_id)` — a draft of
// another account does not come back, and the move is refused with
// `not_your_page` rather than reaching `transition()` at all.
//
// **The engine is imported inside the call, not at the top.**
// `src/lib/publish/machine` reaches Postgres through `@/lib/db`, which
// parses every environment binding the moment it is evaluated. This module
// is imported statically by a client component — that is how a Server
// Function gets its reference — so a top-level import would make merely
// *rendering* the calendar require a full server environment, and would
// make every test that renders it require one too. Deferring the import to
// the moment a command actually runs costs nothing at runtime (the module
// is cached after the first call) and keeps the screen's own module graph
// free of the database.
"use server";

import type { Actor, State } from "@/lib/publish/types";
import { requireAppAccount } from "../_session/account";

/** The machine's refusal vocabulary, extended by exactly one word: a page
 *  this account does not own. It is a refusal like any other — `publishing.ts`
 *  turns it into `PublishingRefusedError` — and never a rendered sentence,
 *  because there is no registry key for a refused write and inventing one
 *  is what that module forbids. */
const NOT_YOUR_PAGE = "not_your_page";

/**
 * The one shape every §9 write here takes: ask the machine, and report what
 * it answered. A refusal is a value here and becomes a rejection at the
 * seam (`./publishing`), because the panel's contract is that a control
 * which changed nothing never resolves as though it had.
 */
async function move(draftId: string, to: State): Promise<string | null> {
  // No session is §4.3's refusal, and `requireAppAccount` answers it by
  // redirecting — so nothing below runs for a caller who is not signed in.
  const account = await requireAppAccount();
  // Imported at the call, like the machine below and for the same reason:
  // this module is imported statically by a client component, and
  // `_session/store` reaches `@/lib/db`.
  const { siteOwnsDraft } = await import("../_session/store");
  if (!(await siteOwnsDraft(account.siteId, draftId))) return NOT_YOUR_PAGE;

  const actor: Actor = { kind: "customer", userId: account.userId };
  const { transition } = await import("@/lib/publish/machine");
  const result = await transition(draftId, to, actor);
  if (result.ok) return null;
  return result.refused === "guard" ? (result.failedGuard ?? "guard") : result.refused;
}

/** §4.6's **Skip** on a planned page — §9's `planned → skipped`. */
export async function skipDraft(draftId: string): Promise<string | null> {
  return move(draftId, "skipped");
}

/** §4.6's **Veto** on a page in review — the same `→ skipped` edge under
 *  the word that matches what the customer is doing. */
export async function vetoDraft(draftId: string): Promise<string | null> {
  return move(draftId, "skipped");
}

/** §4.6's **Approve** in the draft view — §9's `in_review → approved`, and
 *  §9's "Copilot = explicit approve only". */
export async function approveDraft(draftId: string): Promise<string | null> {
  return move(draftId, "approved");
}

/**
 * The restart on a page that needs you — §9's `needs_attention →
 * generating` (issue #143).
 *
 * The same one shape as every write above, and deliberately no extra
 * check: the edge's guards are `never_entered_review` and
 * `customer_initiated`, both of which `transition()` asks, and this actor
 * is a customer. Re-deciding either here would be a second copy of the
 * machine's own rule, and the two would disagree the first time one
 * changed.
 */
export async function regenerateDraft(draftId: string): Promise<string | null> {
  return move(draftId, "generating");
}
