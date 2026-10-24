// BUILD §12 — composeMail(): one block list, two bodies, one omission decision, so a template can neither author nor drop the text body.
// Pure: no I/O, clock or model. It is async only because React Email's `render()` is (see `shell/render.ts`); `composeMailParts()` stays synchronous.
// The whole-mail line is chosen after every block renders: a week not measured says when the next is due, a partial week names the sections
// it could not measure, and otherwise a mail whose conditional sections all went says there was nothing to report.
// `measurement` is required for `'weekly'` and rejected for every other kind, by type.
import { createElement, type ReactNode } from "react";
import { COPY, TODO_COPY_MARKER, copy, type CopyKey } from "@/lib/presentation/copy";
import { blockNodes } from "../blocks/nodes";
import { renderBlocksText } from "../blocks/text";
import { isMeasuredEmpty, omittedIndexes } from "../blocks/omit";
import { isConditional, type CopyVars, type MailBlock } from "../blocks/types";
import type { MailKind } from "../kinds";
import { MailDocument } from "./document";
import { renderMailHtml } from "./render";
import { frameText } from "./text-frame";

/** Measured; measured in part, with what is missing; or not measured, with when the next is due. */
export type MeasurementState =
  | { state: "complete" }
  | { state: "partial"; unmeasured: readonly CopyKey[] }
  | { state: "none"; nextDueOn: Date };

/** The stop control. `mechanism` picks the label from ADR-042's closed pair, so a template never authors one.
 *  `oneClickHref` is the RFC 8058 address the inbox POSTs to; it is required because a stop the inbox cannot see is the defect,
 *  and it leaves through `sendEmail` as a header, not in the body. */
export interface OptOutControl {
  href: string;
  oneClickHref: string;
  mechanism: "opt-out" | "unsubscribe";
}

interface ComposeCommon {
  subject: CopyKey;
  subjectVars?: CopyVars;
  blocks: readonly MailBlock[];
  /** S20's footer line: why this mail arrived. Optional only for the kinds `tests/mail/shell/footer.test.ts` names. */
  reason?: CopyKey;
  /** The reason line's slots, where its sentence takes one. */
  reasonVars?: CopyVars;
  optOut?: OptOutControl;
  /** Footer links drawn before the stop control, on its line. */
  footerLinks?: readonly { label: CopyKey; href: string }[];
}

export type ComposeInput =
  | (ComposeCommon & { kind: "weekly"; measurement: MeasurementState })
  | (ComposeCommon & { kind: Exclude<MailKind, "weekly">; measurement?: never });

export interface ComposedMail {
  subject: string;
  html: string;
  text: string;
  omitted: readonly number[];
  /** The whole-mail line's key, or `null`, so a caller can assert the choice without its sentence. */
  wholeMailLine: CopyKey | null;
}

const NOTHING_TO_REPORT = "mail.nothing_to_report" satisfies CopyKey;
const WEEK_UNMEASURED = "mail.week_unmeasured" satisfies CopyKey;
const WEEK_PARTLY_MEASURED = "mail.week_partly_measured" satisfies CopyKey;
const WORDMARK = "mail.shell.wordmark" satisfies CopyKey;
const IMPRINT = "mail.shell.imprint" satisfies CopyKey;
const PLAIN_TEXT_NOTE = "mail.shell.plaintext_note" satisfies CopyKey;

/** The stop labels, keyed by ADR-042's two mechanisms; closed so no template names a third. */
const OPT_OUT_LABELS: Readonly<Record<OptOutControl["mechanism"], CopyKey>> = Object.freeze({
  "opt-out": "mail.optout.label",
  unsubscribe: "mail.unsubscribe.label",
});

/** ISO calendar date: unambiguous and independent of the runtime's locale. */
function writeDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Between the names of a partial week's unmeasured sections. */
const SECTION_SEPARATOR = ", ";

/** The whole-mail line's key, or `null`, chosen apart from rendering so it can be asserted. */
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

/** The first `action` block's index, or the list's end. */
function firstActionIndex(blocks: readonly MailBlock[]): number {
  const index = blocks.findIndex((block) => block.block === "action");
  return index === -1 ? blocks.length : index;
}

/** The mail one step before its HTML becomes a string, so the `emails/` preview shows exactly what is sent. */
export interface ComposedMailParts extends Omit<ComposedMail, "html"> {
  /** The mail as React Email's own elements, ready to render. */
  document: ReactNode;
}

/** The one composer, up to the markup: every mail wears the one frame and carries both bodies. */
export function composeMailParts(m: ComposeInput): ComposedMailParts {
  return partsOf(m);
}

function partsOf(m: ComposeInput): ComposedMailParts {
  // Split at the first action so the whole-mail line stands after the sections and above the button; tail indexes shift back.
  const cut = firstActionIndex(m.blocks);
  const head = { html: blockNodes(m.blocks.slice(0, cut)), text: renderBlocksText(m.blocks.slice(0, cut)) };
  const tail = { html: blockNodes(m.blocks.slice(cut)), text: renderBlocksText(m.blocks.slice(cut)) };
  const shift = (indexes: readonly number[]): readonly number[] => indexes.map((index) => index + cut);
  const htmlBody = { omitted: [...head.html.omitted, ...shift(tail.html.omitted)] };
  const textBody = { omitted: [...head.text.omitted, ...shift(tail.text.omitted)] };

  const wholeMailLine = chooseWholeMailLine({ blocks: m.blocks, measurement: m.measurement });
  const line = renderWholeMailLine(wholeMailLine, m.measurement);

  const wordmark = copy(WORDMARK);
  // Read off the registry, not `copy()`, which throws on an unwritten key and would stop every mail on a footer band.
  const imprintText = COPY[IMPRINT];
  const imprint = imprintText === "" ? null : imprintText;
  const optOut =
    m.optOut === undefined
      ? null
      : { href: m.optOut.href, label: copy(OPT_OUT_LABELS[m.optOut.mechanism]) };

  const footer = {
    wordmark,
    links: (m.footerLinks ?? []).map((link) => ({ label: copy(link.label), href: link.href })),
    // An unwritten reason renders nothing: SPEC §8 sends no `TODO(copy)`.
    reason:
      m.reason === undefined || COPY[m.reason] === TODO_COPY_MARKER ? null : copy(m.reason, m.reasonVars),
    imprint,
    plainTextNote: copy(PLAIN_TEXT_NOTE),
  };

  // Both renderers read `omit.ts`; this asserts no local edit made them disagree.
  if (htmlBody.omitted.join(",") !== textBody.omitted.join(",")) {
    throw new Error("composeMail: the two bodies disagree about what was omitted.");
  }

  return {
    subject: copy(m.subject, m.subjectVars),
    document: createElement(MailDocument, {
      ...footer,
      rows: head.html.nodes,
      actions: tail.html.nodes,
      wholeMailLine: line,
      optOut,
    }),
    text: frameText({ ...footer, body: head.text.text, actions: tail.text.text, wholeMailLine: line, optOut }),
    omitted: htmlBody.omitted,
    wholeMailLine,
  };
}

/** The one composer. The `await` is React Email's renderer and nothing else: no I/O, clock or vendor. */
export async function composeMail(m: ComposeInput): Promise<ComposedMail> {
  const { document, ...rest } = composeMailParts(m);
  return { ...rest, html: await renderMailHtml(document) };
}
