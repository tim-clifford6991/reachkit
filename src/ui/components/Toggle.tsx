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
        onChange={(e) => p.onChange?.(e.target.checked)}
      />
      <span>{p.label}</span>
    </label>
  );
}
