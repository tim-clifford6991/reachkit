// SPEC §4 *Overview's four tiles* — Overview and its four details share one column.
// It declares no `Surface`: the shell's own layout (`../layout.tsx`) owns the screen root.
import type React from "react";

export default function OverviewLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="overview-frame">
      {children}
    </div>
  );
}
