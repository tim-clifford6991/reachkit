// SPEC §4 (2026-09-20, #908), issue 912 — Settings, while its read is in
// flight.
//
// One file for the seven tabs (#925), because they are one shape: a panel
// of labelled fields. It sits **inside** `settings/layout.tsx`, so the tab
// bar is drawn and stays drawn — a customer can cross from Billing to
// Account without the panel they are leaving finishing first.
import type React from "react";
import { CardSkeleton } from "../_shell/skeletons";

export default function SettingsLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-6" data-testid="settings-waiting">
      <CardSkeleton testId="settings-panel-skeleton" rows={5} />
    </div>
  );
}
