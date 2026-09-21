// BUILD §4.7 — Notifications: one switch per stoppable mail.
//
// The rows are projected from `MAIL_KINDS`' `stoppable: 'toggle'` subset
// (`notificationRows`), so a fourth stoppable mail arrives as a fourth
// switch. They never touch address-wide suppression (ADR-042). The card
// closes by naming the mail that cannot be switched off.
//
// **The switches write** (SPEC §4, 2026-09-20, #908, issue #913). They
// were drawn `readOnly` — three controls a customer could press all day
// without stopping a single mail. Each now goes to `setNotifyPref` through
// `../panel-actions.ts` and answers in words. Which kinds may be stopped
// is still the register's question and is asked again on the server: this
// is an addressable endpoint, and the sign-in mail is not a customer's to
// switch off.
"use client";

import type React from "react";
import { useOptimistic } from "react";
import { Bell } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { setNotificationAction } from "../panel-actions";
import { NOTIFY_KIND_FIELD, NOTIFY_ON_FIELD, OFF, ON } from "../panel-state";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";
import type { SettingsModel } from "../model";

export function NotificationsPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const alwaysOn = writtenLine("settings.notifications.always-on");
  const writer = useSetting();
  /** The switches as this render believes them, which during a write is
   *  the state the write is asking for. A `checked` input is controlled by
   *  its prop, so without this the switch snaps back the instant it is
   *  pressed and flips again when the re-read lands — the one thing a
   *  customer reads as "this control is broken". A refused write drops the
   *  optimistic value and the switch is where it was. */
  const [rows, expect] = useOptimistic(p.settings.notifications);

  function toggle(kind: string, on: boolean): void {
    const form = new FormData();
    form.set(NOTIFY_KIND_FIELD, kind);
    form.set(NOTIFY_ON_FIELD, on ? ON : OFF);
    writer.press(setNotificationAction, form, () =>
      expect(rows.map((row) => (row.kind === kind ? { ...row, on } : row)))
    );
  }

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title min-w-0 flex-wrap text-base">
          <Bell size={20} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 wrap-anywhere">{copy("settings.notifications.title")}</span>
          {writer.saved ? (
            <span className={SAVED_BADGE_CLASS} data-testid="notifications-saved">
              {copy("settings.answer.saved-badge")}
            </span>
          ) : null}
        </h2>

        <div className="flex min-w-0 flex-col" data-testid="setting-notifications">
          {rows.map((row) => (
            <label
              key={row.kind}
              className="border-base-300 flex min-w-0 cursor-pointer flex-wrap items-center justify-between gap-2 border-t py-3 first:border-t-0 first:pt-0"
              data-testid={`notification-${row.kind}`}
            >
              <span className="min-w-0 text-sm wrap-anywhere">{copy(row.copyKey)}</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={row.on}
                disabled={writer.busy}
                onChange={(e) => toggle(row.kind, e.target.checked)}
              />
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
