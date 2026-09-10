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
const { OWNER_OWED } = await import("../../../src/lib/presentation/copy/registry");

/**
 * The kinds the approved set does not draw, and which therefore carry no
 * reason line yet.
 *
 * `first-page-unavailable` is the four arms of "there is no page for you",
 * `setup-reminder` is the nudge to finish setup, `account` is the billing
 * and identity mails, and `ops` is the owner's own spend alert (issue
 * #329), which has no reason line for a reason no other kind has: its
 * reader is the owner, and "why you are getting this" is a line for
 * somebody who did not ask for it. S20 draws none of them, so ruling 11a
 * approves no sentence to fill their footer with, and inventing one is the
 * thing CLAUDE.md forbids. When the owner writes them, this list shrinks.
 */
const NO_REASON_YET = ["first-page-unavailable", "setup-reminder", "account", "ops"] as const;

const BASE = {
  subject: "mail.shell.wordmark",
  blocks: [{ block: "paragraph", text: "mail.report.body" }],
} as const;

describe("issue #376 — S20's footer, in both bodies", () => {
  it("the four kinds with no reason line are exactly the four the set does not draw", () => {
    // Rule 5.5: the exception is a written list, and it is checked against
    // the register rather than against itself — a fourth kind added to
    // `MAIL_KINDS` without a footer line fails here, naming itself.
    const drawn = ["magic-link", "report", "first-page", "draft-ready", "published", "weekly", "nurture"];
    const registered = Object.keys(MAIL_KINDS);
    expect(registered).toHaveLength(11);
    expect([...NO_REASON_YET].sort()).toEqual(registered.filter((k) => !drawn.includes(k)).sort());
  });

  it("the reason, the stop link and the imprint band render, in that order, in both bodies", () => {
    // The stop control's own label (`mail.optout.label`) was owner-owed
    // until issue #458 filled it on the owner's 2026-09-10 approval, so the
    // link now renders — between the reason and the band, where `frame.ts`
    // and `text-frame.ts` place it.
    const label = COPY["mail.optout.label"];
    expect(label).not.toBe("");
    expect(OWNER_OWED).not.toContain("mail.optout.label");

    const href = "https://reachkit.example/opt-out/token";
    const mail = composeMail({
      kind: "report",
      ...BASE,
      reason: "mail.reason.report",
      reasonVars: { address: "remove@example.com" },
      optOut: { href, mechanism: "opt-out" },
    });

    const reason = mail.html.indexOf("Own this site");
    const link = mail.html.indexOf(`>${label}</a>`);
    const band = mail.html.indexOf("plain-text version attached");
    expect(reason, "the reason line is missing").toBeGreaterThan(-1);
    expect(link, "the stop link is missing").toBeGreaterThan(reason);
    expect(band).toBeGreaterThan(link);
    expect(mail.html).toContain(`href="${href}"`);

    // The plain-text twin says the same things in the same order, the
    // link written out as a labelled URL.
    const text = mail.text;
    const textReason = text.indexOf("Own this site");
    const textLink = text.indexOf(`${label}: ${href}`);
    expect(textReason).toBeGreaterThan(-1);
    expect(textLink).toBeGreaterThan(textReason);
    expect(text.indexOf("plain-text version attached")).toBeGreaterThan(textLink);
  });

  it("a mail with no reason still composes, and its footer is the band alone", () => {
    // The arm the three kinds above take. It must not throw, and it must
    // not render an empty line where a sentence would go.
    const mail = composeMail({ kind: "account", ...BASE });
    expect(mail.html).toContain("plain-text version attached");
    expect(mail.html).not.toContain("<p style=\"margin:0\"></p>");
  });

  it("the imprint, once written, sits between the wordmark and the plain-text note", () => {
    // The set brackets the imprint, so it was owner-owed and empty, and the
    // band read wordmark · plain-text note. Issue #458 filled it on the
    // owner's 2026-09-10 approval, so the band now carries all three parts,
    // in the set's order, in both bodies.
    const imprint = COPY["mail.shell.imprint"];
    expect(imprint).not.toBe("");
    expect(OWNER_OWED).not.toContain("mail.shell.imprint");
    const mail = composeMail({ kind: "report", ...BASE, reason: "mail.reason.report", reasonVars: { address: "x@y.z" } });
    const band = [COPY["mail.shell.wordmark"], imprint, COPY["mail.shell.plaintext_note"]].join(" · ");
    expect(mail.html).toContain(band);
    expect(mail.text).toContain(band);
    // And not the two-part band it replaced.
    expect(mail.text).not.toContain("ReachKit · plain-text version attached");
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
