// BUILD §4.7 — Notifications: one switch per stoppable mail.
//
// The rows are projected from `MAIL_KINDS`' `stoppable: 'toggle'` subset
// (`notificationRows`), so a fourth stoppable mail arrives as a fourth
// switch. They never touch address-wide suppression (ADR-042). Each row
// previews its mail, the week strip shows what a week brings, and the card
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
import { FileText, Mail } from "lucide-react";
import { copy } from "@/lib/presentation/copy";
import { WEEK_PLAN } from "@/lib/config/constants";
import { writtenLine } from "../../_shell/written";
import { setNotificationAction } from "../panel-actions";
import { NOTIFY_KIND_FIELD, NOTIFY_ON_FIELD, OFF, ON } from "../panel-state";
import { vetoWindowLabel } from "./PublishingPanel";
import { SETTINGS_TAB_HREF } from "../tabs";
import { planWeek, weekdayShort } from "../../calendar/dates";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";
import type { NotificationRow } from "../notifications";
import { NO_NEXT_PAGE, type NextPage } from "../next-page";
import { Linked } from "../Linked";
import type { SettingsModel } from "../model";

const INK = "text-base-content/70";
/** Monday to Sunday, as the strip heads its days. */
const WEEKDAYS = planWeek("2026-09-07").map(weekdayShort);

/** What a row says under its name, and the mail it previews, while it is on. */
function RowBody(p: { row: NotificationRow; vetoHours: number; next: NextPage }): React.JSX.Element | null {
  if (p.row.kind === "weekly") {
    return (
      <>
        <p className={`text-xs wrap-anywhere ${INK}`}>{copy("settings.notifications.weekly.note", { days: String(WEEK_PLAN.days) })}</p>
        {p.row.on ? (
          <div className="bg-base-200 rounded-box flex min-w-0 flex-col p-3 text-sm" data-testid="notification-weekly-preview">
            <span className="wrap-anywhere">{copy("settings.notifications.weekly.preview", { days: String(WEEK_PLAN.days) })}</span>
            <span className={`text-xs ${INK}`}>{copy("settings.notifications.weekly.when")}</span>
          </div>
        ) : null}
      </>
    );
  }
  if (p.row.kind !== "draft-ready") return null;
  if (!p.row.on) {
    return (
      <p className={`text-xs wrap-anywhere ${INK}`} data-testid="notification-draft-ready-off">
        {copy("settings.notifications.draft-ready.off")}
      </p>
    );
  }
  return (
    <>
      <p className={`text-xs wrap-anywhere ${INK}`}>{copy("settings.notifications.draft-ready.note", { window: vetoWindowLabel(p.vetoHours) })}</p>
      {p.next.title === null || p.next.written === null || p.next.live === null ? null : (
        <div className="bg-base-200 rounded-box flex min-w-0 flex-col p-3 text-sm" data-testid="notification-draft-ready-preview">
          <span className="wrap-anywhere">{copy("settings.notifications.draft-ready.preview", { title: p.next.title })}</span>
          <span className={`num-phrase text-xs ${INK}`}>
            {copy("settings.notifications.draft-ready.preview.when", { written: p.next.written, live: p.next.live })}
          </span>
        </div>
      )}
    </>
  );
}

/** The week strip: one cell a day, an icon for each mail that day brings. */
function WeekOfMail(p: { weekly: boolean; ready: boolean }): React.JSX.Element {
  const legend =
    !p.weekly && !p.ready ? null : (
      <>
        {p.weekly ? (
          <span className="inline-flex items-center gap-1">
            <Mail size={14} strokeWidth={1.75} aria-hidden />
            {copy("settings.notifications.week.monday")}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          {p.ready ? <FileText size={14} strokeWidth={1.75} aria-hidden /> : null}
          {copy(p.ready ? "settings.notifications.week.ready" : "settings.notifications.week.no-ready")}
        </span>
      </>
    );
  return (
    <figure className="flex min-w-0 flex-col gap-2" aria-label={copy("settings.notifications.week.label")} data-testid="notifications-week">
      <figcaption className="eyebrow">{copy("settings.notifications.week.title")}</figcaption>
      <div className="grid min-w-0 grid-cols-7 gap-1">
        {WEEKDAYS.map((day, i) => (
          <div key={day} className="bg-base-200 rounded-box flex min-w-0 flex-col items-center gap-1 py-2">
            <span className={`num text-xs ${INK}`}>{day}</span>
            <span className="flex min-h-4 items-center gap-0.5 text-primary" aria-hidden>
              {i === 0 && p.weekly ? <Mail size={14} strokeWidth={1.75} aria-hidden /> : null}
              {p.ready ? <FileText size={14} strokeWidth={1.75} aria-hidden /> : null}
            </span>
          </div>
        ))}
      </div>
      <p className={`flex min-w-0 flex-wrap gap-x-4 text-xs ${INK}`}>{legend ?? copy("settings.notifications.week.none")}</p>
    </figure>
  );
}

export function NotificationsPanel(p: { settings: SettingsModel; next?: NextPage }): React.JSX.Element {
  const next = p.next ?? NO_NEXT_PAGE;
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

  const isOn = (kind: string): boolean => rows.some((row) => row.kind === kind && row.on);

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="card-title min-w-0 flex-wrap text-base">
            <span className="min-w-0 wrap-anywhere">{copy("settings.notifications.title")}</span>
            {writer.saved ? (
              <span className={SAVED_BADGE_CLASS} data-testid="notifications-saved">
                {copy("settings.answer.saved-badge")}
              </span>
            ) : null}
          </h2>
          <p className={`text-sm wrap-anywhere ${INK}`} data-testid="notifications-to">
            <Linked
              sentence={copy("settings.notifications.to", { email: p.settings.account.email })}
              word={copy("settings.account.title")}
              href={SETTINGS_TAB_HREF.account}
            />
          </p>
        </div>

        <div className="flex min-w-0 flex-col" data-testid="setting-notifications">
          {rows.map((row) => (
            <div
              key={row.kind}
              className="border-base-300 flex min-w-0 items-start justify-between gap-3 border-t py-3 first:border-t-0 first:pt-0"
              data-testid={`notification-${row.kind}`}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor={`notify-${row.kind}`} className="text-sm wrap-anywhere">{copy(row.copyKey)}</label>
                <RowBody row={row} vetoHours={p.settings.publishing.vetoHours} next={next} />
              </div>
              <input
                id={`notify-${row.kind}`}
                type="checkbox"
                className="toggle toggle-primary shrink-0"
                checked={row.on}
                disabled={writer.busy}
                onChange={(e) => toggle(row.kind, e.target.checked)}
              />
            </div>
          ))}
        </div>

        <WeekOfMail weekly={isOn("weekly")} ready={isOn("draft-ready")} />

        {alwaysOn === null ? null : (
          <p className={`text-xs wrap-anywhere ${INK}`} data-testid="notifications-always-on">
            {alwaysOn}
          </p>
        )}
      </div>
    </section>
  );
}
