// BUILD §4.3 — the waiting screen: which step, never how long.
//
// "While the deep pass runs: progress screen; on completion straight to the
// app with the first draft already in the calendar. A degraded pass still
// releases setup (zero proposals is legal, never faked)." (§4.3)
//
// The archived plan is WO-153. A server component that reads the pass once
// and hands it down; the client half subscribes for the rest.
//
// **One sentence states a duration, and no stage does** (issue #356). The
// owner ruled on 2026-09-06 that REQ-025 c1 wins and this screen stated no
// duration at all; the approved screen set (2026-09-08) draws "About three
// minutes…" in the stage card, ruling 11a makes it copy as written, and the
// newer artifact decides it. So the card carries that one written line.
//
// What has not changed is the **per-stage** silence, and it is still
// structural rather than reviewed: `PassProgress` carries a stage or an
// ending and has no member a time could arrive in, so no step can show an
// elapsed, an estimate, a countdown, a clock or a percentage. The set draws
// an elapsed time beside each stage; that needs a reading the engine does
// not take, and the PR says so.
//
// A founder who arrives after the pass has ended is released straight into
// the app, degraded or not; that decision is `release.ts`'s pure function,
// so the redirect matrix is decided by a test rather than by reading this
// file.
import type React from "react";
import { redirect } from "next/navigation";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { Sparkles } from "lucide-react";
import { CardHead, IdiomCard } from "@/ui/idiom";
import { readPassProgress } from "../_setup/provider";
import { ProgressStrip, type SetupPhase } from "../_setup/ProgressStrip";
import { STAGE_COPY_KEY, WAITING_STAGES } from "../_setup/progress";
import { destinationFor } from "./release";
import { Waiting } from "./Waiting";

export default async function WaitingPage(): Promise<React.JSX.Element> {
  const progress = await readPassProgress();

  const destination = destinationFor(progress);
  if (destination !== null) redirect(destination);

  // Narrowed by `destinationFor`: a pass that is not running has already
  // redirected, so this arm is the running one.
  const stage = progress.running ? progress.stage : WAITING_STAGES[0]!;

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="grid content-start gap-4 p-4">
        {/* UI-SPEC S11: the same strip, one phase on. Setup is behind them
            and the first page is what is running. */}
        <ProgressStrip current={PHASE} />
        <h1>{copy("setup.waiting.head")}</h1>
        {/* The set draws the stages inside a card, with the two lines
            under them — so the founder reads what is happening and what
            happens next in one box, rather than a bare list on the page. */}
        <IdiomCard
          head={
            <CardHead
              icon={<Sparkles aria-hidden size={ICON} />}
              eyebrow={copy("setup.progress.first-page")}
            />
          }
          testId={WAITING_CARD_TEST_ID}
        >
          <Waiting
            stage={stage}
            steps={WAITING_STAGES.map((name) => ({ id: name, label: copy(STAGE_COPY_KEY[name]) }))}
          />
          {/* REQ-025 c1 as the approved set amends it: one sentence, and
              the promise that matters more than the clock — a pass that
              finds nothing worth writing says so. */}
          <p className="rk-quiet" data-testid="setup-waiting-about">
            {copy("setup.waiting.about")}
          </p>
        </IdiomCard>
        <p className="rk-quiet" style={CENTRED} data-testid="setup-waiting-close-tab">
          {copy("setup.waiting.close-tab")}
        </p>
      </main>
    </Surface>
  );
}

/** The chip's glyph size — 14px inside `.rk-head-chip`'s 32px square. */
const ICON = 14;

const CENTRED: React.CSSProperties = { textAlign: "center" };

/** Bound to names before they reach JSX — the copy sweep's rule. Neither is
 *  a word anyone reads: one is a phase handle, one a test hook. */
const PHASE: SetupPhase = "first-page";
const WAITING_CARD_TEST_ID = "setup-waiting-card";
