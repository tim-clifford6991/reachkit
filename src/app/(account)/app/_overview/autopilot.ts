// SPEC §4 (2026-10-09, issue 1362) — the Overview's head: what autopilot is
// doing, from facts already stored.
//
// Owner: "this should rather give the user confidence of the actual current
// app status." So the line names the next page and when it goes live on its
// own, or that it is being written; and only when true, that publishing is
// off, that ReachKit stopped its own work, or that nothing is planned. It
// never asks for anything: Edit and Stop are the only actions.
//
// **One statement of the next publish.** Every arm that is not about today
// or tomorrow is the shell's own sentence (`publishingStatement`, REQ-092
// c7's one home), so the head and the side panel's card cannot disagree
// about whether a page is on its way or why none is.
//
// **It reads no clock and no row.** `today` is the screen's own, the next
// publish is the shell's, and the day a page is planned for is the
// Overview's stored read.
import { copy } from "@/lib/presentation/copy";
import { formatDate, formatTime } from "../_shell/format";
import { publishingStatement } from "../_shell/PublishingCard";
import type { ShellModel } from "../_shell/model";
import { dayKeyOf, type DayKey } from "../calendar/dates";

export type AutopilotState = "due" | "writing" | "paused" | "stopped" | "nothing_planned" | "unexplained";

export interface AutopilotHead {
  state: AutopilotState;
  /** The head line, already written. */
  line: string;
}

const STATE_OF = {
  reachkit_stopped: "stopped",
  publishing_paused: "paused",
  not_written: "writing",
  nothing_planned: "nothing_planned",
  unexplained: "unexplained",
} as const satisfies Record<string, AutopilotState>;

/** The day after a site-local day, as that day's own key. */
function dayAfter(day: DayKey): DayKey {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return dayKeyOf(new Date(Date.UTC(year, month - 1, date + 1)), "UTC");
}

export function readAutopilot(a: {
  shell: ShellModel;
  today: Date;
  /** The site-local day the next unwritten page is planned for, or `null`. */
  writingOn: DayKey | null;
}): AutopilotHead {
  const { publishing, timeZone } = a.shell;
  const today = dayKeyOf(a.today, timeZone);
  const tomorrow = dayAfter(today);
  const statement = publishingStatement(a.shell).line;

  if (publishing.next !== null) {
    const day = dayKeyOf(publishing.next, timeZone);
    const time = formatTime(publishing.next, timeZone);
    if (day === today) return { state: "due", line: copy("overview.head.due.today", { time }) };
    if (day === tomorrow) return { state: "due", line: copy("overview.head.due.tomorrow", { time }) };
    return { state: "due", line: statement };
  }

  const state = STATE_OF[publishing.because];
  if (state !== "writing" || a.writingOn === null) return { state, line: statement };
  if (a.writingOn === today) return { state, line: copy("overview.head.writing.today") };
  if (a.writingOn === tomorrow) return { state, line: copy("overview.head.writing.tomorrow") };
  return {
    state,
    line: copy("overview.head.planned", { on: formatDate(new Date(`${a.writingOn}T00:00:00Z`), "UTC") }),
  };
}
