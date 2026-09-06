// BUILD §13 — the two `account` mails REQ-024 obliges.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";

applyEnvFixture();

const { buildChaseWithLink, buildChaseWithoutLink, buildSecondPurchase } = await import(
  "../../../../src/lib/mail/templates/account"
);
const { MAIL_KINDS } = await import("../../../../src/lib/mail/kinds");
const { COPY } = await import("../../../../src/lib/presentation/copy");

const HREF = "https://reachkit.example/signin?t=tok";

describe('REQ-024 c5 — the chase: a working link where the account is open, or a statement that it is not', () => {
  it("the open arm carries the link", () => {
    expect(buildChaseWithLink({ href: HREF }).blocks).toEqual([
      { block: "paragraph", text: "mail.account.chase.link_ready" },
      { block: "action", label: "mail.magicLink.action", href: HREF },
      { block: "notice", text: "mail.account.reach_a_person" },
    ]);
  });

  it("the unopened arm carries no action — an action here could only point somewhere that does not work", () => {
    const blocks = buildChaseWithoutLink().blocks;
    expect(blocks.some((block) => block.block === "action")).toBe(false);
    expect(blocks[0]).toEqual({ block: "paragraph", text: "mail.account.chase.not_open_yet" });
  });

  it("the two arms speak different lines — they are two statements, not one with a variable", () => {
    const open = buildChaseWithLink({ href: HREF }).blocks[0] as { text: string };
    const notOpen = buildChaseWithoutLink().blocks[0] as { text: string };
    expect(open.text).not.toBe(notOpen.text);
  });

  it("neither arm names a price key or a checkout URL — it never asks for payment again", () => {
    for (const mail of [buildChaseWithLink({ href: HREF }), buildChaseWithoutLink()]) {
      const serialised = JSON.stringify(mail);
      expect(serialised).not.toMatch(/price\./);
      expect(serialised).not.toContain("checkout.stripe.com");
    }
  });
});

describe('REQ-024 c3 — a founder whose second purchase was charged is told it bought no second subscription', () => {
  it("says so, and names a way to reach a person", () => {
    expect(buildSecondPurchase().blocks).toEqual([
      { block: "paragraph", text: "mail.account.no_second_subscription" },
      { block: "notice", text: "mail.account.reach_a_person" },
    ]);
  });

  it("its subject is its own, not the chase's", () => {
    expect(buildSecondPurchase().subject).not.toBe(buildChaseWithLink({ href: HREF }).subject);
  });
});

describe('REQ-024 c3/c5 — every account mail names one way to reach a person', () => {
  it.each([
    ["chase, open", buildChaseWithLink({ href: HREF })],
    ["chase, not open", buildChaseWithoutLink()],
    ["second purchase", buildSecondPurchase()],
  ])("%s", (_name, mail) => {
    const blocks = mail.blocks as readonly { text?: string }[];
    expect(blocks.some((block) => block.text === "mail.account.reach_a_person")).toBe(true);
  });
});

describe("the register row, and the sentences still owed", () => {
  it("account mail cannot be stopped: it is about money that left a bank", () => {
    expect(MAIL_KINDS.account.stoppable).toBe(false);
    expect(MAIL_KINDS.account.occasionsFrom).toBe("§13");
  });

  it("every key these mails speak is in the registry", () => {
    const keys = [
      "mail.account.chase.subject",
      "mail.account.chase.link_ready",
      "mail.account.chase.not_open_yet",
      "mail.account.second_purchase.subject",
      "mail.account.no_second_subscription",
      "mail.account.reach_a_person",
    ] as const;
    for (const key of keys) expect(Object.keys(COPY)).toContain(key);
  });

  it("all six are owner-owed and empty, so the seam refuses to compose rather than shipping a blank line", () => {
    const keys = [
      "mail.account.chase.subject",
      "mail.account.chase.link_ready",
      "mail.account.chase.not_open_yet",
      "mail.account.second_purchase.subject",
      "mail.account.no_second_subscription",
      "mail.account.reach_a_person",
    ] as const;
    for (const key of keys) expect(COPY[key]).toBe("");
  });
});
