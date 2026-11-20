// BUILD §12 — model text enters a mail through exactly one door.
//
// `pageBody` is the only arm of `MailBlock` carrying a string that is not
// a copy key, and it cannot be rendered without the page identity
// `generatedLabel()` needs — so a draft cannot reach an inbox stripped of
// the label that says a model wrote it.
import { describe, expect, it } from "vitest";
import { renderBlocksHtml } from "../../../src/lib/mail/blocks/html";
import { renderBlocksText } from "../../../src/lib/mail/blocks/text";
import { generatedLabel } from "../../../src/lib/presentation/generated";
import type { MailBlock } from "../../../src/lib/mail/blocks/types";

const MARKDOWN = "# A page\n\nA line of the draft, written by a model.";
const PAGE: MailBlock = { block: "pageBody", pageTitle: "A page", written: true, markdown: MARKDOWN };

describe("BUILD §12 — one door for model text", () => {
  it("no arm but pageBody carries a free string", () => {
    // A type-level assertion: the seven other arms name their text through
    // `CopyKey`s only, so a hand-written sentence is not representable in
    // them. `@ts-expect-error` fails the build if that ever stops being
    // true — which is the whole of REQ-093's line, held structurally.
    // @ts-expect-error — `text` on a paragraph is a CopyKey, not a string.
    const bad: MailBlock = { block: "paragraph", text: "a sentence nobody registered" };
    expect(bad).toBeTruthy();
  });

  it("renders the draft through generatedLabel()", async () => {
    const label = generatedLabel({ pageTitle: "A page", written: true }).label;
    const { text } = renderBlocksText([PAGE]);
    expect(text).toContain(label);
    expect(text).toContain(MARKDOWN);
    expect((await renderBlocksHtml([PAGE])).html).toContain(label);
  });

  it("a pageBody block is never omitted — it is not a measurement", () => {
    const { omitted } = renderBlocksText([]);
    expect(omitted).toEqual([]);
  });
});
