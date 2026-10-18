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

import { revalidatePath } from "next/cache";
import type { Actor, State } from "@/lib/publish/types";
import { DESTINATION_HREF } from "../_shell/destinations";
import { requireAppAccount } from "../_session/account";

/** The machine's refusal vocabulary, extended by exactly one word: a page
 *  this account does not own. It is a refusal like any other — the seam
 *  carries it on `PublishingOutcome` — and never a rendered sentence,
 *  because there is no registry key for a machine's refusal vocabulary and
 *  inventing one is what that module forbids. */
const NOT_YOUR_PAGE = "not_your_page";

/**
 * The one shape every §9 write here takes: ask the machine, and report what
 * it answered. A refusal is a value all the way out (issue #913): the seam
 * hands it to the screen, and the screen states the written line that says
 * nothing changed. A control that changed nothing never settles silently.
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
  if (result.ok) {
    // Issue #913: the screen that asked re-reads, so the optimistic badge
    // it drew on the press is replaced by the page's real state rather
    // than standing until the customer navigates. Both surfaces are
    // revalidated because both project their controls from that one state
    // — the day panel and the draft view must not disagree about a page
    // the customer has just stopped. A refusal revalidates nothing:
    // nothing was written, so there is nothing stale to re-read, and the
    // optimistic value rolls back on its own when the transition ends.
    revalidatePath(DESTINATION_HREF.calendar);
    revalidatePath(`/app/draft/${draftId}`);
    return null;
  }
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

/**
 * SPEC §7 (issue 1532): **Take down** a live page — `unpublish()` with this
 * customer as actor, every live version at its address — and **Put back**
 * one inside its window, through §9's `unpublished → published`. The same
 * ownership proof as every write above; the refusal is the engine's word.
 */
async function pageWrite(
  draftId: string,
  write: (a: { draftId: string; userId: string }) => Promise<{ ok: true } | { ok: false; refused: string }>
): Promise<string | null> {
  const account = await requireAppAccount();
  const { siteOwnsDraft } = await import("../_session/store");
  if (!(await siteOwnsDraft(account.siteId, draftId))) return NOT_YOUR_PAGE;
  const result = await write({ draftId, userId: account.userId });
  if (!result.ok) return result.refused;
  revalidatePath(DESTINATION_HREF.calendar);
  revalidatePath(`/app/draft/${draftId}`);
  return null;
}

export async function takeDownDraft(draftId: string): Promise<string | null> {
  const { takeDown } = await import("@/lib/publish/attempt/take-down");
  return pageWrite(draftId, takeDown);
}

export async function putBackDraft(draftId: string): Promise<string | null> {
  const { putBack } = await import("@/lib/publish/attempt/take-down");
  return pageWrite(draftId, putBack);
}
