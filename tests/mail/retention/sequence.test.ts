// tests/mail/retention/sequence.test.ts — SPEC §8, Retention (issue #569):
// four triggers, six kinds, each once, each stopped when its condition
// resolves, and nothing sent while its copy is unwritten.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";

applyEnvFixture();

vi.mock("@/lib/db", () => ({ db: () => null, dbAdmin: () => null }));
vi.mock("@/lib/mail/leads/wire", () => ({ wireSuppressionReader: () => {} }));

/** Stands in for the vendor seam: every send that reaches it is recorded,
 *  and a test can make the next answer a refusal. `real` delegates to the
 *  real seam, for the unwritten-copy row. */
const sent: { kind: string; to: string }[] = [];
let answer: { sent: true; id: string } | { sent: false; reason: "suppressed" } = { sent: true, id: "v" };
let real = false;
vi.mock("@/lib/mail/send", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mail/send")>();
  return {
    ...actual,
    sendEmail: async (m: Parameters<typeof actual.sendEmail>[0]) => {
      if (real) return actual.sendEmail(m);
      if (answer.sent) sent.push({ kind: m.kind, to: m.to });
      return answer;
    },
  };
});

const retention = await import("@/lib/mail/retention");
const { sendEmail } = await import("@/lib/mail/send");
const { buildWinback } = await import("@/lib/mail/templates/win-back");
import type { RetentionAccount, RetentionDraft, RetentionStore } from "@/lib/mail/retention";

const DAY = 86_400_000;
const NOW = new Date("2026-10-01T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

let accounts: Map<string, RetentionAccount>;
let drafts: Map<string, RetentionDraft>;
let published: Date | null;

function account(over: Partial<RetentionAccount> = {}): RetentionAccount {
  return {
    id: "u1", email: "founder@example.com", planStatus: "active", paidThrough: new Date(NOW.getTime() + 20 * DAY),
    cancelledAt: null, deletedAt: null, seenAt: ago(8), inactivityNudgedAt: null, paymentFailedMailedAt: null,
    cancellationMailedAt: null, winbackSentAt: null, ...over,
  };
}

const memory: RetentionStore = {
  idleAccounts: async () => [...accounts.values()],
  pastDueAccounts: async () => [...accounts.values()],
  cancelledAccounts: async () => [...accounts.values()],
  account: async (id) => accounts.get(id) ?? null,
  siteOf: async () => ({ siteId: "s1", timezone: "UTC" }),
  lastPublishedAt: async () => published,
  draftsClosingBy: async () => [...drafts.values()],
  draft: async (id) => {
    const d = drafts.get(id);
    return d === undefined ? null : { ...d, ownerId: "u1", timezone: "UTC" };
  },
  stampAccount: async (id, column, at) => {
    const key = { inactivity_nudged_at: "inactivityNudgedAt", payment_failed_mailed_at: "paymentFailedMailedAt",
      cancellation_mailed_at: "cancellationMailedAt", winback_sent_at: "winbackSentAt" }[column];
    accounts.set(id, { ...accounts.get(id)!, [key]: at });
  },
  stampVetoReminded: async (id, at) => void drafts.set(id, { ...drafts.get(id)!, vetoRemindedAt: at }),
  recordSeen: async () => {},
  recordDraftOpened: async () => {},
};

beforeEach(() => {
  sent.length = 0;
  answer = { sent: true, id: "v" };
  real = false;
  accounts = new Map([["u1", account()]]);
  drafts = new Map();
  published = ago(2);
  retention.setRetentionStore(memory);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("idle 7 days while pages publish — the inactivity nudge", () => {
  it("sends once per idle spell, and a sign-in starts a new spell", async () => {
    expect(await retention.accountsDueInactivity(NOW)).toEqual(["u1"]);
    expect((await retention.sendInactivityNudge("u1", NOW)).sent).toBe(true);
    expect((await retention.sendInactivityNudge("u1", NOW)).sent).toBe(false);

    const later = new Date(NOW.getTime() + 9 * DAY);
    accounts.set("u1", { ...accounts.get("u1")!, seenAt: new Date(NOW.getTime() + DAY) });
    published = new Date(NOW.getTime() + 3 * DAY);
    expect(await retention.accountsDueInactivity(later)).toEqual(["u1"]);
    expect(sent.map((s) => s.kind)).toEqual(["inactivity"]);
  });

  it("is not due under seven days, or when no page published during the spell", async () => {
    accounts.set("u1", account({ seenAt: ago(6) }));
    expect(await retention.accountsDueInactivity(NOW)).toEqual([]);
    accounts.set("u1", account());
    published = ago(9);
    expect(await retention.accountsDueInactivity(NOW)).toEqual([]);
  });
});

describe("veto under 6 h — the reminder, only on an unopened draft", () => {
  const draft = (over: Partial<RetentionDraft> = {}): RetentionDraft => ({
    id: "d1", state: "in_review", title: "Pricing for agencies", vetoDeadline: new Date(NOW.getTime() + 5 * 3_600_000),
    openedAt: null, vetoRemindedAt: null, ...over,
  });

  it("sends once for an unopened draft closing within six hours", async () => {
    drafts.set("d1", draft());
    expect(await retention.draftsDueVetoReminder(NOW)).toEqual(["d1"]);
    expect((await retention.sendVetoReminder("d1", NOW)).sent).toBe(true);
    expect((await retention.sendVetoReminder("d1", NOW)).sent).toBe(false);
  });

  it("an opened, resolved or far-off draft is not reminded", async () => {
    for (const over of [{ openedAt: ago(0) }, { state: "approved" }, { vetoDeadline: new Date(NOW.getTime() + 7 * 3_600_000) }]) {
      drafts.set("d1", draft(over));
      expect(await retention.draftsDueVetoReminder(NOW), JSON.stringify(over)).toEqual([]);
    }
    expect(sent).toEqual([]);
  });
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

describe("a kind whose copy is unwritten sends nothing at all", () => {
  it("the real seam refuses a mail still carrying TODO(copy), and the touch is not stamped", async () => {
    real = true;
    expect(await sendEmail({ kind: "win-back", to: "founder@example.com", ...buildWinback({ email: "founder@example.com" }) }))
      .toEqual({ sent: false, reason: "not-composable" });

    accounts.set("u1", account({ planStatus: "past_due" }));
    expect(await retention.sendPaymentFailed("u1", NOW)).toEqual({ sent: false, kind: "payment-failed", reason: "not-composable" });
    expect(accounts.get("u1")!.paymentFailedMailedAt).toBeNull();
  });
});
