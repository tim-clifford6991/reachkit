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
// Since issue #458 (the owner's 2026-09-10 approval) that future is the
// registry itself: the paragraph carries its approved, slotted sentence,
// so the mock below fills only keys still owed elsewhere, and the
// paragraph assertion reads the real sentence. The mock stays: it is the
// one shape
// the suite beside it cannot express, which is why this file mocks the
// registry and lives on its own — `index.test.ts` asserts the standing
// where the keys are still owed, and both must stay true.
import { describe, expect, it, vi } from "vitest";
import type { PublishedTelling } from "@/lib/publish/verify";

/** Every owner-owed key resolves to a written sentence, so composing
 *  reaches the label instead of stopping at the first empty key. The
 *  paragraph gets its slot marker; the rest need only be non-empty.
 *  `COPY_META` and the key union are the real ones, so a slot this
 *  fixture forgets is still a real `copy()` throw. */
const PARAGRAPH_SENTENCE = "It is live, and it answered every check on {checkedAt}.";

vi.mock("@/lib/presentation/copy/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy/registry")>();
  const written: Record<string, string> = { ...actual.COPY };
  for (const key of actual.OWNER_OWED) {
    written[key] = key === "mail.published.verified" ? PARAGRAPH_SENTENCE : `Written: ${key}`;
  }
  return { ...actual, COPY: written, OWNER_OWED: [] as readonly string[] };
});

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

  it("renders both bodies instead of throwing on a slot the label cannot supply", () => {
    const blocks = mail().blocks;
    expect(() => renderBlocksText(blocks)).not.toThrow();
    expect(() => renderBlocksHtml(blocks)).not.toThrow();
    expect(() =>
      composeMail({ kind: "published", subject: mail().subject, blocks, reason: mail().reason })
    ).not.toThrow();
  });

  it("the paragraph carries the date, and leaves no marker behind", () => {
    const { text } = renderBlocksText(mail().blocks);
    const paragraph = COPY["mail.published.verified"];
    expect(paragraph).toContain("{checkedAt}");
    expect(paragraph).not.toBe(PARAGRAPH_SENTENCE);
    expect(text).toContain(paragraph.replace("{checkedAt}", STAMP));
    expect(text).not.toContain("{checkedAt}");
  });

  it("the fact row reads the approved word, and the date is its value", () => {
    const { text } = renderBlocksText(mail().blocks);
    expect(text).toContain(`verified: ${STAMP}`);
  });

  it("the label is its own key — the paragraph's key is never read as one", () => {
    const facts = mail().blocks.find((b) => b.block === "facts");
    if (facts?.block !== "facts") throw new Error("unreachable");
    expect(facts.items.map((item) => item.label)).toEqual([
      "mail.published.address_label",
      "mail.published.verified_label",
    ]);
    // Ruling 11a: S20 draws this row "verified", unbracketed, so the word
    // is the set's and not a sentence this test invented.
    expect(COPY["mail.published.verified_label"]).toBe("verified");
  });
});
