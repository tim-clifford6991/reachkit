// No mail a customer receives carries an owner placeholder: every kind, every part.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { composeAnyKind } = await import("../preview/kinds");
const { MAIL_KINDS } = await import("../../../src/lib/mail/kinds");

describe("no mail renders a [[…]] placeholder", () => {
  for (const kind of Object.keys(MAIL_KINDS) as (keyof typeof MAIL_KINDS)[]) {
    it(kind, async () => {
      const mail = await composeAnyKind(kind);
      // The shell writes no separate preheader; any hidden preview text would sit in the HTML.
      for (const [part, value] of Object.entries({ subject: mail.subject, html: mail.html, text: mail.text })) {
        expect(value, `${kind} ${part}`).not.toContain("[[");
      }
    });
  }
});
