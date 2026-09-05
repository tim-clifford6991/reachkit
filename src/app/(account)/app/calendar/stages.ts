// BUILD §4.6 — "Stage = chip color", and REQ-043 criterion 2's five stages.
//
// The ten publish states BUILD.md §9 draws as one state machine, mapped
// onto the five stages §4.6's filter cards name, by one total table. The
// mapping is REQ-043's own non-goal handed here ("which publish state is
// shown as which of criterion 2's stages — the exhaustive mapping is the
// blueprint's"), and WO-164 is where it was worked out.
//
// **`PublishState` is declared here, and it is on loan.** §9's state
// machine and its transition table belong to `src/lib/publish/` (issue
// #45), which does not exist yet; this calendar is built on fixture data
// behind a typed provider, so the shape it reads is declared at the seam
// that reads it. When #45 lands, this union and `TRANSITIONS` in
// `actions.ts` are deleted and imported from there — the names are already
// the spec's own, so nothing else in this module changes.
import type { CopyKey } from "@/lib/presentation/copy";
import type { Tone } from "@/ui/types";

/** BUILD §9's state machine, verbatim: `planned → generating → in_review →
 *  approved → publishing → published`, with `↓ veto → skipped`, `↓ fail →
 *  failed → retry ×3 → needs_attention`, and `published → unpublished`.
 *  Ten members, closed. */
export const PUBLISH_STATES = [
  "planned",
  "generating",
  "in_review",
  "approved",
  "publishing",
  "published",
  "skipped",
  "failed",
  "needs_attention",
  "unpublished",
] as const;
export type PublishState = (typeof PUBLISH_STATES)[number];

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
 * construction — `Record<PublishState, …>` makes a new state a compile
 * error here rather than a page that renders with no stage (REQ-043 c2:
 * "no page renders without a stage").
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
export const STAGE_OF: Readonly<Record<PublishState, Stage | null>> = Object.freeze({
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
 *  word BUILD.md §4.6 itself prints — no renderer writes a stage's name. */
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
