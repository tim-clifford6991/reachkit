// BUILD §4.3 — what the waiting screen is told, and what it is never told.
//
// "While the deep pass runs: progress screen; on completion straight to the
// app with the first draft already in the calendar. A degraded pass still
// releases setup (zero proposals is legal, never faked)." (§4.3)
//
// The union has exactly two arms and neither carries a time: no elapsed,
// no estimate, no countdown, no clock, no percentage. That is the shape,
// not a rendering convention — a screen cannot show a duration it was
// never given.
//
// `StageName` is imported **type-only** from `src/lib/scan/stages.ts` on
// purpose: that module reaches for `dbAdmin()` at its top level, and a
// type-only import is erased before any bundle exists, so the waiting
// screen's client half carries no database client. The ordered list of
// stages the screen renders is passed down from the server as data.
import type { StageName } from "@/lib/scan/stages";
import type { DeepPassProgress } from "@/lib/scan/deep/progress";

/** The engine's own shape, not a second copy of it (issue #36):
 *  `src/lib/scan/deep/progress.ts` builds this frame from the founder's
 *  row and the release latch, and this alias is what the two surfaces and
 *  the adapter call it. A type-only import, so the module behind it — and
 *  its database client — never reaches the client bundle. */
export type PassProgress = DeepPassProgress;

/** One copy key per stage — which step is under way, in written words
 *  rather than a bare spinner (REQ-029 c1). */
export const STAGE_COPY_KEY = {
  reading_your_site: "setup.waiting.stage.reading_your_site",
  reading_access_rules: "setup.waiting.stage.reading_access_rules",
  reading_your_market: "setup.waiting.stage.reading_your_market",
  checking_your_presence: "setup.waiting.stage.checking_your_presence",
  asking_the_twelve: "setup.waiting.stage.asking_the_twelve",
  scoring: "setup.waiting.stage.scoring",
} as const satisfies Record<StageName, string>;

/** The stages in the order the pass runs them, derived from the key order
 *  of the map above so the two cannot diverge.
 *
 *  This is deliberately **not** a re-export of `STAGES` from
 *  `src/lib/scan/stages.ts`: that is a value export from a module which
 *  imports `dbAdmin()` at its top level, so importing it here would pull a
 *  database client into every consumer of this screen — including the
 *  client bundle. `tests/app/setup/waiting.test.tsx` asserts this list is
 *  exactly `STAGES`, in the same order, so the derivation is checked
 *  rather than trusted. */
export const WAITING_STAGES: readonly StageName[] = Object.freeze(
  Object.keys(STAGE_COPY_KEY) as StageName[]
);
