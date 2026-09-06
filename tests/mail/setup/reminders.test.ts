// tests/mail/setup/reminders.test.ts — BUILD §4.3, issue #36
//
// Three reminders at 24 / 72 / 168 hours, stopped at send time, each
// carrying a sign-in link that lands on the setup screen — and never one
// before there is an account to sign in to.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../env-fixture";
import { fakeDb, type FakeDb } from "../../scan/deep/fake-db";

applyEnvFixture();

let db: FakeDb = fakeDb();
const sent = vi.fn();

vi.mock("@/lib/db", () => ({
  dbAdmin: () => db.client,
  db: () => db.client,
}));

vi.mock("@/lib/mail/send", () => ({
  sendEmail: (m: unknown) => sent(m),
}));

const {
  REMINDER_OFFSETS_H,
  SETUP_LANDING_PATH,
  dueReminderIndex,
  resetSignInLinkIssuer,
  sendSetupReminder,
  setSignInLinkIssuer,
  sitesDueSetupReminder,
} = await import("../../../src/lib/mail/setup/reminders");
const { SETUP_REMINDER_OFFSETS_H } = await import("../../../src/lib/config/constants");
const { MAIL_KINDS } = await import("../../../src/lib/mail/kinds");

const SITE = "site-1";
const USER = "user-1";
const PAID_AT = new Date(Date.UTC(2026, 8, 1, 9, 0, 0));
const HOUR = 3_600_000;

const REMINDERS_SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/mail/setup/reminders.ts"),
  "utf8"
);

function at(hours: number): Date {
  return new Date(PAID_AT.getTime() + hours * HOUR);
}

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: SITE,
    user_id: USER,
    created_at: PAID_AT.toISOString(),
    setup_completed_at: null,
    setup_reminders_sent: 0,
    ...overrides,
  };
}

beforeEach(() => {
  sent.mockReset();
  sent.mockResolvedValue({ sent: true, id: "vendor-1" });
  db = fakeDb({ sites: [site()], users: [{ id: USER, email: "founder@example.com" }] });
  setSignInLinkIssuer(async (a) => `https://reachkit.example/signin/token?next=${a.landsOn}`);
});

describe("REQ-025 c6 — three offsets, the last no later than seven days after the payment", () => {
  it("the offsets are the pinned ones, never restated here", () => {
    expect([...REMINDER_OFFSETS_H]).toEqual([...SETUP_REMINDER_OFFSETS_H]);
    expect([...REMINDER_OFFSETS_H]).toEqual([24, 72, 168]);
    expect(REMINDER_OFFSETS_H.at(-1)).toBe(7 * 24);
  });

  it("nothing is due before the first offset", () => {
    for (const hours of [0, 1, 23, 23.9]) {
      expect(dueReminderIndex({ paidAt: PAID_AT, sent: 0, now: at(hours) })).toBeNull();
    }
  });

  it.each([
    [0, 24],
    [1, 72],
    [2, 168],
  ])("reminder %i falls due at %i hours", (index, hours) => {
    expect(dueReminderIndex({ paidAt: PAID_AT, sent: index, now: at(hours - 0.1) })).toBeNull();
    expect(dueReminderIndex({ paidAt: PAID_AT, sent: index, now: at(hours) })).toBe(index);
  });

  it("at most three are ever due, however long a founder leaves it", () => {
    expect(dueReminderIndex({ paidAt: PAID_AT, sent: 3, now: at(10_000) })).toBeNull();
    expect(dueReminderIndex({ paidAt: PAID_AT, sent: 4, now: at(10_000) })).toBeNull();
  });

  it("the column's own check constraint is what bounds it, not this file remembering", () => {
    const migration = readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../../supabase/migrations/20260906130000_sites_setup.sql"
      ),
      "utf8"
    );
    expect(migration).toMatch(/setup_reminders_sent\s*<=\s*3/);
  });
});

describe("REQ-025 c6 — the due-work query, and what it never returns", () => {
  it("returns a founder whose next reminder has fallen due", async () => {
    expect(await sitesDueSetupReminder(at(25))).toEqual([SITE]);
  });

  it("returns nobody before the first offset", async () => {
    expect(await sitesDueSetupReminder(at(23))).toEqual([]);
  });

  it("never returns a founder who has finished setup", async () => {
    db.tables.sites![0]!.setup_completed_at = at(2).toISOString();
    expect(await sitesDueSetupReminder(at(200))).toEqual([]);
  });

  it("never returns a founder who has had all three", async () => {
    db.tables.sites![0]!.setup_reminders_sent = 3;
    expect(await sitesDueSetupReminder(at(10_000))).toEqual([]);
  });
});

describe("REQ-025 c6 — stopped at send time, not at schedule time", () => {
  it("a founder who submits at hour 71 receives no hour-72 mail", async () => {
    // Due at the moment the tick asked...
    expect(await sitesDueSetupReminder(at(72))).toEqual([SITE]);
    // ...and finished before the send ran.
    db.tables.sites![0]!.setup_completed_at = at(71).toISOString();

    expect(await sendSetupReminder(SITE, at(72))).toEqual({
      sent: false,
      reason: "already-complete",
    });
    expect(sent).not.toHaveBeenCalled();
    expect(db.tables.sites![0]!.setup_reminders_sent).toBe(0);
  });

  it("mutation check — deciding at schedule time would send it: the row is re-read inside the send", () => {
    const body = REMINDERS_SOURCE.slice(REMINDERS_SOURCE.indexOf("export async function sendSetupReminder"));
    expect(body).toContain("readReminderRow(siteId)");
    expect(body).toContain("dueReminderIndex(");
  });

  it("nothing is scheduled per founder — there is no queue entry to cancel", () => {
    expect(REMINDERS_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")).not.toMatch(
      /setTimeout|sendJobEvent|scheduleSequence/
    );
  });
});

describe("REQ-025 c6 — a working way back in, or no mail at all", () => {
  it("the reminder carries a sign-in link whose landing path is the setup screen", async () => {
    expect(await sendSetupReminder(SITE, at(24))).toEqual({ sent: true, index: 0 });

    const mail = sent.mock.calls[0]![0] as { kind: string; blocks: { block: string; href?: string }[] };
    expect(mail.kind).toBe("setup-reminder");
    const action = mail.blocks.find((b) => b.block === "action");
    expect(action?.href).toContain(SETUP_LANDING_PATH);
  });

  it("the landing path is the same literal the setup gate allow-lists", async () => {
    const gate = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/setup/gate.ts"),
      "utf8"
    );
    expect(gate).toContain(`"${SETUP_LANDING_PATH}"`);
  });

  it("a send with no issuable link fails rather than sending — no account to sign in to, no reminder", async () => {
    setSignInLinkIssuer(async () => null);
    expect(await sendSetupReminder(SITE, at(24))).toEqual({ sent: false, reason: "no-link" });
    expect(sent).not.toHaveBeenCalled();
    expect(db.tables.sites![0]!.setup_reminders_sent).toBe(0);
  });

  it("an issuer that throws is the same answer, never a mail without a link", async () => {
    setSignInLinkIssuer(async () => {
      throw new Error("auth_links does not exist yet");
    });
    expect(await sendSetupReminder(SITE, at(24))).toEqual({ sent: false, reason: "no-link" });
    expect(sent).not.toHaveBeenCalled();
  });

  it("with no issuer wired at all — today's answer — no reminder goes out", async () => {
    resetSignInLinkIssuer();
    expect(await sendSetupReminder(SITE, at(24))).toEqual({ sent: false, reason: "no-link" });
    expect(sent).not.toHaveBeenCalled();
  });
});

describe("the counter moves only on a send that happened", () => {
  it("a successful send increments it once", async () => {
    await sendSetupReminder(SITE, at(24));
    expect(db.tables.sites![0]!.setup_reminders_sent).toBe(1);
    // The second is not yet due.
    expect(await sendSetupReminder(SITE, at(25))).toEqual({ sent: false, reason: "not-due" });
    expect(db.tables.sites![0]!.setup_reminders_sent).toBe(1);
  });

  it("a vendor refusal leaves it untouched, so the founder is due again", async () => {
    sent.mockResolvedValue({ sent: false, reason: "vendor" });
    expect(await sendSetupReminder(SITE, at(24))).toEqual({ sent: false, reason: "mail" });
    expect(db.tables.sites![0]!.setup_reminders_sent).toBe(0);
  });

  it("all three, in order, and never a fourth", async () => {
    for (const [index, hours] of [...REMINDER_OFFSETS_H].entries()) {
      expect(await sendSetupReminder(SITE, at(hours))).toEqual({ sent: true, index });
    }
    expect(db.tables.sites![0]!.setup_reminders_sent).toBe(3);
    expect(await sendSetupReminder(SITE, at(10_000))).toEqual({ sent: false, reason: "not-due" });
    expect(sent).toHaveBeenCalledTimes(3);
  });
});

describe("the register row this mail is sent under", () => {
  it("`setup-reminder` is registered against §4.3 and is not stoppable", () => {
    expect(MAIL_KINDS["setup-reminder"].occasionsFrom).toBe("§4.3");
    expect(MAIL_KINDS["setup-reminder"].stoppable).toBe(false);
  });
});
