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
import { OnboardingPanel } from "./OnboardingPanel";
import type { OnboardingState } from "./onboarding";

export function OnboardingStatus(p: { state: OnboardingState }): React.JSX.Element | null {
  if (p.state.kind === "none") return null;

  if (p.state.kind === "notice") {
    return (
      <div role="status" className="alert alert-warning items-start text-sm" data-testid="shell-onboarding-notice">
        {copy(p.state.key)}
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

/** Overview's release notice (#784) — `overviewNotice`'s key, or nothing. */
export function ReleaseNoticeLine(p: { noticeKey: CopyKey | null }): React.JSX.Element | null {
  if (p.noticeKey === null) return null;
  return (
    <div role="status" className="alert alert-warning items-start text-sm" data-testid="overview-release-notice">
      {copy(p.noticeKey)}
    </div>
  );
}
