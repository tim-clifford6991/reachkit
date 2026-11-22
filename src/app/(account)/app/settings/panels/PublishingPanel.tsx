// SPEC §4 *Pages tab*, plate F2: the Publishing switch, the next page's three moments, and four lines whose *Change*
// opens a dialog. Autopilot is the only mode, so there is no mode control; every write is `../panel-actions.ts`'s, and
// its refusal is what the customer is told. Health is a state, not an error (ADR-086).
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
import { SettingLine } from "./SettingRow";
import { useSetting } from "./useSetting";
import { EditDialog, fromSetting } from "../EditDialog";
import { CARD, CARD_BODY, CARD_LEAD, CARD_TITLE } from "../frame";
import { savePublishTimeAction, saveTimeZoneAction, saveVetoHoursAction, setPublishingAction } from "../panel-actions";
import { OFF, ON, PUBLISHING_ENABLED_FIELD, PUBLISH_TIME_FIELD, TIME_ZONE_FIELD, VETO_HOURS_FIELD } from "../panel-state";
import { formatVetoWindow, vetoIsWholeDays, vetoWindowDays, zoneLabel } from "../format";
import type { DestinationAction, DestinationHealth, DestinationKind, SettingsDestination, SettingsModel } from "../model";
import { NO_NEXT_PAGE, type NextPage } from "../next-page";
import { Linked } from "../Linked";
import { CALENDAR_HREF } from "../../_overview/week";
import { SHELL_LOCALE } from "../../_shell/format";

/** The window as a written line. A stored window that is not whole days renders as the hours it is, never "1.5 days". */
export function vetoWindowLabel(hours: number): string {
  if (!vetoIsWholeDays(hours)) return formatVetoWindow(hours);
  const days = vetoWindowDays(hours);
  return copy(days === 1 ? "settings.publishing.veto.one-day" : "settings.publishing.veto.days", { days: String(days) });
}

const KIND_COPY_KEY: Record<DestinationKind, CopyKey> = {
  hosted: "settings.destination.hosted",
  wordpress: "settings.destination.wordpress",
};

const HEALTH_BADGE: Record<DestinationHealth, string> = {
  ok: "badge badge-success badge-soft",
  expired: "badge badge-warning badge-soft",
  error: "badge badge-error badge-soft",
};

function needsCredential(action: DestinationAction): action is CredentialAction {
  return action === "connect" || action === "reconnect" || action === "reconnect_other_account";
}

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

const NOTE = "text-sm text-base-content/70 wrap-anywhere";
const CHECK_PRESS = "btn btn-soft btn-primary min-h-11 self-start";

/** The runtime's own zones, read only once the dialog opens: four hundred options belong in the page only then. */
function ZoneSelect(p: { current: string }): React.JSX.Element {
  const offered = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  const zones = offered.includes(p.current) ? offered : [p.current, ...offered];
  return (
    <select className="select num w-full min-w-0" name={TIME_ZONE_FIELD} aria-label={copy("settings.publishing.time-zone")} defaultValue={p.current}>
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {zoneLabel(zone)}
        </option>
      ))}
    </select>
  );
}

/** − and +, whole days within `VETO`'s bounds; the form carries the hours the writer stores. */
function WindowStepper(p: { hours: number }): React.JSX.Element {
  const [days, setDays] = useState(vetoWindowDays(p.hours));
  const hours = days === vetoWindowDays(p.hours) ? p.hours : vetoHoursFromDays(days);
  const press = "btn btn-outline btn-square border-base-300 text-primary size-11";
  return (
    <div className="flex items-center gap-3">
      <input type="hidden" name={VETO_HOURS_FIELD} value={hours} />
      <button type="button" className={press} aria-label={copy("settings.publishing.veto.less.label")} disabled={days <= VETO.minDays} data-testid="veto-less" onClick={() => setDays(days - 1)}>
        <Minus size={16} strokeWidth={1.75} aria-hidden />
      </button>
      <span className="text-sm font-semibold" aria-live="polite" data-testid="veto-value">
        {vetoWindowLabel(hours)}
      </span>
      <button type="button" className={press} aria-label={copy("settings.publishing.veto.more.label")} disabled={days >= VETO.maxDays} data-testid="veto-more" onClick={() => setDays(days + 1)}>
        <Plus size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

/** Where pages go live: the address and its word, and a dialog holding the record or the WordPress form. */
function Where(p: { destination: SettingsDestination }): React.JSX.Element {
  const d = p.destination;
  const label = copy("settings.publishing.destinations");
  const live = d.hostnameState === "live";
  return (
    <SettingLine
      label={label}
      value={d.hostname === null ? { kind: "text", text: copy(KIND_COPY_KEY[d.kind]), full: copy(KIND_COPY_KEY[d.kind]) } : { kind: "address", text: d.hostname }}
      testId={`destination-${d.id}`}
      action={
        <span className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {d.kind !== "hosted" ? null : (
            <span className={live ? "badge badge-success badge-soft" : "badge badge-warning badge-soft"}>
              {live ? <Check size={14} strokeWidth={1.75} aria-hidden /> : null}
              {copy(live ? "settings.destination.hostname.live" : "settings.destination.hostname.waiting")}
            </span>
          )}
          {d.health === "ok" ? null : <span className={HEALTH_BADGE[d.health]}>{copy(d.copy.state)}</span>}
          <EditDialog label={label} lead={copy("settings.publishing.where.same")} testId="setting-destinations">
            {d.copy.line === null ? null : <p className={NOTE}>{copy(d.copy.line)}</p>}
            {needsCredential(d.action) ? <ConnectDestination action={d.action} /> : null}
            {d.dns === null ? null : (
              <>
                <CnameRecord record={d.dns} {...(live ? { state: "live" as const } : {})} />
                {/* The destination names its own host: nothing is sent. */}
                <CheckConnection draft={null} pressClass={CHECK_PRESS} />
              </>
            )}
          </EditDialog>
        </span>
      }
    />
  );
}

/** One moment of the next page, on the daisyUI vertical timeline. */
function Moment(p: { icon: React.ReactNode; title: string; first?: boolean; last?: boolean; children: React.ReactNode }): React.JSX.Element {
  return (
    <li>
      {p.first === true ? null : <hr className="bg-base-300" />}
      <div className="timeline-middle text-primary">{p.icon}</div>
      <div className="timeline-end flex min-w-0 flex-col py-1 text-sm">
        <span className="font-semibold wrap-anywhere">{p.title}</span>
        {p.children}
      </div>
      {p.last === true ? null : <hr className="bg-base-300" />}
    </li>
  );
}

export function PublishingPanel(p: { settings: SettingsModel; next?: NextPage }): React.JSX.Element {
  const next = p.next ?? NO_NEXT_PAGE;
  const { publishing, destinations } = p.settings;
  const writer = useSetting();
  /** Without an optimistic arm the switch snaps back the instant it is pressed; a refused write drops it. */
  const [enabled, expectEnabled] = useOptimistic(publishing.enabled);
  const stop = vetoWindowLabel(publishing.vetoHours);
  const time = clockLabel(publishing.publishTime);

  function toggle(on: boolean): void {
    const form = new FormData();
    form.set(PUBLISHING_ENABLED_FIELD, on ? ON : OFF);
    writer.press(setPublishingAction, form, () => expectEnabled(on));
  }

  const icon = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
  return (
    <section className={CARD} data-testid="publishing-flow">
      <div className={CARD_BODY}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className={CARD_TITLE}>{copy("settings.publishing.title")}</h2>
            <p className={CARD_LEAD} data-testid="publishing-lead">
              {copy(writer.busy ? "settings.publishing.saving" : enabled ? "settings.publishing.on.lead" : "settings.publishing.off.lead")}
            </p>
          </div>
          <label className="flex min-h-11 shrink-0 cursor-pointer items-center lg:min-h-8" data-testid="setting-publishing_enabled">
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

        {!enabled ? null : next.live === null ? (
          <p className={NOTE} data-testid="publishing-timeline">
            {copy("settings.publishing.flow.none", { window: stop, time })}
          </p>
        ) : (
          <ul className="timeline timeline-vertical timeline-compact min-w-0" aria-label={copy("settings.publishing.flow.title")} data-testid="publishing-timeline">
            <Moment icon={<Mail {...icon} />} title={copy("settings.publishing.flow.written")} first>
              <span className="num text-base-content/70">{next.written}</span>
            </Moment>
            <Moment icon={<Clock4 {...icon} />} title={copy("settings.publishing.flow.window", { window: stop })}>
              <span className="text-base-content/70 wrap-anywhere">
                <Linked sentence={copy("settings.publishing.flow.window.note")} word={copy("shell.nav.plan")} href={CALENDAR_HREF} />
              </span>
            </Moment>
            <Moment icon={<Globe {...icon} />} title={copy("settings.publishing.flow.live")} last>
              <span className="num text-base-content/70">{next.live}</span>
            </Moment>
          </ul>
        )}

        <div className="flex min-w-0 flex-col">
          {destinations.map((destination) => (
            <Where key={destination.id} destination={destination} />
          ))}
          <SettingLine
            label={copy("settings.publishing.publish-time")}
            value={{ kind: "text", text: time, full: time }}
            testId="setting-publish_time"
            action={
              <EditDialog
                label={copy("settings.publishing.publish-time")}
                lead={copy("settings.publishing.time.note")}
                testId="setting-publish_time-dialog"
                save={async (form) => fromSetting(await savePublishTimeAction(form))}
              >
                <select className="select w-full min-w-0" name={PUBLISH_TIME_FIELD} aria-label={copy("settings.publishing.publish-time")} defaultValue={publishing.publishTime} data-testid="publish-time">
                  {publishTimes(publishing.publishTime).map((each) => (
                    <option key={each} value={each}>
                      {clockLabel(each)}
                    </option>
                  ))}
                </select>
              </EditDialog>
            }
          />
          <SettingLine
            label={copy("settings.publishing.veto")}
            value={{ kind: "text", text: stop, full: stop }}
            testId="setting-veto_hours"
            action={
              <EditDialog
                label={copy("settings.publishing.veto")}
                lead={copy("settings.publishing.veto.note")}
                testId="setting-veto_hours-dialog"
                save={async (form) => fromSetting(await saveVetoHoursAction(form))}
              >
                <WindowStepper hours={publishing.vetoHours} />
              </EditDialog>
            }
          />
          <SettingLine
            label={copy("settings.publishing.time-zone")}
            value={{ kind: "address", text: publishing.timeZone }}
            testId="setting-time_zone"
            action={
              <EditDialog
                label={copy("settings.publishing.time-zone")}
                testId="setting-time_zone-dialog"
                save={async (form) => fromSetting(await saveTimeZoneAction(form))}
              >
                <ZoneSelect current={publishing.timeZone} />
              </EditDialog>
            }
          />
        </div>
      </div>
    </section>
  );
}
