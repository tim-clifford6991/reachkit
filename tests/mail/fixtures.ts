// tests/mail/fixtures.ts — shared fixtures for the mail seam's suites.
//
// Every fixture sentence is a real, already-ruled key from the copy
// registry: a test that authored its own string would be asserting against
// something the product cannot say. The four below are chosen because
// none of them contains a digit or an em dash, so the omission suites can
// assert "no zero, dash or placeholder appears" over a rendered body
// without tripping over their own fixture text.
import { measured, measuredZero, unmeasured, type Measured } from "../../src/lib/measure/measured";
import type { CopyKey } from "../../src/lib/presentation/copy";
import type { MailBlock } from "../../src/lib/mail/blocks/types";

export const AT = new Date("2026-09-05T00:00:00.000Z");

export const HEADING_KEY = "band.score.dominant" satisfies CopyKey; // "Dominant"
export const LABEL_KEY = "band.winnability.winnable" satisfies CopyKey; // "Winnable"
export const EMPTY_KEY = "control.retry" satisfies CopyKey; // "Try again"
export const NOTE_KEY = "copy-link.label" satisfies CopyKey; // "Copy link"
export const ACTION_KEY = "severity.low" satisfies CopyKey; // "Minor"

export const HEADING_TEXT = "Dominant";
export const LABEL_TEXT = "Winnable";
export const EMPTY_TEXT = "Try again";
export const NOTE_TEXT = "Copy link";
export const ACTION_TEXT = "Minor";

export function num(value: number): Measured<number> {
  return value === 0 ? measuredZero(0, AT) : measured(value, AT);
}

export function missing<T>(): Measured<T> {
  return unmeasured<T>("undeterminable", AT);
}

export const HEADING: MailBlock = { block: "heading", text: HEADING_KEY };
export const PARAGRAPH: MailBlock = { block: "paragraph", text: HEADING_KEY };
export const ACTION: MailBlock = { block: "action", label: ACTION_KEY, href: "https://example.com/x" };
export const NOTICE: MailBlock = { block: "notice", text: HEADING_KEY };

export function stat(value: Measured<number>, opts?: { note?: CopyKey; format?: "integer" | "delta" | "perMonth" }): MailBlock {
  return opts?.note === undefined
    ? { block: "stat", label: LABEL_KEY, value, format: opts?.format ?? "integer" }
    : { block: "stat", label: LABEL_KEY, value, format: opts?.format ?? "integer", note: opts.note };
}

export const EYEBROW: MailBlock = { block: "eyebrow", text: LABEL_KEY };
export const STEPS: MailBlock = {
  block: "steps",
  items: [{ label: HEADING_KEY, done: true }, { label: ACTION_KEY, line: NOTE_KEY }],
};

export function list(items: Measured<readonly { label: CopyKey }[]>): MailBlock {
  return { block: "list", label: LABEL_KEY, items, emptyLine: EMPTY_KEY };
}

export function verdicts(
  items: Measured<readonly { subject: CopyKey; verdict: CopyKey }[]>
): MailBlock {
  return { block: "verdicts", label: LABEL_KEY, items, emptyLine: EMPTY_KEY };
}
