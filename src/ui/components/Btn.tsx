// BUILD §2.2 — daisyUI `btn`.
// src/ui/components/Btn.tsx
//
// `components.md` §1, verbatim: "daisyUI `btn` (+`primary`/`ghost`/`sm`/
// `block`). `label` required. Also carries the copy-to-clipboard affordance
// — no separate copy component exists" | "default · disabled · in-flight (a
// submit that is disabled while posting)".
//
// `label` is required and has no default (BP-018 decision 2): a caller that
// omits it is a compile error, and there is no runtime fallback string. The
// "copy-to-clipboard affordance" names a *use* of this component (§4's own
// "not gaps" list: "copy-to-clipboard control … It is `Btn`. No `CopyButton`
// is registered and none should be."), not a second prop — any caller wires
// its own `onClick`.
//
// "use client": every prop below that a caller supplies is a plain value or
// callback; `disabled`/`inFlight` gate a native `<button disabled>`, which
// needs no interactivity of its own here, but `onClick` is accepted for the
// copy-to-clipboard and submit affordances the registry describes, so this
// leaf is marked a client component the same way Toggle/Tabs/Input/Collapse
// are (an internal, reversible parameter — rule 1.1).
//
// **The warn tone belongs to the outline rank and to nothing else** (issue
// #271). The idiom's ranks carry no colour of their own, and §2.5 reserves
// `--ok`/`--warn`/`--bad` for state — but the same tokens.md §9.1 that
// rules "one solid accent primary" allows warn where the customer is being
// asked to act, which `ActionPanel` already spends on its ground. A veto is
// that case standing next to an approve: the two are opposite consequences
// and one of them destroys the draft. So `tone` exists on `secondary`
// alone, and the union below is what refuses it everywhere else — a warn
// *fill* would be a second solid button on a screen the idiom gives one,
// and warn on the quiet arm would tint a control whose whole rank is being
// unobtrusive. `ok` and `bad` have no position here for `ActionPanel`'s own
// reason: a button is not a state.
"use client";

import type React from "react";

/** The three ranks the owner-approved card idiom draws, plus the two
 *  daisyUI arms `components.md` §1 already registers.
 *
 *  `secondary` (outline) and `tertiary` (quiet) are the **widening** the
 *  idiom proposes (tokens.md §9.1, `components.md` §7, issue #266): "one
 *  solid accent primary, an outline secondary, a quiet tertiary". They
 *  add no colour — the outline takes `--line` and the quiet arm takes
 *  `--ink-2`, both named.
 *
 *  `on-accent` is not a fourth rank: it is what `primary` becomes when
 *  its ground is already the accent, inverted to an `--on-accent` fill
 *  with an `--accent` label. Two named tokens, no third value. A solid
 *  accent button on the accent ground has no edge at all, which is the
 *  whole reason the arm exists.
 *
 *  The rank, and the one tone that may accompany one, are two arms rather than
 *  an optional prop beside `variant`: `tone` is only ever readable on the
 *  outline rank (`idiom.css` styles `.rk-btn-outline[data-tone="warn"]` and
 *  nothing else), so a caller that asks for a warn primary should not
 *  compile rather than render a button whose tone silently does nothing
 *  (issue #271). */
export type BtnRank =
  | { variant?: "primary" | "ghost" | "tertiary" | "on-accent"; tone?: undefined }
  | { variant: "secondary"; tone?: "warn" };

export type BtnProps = BtnRank & {
  /** Required — BP-018 decision 2. No fallback string exists. */
  label: string;
  size?: "default" | "sm";
  block?: boolean;
  disabled?: boolean;
  /** "a submit that is disabled while posting" — the label is unchanged; no
   * spinner is added (`previews/WO-268.html` §1: "label unchanged, no
   * spinner"). */
  inFlight?: boolean;
  /** The idiom's pill radius, `--r-pill`. Opt-in rather than the default,
   *  so the surfaces the idiom has not reached yet keep the shape they were
   *  built and swept with, and this PR moves exactly the screens it names. */
  pill?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
};

export function Btn(p: BtnProps): React.JSX.Element {
  const classes = ["btn"];
  if (p.variant === "primary") classes.push("btn-primary");
  if (p.variant === "ghost") classes.push("btn-ghost");
  // The idiom's three ranks. `btn-ghost` under the two quiet arms so the
  // daisyUI base still supplies the size, the focus ring and the disabled
  // state; what the widening adds is the fill, the edge and the ink.
  if (p.variant === "secondary") classes.push("btn-ghost", "rk-btn-outline");
  if (p.variant === "tertiary") classes.push("btn-ghost", "rk-btn-tertiary");
  if (p.variant === "on-accent") classes.push("btn-ghost", "rk-btn-inverse");
  // Pill throughout — `--r-pill` is already law and the idiom spends no new
  // radius for it (tokens.md §9.1).
  if (p.pill === true) classes.push("rk-pill");
  if (p.size === "sm") classes.push("btn-sm");
  if (p.block) classes.push("btn-block");

  return (
    <button
      type={p.type ?? "button"}
      className={classes.join(" ")}
      // The tone rides on a data attribute rather than a class, the way
      // `ActionPanel`'s does: a class ending in a daisyUI family word is
      // what `theme-slots.test.ts` sweeps for, and this is not a daisyUI
      // modifier.
      data-tone={p.tone}
      disabled={p.disabled === true || p.inFlight === true}
      aria-busy={p.inFlight === true ? "true" : undefined}
      onClick={p.onClick}
    >
      {p.label}
    </button>
  );
}
