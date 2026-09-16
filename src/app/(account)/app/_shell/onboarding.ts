// SPEC §5 — onboarding in the background (issue #782).
//
// Finishing setup lands the founder in `/app` while the deep pass and the
// first draft run as a job. The shell's side panel says which step is under
// way until the pass releases them, and then — for a pass whose market was
// too small, or that did not complete — the founder's reason in its place.
//
// `onboardingPanel` is pure: the pass's progress and its release notice in,
// one state out. `readOnboarding` is the one request-cached read behind it;
// the same `passProgressFor` read `GET /api/setup/progress` answers from,
// which is what the panel polls once it is on screen.
import { cache } from "react";
import type { CopyKey } from "@/lib/presentation/copy";
import type { DeepPassProgress, OnboardingStage } from "@/lib/scan/deep/progress";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { readShell } from "./provider";

export type OnboardingState =
  | { kind: "running"; stage: OnboardingStage }
  | { kind: "notice"; key: CopyKey }
  | { kind: "none" };

/** The release notices the panel states in place of the stage: the founder
 *  is owed a reason their app is empty. A pass that fell short in places is
 *  the Overview's to mark section by section, not the panel's. */
const PANEL_NOTICES: readonly CopyKey[] = Object.freeze([
  "setup.release.market-too-small",
  "setup.release.incomplete",
]);

export function onboardingPanel(a: {
  progress: DeepPassProgress;
  /** `releaseNotice()`'s answer. Only its key is read; the type is not
   *  imported, so this screen's module graph stays off the report reader. */
  notice: { readonly key: CopyKey } | null;
  /** Before the first weekly pass. Once a week is counted the onboarding
   *  pass is not the measurement the app stands on, and its notice is not
   *  this panel's to repeat. */
  weekZero: boolean;
}): OnboardingState {
  if (a.progress.running) return { kind: "running", stage: a.progress.stage };
  if (a.weekZero && a.notice !== null && PANEL_NOTICES.includes(a.notice.key)) {
    return { kind: "notice", key: a.notice.key };
  }
  return { kind: "none" };
}

export const readOnboarding = cache(async function readOnboarding(): Promise<OnboardingState> {
  const account = await requireSetUpAccount();
  if (isReservedFixtureAccount(account)) return { kind: "none" };

  // Imported at the call: both reach `@/lib/db` (`provider.ts`'s reason).
  const { passProgressFor } = await import("@/lib/scan/deep/progress");
  const progress = await passProgressFor(account.siteId);
  if (progress.running) return onboardingPanel({ progress, notice: null, weekZero: true });

  const shell = await readShell();
  const weekZero = shell.weeks.kind !== "counted";
  if (!weekZero) return { kind: "none" };
  const { releaseNotice } = await import("@/lib/scan/deep/notice");
  return onboardingPanel({ progress, notice: await releaseNotice({ domain: account.domain }), weekZero });
});
