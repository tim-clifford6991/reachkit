// tests/mail/leads/send-mock.ts — §12's seam, stood in for.
//
// The flow suites are about *when* a mail is sent and what happens to the
// lead row afterwards, not about composing one: composition, the omission
// rule and the stoppability dispatch are §12's own suites. So `sendEmail`
// is replaced here with a recorder, and the templates' block lists are
// asserted separately in `tests/mail/templates/**`.
//
// It also matters that this stand-in cannot succeed by accident today:
// every sentence these three mails speak is owner-owed, so the real seam
// would refuse to compose them (`reason: 'not-composable'`) and no test
// driving the real one could observe a delivery at all. That fact is
// asserted where it belongs — `tests/mail/templates/copy-owed.test.ts` —
// rather than silently making these suites vacuous.
export interface RecordedSend {
  kind: string;
  to: string;
  subject: string;
  blocks: readonly unknown[];
  optOut: unknown;
}

export const sendCalls: RecordedSend[] = [];

/** What the next send returns. Reset per test; defaults to a success. */
export const sendOutcome: { next: unknown } = { next: { sent: true, id: "vendor-1" } };

export function sendMock(): Record<string, unknown> {
  return {
    sendEmail: async (m: RecordedSend) => {
      sendCalls.push(m);
      return sendOutcome.next;
    },
  };
}
