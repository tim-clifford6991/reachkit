// BUILD §2.2, §2.4 — `Progress`, skinned for an accent ground (issue #266).
// src/ui/idiom/Bar.tsx
//
// A widening of the registered `Progress`, not a sixth chart form: §2.4's
// chart inventory is closed and this adds nothing to it. What changes is
// the ground — the track and fill are `--on-accent` instead of
// `--sunk`/`--chart-*`, because the sign-in panel's bar sits on the accent.
//
// `value` and `max` are both required and neither is nullable, so an
// indeterminate bar cannot be asked for — the registered rule, unchanged.
// `label` is required and is rendered by the *caller*, never here: on the
// sign-in panel the label and the figure are already above the bar, and
// printing them again inside it would be the same claim twice.
import type React from "react";

export function Bar(p: { value: number; max: number; label: string }): React.JSX.Element {
  return (
    <span
      className="rk-bar-track"
      role="progressbar"
      aria-valuenow={p.value}
      aria-valuemin={0}
      aria-valuemax={p.max}
      aria-label={p.label}
    >
      <span className="rk-bar-fill" style={{ width: `${(p.value / p.max) * 100}%` }} />
    </span>
  );
}
