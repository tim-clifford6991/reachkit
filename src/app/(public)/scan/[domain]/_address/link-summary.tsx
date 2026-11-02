// A closed section's name as board PubReport draws it: a primary link with
// its chevron on the left, turning when the `details` it heads is open.
import type React from "react";
import { ChevronDown } from "lucide-react";

export function LinkSummary(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <summary className="text-primary flex cursor-pointer list-none items-center gap-2 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-180" strokeWidth={1.75} />
      {p.children}
    </summary>
  );
}
