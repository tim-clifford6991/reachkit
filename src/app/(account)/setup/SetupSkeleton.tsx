// SPEC §5 (2026-10-07, #1327) — setup's waiting state is the step that
// arrives: the header with its step bar, the question, and the bar at the
// foot.
//
// Every region is drawn with `frame.ts`'s classes, which are the ones
// `SetupForm` draws the step with, so nothing moves when the step lands.
// Inside a region the boxes are daisyUI `skeleton`s at the heights of the
// first step, *Site*, which is where a new founder opens.
import type React from "react";
import { Surface } from "@/ui/layout";
import { Box, Waiting } from "../app/_shell/skeletons";
import { BAR, BAR_INNER, BODY, FRAME, QUESTION, QUESTION_HEAD, REGION, SETUP_ARMS } from "./frame";
import { SetupHeader } from "./SetupHeader";

export function SetupSkeleton(): React.JSX.Element {
  return (
    <Waiting className={FRAME} testId="setup-skeleton">
      <SetupHeader step={null} />
      <Surface arms={SETUP_ARMS}>
        <div className={BODY}>
          <div className={QUESTION} data-frame={REGION.columns}>
            <div className={QUESTION_HEAD}>
              <Box className="h-5 w-40" />
              <Box className="h-9 w-2/3" />
              <Box className="h-12 w-full" />
            </div>
            <Box className="h-80 w-full" />
          </div>
        </div>
      </Surface>

      <footer className={BAR}>
        <div className={BAR_INNER} data-frame={REGION.bar}>
          <Box className="ms-auto h-11 w-38" />
        </div>
      </footer>
    </Waiting>
  );
}
