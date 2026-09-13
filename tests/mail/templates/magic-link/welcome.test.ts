// §8 — the welcome mail wears the MailWelcome artboard, and cannot send yet.
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../env-fixture";

applyEnvFixture();

const { buildWelcome } = await import("../../../../src/lib/mail/templates/magic-link");
const { composeMail } = await import("../../../../src/lib/mail/shell/compose");
const { sendEmail } = await import("../../../../src/lib/mail/send");
const { COPY, TODO_COPY_MARKER } = await import("../../../../src/lib/presentation/copy");

const HREF = "https://reachkit.example/signin?t=tok";
const build = (): ReturnType<typeof buildWelcome> => buildWelcome({ href: HREF });
const compose = (): ReturnType<typeof composeMail> => {
  const mail = build();
  return composeMail({
    kind: "magic-link",
    subject: mail.subject,
    blocks: mail.blocks,
    reason: mail.reason,
    notes: mail.notes,
  });
};

describe("the canvas's MailWelcome, section for section", () => {
  it("draws the artboard's sections in its order", () => {
    expect(build().blocks.map((block) => block.block)).toEqual([
      "eyebrow",
      "heading",
      "paragraph",
      "steps",
      "action",
    ]);
  });

  it("the four steps are the setup screen's own words, the paid one ticked", () => {
    const [steps] = build().blocks.filter((block) => block.block === "steps");
    expect(steps).toEqual({
      block: "steps",
      items: [
        { label: "setup.progress.paid", done: true },
        { label: "setup.progress.setup", line: "setup.head" },
        { label: "mail.welcome.step.scan", line: "mail.welcome.step.scan.line" },
        { label: "setup.progress.first-page", line: "setup.submit" },
      ],
    });
    // Both bodies number the steps, and both carry the footer's own line.
    const mail = compose();
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain(COPY["setup.progress.paid"]);
      expect(body).toContain("04");
      expect(body).toContain(COPY["mail.account.reach_a_person"]);
    }
  });
});

describe("§8 — an unwritten sentence sends nothing at all", () => {
  it("the six the artboard brackets are owner-owed", () => {
    for (const key of [
      "mail.welcome.eyebrow",
      "mail.welcome.heading",
      "mail.welcome.body",
      "mail.welcome.step.scan",
      "mail.welcome.step.scan.line",
      "mail.reason.welcome",
    ] as const) {
      expect(COPY[key], key).toBe(TODO_COPY_MARKER);
    }
  });

  it("so the seam refuses to send it, marker and all", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mail = build();
    await expect(
      sendEmail({
        kind: "magic-link",
        to: "anna@example.com",
        subject: mail.subject,
        blocks: mail.blocks,
        reason: mail.reason,
        notes: mail.notes,
      })
    ).resolves.toEqual({ sent: false, reason: "not-composable" });
    vi.restoreAllMocks();
  });
});
