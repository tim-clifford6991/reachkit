// BUILD §4.7 — Notifications: one switch per stoppable mail.
//
// The rows are projected from `MAIL_KINDS`' `stoppable: 'toggle'` subset
// (`notificationRows`), so a fourth stoppable mail arrives as a fourth
// switch. They never touch address-wide suppression (ADR-042), and the card
// closes by naming the mail that cannot be switched off.
//
// Each switch goes to `setNotifyPref` through `../panel-actions.ts` and
// answers in words. Which kinds may be stopped is asked again on the server:
// the sign-in mail is not a customer's to switch off.
"use client";

import type React from "react";
import { useOptimistic } from "react";
import { Info } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { WEEK_PLAN } from "@/lib/config/constants";
import { writtenLine } from "../../_shell/written";
import { setNotificationAction } from "../panel-actions";
import { NOTIFY_KIND_FIELD, NOTIFY_ON_FIELD, OFF, ON } from "../panel-state";
import { vetoWindowLabel } from "./PublishingPanel";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";
import type { NotificationRow } from "../notifications";
import { Linked } from "../Linked";
import { CALENDAR_HREF } from "../../_overview/week";
import type { SettingsModel } from "../model";

const INK = "text-base-content/70";

/** What a row says under its name. */
function RowLine(p: { row: NotificationRow; vetoHours: number }): React.JSX.Element | null {
  if (p.row.kind === "weekly") {
    return <p className={`text-sm wrap-anywhere ${INK}`}>{copy("settings.notifications.weekly.note", { days: String(WEEK_PLAN.days) })}</p>;
  }
  if (p.row.kind !== "draft-ready") return null;
  if (!p.row.on) {
    return (
      <p className={`flex min-w-0 items-start gap-2 text-sm ${INK}`} data-testid="notification-draft-ready-off">
        <Info size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-primary" />
        <span className="min-w-0 wrap-anywhere">
          <Linked sentence={copy("settings.notifications.draft-ready.off")} word={copy("shell.nav.plan")} href={CALENDAR_HREF} />
        </span>
      </p>
    );
  }
  return <p className={`text-sm wrap-anywhere ${INK}`}>{copy("settings.notifications.draft-ready.note", { window: vetoWindowLabel(p.vetoHours) })}</p>;
}

export function NotificationsPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const alwaysOn = writtenLine("settings.notifications.always-on");
  const writer = useSetting();
  /** The switches as this render believes them, which during a write is the
   *  state the write asks for; without it a switch snaps back when pressed. */
  const [rows, expect] = useOptimistic(p.settings.notifications);

  function toggle(kind: string, on: boolean): void {
    const form = new FormData();
    form.set(NOTIFY_KIND_FIELD, kind);
    form.set(NOTIFY_ON_FIELD, on ? ON : OFF);
    writer.press(setNotificationAction, form, () =>
      expect(rows.map((row) => (row.kind === kind ? { ...row, on } : row)))
    );
  }

  // Split around the address so it alone is mono.
  const [sentTo = "", afterTo = ""] = copy("settings.notifications.to", { email: "\u0000" }).split("\u0000");

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="card-title min-w-0 flex-wrap text-(length:--h3)">
            <span className="min-w-0 wrap-anywhere">{copy("settings.notifications.title")}</span>
            {writer.saved ? (
              <span className={SAVED_BADGE_CLASS} data-testid="notifications-saved">
                {copy("settings.answer.saved-badge")}
              </span>
            ) : null}
          </h2>
          <p className={`text-sm wrap-anywhere ${INK}`} data-testid="notifications-to">
            {sentTo}
            <span className="num">{p.settings.account.email}</span>
            {afterTo}
          </p>
        </div>

        <div className="flex min-w-0 flex-col" data-testid="setting-notifications">
          {rows.map((row) => (
            <div
              key={row.kind}
              className="border-base-300 flex min-w-0 items-start justify-between gap-3 border-t py-4 first:border-t-0 first:pt-0 last:pb-0"
              data-testid={`notification-${row.kind}`}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor={`notify-${row.kind}`} className="text-sm font-semibold wrap-anywhere">{copy(row.copyKey)}</label>
                <RowLine row={row} vetoHours={p.settings.publishing.vetoHours} />
              </div>
              <label className="flex min-h-11 shrink-0 cursor-pointer items-center">
                <input
                  id={`notify-${row.kind}`}
                  type="checkbox"
                  role="switch"
                  className="toggle toggle-primary"
                  checked={row.on}
                  disabled={writer.busy}
                  onChange={(e) => toggle(row.kind, e.target.checked)}
                />
              </label>
            </div>
          ))}
        </div>

        {rows.some((row) => row.on) ? null : (
          <p className={`text-sm wrap-anywhere ${INK}`} data-testid="notifications-none">
            {copy("settings.notifications.none")}
          </p>
        )}
        {alwaysOn === null ? null : (
          <p className={`border-base-300 border-t pt-4 text-sm wrap-anywhere ${INK}`} data-testid="notifications-always-on">
            {alwaysOn}
          </p>
        )}
      </div>
    </section>
  );
}
