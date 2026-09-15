// BUILD §4.2 — the unavailable template: one notice, no page body.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../env-fixture";
import { codeOf } from "../../leads/source";

applyEnvFixture();

const { buildFirstPageUnavailable } = await import(
  "../../../../src/lib/mail/templates/first-page-unavailable"
);
const { FIRST_PAGE_UNAVAILABLE_COPY } = await import("../../../../src/lib/mail/leads/giveaway");
const { readOptOutToken } = await import("../../../../src/lib/mail/leads/optout");

function build(cause: keyof typeof FIRST_PAGE_UNAVAILABLE_COPY = "writing-failed") {
  return buildFirstPageUnavailable({
    email: "anna@example.com",
    causeLine: FIRST_PAGE_UNAVAILABLE_COPY[cause],
  });
}

describe('REQ-010 c7 — "one written message to the address they gave — a message they cannot stop, because it closes the request they made"', () => {
  it("the unavailable template renders exactly one notice block carrying the cause line and no page body", () => {
    const mail = build();
    expect(mail.blocks).toEqual([
      { block: "notice", text: FIRST_PAGE_UNAVAILABLE_COPY["writing-failed"] },
    ]);
    expect(mail.blocks.some((block) => block.block === "pageBody")).toBe(false);
  });

  it("it names whichever cause it was handed, and a different cause is a different line", () => {
    const causes = Object.keys(FIRST_PAGE_UNAVAILABLE_COPY) as (keyof typeof FIRST_PAGE_UNAVAILABLE_COPY)[];
    const lines = causes.map((cause) => (build(cause).blocks[0] as { text: string }).text);
    expect(new Set(lines).size).toBe(causes.length);
  });

  it("it is unstoppable on its own grounds: the register row says so", async () => {
    const { MAIL_KINDS } = await import("../../../../src/lib/mail/kinds");
    expect(MAIL_KINDS["first-page-unavailable"].stoppable).toBe(false);
    expect(MAIL_KINDS["first-page-unavailable"].occasionsFrom).toBe("§4.2");
  });

  it("the template takes a resolved key, never the failure union — the map has one home", () => {
    // The exhaustive map lives where the union is declared, because the
    // report's own surface renders the same key in place; a second copy
    // here is the copy that drifts. Comments are stripped first: this
    // file's own header explains why the map is not here.
    const code = codeOf("src/lib/mail/templates/first-page-unavailable/index.ts");
    expect(code).not.toMatch(/FirstPageFailure|FIRST_PAGE_UNAVAILABLE_COPY/);
  });
});

describe('REQ-010 c11 — "any of these emails … carries a working opt-out"', () => {
  it("the template returns an optOut href, and the token in it round-trips to the address it was built for", () => {
    const mail = build();
    expect(mail.optOut.mechanism).toBe("opt-out");
    const token = mail.optOut.href.split("/opt-out/")[1] ?? "";
    expect(readOptOutToken(token)).toEqual({ email: "anna@example.com" });
  });

  it("stoppable: false governs whether suppression blocks the send, not whether the mail carries a way to stop what comes next", () => {
    // ADR-041: the reader of this mail is being told no page is coming.
    // The opt-out in it stops the follow-up, and removing it would leave
    // them with the one mail they cannot answer.
    expect(build().optOut.href).not.toBe("");
  });
});
