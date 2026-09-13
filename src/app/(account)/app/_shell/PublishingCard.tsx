// Canvas: Dashboard — the autopilot block at the foot of the sidebar.
//
// The artboard draws it as a sunk box: the mode's own word as the eyebrow
// with the switch on the same line, the state sentence under them, and the
// next-publish line quiet below that.
//
// The toggle is stateful in the customer's account and nothing here writes
// it: this shell renders the control in the state the model reports and
// passes no `onChange`, because wiring it before the mode's writer exists
// would be a second way to change the mode.
import type React from "react";
import { Toggle } from "@/ui/components/Toggle";
import { copy } from "@/lib/presentation/copy";
import { nextPublishStatement } from "@/lib/presentation/stopped";
import { NEXT_PUBLISH_OTHERWISE } from "./nopublish";
import { formatDateTime } from "./format";
import { writtenLine } from "./written";
import type { ShellModel } from "./model";
import { PROV } from "./style";

const MODE_COPY_KEY = {
  autopilot: "shell.publishing.mode.autopilot",
  copilot: "shell.publishing.mode.copilot",
} as const;

/** What the mode is doing. A `Record` over the same two modes, so a mode with
 *  no sentence is a compile error rather than a block stating only its own
 *  name. */
const STATE_COPY_KEY = {
  autopilot: "shell.publishing.state.autopilot",
  copilot: "shell.publishing.state.copilot",
} as const;

export function PublishingCard(p: { shell: ShellModel }): React.JSX.Element {
  const { publishing, timeZone } = p.shell;
  const modeWord = copy(MODE_COPY_KEY[publishing.mode]);
  const autopilot = publishing.mode === "autopilot";

  // The scheduled time, or the line for the resolved reason there is none —
  // both through `nextPublishStatement`, which is the one home for any
  // statement of when the next page publishes, so this block does not choose
  // its own key. When the account is stopped, `otherwise` still carries
  // whichever other cause the shell resolved and the statement ignores it.
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

  // Before the first weekly pass the mode is waiting on the deep pass, and
  // that is what the block states. The arm is the shell's own week count —
  // the same fact the domain block reads — so the two lines in this column
  // can never disagree about whether a week has been measured.
  const state =
    p.shell.weeks.kind === "counted"
      ? writtenLine(STATE_COPY_KEY[publishing.mode])
      : writtenLine("shell.publishing.state.week-zero");

  return (
    <div className={BLOCK} data-testid="shell-publishing">
      <div className={ROW}>
        <span className="eyebrow">{modeWord}</span>
        <Toggle label={modeWord} checked={autopilot} labelHidden />
      </div>
      {state === null ? null : (
        <p className={STATE} data-testid="shell-publishing-state">
          {state}
        </p>
      )}
      <p className={PROV} data-testid="shell-publishing-line">
        {statement.line}
      </p>
    </div>
  );
}

const BLOCK = "flex min-w-0 flex-col gap-(--s-1) rounded-(--r-box) bg-base-200 p-(--s-3)";
const ROW = "flex min-w-0 items-center justify-between gap-(--s-2)";
const STATE = "text-(length:--t-sm) font-semibold";
