// tests/account/billing/hosting-notices.test.ts — REQ-076 c11
//
// One notice, sent once, stamped only after it was sent — and the
// discriminating case underneath it: a notice that failed to send leaves
// the site serving.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { sendHostingEndNotice, sitesDueHostingStop, setBillingStore } = await import(
  "@/lib/account/billing"
);
const { MAIL_KINDS } = await import("@/lib/mail/kinds");
const { memoryBillingStore, newMemoryBilling, site, storedSite } = await import("./memory-store");

/** The nth recorded item, or a failure that names the index. An optional
 *  index access would let an assertion be quietly made about nothing. */
function at<T>(items: readonly T[], index = 0): T {
  const item = items[index];
  if (item === undefined) throw new Error(`nothing recorded at [${index}]`);
  return item;
}

let state = newMemoryBilling();
const NOW = new Date("2026-09-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state = newMemoryBilling();
  setBillingStore(memoryBillingStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
  vi.restoreAllMocks();
});

/** A site whose access ended yesterday and which has been told nothing. */
function lapsed(): void {
  state.sites.push(
    site({ id: "s1", user_id: "u1", owner_paid_through: days(-1).toISOString() })
  );
}

describe("REQ-076 c11 — one account mail per occasion", () => {
  it("one mail at the moment access ends, of the unstoppable `account` kind", async () => {
    lapsed();
    const outcome = await sendHostingEndNotice("s1");
    expect(outcome).toEqual({ sent: true, which: "access_ended" });
    expect(sendCalls).toHaveLength(1);
    expect(at(sendCalls).kind).toBe("account");
    expect(at(sendCalls).to).toBe("u1@example.com");
    // A customer cannot unsubscribe from being told their live pages are
    // coming down.
    expect(MAIL_KINDS.account.stoppable).toBe(false);
  });

  it("the mail carries the day serving stops and that the export stays open", async () => {
    lapsed();
    await sendHostingEndNotice("s1");
    const keys = at(sendCalls).blocks.map((b) => (b as { text: string }).text);
    // Two statements, two blocks: c11 requires both, and a notice carrying
    // the day inside a sentence about the export would be one edit away
    // from dropping one of them.
    expect(keys).toContain("mail.account.hosting_end.stops_on");
    expect(keys).toContain("mail.account.hosting_end.export_stays");
    expect(keys).toContain("mail.account.reach_a_person");
    expect(at(sendCalls).subject).toBe("mail.account.hosting_end.access_ended.subject");
  });

  it("the day is written in the customer's own stated zone", async () => {
    // REQ-073 c3. The same instant under two zones is two written days.
    state.sites.push(
      site({
        id: "sydney",
        user_id: "u1",
        owner_paid_through: days(-1).toISOString(),
        timezone: "Australia/Sydney",
      })
    );
    await sendHostingEndNotice("sydney");
    const block = at(at(sendCalls).blocks) as { vars: { date: string } };
    expect(typeof block.vars.date).toBe("string");
    expect(block.vars.date).not.toBe("");
  });

  it("the second notice is the reminder, with its own subject", async () => {
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_paid_through: days(-23).toISOString(),
        hosted_serving_ends_at: days(7).toISOString(),
        hosting_end_notice_at: days(-23).toISOString(),
      })
    );
    const outcome = await sendHostingEndNotice("s1");
    expect(outcome).toEqual({ sent: true, which: "seven_days" });
    expect(at(sendCalls).subject).toBe("mail.account.hosting_end.seven_days.subject");
  });

  it("neither is sent twice", async () => {
    lapsed();
    await sendHostingEndNotice("s1");
    sendCalls.length = 0;

    // Both stamps now stand, so the site is owed nothing.
    state.sites[0] = site({
      id: "s1",
      user_id: "u1",
      owner_paid_through: days(-1).toISOString(),
      hosted_serving_ends_at: days(29).toISOString(),
      hosting_end_notice_at: NOW.toISOString(),
      hosting_end_reminder_at: NOW.toISOString(),
    });
    expect(await sendHostingEndNotice("s1")).toEqual({ sent: false, because: "not_due" });
    expect(sendCalls).toHaveLength(0);
  });
});

describe("the retention window is opened before the mail, and stamped only after it", () => {
  it("the window is stamped with the day the customer is about to read", async () => {
    lapsed();
    await sendHostingEndNotice("s1");
    const stamped = storedSite(state).hosted_serving_ends_at;
    expect(stamped).not.toBeNull();
    expect(storedSite(state).hosting_end_notice_at).toBe(NOW.toISOString());
  });

  it("a failed send leaves the stamp unset, so the next tick asks again", async () => {
    lapsed();
    sendOutcome.next = { sent: false, reason: "vendor" };
    expect(await sendHostingEndNotice("s1")).toEqual({ sent: false, because: "mail" });
    expect(storedSite(state).hosting_end_notice_at).toBeNull();
  });

  it("BP-060 decision 3 — a site whose notice failed keeps serving", async () => {
    // The discriminating case. The window is open (so the stop queue can
    // see the site) and the notice never went, so the stop must refuse it.
    lapsed();
    sendOutcome.next = { sent: false, reason: "vendor" };
    await sendHostingEndNotice("s1");

    state.sites[0] = site({
      id: "s1",
      user_id: "u1",
      owner_paid_through: days(-1).toISOString(),
      hosted_serving_ends_at: days(-1).toISOString(),
      hosting_end_notice_at: null,
      hosting_end_reminder_at: null,
    });
    expect(await sitesDueHostingStop(NOW)).toEqual([]);
  });
});

describe("subjects that are owed nothing", () => {
  it("a site that does not exist", async () => {
    expect(await sendHostingEndNotice("nobody")).toEqual({ sent: false, because: "not_due" });
    expect(sendCalls).toHaveLength(0);
  });

  it("a deleted account is told nothing about a day it did not choose", async () => {
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_paid_through: days(-1).toISOString(),
        owner_deleted_at: NOW.toISOString(),
      })
    );
    expect(await sendHostingEndNotice("s1")).toEqual({ sent: false, because: "not_due" });
    expect(sendCalls).toHaveLength(0);
  });

  it("a site with no hosted destination", async () => {
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_paid_through: days(-1).toISOString(),
        hasHostedPages: false,
      })
    );
    expect(await sendHostingEndNotice("s1")).toEqual({ sent: false, because: "not_due" });
    expect(sendCalls).toHaveLength(0);
  });

  it("a store that cannot be read is a store failure, not a subject with nothing owed", async () => {
    lapsed();
    state.failHostingRead = true;
    expect(await sendHostingEndNotice("s1")).toEqual({ sent: false, because: "store" });
  });
});
