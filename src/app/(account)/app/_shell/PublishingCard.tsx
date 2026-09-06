// BUILD §4.4 — "footer autopilot card (state + next publish time + toggle)".
//
// REQ-040 c3: the mode with the date and time of the next scheduled publish,
// in the customer's zone. REQ-040 c4: with no publish scheduled, one written
// line naming which of the four causes it is — resolved by
// `NO_PUBLISH_PRECEDENCE`, never by this renderer.
//
// The card leads with the answer (§2.5): its title is the mode as a verdict
// badge, not the label "Mode". `Card` requires a `title` node and either
// `children` or a `degradedLine`, and has no fallback string of its own.
//
// **The toggle is stateful in the customer's account, and nothing here
// writes it.** §4.7 gives the publishing mode its writer (issue #18, and the
// change rules in #42); this shell renders the control in the state the
// model reports and passes no `onChange` — `Toggle`'s handler is optional.
// Wiring it from the shell before that writer exists would be a second way
// to change the mode.
//
// Its label is the mode word rather than a second sentence: the control
// switches autopilot, and naming a control by what it controls is the same
// rule the landing page applies where one key serves two positions (WO-070,
// constitution rule 1.1). No `shell.publishing.toggle.*` key exists, so
// there is no owner-owed string standing between the customer and the
// control.
//
// The time renders inside `.rk-prov`, which §2.5 already fixes as mono, dim
// and small ("Provenance is always visible but always quiet: `measured 28
// Aug` … mono, dim, small") — so §2.3's numeral rule is satisfied for the
// date without marking half a sentence and not the other half, which is the
// best a registry that hands back a flat string can do.
import type React from "react";
import { Badge } from "@/ui/components/Badge";
import { Toggle } from "@/ui/components/Toggle";
import { Card } from "@/ui/components/Card";
import { copy } from "@/lib/presentation/copy";
import { nextPublishStatement } from "@/lib/presentation/stopped";
import { NEXT_PUBLISH_OTHERWISE } from "./nopublish";
import { formatDateTime } from "./format";
import type { ShellModel } from "./model";

const MODE_COPY_KEY = {
  autopilot: "shell.publishing.mode.autopilot",
  copilot: "shell.publishing.mode.copilot",
} as const;

export function PublishingCard(p: { shell: ShellModel }): React.JSX.Element {
  const { publishing, timeZone } = p.shell;
  const modeWord = copy(MODE_COPY_KEY[publishing.mode]);
  const autopilot = publishing.mode === "autopilot";

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
  return (
    <div className="rk-publishing" data-testid="shell-publishing">
      <Card state="default" title={<Badge tone={autopilot ? "accent" : "neutral"}>{modeWord}</Badge>}>
        <p className="rk-prov" data-testid="shell-publishing-line">
          {statement.line}
        </p>
        <Toggle label={modeWord} checked={autopilot} />
      </Card>
    </div>
  );
}
