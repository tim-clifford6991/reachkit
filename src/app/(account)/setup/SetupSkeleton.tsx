// SPEC §5 (2026-10-07, #1327) — setup's waiting state is the step that
// arrives: the step indicator, the question, the panel under it on a phone
// and beside it from `lg`, and the bar at the foot.
//
// Every region is drawn with `frame.ts`'s classes, which are the ones
// `SetupForm` and `SetupPanel` draw the step with, so nothing moves when
// the step lands. Inside a region the boxes are daisyUI `skeleton`s at the
// heights of the first step, *Your site*, which is where a new founder
// opens: its question and line, its control, and the blog preview beside
// it. A founder who resumes on a later step sees that step's own height.
//
// **The one sentence here is the bar's own.** `setup.footer.line` is the
// same on all five steps and needs no read, and a box in its place would be
// one line tall where the sentence is two on a phone — the bar would grow as
// the step arrived. Everything that depends on the step or on the founder's
// site is a box.
import type React from "react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { Box, Waiting } from "../app/_shell/skeletons";
import {
  BAR,
  BAR_ACTIONS,
  BAR_INNER,
  BODY,
  COLUMNS,
  FRAME,
  PANEL,
  PANEL_BODY,
  QUESTION,
  QUESTION_HEAD,
  QUIET,
  SETUP_ARMS,
  STEPS,
} from "./frame";
import { SETUP_STEPS } from "./steps";

export function SetupSkeleton(): React.JSX.Element {
  return (
    <Waiting className={FRAME} testId="setup-skeleton">
      <Surface arms={SETUP_ARMS}>
        <div className={BODY}>
          {/* daisyUI's own `steps`, so the five columns and their height
              are the indicator's; which step is current is not known yet. */}
          <ul className={STEPS} aria-hidden>
            {SETUP_STEPS.map((id) => (
              <li key={id} className="step">
                <Box className="h-4 w-12" />
              </li>
            ))}
          </ul>

          <div className={COLUMNS}>
            <div className={QUESTION}>
              <div className={QUESTION_HEAD}>
                <Box className="h-7 w-2/3" />
                <Box className="h-15 w-full md:h-5 lg:h-10" />
              </div>
              <Box className="h-56 w-full md:h-44" />
            </div>

            <div className={PANEL}>
              <div className={PANEL_BODY}>
                <Box className="h-6 w-1/2" />
                <Box className="min-h-80 w-full grow md:min-h-72" />
              </div>
              <Box className="h-10 w-full md:h-5" />
            </div>
          </div>
        </div>
      </Surface>

      <footer className={BAR}>
        <div className={BAR_INNER}>
          <div className={BAR_ACTIONS}>
            <Box className="h-10 w-24" />
            <Box className="h-10 w-28" />
          </div>
          <p className={`text-center ${QUIET}`}>{copy("setup.footer.line")}</p>
        </div>
      </footer>
    </Waiting>
  );
}
