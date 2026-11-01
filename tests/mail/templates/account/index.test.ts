// BUILD §13 — the `account` mails REQ-024 and REQ-077 oblige.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";

applyEnvFixture();

const { buildAddressMoved, buildChaseWithLink, buildChaseWithoutLink, buildRenewalRefunded, buildSecondPurchase } =
  await import("../../../../src/lib/mail/templates/account");
const { renderBlocksText } = await import("../../../../src/lib/mail/blocks/text");
const { MAIL_KINDS } = await import("../../../../src/lib/mail/kinds");
const { COPY } = await import("../../../../src/lib/presentation/copy");
const { COPY_META, OWNER_OWED } = await import("../../../../src/lib/presentation/copy/registry");
const { composeMail } = await import("../../../../src/lib/mail/shell/compose");
const { escapeHtml } = await import("../../../../src/lib/mail/blocks/html");

const HREF = "https://reachkit.example/signin?t=tok";

/** Every sentence the `account` kind speaks. Six from REQ-024 (#33), two
 *  from REQ-077 c3 (#35). */
const ACCOUNT_MAIL_KEYS = [
  "mail.account.chase.subject",
  "mail.account.chase.link_ready",
  "mail.account.chase.not_open_yet",
  "mail.account.second_purchase.subject",
  "mail.account.no_second_subscription",
  "mail.account.reach_a_person",
  "mail.account.address_moved.subject",
  "mail.account.address_moved",
] as const;

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

describe('REQ-077 c3 (issue #35) — the address has moved, and the old one is told', () => {
  it("says so, and names a way to reach a person", () => {
    expect(buildAddressMoved()).toEqual({
      subject: "mail.account.address_moved.subject",
      preheader: "mail.account.address_moved.preheader",
      blocks: [
        { block: "paragraph", text: "mail.account.address_moved" },
        { block: "notice", text: "mail.account.reach_a_person" },
      ],
    });
  });

  it("carries no action: the change is already made, and there is nothing here to do", () => {
    const blocks = buildAddressMoved().blocks as readonly { block: string }[];
    expect(blocks.some((block) => block.block === "action")).toBe(false);
  });

  it("names neither address — it arrives at one, and must not carry the other", () => {
    // The template holds keys, and neither key takes a slot: a template with
    // an `{email}` slot is one edit away from putting the account's live
    // sign-in address in the mailbox the customer is leaving.
    for (const key of ["mail.account.address_moved.subject", "mail.account.address_moved"] as const) {
      expect(COPY_META[key].slots).toEqual({});
    }
  });
});

describe('REQ-024 c3/c5, REQ-077 c3 — every account mail names one way to reach a person', () => {
  it.each([
    ["chase, open", buildChaseWithLink({ href: HREF })],
    ["chase, not open", buildChaseWithoutLink()],
    ["second purchase", buildSecondPurchase()],
    ["address moved", buildAddressMoved()],
  ])("%s", (_name, mail) => {
    const blocks = mail.blocks as readonly { text?: string }[];
    expect(blocks.some((block) => block.text === "mail.account.reach_a_person")).toBe(true);
  });
});

describe("the register row, and the sentences it speaks", () => {
  it("account mail cannot be stopped: it is about money that left a bank", () => {
    expect(MAIL_KINDS.account.stoppable).toBe(false);
    expect(MAIL_KINDS.account.occasionsFrom).toBe("§13");
  });

  it("every key these mails speak is in the registry", () => {
    for (const key of ACCOUNT_MAIL_KEYS) expect(Object.keys(COPY)).toContain(key);
  });

  it("all eight are written (issue #458, the owner's 2026-09-10 approval), so every account mail composes and speaks them", async () => {
    expect(ACCOUNT_MAIL_KEYS).toHaveLength(8);
    for (const key of ACCOUNT_MAIL_KEYS) {
      expect(COPY[key], key).not.toBe("");
      expect(OWNER_OWED, key).not.toContain(key);
    }

    const spoken = new Set<string>();
    for (const mail of [
      buildChaseWithLink({ href: HREF }),
      buildChaseWithoutLink(),
      buildSecondPurchase(),
      buildAddressMoved(),
    ]) {
      const composed = await composeMail({ kind: "account", subject: mail.subject, blocks: mail.blocks });
      expect(composed.subject, mail.subject).toBe(COPY[mail.subject]);
      spoken.add(mail.subject);
      for (const block of mail.blocks) {
        if (block.block !== "paragraph" && block.block !== "notice") continue;
        expect(composed.text, block.text).toContain(COPY[block.text]);
        expect(composed.html, block.text).toContain(escapeHtml(COPY[block.text]));
        spoken.add(block.text);
      }
    }
    expect([...spoken].sort()).toEqual([...ACCOUNT_MAIL_KEYS].sort());
  });
});

describe("owner D10 · E2 — the first-renewal refund mail states the amount, then the renewal or end date", () => {
  const REFUNDED =
    "No page of yours went live in your first month, so we refunded this month’s payment of €49.00 in full. Your bank usually shows it within 5 to 10 business days.";
  const PERSON = "To reach a person, reply to this mail.";
  const text = (next: Parameters<typeof buildRenewalRefunded>[0]["next"]): string =>
    renderBlocksText(buildRenewalRefunded({ amount: "€49.00", next }).blocks).text;

  it("renewing: the next payment's day and the way to stop it", () => {
    expect(text({ kind: "renewing", date: "November 30, 2026" })).toBe(
      [
        REFUNDED,
        "ReachKit keeps running, and your next payment is taken as usual on November 30, 2026. To stop it, use Cancel plan in Settings › Billing.",
        PERSON,
      ].join("\n\n")
    );
  });

  it("cancelled: the day ReachKit stops, and no next payment", () => {
    const ending = text({ kind: "ending", date: "November 30, 2026" });
    expect(ending).toBe([REFUNDED, "ReachKit keeps running until November 30, 2026.", PERSON].join("\n\n"));
    expect(ending).not.toContain("next payment");
    expect(ending).not.toContain("Cancel plan in Settings");
  });

  it("no readable subscription: the refund sentence alone, with no day", () => {
    expect(text(null)).toBe([REFUNDED, PERSON].join("\n\n"));
  });
});
