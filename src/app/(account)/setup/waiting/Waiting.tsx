// BUILD §4.3 — the running step, in written words.
//
// Renders the named stages through the registered `Steps` component, whose
// every step label is required — an unlabelled stage has no way in, which
// is what keeps this screen from becoming a bare spinner. It renders **no**
// elapsed time, estimate, countdown, clock or percentage: it is never given
// one. `Progress` is deliberately not used here; it is determinate only,
// and this pass has no honest percentage to show.
//
// It polls `GET /api/setup/progress` at the pinned heartbeat, so the
// founder is shown at least that often that the pass is still running, and
// navigates to the app the moment the pass ends — degraded or not, with no
// action from them.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Steps, type StepItem } from "@/ui/components/Steps";
import { TIMING } from "@/lib/config/constants";
import type { StageName } from "@/lib/scan/stages";
import type { PassProgress } from "../_setup/progress";
import { APP_PATH, destinationFor } from "./release";

const PROGRESS_PATH = "/api/setup/progress";

export function Waiting(p: {
  stage: StageName;
  /** The stages in order, each already resolved to its written line by the
   *  server — this component composes no sentence and reads no registry
   *  key it was not handed. */
  steps: readonly { id: StageName; label: string }[];
}): React.JSX.Element {
  const router = useRouter();
  const [stage, setStage] = useState<StageName>(p.stage);

  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      const response = await fetch(PROGRESS_PATH);
      const progress = (await response.json()) as PassProgress;
      if (cancelled) return;
      if (destinationFor(progress) !== null) {
        router.push(APP_PATH);
        return;
      }
      if (progress.running) setStage(progress.stage);
    }

    // `TIMING.progressHeartbeatS` is the pinned interval at which a
    // running pass reports itself (§6.3's stage stream). Asking at exactly
    // that cadence is what makes "the screen shows them at least once
    // every 30 seconds that the pass is still running" true by
    // construction rather than by a second, unpinned number.
    const timer = setInterval(() => {
      void poll();
    }, TIMING.progressHeartbeatS * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router]);

  const current = p.steps.findIndex((step) => step.id === stage);
  const items: StepItem[] = p.steps.map((step, index) => ({
    id: step.id,
    label: step.label,
    state: index < current ? "done" : index === current ? "active" : "pending",
  }));

  // Vertical at every width: this screen is one column at every band, and
  // six named stages in a row do not fit the 320px floor.
  return (
    <div data-testid="setup-waiting" data-stage={stage}>
      <Steps steps={items} direction="vertical" />
    </div>
  );
}
