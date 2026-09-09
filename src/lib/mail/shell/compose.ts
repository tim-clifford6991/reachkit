// BUILD §12 — composeMail(): one block list, two bodies, one decision.
//
// Both renderers are called on the same `MailBlock[]`, so a template
// cannot author a text body and cannot omit one, and the two bodies
// cannot disagree about what was left out. Pure and synchronous: no I/O,
// no clock, no interpolation engine, no model — with every language model
// unavailable this function returns exactly the same two strings.
//
// The whole-mail line is chosen here, after every block has rendered,
// because it is a fact about the mail rather than about any block:
//
//   · the week was not measured at all → it says so, and when the next
//     measurement is due;
//   · the week was only partly measured → it names which sections could
//     not be measured, rather than dropping them silently;
//   · otherwise, where every conditional section was omitted or came out
//     empty → it says there was nothing to report.
//
// A mail with a measured section carries no whole-mail line, and the two
// measurement exceptions never coexist with the nothing-to-report line.
// `measurement` is required for `'weekly'` and rejected for every other
// kind — a type error, not a runtime check.
import { copy, COPY } from "@/lib/presentation/copy";
import type { CopyKey } from "@/lib/presentation/copy";
import { renderBlocksHtml } from "../blocks/html";
import { renderBlocksText } from "../blocks/text";
import { isMeasuredEmpty, omittedIndexes } from "../blocks/omit";
import { isConditional, type CopyVars, type MailBlock } from "../blocks/types";
import type { MailKind } from "../kinds";
import { frameHtml } from "./frame";
import { frameText } from "./text-frame";

/** What the week behind a `weekly` mail is known to be. Three states and
 *  no fourth: "measured", "measured in part, and here is what is missing",
 *  and "not measured, and here is when the next one is due". */
export type MeasurementState =
  | { state: "complete" }
  | { state: "partial"; unmeasured: readonly CopyKey[] }
  | { state: "none"; nextDueOn: Date };

/** The stop control a mail carries. `mechanism` chooses the label from a
 *  closed pair — a template never authors one — and names which of
 *  ADR-042's two mechanisms the link belongs to, so the two can never be
 *  confused at the point they are put in front of a reader. */
export interface OptOutControl {
  href: string;
  mechanism: "opt-out" | "unsubscribe";
}

interface ComposeCommon {
  subject: CopyKey;
  subjectVars?: CopyVars;
  blocks: readonly MailBlock[];
  /**
   * UI-SPEC S20's footer line: why this mail arrived. One key per kind,
   * supplied by the template, because the reason is a fact about the
   * occasion and not about the shell.
   *
   * Optional only because three of the ten kinds are not in the approved
   * set and have no written reason yet — `tests/mail/shell/footer.test.ts`
   * names those three and fails if a fourth appears.
   */
  reason?: CopyKey;
  /** The reason line's own slots, where its sentence takes one — the
   *  report's removal address is the only such slot today. */
  reasonVars?: CopyVars;
  optOut?: OptOutControl;
}

export type ComposeInput =
  | (ComposeCommon & { kind: "weekly"; measurement: MeasurementState })
  | (ComposeCommon & { kind: Exclude<MailKind, "weekly">; measurement?: never });

export interface ComposedMail {
  subject: string;
  html: string;
  text: string;
  omitted: readonly number[];
  /** Which whole-mail line this mail carries, or `null` for none. Returned
   *  as the key rather than only as rendered text so a caller — and a
   *  test — can assert the choice without depending on a sentence the
   *  owner has not written yet. */
  wholeMailLine: CopyKey | null;
}

const NOTHING_TO_REPORT = "mail.nothing_to_report" satisfies CopyKey;
const WEEK_UNMEASURED = "mail.week_unmeasured" satisfies CopyKey;
const WEEK_PARTLY_MEASURED = "mail.week_partly_measured" satisfies CopyKey;
const WORDMARK = "mail.shell.wordmark" satisfies CopyKey;
const IMPRINT = "mail.shell.imprint" satisfies CopyKey;
const PLAIN_TEXT_NOTE = "mail.shell.plaintext_note" satisfies CopyKey;

/** The two labels a stop control can carry, keyed by ADR-042's two
 *  mechanisms. Closed here so no template can name a third. */
const OPT_OUT_LABELS: Readonly<Record<OptOutControl["mechanism"], CopyKey>> = Object.freeze({
  "opt-out": "mail.optout.label",
  unsubscribe: "mail.unsubscribe.label",
});

/** How a date is written in a mail. ISO calendar date — unambiguous,
 *  locale-free and testable, where a localised format would depend on the
 *  runtime's own locale (a parameter, rule 1.1; MVP is US-English only,
 *  §6.3a). Reversal cost: this one function. */
function writeDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The separator between the names of the sections a partial week could
 *  not measure. Layout, not voice. */
const SECTION_SEPARATOR = ", ";

/** The choice, isolated from the rendering so it can be asserted on its
 *  own. Returns the key of the line this mail carries, or `null`. */
export function chooseWholeMailLine(a: {
  blocks: readonly MailBlock[];
  measurement?: MeasurementState;
}): CopyKey | null {
  if (a.measurement?.state === "none") return WEEK_UNMEASURED;
  if (a.measurement?.state === "partial") return WEEK_PARTLY_MEASURED;

  const conditional = a.blocks.filter(isConditional);
  if (conditional.length === 0) return null;

  const dropped = new Set(omittedIndexes(a.blocks));
  const silent = a.blocks.every(
    (block, index) => !isConditional(block) || dropped.has(index) || isMeasuredEmpty(block)
  );
  return silent ? NOTHING_TO_REPORT : null;
}

function renderWholeMailLine(key: CopyKey | null, measurement?: MeasurementState): string | null {
  if (key === null) return null;
  if (key === WEEK_UNMEASURED && measurement?.state === "none") {
    return copy(key, { nextDue: writeDate(measurement.nextDueOn) });
  }
  if (key === WEEK_PARTLY_MEASURED && measurement?.state === "partial") {
    return copy(key, {
      sections: measurement.unmeasured.map((section) => copy(section)).join(SECTION_SEPARATOR),
    });
  }
  return copy(key);
}

/** The seam's one composer. Every mail the product sends is built here,
 *  wearing the one frame, carrying both bodies. */
export function composeMail(m: ComposeInput): ComposedMail {
  const htmlBody = renderBlocksHtml(m.blocks);
  const textBody = renderBlocksText(m.blocks);

  const wholeMailLine = chooseWholeMailLine({ blocks: m.blocks, measurement: m.measurement });
  const line = renderWholeMailLine(wholeMailLine, m.measurement);

  const wordmark = copy(WORDMARK);
  // The imprint is bracketed in the approved set — the owner's own line,
  // not yet written. Read straight off the registry rather than through
  // `copy()`, because `copy()` throws on an owner-owed key and every mail
  // in the product would stop composing on a footer band. It appears the
  // day it is written and not before, which is what a bracketed string in
  // the set means.
  const imprintText = COPY[IMPRINT];
  const imprint = imprintText === "" ? null : imprintText;
  const optOut =
    m.optOut === undefined
      ? null
      : { href: m.optOut.href, label: copy(OPT_OUT_LABELS[m.optOut.mechanism]) };

  const footer = {
    wordmark,
    reason: m.reason === undefined ? null : copy(m.reason, m.reasonVars),
    imprint,
    plainTextNote: copy(PLAIN_TEXT_NOTE),
  };

  // The two renderers read one omission decision (`omit.ts`); this is the
  // assertion that they were not made to disagree by a local edit.
  if (htmlBody.omitted.join(",") !== textBody.omitted.join(",")) {
    throw new Error("composeMail: the two bodies disagree about what was omitted.");
  }

  return {
    subject: copy(m.subject, m.subjectVars),
    html: frameHtml({ ...footer, rows: htmlBody.html, wholeMailLine: line, optOut }),
    text: frameText({ ...footer, body: textBody.text, wholeMailLine: line, optOut }),
    omitted: htmlBody.omitted,
    wholeMailLine,
  };
}
