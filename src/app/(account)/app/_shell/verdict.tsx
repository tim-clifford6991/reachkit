// A page's label as Pages Live and the page's own screen draw it: one badge, icon and word per label.
// A leaf, so the client page screen can draw it.
import type React from "react";
import { Check, Clock, Minus, TrendingUp, type LucideIcon } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { Label } from "@/lib/opportunities/verdicts/types";

// Neutral: the word and icon carry the label, never the colour.
export const LABEL: Readonly<Record<Label, { key: CopyKey; icon: LucideIcon }>> = {
  working: { key: "pages.label.working", icon: Check },
  climbing: { key: "pages.label.climbing", icon: TrendingUp },
  too_early: { key: "pages.label.too_early", icon: Clock },
  not_moving: { key: "pages.label.not_moving", icon: Minus },
};

export function LabelBadge(p: { label: Label; className?: string; testId?: string }): React.JSX.Element {
  const { key, icon: Icon } = LABEL[p.label];
  return (
    <span className={`badge badge-soft gap-1 ${p.className ?? ""}`} data-testid={p.testId}>
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
      {copy(key)}
    </span>
  );
}
