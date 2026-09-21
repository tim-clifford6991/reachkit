// SPEC §4 (2026-09-20, #908, issue #913) — the one way a settable control
// on this screen writes, and the one way it answers.
//
// Every card that changes a setting needs the same four lines: keep a
// write in flight so a second press cannot race it, call the Server
// Function, say in words what came back, and remember the last answer so
// the card can show the canvas's own *Saved* badge. Written once, for the
// reason `./useAction.ts` gives about the seven actions: written three
// times, two of the three end up swallowing an outcome — which is exactly
// the defect this issue exists to fix.
//
// **The sentence is the registry's and the tone is the answer's.** There
// is no arm that says nothing and no arm that composes a line: a write
// that landed says which of the two saved sentences its effect earns, and
// a write that did not says the one refusal sentence. A call that never
// reached the server is a refusal too — from the customer's side a setting
// that did not change is a setting that did not change.
"use client";

import { useCallback, useState, useTransition } from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { say } from "../../../../_toast/say";
import { SETTING_ANSWER_INITIAL, type SettingAnswer, type SettingEffect } from "../panel-state";

/** Which sentence a saved setting earns. Total over the effects, so a
 *  third kind of effect cannot ship without a written line. */
const SAVED_COPY_KEY: Readonly<Record<SettingEffect, CopyKey>> = Object.freeze({
  now: "settings.answer.saved",
  "next-page": "settings.answer.saved-next-page",
});

export interface SettingWriter {
  /** Ask for a write. The form carries the fields the action reads; this
   *  is a `FormData` and not an object because the actions are ordinary
   *  form actions, so the same control works from a `<form>` submit.
   *
   *  `expect` is where a card moves its own `useOptimistic` value, and it
   *  runs **inside** this write's transition — which is the only place
   *  React accepts one. Without it a switch snaps back to the stored value
   *  the instant it is pressed and flips again when the re-read lands,
   *  which is what a broken control looks like. */
  press: (
    action: (form: FormData) => Promise<SettingAnswer>,
    form: FormData,
    expect?: () => void
  ) => void;
  /** Whether a write this card asked for is still in flight. Controls are
   *  inert while one is, so two presses of a stepper cannot both read the
   *  same stored value and write the same number. */
  busy: boolean;
  /** Whether the last press on this card stored something — the card's
   *  own quiet half of the answer (R4-11's *Saved* badge). */
  saved: boolean;
}

export function useSetting(): SettingWriter {
  const [answer, setAnswer] = useState<SettingAnswer>(SETTING_ANSWER_INITIAL);
  const [busy, startWriting] = useTransition();

  const press = useCallback(
    (
      action: (form: FormData) => Promise<SettingAnswer>,
      form: FormData,
      expect?: () => void
    ): void => {
      startWriting(async () => {
        expect?.();
        const next: SettingAnswer = await action(form).catch(
          (): SettingAnswer => ({ answer: "refused" })
        );
        setAnswer(next);
        say(
          next.answer === "saved" ? copy(SAVED_COPY_KEY[next.effect]) : copy("settings.answer.refused"),
          next.answer === "saved" ? "ok" : "bad"
        );
      });
    },
    []
  );

  return { press, busy, saved: answer.answer === "saved" };
}

/** The card's *Saved* badge, as a class list rather than a component: a
 *  badge is a daisyUI class, and wrapping one would be the wrapper
 *  `docs/DESIGN.md` forbids. */
export const SAVED_BADGE_CLASS = "badge badge-success badge-soft badge-sm";
