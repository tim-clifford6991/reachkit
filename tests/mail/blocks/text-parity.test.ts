// BUILD §12 — every mail carries a plain-text alternative, of the same blocks.
import { describe, expect, it } from "vitest";
import { renderBlocksHtml } from "../../../src/lib/mail/blocks/html";
import { renderBlocksText } from "../../../src/lib/mail/blocks/text";
import { measured, measuredZero } from "../../../src/lib/measure/measured";
import * as f from "../fixtures";

// Nine of the ten arms. `pageBody` is exercised in page-body.test.ts,
// where the owner-owed label is handled explicitly.
const ALL_ARMS = [
  f.EYEBROW,
  f.FOOTNOTE,
  f.HEADING,
  f.PARAGRAPH,
  f.stat(f.num(12), { note: f.NOTE_KEY }),
  f.list(measured([{ label: f.HEADING_KEY }] as const, f.AT)),
  f.verdicts(measured([{ subject: f.HEADING_KEY, verdict: f.ACTION_KEY }] as const, f.AT)),
  f.ACTION,
  f.NOTICE,
];

describe("BUILD §12 — the two bodies carry the same blocks", () => {
  it("both bodies are non-empty and agree on what was omitted", () => {
    const html = renderBlocksHtml(ALL_ARMS);
    const text = renderBlocksText(ALL_ARMS);
    expect(html.html.length).toBeGreaterThan(0);
    expect(text.text.length).toBeGreaterThan(0);
    expect(text.omitted).toEqual(html.omitted);
  });

  it("every sentence in the html body is in the text body, and the other way round", () => {
    const html = renderBlocksHtml(ALL_ARMS).html;
    const text = renderBlocksText(ALL_ARMS).text;
    for (const sentence of [f.HEADING_TEXT, f.LABEL_TEXT, f.NOTE_TEXT, f.ACTION_TEXT]) {
      expect(html).toContain(sentence);
      expect(text).toContain(sentence);
    }
    // The action's URL is written out in both — never a bare link with
    // nothing saying what it is.
    expect(text).toContain(`${f.ACTION_TEXT}: https://example.com/x`);
    expect(html).toContain('href="https://example.com/x"');
  });

  it("a measured-empty and a measured-full body both render in text", () => {
    const empty = renderBlocksText([f.list(measuredZero([] as const, f.AT))]).text;
    const full = renderBlocksText([f.list(measured([{ label: f.HEADING_KEY }] as const, f.AT))]).text;
    expect(empty).toContain(f.EMPTY_TEXT);
    expect(full).toContain(f.HEADING_TEXT);
    expect(full).not.toContain(f.EMPTY_TEXT);
  });
});
