// BUILD §4.6 — the draft view's one shape: every word that would publish,
// what it is grounded in, what the claim check said, and what happens if
// the customer does nothing.
//
// "'Read the full page' opens the **draft view** (full page render,
// grounded-fact highlight with its source line, claim-check badge,
// Approve/Edit/Veto, and the 'what happens if you do nothing' info box)."
//
// `assembleDraft` is pure — facts in, model out. Reading the facts is
// `provider.ts`'s, and today that is a fixture (this issue builds the draft
// view on fixture data behind the typed provider; §8's generation (#43),
// §7's opportunities (#40) and §9's publishing (#45, #46) supply the real
// ones later). Keeping the assembly pure is what lets every REQ-045
// criterion be decided by a test with no database at all.
//
// **This module writes nothing and truncates nothing.** `bodyMd` is
// returned in full: REQ-045 criterion 1 is "every word that would publish
// … with nothing withheld or summarised", and there is no code path here
// that shortens a body, so none can be introduced by accident.
import type { CopyKey } from "@/lib/presentation/copy";
import type { PublishingMode } from "../../_shell/model";
import type { PublishState } from "../../calendar/stages";
import { factPresentIn } from "./grounded";

/** REQ-045 criterion 3's four outcomes. `nothing_to_check` is the empty
 *  do-not-claim list and is never a silent pass; `outstanding` is the state
 *  a save leaves behind (criterion 9) and shows no outcome at all. */
export type ClaimState =
  | { state: "passed"; at: Date }
  | { state: "failed"; matchedEntry: string; at: Date }
  | { state: "outstanding" }
  | { state: "nothing_to_check" };

/** Criterion 1 and REQ-093 criterion 2: what ReachKit wrote is labelled as
 *  this page's generated content, and the label never presents the
 *  customer's own words as text ReachKit generated. Two states, page-level
 *  — never a per-span diff, which mislabels on rewording (the archived
 *  BP-044 decision 1 states the argument in full). */
export type Authorship = { edited: false } | { edited: true; firstEditedAt: Date };

/** Criteria 2 and 8. The fact, the address it was read from, the date it
 *  was read, and whether the recorded verbatim passage still occurs in the
 *  body as it now stands. The fact is never rewritten to match an edit. */
export interface Grounded {
  fact: string;
  url: string;
  readAt: Date;
  present: boolean;
}

/** Criterion 4, "what will happen if you do nothing" — §9's two modes read
 *  as the two outcomes they produce. Autopilot auto-approves when the veto
 *  window expires; copilot publishes nothing without an explicit approve,
 *  so it has no time to state. */
export interface DoNothing {
  key: CopyKey;
  publishesAt: Date | null;
}

export interface DraftView {
  draftId: string;
  title: string;
  /** Every word that would publish. Never truncated, never summarised. */
  bodyMd: string;
  /** The text as generated, before any edit — what makes the authorship
   *  label truthful and what an unedited page's copy-out is identical to. */
  bodyMdGenerated: string;
  state: PublishState;
  authorship: Authorship;
  grounded: Grounded;
  claim: ClaimState;
  doNothing: DoNothing;
  lastSavedAt: Date | null;
  /** The site-local zone every date this view states is expressed in. */
  timeZone: string;
}

/** Everything the draft view reads, before it is a model. One shape, so the
 *  fixture and a future query answer the same question. */
export interface DraftFacts {
  draftId: string;
  title: string;
  bodyMd: string;
  bodyMdGenerated: string;
  state: PublishState;
  /** Set on the first save that changed the text; `null` on a draft the
   *  customer has not edited. */
  firstEditedAt: Date | null;
  /** The fact and its source, as recorded at generation. `present` is
   *  **not** a fact — it is recomputed here against `bodyMd`, so a body and
   *  a highlight can never disagree. */
  groundedFact: { fact: string; url: string; readAt: Date };
  claim: ClaimState;
  /** §9's publishing mode, read from the shell's one preference. */
  mode: PublishingMode;
  /** §9's veto window: when this page goes out if nothing is done. `null`
   *  under copilot, and `null` for a page that is not awaiting review. */
  autoApprovesAt: Date | null;
  lastSavedAt: Date | null;
  timeZone: string;
}

/** The two keys criterion 4's outcome is spoken through. Named by the mode
 *  §9 names, never by a renderer. */
export const DO_NOTHING_COPY_KEY: Readonly<Record<PublishingMode, CopyKey>> = Object.freeze({
  autopilot: "draft.do-nothing.autopilot",
  copilot: "draft.do-nothing.copilot",
});

/** Criterion 4. Copilot states no time because it has none: "explicit
 *  approve only" (§9) means nothing happens if the customer does nothing,
 *  and inventing a time for that arm would be a promise the product does
 *  not keep. */
export function doNothingOf(facts: DraftFacts): DoNothing {
  return {
    key: DO_NOTHING_COPY_KEY[facts.mode],
    publishesAt: facts.mode === "autopilot" ? facts.autoApprovesAt : null,
  };
}

export function assembleDraft(facts: DraftFacts): DraftView {
  return {
    draftId: facts.draftId,
    title: facts.title,
    bodyMd: facts.bodyMd,
    bodyMdGenerated: facts.bodyMdGenerated,
    state: facts.state,
    authorship:
      facts.firstEditedAt === null
        ? { edited: false }
        : { edited: true, firstEditedAt: facts.firstEditedAt },
    grounded: {
      ...facts.groundedFact,
      // Criterion 8, decided here rather than stored: the grounding is
      // still marked if the fact survived the edit and is no longer marked
      // if it was removed.
      present: factPresentIn(facts.bodyMd, facts.groundedFact.fact),
    },
    claim: facts.claim,
    doNothing: doNothingOf(facts),
    lastSavedAt: facts.lastSavedAt,
    timeZone: facts.timeZone,
  };
}
