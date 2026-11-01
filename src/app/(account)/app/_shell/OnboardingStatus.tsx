// SPEC §5 — what the shell says about onboarding (issue #782): the running
// pass's step, the founder's reason once a thin or failed pass has released
// them, or nothing. The state is `readOnboarding`'s; this writes the words.
//
// `FirstPageNotice` is the same state on Overview and Calendar: while the
// pass and the first draft run, the screen says the first page is being
// written rather than drawing an empty app with no reason.
import type React from "react";
import { CircleAlert, CircleCheck, CirclePause, PenLine } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { CategoryChoice } from "./CategoryChoice";
import { PassSteps, stepsFor } from "./PassSteps";
import { OnboardingPanel } from "./OnboardingPanel";
import type { OnboardingState } from "./onboarding";
import type { CategoryChoiceModel } from "./remeasure";
import { formatTime } from "./format";
import type { PassEnd } from "@/lib/scan/deep/pass-end";

export function OnboardingStatus(p: {
  state: OnboardingState;
  /** Issue 837: the broader categories a market too small is offered, where
   *  the notice is that one. */
  choice?: CategoryChoiceModel | null;
  /** The site's zone, for the times the panel states (issue 1196). */
  timeZone: string;
  /** The site's setup channel, so the running panel hears the pass. */
  channel: string | null;
}): React.JSX.Element | null {
  if (p.state.kind === "none") return null;
  if (p.state.kind === "ended") return <PassEndLine end={p.state.end} timeZone={p.timeZone} />;

  if (p.state.kind === "notice") {
    return (
      <div role="status" className="alert alert-warning hidden flex-col items-start text-sm lg:grid" data-testid="shell-onboarding-notice">
        <span>{copy(p.state.key)}</span>
        {p.choice === undefined || p.choice === null ? null : <MarketChoice choice={p.choice} />}
      </div>
    );
  }

  // The rows carry their own words now (`PassSteps`), so the panel is
  // handed the step and nothing else (issue 912).
  return (
    <OnboardingPanel
      heading={copy(p.state.remeasure ? "shell.pass.remeasure-head" : "setup.waiting.head")}
      stage={p.state.stage}
      since={p.state.since}
      timeZone={p.timeZone}
      channel={p.channel}
    />
  );
}

/** Issue 1196: the one line for each way a pass ends, with the alert tone
 *  and the icon that carry it. The icon makes the state readable without
 *  colour. */
const END_LINE = {
  done: { key: "shell.pass.ended.done", tone: "alert-success", Icon: CircleCheck },
  failed: { key: "shell.pass.ended.failed", tone: "alert-error", Icon: CircleAlert },
  site_unreadable: { key: "shell.pass.ended.site-unreadable", tone: "alert-error", Icon: CircleAlert },
  time_ceiling: { key: "shell.pass.ended.time-ceiling", tone: "alert-warning", Icon: CirclePause },
  spend_ceiling: { key: "shell.pass.ended.spend-ceiling", tone: "alert-warning", Icon: CirclePause },
} as const satisfies Record<string, { key: CopyKey; tone: string; Icon: typeof CircleCheck }>;

function endLineOf(end: PassEnd): (typeof END_LINE)[keyof typeof END_LINE] {
  if (end.outcome === "done") return END_LINE.done;
  if (end.reason === "site_unreadable" || end.reason === "time_ceiling" || end.reason === "spend_ceiling") {
    return END_LINE[end.reason];
  }
  return END_LINE.failed;
}

/** Issue 1196: how the founder's newest pass ended — done, failed with its
 *  reason, or stopped with its cause — for a while after it did, in the
 *  place the running steps stood. */
export function PassEndLine(p: { end: PassEnd; timeZone: string }): React.JSX.Element {
  const { key, tone, Icon } = endLineOf(p.end);
  return (
    <div
      role="status"
      className={`alert alert-soft ${tone} hidden items-start text-sm lg:grid`}
      data-testid="shell-pass-ended"
      data-outcome={p.end.outcome}
    >
      <Icon size={20} strokeWidth={1.75} className="shrink-0" aria-hidden />
      <span className="min-w-0 wrap-anywhere">{copy(key, { time: formatTime(new Date(p.end.at), p.timeZone) })}</span>
    </div>
  );
}

/**
 * SPEC §4 (2026-09-20), issue 912 — the first day after setup, in the
 * hero.
 *
 * "First day after setup: Overview shows the pass's named steps (done / now
 * / next) in the hero and skeletons for the week; it fills in when the pass
 * ends."
 *
 * Three things, in the order a founder needs them: what is happening, how
 * far along it is, and what they have to do about it (nothing). The steps
 * are `PassSteps`, the shell panel's own, so the card and the panel beside
 * it cannot name two different steps for one pass.
 */
export function FirstPageNotice(p: { state: OnboardingState }): React.JSX.Element | null {
  if (p.state.kind !== "running") return null;
  return (
    <section
      role="status"
      className="card card-border bg-base-100 min-w-0"
      data-testid="first-page-notice"
    >
      <div className="card-body min-w-0 gap-3">
        <h2 className="flex min-w-0 items-center gap-2 card-title text-base">
          <PenLine size={20} strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 wrap-anywhere">{copy("shell.onboarding.first-page")}</span>
        </h2>
        <p className="min-w-0 text-sm wrap-anywhere" data-testid="first-page-choosing">
          {copy("overview.first-day.choosing")}
        </p>
        <PassSteps steps={stepsFor(p.state.stage)} />
        {/* What happens next, and that nothing goes live without them —
            the sentence that makes the wait bearable rather than a screen
            to sit and watch. */}
        <p className="min-w-0 text-sm text-base-content/70 wrap-anywhere" data-testid="first-page-mail">
          {copy("overview.first-day.mail")}
        </p>
      </div>
    </section>
  );
}

/** Issue 837: the choice a market too small offers — broader categories and
 *  the founder's own words, each measuring the market again now. The words
 *  are written here; `CategoryChoice` only sends the press. */
function MarketChoice(p: { choice: CategoryChoiceModel }): React.JSX.Element {
  return (
    <CategoryChoice
      suggestions={p.choice.suggestions}
      words={{
        suggested: copy("setup.remeasure.suggested"),
        own: copy("setup.remeasure.own"),
        submit: copy("setup.remeasure.submit"),
      }}
    />
  );
}

/** Overview's release notice (issue 784) — `overviewNotice`'s key, or nothing. */
export function ReleaseNoticeLine(p: { noticeKey: CopyKey | null }): React.JSX.Element | null {
  if (p.noticeKey === null) return null;
  return (
    <div role="status" className="alert alert-warning items-start text-sm" data-testid="overview-release-notice">
      {copy(p.noticeKey)}
    </div>
  );
}
