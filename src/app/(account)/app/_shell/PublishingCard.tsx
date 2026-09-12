// BUILD §4.4 — "footer autopilot card (state + next publish time + toggle)".
//
// REQ-040 c3: the publishing word with the date and time of the next
// scheduled publish,
// in the customer's zone. REQ-040 c4: with no publish scheduled, one written
// line naming which of the four causes it is — resolved by
// `NO_PUBLISH_PRECEDENCE`, never by this renderer.
//
// The card leads with the answer (§2.5). Since #353 it leads with it in the
// shape UI-SPEC S12 draws: the one publishing word as the card's eyebrow
// with the switch on the same line, the state sentence under them, and the
// next-publish line quiet below that.
//
// `Card` requires a `title` node and either `children` or a `degradedLine`,
// and has no fallback string of its own.
//
// **The toggle switches `publishing_enabled`, and nothing here writes it.**
// §7 (2026-09-11) abolished the mode choice this control used to carry, so
// what it shows is §9's switch — whether pages publish at all — in the state
// the model reports; `switch/` is its writer (issue #45) and this shell
// passes no `onChange`.
//
// Its label is the switch's own name, already in the registry: naming a
// control by what it controls is the rule the landing page applies where one
// key serves two positions (WO-070, constitution rule 1.1), and no
// `shell.publishing.toggle.*` key stands between the customer and it.
//
// **The next line keeps the law's wording, not the set's.** The set draws
// it as `next · Tue 2 Sep 07:00`; `next-publish.scheduled` reads "Next page
// goes live {at}" and is one of the two keys `laws.ts` records as filled
// "verbatim, byte for byte" from REQ-040 c4. Ruling 11a makes the set's
// unbracketed strings approved copy, which puts the two in conflict — a
// law transcription against a drawing — and that is the owner's to settle,
// not this file's. So the shape is the set's and the sentence is the law's,
// and the PR says so.
//
// The time renders inside `.rk-prov`, which §2.5 already fixes as mono, dim
// and small ("Provenance is always visible but always quiet: `measured 28
// Aug` … mono, dim, small") — so §2.3's numeral rule is satisfied for the
// date without marking half a sentence and not the other half, which is the
// best a registry that hands back a flat string can do.
import type React from "react";
import { Toggle } from "@/ui/components/Toggle";
import { Card } from "@/ui/components/Card";
import { copy } from "@/lib/presentation/copy";
import { nextPublishStatement } from "@/lib/presentation/stopped";
import { NEXT_PUBLISH_OTHERWISE } from "./nopublish";
import { formatDateTime } from "./format";
import { writtenLine } from "./written";
import type { ShellModel } from "./model";

/** The one word every app artboard draws in this eyebrow, and the one
 *  sentence under it saying what publishing is doing. One each, because §7
 *  leaves one mode to be in. */
const MODE_WORD = "shell.publishing.mode.autopilot" as const;
const STATE_COPY_KEY = "shell.publishing.state.autopilot" as const;

export function PublishingCard(p: { shell: ShellModel }): React.JSX.Element {
  const { publishing, timeZone } = p.shell;
  const modeWord = copy(MODE_WORD);
  const switchLabel = copy("settings.publishing.enabled");

  // REQ-040 c3's time, or c4's line for the resolved reason — both through
  // `nextPublishStatement`, which is REQ-092 c7's one home: "any statement
  // of when the next page publishes … names ReachKit's stop as the reason
  // no publish is scheduled, and gives no other reason for it". This card
  // is one such statement, so it does not choose its own key.
  //
  // Note what is handed in when the account is stopped: `otherwise` still
  // carries whichever *other* cause the shell resolved, and the statement
  // ignores it (ADR-011 point 5). That is the behaviour, exercised on the
  // real screen, not merely in a unit test.
  const statement = nextPublishStatement({
    stopped: publishing.next === null && publishing.because === "reachkit_stopped",
    otherwise:
      publishing.next !== null
        ? { tag: "scheduled", at: formatDateTime(publishing.next, timeZone) }
        : {
            tag:
              publishing.because === "reachkit_stopped"
                ? "none-planned"
                : NEXT_PUBLISH_OTHERWISE[publishing.because],
          },
  });
  // No `writtenLine` guard on this line any more (issue #20): every
  // `next-publish.*` key now carries at least the visible `TODO(copy)`
  // marker, because REQ-091 c2 forbids a blank standing where a written
  // line belongs. The guard stays in `DomainBlock`, whose two keys are
  // still empty and owner-owed.
  // The state sentence, through the shell's own `writtenLine` rule.
  // Before the first weekly pass the work is waiting on the deep pass, and
  // that is what the card states (UI-SPEC S13). The arm is the shell's own
  // `WeekCount` — the same fact the domain block reads — so the two lines
  // in this column can never disagree about whether a week has been
  // measured.
  const state =
    p.shell.weeks.kind === "counted"
      ? writtenLine(STATE_COPY_KEY)
      : writtenLine("shell.publishing.state.week-zero");

  return (
    <div className="rk-publishing" data-testid="shell-publishing">
      <Card
        state="default"
        title={
          <span className="rk-publishing-row">
            <span className="eyebrow">{modeWord}</span>
            <Toggle label={switchLabel} checked={publishing.enabled} labelHidden />
          </span>
        }
      >
        {state === null ? null : (
          <p className="rk-publishing-state" data-testid="shell-publishing-state">
            {state}
          </p>
        )}
        <p className="rk-prov" data-testid="shell-publishing-line">
          {statement.line}
        </p>
      </Card>
    </div>
  );
}
