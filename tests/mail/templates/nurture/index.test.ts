// BUILD §4.2 — the nurture template: three touches, and no fourth.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";
import { NURTURE_MAX_TOUCHES } from "../../../../src/lib/config/constants";

applyEnvFixture();

const { buildNurture } = await import("../../../../src/lib/mail/templates/nurture");
const { readOptOutToken } = await import("../../../../src/lib/mail/leads/optout");

const TOUCHES = [1, 2, 3] as const;

function build(touch: (typeof TOUCHES)[number]) {
  return buildNurture({ email: "anna@example.com", domain: "acme.com", touch });
}

describe("each touch is its own pair of keys, indexed by the touch number", () => {
  it("the three touches declare three distinct subjects and three distinct lines", () => {
    const subjects = TOUCHES.map((touch) => build(touch).subject);
    const bodies = TOUCHES.map((touch) => (build(touch).blocks[1] as { text: string }).text);

    expect(new Set(subjects).size).toBe(3);
    expect(new Set(bodies).size).toBe(3);
    expect(subjects).toEqual([
      "mail.nurture.subject.1",
      "mail.nurture.subject.2",
      "mail.nurture.subject.3",
    ]);
  });

  it("each touch names the one domain it is about", () => {
    for (const touch of TOUCHES) {
      expect(build(touch).blocks[1]).toMatchObject({
        block: "paragraph",
        vars: { domain: "acme.com" },
      });
    }
  });

  it("which touch this is is carried by the type, not by a conditional in the template", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("src/lib/mail/templates/nurture/index.ts", "utf8");
    // No `if`, no ternary, no switch: the touch indexes two closed tuples.
    expect(source).not.toMatch(/\bif\s*\(|\?\s*[^:]*:|switch\s*\(/);
  });

  it("a fourth touch does not compile: both tuples are closed at three", () => {
    // The type is `1 | 2 | 3`, which is the same number the cap is.
    expect(NURTURE_MAX_TOUCHES).toBe(3);
    // @ts-expect-error — a fourth touch is not representable.
    expect(() => buildNurture({ email: "a@b.com", domain: "acme.com", touch: 4 })).toBeDefined();
  });
});

describe('REQ-010 c11 — "any of these emails … carries a working opt-out"', () => {
  it("the template returns an optOut href, and the token in it round-trips to the address it was built for — over touches 1, 2 and 3", () => {
    for (const touch of TOUCHES) {
      const mail = build(touch);
      expect(mail.optOut.mechanism).toBe("opt-out");
      const token = mail.optOut.href.split("/opt-out/")[1] ?? "";
      expect(readOptOutToken(token), `touch ${touch}`).toEqual({ email: "anna@example.com" });
    }
  });

  it("this is the one lead-directed kind the suppression store reaches", async () => {
    const { MAIL_KINDS } = await import("../../../../src/lib/mail/kinds");
    expect(MAIL_KINDS.nurture.stoppable).toBe("opt-out");
    expect(MAIL_KINDS["first-page"].stoppable).toBe(false);
    expect(MAIL_KINDS["first-page-unavailable"].stoppable).toBe(false);
  });
});
