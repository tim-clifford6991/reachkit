// BUILD §4.7 — the one way a control on this screen runs one of the seven.
//
// Every action panel needs the same three lines: call the declared interface,
// keep what it answered, and render a written line for the one arm that has
// something to say. Writing them three times is how two of the three end up
// swallowing an outcome, so they are written once.
//
// The `not-yet` arm is the only one this build can reach (`FIXTURE_ACTIONS`),
// and its line is owner-owed, so today a press calls the interface and the
// screen states nothing. That is the deliberate shape: the call is real and
// testable, the answer is recorded, and the sentence appears the moment the
// owner writes `settings.action.not-yet` — no placeholder stands in for it in
// the meantime. `elsewhere` navigates, because REQ-097 c1's billing surface is
// somewhere the customer is handed to rather than something ReachKit reports
// about; `here` has nothing to add, because a completed action shows itself in
// the state of the screen it completed on.
"use client";

import { useCallback, useState } from "react";
import { FIXTURE_ACTIONS, type ActionOutcome } from "../actions";
import type { ActionKey } from "../settable";
import { writtenLine } from "../../_shell/written";

export interface ActionRunner {
  run: (key: ActionKey) => void;
  /** The written line for the last outcome, or `null` — either because
   *  nothing has been pressed, or because the owner has not written the
   *  sentence that arm needs. */
  line: string | null;
}

export function useAction(): ActionRunner {
  const [outcome, setOutcome] = useState<ActionOutcome | null>(null);

  const run = useCallback((key: ActionKey) => {
    void FIXTURE_ACTIONS[key]().then((result) => {
      if (result.done === "elsewhere") {
        window.location.assign(result.href);
        return;
      }
      setOutcome(result);
    });
  }, []);

  const line = outcome !== null && outcome.done === "not-yet" ? writtenLine("settings.action.not-yet") : null;

  return { run, line };
}
