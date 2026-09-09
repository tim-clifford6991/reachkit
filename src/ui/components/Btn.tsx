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
 *  outline rank (`idiom.css` styles `.rk-btn-outline[data-tone="…"]` and
 *  nothing else), so a caller that asks for a toned primary should not
 *  compile rather than render a button whose tone silently does nothing
 *  (issue #271).
 *
 *  Two tones and no third. `warn` is the veto case #271 spent it on. `accent`
 *  (issue #291) is the *second* call to action on a screen that has two of
 *  them for different things: the report offers the free page and the
 *  subscription, §9.1 gives the screen one solid fill, and the one that
 *  loses it is still a call to action rather than a quiet aside. It is the
 *  accent as an **edge**, never a fill — a second filled accent button is
 *  precisely what the rule forbids, and the ink and border are the same
 *  `--accent` the primary fills with, so no new value is spent. `ok`/`bad`
 *  stay out for `ActionPanel`'s reason: a button is not a state.
 *
 *  `pressed` rides on the same arm and for the same reason (issue #288): a
 *  **selected** state is the outline rank on the accent tint, and only that
 *  rank. `/setup` spent the solid accent for it — six filled buttons on one
 *  screen, and §2.5 rules the accent is not a state colour — so a caller
 *  that asks for a pressed primary should not compile either.
 *
 *  A tone and a pressed state are readable together: `tone` colours the
 *  edge and the ink, `pressed` adds the tint behind them, and neither is
 *  the fill the solid rank owns. */
export type BtnRank =
  | { variant?: "primary" | "ghost" | "tertiary" | "on-accent"; tone?: undefined; pressed?: undefined }
  | { variant: "secondary"; tone?: "warn" | "accent"; pressed?: boolean };

export type BtnProps = BtnRank & {
  /** Required — BP-018 decision 2. No fallback string exists. */
  label: string;
  size?: "default" | "sm";
  block?: boolean;
  /** The idiom's pill radius, `--r-pill`. Opt-in rather than the default,
   *  so the surfaces the idiom has not reached yet keep the shape they were
   *  built and swept with, and this PR moves exactly the screens it names. */
  pill?: boolean;
  /** A glyph before the label (issue #351). The idiom's own button draws
   *  one — `/idiom/landing`'s hero CTA is `IdiomBtn` with `Search` — and
   *  `IdiomBtn` is not a component to port: `components.md` §7.3 rules that
   *  the idiom's parts "are the drawings of the four widenings, not five
   *  new components. Production UI code names `Card`, `Btn` and `Stat`."
   *  So the slot lands on the registered button.
   *
   *  **It is a slot, never a string.** The caller passes the element, so no
   *  glyph name lives here and this component still holds no copy; the
   *  icons a screen may draw are the ones the archive's own pages name
   *  (DECISIONS 2026-09-08, #303), which is a fact about the screen and is
   *  checked there.
   *
   *  It is decoration and never the control's name: `label` stays required
   *  and stays rendered, so an icon can never become the only thing a
   *  button says. An icon-only button is unbuildable here, which is the
   *  point of the slot being optional and the label not being. */
  icon?: React.ReactNode;
} & BtnElement;

/** **What the control IS**, and the reason it is an arm rather than a prop
 *  beside the others (issue #351).
 *
 *  A rank is a claim about *how important* an action is; it says nothing
 *  about whether the action happens here or somewhere else. The landing's
 *  how-to-start CTA is the archive's solid accent pill and its destination
 *  is the hero's own field one screen up — and REQ-001 c1 gives that page
 *  "exactly one text input and one submit control", which a second
 *  `<button>` in the document breaks whatever it is styled as. So the same
 *  rank has to be renderable as a link.
 *
 *  Three files already hand-wrote `class="btn …"` on an `<a>` for this
 *  case, each with a row in `component-registry.test.ts` arguing for it.
 *  This is that case answered once, inside the registry, where the daisyUI
 *  markup is supposed to live.
 *
 *  The two arms are exclusive by type, and every member that has no meaning
 *  on the other side is refused rather than ignored: a link has no `type`,
 *  takes no `onClick`, and cannot be `disabled` or `inFlight` — an anchor
 *  with no href is not a disabled control, it is an unreachable one, and
 *  `aria-busy` on a link says a navigation is posting. A caller that wants
 *  a control that can be disabled asks for a button, which is the arm that
 *  has one. */
type BtnElement =
  | {
      href?: undefined;
      onClick?: () => void;
      type?: "button" | "submit";
      disabled?: boolean;
      /** "a submit that is disabled while posting" — the label is
       * unchanged; no spinner is added (`previews/WO-268.html` §1: "label
       * unchanged, no spinner"). */
      inFlight?: boolean;
    }
  | {
      href: string;
      onClick?: undefined;
      type?: undefined;
      disabled?: undefined;
      inFlight?: undefined;
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

  // The link arm. Everything above it is the rank and is shared; what
  // differs below is only what a link cannot carry — no `type`, no
  // `disabled`, no `aria-busy`, no `aria-pressed` (a link is not a toggle).
  if (p.href !== undefined) {
    return (
      <a href={p.href} className={classes.join(" ")} data-tone={p.tone}>
        {p.icon}
        {p.label}
      </a>
    );
  }

  return (
    <button
      type={p.type ?? "button"}
      className={classes.join(" ")}
      // The tone rides on a data attribute rather than a class, the way
      // `ActionPanel`'s does: a class ending in a daisyUI family word is
      // what `theme-slots.test.ts` sweeps for, and this is not a daisyUI
      // modifier.
      data-tone={p.tone}
      // `aria-pressed` is the *whole* selected state — the stylesheet keys
      // its tint off this attribute, so a chip that looks chosen is chosen
      // in the accessibility tree by construction and the two cannot
      // diverge (issue #288). Absent, not `false`, where a button is not a
      // toggle: `aria-pressed="false"` on an ordinary button tells a screen
      // reader it is an unpressed toggle, which is a claim about a control
      // that has no state.
      aria-pressed={p.pressed === undefined ? undefined : p.pressed}
      disabled={p.disabled === true || p.inFlight === true}
      aria-busy={p.inFlight === true ? "true" : undefined}
      onClick={p.onClick}
    >
      {p.icon}
      {p.label}
    </button>
  );
}
