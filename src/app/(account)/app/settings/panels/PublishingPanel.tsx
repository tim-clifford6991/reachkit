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
// The fix note sits under the card: Fix-type work is never automated.
//
// **The four settings write** (SPEC §4, 2026-09-20, #908, issue #913).
// Until that issue the stepper, the two Change presses and the switch were
// drawn and inert — every one of them already in `SETTABLE`'s closed offer
// with no path to the column behind it. They now go to
// `../panel-actions.ts`, and each press answers in words through
// `useSetting`. Nothing about *what* a window or a zone may be is decided
// here: `savePublishingSettings` refuses a patch whole, and a refusal is
// what the customer is told.
//
// The zone list is the **runtime's own** (`Intl.supportedValuesOf`), read
// at the press rather than at render: there is no second list of zones to
// fall out of date, and a list of four hundred options belongs in the
// document only once a founder has asked to change theirs.
"use client";

import type React from "react";
import { useOptimistic, useState } from "react";
import { Sparkles } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { VETO } from "@/lib/config/constants";
import { vetoHoursFromDays } from "@/lib/publish/settings/veto";
import { CheckConnection } from "../../../_destination/CheckConnection";
import { CnameRecord } from "../../../_destination/CnameRecord";
import { writtenLine } from "../../_shell/written";
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
  type SettingAnswer,
} from "../panel-state";
import { formatVetoWindow, vetoIsWholeDays, vetoWindowDays, zoneLabel } from "../format";
import type { DestinationAction, DestinationHealth, DestinationKind, SettingsModel } from "../model";

/** The window as a written line. A stored window that is not whole days
 *  renders as the hours it is, never as "1.5 days". */
function vetoWindowLabel(hours: number): string {
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

/** Which of the two moments has a field open. `null` is the card's
 *  ordinary state: nothing is being changed. */
type Editing = "publish_time" | "time_zone" | null;

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

export function PublishingPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const { publishing, destinations } = p.settings;
  const fixNote = writtenLine("settings.publishing.fix-note");
  const writer = useSetting();
  const [editing, setEditing] = useState<Editing>(null);
  /** The two controls whose own state is what the customer presses: the
   *  window the stepper shows and the switch. Both are drawn from the
   *  stored value, so without an optimistic arm each snaps back the
   *  instant it is pressed and moves again when the re-read lands. A
   *  refused write drops the optimistic value and leaves the control
   *  exactly where the column still has it. */
  const [vetoHours, expectVetoHours] = useOptimistic(publishing.vetoHours);
  const [enabled, expectEnabled] = useOptimistic(publishing.enabled);

  /** The stepper, in whole days — the unit the control offers. The bounds
   *  are `VETO`'s, and a press at a bound is not offered: `savePublishing
   *  Settings` would refuse it, and REQ-043 c9's rule against offering a
   *  control that would be refused is the same rule wherever it applies. */
  const days = vetoWindowDays(vetoHours);
  function step(to: number): void {
    const hours = vetoHoursFromDays(to);
    const form = new FormData();
    form.set(VETO_HOURS_FIELD, String(hours));
    writer.press(saveVetoHoursAction, form, () => expectVetoHours(hours));
  }

  /** A field's submit: write it, and close the field on a save. A refusal
   *  leaves it open with the value the customer chose still in it. */
  function submit(action: (form: FormData) => Promise<SettingAnswer>, form: FormData): void {
    writer.press(action, form);
    setEditing(null);
  }

  function toggle(on: boolean): void {
    const form = new FormData();
    form.set(PUBLISHING_ENABLED_FIELD, on ? ON : OFF);
    writer.press(setPublishingAction, form, () => expectEnabled(on));
  }

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title min-w-0 flex-wrap text-base">
          <Sparkles size={20} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 wrap-anywhere">{copy("settings.publishing.title")}</span>
          {/* R4-11's own badge: the quiet half of the answer, for a
              customer who looked away while the toast was up. */}
          {writer.saved ? (
            <span className={SAVED_BADGE_CLASS} data-testid="publishing-saved">
              {copy("settings.answer.saved-badge")}
            </span>
          ) : null}
        </h2>

        <div className="flex min-w-0 flex-col">
          <SettingRow
            name={copy("settings.publishing.veto")}
            testId="setting-veto_hours"
            below={
              /* SPEC §7 (2026-09-20, #914): the canvas draws the customer's
                 name for this window with a line saying what the number
                 measures. The row's own `below` slot carries it. */
              <p className="text-base-content/70 min-w-0 text-xs wrap-anywhere" data-testid="veto-note">
                {copy("settings.publishing.veto.note")}
              </p>
            }
          >
            {/* The range is the writer's (issue #46); this offers no press
                past it rather than rendering a clamp of its own. */}
            <span className="join">
              <button
                type="button"
                className="btn btn-outline border-base-300 btn-sm join-item"
                aria-label={copy("settings.publishing.veto.less.label")}
                disabled={writer.busy || days <= VETO.minDays}
                data-testid="veto-less"
                onClick={() => step(days - 1)}
              >
                {copy("settings.publishing.veto.less")}
              </button>
              <span className="join-item num flex items-center border border-base-300 px-3 text-sm">
                {vetoWindowLabel(vetoHours)}
              </span>
              <button
                type="button"
                className="btn btn-outline border-base-300 btn-sm join-item"
                aria-label={copy("settings.publishing.veto.more.label")}
                disabled={writer.busy || days >= VETO.maxDays}
                data-testid="veto-more"
                onClick={() => step(days + 1)}
              >
                {copy("settings.publishing.veto.more")}
              </button>
            </span>
          </SettingRow>

          <SettingRow
            name={copy("settings.publishing.publish-time")}
            testId="setting-publish_time"
            below={
              editing !== "publish_time" ? null : (
                <form
                  action={(form) => submit(savePublishTimeAction, form)}
                  className="flex min-w-0 flex-wrap items-end gap-2"
                  data-testid="edit-publish_time"
                >
                  {/* The row above already names this field; a second
                      copy of the word under it would be the same label
                      twice. The control carries it for a screen reader. */}
                  <input
                    type="time"
                    className="input num min-w-0 grow"
                    name={PUBLISH_TIME_FIELD}
                    aria-label={copy("settings.publishing.publish-time")}
                    defaultValue={publishing.publishTime}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={writer.busy}>
                    {writer.busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                    {copy("settings.save")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                    {copy("settings.cancel-edit")}
                  </button>
                </form>
              )
            }
          >
            {editing === "publish_time" ? null : (
              <>
                <span className="num min-w-0 wrap-anywhere">{publishing.publishTime}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing("publish_time")}
                >
                  {copy("settings.change")}
                </button>
              </>
            )}
          </SettingRow>

          <SettingRow
            name={copy("settings.publishing.time-zone")}
            testId="setting-time_zone"
            below={
              editing !== "time_zone" ? null : (
                <form
                  action={(form) => submit(saveTimeZoneAction, form)}
                  className="flex min-w-0 flex-wrap items-end gap-2"
                  data-testid="edit-time_zone"
                >
                  <select
                    className="select num min-w-0 grow"
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
                  <button type="submit" className="btn btn-primary btn-sm" disabled={writer.busy}>
                    {writer.busy ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                    {copy("settings.save")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>
                    {copy("settings.cancel-edit")}
                  </button>
                </form>
              )
            }
          >
            {editing === "time_zone" ? null : (
              <>
                {/* The place, then the identifier (#925). `num-phrase` and
                    not bare `.num`: two facts joined by a separator is a
                    phrase and folds at its spaces, where a lone identifier
                    is one value and never folds. */}
                <span className="num num-phrase min-w-0 wrap-anywhere" data-testid="time-zone-label">
                  {zoneLabel(publishing.timeZone)}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing("time_zone")}
                >
                  {copy("settings.change")}
                </button>
              </>
            )}
          </SettingRow>

          <SettingRow name={copy("settings.publishing.enabled")} testId="setting-publishing_enabled">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              aria-label={copy("settings.publishing.enabled")}
              checked={enabled}
              disabled={writer.busy}
              data-testid="publishing-enabled"
              onChange={(e) => toggle(e.target.checked)}
            />
          </SettingRow>
        </div>

        <div className="border-base-300 flex min-w-0 flex-col gap-3 border-t pt-4" data-testid="setting-destinations">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/70">
            {copy("settings.publishing.destinations")}
          </h3>
          {destinations.map((destination) => (
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

        {fixNote === null ? null : <p className="text-xs text-base-content/70 wrap-anywhere">{fixNote}</p>}
      </div>
    </section>
  );
}
