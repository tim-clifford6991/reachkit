// tests/mail/retention/sequence.test.ts — SPEC §8, Retention (issue #569):
// three triggers, four kinds, each once, each stopped when its condition
// resolves, and nothing sent while its copy is unwritten.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

vi.mock("@/lib/db", () => ({ db: () => null, dbAdmin: () => null }));
vi.mock("@/lib/mail/leads/wire", () => ({ wireSuppressionReader: () => {} }));

/** Keys the unwritten-copy row puts back to the marker. Every retention
 *  line is written now (the owner's sheet), so the row that proves "unwritten
 *  keys send nothing" stubs one back here rather than depending on a key
 *  that happens to be still owed. Empty everywhere else. */
const unwritten = new Set<string>();
vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: Parameters<typeof actual.copy>[0], vars?: Parameters<typeof actual.copy>[1]) =>
      unwritten.has(key) ? actual.TODO_COPY_MARKER : actual.copy(key, vars),
  };
});

/** Stands in for the vendor seam: every send that reaches it is recorded,
 *  and a test can make the next answer a refusal. `real` delegates to the
 *  real seam, for the unwritten-copy row. */
const sent: { kind: string; to: string; text: string }[] = [];
let answer: { sent: true; id: string } | { sent: false; reason: "suppressed" } = { sent: true, id: "v" };
let real = false;
vi.mock("@/lib/mail/send", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail/send")>();
  const { composeMailParts } = await import("@/lib/mail/shell/compose");
  return {
    ...actual,
    sendEmail: async (m: Parameters<typeof actual.sendEmail>[0]) => {
      if (real) return actual.sendEmail(m);
      if (answer.sent) sent.push({ kind: m.kind, to: m.to, text: composeMailParts(m).text });
      return answer;
    },
  };
});

const retention = await import("@/lib/mail/retention");
const { sendEmail } = await import("@/lib/mail/send");
const { buildWinback } = await import("@/lib/mail/templates/win-back");
import type { RetentionAccount, RetentionStore } from "@/lib/mail/retention";

const DAY = 86_400_000;
const NOW = new Date("2026-10-01T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

let accounts: Map<string, RetentionAccount>;
/** The `refunds` rows: the account and when its refund was made. */
let refunds: { userId: string; at: Date }[];

function account(over: Partial<RetentionAccount> = {}): RetentionAccount {
  return {
    id: "u1", email: "founder@example.com", planStatus: "active", paidThrough: new Date(NOW.getTime() + 20 * DAY),
    cancelledAt: null, deletedAt: null, paymentFailedMailedAt: null,
    cancellationMailedAt: null, winbackSentAt: null, ...over,
  };
}

const memory: RetentionStore = {
  pastDueAccounts: async () => [...accounts.values()],
  cancelledAccounts: async () => [...accounts.values()],
  account: async (id) => accounts.get(id) ?? null,
  siteOf: async () => ({ siteId: "s1", timezone: "UTC" }),
  refundedSince: async (id, since) => refunds.some((r) => r.userId === id && r.at.getTime() >= since.getTime()),
  stampAccount: async (id, column, at) => {
    const key = { payment_failed_mailed_at: "paymentFailedMailedAt",
      cancellation_mailed_at: "cancellationMailedAt", winback_sent_at: "winbackSentAt" }[column];
    accounts.set(id, { ...accounts.get(id)!, [key]: at });
  },
  recordSeen: async () => {},
};

beforeEach(() => {
  sent.length = 0;
  answer = { sent: true, id: "v" };
  real = false;
  accounts = new Map([["u1", account()]]);
  refunds = [];
  retention.setRetentionStore(memory);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("payment failed, cancelled, access +30 d — stopped when resolved", () => {
  it("payment-failed sends once, and a payment that succeeds stops it", async () => {
    accounts.set("u1", account({ planStatus: "past_due" }));
    expect((await retention.sendPaymentFailed("u1", NOW)).sent).toBe(true);
    expect(await retention.accountsDuePaymentFailed()).toEqual([]);
    accounts.set("u1", account({ planStatus: "active" }));
    expect((await retention.sendPaymentFailed("u1", NOW)).sent).toBe(false);
  });

  it("cancellation sends once; a resume stops it and the win-back", async () => {
    accounts.set("u1", account({ cancelledAt: ago(1), paidThrough: ago(31) }));
    expect((await retention.sendCancellation("u1", NOW)).sent).toBe(true);
    expect(await retention.accountsDueCancellation()).toEqual([]);
    accounts.set("u1", { ...accounts.get("u1")!, cancelledAt: null });
    expect(await retention.accountsDueWinback(NOW)).toEqual([]);
  });

  it("the win-back sends once at +30 d, never repeats, and an opted-out address is not stamped", async () => {
    accounts.set("u1", account({ cancelledAt: ago(40), paidThrough: ago(29) }));
    expect(await retention.accountsDueWinback(NOW)).toEqual([]);

    accounts.set("u1", account({ cancelledAt: ago(40), paidThrough: ago(30) }));
    answer = { sent: false, reason: "suppressed" };
    expect(await retention.sendWinback("u1", NOW)).toEqual({ sent: false, kind: "win-back", reason: "suppressed" });
    expect(accounts.get("u1")!.winbackSentAt).toBeNull();

    answer = { sent: true, id: "v" };
    expect((await retention.sendWinback("u1", NOW)).sent).toBe(true);
    expect((await retention.sendWinback("u1", new Date(NOW.getTime() + 60 * DAY))).sent).toBe(false);
    expect(sent.map((s) => s.kind)).toEqual(["win-back"]);
  });
});

describe("the cancellation mail says whether the first payment was refunded", () => {
  const cancelledAt = ago(0.01);

  it("a cancel refunded in its first 14 days says the refund was made and that ReachKit stopped", async () => {
    accounts.set("u1", account({ cancelledAt, paidThrough: NOW, planStatus: "canceled" }));
    refunds = [{ userId: "u1", at: NOW }];
    expect((await retention.sendCancellation("u1", NOW)).sent).toBe(true);
    expect(sent[0]!.text).toContain("Your first payment was refunded in full");
    expect(sent[0]!.text).toContain("ReachKit stopped on");
    expect(sent[0]!.text).not.toContain("You keep full access");
  });

  it("a cancel with no refund keeps the line that access runs to the period end", async () => {
    accounts.set("u1", account({ cancelledAt }));
    expect((await retention.sendCancellation("u1", NOW)).sent).toBe(true);
    expect(sent[0]!.text).toContain("You keep full access until");
    expect(sent[0]!.text).not.toContain("refunded");
  });

  it("a refund from an earlier cancel, before a resume, is not claimed again", async () => {
    accounts.set("u1", account({ cancelledAt }));
    refunds = [{ userId: "u1", at: ago(20) }];
    expect((await retention.sendCancellation("u1", NOW)).sent).toBe(true);
    expect(sent[0]!.text).toContain("You keep full access until");
  });

  it("a refund made to another account sharing the web address is not this account's", async () => {
    accounts.set("u1", account({ cancelledAt }));
    refunds = [{ userId: "u2", at: NOW }];
    expect((await retention.sendCancellation("u1", NOW)).sent).toBe(true);
    expect(sent[0]!.text).not.toContain("refunded");
  });
});

describe("a kind whose copy is unwritten sends nothing at all", () => {
  it("the real seam refuses a mail still carrying TODO(copy), and the touch is not stamped", async () => {
    real = true;
    unwritten.add("mail.winback.line");
    unwritten.add("mail.paymentFailed.line");
    try {
      expect(await sendEmail({ kind: "win-back", to: "founder@example.com", ...buildWinback({ email: "founder@example.com" }) }))
        .toEqual({ sent: false, reason: "not-composable" });

      accounts.set("u1", account({ planStatus: "past_due" }));
      expect(await retention.sendPaymentFailed("u1", NOW)).toEqual({ sent: false, kind: "payment-failed", reason: "not-composable" });
      expect(accounts.get("u1")!.paymentFailedMailedAt).toBeNull();
    } finally {
      unwritten.clear();
    }
  });
});
