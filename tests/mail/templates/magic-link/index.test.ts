// BUILD §13 — the sign-in link a completed payment sends.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";

applyEnvFixture();

const { buildMagicLink } = await import("../../../../src/lib/mail/templates/magic-link");
const { MAIL_KINDS } = await import("../../../../src/lib/mail/kinds");
const { COPY } = await import("../../../../src/lib/presentation/copy");

const HREF = "https://reachkit.example/signin?t=tok";
const ADDRESS = "anna@example.com";
const build = (): ReturnType<typeof buildMagicLink> =>
  buildMagicLink({ href: HREF, address: ADDRESS });

describe('§13 — "send magic link → /setup"', () => {
  it("SPEC §8's shape: heading, one line, the one action, then the address it was sent to", () => {
    // The address is a fact row because this mail is a credential: a
    // reader sent one at an address they do not recognise can see that
    // beside the button.
    expect(build().blocks).toEqual([
      { block: "heading", text: "mail.magicLink.heading" },
      { block: "paragraph", text: "mail.magicLink.body" },
      { block: "action", label: "mail.magicLink.action", href: HREF },
      { block: "facts", items: [{ label: "mail.magicLink.fact.for", value: ADDRESS }] },
    ]);
  });

  it("the link is required — a mail cannot be built without one", () => {
    // The action's href is a required field of the argument, so a template
    // whose link failed to issue is unrepresentable rather than merely
    // untested. `sendSignInLink` is what enforces the order.
    expect(buildMagicLink.length).toBe(1);
  });

  it("every sentence it speaks is a registry key", () => {
    const mail = build();
    for (const key of [mail.subject, "mail.magicLink.body", "mail.magicLink.action"]) {
      expect(Object.keys(COPY)).toContain(key);
    }
  });
});

describe("ADR-042 — the mail that is the credential carries no opt-out", () => {
  it("the register row says it cannot be stopped", () => {
    expect(MAIL_KINDS["magic-link"].stoppable).toBe(false);
    expect(MAIL_KINDS["magic-link"].occasionsFrom).toBe("§13");
  });

  it("the template carries no opt-out control at all", () => {
    // An address-wide unsubscribe reaching this kind locks a paying
    // customer out of the product with no recovery channel.
    // `reason` is S20's footer line, not a stop control: it says why the
    // mail arrived, and this kind's says "you asked for this link".
    expect(Object.keys(build()).sort()).toEqual(["blocks", "reason", "subject"]);
    expect(build().reason).toBe("mail.reason.magicLink");
  });
});

describe("the sentences are the approved set's, word for word", () => {
  it("all three are filled from S20 under ruling 11a", () => {
    // They were owner-owed and empty until 2026-09-08, when the owner
    // approved the screen set and ruled (11a) that its unbracketed strings
    // are approved copy as written. S20 draws this mail with all three
    // written, so filling them is transcription; each is asserted by its
    // own words, so a reword fails here.
    expect(COPY["mail.magicLink.subject"]).toBe("Your sign-in link");
    expect(COPY["mail.magicLink.heading"]).toBe("Sign in to ReachKit");
    expect(COPY["mail.magicLink.body"]).toBe(
      "One click signs you in on this device. The link works once and expires in 15 minutes."
    );
    expect(COPY["mail.magicLink.action"]).toBe("Sign in");
  });

  it("the mail composes — which, for the credential, is the point", async () => {
    // DECISIONS 2026-09-05 (#93): "mail keeps the throw (a mail never ships
    // a placeholder)". Until the set was approved this kind could not be
    // sent at all: `copy()` threw on its subject and `sendEmail` answered
    // `not-composable`. A paying customer's way back in now composes.
    const { composeMail } = await import("../../../../src/lib/mail/shell/compose");
    const mail = build();
    const composed = composeMail({
      kind: "magic-link",
      subject: mail.subject,
      blocks: mail.blocks,
      reason: mail.reason,
    });
    expect(composed.subject).toBe("Your sign-in link");
    expect(composed.text).toContain(ADDRESS);
  });
});

const { composeMail } = await import("../../../../src/lib/mail/shell/compose");

describe("#637 — the composed mail, as an inbox receives it", () => {
  const mail = build();
  const { html, text } = composeMail({ kind: "magic-link", subject: mail.subject, blocks: mail.blocks, reason: mail.reason });
  const inOrder = (body: string, parts: readonly string[]): void => {
    const at = parts.map((part) => body.indexOf(part));
    expect(at.every((i) => i >= 0), `every part is present: ${at.join(",")}`).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  };
  const [heading, body, reason] = [COPY["mail.magicLink.heading"], COPY["mail.magicLink.body"], COPY["mail.reason.magicLink"]];

  it("both bodies read heading, line, action, fact row, then the reason footer", () => {
    inOrder(html, [heading, body, `>${COPY["mail.magicLink.action"]}</a>`, ADDRESS, reason]);
    inOrder(text, [heading, body, HREF, ADDRESS, reason]);
  });

  it("one solid action — a single link on a filled table cell — and no stop control", () => {
    expect([...html.matchAll(/<a href="([^"]*)"/g)].map((m) => m[1])).toEqual([HREF]);
    expect(html).toMatch(/<td bgcolor="#[0-9a-f]{6}"[^>]*><a href=/);
    expect(html).not.toMatch(/\sclass="/);
    for (const b of [html, text]) {
      expect(b).not.toContain(COPY["mail.optout.label"]);
      expect(b).not.toContain(COPY["mail.unsubscribe.label"]);
    }
  });
});
