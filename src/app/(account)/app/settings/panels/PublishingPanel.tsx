// Canvas: Settings — the veto window the artboard draws as its own card,
// with the three answers that govern the same clock: the mode, the publish
// time and the zone those times are stated in, plus whether pages publish.
//
// Five of the fourteen settable keys. The stepper's range is the writer's
// (`VETO.minDays`/`maxDays`) and is never restated here: a renderer that
// clamped would be a second copy of that rule.
//
// The mode is drawn as a pair of named choices, not a switch: a switch put
// one mode's word beside a control whose off state was the other mode,
// unnamed — and REQ-073 c2 asks the screen to say what the pair does.
import type React from "react";
import { Clock } from "lucide-react";
import { Btn, Card, Toggle } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { SettingRow } from "./SettingRow";
import { formatVetoWindow, vetoIsWholeDays, vetoWindowDays } from "../format";
import type { SettingsModel } from "../model";
import {
  CARD_HEAD,
  CARD_LABEL,
  CHOICE,
  CHOICES,
  EXPLAIN,
  GLYPH,
  ROW,
  ROW_NAME,
  ROW_VALUE,
  RULE,
  SECTION,
  STEPPER,
  STROKE,
  VALUE,
} from "../style";

const MODE_COPY_KEY = {
  autopilot: "shell.publishing.mode.autopilot",
  copilot: "shell.publishing.mode.copilot",
} as const;

/** The pair, in the order the artboard draws it. A tuple, so the order is
 *  stated rather than inherited from an object literal. */
const MODES = ["autopilot", "copilot"] as const;

/**
 * The stepper's value as a written line: the count in its own slot, and one
 * of two keys chosen by that count — a choice between written lines, never
 * a plural composed here.
 *
 * A window that is not whole days renders as the hours it is: the stepper
 * offers whole days, so such a value was stored before that rule or around
 * it, and "1.5 days" would read as a setting somebody chose.
 */
function vetoWindowLabel(hours: number): string {
  if (!vetoIsWholeDays(hours)) return formatVetoWindow(hours);
  const days = vetoWindowDays(hours);
  return copy(days === 1 ? "settings.publishing.veto.one-day" : "settings.publishing.veto.days", {
    days: String(days),
  });
}

export function PublishingPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const { publishing } = p.settings;
  const pairNote = writtenLine("settings.publishing.pair.note");

  return (
    <Card
      state="default"
      title={
        <div className={CARD_HEAD}>
          <span className={CARD_LABEL}>
            <Clock size={GLYPH} strokeWidth={STROKE} aria-hidden />
            <span className="eyebrow">{copy("settings.publishing.veto")}</span>
          </span>
        </div>
      }
    >
      <div className={SECTION}>
        {/* The artboard's stepper: the two ends, the window between them,
            and the range stated quietly beside it. */}
        <div className={ROW} data-testid="setting-veto_hours">
          <span className={ROW_NAME}>{copy("settings.publishing.veto")}</span>
          <div className={STEPPER}>
            <Btn label={copy("settings.publishing.veto.less")} size="sm" variant="secondary" pill />
            <span className={VALUE}>{vetoWindowLabel(publishing.vetoHours)}</span>
            <Btn label={copy("settings.publishing.veto.more")} size="sm" variant="secondary" pill />
          </div>
        </div>

        {pairNote === null ? null : (
          <p className={EXPLAIN} data-testid="publishing-pair-note">
            {pairNote}
          </p>
        )}

        <hr className={RULE} />

        {/* Two named choices side by side, the chosen one carrying the
            tint. `aria-pressed` is the state and the tint is keyed off it,
            so a chosen card cannot look chosen without being chosen. */}
        <div className={CHOICES} data-testid="setting-mode">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={CHOICE}
              aria-pressed={publishing.mode === mode}
              data-testid={`mode-${mode}`}
            >
              {copy(MODE_COPY_KEY[mode])}
            </button>
          ))}
        </div>

        <SettingRow name={copy("settings.publishing.publish-time")} testId="setting-publish_time">
          <span className={VALUE}>{publishing.publishTime}</span>
          <Btn label={copy("settings.change")} size="sm" variant="secondary" pill />
        </SettingRow>

        <SettingRow name={copy("settings.publishing.time-zone")} testId="setting-time_zone">
          <span className={VALUE}>{publishing.timeZone}</span>
          <Btn label={copy("settings.change")} size="sm" variant="secondary" pill />
        </SettingRow>

        {/* "Whether pages publish at all" (REQ-070 c1). The switch carries
            the row's own name, which is what the artboard's row draws. */}
        <div className={ROW} data-testid="setting-publishing_enabled">
          <span className={ROW_NAME}>{copy("settings.publishing.enabled")}</span>
          <span className={ROW_VALUE}>
            <Toggle
              label={copy("settings.publishing.enabled")}
              labelHidden
              checked={publishing.enabled}
            />
          </span>
        </div>
      </div>
    </Card>
  );
}
