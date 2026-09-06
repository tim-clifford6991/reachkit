// tests/mail/templates/published/index.test.ts — BUILD §12's `published`
// mail: the live address and all four outcomes, sent whether they passed or
// failed.
//
// The two rows that matter beyond the layout:
//
//   - **the outcome never decides whether there is a mail.** Four fixtures,
//     four mails, one occasion.
//   - **the recorded outcome goes in place of the four outcomes.** Under
//     `page_not_found` and `could_not_confirm` there is no `verdicts` block
//     at all, so a template cannot render both.
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { OWNER_OWED } from "@/lib/presentation/copy/registry";
import type { PublishedTelling } from "@/lib/publish/verify";
import { buildPublished, formatCheckedAt } from "@/lib/mail/templates/published";
import type { MailBlock } from "@/lib/mail/blocks/types";

const LIVE_URL = "https://example.com/how-long-does-a-roof-last";
const CHECKED_AT = new Date(Date.UTC(2026, 8, 2, 14, 30, 0));
const ZONE = "America/New_York";

function measured(value: boolean): { kind: "measured"; value: boolean; at: Date } {
  return { kind: "measured", value, at: CHECKED_AT };
}
const UNMEASURED = { kind: "unmeasured", reason: "undeterminable", at: CHECKED_AT } as const;

function foundTelling(over: Partial<PublishedTelling> = {}): PublishedTelling {
  return {
    publicationId: "p1",
    siteId: "s1",
    liveUrl: LIVE_URL,
    result: {
      outcome: "found",
      checkedAt: CHECKED_AT,
      checks: {
        reachable: measured(true),
        indexable: measured(false),
        sitemap: UNMEASURED,
        aiReadable: measured(true),
      },
    },
    failed: ["indexable"],
    siteCondition: null,
    copy: "mail.published.verified",
    ...over,
  };
}

function notFoundTelling(): PublishedTelling {
  return {
    publicationId: "p1",
    siteId: "s1",
    liveUrl: LIVE_URL,
    result: { outcome: "page_not_found", status: 404, checkedAt: CHECKED_AT },
    failed: [],
    siteCondition: null,
    copy: "mail.published.not_found",
  };
}

function notConfirmedTelling(): PublishedTelling {
  return {
    publicationId: "p1",
    siteId: "s1",
    liveUrl: LIVE_URL,
    result: { outcome: "could_not_confirm", why: "server_error", checkedAt: CHECKED_AT },
    failed: [],
    siteCondition: null,
    copy: "mail.published.not_confirmed",
  };
}

function blocksOf(telling: PublishedTelling): readonly MailBlock[] {
  return buildPublished({ telling, timeZone: ZONE }).blocks;
}

describe("buildPublished — one message, all three arms", () => {
  it("carries the live address as the mail's one action", () => {
    const action = blocksOf(foundTelling()).find((b) => b.block === "action");
    expect(action).toEqual({
      block: "action",
      label: "mail.published.address_label",
      href: LIVE_URL,
    });
  });

  it("carries the four outcomes as four verdict rows, in one fixed order", () => {
    const verdicts = blocksOf(foundTelling()).find((b) => b.block === "verdicts");
    expect(verdicts).toBeDefined();
    if (verdicts?.block !== "verdicts") throw new Error("unreachable");
    if (verdicts.items.kind === "unmeasured") throw new Error("unreachable");
    expect(verdicts.items.value.map((row) => row.subject)).toEqual([
      "mail.published.check.reachable",
      "mail.published.check.indexable",
      "mail.published.check.sitemap",
      "mail.published.check.ai_readable",
    ]);
  });

  it("a check that was not observed carries its own word, never the failed one", () => {
    const verdicts = blocksOf(foundTelling()).find((b) => b.block === "verdicts");
    if (verdicts?.block !== "verdicts" || verdicts.items.kind === "unmeasured") {
      throw new Error("unreachable");
    }
    expect(verdicts.items.value.map((row) => row.verdict)).toEqual([
      "mail.published.check_passed",
      "mail.published.check_failed",
      "mail.published.check_not_measured",
      "mail.published.check_passed",
    ]);
  });

  it("is built on the same occasion whether every check passed or any failed", () => {
    const allPassed = foundTelling({
      result: {
        outcome: "found",
        checkedAt: CHECKED_AT,
        checks: {
          reachable: measured(true),
          indexable: measured(true),
          sitemap: measured(true),
          aiReadable: measured(true),
        },
      },
      failed: [],
    });
    expect(blocksOf(allPassed).length).toBe(blocksOf(foundTelling()).length);
  });

  it("under the two criterion-4 arms there is no verdicts block at all", () => {
    for (const telling of [notFoundTelling(), notConfirmedTelling()]) {
      const blocks = blocksOf(telling);
      expect(blocks.some((b) => b.block === "verdicts"), telling.copy).toBe(false);
      // The line the arm selected is there, carrying its date, in place of
      // the four outcomes.
      expect(blocks[0]).toEqual({
        block: "paragraph",
        text: telling.copy,
        vars: { checkedAt: formatCheckedAt(CHECKED_AT, ZONE) },
      });
    }
  });

  it("the two criterion-4 arms speak two different lines", () => {
    expect(blocksOf(notFoundTelling())[0]).not.toEqual(blocksOf(notConfirmedTelling())[0]);
  });

  it("a condition of the site is a block of its own, with its own date", () => {
    const telling = foundTelling({
      siteCondition: { kind: "publishes_no_sitemap", foundAt: CHECKED_AT },
    });
    const notice = blocksOf(telling).find((b) => b.block === "notice");
    expect(notice).toEqual({
      block: "notice",
      text: "mail.published.site_condition.publishes_no_sitemap",
      vars: { foundAt: formatCheckedAt(CHECKED_AT, ZONE) },
    });
  });

  it("no condition means no line — never a line saying the site is fine", () => {
    expect(blocksOf(foundTelling()).some((b) => b.block === "notice")).toBe(false);
  });

  it("every string in the mail is a copy key, and every one of them is owner-owed", () => {
    const telling = foundTelling({
      siteCondition: { kind: "robots_blocks_site", foundAt: CHECKED_AT },
    });
    const mail = buildPublished({ telling, timeZone: ZONE });
    const keys = new Set<string>([mail.subject]);
    for (const block of mail.blocks) {
      if ("text" in block) keys.add(block.text);
      if (block.block === "action") keys.add(block.label);
      if (block.block === "verdicts") {
        keys.add(block.label);
        keys.add(block.emptyLine);
        if (block.items.kind !== "unmeasured") {
          for (const row of block.items.value) {
            keys.add(row.subject);
            keys.add(row.verdict);
          }
        }
      }
    }
    for (const key of keys) {
      expect(COPY[key as keyof typeof COPY], key).toBe("");
      expect(OWNER_OWED).toContain(key);
    }
  });
});

describe("the date the check ran (REQ-062 c2)", () => {
  it("is stated in the time zone the customer set, with the zone named", () => {
    const eastern = formatCheckedAt(CHECKED_AT, "America/New_York");
    const utc = formatCheckedAt(CHECKED_AT, "UTC");
    expect(eastern).not.toBe(utc);
    expect(eastern).toMatch(/10:30/);
    expect(utc).toMatch(/2:30/);
    expect(eastern).toMatch(/[A-Z]{2,5}$/);
  });
});
