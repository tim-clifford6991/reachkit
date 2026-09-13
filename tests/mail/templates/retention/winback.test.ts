// §8 · §10 — the two retention mails wear the MailWinback artboard, and
// neither can send until the owner writes their sentences.
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../env-fixture";

applyEnvFixture();

const { buildVetoReminder } = await import("../../../../src/lib/mail/templates/draft-ready");
const { buildPaymentFailed } = await import("../../../../src/lib/mail/templates/account");
const { composeMail } = await import("../../../../src/lib/mail/shell/compose");
const { sendEmail } = await import("../../../../src/lib/mail/send");
const { COPY, TODO_COPY_MARKER } = await import("../../../../src/lib/presentation/copy");

const APP = "https://reachkit.example";
const TO = "anna@example.com";
const veto = (): ReturnType<typeof buildVetoReminder> =>
  buildVetoReminder({
    page: { title: "Holiday pay rules for part-time staff" },
    query: "holiday pay for part-time staff",
    publishesAt: "in 6 h",
    facts: { asked: "1,900", answeredBy: "rival-one.example.net", site: "example.com" },
    stopHref: `${APP}/stop/tok`,
    calendarHref: `${APP}/app/calendar`,
  });
const failed = (): ReturnType<typeof buildPaymentFailed> =>
  buildPaymentFailed({ href: `${APP}/app/settings/billing` });
const OWED = [
  "mail.vetoReminder.eyebrow",
  "mail.account.paymentFailed.eyebrow",
  "mail.account.paymentFailed.subject",
  "mail.account.paymentFailed.heading",
  "mail.account.paymentFailed.body",
  "mail.account.paymentFailed.action",
  "mail.reason.paymentFailed",
] as const;

describe("the canvas's MailWinback, section for section", () => {
  it("both mails draw the artboard's sections in its order, at its rungs", () => {
    expect(veto().blocks.map((block) => block.block)).toEqual([
      "eyebrow", "heading", "paragraph", "footnote", "facts", "footnote", "footnote", "action",
    ]);
    expect(failed().blocks.map((block) => block.block)).toEqual([
      "eyebrow", "heading", "paragraph", "action", "footnote",
    ]);
    // The second mail in one sheet is headed at the canvas's smaller rung.
    expect(failed().blocks[1]).toMatchObject({ rung: "h3" });
  });

  it("the panel, the search and both ways out reach both bodies", () => {
    const mail = veto();
    const m = composeMail({ kind: "draft-ready", subject: mail.subject, subjectVars: mail.subjectVars, blocks: mail.blocks, reason: mail.reason });
    for (const body of [m.html, m.text]) {
      for (const sentence of ["1,900", "rival-one.example.net", COPY["mail.draftReady.stopAction"], COPY["publish.veto.calendar"], COPY["publish.veto.ask.do-nothing"], COPY["mail.reason.draftReady"]]) {
        expect(body).toContain(sentence);
      }
    }
    // The calendar is the canvas's quiet link, not a second solid button.
    expect(m.html.split("display:inline-block;padding").length - 1).toBe(1);
    expect(m.text).toContain(`${COPY["publish.veto.calendar"]}: ${APP}/app/calendar`);
  });

  it("its seven sentences are owner-owed, so the seam sends neither mail", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const key of OWED) expect(COPY[key], key).toBe(TODO_COPY_MARKER);
    const r = veto();
    const n = failed();
    await expect(sendEmail({ kind: "draft-ready", to: TO, userId: "u1", subject: r.subject, subjectVars: r.subjectVars, blocks: r.blocks, reason: r.reason })).resolves.toEqual({ sent: false, reason: "not-composable" });
    await expect(sendEmail({ kind: "account", to: TO, subject: n.subject, blocks: n.blocks, reason: n.reason })).resolves.toEqual({ sent: false, reason: "not-composable" });
    vi.restoreAllMocks();
  });
});
