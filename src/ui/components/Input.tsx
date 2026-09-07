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
import { useId } from "react";

type InputBase = {
  /** Required — no default label exists. */
  label: string;
  /** Optional since #240, and still no default: a field renders the
   *  placeholder its caller passes and none otherwise. It was required
   *  because the landing field has one and no component may invent a
   *  string; a credential field has a label and nothing useful to suggest,
   *  and requiring one there would have made a caller mint a sentence to
   *  satisfy a type. */
  placeholder?: string;
  /** The native input type, and the only two this product has a use for
   *  (#240). `password` is what keeps a WordPress application password off
   *  the screen while it is typed — a credential rendered in clear text is
   *  a credential in a screenshot. Text by default, exactly as before this
   *  prop existed. */
  type?: "text" | "password";
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
  // The label is `for` the field it names, so the whole line is a hit
  // target and a screen reader announces the two together. `useId` is
  // React's own server-and-client-stable id — the component is already
  // `"use client"`, and nothing else in this file needs the value.
  const id = useId();
  // 2026-09-07, issue #241: "one string, once." `placeholder` and `label`
  // are both required with no default (BP-018 decision 2) and several
  // screens have only one written line for a field, so they pass the same
  // key twice — which rendered the same two words side by side once the
  // label stacked above the field. The prop contract is unchanged; what
  // changes is that a placeholder repeating the label is not drawn.
  const placeholder = p.placeholder === p.label ? undefined : p.placeholder;
  return (
    // The field is a column: label, control, then the one written line a
    // refusal adds. Before this the label was `inline-flex` and sat beside
    // the input — daisyUI 5's own `.label` rule, which is written for a
    // label *inside* a control, applied to one standing above it.
    <div className="flex flex-col gap-1.5">
      {/* 2026-09-06, issue #12: was `label` + `label-text`. `label` is a
          daisyUI *component* of its own and is not one of §2.2's fifteen —
          "daisyUI components only … The set the product uses" is a closed
          list, and a sixteenth component reached by writing its class by
          hand is the one way left past the barrel. `label-text` is worse:
          daisyUI 5 defines no such class at all (it is 4's spelling), so
          it had never styled anything. The utilities below are daisyUI 5's
          own `.label` rule written out — minus `display:inline-flex` and
          `white-space:nowrap`, which are what kept the label on the field's
          line and would clip a long one at 320px (issue #241). */}
      <label
        className="flex items-center gap-1.5 text-base-content/60"
        htmlFor={id}
      >
        <span>{p.label}</span>
      </label>
      <input
        id={id}
        type={p.type ?? "text"}
        className={["input", p.invalid ? "input-error" : ""]
          .filter(Boolean)
          .join(" ")}
        placeholder={placeholder}
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
