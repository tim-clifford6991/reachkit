// SPEC §7 (2026-09-24, #1059): the calendar's one statement of supply. It
// carries no market chooser, because the product picks a broader market (owner R17).
import type React from "react";
import { Info } from "lucide-react";

export function SupplyNotice(p: { line: string }): React.JSX.Element {
  return (
    <div
      role="status"
      className="alert alert-soft min-w-0 items-start text-sm max-sm:alert-vertical max-sm:items-start sm:alert-horizontal"
      data-testid="calendar-supply-notice"
    >
      <Info size={20} strokeWidth={1.75} className="text-warning shrink-0" aria-hidden />
      <p className="min-w-0 wrap-anywhere" data-testid="calendar-supply-statement">
        {p.line}
      </p>
    </div>
  );
}
