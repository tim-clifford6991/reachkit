// BUILD §2.2 — daisyUI `steps`.
// src/ui/components/Steps.tsx
//
// `components.md` §1, verbatim: "`steps`. **Each step's label required** —
// this is what the scan's named stages render through, so an unlabelled
// step cannot exist (REQ-003 c1: never an unlabelled spinner)" | "pending ·
// active · done".
//
// Each step's `label` is a required field of its own array entry (the same
// shape `Tabs`' `TabItem` takes), so a stage with no name has no way into
// this component.
import type React from "react";
import { Check } from "lucide-react";

export interface StepItem {
  id: string;
  /** Required — an unlabelled stage cannot render (REQ-003 c1). */
  label: string;
  state: "pending" | "active" | "done";
  /** Optional, added by issue #352 (constitution rule 1.1: internal,
   *  additive, backward-compatible — every existing caller keeps omitting
   *  it and renders exactly as before). The approved set's S3 draws each
   *  finished stage with the time it took beside its name; REQ-003 c1 asks
   *  for "named stages that advance as work completes" and forbids only an
   *  unlabelled spinner or a bare indeterminate bar, so a measured elapsed
   *  time beside a named stage is inside it. A written string, never a
   *  number this component formats. */
  note?: string;
}

/** The done check's glyph size and stroke — the chip rule's 15px (the
 *  bead here is daisyUI's, a chip's size, not the set's 16px dot) and the
 *  set's stroke 3 for this glyph. */
const CHECK_SIZE = 15;
const CHECK_STROKE = 3;

export function Steps(p: {
  steps: StepItem[];
  /** Optional, added by issue #14 (constitution rule 1.1: an internal,
   *  additive, backward-compatible parameter — every existing caller
   *  keeps omitting it and renders exactly as before). It selects
   *  daisyUI's own `steps-vertical` modifier and mints nothing: six named
   *  stages laid out in a row do not fit the 320px floor ADR-093 decision
   *  2 commits the product to, and a horizontal `steps` there pushes the
   *  document sideways rather than shrinking. Flagged once (rule 4.2):
   *  `components.md` §1 registers `steps` without naming this modifier. */
  direction?: "horizontal" | "vertical";
}): React.JSX.Element {
  return (
    <ul className={p.direction === "vertical" ? "steps steps-vertical" : "steps"}>
      {p.steps.map((step) => (
        <li
          key={step.id}
          className={`step${step.state === "done" || step.state === "active" ? " step-primary" : ""}`}
          data-state={step.state}
        >
          {/* A finished step carries the set's check in its bead (UI-SPEC
              §2.6: `ico('check',3)` in every done `.step .b`, S10 L689,
              S11 L700; issue #486). daisyUI's own `step-icon` is the bead
              when present, so the number it would otherwise count in is
              replaced, not overlaid. Pending and active beads keep theirs. */}
          {step.state === "done" ? (
            <span className="step-icon" aria-hidden>
              <Check size={CHECK_SIZE} strokeWidth={CHECK_STROKE} aria-hidden />
            </span>
          ) : null}
          {step.label}
          {step.note === undefined ? null : <span className="t-explain opacity-60">{step.note}</span>}
        </li>
      ))}
    </ul>
  );
}
