// BUILD §9, §4.6 — the record's facts as the keys a surface renders them
// under, and nothing else.
//
// **The record decides; the screen reads** (issue #217). `index.ts` already
// keeps that discipline for the two facts it had a surface for — the
// address label and REQ-060 criterion 4's line are chosen there and named
// as keys, never as sentences. This file is the same discipline for the two
// that had none: what ReachKit's one check found, and what a page's
// unpublish call found. A component that picked either key itself would be
// a second place the choice is made, and the day panel and the draft view
// would disagree about a page the first time one of them was edited.
//
// **Pure, and deliberately not in `index.ts`.** That module resolves
// `publishDb()`; this one imports two types and `CopyKey`. Every surface
// that states a page's standing renders through here, so a database client
// behind it would be paid for on the draft view, the day panel and Overview
// alike and needed by none of them.
//
// **Seven verification lines, and `page_not_found` and `could_not_confirm`
// are two of them — ADR-085's landmine, at the surface this time.** They
// render as the same quiet line and have opposite consequences: one stops
// the page being shown as live and retires it from weekly judgement, the
// other asserts nothing and leaves the page exactly as it was. Collapsing
// them into one key is the edit that will be proposed by whoever is looking
// at two identical grey lines on a day panel, and
// `tests/publish/record/lines.test.ts` is what fails when they do.
//
// **`kind` is carried beside the key on purpose.** A surface needs to know
// which of the seven it is holding — to choose a tone, which is
// presentation and is not this module's — and re-deriving that from the
// disposition would put the same `switch` in every component. So the choice
// is made once, here, and what a screen does with it is the screen's.
import type { CopyKey } from "@/lib/presentation/copy";
import type { UnpublishOutcome, VerifyDisposition } from "../types";

/** REQ-060 criterion 4's line (issue #156), named here rather than in
 *  `index.ts` since #217.
 *
 *  It sits in the module's **pure** leaf because a fixture screen needs the
 *  key and must not pay for a database client to get it: `index.ts`
 *  resolves `publishDb()`, and the reserved fixture account's draft view
 *  reaches no database at all. `index.ts` re-exports it, so every existing
 *  caller's spelling is unchanged, and the key is still named in exactly
 *  three files in `src/` — none of them a surface, which is the law
 *  `tests/publish/record/seo-note.test.ts` holds. */
export const SEO_COPY = Object.freeze({
  noSeoPlugin: "publish.wordpress.noSeoPlugin",
} as const satisfies Record<string, CopyKey>);

/** Which of the seven a record earned. Presentation-neutral: it names the
 *  standing, never how it looks. */
export type VerificationKind =
  | "found"
  | "page_not_found"
  | "could_not_confirm"
  | "not_yet"
  | "due"
  | "never_taken_down_first"
  | "never_no_live_address";

export interface VerificationLine {
  kind: VerificationKind;
  copy: CopyKey;
  /** The moment the line states — when the check ran, or when it falls due.
   *  `null` where there is no moment to state, which is every `never` arm
   *  and `due` itself: "due" is about now, and printing now as a date would
   *  read as an observation. */
  at: Date | null;
}

/** One key per kind, total. A `Record` over the union rather than a
 *  `switch`, so an eighth kind is a compile error here and not a line that
 *  silently goes missing. Every sentence is the owner's. */
export const VERIFICATION_COPY: Readonly<Record<VerificationKind, CopyKey>> = Object.freeze({
  found: "record.verification.found",
  page_not_found: "record.verification.pageNotFound",
  could_not_confirm: "record.verification.couldNotConfirm",
  not_yet: "record.verification.notYet",
  due: "record.verification.due",
  never_taken_down_first: "record.verification.never.takenDownFirst",
  never_no_live_address: "record.verification.never.noLiveAddress",
});

/** One key per `UnpublishOutcome`, total over §9's five. */
export const UNPUBLISHED_COPY: Readonly<Record<UnpublishOutcome, CopyKey>> = Object.freeze({
  removed: "record.unpublished.removed",
  returned_to_draft: "record.unpublished.returnedToDraft",
  named_for_removal: "record.unpublished.namedForRemoval",
  already_gone: "record.unpublished.alreadyGone",
  unreachable: "record.unpublished.unreachable",
});

function line(kind: VerificationKind, at: Date | null): VerificationLine {
  return { kind, copy: VERIFICATION_COPY[kind], at };
}

/**
 * What the record's verification says, as one line.
 *
 * Total over `VerifyDisposition`'s four arms and, inside `done`, over
 * `VerifyOutcome`'s three — so REQ-062 criterion 7 holds at the surface the
 * way the record holds it in the type: a screen cannot state a page's
 * standing and omit what ReachKit saw, because it gets both from one call.
 */
export function verificationLine(verification: VerifyDisposition): VerificationLine {
  switch (verification.kind) {
    case "done":
      switch (verification.result.outcome) {
        case "found":
          return line("found", verification.result.checkedAt);
        case "page_not_found":
          return line("page_not_found", verification.result.checkedAt);
        case "could_not_confirm":
          return line("could_not_confirm", verification.result.checkedAt);
      }
      break;
    case "not_yet":
      return line("not_yet", verification.dueAt);
    case "due":
      return line("due", null);
    case "never":
      return verification.because === "taken_down_first"
        ? line("never_taken_down_first", null)
        : line("never_no_live_address", null);
  }
  // Unreachable: both switches above are exhaustive over closed unions. The
  // arm exists so a ninth member added to either is a compile error at the
  // `switch` rather than an undefined line on a screen.
  return line("never_no_live_address", null);
}

/** What the last unpublish call found, as one key. */
export function unpublishedLine(outcome: UnpublishOutcome): CopyKey {
  return UNPUBLISHED_COPY[outcome];
}
