// SPEC §4 and §7 (2026-09-20, #908) — "Every action answers."
//
// One function, and it is the whole of how this product speaks after a
// write. A control that changed something says so in words; a control the
// engine refused says that nothing changed. Before issue #913 four
// surfaces each swallowed their own outcome on purpose, and a customer
// pressing Stop, Approve or a Settings switch was told nothing at all.
//
// **The library is `sonner`, drawn with daisyUI `alert` classes**
// (`docs/DESIGN.md`'s allow-list, owner 2026-09-20). `sonner` owns the
// hard parts — one stack per document, placement, stacking, timing,
// swipe-to-dismiss and the `aria-live` region that announces a toast that
// arrives after the page has settled. What it does not own is how the
// thing looks: `toast.custom` renders the node this module builds, and a
// custom toast is `data-styled="false"` in `sonner`'s own stylesheet, so
// the only visual rules that reach it are the daisyUI ones written here.
// No wrapper component and no stylesheet: this is a function that returns
// an `alert`, which is the class `docs/DESIGN.md` rule 1 names for exactly
// this.
//
// **The sentence is never composed here.** Every caller passes a string it
// read from the registry through `copy()`. This module holds no voice, has
// no default string, and cannot be asked for one — which is what keeps
// "every action answers" from becoming "every action invents a sentence".
//
// **Two tones and no third.** A write that landed is `alert-success` and
// speaks politely; a write that was refused is `alert-error` and
// interrupts, because a customer who thinks they stopped a page and did
// not must not be told quietly. `role`/`aria-live` follow the tone rather
// than a caller's choice, so the two cannot come apart.
"use client";

import type React from "react";
import { toast } from "sonner";

/** How long an answer stands. Long enough to read a sentence, short
 *  enough that it never sits over the screen the customer went back to.
 *  A refusal stands longer: it is the one the customer has to act on. */
const OK_MS = 5_000;
const BAD_MS = 8_000;

export type AnswerTone = "ok" | "bad";

/** The daisyUI class each tone wears. Colour alone never carries the
 *  meaning — the sentence is the message and the tone is beside it. */
const ALERT_CLASS: Readonly<Record<AnswerTone, string>> = Object.freeze({
  ok: "alert alert-success",
  bad: "alert alert-error",
});

/**
 * Says what an action did.
 *
 * `line` is a sentence already read from the registry. `tone` is whether
 * the write landed. Nothing else: there is no title, no second line and no
 * action button, because an answer is one statement about one press.
 */
export function say(line: string, tone: AnswerTone): void {
  toast.custom(
    (id): React.JSX.Element => (
      <div
        key={id}
        className={`${ALERT_CLASS[tone]} w-full min-w-0 items-start shadow-lg`}
        role={tone === "bad" ? "alert" : "status"}
        aria-live={tone === "bad" ? "assertive" : "polite"}
        data-testid={`answer-${tone}`}
      >
        <span className="min-w-0 wrap-anywhere text-sm">{line}</span>
      </div>
    ),
    { duration: tone === "bad" ? BAD_MS : OK_MS }
  );
}
