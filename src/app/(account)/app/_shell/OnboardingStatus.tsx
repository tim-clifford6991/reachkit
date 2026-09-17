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
import { DRAWN_ROWS, ROW_COPY_KEY, type DrawnRow } from "@/app/(account)/setup/_setup/stages";
import { CategoryChoice } from "./CategoryChoice";
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

  const labels = Object.fromEntries(
    DRAWN_ROWS.map((row) => [row, copy(ROW_COPY_KEY[row])])
  ) as Record<DrawnRow, string>;
  return <OnboardingPanel heading={copy("setup.waiting.head")} stage={p.state.stage} labels={labels} />;
}

export function FirstPageNotice(p: { state: OnboardingState }): React.JSX.Element | null {
  if (p.state.kind !== "running") return null;
  return (
    <div role="status" className="alert items-start" data-testid="first-page-notice">
      <PenLine size={20} strokeWidth={1.75} aria-hidden />
      <span>{copy("shell.onboarding.first-page")}</span>
    </div>
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
