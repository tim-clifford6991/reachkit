// BUILD §4.7 — "**Publishing** (mode toggle, veto window stepper 0–7d default
// 24h, publish time, destinations list with health + Reconnect; footnote:
// *'Fix-type tasks are never automated, whatever the mode.'*)".
//
// Six of the fourteen settable keys: `mode`, `veto_hours`, `publish_time`,
// `time_zone`, `publishing_enabled` and `destinations`. §4.7 draws four of
// them; the other two are REQ-070 criterion 1's — "the time zone those times
// are stated in" and "whether pages publish at all" — and they belong on this
// card because every time on it is expressed in the first and nothing on it
// happens without the second.
//
// **The footnote is not decoration.** §9's autopilot limits are stated as
// holding "regardless of settings: ≤1 publish/day, ≤8/week; **Fix never
// automates**", and §7 marks the `unblock` type "instruction only, never
// generated, never automated". A customer who reads a mode toggle as "the
// product now does everything" has been misled by the control, so the
// sentence sits under the control that would mislead them.
//
// **Health is a state, not an error** (ADR-086, WO-179 step 4). `expired`
// carries Reconnect and the queue holds; `error` is a third state, not a
// failure this card apologises for. All three read as words rather than as
// colour alone — `Badge` requires a text child for exactly that reason.
//
// The mode toggle is labelled with the mode word, the same choice the shell's
// own publishing card makes and for the same reason: naming a control by what
// it controls, rather than minting a second sentence to sit beside it. Both
// read from the one pair of keys in `laws.ts`, so the sidebar and this card
// cannot end up calling the same mode two different things.
import type React from "react";
import { Badge } from "@/ui/components/Badge";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { Toggle } from "@/ui/components/Toggle";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { formatVetoWindow } from "../format";
import type { DestinationHealth, DestinationKind, SettingsModel } from "../model";
import type { Tone } from "@/ui/types";

const MODE_COPY_KEY = {
  autopilot: "shell.publishing.mode.autopilot",
  copilot: "shell.publishing.mode.copilot",
} as const;

const KIND_COPY_KEY: Record<DestinationKind, CopyKey> = {
  hosted: "settings.destination.hosted",
  wordpress: "settings.destination.wordpress",
};

const HEALTH_COPY_KEY: Record<DestinationHealth, CopyKey> = {
  ok: "settings.destination.health.ok",
  expired: "settings.destination.health.expired",
  error: "settings.destination.health.error",
};

/** §2.5: red is for "the customer's problem being shown to them". A
 *  credential that has expired or broken is exactly that — their pages are
 *  not going anywhere until it is fixed — while a healthy destination is a
 *  quiet success. Both `expired` and `error` are states with an action, so
 *  neither is louder than the other. */
const HEALTH_TONE: Record<DestinationHealth, Tone> = {
  ok: "ok",
  expired: "warn",
  error: "bad",
};

export function PublishingPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const { publishing, destinations } = p.settings;
  const modeWord = copy(MODE_COPY_KEY[publishing.mode]);
  const fixNote = writtenLine("settings.publishing.fix-note");

  return (
    <Card state="default" title={<h2>{copy("settings.publishing.title")}</h2>}>
      <div className="rk-settings-fields">
        <div data-testid="setting-mode">
          <Toggle label={modeWord} checked={publishing.mode === "autopilot"} />
        </div>

        <div className="rk-settings-field" data-testid="setting-veto_hours">
          <span className="rk-settings-label">{copy("settings.publishing.veto")}</span>
          {/* The stepper's two ends. §4.7's range (0–7d) is `VETO.minDays` and
              `VETO.maxDays`, enforced by the writer (issue #46) and never
              restated here — WO-178 step 4 puts that rule in one module and
              forbids a second copy, and a renderer that clamped would be one. */}
          <div className="rk-settings-row">
            <Btn label={copy("settings.publishing.veto.less")} size="sm" variant="ghost" />
            <span className="rk-settings-value num">{formatVetoWindow(publishing.vetoHours)}</span>
            <Btn label={copy("settings.publishing.veto.more")} size="sm" variant="ghost" />
          </div>
        </div>

        <div className="rk-settings-field" data-testid="setting-publish_time">
          <span className="rk-settings-label">{copy("settings.publishing.publish-time")}</span>
          <div className="rk-settings-row">
            <span className="rk-settings-value num">{publishing.publishTime}</span>
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>

        <div className="rk-settings-field" data-testid="setting-time_zone">
          <span className="rk-settings-label">{copy("settings.publishing.time-zone")}</span>
          <div className="rk-settings-row">
            <span className="rk-settings-value num">{publishing.timeZone}</span>
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>

        <div data-testid="setting-publishing_enabled">
          <Toggle label={copy("settings.publishing.enabled")} checked={publishing.enabled} />
        </div>

        <div className="rk-settings-field" data-testid="setting-destinations">
          <span className="rk-settings-label">{copy("settings.publishing.destinations")}</span>
          {destinations.map((destination) => (
            <div className="rk-settings-row" key={destination.id} data-testid={`destination-${destination.id}`}>
              <span className="rk-settings-value">{copy(KIND_COPY_KEY[destination.kind])}</span>
              <Badge tone={HEALTH_TONE[destination.health]}>
                {copy(HEALTH_COPY_KEY[destination.health])}
              </Badge>
              {destination.health === "ok" ? null : (
                <Btn label={copy("settings.publishing.reconnect")} size="sm" />
              )}
            </div>
          ))}
        </div>
      </div>

      {fixNote === null ? null : <p className="rk-settings-line">{fixNote}</p>}
    </Card>
  );
}
