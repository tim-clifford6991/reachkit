// BUILD §2.2 — daisyUI `kbd`.
// src/ui/components/Kbd.tsx
//
// `components.md` §1, verbatim: "`kbd`. Renders through the mono utility —
// a code-like string under §2.3. **Inline only**; it is not a code block
// (see §4)" | "—" (no states).
//
// `children` is required — the key label itself, with no fallback. Renders
// through `.num` (`src/ui/type.css`, WO-030), the one place this file
// touches the mono numeral utility, alongside `kbd` for daisyUI's own
// keycap styling.
import type React from "react";

export function Kbd(p: {
  /** Required — the key label. No fallback string exists. */
  children: React.ReactNode;
}): React.JSX.Element {
  return <kbd className="kbd num">{p.children}</kbd>;
}
