// SPEC §4, owner R7: Settings' own sub-layout, the heading and the three tabs drawn once for all three routes.
// It declares no `Surface` (the shell owns the screen root) and makes no read: each tab reads what it draws.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { SettingsTabs } from "./SettingsTabs";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="settings">
      <h1>{copy("shell.nav.settings")}</h1>
      <SettingsTabs />
      {children}
    </div>
  );
}
