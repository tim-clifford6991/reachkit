// BUILD §2 — ADR-093's screen root — every screen declares its band arms.
// src/ui/layout/Surface.tsx
//
// BP-018 `## Public interface`: "Every screen root is a `Surface`. `arms` is
// required and has no default, so a screen that declares no band behaviour
// fails to compile — not a test." It renders no chrome and is not a widget
// (SPEC.md §2.2's closed set of five custom components is untouched by it):
// one element carrying `data-surface` and one `data-arm-<band>` attribute
// per band naming the arm's `kind` (plus `count`/`note` where the kind
// carries one) — no class, no style, no string of its own.
//
// The return type is spelled `React.JSX.Element`, not the bare `JSX.Element`
// BP-018's interface block prints: WO-269 `## Parameters chosen`, "type
// fan-out check (1b)" — `npm run typecheck` reports `TS2503: Cannot find
// namespace 'JSX'` under `@types/react` 19.2 with the bare form and nothing
// with this one. `React.JSX.Element` is an internal name (rule 1.1); no
// existing file consumes it yet.
import type React from "react";
import { BANDS, type Arm, type Band } from "./bands";

function armAttr(arm: Arm): string {
  switch (arm.kind) {
    case "same-as-below":
      return "same-as-below";
    case "columns":
      return `columns:${arm.count}`;
    case "declared":
      return `declared:${arm.note}`;
  }
}

export function Surface(p: {
  arms: Record<Band, Arm>;
  children: React.ReactNode;
}): React.JSX.Element {
  const armAttrs: Record<string, string> = {};
  for (const band of BANDS) {
    armAttrs[`data-arm-${band}`] = armAttr(p.arms[band]);
  }
  return (
    <div data-surface="" {...armAttrs}>
      {p.children}
    </div>
  );
}
