// SPEC §8 (2026-09-20, #933) — the two arms the approved boards added: the
// one number up top, and the numbers beside it.
//
// They are numbers, so BUILD §12's omission rule governs them and this file
// is mostly about what happens when a measurement is missing. The rule has
// one new edge: a *group* of numbers drops its own rows one at a time and
// goes entirely only when none of them was measured — a mail that lost one
// of four keeps the shape rather than leaving a gap where a number was.
import { describe, expect, it } from "vitest";
import { renderBlocksHtml } from "../../../src/lib/mail/blocks/html";
import { renderBlocksText } from "../../../src/lib/mail/blocks/text";
import { keptStatRows, omittedIndexes } from "../../../src/lib/mail/blocks/omit";
import type { MailBlock } from "../../../src/lib/mail/blocks/types";
import * as f from "../fixtures";

describe("#933 — the one number up top", () => {
  it("carries its number, its label and its change, in both bodies", async () => {
    const blocks = [f.hero(f.num(62), { change: f.num(6) })];
    const { html } = await renderBlocksHtml(blocks);
    const { text } = renderBlocksText(blocks);

    expect(html).toContain("62");
    expect(html).toContain("+6");
    expect(html).toContain(f.LABEL_TEXT);
    // The twin states the same three things on its own two lines.
    expect(text).toContain(f.LABEL_TEXT);
    expect(text).toContain("62");
    expect(text).toContain("+6");
  });

  it("a change nothing measured is no change stated — never a zero", async () => {
    const blocks = [f.hero(f.num(62), { change: f.missing<number>() })];
    expect(omittedIndexes(blocks)).toEqual([]);
    const { html } = await renderBlocksHtml(blocks);
    expect(html).toContain("62");
    expect(html).not.toContain("+0");
    expect(renderBlocksText(blocks).text).not.toContain("(");
  });

  it("a number nothing measured takes the whole block, its change included", async () => {
    const blocks = [f.hero(f.missing<number>(), { change: f.num(6) }), f.PARAGRAPH];
    expect(omittedIndexes(blocks)).toEqual([0]);
    const { html } = await renderBlocksHtml(blocks);
    const { text } = renderBlocksText(blocks);
    for (const body of [html, text]) {
      expect(body).not.toContain(f.LABEL_TEXT);
      expect(body).not.toContain("+6");
      // What stood beside it still stands.
      expect(body).toContain(f.HEADING_TEXT);
    }
  });

  it("a measured zero is a result and is printed", async () => {
    const { html } = await renderBlocksHtml([f.hero(f.num(0))]);
    expect(html).toContain("0");
  });
});

describe("#933 — the numbers beside it", () => {
  const group = (): MailBlock =>
    f.stats([
      { value: f.num(34), change: f.num(5) },
      { value: f.missing<number>(), change: f.num(9) },
      { value: f.num(12) },
    ]);

  it("drops the row nothing measured and keeps the rest — and its change goes with it", async () => {
    expect(keptStatRows(group() as Extract<MailBlock, { block: "stats" }>)).toHaveLength(2);
    expect(omittedIndexes([group()])).toEqual([]);

    const { html } = await renderBlocksHtml([group()]);
    const { text } = renderBlocksText([group()]);
    for (const body of [html, text]) {
      expect(body).toContain("34");
      expect(body).toContain("+5");
      expect(body).toContain("12");
      // The unmeasured row's own change never appears without its number.
      expect(body).not.toContain("+9");
    }
  });

  it("a group whose every number is missing is dropped whole", async () => {
    const empty = f.stats([{ value: f.missing<number>() }, { value: f.missing<number>() }]);
    expect(omittedIndexes([empty, f.PARAGRAPH])).toEqual([0]);
    expect((await renderBlocksHtml([empty])).html).toBe("");
    expect(renderBlocksText([empty]).text).toBe("");
  });

  it("the two bodies state the same numbers, in the same order", async () => {
    const { html } = await renderBlocksHtml([group()]);
    const { text } = renderBlocksText([group()]);
    const order = (body: string): number[] =>
      [...body.matchAll(/\b(34|12)\b/g)].map((match) => Number(match[1]));
    expect(order(text)).toEqual([34, 12]);
    expect(order(html)).toEqual([34, 12]);
  });

  it("it is laid out as table rows — the one layout an inbox is relied on for", async () => {
    const { html } = await renderBlocksHtml([group()]);
    expect(html).toContain('role="presentation"');
    expect(html).not.toContain("display:grid");
    expect(html).not.toContain("display:flex");
  });
});

describe("#933 — a mail may offer two buttons, and only one of them is solid", () => {
  it("the second is outlined, and both are links to their own address", async () => {
    const primary: MailBlock = {
      block: "action",
      label: f.ACTION_KEY,
      href: "https://example.com/read",
      variant: "primary",
    };
    const secondary: MailBlock = {
      block: "action",
      label: f.ACTION_KEY,
      href: "https://example.com/stop",
      variant: "secondary",
    };
    const { html } = await renderBlocksHtml([primary, secondary]);

    expect(html).toContain("https://example.com/read");
    expect(html).toContain("https://example.com/stop");
    // One fill, one outline.
    expect(html.split("border:1px solid").length - 1).toBe(1);

    // The twin names both, each with its label — never a bare URL.
    const { text } = renderBlocksText([primary, secondary]);
    expect(text).toContain(`${f.ACTION_TEXT}: https://example.com/read`);
    expect(text).toContain(`${f.ACTION_TEXT}: https://example.com/stop`);
  });

  it("an action with no variant is the solid one, exactly as before #933", async () => {
    const { html } = await renderBlocksHtml([f.ACTION]);
    expect(html).not.toContain("border:1px solid");
  });
});
