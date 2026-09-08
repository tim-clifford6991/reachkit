// BUILD §2.2 — daisyUI `toggle`.
// src/ui/components/Toggle.tsx
//
// `components.md` §1, verbatim: "`toggle`. Label required; no default
// on/off wording" | "on · off · disabled".
//
// `label` and `checked` are both required (BP-018 decision 2 and rule 1.1's
// "no indeterminate call shape" pattern already used by `Progress`): there
// is no on/off wording built into this component at all, only the caller's
// own label text rendered beside the control.
"use client";

import type React from "react";

export function Toggle(p: {
  /** Required — no default on/off wording exists. */
  label: string;
  checked: boolean;
  disabled?: boolean;
  /** Draw the switch alone, with `label` as its accessible name rather than
   *  as text beside it (issue #353).
   *
   *  **Not a way to ship an unlabelled control.** `label` stays required
   *  and still reaches the accessibility tree; what moves is where it is
   *  drawn. The one caller is the sidebar's autopilot card, where the
   *  card's own eyebrow already states the mode: the switch beside it drew
   *  the same word a second time, which put "Autopilot" twice and a switch
   *  into a 222px column and overflowed it — the layout sweep's containment
   *  check is what caught it. The approved set draws that switch with no
   *  text of its own for the same reason (UI-SPEC S12: `aria-label` only).
   *
   *  A prop rather than a second component: §2.2's set of fifteen is
   *  closed, and this is the same widening `Progress` took for `onAccent`. */
  labelHidden?: boolean;
  onChange?: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    // 2026-09-06, issue #12: was `label cursor-pointer gap-2`. daisyUI's
    // `label` is a component of its own and is not one of §2.2's fifteen
    // (see `Input.tsx`); these utilities are its own rule written out, with
    // the caller-facing gap this component already chose kept as it was.
    <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-base-content/60">
      <input
        type="checkbox"
        className="toggle"
        checked={p.checked}
        disabled={p.disabled}
        // The accessible name, where the word is not drawn beside the
        // switch. Never both: a control with visible text *and* an
        // `aria-label` is a control a screen reader and a reader are told
        // two different things about.
        aria-label={p.labelHidden === true ? p.label : undefined}
        onChange={(e) => p.onChange?.(e.target.checked)}
      />
      {p.labelHidden === true ? null : <span>{p.label}</span>}
    </label>
  );
}
