// BUILD §12 — "a missing number omits its section, never prints 0".
import { describe, expect, it } from "vitest";
import { renderBlocksHtml } from "../../../src/lib/mail/blocks/html";
import { renderBlocksText } from "../../../src/lib/mail/blocks/text";
import { omittedIndexes } from "../../../src/lib/mail/blocks/omit";
import { formatStat } from "../../../src/lib/mail/blocks/format";
import * as f from "../fixtures";

const BLOCKS = [
  f.HEADING,
  f.stat(f.missing<number>()),
  f.list(f.missing<readonly { label: typeof f.LABEL_KEY }[]>()),
  f.verdicts(f.missing<readonly { subject: typeof f.LABEL_KEY; verdict: typeof f.LABEL_KEY }[]>()),
  f.PARAGRAPH,
];

describe("BUILD §12 — an unmeasured section is left out entirely", () => {
  it("drops the unmeasured stat, list and verdicts blocks and keeps the rest", () => {
    expect(omittedIndexes(BLOCKS)).toEqual([1, 2, 3]);
  });

  it("emits no zero, dash or placeholder in either body where a section was dropped", async () => {
    const { text } = renderBlocksText(BLOCKS);
    const { html } = await renderBlocksHtml(BLOCKS);

    // The dropped blocks' own sentences are absent from both bodies.
    expect(text).not.toContain(f.LABEL_TEXT);
    expect(html).not.toContain(f.LABEL_TEXT);
    expect(text).not.toContain(f.EMPTY_TEXT);

    // And nothing stands in their place. Asserted on the text body, which
    // carries no markup of its own — an HTML body's `padding:0` is layout,
    // not a printed value.
    expect(text).not.toMatch(/\d/);
    expect(text).not.toContain("—");
    expect(text).not.toContain("N/A");
    expect(text).not.toContain("null");

    // The kept blocks are still there — an assertion that passes only
    // because omission is selective, not because the body is empty.
    expect(text).toContain(f.HEADING_TEXT);
    expect(html).toContain(f.HEADING_TEXT);
  });

  it("a block with no measured value is never dropped", () => {
    expect(omittedIndexes([f.HEADING, f.PARAGRAPH, f.ACTION, f.NOTICE])).toEqual([]);
  });

  it("the formatter refuses an unmeasured value rather than inventing one", () => {
    // The path is unreachable through either renderer; stated as a refusal
    // because every fallback here would be the placeholder BUILD §12
    // forbids.
    expect(() => formatStat(f.missing<number>(), "integer")).toThrow(/omits its section/);
  });
});
