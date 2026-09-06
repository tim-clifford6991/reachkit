// BUILD §9 — the eight named guards, one function each.
//
// A guard answers one question about one edge and delegates every fact it
// does not own: the switch is `switch/index.ts`'s, the ceilings are
// `ceilings/index.ts`'s, the publishable rule and the telling are the veto
// leaf's (#46). None of them is re-implemented here — a second copy of a
// rule is the thing that drifts.
//
// Guards are evaluated lazily, in the order `GUARDS` lists them, and the
// first that fails names itself in the refusal. Laziness is not an
// optimisation: it is what keeps a move that is refused by the switch from
// counting a week of publications first.
//
// The archived plan is WO-209.
import type { Actor, DraftView, TransitionRecord } from "../types";
import { isPublishingOn } from "../switch";
import { ceilingRoom } from "../ceilings";
import { destinationWorking } from "../destinations";
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
 * The default until #46 lands, and it refuses.
 *
 * This is the honest value, not a placeholder chosen for convenience. §9
 * makes the telling a promise — "no page publishes at all without their
 * having been told, on the pair it actually publishes under, either the
 * interval they have to stop it or that no interval exists" — so a rule
 * that answered `true` while the telling is unbuilt would publish pages
 * the customer was never told about. Refusing holds them instead, which is
 * exactly what the switch does and exactly what §9 asks of a page it
 * cannot yet publish.
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
  isPublishingOn(siteId: string): Promise<boolean>;
  hasCeilingRoom(siteId: string, at: Date): Promise<boolean>;
  destinationWorking(siteId: string): Promise<boolean>;
  rule: PublishableRule;
}

export const DEFAULT_GUARD_DEPS: GuardDeps = Object.freeze({
  isPublishingOn,
  async hasCeilingRoom(siteId: string, at: Date): Promise<boolean> {
    return (await ceilingRoom(siteId, at)).room;
  },
  destinationWorking,
  rule: PUBLISHABLE_RULE_NOT_BUILT,
});

export interface GuardContext {
  draft: MachineDraft;
  by: Actor;
  at: Date;
  deps: GuardDeps;
}

/** One function per `GuardId`, named for the id. Total over the union, so
 *  a ninth guard cannot be named on an edge without one. */
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
