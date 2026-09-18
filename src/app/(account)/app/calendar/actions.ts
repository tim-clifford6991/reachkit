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
// **The table is no longer on loan.** It was transcribed here while §9's
// machine did not exist (issue #45); #45 landed it at
// `src/lib/publish/machine/table.ts`, and this file now reads that one and
// declares none of its own. The projection below is unchanged — it reads
// the table and never the state names — but three of the fifteen edges
// were not in the transcription, and reconciling them changes what the
// panel offers (issue #130):
//
//  - `generating → skipped` was in the copy and is **not** in §9. The
//    transcription reasoned from §4.6's "planned → Move/Skip" plus the fact
//    that a generating page wears the *planned* chip (`stages.ts`), and
//    invented an edge to match. §9's machine is declared "exact", so §9 is
//    the side that is right and the edge goes: a page mid-generation no
//    longer offers Skip. Nothing is stranded by that — generating leads to
//    `in_review`, where the same `→ skipped` edge is open under the word
//    Veto, and no page can reach a destination without passing through it.
//  - `generating → needs_attention` (§8 rule 4: "failure = regenerate,
//    twice = needs-attention") is in §9 and was not in the copy. It opens
//    no control: the panel projects controls from the `→ skipped` edge, and
//    this edge's target is not `skipped`.
//  - `needs_attention → skipped` is in §9 (its c3 promise that no page is
//    left in a state it has no way out of) and was not in the copy. It is
//    the one edge that **adds** controls: a page in `needs_attention` now
//    offers Move and Skip beside Reconnect.
//
// `needs_attention → generating` — the customer's own restart — is the
// fourth edge the copy lacked, and it now opens a control (issue #143).
// §9 opens that edge for the customer and for no one else, and no surface
// offered it: a page in `needs_attention` could be reconnected, moved or
// skipped, and not written again, which is the one thing §9 gives the
// customer at that state.
import { TRANSITIONS, isTransition } from "@/lib/publish/machine/table";
import { waitsOnDestination } from "@/lib/publish/record/needs-you";
import type { DestinationKind } from "@/lib/publish/types";
import type { CopyKey } from "@/lib/presentation/copy";
import type { DayCell } from "./month";
import type { PublishingCommand, RestartCommand, StopCommand } from "./publishing";
import { STATES, type State } from "./stages";

/**
 * The word the one `→ skipped` edge is offered under, at each tail that
 * has it. §9 labels the edge out of `in_review` "veto"; §4.6 calls the same
 * edge out of a planned page "Skip". One edge, two promises, and the
 * customer is owed the word that matches what they are doing.
 *
 * `needs_attention` takes **Skip** and not a third word: the page never
 * went out — that is what `needs_attention` means — so stopping it is a
 * page taken off its date without publishing, which is exactly what §4.6
 * already calls Skip. Veto is reserved for its own promise, stopping a page
 * in review before its window closes.
 *
 * Total over the ten states so a new state cannot arrive without an answer,
 * and coupled to the table by test: an entry is non-null exactly where the
 * state has the `skipped` edge, which is what makes this a projection
 * rather than a second list.
 */
export const STOP_COMMAND: Readonly<Record<State, StopCommand | null>> = Object.freeze({
  planned: "skip",
  generating: null,
  in_review: "veto",
  approved: null,
  publishing: null,
  published: null,
  failed: null,
  needs_attention: "skip",
  skipped: null,
  unpublished: null,
});

/**
 * The tails at which the `→ generating` edge is offered as a control.
 *
 * **Not every tail of that edge, and the difference is a guard.** §9 gives
 * `→ generating` two tails: `planned`, which is §8's own move on the
 * morning a page is due, and `needs_attention`, which is the customer's
 * restart. The edge's guards say which is which — `customer_initiated` is
 * on the second and not the first — so the panel offers a control only
 * where a customer is the one who may take it. A projection that read the
 * edge alone would put a "write it again" control on a page nobody has
 * written yet.
 *
 * Total over the ten states, so a new state cannot arrive without an
 * answer, and coupled to the table by test: an entry is non-null only
 * where the state has the `generating` edge.
 */
export const RESTART_COMMAND: Readonly<Record<State, RestartCommand | null>> = Object.freeze({
  planned: null,
  generating: null,
  in_review: null,
  approved: null,
  publishing: null,
  published: null,
  failed: null,
  needs_attention: "regenerate",
  skipped: null,
  unpublished: null,
});

const RESTART_COPY_KEY: Record<RestartCommand, CopyKey> = {
  regenerate: "calendar.action.regenerate",
};

const STOP_COPY_KEY: Record<StopCommand, CopyKey> = {
  move: "calendar.action.move",
  skip: "calendar.action.skip",
  veto: "calendar.action.veto",
};

/** A control the panel offers. Two arms and no third: a link goes
 *  somewhere, a command writes something. Neither carries a sentence — the
 *  `key` is read through `copy()` by whatever renders it.
 *
 *  The command arm carries the draft it acts on rather than leaving the
 *  renderer to read one off the page: `PublishingInterface` writes against
 *  a draft's own row, and a planned date has no draft yet (§8 generates
 *  one on the morning it is due). Carrying it here is what makes "no
 *  control is offered that has nothing to act on" a shape instead of a
 *  check every renderer has to remember. */
export type DayAction =
  | { key: CopyKey; kind: "link"; href: string }
  | { key: CopyKey; kind: "command"; command: PublishingCommand; draftId: string };

/** What the site publishes to, as the controls need it (issue 880). */
export interface DestinationStanding {
  kind: DestinationKind;
  healthy: boolean;
}

/**
 * Whether a **reconnect** is the act this page is waiting for (issue 880).
 *
 * Three conditions, and the fault this replaces failed all three: the
 * control was offered for every page whose stage was `needs_you`.
 *
 *  - the page is waiting on **delivery** — a page the §8 rules stopped was
 *    never sent anywhere, so nothing about the destination is true of it;
 *  - the destination **carries a credential** — a hosted host has none, so
 *    there is nothing to reconnect and the WordPress sentence is not the
 *    founder's situation;
 *  - the destination is **actually broken** — a working destination is not
 *    reconnected, whatever a page that failed once is waiting on.
 *
 * A destination that carries no credential is not left silent: its own
 * control points at where the founder fixes it (`CHECK_DESTINATION`).
 */
const CREDENTIAL_KINDS: readonly DestinationKind[] = Object.freeze(["wordpress"] as const);

export function offersReconnect(a: {
  cause: Parameters<typeof waitsOnDestination>[0];
  destination: DestinationStanding | null;
}): boolean {
  if (!waitsOnDestination(a.cause)) return false;
  const destination = a.destination;
  if (destination === null) return false;
  return CREDENTIAL_KINDS.includes(destination.kind) && !destination.healthy;
}

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
export function actionsFor(
  cell: DayCell,
  /** What the site publishes to (issue 880). Absent is a page whose
   *  destination nobody read, which earns no destination control — never a
   *  reconnect offered on a guess. */
  destination: DestinationStanding | null = null
): readonly DayAction[] {
  const page = cell.page;
  if (page === null) return [];

  const actions: DayAction[] = [];

  // **A page that has been written can always be read** (issue 882, owner
  // 2026-09-18: "there is no way to view the content before it is
  // published; this must always be possible").
  //
  // §4.6 gave the way in to `your_review` alone, and that was read as a
  // property of the stage rather than of the draft: a page resting in
  // needs-you, one queued to go out and one already live all have a body on
  // file and offered no way to it — the founder was asked to judge a page
  // they could not read. The condition is the draft, not the stage.
  //
  // `generating` keeps no way in, and that is the one honest absence: the
  // row exists and its text does not, so there is nothing to read. An empty
  // day keeps none either, by construction above.
  //
  // The stage that asks for a judgement keeps its own word — "Read the full
  // page" is the sentence §4.6 gives review — and every other stage states
  // plainly that this opens the page as written.
  if (page.draftId !== null && page.state !== "generating") {
    actions.push({
      key: page.stage === "your_review" ? "calendar.action.read-full-page" : "calendar.action.read-page",
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

  // needs-you → the act that matches the cause (issue 880). §9's "expired
  // credential is a **state** (reconnect prompt, queue holds)" is about a
  // credential; it was read here as a property of the *stage*, so a page
  // the §8 hard rules stopped, on a hosted host with nothing to reconnect,
  // told the founder to reconnect WordPress.
  //
  // A page waiting on delivery points at the destination: reconnect where
  // there is a credential to renew and it is broken, and otherwise the
  // neutral control that opens where the destination is fixed. A page the
  // rules or a step stopped points at neither — the restart below is its
  // act, and the panel states the cause.
  if (waitsOnDestination(page.needsYou)) {
    actions.push({
      key: offersReconnect({ cause: page.needsYou, destination })
        ? "calendar.action.reconnect"
        : "calendar.action.check-destination",
      kind: "link",
      href: "/app/settings",
    });
  }

  // The customer's own restart — §9's `needs_attention → generating`
  // (issue #143). Three conditions, and each is a different kind of fact:
  //
  //  - the **edge** exists from this state, read off the table;
  //  - the state is one whose restart is the *customer's* to take
  //    (`RESTART_COMMAND`, which is where the `customer_initiated` guard's
  //    consequence lives);
  //  - the guard `never_entered_review` would let this page through.
  //
  // The third is why this control cannot be projected from the state
  // alone: two pages can both read `needs_attention` and only one of them
  // may be written again. REQ-043 c9 — "no action is offered that would be
  // refused" — makes that a condition on the *offer*, so a page that has
  // been read offers three controls and not four, rather than a fourth
  // that refuses when it is pressed.
  const restart = RESTART_COMMAND[page.state];
  if (
    isTransition(page.state, "generating") &&
    restart !== null &&
    !page.enteredReview &&
    page.draftId !== null
  ) {
    actions.push({
      key: RESTART_COPY_KEY[restart],
      kind: "command",
      command: restart,
      draftId: page.draftId,
    });
  }

  // Move, and the one `→ skipped` edge under its own word. Both are
  // offered exactly where that edge is open — a page that can still be
  // stopped is a page that has not gone out, which is the same condition
  // §4.6 offers Move under, read off the table instead of restated.
  //
  // A page with no draft yet offers neither: both commands write against a
  // draft's own row, and DECISIONS 2026-09-05 (#99) is the rule they are
  // held to — "a control never appears to work before its engine exists".
  const stop = STOP_COMMAND[page.state];
  const draftId = page.draftId;
  if (isTransition(page.state, "skipped") && stop !== null && draftId !== null) {
    actions.push({ key: STOP_COPY_KEY.move, kind: "command", command: "move", draftId });
    actions.push({ key: STOP_COPY_KEY[stop], kind: "command", command: stop, draftId });
  }

  return actions;
}

/** The tails of the `→ skipped` edge, read straight off the imported table
 *  rather than filtered through a second question. Exported for the test
 *  that couples `STOP_COMMAND` to it; no renderer reads it. */
export const STATES_WITH_STOP_EDGE: readonly State[] = STATES.filter((state) =>
  TRANSITIONS.some(([from, to]) => from === state && to === "skipped")
);

/** The tails of the `→ generating` edge, likewise. `RESTART_COMMAND` is a
 *  **subset** of these and not an equality: `planned` is a tail of the
 *  edge and is §8's own move, not a control (see `RESTART_COMMAND`). */
export const STATES_WITH_RESTART_EDGE: readonly State[] = STATES.filter((state) =>
  TRANSITIONS.some(([from, to]) => from === state && to === "generating")
);
