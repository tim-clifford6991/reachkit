// SPEC §5 — the side panel's loading state while onboarding runs in the
// background (issue #782).
//
// A daisyUI `loading` beside the written step, never a bare spinner
// (REQ-029 c1). The server writes every word — the heading and one label per
// drawn row — and this component only picks the row the pass reports.
//
// It polls `GET /api/setup/progress` at the pinned heartbeat. While the pass
// runs it moves the label; the moment the pass is released it asks the
// router for a fresh render, so the Overview and Calendar show what the pass
// and the first draft wrote and the shell replaces this panel with nothing
// or with the founder's reason. The shell draws the panel twice (header and
// sidebar, one hidden per breakpoint); only the one on screen polls.
"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TIMING } from "@/lib/config/constants";
import type { PassProgress } from "@/app/(account)/setup/_setup/progress";
import { rowOf, type DrawnRow } from "@/app/(account)/setup/_setup/stages";
import type { OnboardingStage } from "@/lib/scan/deep/progress";

const PROGRESS_PATH = "/api/setup/progress";

export function OnboardingPanel(p: {
  heading: string;
  stage: OnboardingStage;
  labels: Readonly<Record<DrawnRow, string>>;
}): React.JSX.Element {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<OnboardingStage>(p.stage);

  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      // `offsetParent` is null while a breakpoint hides this copy.
      if (ref.current === null || ref.current.offsetParent === null) return;
      const response = await fetch(PROGRESS_PATH);
      if (!response.ok) return;
      const progress = (await response.json()) as PassProgress;
      if (cancelled) return;
      if (progress.running) setStage(progress.stage);
      else router.refresh();
    }

    const timer = setInterval(() => {
      void poll().catch(() => undefined);
    }, TIMING.progressHeartbeatS * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);

  const row = rowOf(stage);

  return (
    <div
      ref={ref}
      role="status"
      className="alert items-start text-sm"
      data-testid="shell-onboarding"
      data-stage={stage}
    >
      <span className="loading loading-spinner loading-sm" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold">{p.heading}</span>
        {row === null ? null : <span data-testid="shell-onboarding-stage">{p.labels[row]}</span>}
      </div>
    </div>
  );
}
