// BUILD §4.3 — what the waiting screen is told, and what it is never told.
//
// "While the deep pass runs: progress screen; on completion straight to the
// app with the first draft already in the calendar. A degraded pass still
// releases setup (zero proposals is legal, never faked)." (§4.3)
//
// The union has two arms, and since #356 the running one carries the
// instant each stage began (`sites.setup_stage_times`) — because UI-SPEC
// S11 draws a finished row's elapsed time and a duration the screen
// composed from its own clock would be how long a tab was open rather than
// how long the work took. What it still does not carry is an estimate, a
// countdown, a clock or a percentage, and the running row states a dash:
// nothing on this screen ticks.
//
// `StageName` is imported **type-only** from `src/lib/scan/stages.ts` on
// purpose: that module reaches for `dbAdmin()` at its top level, and a
// type-only import is erased before any bundle exists, so the waiting
// screen's client half carries no database client. The ordered list of
// stages the screen renders is passed down from the server as data.
import type { DeepPassProgress } from "@/lib/scan/deep/progress";

/** The engine's own shape, not a second copy of it (issue #36):
 *  `src/lib/scan/deep/progress.ts` builds this frame from the founder's
 *  row and the release latch, and this alias is what the two surfaces and
 *  the adapter call it. A type-only import, so the module behind it — and
 *  its database client — never reaches the client bundle. */
export type PassProgress = DeepPassProgress;

/** The engine's stage handles are no longer one-to-one with the rows this
 *  screen draws (issue #356). UI-SPEC S11 names five rows and the engine
 *  reports six handles, so the mapping — and the copy key per row — lives
 *  in `./stages.ts`, which also states why rows four and five hold no
 *  handle at all. `STAGE_COPY_KEY` and `WAITING_STAGES` are gone: a key
 *  per handle described a screen that drew six unwritten rows. */
