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
// **Which account is acting.** `src/middleware.ts` has already refused this
// request unless it carried a session cookie, so a caller reaching here is
// signed in; *which* account it is, is #35's `currentSession()`, which does
// not exist yet. Until it does, this uses the same fixture account
// `/api/setup` uses — one stand-in, named once, not a second guess.
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
import { FIXTURE_USER_ID } from "@/app/(account)/setup/_setup/fixture";

function currentActor(): Actor {
  return { kind: "customer", userId: FIXTURE_USER_ID };
}

/**
 * The one shape every §9 write here takes: ask the machine, and report what
 * it answered. A refusal is a value here and becomes a rejection at the
 * seam (`./publishing`), because the panel's contract is that a control
 * which changed nothing never resolves as though it had.
 */
async function move(draftId: string, to: State): Promise<string | null> {
  const { transition } = await import("@/lib/publish/machine");
  const result = await transition(draftId, to, currentActor());
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
