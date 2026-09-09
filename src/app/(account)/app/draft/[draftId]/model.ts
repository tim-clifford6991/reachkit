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
import type { RecordedFact } from "@/lib/generate/fact";
import type { PageRecord } from "@/lib/publish/record";
import type { RailCheck } from "./checks";
import type { PublishingMode } from "../../_shell/model";
import type { State } from "../../calendar/stages";
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

/** Criteria 2 and 8. The recorded passage, the address it was read from,
 *  the date it was read, and whether that verbatim passage still occurs in
 *  the body as it now stands. The passage is never rewritten to match an
 *  edit.
 *
 *  The three recorded members are `RecordedFact`'s own words (issue #415):
 *  this view states what §8 wrote down, and calling it by a second name
 *  here is how the screen came to read a shape nothing writes. `present`
 *  is the one member that is not recorded — it is recomputed below. */
export interface Grounded extends RecordedFact {
  present: boolean;
}

/** What `Grounded` reads as on a draft generation recorded no grounding
 *  for: nothing to mark, no address to print and no day to state (#268).
 *  The screen draws no highlight, no source line and no dropped-grounding
 *  note for it. */
const NO_GROUNDING: Grounded = Object.freeze({
  passage: "",
  url: "",
  readAt: null,
  present: false,
});

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
  /** UI-SPEC S16's provenance line: the day and time the page was written.
   *  It is the `drafts` row's own `created_at` — the moment §8 wrote the
   *  page — and never the last save, which is a different fact and is
   *  stated in its own place (S17's save line). `null` only where the facts
   *  carry none. */
  writtenAt: Date | null;
  /** Every word that would publish. Never truncated, never summarised. */
  bodyMd: string;
  /** The text as generated, before any edit — what makes the authorship
   *  label truthful and what an unedited page's copy-out is identical to. */
  bodyMdGenerated: string;
  state: State;
  authorship: Authorship;
  grounded: Grounded;
  claim: ClaimState;
  doNothing: DoNothing;
  lastSavedAt: Date | null;
  /**
   * What became of this page (issue #217): the address it is or was
   * readable at, what ReachKit's one check saw, what the last unpublish
   * call found, and REQ-060 criterion 4's line where a delivery wrote into
   * no SEO plugin.
   *
   * **Handed through whole, and never re-derived here.** `PageRecord` is
   * the one read behind every surface that states a page's standing, and
   * `assembleDraft` is a pure assembly: it decides nothing about liveness,
   * picks no key, and would be the second place the record's facts were
   * interpreted if it did. `null` where nothing could be read for this
   * draft — a shape, not a placeholder, and the block is simply absent.
   */
  record: PageRecord | null;
  /** S16's Checks list: the §8 rules generation recorded a pass for. Empty
   *  where it recorded none — the rail then draws no row for them, rather
   *  than deducing a pass from the fact that the draft reached review
   *  (`checks.ts` states the argument). */
  recordedChecks: readonly RailCheck[];
  /** The site-local zone every date this view states is expressed in. */
  timeZone: string;
}

/** Everything the draft view reads, before it is a model. One shape, so the
 *  fixture and a future query answer the same question. */
export interface DraftFacts {
  draftId: string;
  title: string;
  /** The `drafts` row's `created_at` — when the page was written. */
  writtenAt: Date | null;
  bodyMd: string;
  bodyMdGenerated: string;
  state: State;
  /** Set on the first save that changed the text; `null` on a draft the
   *  customer has not edited. */
  firstEditedAt: Date | null;
  /** The passage and its source, as recorded at generation — `null` where
   *  generation recorded no grounding. `present` is **not** a recorded
   *  value: it is recomputed in `assembleDraft` against `bodyMd`, so a body
   *  and a highlight can never disagree. */
  groundedFact: RecordedFact | null;
  claim: ClaimState;
  /** §9's publishing mode, read from the shell's one preference. */
  mode: PublishingMode;
  /** §9's veto window: when this page goes out if nothing is done. `null`
   *  under copilot, and `null` for a page that is not awaiting review. */
  autoApprovesAt: Date | null;
  lastSavedAt: Date | null;
  /** The page's own record, or `null` where none could be read (#217). */
  record: PageRecord | null;
  /** §8's battery, as generation recorded it. Empty is the honest answer
   *  for a draft it recorded nothing for. */
  recordedChecks: readonly RailCheck[];
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

/**
 * S16's "~{n} words", counted the way a reader would count them: runs of
 * non-space, over the Markdown as it stands.
 *
 * It counts the **source**, marks and all, because the source is what the
 * customer edits and what the count has to move with as they type. The set
 * writes the figure with a tilde in front of it for exactly this reason —
 * it is the page's length, not a promise about a destination's rendering
 * (REQ-045's own non-goal), and a count that pretended to be exact would be
 * claiming to know what a theme will do with a heading.
 */
export function wordCount(bodyMd: string): number {
  const trimmed = bodyMd.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

export function assembleDraft(facts: DraftFacts): DraftView {
  return {
    draftId: facts.draftId,
    title: facts.title,
    writtenAt: facts.writtenAt,
    bodyMd: facts.bodyMd,
    bodyMdGenerated: facts.bodyMdGenerated,
    state: facts.state,
    authorship:
      facts.firstEditedAt === null
        ? { edited: false }
        : { edited: true, firstEditedAt: facts.firstEditedAt },
    grounded:
      facts.groundedFact === null
        ? NO_GROUNDING
        : {
            ...facts.groundedFact,
            // Criterion 8, decided here rather than stored: the grounding
            // is still marked if the passage survived the edit and is no
            // longer marked if it was removed.
            present: factPresentIn(facts.bodyMd, facts.groundedFact.passage),
          },
    claim: facts.claim,
    doNothing: doNothingOf(facts),
    lastSavedAt: facts.lastSavedAt,
    record: facts.record,
    recordedChecks: facts.recordedChecks,
    timeZone: facts.timeZone,
  };
}
