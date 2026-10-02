// SPEC §5 — the side panel's loading state while onboarding runs in the
// background (issue #782).
//
// A daisyUI `loading` beside the written step, never a bare spinner
// (REQ-029 c1). The server writes every word — the heading and one label per
// drawn row — and this component only picks the row the pass reports.
//
// It polls `GET /api/setup/progress` at the pinned heartbeat. While the pass
// runs it moves the label; the moment the pass is released it asks the
// router for a fresh render, so the Overview and Plan show what the pass
// and the first draft wrote and the shell replaces this panel with nothing
// or with the founder's reason.
//
// **Issue #911: one panel, and therefore no `offsetParent` guard.** The
// shell used to draw its parts twice — a compact header and a sidebar, one
// hidden per breakpoint — so this component polled only when its own copy
// was the visible one, which it worked out by reading `offsetParent` on
// every tick. The shell is one drawer now and draws this panel once, so
// there is no second copy to silence: it polls whenever it is mounted,
// including while the customer has collapsed the panel to the icon rail —
// the pass ending is what releases the whole screen, not just this line.
//
// **Issue 1196: one status line, kept current, with a time.** The panel
// now also says when the current step began, listens to the site's setup
// channel (`inngest/react`, as setup's `PassStatusLine` does) so a step or
// the pass's end lands at once rather than up to a heartbeat late, and still
// polls at the heartbeat as SPEC §5's floor. When the pass ends it refreshes
// the route; the server then draws the pass's end (`PassEndLine`) in this
// panel's place, so the founder reads *done*, *failed* or *stopped* rather
// than a panel that silently disappears.

"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "inngest/react";
import { TIMING } from "@/lib/config/constants";
import { copy } from "@/lib/presentation/copy";
import type { PassProgress } from "@/app/(account)/setup/_setup/progress";
import { PassSteps, stepsFor } from "./PassSteps";
import { formatTime } from "./format";
import type { OnboardingStage } from "@/lib/scan/deep/progress";
import { DRAWN_ROWS, rowOf } from "@/app/(account)/setup/_setup/stages";

const PROGRESS_PATH = "/api/setup/progress";

/** A step's place in the pass, by the row it is drawn on — a type-only
 *  view of the stages, so no engine module reaches this bundle. */
function order(stage: OnboardingStage): number {
  const row = rowOf(stage);
  return row === null ? -1 : DRAWN_ROWS.indexOf(row);
}

/** The step a pushed message names: a handle, `null` for the pass's end, or
 *  `undefined` where nothing usable has arrived. */
function pushedStage(message: unknown): OnboardingStage | null | undefined {
  if (typeof message !== "object" || message === null) return undefined;
  const data = (message as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return undefined;
  const stage = (data as { stage?: unknown }).stage;
  if (stage === null) return null;
  if (typeof stage !== "string") return undefined;
  return rowOf(stage as OnboardingStage) === null ? undefined : (stage as OnboardingStage);
}

export function OnboardingPanel(p: {
  heading: string;
  stage: OnboardingStage;
  /** When the current step began, as the server read it. */
  since: string | null;
  timeZone: string;
  /** The site's setup channel, composed on the server; `null` where none. */
  channel: string | null;
}): React.JSX.Element {
  const router = useRouter();
  const [stage, setStage] = useState<OnboardingStage>(p.stage);
  const [since, setSince] = useState<string | null>(p.since);

  const poll = useCallback(async (): Promise<void> => {
    const response = await fetch(PROGRESS_PATH);
    if (!response.ok) return;
    const progress = (await response.json()) as PassProgress;
    if (progress.running) {
      setStage(progress.stage);
      setSince((progress.enteredAt as Readonly<Record<string, string | undefined>>)[progress.stage] ?? null);
    } else router.refresh();
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => {
      void poll().catch(() => undefined);
    }, TIMING.progressHeartbeatS * 1000);
    return () => clearInterval(timer);
  }, [poll]);

  // A stable factory: a new identity on every render would re-subscribe.
  const token = useCallback(async () => {
    const res = await fetch("/api/setup/realtime", { method: "POST" });
    return ((await res.json()) as { token: unknown }).token as never;
  }, []);
  const { messages } = useRealtime({
    channel: p.channel ?? undefined,
    topics: ["stage"],
    token,
    enabled: p.channel !== null,
  });
  // A push carries the step and no instant. The later of the pushed step
  // and the polled one is drawn (a pass only moves forward), and the time is
  // stated only while it belongs to the step drawn. A pushed `null` is the
  // pass's end: the route is re-read at once, and the server draws the end.
  const pushed = pushedStage(messages.last);
  const shown = pushed === null || pushed === undefined || order(pushed) <= order(stage) ? stage : pushed;
  const shownSince = shown === stage ? since : null;
  useEffect(() => {
    if (pushed === null) router.refresh();
  }, [pushed, router]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="alert flex-col items-start text-sm"
      data-testid="shell-onboarding"
      data-stage={shown}
    >
      <span className="font-semibold">{p.heading}</span>
      {/* **The five steps, not a spinner** (issue 912). `PassSteps` is the
          same component Overview's first-day hero draws, so the panel and
          the screen beside it cannot name two steps. */}
      <PassSteps steps={stepsFor(shown)} />
      {shownSince === null ? null : (
        <span className="text-xs text-base-content/70" data-testid="shell-onboarding-since">
          {copy("shell.pass.since", { time: formatTime(new Date(shownSince), p.timeZone) })}
        </span>
      )}
    </div>
  );
}
