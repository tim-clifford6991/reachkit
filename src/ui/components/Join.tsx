// BUILD §2.2 — daisyUI `join`.
// src/ui/components/Join.tsx
//
// `components.md` §1, verbatim: "`join`. Layout only" | "—" (no states).
//
// Layout-only: no label, no text of its own — nothing here to default.
import type React from "react";

export function Join(p: { children: React.ReactNode }): React.JSX.Element {
  return <div className="join">{p.children}</div>;
}
