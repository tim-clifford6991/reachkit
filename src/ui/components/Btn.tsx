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
"use client";

import type React from "react";

export function Btn(p: {
  /** Required — BP-018 decision 2. No fallback string exists. */
  label: string;
  variant?: "primary" | "ghost";
  size?: "default" | "sm";
  block?: boolean;
  disabled?: boolean;
  /** "a submit that is disabled while posting" — the label is unchanged; no
   * spinner is added (`previews/WO-268.html` §1: "label unchanged, no
   * spinner"). */
  inFlight?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}): React.JSX.Element {
  const classes = ["btn"];
  if (p.variant === "primary") classes.push("btn-primary");
  if (p.variant === "ghost") classes.push("btn-ghost");
  if (p.size === "sm") classes.push("btn-sm");
  if (p.block) classes.push("btn-block");

  return (
    <button
      type={p.type ?? "button"}
      className={classes.join(" ")}
      disabled={p.disabled === true || p.inFlight === true}
      aria-busy={p.inFlight === true ? "true" : undefined}
      onClick={p.onClick}
    >
      {p.label}
    </button>
  );
}
