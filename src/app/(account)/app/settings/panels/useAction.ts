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
// the screen it completed on. `unreachable` is the one the
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

import { useCallback, useState, useTransition } from "react";
import { copy } from "@/lib/presentation/copy";
import { say } from "@/app/_toast/say";
import { SETTINGS_ACTIONS, type ActionOutcome } from "../actions";
import { UNREACHABLE_BILLING_KEYS } from "../billing";
import type { ActionKey } from "../settable";
import { writtenLine } from "../../_shell/written";

export interface ActionRunner {
  run: (key: ActionKey) => void;
  /** Issue 1196: the action whose press is pending, or `null`. Its button
   *  spins and every action button is disabled until it answers. */
  pending: ActionKey | null;
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

function lineFor(outcome: ActionOutcome | "failed" | null): string | null {
  if (outcome === null) return null;
  if (outcome === "failed") return copy("settings.answer.could-not-ask");
  if (outcome.done === "unreachable") return unreachableLine();
  return null;
}

export function useAction(): ActionRunner {
  const [outcome, setOutcome] = useState<ActionOutcome | "failed" | null>(null);
  const [busy, startRunning] = useTransition();
  const [pressed, setPressed] = useState<ActionKey | null>(null);

  const run = useCallback((key: ActionKey) => {
    setPressed(key);
    startRunning(async () => {
      setOutcome(null);
      const result = await SETTINGS_ACTIONS[key]().catch((): "failed" => "failed");
      if (result !== "failed" && result.done === "elsewhere") {
        window.location.assign(result.href);
        return;
      }
      // Issue 1196: a plan resumed in place answers, rather than settling
      // silently.
      if (result !== "failed" && result.done === "here" && key === "resume") {
        say(copy("settings.billing.resumed"), "ok");
      }
      setOutcome(result);
    });
  }, []);

  return { run, pending: busy ? pressed : null, line: lineFor(outcome) };
}
