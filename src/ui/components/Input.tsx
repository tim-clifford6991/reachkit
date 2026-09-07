// BUILD §2.2 — daisyUI `input`.
// src/ui/components/Input.tsx
//
// `components.md` §1, verbatim: "`input`. Placeholder **and** label
// required, never defaulted" | "default · invalid (one written line, value
// intact) · disabled".
//
// `label` and `placeholder` are both required with no default (BP-018
// decision 2). `invalid` is a discriminated union: passing `invalid: true`
// requires `invalidMessage` (the one written line) in the same object —
// there is no call shape that marks a field invalid without also supplying
// the sentence explaining why. The invalid value stays intact: this
// component never clears `value` itself.
//
// `name` — optional, added by WO-070 (constitution rule 1.1: an internal,
// additive, backward-compatible parameter; every existing caller keeps
// omitting it and renders exactly as before, no native `name` attribute).
// WO-070's own plan needed a plain HTML form's field to survive a
// no-JavaScript submit — the native mechanism a browser uses to include a
// field in `FormData`/`application/x-www-form-urlencoded` requires the
// control's own `name` attribute, and nothing at the page level can supply
// it after the fact once the control has rendered without one. Flagged
// once here (rule 4.2): this component's contract (`components.md` §1,
// BP-018 `## Public interface`) named no `name` prop, and the fix is this
// one-line, optional addition rather than a bespoke input or a second
// hidden control, which would have broken "exactly one input" (REQ-001 c1)
// or the no-JS path outright.
"use client";

import type React from "react";

type InputBase = {
  /** Required — no default label exists. */
  label: string;
  /** Required — no default placeholder exists. */
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Optional. The native `name` attribute — absent by default, exactly as
   *  before this prop existed, so a plain HTML form submission can carry
   *  this field. */
  name?: string;
};

type InputValid = InputBase & { invalid?: false };
type InputInvalid = InputBase & {
  invalid: true;
  /** Required whenever `invalid` is true — the one written line. */
  invalidMessage: string;
};

export type InputProps = InputValid | InputInvalid;

export function Input(p: InputProps): React.JSX.Element {
  return (
    <div>
      {/* 2026-09-06, issue #12: was `label` + `label-text`. `label` is a
          daisyUI *component* of its own and is not one of §2.2's fifteen —
          "daisyUI components only … The set the product uses" is a closed
          list, and a sixteenth component reached by writing its class by
          hand is the one way left past the barrel. `label-text` is worse:
          daisyUI 5 defines no such class at all (it is 4's spelling), so
          it had never styled anything. The utilities below are daisyUI 5's
          own `.label` rule written out — `display:inline-flex`,
          `align-items:center`, `gap:.375rem`, `white-space:nowrap` and the
          60% ink — so nothing about how this renders changes. */}
      <label className="inline-flex items-center gap-1.5 whitespace-nowrap text-base-content/60">
        <span>{p.label}</span>
      </label>
      <input
        type="text"
        className={["input", p.invalid ? "input-error" : ""].filter(Boolean).join(" ")}
        placeholder={p.placeholder}
        value={p.value}
        name={p.name}
        disabled={p.disabled}
        aria-invalid={p.invalid === true}
        onChange={(e) => p.onChange?.(e.target.value)}
      />
      {p.invalid ? <p className="text-error">{p.invalidMessage}</p> : null}
    </div>
  );
}
