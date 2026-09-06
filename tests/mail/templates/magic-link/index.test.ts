// BUILD §13 — the sign-in link a completed payment sends.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";

applyEnvFixture();

const { buildMagicLink } = await import("../../../../src/lib/mail/templates/magic-link");
const { MAIL_KINDS } = await import("../../../../src/lib/mail/kinds");
const { COPY } = await import("../../../../src/lib/presentation/copy");

const HREF = "https://reachkit.example/signin?t=tok";

describe('§13 — "send magic link → /setup"', () => {
  it("one paragraph and one action carrying the link it was handed", () => {
    expect(buildMagicLink({ href: HREF }).blocks).toEqual([
      { block: "paragraph", text: "mail.magicLink.body" },
      { block: "action", label: "mail.magicLink.action", href: HREF },
    ]);
  });

  it("the link is required — a mail cannot be built without one", () => {
    // The action's href is a required field of the argument, so a template
    // whose link failed to issue is unrepresentable rather than merely
    // untested. `sendSignInLink` is what enforces the order.
    expect(buildMagicLink.length).toBe(1);
  });

  it("every sentence it speaks is a registry key", () => {
    const mail = buildMagicLink({ href: HREF });
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
    expect(Object.keys(buildMagicLink({ href: HREF }))).toEqual(["subject", "blocks"]);
  });
});

describe("the sentences are still the owner's", () => {
  it("all three are owner-owed and empty, so the seam refuses to compose rather than shipping a blank line", () => {
    // DECISIONS 2026-09-05 (#93): "mail keeps the throw (a mail never ships
    // a placeholder)". This case keeps discriminating once the owner fills
    // them — it will then need updating, which is the point.
    for (const key of ["mail.magicLink.subject", "mail.magicLink.body", "mail.magicLink.action"] as const) {
      expect(COPY[key]).toBe("");
    }
  });
});
