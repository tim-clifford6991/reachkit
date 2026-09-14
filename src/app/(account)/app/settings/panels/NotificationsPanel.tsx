// BUILD §4.7 — Notifications: one switch per stoppable mail.
//
// The rows are projected from `MAIL_KINDS`' `stoppable: 'toggle'` subset
// (`notificationRows`), so a fourth stoppable mail arrives as a fourth
// switch. They never touch address-wide suppression (ADR-042). The card
// closes by naming the mail that cannot be switched off.
import type React from "react";
import { Bell } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import type { SettingsModel } from "../model";

export function NotificationsPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const alwaysOn = writtenLine("settings.notifications.always-on");

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">
          <Bell size={20} strokeWidth={1.75} aria-hidden />
          {copy("settings.notifications.title")}
        </h2>

        <div className="flex min-w-0 flex-col" data-testid="setting-notifications">
          {p.settings.notifications.map((row) => (
            <label
              key={row.kind}
              className="border-base-300 flex min-w-0 cursor-pointer flex-wrap items-center justify-between gap-2 border-t py-3 first:border-t-0 first:pt-0"
              data-testid={`notification-${row.kind}`}
            >
              <span className="min-w-0 text-sm wrap-anywhere">{copy(row.copyKey)}</span>
              <input type="checkbox" className="toggle toggle-primary" checked={row.on} readOnly />
            </label>
          ))}
        </div>

        {alwaysOn === null ? null : (
          <p className="text-xs text-base-content/60 wrap-anywhere" data-testid="notifications-always-on">
            {alwaysOn}
          </p>
        )}
      </div>
    </section>
  );
}
