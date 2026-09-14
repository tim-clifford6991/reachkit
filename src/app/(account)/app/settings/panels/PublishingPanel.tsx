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
// The fix note sits under the card: Fix-type work is never automated.
import type React from "react";
import { Sparkles } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { ConnectDestination, type CredentialAction } from "./ConnectDestination";
import { SettingRow } from "./SettingRow";
import { formatVetoWindow, vetoIsWholeDays, vetoWindowDays } from "../format";
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

/** The one action this card states and does not run itself. */
const ACTION_COPY_KEY: Record<Extract<DestinationAction, "set_dns">, CopyKey> = {
  set_dns: "settings.publishing.set-dns",
};

function needsCredential(action: DestinationAction): action is CredentialAction {
  return action === "connect" || action === "reconnect" || action === "reconnect_other_account";
}

export function PublishingPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const { publishing, destinations } = p.settings;
  const fixNote = writtenLine("settings.publishing.fix-note");

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">
          <Sparkles size={20} strokeWidth={1.75} aria-hidden />
          {copy("settings.publishing.title")}
        </h2>

        <div className="flex min-w-0 flex-col">
          <SettingRow name={copy("settings.publishing.veto")} testId="setting-veto_hours">
            {/* The range is the writer's (issue #46); this renders no clamp. */}
            <span className="join">
              <button type="button" className="btn btn-outline btn-sm join-item">
                {copy("settings.publishing.veto.less")}
              </button>
              <span className="join-item num flex items-center border border-base-300 px-3 text-sm">
                {vetoWindowLabel(publishing.vetoHours)}
              </span>
              <button type="button" className="btn btn-outline btn-sm join-item">
                {copy("settings.publishing.veto.more")}
              </button>
            </span>
          </SettingRow>

          <SettingRow name={copy("settings.publishing.publish-time")} testId="setting-publish_time">
            <span className="num min-w-0 wrap-anywhere">{publishing.publishTime}</span>
            <button type="button" className="btn btn-outline btn-sm">
              {copy("settings.change")}
            </button>
          </SettingRow>

          <SettingRow name={copy("settings.publishing.time-zone")} testId="setting-time_zone">
            <span className="num min-w-0 wrap-anywhere">{publishing.timeZone}</span>
            <button type="button" className="btn btn-outline btn-sm">
              {copy("settings.change")}
            </button>
          </SettingRow>

          <SettingRow name={copy("settings.publishing.enabled")} testId="setting-publishing_enabled">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              aria-label={copy("settings.publishing.enabled")}
              checked={publishing.enabled}
              readOnly
            />
          </SettingRow>
        </div>

        <div className="border-base-300 flex min-w-0 flex-col gap-3 border-t pt-4" data-testid="setting-destinations">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
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
                      className="num min-w-0 text-xs text-base-content/60 wrap-anywhere"
                      data-testid={`hostname-${destination.id}`}
                    >
                      {destination.hostname}
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  {/* SPEC §5: "live" / "waiting for DNS", beside health and
                      never instead of it. */}
                  {destination.copy.hostname === null ? null : (
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
                  ) : destination.action === "none" ? null : (
                    <button type="button" className="btn btn-outline btn-sm">
                      {copy(ACTION_COPY_KEY[destination.action])}
                    </button>
                  )}
                </span>
              </div>
              {destination.copy.line === null ? null : (
                <p className="text-xs text-base-content/60 wrap-anywhere">{copy(destination.copy.line)}</p>
              )}
            </div>
          ))}
        </div>

        {fixNote === null ? null : <p className="text-xs text-base-content/60 wrap-anywhere">{fixNote}</p>}
      </div>
    </section>
  );
}
