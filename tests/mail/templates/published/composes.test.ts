// tests/mail/templates/published/composes.test.ts — issue #457.
//
// The `found` arm, composed with its paragraph written.
//
// `mail.published.verified` is the arm's **paragraph**, and criterion 5
// makes it carry `{checkedAt}`. A `facts` label is read with no vars at
// all (`blocks/html.ts`'s `factRowsOf`, `blocks/text.ts`'s `facts` case),
// so while the same key stood in both places, `copy()`'s rule (b) threw on
// the label the moment a sentence landed in it — and took every
// found-arm published mail with it. The empty-key throw fired first, so
// the registry's own emptiness was hiding the defect.
//
// Since issue #458 (the owner's 2026-09-10 approval) the paragraph carries
// its approved, slotted sentence, and the assertions read the real one.
import { describe, expect, it } from "vitest";
import type { PublishedTelling } from "@/lib/publish/verify";

const { COPY } = await import("@/lib/presentation/copy");
const { buildPublished, formatCheckedAt } = await import("@/lib/mail/templates/published");
const { composeMail } = await import("@/lib/mail/shell/compose");
const { renderBlocksText } = await import("@/lib/mail/blocks/text");
const { renderBlocksHtml } = await import("@/lib/mail/blocks/html");

const LIVE_URL = "https://example.com/how-long-does-a-roof-last";
const CHECKED_AT = new Date(Date.UTC(2026, 8, 2, 14, 30, 0));
const ZONE = "America/New_York";

function measured(value: boolean): { kind: "measured"; value: boolean; at: Date } {
  return { kind: "measured", value, at: CHECKED_AT };
}

const FOUND: PublishedTelling = {
  publicationId: "p1",
  siteId: "s1",
  liveUrl: LIVE_URL,
  result: {
    outcome: "found",
    checkedAt: CHECKED_AT,
    checks: {
      reachable: measured(true),
      indexable: measured(false),
      sitemap: measured(true),
      aiReadable: measured(true),
    },
  },
  failed: ["indexable"],
  siteCondition: null,
  copy: "mail.published.verified",
};

const STAMP = formatCheckedAt(CHECKED_AT, ZONE);

describe("issue #457 — the found arm composes once its paragraph is written", () => {
  const mail = () => buildPublished({ telling: FOUND, timeZone: ZONE });

  it("renders both bodies instead of throwing on a slot the label cannot supply", async () => {
    const blocks = mail().blocks;
    expect(() => renderBlocksText(blocks)).not.toThrow();
    // The two HTML-side calls resolve rather than return since #934 —
    // React Email's renderer is asynchronous. Still the same claim: this
    // arm composes, where it used to throw on an unsupplied slot.
    await expect(renderBlocksHtml(blocks)).resolves.toBeDefined();
    await expect(
      composeMail({ kind: "published", subject: mail().subject, blocks, reason: mail().reason })
    ).resolves.toBeDefined();
  });

  it("the paragraph carries the date, and leaves no marker behind", () => {
    const { text } = renderBlocksText(mail().blocks);
    const paragraph = COPY["mail.published.verified"];
    expect(paragraph).toContain("{checkedAt}");
    expect(text).toContain(paragraph.replace("{checkedAt}", STAMP));
    expect(text).not.toContain("{checkedAt}");
  });

  it("the date is said once, in the paragraph, and the one fact row is the address", () => {
    const { text } = renderBlocksText(mail().blocks);
    expect(text.split(STAMP)).toHaveLength(2);
    const facts = mail().blocks.filter((b) => b.block === "facts");
    expect(facts).toEqual([{ block: "facts", items: [{ label: "mail.published.address_label", value: LIVE_URL }] }]);
  });
});
