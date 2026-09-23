// BUILD §12 — the omission rule holds identically in the plain-text body.
//
// A rule that held in one body and not the other is the failure the single
// shared omission decision (`omit.ts`) exists to prevent, so it is
// asserted on the second renderer too.
import { describe, expect, it } from "vitest";
import { renderBlocksHtml } from "../../../src/lib/mail/blocks/html";
import { renderBlocksText } from "../../../src/lib/mail/blocks/text";
import { measured } from "../../../src/lib/measure/measured";
import * as f from "../fixtures";

const MIXED = [
  f.HEADING,
  f.stat(f.missing<number>()),
  f.list(measured([{ label: f.HEADING_KEY }] as const, f.AT)),
];

describe("BUILD §12 — one omission decision, two bodies", () => {
  it("the unmeasured block is absent from the text body and its index is in omitted", () => {
    const { text, omitted } = renderBlocksText(MIXED);
    expect(omitted).toEqual([1]);
    expect(text).not.toMatch(/\d/);
    expect(text).toContain(f.HEADING_TEXT);
    expect(text).toContain(f.LABEL_TEXT); // the kept list's own label
  });

  it("both renderers return the identical omitted list, for every shape", async () => {
    for (const blocks of [MIXED, [], [f.HEADING], [f.stat(f.missing<number>())]]) {
      expect(renderBlocksText(blocks).omitted).toEqual((await renderBlocksHtml(blocks)).omitted);
    }
  });
});
