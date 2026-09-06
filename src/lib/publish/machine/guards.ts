// BUILD §9 — the nine named guards, one function each.
//
// A guard answers one question about one edge and delegates every fact it
// does not own: the switch and ReachKit's own stop are `switch/index.ts`'s,
// the ceilings are `ceilings/index.ts`'s, the publishable rule and the
// telling are the veto leaf's (#46). None of them is re-implemented here —
// a second copy of a rule is the thing that drifts.
//
// Guards are evaluated lazily, in the order `GUARDS` lists them, and the
// first that fails names itself in the refusal. Laziness is not an
// optimisation: it is what keeps a move that is refused by the switch from
// counting a week of publications first.
//
// The archived plan is WO-209.
import type { Actor, DraftView, TransitionRecord } from "../types";
import { isPublishingOn, reachKitStopped } from "../switch";
import { ceilingRoom } from "../ceilings";
import { destinationWorking } from "../destinations";
import { PUBLISHABLE_RULE } from "../publishable/rule";
import type { GuardId } from "./table";

/** The draft as the machine reads it: the view the rules take, plus the two
 *  row facts only the machine consults. */
export interface MachineDraft extends DraftView {
  /** #8's hard rules, as recorded on the draft row by #44's pipeline. A
   *  draft that never ran them is not a draft that passed them. */
  hardRulesPassed: boolean;
  /** `drafts.transitions`, append-only. Read for one question only —
   *  whether the page ever entered review — and rendered by no surface. */
  transitions: readonly TransitionRecord[];
}

/**
 * The two predicates the veto leaf (#46) owns.
 *
 * They are a seam, not a re-implementation: `becomesPublishable` is the
 * approved-and-due rule and `toldCurrentPair` is REQ-057 c8's telling, and
 * both belong to the module that owns the veto window.
 */
export interface PublishableRule {
  becomesPublishable(draft: DraftView, at: Date): boolean;
  toldCurrentPair(draft: DraftView): boolean;
}

/**
 * The refusing rule — no longer the default, and kept.
 *
 * It was the default until #46 landed, on the grounds §9 states: "no page
 * publishes at all without their having been told, on the pair it actually
 * publishes under, either the interval they have to stop it or that no
 * interval exists", so a rule answering `true` while the telling was
 * unbuilt would have published pages the customer was never told about.
 *
 * It stays because it is the one value that proves the two guards are load
 * bearing: a test that drives `approved → publishing` with this rule and
 * every other guard open must be refused at `publishable_and_due`. Deleting
 * it because "nothing in `src/` uses it" removes the only thing that fails
 * when the guards stop being consulted.
 */
export const PUBLISHABLE_RULE_NOT_BUILT: PublishableRule = Object.freeze({
  becomesPublishable(): boolean {
    return false;
  },
  toldCurrentPair(): boolean {
    return false;
  },
});

/** Everything a guard may reach for. Injected so each guard stays a pure
 *  function of what it is handed, and so a test drives one guard without a
 *  database. */
export interface GuardDeps {
  /** REQ-092 c1's stop, as one boolean. Takes the site so a per-account
   *  stop can arrive here without a signature change; the halt §11 binds to
   *  publishing is deployment-wide, so the default implementation declares
   *  no parameter and reads none. */
  reachKitStopped(siteId: string): Promise<boolean>;
  isPublishingOn(siteId: string): Promise<boolean>;
  hasCeilingRoom(siteId: string, at: Date): Promise<boolean>;
  destinationWorking(siteId: string): Promise<boolean>;
  rule: PublishableRule;
}

export const DEFAULT_GUARD_DEPS: GuardDeps = Object.freeze({
  reachKitStopped,
  isPublishingOn,
  async hasCeilingRoom(siteId: string, at: Date): Promise<boolean> {
    return (await ceilingRoom(siteId, at)).room;
  },
  destinationWorking,
  // The seam #45 declared and #46 fills. Imported by file, not through
  // `publishable/index.ts`: the barrel re-exports `veto.ts`, which imports
  // `transition()`, and reaching it from here would close the cycle this
  // leaf sits on the other side of (ADR-092).
  rule: PUBLISHABLE_RULE,
});

export interface GuardContext {
  draft: MachineDraft;
  by: Actor;
  at: Date;
  deps: GuardDeps;
}

/** One function per `GuardId`, named for the id. Total over the union, so
 *  a tenth guard cannot be named on an edge without one. */
export const GUARD_FNS: Readonly<Record<GuardId, (c: GuardContext) => Promise<boolean>>> =
  Object.freeze({
    async draft_passed_hard_rules(c: GuardContext): Promise<boolean> {
      return c.draft.hardRulesPassed;
    },

    async never_entered_review(c: GuardContext): Promise<boolean> {
      return !c.draft.transitions.some((record) => record.to === "in_review");
    },

    async customer_initiated(c: GuardContext): Promise<boolean> {
      return c.by.kind === "customer";
    },

    async publishable_and_due(c: GuardContext): Promise<boolean> {
      return c.deps.rule.becomesPublishable(c.draft, c.at);
    },

    async customer_told(c: GuardContext): Promise<boolean> {
      return c.deps.rule.toldCurrentPair(c.draft);
    },

    /** REQ-092 c5, and the whole of it: the guard **refuses**, and a
     *  refusal takes no transition (`transition()` returns before the RPC).
     *  So a draft in review or approved when a stop begins keeps the state
     *  it holds and the `publishable_since` it holds — it is not skipped,
     *  not discarded, not marked published — and the resume order it is
     *  already in is what it resumes in. Nothing here writes anything;
     *  holding a page is the absence of an edge. */
    async reachkit_not_stopped(c: GuardContext): Promise<boolean> {
      return !(await c.deps.reachKitStopped(c.draft.siteId));
    },

    async publishing_switch_on(c: GuardContext): Promise<boolean> {
      return c.deps.isPublishingOn(c.draft.siteId);
    },

    async within_ceilings(c: GuardContext): Promise<boolean> {
      return c.deps.hasCeilingRoom(c.draft.siteId, c.at);
    },

    async destination_working(c: GuardContext): Promise<boolean> {
      return c.deps.destinationWorking(c.draft.siteId);
    },
  });
