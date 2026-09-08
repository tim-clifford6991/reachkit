// UI-SPEC S20's footer: why it was sent, how to stop it, the imprint band.
// tests/mail/shell/footer.test.ts  ·  issue #376
//
// The shell's footer carried one thing before this issue — a stop link,
// where the kind had one — and S20 draws four: the reason the mail arrived,
// the way to stop it where it can be stopped, the imprint, and the note
// that a plain-text twin travels with it. Both bodies carry all four, in
// the same order, and this file holds them to it.
//
// It also holds the two seams that could quietly drop a footer: the
// `reason` is optional on the compose input, so a kind that forgets one
// composes anyway — which is right for the three kinds the approved set
// does not draw, and wrong for every other. The list below is the
// difference, and it is asserted rather than trusted.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

const { composeMail } = await import("../../../src/lib/mail/shell/compose");
const { COPY } = await import("../../../src/lib/presentation/copy");
const { MAIL_KINDS } = await import("../../../src/lib/mail/kinds");

/**
 * The kinds the approved set does not draw, and which therefore carry no
 * reason line yet.
 *
 * `first-page-unavailable` is the four arms of "there is no page for you",
 * `setup-reminder` is the nudge to finish setup, and `account` is the
 * billing and identity mails. S20 draws none of them, so ruling 11a
 * approves no sentence to fill their footer with, and inventing one is the
 * thing CLAUDE.md forbids. When the owner writes them, this list shrinks.
 */
const NO_REASON_YET = ["first-page-unavailable", "setup-reminder", "account"] as const;

const BASE = {
  subject: "mail.shell.wordmark",
  blocks: [{ block: "paragraph", text: "mail.report.body" }],
} as const;

describe("issue #376 — S20's footer, in both bodies", () => {
  it("the three kinds with no reason line are exactly the three the set does not draw", () => {
    // Rule 5.5: the exception is a written list, and it is checked against
    // the register rather than against itself — a fourth kind added to
    // `MAIL_KINDS` without a footer line fails here, naming itself.
    const drawn = ["magic-link", "report", "first-page", "draft-ready", "published", "weekly", "nurture"];
    const registered = Object.keys(MAIL_KINDS);
    expect(registered).toHaveLength(10);
    expect([...NO_REASON_YET].sort()).toEqual(registered.filter((k) => !drawn.includes(k)).sort());
  });

  it("the reason and the imprint band render, in that order, in both bodies", () => {
    // Without a stop control, because the control's own label is still
    // owner-owed (`mail.optout.label`) and `copy()` throws on it — which
    // is why the two lead mails cannot compose at all today. The link's
    // place in the order is held by `frame.ts` itself, between these two,
    // and is what this file will assert the day that line is written.
    expect(COPY["mail.optout.label"]).toBe("");

    const mail = composeMail({
      kind: "report",
      ...BASE,
      reason: "mail.reason.report",
      reasonVars: { address: "remove@example.com" },
    });

    const reason = mail.html.indexOf("Own this site");
    const band = mail.html.indexOf("plain-text version attached");
    expect(reason, "the reason line is missing").toBeGreaterThan(-1);
    expect(band).toBeGreaterThan(reason);

    // The plain-text twin says the same things in the same order.
    const text = mail.text;
    expect(text.indexOf("Own this site")).toBeGreaterThan(-1);
    expect(text.indexOf("plain-text version attached")).toBeGreaterThan(
      text.indexOf("Own this site")
    );
  });

  it("a mail with no reason still composes, and its footer is the band alone", () => {
    // The arm the three kinds above take. It must not throw, and it must
    // not render an empty line where a sentence would go.
    const mail = composeMail({ kind: "account", ...BASE });
    expect(mail.html).toContain("plain-text version attached");
    expect(mail.html).not.toContain("<p style=\"margin:0\"></p>");
  });

  it("the imprint appears only once the owner has written it", () => {
    // The set brackets the imprint, so it is owner-owed and empty. It is
    // read off the registry rather than through `copy()`, which throws on
    // an owner-owed key — a footer band is not a reason to stop every mail
    // in the product from composing.
    expect(COPY["mail.shell.imprint"]).toBe("");
    const mail = composeMail({ kind: "report", ...BASE, reason: "mail.reason.report", reasonVars: { address: "x@y.z" } });
    // The band is wordmark · plain-text note, with no empty middle.
    expect(mail.html).toContain("ReachKit · plain-text version attached");
    expect(mail.text).toContain("ReachKit · plain-text version attached");
  });

  it("the reason line is the one place a mail says why it arrived", () => {
    // S20 puts the stop instruction inside the reason for a togglable
    // kind — "switch off in Settings › Notifications" — so the three
    // toggle kinds say how to stop without needing a second control.
    for (const key of [
      "mail.reason.draftReady",
      "mail.reason.published",
      "mail.reason.weekly",
    ] as const) {
      expect(COPY[key]).toContain("switch off in Settings");
    }
    expect(COPY["mail.reason.nurture"]).toContain("Opt out");
  });
});
