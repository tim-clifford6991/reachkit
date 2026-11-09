// tests/presentation/copy/__fixtures__/surfaces/src/lib/mail/clean.ts
//
// WO-279 fixture (supersedes WO-044). A clean file under the src/lib/mail
// glob — every mail body field arrives through copy(), never as a literal.
function copy(key: string): string {
  return key;
}

export function cleanMail(): { subject: string; html: string; text: string } {
  return {
    subject: copy("fixture.mail.subject"),
    html: copy("fixture.mail.html"),
    text: copy("fixture.mail.text"),
  };
}
