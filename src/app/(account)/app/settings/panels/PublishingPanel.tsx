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
// **The state is the band; the reason is the line and the action** (#48,
// ADR-086). Three states the customer reads, and under one of them the
// written line that says what is true of their pages — which differs
// between a record that was never pointed, a credential that has run out
// and a credential that is valid and cannot publish. This card renders the
// registry's `DestinationView` entire and maps nothing of its own: the
// action comes from the view, so the control offered here is the one the
// engine decided on.
//
// **`reconnect_other_account` is its own control.** A destination whose
// credential is valid and simply cannot publish must not be offered
// ordinary Reconnect — re-entering the same credential is the one action
// guaranteed to change nothing. It is a union member rather than a
// relabelled button, so a card that offered the wrong one here would fail
// to compile.
//
// The mode toggle is labelled with the mode word, the same choice the shell's
// own publishing card makes and for the same reason: naming a control by what
// it controls, rather than minting a second sentence to sit beside it. Both
// read from the one pair of keys in `laws.ts`, so the sidebar and this card
// cannot end up calling the same mode two different things.
import type React from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/ui/components/Badge";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { CardHead } from "@/ui/idiom";
import { Toggle } from "@/ui/components/Toggle";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { ConnectDestination, type CredentialAction } from "./ConnectDestination";
import { formatVetoWindow, vetoIsWholeDays, vetoWindowDays } from "../format";
import type { DestinationAction, DestinationHealth, DestinationKind, SettingsModel } from "../model";
import type { Tone } from "@/ui/types";

const MODE_COPY_KEY = {
  autopilot: "shell.publishing.mode.autopilot",
  copilot: "shell.publishing.mode.copilot",
} as const;

/**
 * The stepper's value as a written line: the count in its own slot, and one
 * of two keys chosen by that count. The choice is a choice between written
 * lines, never a plural composed here — the registry interpolates and does
 * not pluralise.
 *
 * **A window that is not whole days renders as the hours it is.** The
 * stepper offers whole days and the writer refuses anything else, so such a
 * value can only have been stored before that rule or around it — and
 * `model.ts` is explicit that this screen states it as stored: "a read that
 * 'corrects' a stored value would hide the very state the validator exists
 * to prevent from ever being stored". "1.5 days" would read as a setting
 * somebody chose. `36h` reads as what it is.
 */
function vetoWindowLabel(hours: number): string {
  if (!vetoIsWholeDays(hours)) return formatVetoWindow(hours);
  const days = vetoWindowDays(hours);
  return copy(days === 1 ? "settings.publishing.veto.one-day" : "settings.publishing.veto.days", {
    days: String(days),
  });
}

/** The pair, in the order the approved set draws it. A tuple and not
 *  `Object.keys`, so the order is stated rather than inherited from an
 *  object literal's insertion order. */
const MODES = ["autopilot", "copilot"] as const;

/** One settable row: the name at the near edge, the value and its control at
 *  the far one, a hairline above. It is the shape S18 gives every row on
 *  this screen, written once here rather than five times below. */
function SettingRow(p: {
  name: string;
  testId: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="border-base-300 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t py-2"
      data-testid={p.testId}
    >
      <span className="min-w-0 text-sm wrap-anywhere">{p.name}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-2">{p.children}</span>
    </div>
  );
}

const KIND_COPY_KEY: Record<DestinationKind, CopyKey> = {
  hosted: "settings.destination.hosted",
  wordpress: "settings.destination.wordpress",
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

/** The label for each action this card renders itself. `none` has no
 *  control and therefore no key; the three that ask for a **credential**
 *  are `ConnectDestination`'s, because a word on a control that opens a
 *  form belongs with the form. What is left is the one action this card
 *  states and does not run.
 *
 *  Total over that remainder, so a sixth action arrives here as a missing
 *  key rather than as a destination with nothing to do about it. */
const ACTION_COPY_KEY: Record<Extract<DestinationAction, "set_dns">, CopyKey> = {
  set_dns: "settings.publishing.set-dns",
};

/** The three that need a credential typed (#240). Read as a predicate
 *  rather than as a list of `if`s, so the card cannot offer the form for
 *  one of them and forget another. */
function needsCredential(action: DestinationAction): action is CredentialAction {
  return action === "connect" || action === "reconnect" || action === "reconnect_other_account";
}

export function PublishingPanel(p: { settings: SettingsModel }): React.JSX.Element {
  const { publishing, destinations } = p.settings;
  const fixNote = writtenLine("settings.publishing.fix-note");

  const pairNote = writtenLine("settings.publishing.pair.note");

  return (
    <Card state="default" title={<CardHead icon={<Sparkles size={15} strokeWidth={1.8} aria-hidden />} eyebrow={copy("settings.publishing.title")} />}>
      <div className="flex min-w-0 flex-col gap-3">
        {/* S18 draws the mode as a PAIR of option cards, not a switch: two
            named choices side by side, the chosen one carrying the idiom's
            accent edge and tint. A switch put one mode's word beside a
            control whose off state was the other mode, unnamed — and REQ-073
            c2 asks the screen to say what the pair does, which it can only
            do once both are on it. `aria-pressed` is the state; the tint is
            keyed off it (`idiom.css`), so a chosen card cannot look chosen
            without being chosen. */}
        <div
          className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"
          data-testid="setting-mode"
        >
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className="rk-opt"
              aria-pressed={publishing.mode === mode}
              data-testid={`mode-${mode}`}
            >
              <Card
                state="default"
                title={<span className="rk-opt-label">{copy(MODE_COPY_KEY[mode])}</span>}
              >
                {null}
              </Card>
            </button>
          ))}
        </div>
        {pairNote === null ? null : (
          <p className="text-xs opacity-60 wrap-anywhere" data-testid="publishing-pair-note">
            {pairNote}
          </p>
        )}

        <hr className="border-base-300 min-w-0 border-t" />

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2" data-testid="setting-veto_hours">
          <span className="min-w-0 text-sm wrap-anywhere">{copy("settings.publishing.veto")}</span>
          {/* The stepper's two ends. §4.7's range (0–7d) is `VETO.minDays` and
              `VETO.maxDays`, enforced by the writer (issue #46) and never
              restated here — WO-178 step 4 puts that rule in one module and
              forbids a second copy, and a renderer that clamped would be one. */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Btn label={copy("settings.publishing.veto.less")} size="sm" variant="tertiary" />
            <span className="num min-w-0 text-center wrap-anywhere">
              {vetoWindowLabel(publishing.vetoHours)}
            </span>
            <Btn label={copy("settings.publishing.veto.more")} size="sm" variant="tertiary" />
          </div>
        </div>

        {/* S18's rows: the name at the near edge, the stored value and its
            control at the far one, hairline between. The value is mono
            because each of these is one — a time, a zone name (§2.3). */}
        <SettingRow name={copy("settings.publishing.publish-time")} testId="setting-publish_time">
          <span className="num min-w-0 wrap-anywhere">{publishing.publishTime}</span>
          <Btn label={copy("settings.edit")} size="sm" variant="tertiary" />
        </SettingRow>

        <SettingRow name={copy("settings.publishing.time-zone")} testId="setting-time_zone">
          <span className="num min-w-0 wrap-anywhere">{publishing.timeZone}</span>
          <Btn label={copy("settings.edit")} size="sm" variant="tertiary" />
        </SettingRow>

        {/* REQ-070 c1's "whether pages publish at all". The switch is the
            state and carries the row's own name; the word beside it is the
            value, which is what the approved row draws. */}
        <SettingRow
          name={copy("settings.publishing.enabled")}
          testId="setting-publishing_enabled"
        >
          <Toggle
            label={copy("settings.publishing.enabled")}
            labelHidden
            checked={publishing.enabled}
          />
        </SettingRow>

        <hr className="border-base-300 min-w-0 border-t" />

        <div className="flex min-w-0 flex-col gap-3" data-testid="setting-destinations">
          {/* The group's own name. S18 draws none, because it always draws
              two destinations and their names say what they are — but a site
              with none must still say what the empty section is, which is
              what `tests/app/settings/destinations.test.tsx` holds. */}
          <span className="eyebrow opacity-60">{copy("settings.publishing.destinations")}</span>
          {destinations.map((destination) => (
            <div className="flex min-w-0 flex-col gap-1" key={destination.id} data-testid={`destination-${destination.id}`}>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-sm font-semibold wrap-anywhere">
                  {copy(KIND_COPY_KEY[destination.kind])}
                </span>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                <Badge tone={HEALTH_TONE[destination.health]}>
                  {copy(destination.copy.state)}
                </Badge>
                {needsCredential(destination.action) ? (
                  // The one place a WordPress credential is typed (#240).
                  // The control's word is the engine's choice; the form
                  // under it is the same two fields whichever of the three
                  // states asked for it.
                  <ConnectDestination action={destination.action} />
                ) : destination.action === "none" ? null : (
                  <Btn label={copy(ACTION_COPY_KEY[destination.action])} size="sm" variant="secondary" />
                )}
                </span>
              </div>
              {destination.copy.line === null ? null : (
                <p className="text-xs opacity-60 wrap-anywhere">{copy(destination.copy.line)}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {fixNote === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{fixNote}</p>}
    </Card>
  );
}
