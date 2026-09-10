// BUILD §12 — the one line a mail carries when its sections said nothing.
//
// Three lines, chosen after every block has rendered, and never two at
// once: the week was not measured at all; the week was only partly
// measured, and here is what is missing; or every conditional section was
// omitted or came out empty, so there was nothing to report.
//
// All three sentences are the owner's. They were owner-owed (empty, and
// `copy()` threw on them at compose time) until issue #458 filled them on
// the owner's 2026-09-10 approval. Each case below now asserts the line is
// written and renders into both bodies with its slot filled — the rendered
// sentence, never the raw `{slot}` template.
import { describe, expect, it } from "vitest";
import { chooseWholeMailLine, composeMail, type MeasurementState } from "../../../src/lib/mail/shell/compose";
import { COPY, copy } from "../../../src/lib/presentation/copy";
import type { CopyKey } from "../../../src/lib/presentation/copy";
import { OWNER_OWED } from "../../../src/lib/presentation/copy/registry";
import { measured, measuredZero } from "../../../src/lib/measure/measured";
import * as f from "../fixtures";

const NOTHING = "mail.nothing_to_report" satisfies CopyKey;
const UNMEASURED_WEEK = "mail.week_unmeasured" satisfies CopyKey;
const PARTIAL_WEEK = "mail.week_partly_measured" satisfies CopyKey;

const SILENT_BLOCKS = [
  f.HEADING,
  f.stat(f.missing<number>()),
  f.list(measuredZero([] as const, f.AT)),
];
const SPEAKING_BLOCKS = [f.HEADING, f.stat(f.num(0))];

/** Composes the silent weekly mail under the given measurement state. */
function composeSilentWeekly(measurement: MeasurementState) {
  return () =>
    composeMail({ kind: "weekly", subject: f.HEADING_KEY, blocks: SILENT_BLOCKS, measurement });
}

/** The line is written (not owner-owed), and both bodies carry `rendered`
 *  — the sentence with its slots filled — and no unfilled `{slot}`. */
function expectLine(
  compose: () => { html: string; text: string },
  key: CopyKey,
  rendered: string
): void {
  expect(COPY[key], key).not.toBe("");
  expect(OWNER_OWED, key).not.toContain(key);
  const mail = compose();
  expect(mail.text).toContain(rendered);
  expect(mail.html).toContain(rendered);
  expect(mail.text).not.toMatch(/\{[A-Za-z]+\}/);
  expect(mail.html).not.toMatch(/\{[A-Za-z]+\}/);
}

describe("BUILD §12 — the whole-mail line is chosen once, after the blocks", () => {
  it("a mail whose every conditional section was omitted or empty says there was nothing to report", () => {
    expect(chooseWholeMailLine({ blocks: SILENT_BLOCKS })).toBe(NOTHING);
    expectLine(
      () => composeMail({ kind: "report", subject: f.HEADING_KEY, blocks: SILENT_BLOCKS }),
      NOTHING,
      COPY[NOTHING]
    );
  });

  it("a mail with one measured section carries no whole-mail line", () => {
    expect(chooseWholeMailLine({ blocks: SPEAKING_BLOCKS })).toBeNull();
    const mail = composeMail({ kind: "report", subject: f.HEADING_KEY, blocks: SPEAKING_BLOCKS });
    expect(mail.wholeMailLine).toBeNull();
  });

  it("a mail with no conditional section at all carries no line — it never had one to lose", () => {
    expect(chooseWholeMailLine({ blocks: [f.HEADING, f.ACTION] })).toBeNull();
    expect(chooseWholeMailLine({ blocks: [] })).toBeNull();
  });

  it("an unmeasured week states so, with the next due date, and never the nothing-to-report line", () => {
    const measurement = { state: "none", nextDueOn: new Date("2026-09-14T06:00:00.000Z") } as const;
    expect(chooseWholeMailLine({ blocks: SILENT_BLOCKS, measurement })).toBe(UNMEASURED_WEEK);
    // The due date reaches the slot as the mail's ISO calendar date.
    expectLine(
      composeSilentWeekly(measurement),
      UNMEASURED_WEEK,
      copy(UNMEASURED_WEEK, { nextDue: "2026-09-14" })
    );
    const mail = composeSilentWeekly(measurement)();
    expect(mail.text).toContain("2026-09-14");
    expect(mail.text).not.toContain(COPY[NOTHING]);
    expect(mail.html).not.toContain(COPY[NOTHING]);
  });

  it("a partly measured week names its unmeasured sections, and never the nothing-to-report line", () => {
    const measurement = { state: "partial", unmeasured: [f.LABEL_KEY] } as const;
    expect(chooseWholeMailLine({ blocks: SILENT_BLOCKS, measurement })).toBe(PARTIAL_WEEK);
    // The slot carries the unmeasured section's own name, as written.
    expectLine(
      composeSilentWeekly(measurement),
      PARTIAL_WEEK,
      copy(PARTIAL_WEEK, { sections: COPY[f.LABEL_KEY] })
    );
    const mail = composeSilentWeekly(measurement)();
    expect(mail.text).not.toContain(COPY[NOTHING]);
    expect(mail.html).not.toContain(COPY[NOTHING]);

    // The partial line stands even where the mail did have something to
    // say — dropping sections silently is what it exists to prevent.
    expect(chooseWholeMailLine({ blocks: SPEAKING_BLOCKS, measurement })).toBe(PARTIAL_WEEK);
  });

  it("a complete week falls through to the ordinary choice", () => {
    const measurement = { state: "complete" } as const;
    expect(chooseWholeMailLine({ blocks: SILENT_BLOCKS, measurement })).toBe(NOTHING);
    expect(chooseWholeMailLine({ blocks: SPEAKING_BLOCKS, measurement })).toBeNull();
  });

  it("a measured-full list is not silence", () => {
    const blocks = [f.list(measured([{ label: f.HEADING_KEY }] as const, f.AT))];
    expect(chooseWholeMailLine({ blocks })).toBeNull();
  });
});
