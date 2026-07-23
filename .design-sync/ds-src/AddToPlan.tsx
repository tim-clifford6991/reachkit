/* @mirrors components/app/intel/add-to-plan.tsx */
import * as React from "react";
import { Badge } from "./IntelKit";

/**
 * AddToPlanChip — the ONE affordance that turns any intel row (a competitor
 * referrer LESSON, a customer COMMUNITY) into a scheduled plan move. Two states:
 * a clickable "＋ add", or a static "→ in plan" pill once the action exists.
 * Self-contained mirror (both states shown). Mirrors `add-to-plan.tsx`.
 */
function Chip({ inPlan }: { inPlan: boolean }) {
  if (inPlan) return <Badge tone="violet">→ in plan</Badge>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--c-fill)", color: "var(--c-muted)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 11.5, padding: "3px 9px", borderRadius: "var(--radius-xs)", lineHeight: 1.2, whiteSpace: "nowrap" }}>
      ＋ add
    </span>
  );
}

export function AddToPlan() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 20, background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: "var(--radius-xl)" }}>
      <Chip inPlan={false} />
      <Chip inPlan={true} />
    </div>
  );
}
