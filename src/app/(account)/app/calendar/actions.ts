// BUILD §4.6 — "stage-appropriate actions (review → *Read the full page* +
// Move/Veto; live → *View live page*; needs-you → *Reconnect*; planned →
// Move/Skip)".
//
// REQ-043 criterion 9: "every action it offers can be carried out in that
// page's current stage, and no action is offered that would be refused
// because of that stage." The way to keep that promise is to **project the
// actions from the transition table** rather than hand-listing them per
// stage — a hand-list is a second copy of the state machine, and the two
// drift the first time an edge changes.
//
// `TRANSITIONS` is BUILD §9's state machine transcribed. It is on loan from
// `src/lib/publish/` (issue #45) for the same reason `PublishState` is —
// see `stages.ts`'s header. When #45 lands, this table is deleted and
// imported; the projection below is unchanged, because it reads the table
// and never the state names.
import type { CopyKey } from "@/lib/presentation/copy";
import type { DayCell } from "./month";
import type { PublishingCommand } from "./publishing";
import { PUBLISH_STATES, type PublishState } from "./stages";

/**
 * BUILD §9's state machine, verbatim:
 *
 *     planned → generating → in_review → approved → publishing → published
 *                               ↓ veto                  ↓ fail
 *                            skipped            failed → retry ×3 → needs_attention
 *     published → unpublished (always available)
 *
 * Two edges the diagram implies rather than draws, each stated with its
 * source: `planned → skipped`, because §4.6 offers **Skip** on a planned
 * page and there is no other state for a page taken off its date; and
 * `needs_attention → publishing`, because §9 makes an expired credential "a
 * **state** (reconnect prompt, queue holds), not an error loop" — the queue
 * that holds resumes into the publish it was holding.
 */
export const TRANSITIONS: Readonly<Record<PublishState, readonly PublishState[]>> = Object.freeze({
  planned: Object.freeze(["generating", "skipped"] as const),
  generating: Object.freeze(["in_review", "skipped"] as const),
  in_review: Object.freeze(["approved", "skipped"] as const),
  approved: Object.freeze(["publishing"] as const),
  publishing: Object.freeze(["published", "failed"] as const),
  published: Object.freeze(["unpublished"] as const),
  failed: Object.freeze(["publishing", "needs_attention"] as const),
  needs_attention: Object.freeze(["publishing"] as const),
  skipped: Object.freeze([] as const),
  unpublished: Object.freeze([] as const),
});

/**
 * The word the one `→ skipped` edge is offered under, at each tail that
 * has it. BUILD §9 labels the edge out of `in_review` "veto"; §4.6 calls
 * the same edge out of a planned page "Skip". One edge, two promises, and
 * the customer is owed the word that matches what they are doing.
 *
 * Total over the ten states so a new state cannot arrive without an answer,
 * and coupled to `TRANSITIONS` by test: an entry is non-null exactly where
 * the state has the `skipped` edge, which is what makes this a projection
 * rather than a second list.
 */
export const STOP_COMMAND: Readonly<Record<PublishState, PublishingCommand | null>> = Object.freeze({
  planned: "skip",
  generating: "skip",
  in_review: "veto",
  approved: null,
  publishing: null,
  published: null,
  failed: null,
  needs_attention: null,
  skipped: null,
  unpublished: null,
});

const STOP_COPY_KEY: Record<PublishingCommand, CopyKey> = {
  move: "calendar.action.move",
  skip: "calendar.action.skip",
  veto: "calendar.action.veto",
};

/** A control the panel offers. Two arms and no third: a link goes
 *  somewhere, a command writes something. Neither carries a sentence — the
 *  `key` is read through `copy()` by whatever renders it. */
export type DayAction =
  | { key: CopyKey; kind: "link"; href: string }
  | { key: CopyKey; kind: "command"; command: PublishingCommand };

/** Issue #17's draft view — ARCHITECTURE's `/app/draft/{id}`. */
export function draftHref(draftId: string): string {
  return `/app/draft/${draftId}`;
}

/**
 * The actions a day earns, projected from its page's state.
 *
 * An empty day's projection is empty **by construction** — there is no page
 * to read a state from, so there is no filter to forget (REQ-043 c11: an
 * empty day "offers no action that would publish or approve a page").
 */
export function actionsFor(cell: DayCell): readonly DayAction[] {
  const page = cell.page;
  if (page === null) return [];

  const actions: DayAction[] = [];

  // review → "Read the full page" (§4.6). The draft view is where a page is
  // read whole; the stage that asks the customer to judge one is the stage
  // that gets the way in.
  if (page.stage === "your_review") {
    actions.push({
      key: "calendar.action.read-full-page",
      kind: "link",
      href: draftHref(page.draftId),
    });
  }

  // live → "View live page". Offered from the recorded address and only
  // where there is one: a page ReachKit has not delivered has no public
  // address to offer, and an address is never invented for it.
  if (page.stage === "live" && page.liveUrl !== null) {
    actions.push({ key: "calendar.action.view-live-page", kind: "link", href: page.liveUrl });
  }

  // needs-you → "Reconnect" (§9: "expired credential is a **state**
  // (reconnect prompt, queue holds)"). The destination lives in Settings.
  if (page.stage === "needs_you") {
    actions.push({ key: "calendar.action.reconnect", kind: "link", href: "/app/settings" });
  }

  // Move, and the one `→ skipped` edge under its own word. Both are
  // offered exactly where that edge is open — a page that can still be
  // stopped is a page that has not gone out, which is the same condition
  // §4.6 offers Move under, read off the table instead of restated.
  const stop = STOP_COMMAND[page.state];
  if (TRANSITIONS[page.state].includes("skipped") && stop !== null) {
    actions.push({ key: STOP_COPY_KEY.move, kind: "command", command: "move" });
    actions.push({ key: STOP_COPY_KEY[stop], kind: "command", command: stop });
  }

  return actions;
}

/** Exported for the test that couples `STOP_COMMAND` to `TRANSITIONS`; no
 *  renderer reads it. */
export const STATES_WITH_STOP_EDGE: readonly PublishState[] = PUBLISH_STATES.filter((s) =>
  TRANSITIONS[s].includes("skipped")
);
