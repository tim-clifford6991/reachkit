// BUILD §9 — the eleven named guards, one function each, each delegating every fact it does not own (the switch, the
// ceilings, the veto leaf's rule and telling), since a second copy of a rule drifts.
// Evaluated lazily in `GUARDS` order, the first failure naming itself, so a move the switch refuses never counts a week first.
import type { Actor, DraftView, TransitionRecord } from "../types";
import { isPublishingOn, reachKitStopped } from "../switch";
import { ceilingRoom } from "../ceilings";
import { destinationWorking } from "../destinations";
import { PUBLISHABLE_RULE } from "../publishable/rule";
import { canPutBack } from "../take-down/standing";
import type { GuardId } from "./table";

/** The draft as the machine reads it: the view the rules take, plus the two
 *  row facts only the machine consults. */
export interface MachineDraft extends DraftView {
  /** §8's hard rules as the pipeline recorded them; never ran is not passed. */
  hardRulesPassed: boolean;
  /** `drafts.transitions`, append-only, read here only for whether the page ever entered review. */
  transitions: readonly TransitionRecord[];
}

/** The seam for the veto leaf's two predicates: approved-and-due, and REQ-057 c8's telling. */
export interface PublishableRule {
  becomesPublishable(draft: DraftView, at: Date): boolean;
  toldCurrentPair(draft: DraftView): boolean;
}

/** The refusing rule, kept because it proves the two guards are load-bearing: with it and every other guard open,
 *  `approved → publishing` must be refused at `publishable_and_due`. Unused in `src/`, it is the test's only failure. */
export const PUBLISHABLE_RULE_NOT_BUILT: PublishableRule = Object.freeze({
  becomesPublishable(): boolean {
    return false;
  },
  toldCurrentPair(): boolean {
    return false;
  },
});

/** Everything a guard may reach for, injected so each stays pure and a test needs no database. */
export interface GuardDeps {
  /** BUILD §8 hard rule 4 · REQ-053 c5 — "no approval, schedule or retry puts a page carrying a forbidden claim on the
   *  customer's site", enforced at the engine's one hand-off gate: this call. */
  claimRecheckOutstanding(draftId: string): Promise<boolean>;
  /** The entry the last check matched, a string the customer wrote, never model output; `null` but on a failed
   *  verdict, so no claim is attributed to a customer who never made it. */
  outstandingMatch(draftId: string): Promise<{ matchedEntry: string } | null>;
  /** REQ-092 c1's stop. Takes the site for a per-account stop; §11's halt is deployment-wide, so the default reads none. */
  reachKitStopped(siteId: string): Promise<boolean>;
  isPublishingOn(siteId: string): Promise<boolean>;
  hasCeilingRoom(siteId: string, at: Date): Promise<boolean>;
  destinationWorking(siteId: string): Promise<boolean>;
  rule: PublishableRule;
}

export const DEFAULT_GUARD_DEPS: GuardDeps = Object.freeze({
  // At the call: `@/lib/generate` reaches `@/lib/db`, and surfaces that only render a draft's state import this module.
  async claimRecheckOutstanding(draftId: string): Promise<boolean> {
    const { claimRecheckOutstanding } = await import("@/lib/generate");
    return claimRecheckOutstanding(draftId);
  },
  async outstandingMatch(draftId: string): Promise<{ matchedEntry: string } | null> {
    const { outstandingMatch } = await import("@/lib/generate");
    return outstandingMatch(draftId);
  },
  reachKitStopped,
  isPublishingOn,
  async hasCeilingRoom(siteId: string, at: Date): Promise<boolean> {
    return (await ceilingRoom(siteId, at)).room;
  },
  destinationWorking,
  // By file, not the `publishable/` barrel, which re-exports `veto.ts` and would close a cycle (ADR-092).
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

    async put_back_window(c: GuardContext): Promise<boolean> {
      return canPutBack(c.draft.transitions, c.at);
    },

    async publishable_and_due(c: GuardContext): Promise<boolean> {
      return c.deps.rule.becomesPublishable(c.draft, c.at);
    },

    async customer_told(c: GuardContext): Promise<boolean> {
      return c.deps.rule.toldCurrentPair(c.draft);
    },

    /** REQ-092 c5: a refusal takes no transition, so a page keeps its state and `publishable_since` and resumes in
     *  order. Holding a page is the absence of an edge. */
    async reachkit_not_stopped(c: GuardContext): Promise<boolean> {
      return !(await c.deps.reachKitStopped(c.draft.siteId));
    },

    /** BUILD §8 hard rule 4 · REQ-053 c5, read off the draft, which `transition()` resolves once, so this guard and the
     *  publishable rule cannot disagree. An unreadable draft is outstanding, the safe direction. */
    async no_outstanding_claim_recheck(c: GuardContext): Promise<boolean> {
      return !c.draft.claimRecheckOutstanding;
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
