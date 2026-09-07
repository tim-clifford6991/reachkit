// BUILD §2.2 — daisyUI `progress`.
// src/ui/components/Progress.tsx
//
// `components.md` §1, verbatim: "`progress`. **Determinate only** — a
// caller cannot request an indeterminate bar. This is also the three driver
// mini-bars of the report's header strip (§4.1); mini-bars are *not* a
// sixth chart" | "default" (one state).
//
// `value` and `max` are both required numbers with no optional arm — the
// native `<progress>` element only becomes indeterminate when `value` is
// omitted, and the type here makes omitting it a compile error, so an
// indeterminate bar has no call shape a caller can reach.
import type React from "react";

export function Progress(p: { value: number; max: number }): React.JSX.Element {
  return <progress className="progress progress-primary" value={p.value} max={p.max} />;
}
