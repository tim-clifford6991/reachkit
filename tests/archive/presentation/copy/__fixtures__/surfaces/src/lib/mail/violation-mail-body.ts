// tests/presentation/copy/__fixtures__/surfaces/src/lib/mail/violation-mail-body.ts
//
// WO-279 fixture (supersedes WO-044). Violates REQ-093 criterion 1: a
// literal in a mail template body position (`html`), never read through
// copy(). Exactly one violation — `subject` and `text` are copy()-derived
// so the fixture isolates the one rule under test.
function copy(key: string): string {
  return key;
}

export function violationMail(): { subject: string; html: string; text: string } {
  return {
    subject: copy("fixture.mail.subject"),
    html: "<p>Your report is ready.</p>",
    text: copy("fixture.mail.text"),
  };
}
