// BUILD §4.6 — "Stage = chip color", and REQ-043 criterion 2's five stages.
//
// The ten publish states BUILD.md §9 draws as one state machine, mapped
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

/** The daisyUI badge modifier each `Tone` wears on the calendar and the
 *  draft view. Every badge still carries its word beside the colour. */
export const TONE_BADGE: Readonly<Record<Tone, string>> = Object.freeze({
  accent: "badge-primary",
  ok: "badge-success",
  warn: "badge-warning",
  bad: "badge-error",
  neutral: "badge-ghost",
});

/** §9's ten, re-exported under the machine's own name so a reader of this
 *  module can see the set the projection is total over without following a
 *  second import. It is the machine's array — not a copy, not a re-listing
 *  — so there is one place a state is added. */
export { STATES };
export type { State };

/**
 * The stage as a day card draws it: a coloured dot and its word (SPEC §7,
 * 2026-09-20, #908; issue 930).
 *
 * **Not a `badge`, and that is the fix for #944.** A daisyUI `badge`
 * carries its own horizontal padding and `badge-sm` does not shrink below
 * its text, so a stage word inside a `minmax(0, 1fr)` column pushed its own
 * box past the cell's edge at 768 and at 1280 — the containment offender
 * that pass reported, in both themes. A dot is a fixed 6px square that
 * cannot shrink and does not need to; the word beside it is ordinary text
 * in a `truncate` row, so the pair narrows with the column instead of
 * standing its ground against it.
 *
 * The word is still there beside the colour, at every width: §2.5's
 * words-not-colour rule is what the dot is *added to*, never a substitute
 * for it.
 *
 * Both maps are total over `Tone`. The reachkit theme has no `neutral`
 * slot, so the neutral arm is drawn from `base-content` at an opacity
 * rather than from a colour that paints nothing.
 */
export const TONE_DOT: Readonly<Record<Tone, string>> = Object.freeze({
  accent: "bg-primary",
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-error",
  neutral: "bg-base-content/40",
});

/**
 * The one loop in the product (`docs/DESIGN.md`, *The calm layer*,
 * "Motion", #1065): a soft 2.4s pulse on the *Live* and *Your review* dots —
 * the two stages where something is happening on the customer's domain or
 * waiting on them. A ring of the dot's own colour widens and fades behind
 * it; the dot itself does not move. It runs only under `motion-safe`, and
 * the ring rests at `opacity-0`, so under reduced motion the dot is drawn
 * still. Whole class names, for the reason `STAGE_MARK_AT` gives.
 */
const BEACON =
  "relative after:absolute after:inset-0 after:rounded-full after:bg-inherit after:opacity-0 motion-safe:after:animate-beacon";

export const STAGE_BEACON: Readonly<Record<Stage, string>> = Object.freeze({
  live: BEACON,
  your_review: BEACON,
  scheduled: "",
  planned: "",
  needs_you: "",
});

export const TONE_INK: Readonly<Record<Tone, string>> = Object.freeze({
  accent: "text-primary",
  ok: "text-success",
  warn: "text-warning",
  bad: "text-error",
  neutral: "text-base-content/70",
});

/**
 * **The update mark yields before the stage word does** (owner, PR #961).
 *
 * A stage word is never truncated: "Yourre…" and "Sched…" are not words,
 * and a card that cannot hold one is a card with something else on it that
 * should go first. What goes first is the mark for an update — the day
 * panel already says *Update* in full, so nothing is lost by a narrow card
 * dropping the glyph.
 *
 * So the word takes its own width (`shrink-0`, no clamp) and the mark is
 * shown only on a card wide enough to hold **that stage's** word beside it.
 * One threshold for all five would be wrong in both directions: it would
 * hide the mark on a `Live` card, which has 41px to spare at the narrowest
 * width this grid is ever drawn at, and show it on a `Your review` card,
 * which has none.
 *
 * Each number is the card's **content width** — what a container query
 * resolves against — and is measured rather than guessed:
 *
 *     6px dot + 4px gap + the word + 8px gap + 12px mark + 4px to spare
 *
 * over the words as Plus Jakarta Sans 600 draws them at 11px (Live 22,
 * Planned 44, Needs you 57, Scheduled 59, Your review 63).
 *
 * **A wrong number here is caught rather than trusted.** Both the word and
 * the mark are `shrink-0`, so if a threshold is too low the *mark* is what
 * runs past the row, and the no-overflow pass reports it as a containment
 * offender — the word is never the thing that gives.
 *
 * Written as whole class names because Tailwind finds a utility by reading
 * the source text for it: a class built from a variable is a class that is
 * never emitted.
 */
export const STAGE_MARK_AT: Readonly<Record<Stage, string>> = Object.freeze({
  live: "@min-[56px]/day:block",
  planned: "@min-[80px]/day:block",
  needs_you: "@min-[92px]/day:block",
  scheduled: "@min-[96px]/day:block",
  your_review: "@min-[100px]/day:block",
});
