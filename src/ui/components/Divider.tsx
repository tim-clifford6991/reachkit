// BUILD §2.2 — daisyUI `divider`.
// src/ui/components/Divider.tsx
//
// `components.md` §1, verbatim: "`divider`. Layout only" | "—" (no states).
//
// `label` is optional — the preview draws both a plain divider and one with
// a caller word (`previews/WO-268.html` §14). Optional and absent renders
// no text at all, which is not a default string: nothing is substituted
// when the caller passes nothing.
import type React from "react";

export function Divider(p: { label?: React.ReactNode }): React.JSX.Element {
  return <div className="divider">{p.label}</div>;
}
