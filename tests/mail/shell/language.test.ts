// SPEC §6, owner D66 (issue 1311): a German site's mail is composed in
// German, and the language of one mail never reaches the next.
import { describe, expect, it } from "vitest";
import { composeMail } from "../../../src/lib/mail/shell/compose";
import { copy } from "../../../src/lib/presentation/copy";
import { translationOf } from "../../../src/lib/presentation/copy/translated";

const SUBJECT = "mail.weekly.subject";
const LINE = "mail.nothing_to_report";
const blocks = [{ block: "heading", text: LINE } as const];

describe("a mail's language", () => {
  it("composes the subject and both bodies in German for a German site", async () => {
    const mail = await composeMail({ kind: "report", language: "de", subject: SUBJECT, blocks });
    expect(mail.subject).toBe(translationOf(SUBJECT, "de"));
    expect(mail.text).toContain(translationOf(LINE, "de")!);
    expect(mail.html).toContain("Diese Woche gibt es nichts zu berichten.");
    expect(mail.text).not.toContain(copy(LINE));
  });

  it("composes in English where no language is given, also straight after a German mail", async () => {
    const [german, english] = await Promise.all([
      composeMail({ kind: "report", language: "de", subject: SUBJECT, blocks }),
      composeMail({ kind: "report", subject: SUBJECT, blocks }),
    ]);
    expect(german.subject).not.toBe(english.subject);
    expect(english.subject).toBe(copy(SUBJECT));
    expect(english.text).toContain(copy(LINE));
  });
});
