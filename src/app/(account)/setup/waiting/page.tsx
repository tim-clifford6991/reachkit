// §5 — the waiting screen: which step, never how long.
//
// "While the deep pass runs: progress screen; on completion straight to the
// app with the first draft already in the calendar. A degraded pass still
// releases setup (zero proposals is legal, never faked)."
//
// A server component that reads the pass once and hands it down; the client
// half subscribes for the rest.
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
// elapsed, an estimate, a countdown, a clock or a percentage.
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
import { Card } from "@/ui/components";
import { readPassProgress } from "../_setup/provider";
import { ProgressStrip, type SetupPhase } from "../_setup/ProgressStrip";
import { STAGES } from "@/lib/scan/stages";
import { drawnStages, ROW_COPY_KEY } from "../_setup/stages";
import { destinationFor } from "./release";
import { Waiting } from "./Waiting";

/* The screen in token utilities on the registered `Card`: no class of this
 * screen's own, and no stylesheet (`docs/DESIGN.md`, "What is retired"). */
const SCREEN = "grid content-start gap-(--s-4) p-(--s-4)";
/** The card head the artboard draws: a 20px glyph and its eyebrow, quiet. */
const HEAD = "flex min-w-0 items-center gap-(--s-2) text-(color:--ink-3)";
const EYEBROW = "eyebrow font-bold tracking-[0.1em]";
/** The two lines under the rows: 13px in the second ink. */
const LINE = "text-(length:--t-sm) text-(color:--ink-2)";

export default async function WaitingPage(): Promise<React.JSX.Element> {
  const progress = await readPassProgress();

  const destination = destinationFor(progress);
  if (destination !== null) redirect(destination);

  // Narrowed by `destinationFor`: a pass that is not running has already
  // redirected, so this arm is the running one.
  //
  // The five rows S11 draws, each with its state and — where the pass
  // recorded both ends of it — its elapsed time. Written here, on the
  // server, so the client half resolves no registry key and holds no copy
  // of the mapping (`Waiting.tsx`'s own rule).
  const rows = drawnStages(
    progress.running ? progress : { stage: FIRST_STAGE, enteredAt: {} }
  ).map((drawn) => ({
    id: drawn.row,
    label: copy(ROW_COPY_KEY[drawn.row]),
    state: drawn.state,
    time:
      drawn.state === "current"
        ? copy("setup.waiting.stage.running")
        : drawn.seconds === null
          ? null
          : copy("setup.waiting.stage.elapsed", { seconds: drawn.seconds }),
  }));

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className={SCREEN}>
        {/* UI-SPEC S11: the same strip, one phase on. Setup is behind them
            and the first page is what is running. */}
        <ProgressStrip current={PHASE} />
        <h1>{copy("setup.waiting.head")}</h1>
        {/* The set draws the stages inside a card, with the two lines
            under them — so the founder reads what is happening and what
            happens next in one box, rather than a bare list on the page. */}
        <section data-testid={WAITING_CARD_TEST_ID}>
          <Card
            state="default"
            title={
              <span className={HEAD}>
                <Sparkles aria-hidden size={ICON} strokeWidth={STROKE} />
                <span className={EYEBROW}>{copy("setup.progress.first-page")}</span>
              </span>
            }
          >
            <Waiting rows={rows} />
            {/* REQ-025 c1 as the approved set amends it: one sentence, and
                the promise that matters more than the clock — a pass that
                finds nothing worth writing says so. */}
            <p className={LINE} data-testid="setup-waiting-about">
              {copy("setup.waiting.about")}
            </p>
          </Card>
        </section>
        <p className={`${LINE} text-center`} data-testid="setup-waiting-close-tab">
          {copy("setup.waiting.close-tab")}
        </p>
      </main>
    </Surface>
  );
}

/** The head's glyph, at the artboard's size and the design system's stroke
 *  (`docs/DESIGN.md`, "Components": lucide, 20px in chrome, stroke 1.75). */
const ICON = 20;
const STROKE = 1.75;

/** The stage a pass that recorded none stands at. `passProgressFor` makes
 *  the same substitution for the same reason: "which step is under way"
 *  has no honest empty value, and a bare spinner is what REQ-029 c1
 *  forbids. */
const FIRST_STAGE = STAGES[0]!;

/** Bound to names before they reach JSX — the copy sweep's rule. Neither is
 *  a word anyone reads: one is a phase handle, one a test hook. */
const PHASE: SetupPhase = "first-page";
const WAITING_CARD_TEST_ID = "setup-waiting-card";
