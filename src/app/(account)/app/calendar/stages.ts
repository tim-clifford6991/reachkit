// BUILD §4.6 — "Stage = chip color", and REQ-043 criterion 2's five stages.
//
// The ten publish states SPEC.md §9 draws as one state machine, mapped
// onto the five stages §4.6's filter cards name, by one total table. The
// mapping is REQ-043's own non-goal handed here ("which publish state is
// shown as which of criterion 2's stages — the exhaustive mapping is the
// blueprint's"), and WO-164 is where it was worked out.
//
// **The state set is no longer on loan** (issue #198). It was declared here
// while §9's machine did not exist (issue #45); #45 landed it at
// `src/lib/publish/types.ts` (`State`) and `src/lib/publish/machine/table.ts`
// (`STATES`), and #175 now feeds real §9 states through this table. So this
// module declares no state union of its own and imports the machine's,
// exactly as `actions.ts` imports its `TRANSITIONS` — one set, one home, and
// nothing here to drift the day §9 gains a member. What this module still
// owns is the *projection*: five stages, and which state is shown as which.
import type { CopyKey } from "@/lib/presentation/copy";
import { STATES } from "@/lib/publish/machine/table";
import type { State } from "@/lib/publish/types";
import type { Tone } from "@/ui/types";

/** REQ-043 criterion 2's five stages. Closed — a sixth is a requirement
 *  change, not a new member. */
export const STAGES = ["live", "your_review", "scheduled", "planned", "needs_you"] as const;
export type Stage = (typeof STAGES)[number];

/** The filter cards BUILD §4.6 names: "All/Live/Your review/Scheduled/
 *  Planned/Needs you". `all` is a filter and never a stage, which is why it
 *  is a separate tuple rather than a sixth `Stage`. */
export const STAGE_FILTERS = ["all", ...STAGES] as const;
export type StageFilter = (typeof STAGE_FILTERS)[number];

/**
 * The exhaustive map from the ten states. Total over the union by
 * construction — `Record<State, …>` makes a new state a compile error here
 * rather than a page that renders with no stage (REQ-043 c2: "no page
 * renders without a stage"), and the union is §9's own, so a state added to
 * the machine fails here on the day it is added.
 *
 * `null` means the state occupies no date at all: REQ-043 criterion 4 names
 * "a page that can no longer go live" as a cause that *empties* a date, so
 * `skipped` and `unpublished` hand their date to `accountFor` instead of
 * carrying a page on it.
 *
 * `failed` maps to `scheduled`, not to `needs_you`: BUILD §9 puts a failed
 * publish "back in the queue with a written reason" and retries it three
 * times, so it is still on its way out; `needs_attention` — the state after
 * those retries are spent — is the only state that asks the customer for
 * anything, and so the only one mapping to `needs_you`.
 */
export const STAGE_OF: Readonly<Record<State, Stage | null>> = Object.freeze({
  planned: "planned",
  generating: "planned",
  in_review: "your_review",
  approved: "scheduled",
  publishing: "scheduled",
  failed: "scheduled",
  needs_attention: "needs_you",
  published: "live",
  skipped: null,
  unpublished: null,
});

/** The word each filter is spoken from. Every one is a transcription of a
 *  word SPEC.md §4.6 itself prints — no renderer writes a stage's name. */
export const STAGE_FILTER_COPY_KEY: Record<StageFilter, CopyKey> = {
  all: "calendar.stage.all",
  live: "calendar.stage.live",
  your_review: "calendar.stage.your-review",
  scheduled: "calendar.stage.scheduled",
  planned: "calendar.stage.planned",
  needs_you: "calendar.stage.needs-you",
};

/** §4.6: "Stage = chip colour." Five stages, five distinct `Tone`s, so the
 *  chip is never colour-alone-ambiguous between two stages — and every chip
 *  still carries its word (`Badge` requires a text child), because §2.5's
 *  words-not-colour rule holds whatever the tone is. */
export const STAGE_TONE: Record<Stage, Tone> = {
  live: "ok",
  your_review: "warn",
  scheduled: "accent",
  planned: "neutral",
  needs_you: "bad",
};

/** §9's ten, re-exported under the machine's own name so a reader of this
 *  module can see the set the projection is total over without following a
 *  second import. It is the machine's array — not a copy, not a re-listing
 *  — so there is one place a state is added. */
export { STATES };
export type { State };
