// BUILD §9, §4.6 — the record's facts as the keys a surface renders them under. The record decides and the screen reads,
// so the day panel and the draft view never pick keys of their own and disagree.
// Pure and apart from `index.ts`, which resolves `publishDb()`, so no surface pays for a database client.
// `page_not_found` and `could_not_confirm` stay two lines (ADR-085): they look alike, but one retires the page from
// weekly judgement and the other asserts nothing; `tests/publish/record/lines.test.ts` fails if they merge.
// `kind` rides beside the key so a surface can choose a tone without its own `switch`.
import type { CopyKey } from "@/lib/presentation/copy";
import type { UnpublishOutcome, VerifyDisposition } from "../types";
import type { NeedsYouKind } from "./needs-you";

/** REQ-060 c4's line, in the pure leaf so the fixture draft view reaches no database; `index.ts` re-exports it.
 *  No surface names the key (`tests/publish/record/seo-note.test.ts`). */
export const SEO_COPY = Object.freeze({
  noSeoPlugin: "publish.wordpress.noSeoPlugin",
} as const satisfies Record<string, CopyKey>);

/** Which of the seven a record earned: the standing, never how it looks. */
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
  /** When the check ran or falls due; `null` for `never` and `due`, since printing now would read as an observation. */
  at: Date | null;
}

/** One key per kind, a `Record` so a new kind is a compile error, not a missing line. */
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

/** The verification as one line, total over every arm, so a screen gets the standing and what we saw from one call (REQ-062 c7). */
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
  // Unreachable: both switches are exhaustive, so a new member is a compile error, not an undefined line.
  return line("never_no_live_address", null);
}

/** What the last unpublish call found, as one key. */
export function unpublishedLine(outcome: UnpublishOutcome): CopyKey {
  return UNPUBLISHED_COPY[outcome];
}

/** Why a page needs the customer, one key per cause, so the day panel and the Overview alert tell one story.
 *  Total over `NeedsYouKind`, so a new cause is a compile error. */
export const NEEDS_YOU_COPY: Readonly<Record<NeedsYouKind, CopyKey>> = Object.freeze({
  rules: "publish.needs-you.rules",
  step: "publish.needs-you.step",
  adds: "publish.needs-you.adds",
  elsewhere: "publish.needs-you.elsewhere",
  pack: "publish.needs-you.pack",
  destination: "publish.needs-you.destination",
  delivery: "publish.needs-you.delivery",
  unknown: "publish.needs-you.unknown",
});
