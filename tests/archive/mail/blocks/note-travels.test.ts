// BUILD §12 — a stat's note travels with its value or not at all.
//
// The measurement disclosure that must accompany a figure sent outside the
// report is a `note` on the block carrying that figure. When the figure is
// unmeasured the whole block goes, disclosure included — a disclosure left
// standing beside a number that was dropped would be describing nothing.
import { describe, expect, it } from "vitest";
import { renderBlocksHtml } from "../../../src/lib/mail/blocks/html";
import { renderBlocksText } from "../../../src/lib/mail/blocks/text";
import * as f from "../fixtures";

describe("BUILD §12 — the note and its value are one block", () => {
  it("renders the note with its value", async () => {
    const blocks = [f.stat(f.num(320), { format: "perMonth", note: f.NOTE_KEY })];
    const { text } = renderBlocksText(blocks);
    expect(text).toContain("320/mo");
    expect(text).toContain(f.NOTE_TEXT);
    expect((await renderBlocksHtml(blocks)).html).toContain(f.NOTE_TEXT);
  });

  it("drops the note with its value", async () => {
    const blocks = [f.stat(f.missing<number>(), { format: "perMonth", note: f.NOTE_KEY })];
    const { text, omitted } = renderBlocksText(blocks);
    expect(omitted).toEqual([0]);
    expect(text).not.toContain(f.NOTE_TEXT);
    expect((await renderBlocksHtml(blocks)).html).not.toContain(f.NOTE_TEXT);
  });

  it("a stat with no note renders its value and nothing else", () => {
    const { text } = renderBlocksText([f.stat(f.num(7))]);
    expect(text).toBe(`${f.LABEL_TEXT}: 7`);
  });
});
