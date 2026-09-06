// tests/account/billing/hosting-end.test.ts — REQ-076 c10, c11
//
// The two due-work queries, on a fixed clock. What is being asserted is the
// *rule*, not the schedule: BUILD §11's `account/maintenance` tick owns when
// these run, and every case below calls them directly with a `now`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const {
  hostingEndNoticesDue,
  hostedServingEndsAt,
  sitesDueHostingEndNotice,
  sitesDueHostingStop,
  setBillingStore,
} = await import("@/lib/account/billing");
const { HOSTED_RETENTION_DAYS, HOSTING_END_REMINDER_DAYS } = await import(
  "@/lib/config/constants"
);
const { memoryBillingStore, newMemoryBilling, site } = await import("./memory-store");

let state = newMemoryBilling();
const NOW = new Date("2026-09-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

beforeEach(() => {
  state = newMemoryBilling();
  setBillingStore(memoryBillingStore(state));
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  setBillingStore(null);
  vi.restoreAllMocks();
});

describe("REQ-076 c11 — the first notice falls due the instant access ends", () => {
  it("due at the instant access ends, and not before", async () => {
    state.sites.push(
      site({ id: "s1", user_id: "u1", owner_paid_through: days(1).toISOString() })
    );
    expect(await hostingEndNoticesDue(NOW)).toEqual([]);

    state.sites[0] = site({
      id: "s1",
      user_id: "u1",
      owner_paid_through: NOW.toISOString(),
    });
    expect(await hostingEndNoticesDue(NOW)).toEqual([
      { siteId: "s1", which: "access_ended" },
    ]);
  });

  it("a lapse with no cancellation is due exactly as a cancellation is", async () => {
    // c11's "however it ends (criterion 8)", and criterion 8 is
    // `paid_through` alone. A query that read `cancelled_at` to decide
    // due-ness would silently exclude the lapsed customer — the one least
    // likely to be watching for the mail.
    state.sites.push(
      site({ id: "lapsed", user_id: "u1", owner_paid_through: days(-1).toISOString() }),
      site({ id: "cancelled", user_id: "u2", owner_paid_through: days(-1).toISOString() })
    );
    const due = await hostingEndNoticesDue(NOW);
    expect(due.map((d) => d.siteId).sort()).toEqual(["cancelled", "lapsed"]);
  });

  it("is not due twice — the stamp is the guard", async () => {
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_paid_through: days(-1).toISOString(),
        hosted_serving_ends_at: days(HOSTED_RETENTION_DAYS - 1).toISOString(),
        hosting_end_notice_at: NOW.toISOString(),
      })
    );
    const due = await hostingEndNoticesDue(NOW);
    expect(due.some((d) => d.which === "access_ended")).toBe(false);
  });

  it("a site with no hosted destination is in neither queue", async () => {
    // Nothing to lose, no day to be told, nothing for the stop to stop.
    state.sites.push(
      site({
        id: "wordpress-only",
        user_id: "u1",
        owner_paid_through: days(-1).toISOString(),
        hasHostedPages: false,
      })
    );
    expect(await hostingEndNoticesDue(NOW)).toEqual([]);
  });

  it("a deleted account is in neither queue", async () => {
    // REQ-079 c6: deletion takes the pages down at once and carries no
    // notice of a day the customer chose.
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_paid_through: days(-1).toISOString(),
        owner_deleted_at: NOW.toISOString(),
      }),
      site({
        id: "s2",
        user_id: "u2",
        hosted_serving_ends_at: NOW.toISOString(),
        hosting_end_notice_at: NOW.toISOString(),
        hosting_end_reminder_at: NOW.toISOString(),
        owner_deleted_at: NOW.toISOString(),
      })
    );
    expect(await hostingEndNoticesDue(NOW)).toEqual([]);
    expect(await sitesDueHostingStop(NOW)).toEqual([]);
  });
});

describe("REQ-076 c11 — the reminder falls due HOSTING_END_REMINDER_DAYS before the stop", () => {
  it("not due a day earlier, due on the day", async () => {
    const stopsOn = days(HOSTING_END_REMINDER_DAYS);
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_paid_through: days(-1).toISOString(),
        hosted_serving_ends_at: stopsOn.toISOString(),
        hosting_end_notice_at: days(-1).toISOString(),
      })
    );

    const early = await hostingEndNoticesDue(new Date(NOW.getTime() - DAY));
    expect(early).toEqual([]);

    const due = await hostingEndNoticesDue(NOW);
    expect(due).toEqual([{ siteId: "s1", which: "seven_days" }]);
  });

  it("is not due twice", async () => {
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_paid_through: days(-1).toISOString(),
        hosted_serving_ends_at: days(HOSTING_END_REMINDER_DAYS).toISOString(),
        hosting_end_notice_at: days(-1).toISOString(),
        hosting_end_reminder_at: NOW.toISOString(),
      })
    );
    expect(await hostingEndNoticesDue(NOW)).toEqual([]);
  });
});

describe("REQ-076 c10 — the stop, and the two stamps that gate it", () => {
  it("the window is HOSTED_RETENTION_DAYS after the paid-through date", async () => {
    const paidThrough = days(-1);
    const unstamped = site({
      id: "s1",
      user_id: "u1",
      owner_paid_through: paidThrough.toISOString(),
    });
    expect(hostedServingEndsAt(unstamped).getTime()).toBe(
      paidThrough.getTime() + HOSTED_RETENTION_DAYS * DAY
    );
  });

  it("a stamped window is read back, never recomputed", async () => {
    // The day the customer was told is the day that is enforced.
    const told = days(3);
    const stamped = site({
      id: "s1",
      user_id: "u1",
      owner_paid_through: days(-1).toISOString(),
      hosted_serving_ends_at: told.toISOString(),
    });
    expect(hostedServingEndsAt(stamped).getTime()).toBe(told.getTime());
  });

  it("due when the window has elapsed and both notices have gone", async () => {
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        owner_paid_through: days(-HOSTED_RETENTION_DAYS - 1).toISOString(),
        hosted_serving_ends_at: days(-1).toISOString(),
        hosting_end_notice_at: days(-30).toISOString(),
        hosting_end_reminder_at: days(-7).toISOString(),
      })
    );
    expect(await sitesDueHostingStop(NOW)).toEqual(["s1"]);
  });

  it("not due before the window elapses", async () => {
    state.sites.push(
      site({
        id: "s1",
        user_id: "u1",
        hosted_serving_ends_at: days(1).toISOString(),
        hosting_end_notice_at: days(-30).toISOString(),
        hosting_end_reminder_at: days(-7).toISOString(),
      })
    );
    expect(await sitesDueHostingStop(NOW)).toEqual([]);
  });

  it("a site missing EITHER stamp is never stopped, and is raised", async () => {
    // BP-060 decision 3, the discriminating case: a page going dark
    // unannounced is worse than a page served a day longer than promised.
    for (const missing of ["access_ended", "seven_days"] as const) {
      state = newMemoryBilling();
      setBillingStore(memoryBillingStore(state));
      state.sites.push(
        site({
          id: "s1",
          user_id: "u1",
          hosted_serving_ends_at: days(-1).toISOString(),
          hosting_end_notice_at:
            missing === "access_ended" ? null : days(-30).toISOString(),
          hosting_end_reminder_at:
            missing === "seven_days" ? null : days(-7).toISOString(),
        })
      );
      expect(await sitesDueHostingStop(NOW), missing).toEqual([]);
      expect(console.warn).toHaveBeenCalled();
      const logged = vi.mocked(console.warn).mock.calls.at(-1)?.[0] as string;
      expect(JSON.parse(logged).missingNotices, missing).toContain(missing);
    }
  });

  it("the tick's queue is site ids, deduplicated", async () => {
    // A site can be due both notices in one tick only if it were never
    // stamped; the tick hands over an id and the send re-derives which.
    state.sites.push(
      site({ id: "s1", user_id: "u1", owner_paid_through: days(-1).toISOString() })
    );
    expect(await sitesDueHostingEndNotice(NOW)).toEqual(["s1"]);
  });
});
