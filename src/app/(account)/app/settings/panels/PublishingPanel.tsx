// BUILD §4.7 — Publishing: veto window, publish time, time zone, whether
// pages publish at all, and the destinations with their health.
//
// SPEC §4: the customer may set the veto window, publish time and time zone.
// Mode is not a customer-facing value (2026-09-10) — autopilot is the only
// mode — so this card offers no mode control.
//
// **Health is a state, not an error** (ADR-086). Each destination shows its
// state as a written badge and, under it, the registry's line; the control is
// the one the engine chose (`DestinationView.action`). A valid credential
// that cannot publish gets `reconnect_other_account`, never plain Reconnect.
//
// A hosted destination still waiting for DNS shows the record to create,
// under the action that names it (#754) — the same block setup showed, so a
// founder who did not act then can act now — and the press that asks the
// domain list about it now (#757), the same press setup offers.
//
// **The four settings write** through `../panel-actions.ts`, and each press
// answers in words through `useSetting`. Nothing about *what* a window or a
// zone may be is decided here: `savePublishingSettings` refuses a patch
// whole, and a refusal is what the customer is told.
//
// The zone list is the **runtime's own** (`Intl.supportedValuesOf`), read
// at the press rather than at render: there is no second list of zones to
// fall out of date, and a list of four hundred options belongs in the
// document only once a founder has asked to change theirs.
"use client";

import type React from "react";
import { useOptimistic, useState } from "react";
import { Check, Clock4, Globe, Mail, Minus, Plus } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { VETO } from "@/lib/config/constants";
import { vetoHoursFromDays } from "@/lib/publish/settings/veto";
import { CheckConnection } from "../../../_destination/CheckConnection";
import { CnameRecord } from "../../../_destination/CnameRecord";
import { ConnectDestination, type CredentialAction } from "./ConnectDestination";
import { SettingRow } from "./SettingRow";
import { SAVED_BADGE_CLASS, useSetting } from "./useSetting";
import {
  savePublishTimeAction,
  saveTimeZoneAction,
  saveVetoHoursAction,
  setPublishingAction,
} from "../panel-actions";
import {
  OFF,
  ON,
  PUBLISHING_ENABLED_FIELD,
  PUBLISH_TIME_FIELD,
  TIME_ZONE_FIELD,
  VETO_HOURS_FIELD,
} from "../panel-state";
import { formatVetoWindow, vetoIsWholeDays, vetoWindowDays, zoneLabel } from "../format";
import type { DestinationAction, DestinationHealth, DestinationKind, SettingsDestination, SettingsModel } from "../model";
import { NO_NEXT_PAGE, type NextPage } from "../next-page";
import { Linked } from "../Linked";
import { CALENDAR_HREF } from "../../_overview/week";
import { SHELL_LOCALE } from "../../_shell/format";

/** The window as a written line. A stored window that is not whole days
 *  renders as the hours it is, never as "1.5 days". */
export function vetoWindowLabel(hours: number): string {
  if (!vetoIsWholeDays(hours)) return formatVetoWindow(hours);
  const days = vetoWindowDays(hours);
  return copy(days === 1 ? "settings.publishing.veto.one-day" : "settings.publishing.veto.days", {
    days: String(days),
  });
}

const KIND_COPY_KEY: Record<DestinationKind, CopyKey> = {
  hosted: "settings.destination.hosted",
  wordpress: "settings.destination.wordpress",
};

/** A broken credential is the customer's problem shown to them; a healthy
 *  destination is a quiet success. */
const HEALTH_BADGE: Record<DestinationHealth, string> = {
  ok: "badge badge-success badge-soft",
  expired: "badge badge-warning badge-soft",
  error: "badge badge-error badge-soft",
};

/** The one act this card states and does not run itself. It is never a
 *  control: where the record is known it is the record's heading, with the
 *  record and its check under it; where it is not, it is a statement of
 *  what the destination is waiting on (issue #913 — nothing is drawn as a
 *  button that has no handler behind it). */
const ACTION_COPY_KEY: Record<Extract<DestinationAction, "set_dns">, CopyKey> = {
  set_dns: "settings.publishing.set-dns",
};

function needsCredential(action: DestinationAction): action is CredentialAction {
  return action === "connect" || action === "reconnect" || action === "reconnect_other_account";
}

/** The zones the runtime resolves, alphabetically. Read at the press and
 *  not at module scope: it is four hundred strings, and a card nobody is
 *  editing has no use for them. A runtime that does not offer the list
 *  answers with the one zone the site already has, which is still a
 *  choice the select can render honestly. */
function resolvableZones(current: string): readonly string[] {
  const offered =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return offered.length === 0 ? [current] : offered;
}

/** A hosted address that is live and healthy: the board's "where pages go live" figure. */
function isLiveHost(d: SettingsDestination): d is SettingsDestination & { hostname: string } {
  return d.kind === "hosted" && d.hostname !== null && d.hostnameState === "live" && d.health === "ok";
}

/** The board's soft Check connection, 44px tall. */
const CHECK_PRESS = "btn btn-soft btn-primary min-h-11 self-start";

/** Every hour of the day, and the stored time where it is not on the hour. */
function publishTimes(current: string): readonly string[] {
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
  return hours.includes(current) ? hours : [...hours, current].sort();
}

/** "16:00" as the boards write it, "4:00 PM"; a value that is not a clock time is shown as stored. */
function clockLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return time;
  return new Intl.DateTimeFormat(SHELL_LOCALE, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(Date.UTC(2026, 0, 1, h, m));
}

/** One of the three steps each page goes through. */
function Step(p: { icon: React.ReactNode; title: string; tone: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <li className="bg-base-200 rounded-box flex min-w-0 flex-col gap-1 p-4 text-sm">
      <span className={`flex min-w-0 items-center gap-2 font-semibold ${p.tone}`}>
        {p.icon}
        <span className="min-w-0 wrap-anywhere">{p.title}</span>
      </span>
      {p.children}
    </li>
  );
}

export function PublishingPanel(p: { settings: SettingsModel; next?: NextPage }): React.JSX.Element {
  const next = p.next ?? NO_NEXT_PAGE;
  const { publishing, destinations } = p.settings;
  const writer = useSetting();
  const [editingZone, setEditingZone] = useState(false);
  /** The stepper and the switch are drawn from the stored value; without an
   *  optimistic arm each snaps back the instant it is pressed. A refused
   *  write drops the optimistic value. */
  const [vetoHours, expectVetoHours] = useOptimistic(publishing.vetoHours);
  const [enabled, expectEnabled] = useOptimistic(publishing.enabled);

  /** Whole days, the unit the control offers; a press past `VETO`'s bounds is not offered. */
  const days = vetoWindowDays(vetoHours);
  function step(to: number): void {
    const hours = vetoHoursFromDays(to);
    const form = new FormData();
    form.set(VETO_HOURS_FIELD, String(hours));
    writer.press(saveVetoHoursAction, form, () => expectVetoHours(hours));
  }

  function toggle(on: boolean): void {
    const form = new FormData();
    form.set(PUBLISHING_ENABLED_FIELD, on ? ON : OFF);
    writer.press(setPublishingAction, form, () => expectEnabled(on));
  }

  function savePublishTime(time: string): void {
    const form = new FormData();
    form.set(PUBLISH_TIME_FIELD, time);
    writer.press(savePublishTimeAction, form);
  }

  const live = enabled && next.live !== null;
  return (
    <>
      <section className="card card-border min-w-0 bg-base-100" data-testid="publishing-flow">
        <div className="card-body gap-5">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="card-title min-w-0 flex-wrap text-(length:--h3)">
                <span className="min-w-0 wrap-anywhere">{copy("settings.publishing.title")}</span>
                {writer.saved ? (
                  <span className={SAVED_BADGE_CLASS} data-testid="publishing-saved">
                    {copy("settings.answer.saved-badge")}
                  </span>
                ) : null}
              </h2>
              <p className="text-sm text-base-content/70 wrap-anywhere" data-testid="publishing-lead">
                {copy(enabled ? "settings.publishing.on.lead" : "settings.publishing.off.lead")}
              </p>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold" data-testid="setting-publishing_enabled">
              <span>{copy(enabled ? "settings.publishing.on" : "settings.publishing.off")}</span>
              <input
                type="checkbox"
                role="switch"
                className="toggle toggle-primary"
                aria-label={copy("settings.publishing.title")}
                checked={enabled}
                disabled={writer.busy}
                data-testid="publishing-enabled"
                onChange={(e) => toggle(e.target.checked)}
              />
            </label>
          </div>

          <ol className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3" aria-label={copy("settings.publishing.flow.title")} data-layout="steps" data-testid="publishing-timeline">
            <Step icon={<Mail size={16} strokeWidth={1.75} aria-hidden />} title={copy("settings.publishing.flow.written")} tone="">
              {live ? <span className="num text-sm">{next.written}</span> : null}
            </Step>
            <Step icon={<Clock4 size={16} strokeWidth={1.75} aria-hidden />} title={copy("settings.publishing.flow.window", { window: vetoWindowLabel(vetoHours) })} tone="text-primary">
              <span className="text-base-content/70 wrap-anywhere">
                <Linked sentence={copy("settings.publishing.flow.window.note")} word={copy("shell.nav.plan")} href={CALENDAR_HREF} />
              </span>
            </Step>
            <Step icon={<Globe size={16} strokeWidth={1.75} aria-hidden />} title={copy(enabled ? "settings.publishing.flow.live" : "settings.publishing.flow.paused")} tone={enabled ? "text-success" : ""}>
              {live ? <span className="num text-sm">{next.live}</span> : null}
            </Step>
          </ol>
        </div>
      </section>

      <section className="card card-border min-w-0 bg-base-100">
        <div className="card-body flex min-w-0 flex-col">
          <SettingRow
            name={copy("settings.publishing.destinations")}
            testId="setting-destinations"
            below={
              <div className="flex min-w-0 flex-col gap-3">
              {destinations.map((destination) => isLiveHost(destination) ? (
                <div className="flex min-w-0 flex-col gap-2" key={destination.id} data-testid={`destination-${destination.id}`}>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <span className="num min-w-0 wrap-anywhere" data-testid={`hostname-${destination.id}`}>{destination.hostname}</span>
                    <span className="badge badge-success badge-soft">
                      <Check size={14} strokeWidth={1.75} aria-hidden />
                      {copy("settings.destination.hostname.live")}
                    </span>
                  </div>
                  <p className="text-sm text-base-content/70 wrap-anywhere">{copy("settings.publishing.where.same")}</p>
                  <CheckConnection draft={null} pressClass={CHECK_PRESS} />
                </div>
              ) : (
                <div className="flex min-w-0 flex-col gap-1" key={destination.id} data-testid={`destination-${destination.id}`}>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-baseline gap-2">
                      <span className="min-w-0 text-sm font-semibold wrap-anywhere">
                        {copy(KIND_COPY_KEY[destination.kind])}
                      </span>
                      {destination.hostname === null ? null : (
                        <span
                          className="num min-w-0 text-xs text-base-content/70 wrap-anywhere"
                          data-testid={`hostname-${destination.id}`}
                        >
                          {destination.hostname}
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      {/* SPEC §5: "live" / "waiting for DNS", beside health and
                          never instead of it. Where the record is shown below,
                          the record's own badge says it, beside the record. */}
                      {destination.copy.hostname === null || destination.dns !== null ? null : (
                        <span
                          className={
                            destination.hostnameState === "live"
                              ? "badge badge-success badge-soft"
                              : "badge badge-warning badge-soft"
                          }
                        >
                          {copy(destination.copy.hostname)}
                        </span>
                      )}
                      <span className={HEALTH_BADGE[destination.health]}>{copy(destination.copy.state)}</span>
                      {needsCredential(destination.action) ? (
                        <ConnectDestination action={destination.action} />
                      ) : destination.action === "none" || destination.dns !== null ? null : (
                        // **A statement, not a control** (issue #913). This
                        // names the act a hosted destination is waiting on
                        // while the record itself could not be read, so there
                        // is nothing here to press: it was drawn as a button
                        // with no handler, which is a control that cannot act.
                        // Where the record *is* known it is the heading of the
                        // block below, with the record under it and the one
                        // press that checks it — which is the act, and does
                        // work.
                        <span className="text-sm font-semibold wrap-anywhere" data-testid="dns-needed">
                          {copy(ACTION_COPY_KEY[destination.action])}
                        </span>
                      )}
                    </span>
                  </div>
                  {destination.copy.line === null ? null : (
                    <p className="text-xs text-base-content/70 wrap-anywhere">{copy(destination.copy.line)}</p>
                  )}
                  {destination.dns === null ? null : (
                    <div className="mt-2 flex min-w-0 flex-col gap-1" data-testid={`dns-${destination.id}`}>
                      <h4 className="text-sm font-semibold">{copy(ACTION_COPY_KEY.set_dns)}</h4>
                      <CnameRecord record={destination.dns} />
                      {/* The destination names its own host: nothing is sent. */}
                      <CheckConnection draft={null} />
                    </div>
                  )}
                </div>
              ))}
              </div>
            }
          />
          <SettingRow name={copy("settings.publishing.publish-time")} testId="setting-publish_time">
            {/* Writes on choice, like the switch and the stepper; the answer line says when it bites. */}
            <select
              className="select min-h-11 w-auto min-w-0"
              aria-label={copy("settings.publishing.publish-time")}
              value={publishing.publishTime}
              disabled={writer.busy}
              data-testid="publish-time"
              onChange={(e) => savePublishTime(e.target.value)}
            >
              {publishTimes(publishing.publishTime).map((time) => (
                <option key={time} value={time}>
                  {clockLabel(time)}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow name={copy("settings.publishing.veto")} testId="setting-veto_hours">
            {/* The range is the writer's; a press past it is not offered. */}
            <span className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-outline btn-square border-base-300 text-primary size-11"
                aria-label={copy("settings.publishing.veto.less.label")}
                disabled={writer.busy || days <= VETO.minDays}
                data-testid="veto-less"
                onClick={() => step(days - 1)}
              >
                <Minus size={16} strokeWidth={1.75} aria-hidden />
              </button>
              <span className="text-sm font-semibold" data-testid="veto-value">{vetoWindowLabel(vetoHours)}</span>
              <button
                type="button"
                className="btn btn-outline btn-square border-base-300 text-primary size-11"
                aria-label={copy("settings.publishing.veto.more.label")}
                disabled={writer.busy || days >= VETO.maxDays}
                data-testid="veto-more"
                onClick={() => step(days + 1)}
              >
                <Plus size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </span>
          </SettingRow>

          <SettingRow
            name={copy("settings.publishing.time-zone")}
            testId="setting-time_zone"
            below={
              editingZone ? (
                <form
                  action={(form) => {
                    writer.press(saveTimeZoneAction, form);
                    setEditingZone(false);
                  }}
                  className="flex min-w-0 flex-wrap items-end gap-2"
                  data-testid="edit-time_zone"
                >
                  <select
                    className="select num min-h-11 min-w-0 grow"
                    name={TIME_ZONE_FIELD}
                    aria-label={copy("settings.publishing.time-zone")}
                    defaultValue={publishing.timeZone}
                  >
                    {resolvableZones(publishing.timeZone).map((zone) => (
                      <option key={zone} value={zone}>
                        {zoneLabel(zone)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-primary min-h-11" disabled={writer.busy}>
                    {copy("settings.save")}
                  </button>
                  <button type="button" className="btn btn-ghost min-h-11" onClick={() => setEditingZone(false)}>
                    {copy("settings.cancel-edit")}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-base-content/70 min-w-0 wrap-anywhere" data-testid="time-zone-note">
                  {copy("settings.publishing.time-zone.note")}
                </p>
              )
            }
          >
            {editingZone ? null : (
              <>
                <span className="num num-phrase min-w-0 wrap-anywhere" data-testid="time-zone-label">
                  {zoneLabel(publishing.timeZone)}
                </span>
                {/* SPEC §4: the customer may set the zone, so the row keeps its Change. */}
                <button type="button" className="btn btn-ghost min-h-11" onClick={() => setEditingZone(true)}>
                  {copy("settings.change")}
                </button>
              </>
            )}
          </SettingRow>
        </div>
      </section>
    </>
  );
}
