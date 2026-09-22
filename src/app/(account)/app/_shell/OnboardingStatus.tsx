// SPEC §5 — what the shell says about onboarding (issue #782): the running
// pass's step, the founder's reason once a thin or failed pass has released
// them, or nothing. The state is `readOnboarding`'s; this writes the words.
//
// `FirstPageNotice` is the same state on Overview and Calendar: while the
// pass and the first draft run, the screen says the first page is being
// written rather than drawing an empty app with no reason.
import type React from "react";
import { PenLine } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { CategoryChoice } from "./CategoryChoice";
import { PassSteps, stepsFor } from "./PassSteps";
import { OnboardingPanel } from "./OnboardingPanel";
import type { OnboardingState } from "./onboarding";
import type { CategoryChoiceModel } from "./remeasure";

export function OnboardingStatus(p: {
  state: OnboardingState;
  /** Issue 837: the broader categories a market too small is offered, where
   *  the notice is that one. */
  choice?: CategoryChoiceModel | null;
}): React.JSX.Element | null {
  if (p.state.kind === "none") return null;

  if (p.state.kind === "notice") {
    return (
      <div role="status" className="alert alert-warning flex-col items-start text-sm" data-testid="shell-onboarding-notice">
        <span>{copy(p.state.key)}</span>
        {p.choice === undefined || p.choice === null ? null : <MarketChoice choice={p.choice} />}
      </div>
    );
  }

  // The rows carry their own words now (`PassSteps`), so the panel is
  // handed the step and nothing else (issue 912).
  return <OnboardingPanel heading={copy("setup.waiting.head")} stage={p.state.stage} />;
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
export function MarketChoice(p: { choice: CategoryChoiceModel }): React.JSX.Element {
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
