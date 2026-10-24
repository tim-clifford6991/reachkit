// A page's verdict as every board draws it: one badge, icon and word per
// label, shared by Overview, the Google tab, Plan and the page's own screen.
// A leaf, so the client page screen can draw it.
import type React from "react";
import { Check, Clock, Minus, TrendingUp, type LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { Label } from "@/lib/opportunities/verdicts/types";

export const LABEL: Readonly<Record<Label, { key: CopyKey; badge: string; icon: LucideIcon }>> = {
  working: { key: "review.label.working", badge: "badge badge-soft badge-success gap-1", icon: Check },
  climbing: { key: "review.label.climbing", badge: "badge badge-soft badge-primary gap-1", icon: TrendingUp },
  too_early: { key: "review.label.too_early", badge: "badge badge-soft gap-1", icon: Clock },
  not_moving: { key: "review.label.not_moving", badge: "badge badge-soft badge-warning gap-1", icon: Minus },
};

export function LabelBadge(p: { label: Label; className?: string; testId?: string }): React.JSX.Element {
  const { key, badge, icon: Icon } = LABEL[p.label];
  return (
    <span className={p.className === undefined ? badge : `${badge} ${p.className}`} data-testid={p.testId}>
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      {copy(key)}
    </span>
  );
}
