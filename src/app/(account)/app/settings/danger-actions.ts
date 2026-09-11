// BUILD §4.7, REQ-079 — the Server Functions behind the danger zone's two
// irreversible actions, and the state its first gate reads.
//
// **This module decides nothing about either action.** What may be
// unpublished, in what order an account is deleted, which refusals exist
// and what a ticket authorises are all
// `src/lib/account/lifecycle/`'s, reached through `confirmDangerAction` —
// which that module's own header calls "the only exported way to reach
// either action". This file reads a typed word and a cookie, calls it, and
// maps what came back to a line key.
//
// **The customer types the word §4.7 prints, never the engine's tag**
// (owner ruling, 2026-09-07). `confirmationFor(action)` answers
// `delete_account` / `unpublish_all` — an internal identifier — and stays
// engine-internal: it is what this file hands the engine *after* the
// customer's own word has matched. What the customer reads and types is
// `danger.confirm-word.<action>` from the registry, compared trimmed and
// case-insensitively against that same registry value here and on the
// client. Two comparisons of one value, so a client that skipped its check
// changes nothing.
//
// **The ticket is read from its cookie and never from an argument.** A
// ticket passed in from the browser would be a capability the page could
// name; read from an HttpOnly cookie the download route set, it is one only
// the browser that took the archive can present.
//
// **Nothing here catches the engine's refusals into a success.** Each maps
// to the key REQ-079 gives it, and `nothing-changed` accompanies every
// refusal because a customer told only *why* cannot tell whether their
// pages survived.
//
// The engine is imported inside the call, not at the top: it reaches
// `@/lib/db`, and this module is imported statically by a client component
// (that is how a Server Function gets its reference), so a top-level import
// would put a database client in the settings screen's own module graph.
"use server";

// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: Settings' last three actions: export is a streamed GET response from
//   the session's own site (a Server Function cannot return a file and a pre-signed link would
//   outlive the press); unpublish-all and delete-account are offered as their export hand-off
//   through a danger ticket in an HttpOnly cookie that authorises nothing on its own, then run
//   only after the customer types the registry word (compared trimmed, case-insensitive,
//   client and server) — the at-rest screen is byte-identical, so no baseline moves. — #280

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { copy } from "@/lib/presentation/copy";
import { DANGER_TICKET_COOKIE } from "./danger-ticket";
import {
  CONFIRM_WORD_KEY,
  matchesConfirmWord,
  type DangerActionKey,
  type DangerOutcome,
  type HandoverState,
} from "./danger-state";

const SETTINGS_PATH = "/app/settings";

/** Where a deleted account's browser goes: the sign-in screen, on a full
 *  navigation. `deleteAccount` has already ended the session — the same
 *  destination every other session-less settings outcome takes (#134). */
const AFTER_DELETE = "/signin";

async function lifecycle(): Promise<typeof import("@/lib/account/lifecycle")> {
  return import("@/lib/account/lifecycle");
}

/** The ticket the download route set, or `null` where no archive has been
 *  handed over in this browser. */
async function ticketFromCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(DANGER_TICKET_COOKIE)?.value;
  return value === undefined || value.length === 0 ? null : value;
}

/**
 * REQ-079 c3's first gate, as the screen reads it: has this browser's
 * archive left the process whole?
 *
 * Read from the ticket's own `taken_at` stamp rather than remembered on the
 * client, because the claim is about what the server finished writing. A
 * download the customer aborted leaves it unstamped and this answers
 * `offered` — the same answer as never having pressed it, which is the
 * truthful one: no archive has been taken.
 */
export async function handoverState(action: DangerActionKey): Promise<HandoverState> {
  const ticket = await ticketFromCookie();
  if (ticket === null) return { taken: false };

  const { readDangerTicket } = await lifecycle();
  const read = await readDangerTicket(ticket);
  return { taken: read !== null && read.action === action && read.takenAt !== null };
}

/**
 * REQ-079 c2 and c4: run the action the customer has confirmed.
 *
 * Every refusal returns before the engine is reached or comes straight back
 * from it, and each leaves everything as it was — which is why the
 * accompanying line is `danger.nothing-changed` rather than silence.
 */
export async function runDangerAction(
  action: DangerActionKey,
  typedWord: string
): Promise<DangerOutcome> {
  // The word first, against the registry value the customer was shown. A
  // mismatch never reaches the engine, so a ticket is never spent on one.
  if (!matchesConfirmWord(action, typedWord, copy(CONFIRM_WORD_KEY[action]))) {
    return { ran: false, lineKey: "danger.type-to-confirm" };
  }

  const ticket = await ticketFromCookie();
  if (ticket === null) return { ran: false, lineKey: "danger.export-failed" };

  const { confirmDangerAction, confirmationFor } = await lifecycle();
  const confirmed = await confirmDangerAction({
    ticket,
    // The engine's own internal word, handed over here and nowhere a
    // customer can see it.
    typedConfirmation: confirmationFor(action),
  });

  if (!confirmed.ok) {
    // Every one of the five refusals is REQ-079 c3's "does not proceed and
    // says why", and the line that says why is the same for all of them:
    // which of the five it was is an operator's fact and tells the customer
    // nothing they can act on.
    return { ran: false, lineKey: "danger.export-failed" };
  }

  if (confirmed.action === "unpublish_all") {
    revalidatePath(SETTINGS_PATH);
    return {
      ran: true,
      action: "unpublish_all",
      lineKey: confirmed.result.lineKey,
      takenDown: confirmed.result.takenDown,
      stillLive: confirmed.result.stillLive.map((d) => ({ kind: d.kind, liveUrls: [...d.liveUrls] })),
    };
  }

  // The account is gone and the session with it, so there is no screen left
  // to revalidate — the browser is handed to the sign-in screen instead.
  return { ran: true, action: "delete_account", href: AFTER_DELETE };
}
