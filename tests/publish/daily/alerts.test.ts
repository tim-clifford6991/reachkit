// The owner is mailed about a site's day only when nothing of the site's is going out (O7): one mail a site an hour, a
// day a later page covered left to the Monday digest, and a stall told once until the next delivery.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reportIncident = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/mail/ops", () => ({ reportIncident }));
vi.mock("@/lib/db", () => ({
  dbAdmin: () => {
    throw new Error("alerts.test: the store double stands in for the database");
  },
}));

import { alertSiteDay, setDraftDayStore, untoldMisses, type DraftDayStore } from "@/lib/publish/daily";

// A SaaS site publishing 09:00 in Berlin (07:00 UTC in October) on a one-day window, and a local trade publishing 10:00
// in Sydney (23:00 UTC the day before) on a two-day window.
const SAAS = { siteId: "saas", timeZone: "Europe/Berlin", publishTime: "09:00", vetoHours: 24 };
const LOCAL = { siteId: "local", timeZone: "Australia/Sydney", publishTime: "10:00", vetoHours: 48 };
/** SAAS's due hour for the 16th, which is the hour the 15th publishes in. */
const HOUR_15 = new Date("2026-10-15T07:00:00Z");

const GOING_OUT = new Set(["in_review", "approved", "publishing", "published"]);

function memory(a: { drafts: { date: string; state: string }[]; delivered?: string }) {
  const days = new Map<string, { outcome: string | null; reason: string | null; missingAt: string | null; stallAt: string | null }>();
  const row = (date: string) => days.get(date) ?? { outcome: null, reason: null, missingAt: null, stallAt: null };
  const state = { delivered: a.delivered === undefined ? null : new Date(a.delivered) };
  const store: DraftDayStore = {
    record: async (day) => void days.set(day.publishDate, { ...row(day.publishDate), outcome: day.outcome, reason: day.reason }),
    statesOn: async (_id, date) => a.drafts.filter((draft) => draft.date === date).map((draft) => draft.state),
    goingOutFrom: async (_id, date) => a.drafts.some((draft) => draft.date >= date && GOING_OUT.has(draft.state)),
    draftedBefore: async (_id, date) => a.drafts.some((draft) => draft.date < date),
    reasonOn: async (_id, date) => {
      const day = days.get(date);
      if (day === undefined || day.outcome === null) return null;
      return day.reason === null ? day.outcome : `${day.outcome}:${day.reason}`;
    },
    decidedOn: async (asked) => asked.filter((day) => days.get(day.publishDate)?.outcome != null),
    domainOf: async (id) => `${id}.example`,
    // Check and set with no await between them, as the conditional update is one statement.
    claimMissingAlert: async (_id, date, at) => {
      if (row(date).missingAt !== null) return false;
      days.set(date, { ...row(date), missingAt: at.toISOString() });
      return true;
    },
    lastDeliveredAt: async () => state.delivered,
    claimStallAlert: async (_id, date, at) => {
      if (row(date).stallAt !== null) return false;
      days.set(date, { ...row(date), stallAt: at.toISOString() });
      return true;
    },
    untoldBetween: async (from, to) =>
      [...days]
        .filter(([date, day]) => date >= from && date <= to && day.outcome !== null && day.missingAt === null)
        .map(([date, day]) => ({ siteId: SAAS.siteId, publishDate: date, reason: day.reason === null ? day.outcome! : `${day.outcome}:${day.reason}` })),
    pagesBetween: async (from, to) =>
      a.drafts.filter((draft) => draft.date >= from && draft.date <= to).map((draft) => ({ siteId: SAAS.siteId, publishDate: draft.date, state: draft.state })),
  };
  return { store, state };
}

beforeEach(() => {
  reportIncident.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setDraftDayStore(null);
  vi.restoreAllMocks();
});

describe("a missed day is mailed only when nothing is going out", () => {
  it("a missed day with a later page going out is not mailed and is in the digest", async () => {
    const { store } = memory({ drafts: [{ date: "2026-10-14", state: "published" }, { date: "2026-10-16", state: "in_review" }] });
    setDraftDayStore(store);
    await store.record({ siteId: SAAS.siteId, publishDate: "2026-10-15", outcome: "no_page", reason: "generate:rules", at: new Date("2026-10-14T07:00:00Z") });

    expect(await alertSiteDay({ site: SAAS, hour: HOUR_15 })).toBe(0);
    expect(reportIncident).not.toHaveBeenCalled();
    expect(await untoldMisses({ from: "2026-10-12", to: "2026-10-18" })).toEqual([
      { siteId: SAAS.siteId, publishDate: "2026-10-15", reason: "no_page:generate:rules" },
    ]);
  });

  it("a missed day with nothing going out mails once, and is then not in the digest", async () => {
    const { store } = memory({ drafts: [{ date: "2026-10-14", state: "published" }, { date: "2026-10-16", state: "needs_attention" }] });
    setDraftDayStore(store);
    await store.record({ siteId: SAAS.siteId, publishDate: "2026-10-15", outcome: "no_page", reason: "generate:no_opportunity", at: new Date("2026-10-14T07:00:00Z") });

    expect(await alertSiteDay({ site: SAAS, hour: HOUR_15 })).toBe(1);
    expect(await alertSiteDay({ site: SAAS, hour: HOUR_15 })).toBe(0);
    expect(reportIncident.mock.calls).toEqual([
      [{ occasion: "no-draft-at-publish", domain: "saas.example", date: "2026-10-15", reason: "no_page:generate:no_opportunity" }],
    ]);
    expect(await untoldMisses({ from: "2026-10-12", to: "2026-10-18" })).toEqual([]);
  });

  it("a miss and a stall in one hour make one mail", async () => {
    setDraftDayStore(memory({ drafts: [{ date: "2026-10-12", state: "published" }], delivered: "2026-10-12T07:00:20Z" }).store);
    expect(await alertSiteDay({ site: SAAS, hour: HOUR_15 })).toBe(1);
    expect(reportIncident.mock.calls).toEqual([
      [{ occasion: "no-draft-at-publish", domain: "saas.example", date: "2026-10-15", reason: "not-recorded", stalled: { lastDelivered: "2026-10-12", days: 3 } }],
    ]);
  });

  it("checks the date publishing in the run's hour, in the site's own zone and window", async () => {
    // LOCAL's due hour for the 18th is 23:00 UTC on the 15th, the hour its 16th publishes in.
    setDraftDayStore(memory({ drafts: [{ date: "2026-10-15", state: "published" }, { date: "2026-10-17", state: "in_review" }] }).store);
    expect(await alertSiteDay({ site: LOCAL, hour: new Date("2026-10-15T23:00:00Z") })).toBe(0);
    setDraftDayStore(memory({ drafts: [{ date: "2026-10-15", state: "published" }] }).store);
    expect(await alertSiteDay({ site: LOCAL, hour: new Date("2026-10-15T23:00:00Z") })).toBe(1);
    expect(reportIncident).toHaveBeenLastCalledWith(expect.objectContaining({ domain: "local.example", date: "2026-10-16" }));
  });

  it("a store that fails costs the run nothing", async () => {
    const { store } = memory({ drafts: [{ date: "2026-10-14", state: "published" }] });
    setDraftDayStore({ ...store, goingOutFrom: () => Promise.reject(new Error("down")) });
    await expect(alertSiteDay({ site: SAAS, hour: HOUR_15 })).resolves.toBe(0);
    setDraftDayStore({ ...store, pagesBetween: () => Promise.reject(new Error("down")) });
    await expect(untoldMisses({ from: "2026-10-12", to: "2026-10-18" })).rejects.toThrow("down");
  });
});

describe("a stall is told once an episode", () => {
  // Each day skipped by the customer: accounted for, so no day's miss is mailed, and none delivered.
  const skippedFrom = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ date: `2026-10-${from + i}`, state: "skipped" }));
  const hourOf = (day: number) => new Date(`2026-10-${day}T07:00:00Z`);

  it("two calls in one hour give 1 mail", async () => {
    setDraftDayStore(memory({ drafts: skippedFrom(13, 20), delivered: "2026-10-12T07:00:20Z" }).store);
    expect([await alertSiteDay({ site: SAAS, hour: hourOf(14) }), await alertSiteDay({ site: SAAS, hour: hourOf(14) })]).toEqual([1, 0]);
    expect(reportIncident.mock.calls).toEqual([[{ occasion: "autopilot-stalled", domain: "saas.example", lastDelivered: "2026-10-12", days: 2 }]]);
  });

  it("day 2 and day 4 of one episode give 1 mail, and after a delivery a new episode mails again", async () => {
    const { store, state } = memory({ drafts: skippedFrom(13, 25), delivered: "2026-10-12T07:00:20Z" });
    setDraftDayStore(store);
    const told = [];
    for (const day of [13, 14, 15, 16]) told.push(await alertSiteDay({ site: SAAS, hour: hourOf(day) }));
    expect(told).toEqual([0, 1, 0, 0]);

    state.delivered = new Date("2026-10-18T07:00:20Z");
    for (const day of [19, 20, 22]) told.push(await alertSiteDay({ site: SAAS, hour: hourOf(day) }));
    expect(told).toEqual([0, 1, 0, 0, 0, 1, 0]);
    expect(reportIncident).toHaveBeenLastCalledWith({ occasion: "autopilot-stalled", domain: "saas.example", lastDelivered: "2026-10-18", days: 2 });
  });

  it("a stall with a page going out is not told", async () => {
    setDraftDayStore(memory({ drafts: [...skippedFrom(13, 14), { date: "2026-10-15", state: "approved" }], delivered: "2026-10-12T07:00:20Z" }).store);
    expect(await alertSiteDay({ site: SAAS, hour: hourOf(14) })).toBe(0);
  });

  it("two concurrent claims give 1 mail", async () => {
    // Two first imports of a mocked module in flight together can load the real one; load the double first.
    await import("@/lib/mail/ops");
    setDraftDayStore(memory({ drafts: skippedFrom(13, 20), delivered: "2026-10-12T07:00:20Z" }).store);
    const told = await Promise.all([alertSiteDay({ site: SAAS, hour: hourOf(15) }), alertSiteDay({ site: SAAS, hour: hourOf(15) })]);
    expect(told.sort()).toEqual([0, 1]);
    expect(reportIncident).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });
});
