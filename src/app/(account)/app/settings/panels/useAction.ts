// BUILD §4.7 — the one way a control on this screen runs one of the seven.
//
// Every action panel needs the same three lines: call the declared interface,
// keep what it answered, and render a written line for the arms that have
// something to say. Writing them three times is how two of the three end up
// swallowing an outcome, so they are written once.
//
// `elsewhere` navigates, because REQ-097 c1's billing surface is somewhere the
// customer is handed to rather than something ReachKit reports about; `here`
// has nothing to add, because a completed action shows itself in the state of
// the screen it completed on. `not-yet` and `unreachable` are the two the
// customer is told about in writing, and both sentences are the owner's.
//
// **`unreachable` is REQ-097 criterion 6, and it is three statements, not
// one** — that billing cannot be reached, that they may try again, and one
// way to reach a person. Three keys, so the owner can write each of them,
// and any the owner has not written yet is dropped rather than shown as a
// gap. The line is rendered on the screen the customer was already on: no
// navigation happens on this arm, so nothing about their plan, their account
// or their session is touched.
"use client";

import { useCallback, useState } from "react";
import { SETTINGS_ACTIONS, type ActionOutcome } from "../actions";
import { UNREACHABLE_BILLING_KEYS } from "../billing";
import type { ActionKey } from "../settable";
import { writtenLine } from "../../_shell/written";

export interface ActionRunner {
  run: (key: ActionKey) => void;
  /** The written line for the last outcome, or `null` — either because
   *  nothing has been pressed, or because the owner has not written the
   *  sentence that arm needs. */
  line: string | null;
}

/** REQ-097 c6's three statements, as one line, with the owner-owed ones
 *  dropped rather than rendered as a gap — the same shape the Billing
 *  card's price row uses. */
function unreachableLine(): string | null {
  const written = UNREACHABLE_BILLING_KEYS.map((key) => writtenLine(key)).filter(
    (line): line is string => line !== null
  );
  return written.length === 0 ? null : written.join(" ");
}

function lineFor(outcome: ActionOutcome | null): string | null {
  if (outcome === null) return null;
  if (outcome.done === "not-yet") return writtenLine("settings.action.not-yet");
  if (outcome.done === "unreachable") return unreachableLine();
  return null;
}

export function useAction(): ActionRunner {
  const [outcome, setOutcome] = useState<ActionOutcome | null>(null);

  const run = useCallback((key: ActionKey) => {
    void SETTINGS_ACTIONS[key]().then((result) => {
      if (result.done === "elsewhere") {
        window.location.assign(result.href);
        return;
      }
      setOutcome(result);
    });
  }, []);

  return { run, line: lineFor(outcome) };
}
