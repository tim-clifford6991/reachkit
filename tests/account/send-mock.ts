// tests/account/send-mock.ts — §12's seam, stood in for.
//
// The payment suites are about *when* a mail is sent and what happens
// around it, not about composing one: composition, the omission rule and
// the stoppability dispatch are §12's own suites, and the two templates'
// block lists are asserted in `tests/mail/templates/**`.
//
// As with `tests/mail/leads/send-mock.ts`, this stand-in cannot succeed by
// accident today: every sentence these mails speak is owner-owed, so the
// real seam refuses to compose them (`reason: 'not-composable'`) and no
// suite driving the real one could observe a delivery at all. That fact is
// asserted where it belongs — `tests/mail/templates/account/index.test.ts`
// — rather than silently making these suites vacuous.
export interface RecordedSend {
  kind: string;
  to: string;
  subject: string;
  blocks: readonly unknown[];
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
    registerSuppressionReader: () => undefined,
  };
}
