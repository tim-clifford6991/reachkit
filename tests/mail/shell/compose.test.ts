// BUILD §12 — composeMail(): one call, both bodies, one omission decision.
import { describe, expect, it } from "vitest";
import { composeMail, type ComposeInput } from "../../../src/lib/mail/shell/compose";
import { renderBlocksHtml } from "../../../src/lib/mail/blocks/html";
import { renderBlocksText } from "../../../src/lib/mail/blocks/text";
import { MAIL_KINDS, type MailKind } from "../../../src/lib/mail/kinds";
import { measured } from "../../../src/lib/measure/measured";
import * as f from "../fixtures";

const BLOCKS = [f.HEADING, f.stat(f.num(3)), f.list(measured([{ label: f.HEADING_KEY }] as const, f.AT))];

describe("BUILD §12 — every mail is composed once and wears one shell", () => {
  it("returns a non-empty html and a non-empty text body for every kind but weekly", async () => {
    for (const kind of Object.keys(MAIL_KINDS) as MailKind[]) {
      if (kind === "weekly") continue;
      const mail = await composeMail({
        kind: kind as Exclude<MailKind, "weekly">,
        subject: f.HEADING_KEY,
        blocks: BLOCKS,
      });
      expect(mail.html.length, kind).toBeGreaterThan(0);
      expect(mail.text.length, kind).toBeGreaterThan(0);
      expect(mail.subject).toBe(f.HEADING_TEXT);
    }
  });

  it("weekly composes with its measurement state", async () => {
    const mail = await composeMail({
      kind: "weekly",
      subject: f.HEADING_KEY,
      blocks: BLOCKS,
      measurement: { state: "complete" },
    });
    expect(mail.html).toContain(f.HEADING_TEXT);
    expect(mail.text).toContain(f.HEADING_TEXT);
    expect(mail.wholeMailLine).toBeNull();
  });

  it("the omitted list is the one both renderers computed", async () => {
    const blocks = [...BLOCKS, f.stat(f.missing<number>())];
    const mail = await composeMail({ kind: "report", subject: f.HEADING_KEY, blocks });
    expect(mail.omitted).toEqual((await renderBlocksHtml(blocks)).omitted);
    expect(mail.omitted).toEqual(renderBlocksText(blocks).omitted);
    expect(mail.omitted).toEqual([3]);
  });

  it("the html body is a whole document and the text body carries no markup", async () => {
    const mail = await composeMail({ kind: "report", subject: f.HEADING_KEY, blocks: BLOCKS });
    expect(mail.html.startsWith("<!doctype html>")).toBe(true);
    expect(mail.html).toContain("</html>");
    expect(mail.text).not.toContain("<");
  });

  it("both frames carry the wordmark, in the same place — first", async () => {
    const mail = await composeMail({ kind: "report", subject: f.HEADING_KEY, blocks: BLOCKS });
    expect(mail.text.startsWith("ReachKit")).toBe(true);
    expect(mail.html).toContain("ReachKit");
  });

  it("is pure: the same input composes byte-for-byte the same two bodies", async () => {
    const once = await composeMail({ kind: "report", subject: f.HEADING_KEY, blocks: BLOCKS });
    const twice = await composeMail({ kind: "report", subject: f.HEADING_KEY, blocks: BLOCKS });
    expect(once.html).toBe(twice.html);
    expect(once.text).toBe(twice.text);
  });

  it("a template cannot author a body: composeMail takes blocks and nothing else", () => {
    const bad: ComposeInput = {
      kind: "report",
      subject: f.HEADING_KEY,
      blocks: BLOCKS,
      // @ts-expect-error — there is no `html` parameter to supply one with.
      html: "<p>mine</p>",
    };
    expect(bad).toBeTruthy();
  });

  it("measurement is required for weekly and rejected for every other kind", () => {
    // @ts-expect-error — a weekly mail without a measurement state.
    const missingMeasurement: ComposeInput = { kind: "weekly", subject: f.HEADING_KEY, blocks: BLOCKS };
    const wrongKind: ComposeInput = {
      kind: "published",
      subject: f.HEADING_KEY,
      blocks: BLOCKS,
      // @ts-expect-error — only a weekly mail carries a measurement state.
      measurement: { state: "complete" },
    };
    expect(missingMeasurement).toBeTruthy();
    expect(wrongKind).toBeTruthy();
  });
});
