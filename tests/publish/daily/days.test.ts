// tests/publish/daily/days.test.ts — issue 1455
//
// A paying site's publish time that passes with no page for the day is
// told to the owner, once a date, with the reason the due hour kept. The
// days a customer acted on, and a site's first day, are not told.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reportIncident = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mail/ops", () => ({ reportIncident }));
vi.mock("@/lib/db", () => ({
  dbAdmin: () => {
    throw new Error("days.test: the store double stands in for the database");
  },
}));

import { alertMissingDrafts, recordDraftDay, setDraftDayStore, type DraftDayStore } from "@/lib/publish/daily";

// reachkit.app: 09:00 in Berlin is 07:00 UTC in October.
const SITE = { siteId: "site-1", timeZone: "Europe/Berlin", publishTime: "09:00", vetoHours: 24 };
const PUBLISH_HOUR = new Date("2026-10-15T07:00:00Z");

interface Day {
  outcome: string | null;
  reason: string | null;
  alertedAt: string | null;
}

function memory(drafts: { date: string; state: string }[]) {
  const days = new Map<string, Day>();
  const store: DraftDayStore = {
    async record(a) {
      const day = days.get(a.publishDate) ?? { outcome: null, reason: null, alertedAt: null };
      days.set(a.publishDate, { ...day, outcome: a.outcome, reason: a.reason });
    },
    async statesOn(_siteId, date) {
      return drafts.filter((draft) => draft.date === date).map((draft) => draft.state);
    },
    async draftedBefore(_siteId, date) {
      return drafts.some((draft) => draft.date < date);
    },
    async reasonOn(_siteId, date) {
      const day = days.get(date);
      if (day === undefined || day.outcome === null) return null;
      return day.reason === null ? day.outcome : `${day.outcome}:${day.reason}`;
    },
    async decidedOn(asked) {
      return asked.filter((day) => days.get(day.publishDate)?.outcome != null);
    },
    async domainOf() {
      return "reachkit.app";
    },
    async claimMissingAlert(_siteId, date, at) {
      const day = days.get(date) ?? { outcome: null, reason: null, alertedAt: null };
      if (day.alertedAt !== null) return false;
      days.set(date, { ...day, alertedAt: at.toISOString() });
      return true;
    },
  };
  return { store, days };
}

beforeEach(() => {
  reportIncident.mockReset();
  reportIncident.mockResolvedValue(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setDraftDayStore(null);
  vi.restoreAllMocks();
});

describe("the publish time is checked, and a day with no page is told (issue 1455)", () => {
  it("15 October: the due hour kept no_opportunity, and the owner is told once with it", async () => {
    const { store } = memory([{ date: "2026-10-14", state: "published" }]);
    setDraftDayStore(store);
    await recordDraftDay({ siteId: "site-1", publishDate: "2026-10-15", outcome: "no_page", reason: "generate:no_opportunity", at: new Date("2026-10-14T07:00:00Z") });

    expect(await alertMissingDrafts({ sites: [SITE], hour: PUBLISH_HOUR })).toBe(1);
    expect(reportIncident).toHaveBeenCalledWith({
      occasion: "no-draft-at-publish",
      domain: "reachkit.app",
      date: "2026-10-15",
      reason: "no_page:generate:no_opportunity",
    });
    // A second delivery of the same hour tells nobody again.
    expect(await alertMissingDrafts({ sites: [SITE], hour: PUBLISH_HOUR })).toBe(0);
    expect(reportIncident).toHaveBeenCalledTimes(1);
  });

  it("is asked only in the hour the site's publish time falls in", async () => {
    setDraftDayStore(memory([{ date: "2026-10-14", state: "published" }]).store);
    expect(await alertMissingDrafts({ sites: [SITE], hour: new Date("2026-10-15T06:00:00Z") })).toBe(0);
    expect(await alertMissingDrafts({ sites: [SITE], hour: new Date("2026-10-15T08:00:00Z") })).toBe(0);
    expect(reportIncident).not.toHaveBeenCalled();
  });

  it.each([
    ["a page going out", "in_review"],
    ["a page already live", "published"],
    ["a page the customer stopped", "skipped"],
  ])("a day with %s is not told", async (_label, state) => {
    setDraftDayStore(memory([{ date: "2026-10-14", state: "published" }, { date: "2026-10-15", state }]).store);
    expect(await alertMissingDrafts({ sites: [SITE], hour: PUBLISH_HOUR })).toBe(0);
  });

  it("a page the checks stopped is told: it is not going out", async () => {
    setDraftDayStore(memory([{ date: "2026-10-14", state: "published" }, { date: "2026-10-15", state: "needs_attention" }]).store);
    expect(await alertMissingDrafts({ sites: [SITE], hour: PUBLISH_HOUR })).toBe(1);
    expect(reportIncident.mock.calls[0]?.[0]).toMatchObject({ reason: "state:needs_attention" });
  });

  it("a site's first day, before any page is dated, is not told", async () => {
    setDraftDayStore(memory([]).store);
    expect(await alertMissingDrafts({ sites: [SITE], hour: PUBLISH_HOUR })).toBe(0);
  });

  it("a store that fails costs the tick nothing", async () => {
    const { store } = memory([{ date: "2026-10-14", state: "published" }]);
    setDraftDayStore({ ...store, statesOn: () => Promise.reject(new Error("down")), record: () => Promise.reject(new Error("down")) });
    await expect(recordDraftDay({ siteId: "site-1", publishDate: "2026-10-15", outcome: "failed", reason: "TypeError", at: PUBLISH_HOUR })).resolves.toBeUndefined();
    await expect(alertMissingDrafts({ sites: [SITE], hour: PUBLISH_HOUR })).resolves.toBe(0);
  });
});
