// SPEC §4 (2026-09-20, #908), issue 912 — the page, while its read is in
// flight.
//
// SPEC §7 (2026-10-07, issue 1325): the shape this screen settles into, at
// every width — the page in its frame, the Decide panel, and the notes as
// the closed lines they arrive as. `shape.ts` places the three for this
// file and for `DraftScreen` alike, so the panel is under the page on a
// phone and beside it from `xl` in both.
import type React from "react";
import { Box, CardSkeleton, PageSkeleton, Waiting } from "../../_shell/skeletons";
import { NOTE } from "./ReviewCards";
import { SHAPE } from "./shape";

/** The notes a page in review most often holds. */
const NOTES = 4;

export default function DraftLoading(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4 max-md:pb-20" data-testid="draft-waiting">
      <div className={SHAPE.grid}>
        <div className={SHAPE.page}>
          <PageSkeleton />
        </div>
        <div className={SHAPE.decide}>
          <CardSkeleton testId="decide-skeleton" rows={4} />
        </div>
        <Waiting className={SHAPE.notes} testId="notes-skeleton">
          {Array.from({ length: NOTES }, (_, at) => (
            <div key={at} className={NOTE.card}>
              <div className={NOTE.pad}>
                <Box className="h-4 w-40" />
              </div>
            </div>
          ))}
        </Waiting>
      </div>
    </div>
  );
}
