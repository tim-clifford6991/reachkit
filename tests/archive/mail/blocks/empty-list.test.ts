// BUILD §12 — a measured-empty list states that empty result in one line.
import { describe, expect, it } from "vitest";
import { renderBlocksHtml } from "../../../src/lib/mail/blocks/html";
import { renderBlocksText } from "../../../src/lib/mail/blocks/text";
import { isMeasuredEmpty, omittedIndexes } from "../../../src/lib/mail/blocks/omit";
import { measuredZero } from "../../../src/lib/measure/measured";
import * as f from "../fixtures";

const EMPTY_LIST = f.list(measuredZero([] as const, f.AT));
const EMPTY_VERDICTS = f.verdicts(measuredZero([] as const, f.AT));

describe("BUILD §12 — measured-and-empty is not the same fact as unmeasured", () => {
  it("a measured-empty list is kept and renders its written empty line", async () => {
    expect(omittedIndexes([EMPTY_LIST])).toEqual([]);
    expect(isMeasuredEmpty(EMPTY_LIST)).toBe(true);

    const { text } = renderBlocksText([EMPTY_LIST]);
    expect(text).toContain(f.LABEL_TEXT);
    expect(text).toContain(f.EMPTY_TEXT);

    const { html } = await renderBlocksHtml([EMPTY_LIST]);
    expect(html).toContain(f.EMPTY_TEXT);
  });

  it("the same holds for a verdicts block", () => {
    expect(isMeasuredEmpty(EMPTY_VERDICTS)).toBe(true);
    expect(renderBlocksText([EMPTY_VERDICTS])).toHaveProperty("text", expect.stringContaining(f.EMPTY_TEXT));
  });

  it("an unmeasured list is not measured-empty — it is omitted instead", () => {
    const unmeasuredList = f.list(f.missing<readonly { label: typeof f.LABEL_KEY }[]>());
    expect(isMeasuredEmpty(unmeasuredList)).toBe(false);
    expect(omittedIndexes([unmeasuredList])).toEqual([0]);
    expect(renderBlocksText([unmeasuredList]).text).not.toContain(f.EMPTY_TEXT);
  });

  it("a stat is never empty — a measured number, zero included, is a result", () => {
    expect(isMeasuredEmpty(f.stat(f.num(0)))).toBe(false);
  });
});
