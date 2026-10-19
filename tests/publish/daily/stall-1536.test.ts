// Issue 1536: a site on autopilot that has gone twice its cadence with no
// page delivered is told, on that day and each such span after it.
import { describe, expect, it, vi } from "vitest";

const reportIncident = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/mail/ops", () => ({ reportIncident }));
vi.mock("@/lib/db", () => ({ dbAdmin: () => ({}) }));
import { alertStalledSites, setDraftDayStore, type DraftDayStore } from "@/lib/publish/daily";

// 09:00 in Berlin is 07:00 UTC in October; 10:00 in Sydney is 23:00 UTC the day before.
const BERLIN = { siteId: "s1", timeZone: "Europe/Berlin", publishTime: "09:00", vetoHours: 24 };
const SYDNEY = { siteId: "s2", timeZone: "Australia/Sydney", publishTime: "10:00", vetoHours: 24 };
const store = (delivered: Record<string, string>, going: string[] = []): DraftDayStore => ({
  record: async () => {},
  statesOn: async (_id, date) => (going.includes(date) ? ["publishing"] : []),
  draftedBefore: async () => true,
  reasonOn: async () => null,
  decidedOn: async () => [],
  domainOf: async (id) => `${id}.example`,
  claimMissingAlert: async () => true,
  lastDeliveredAt: async (id) => (delivered[id] === undefined ? null : new Date(delivered[id])),
});
const tell = (sites: (typeof BERLIN)[], hour: string) => alertStalledSites({ sites, hour: new Date(hour) });

describe("issue 1536: a site on autopilot that stops delivering is told", () => {
  it("on its second and fourth day without a page, in its own zone, never for a site that never delivered or a day going out", async () => {
    setDraftDayStore(store({ s1: "2026-10-14T07:00:16Z" }, ["2026-10-20"]));
    const told = [];
    for (const day of [15, 16, 17, 18, 19, 20]) told.push(await tell([BERLIN, SYDNEY], `2026-10-${day}T07:00:00Z`));
    expect(told).toEqual([0, 1, 0, 1, 0, 0]);
    expect(reportIncident).toHaveBeenLastCalledWith({ occasion: "autopilot-stalled", domain: "s1.example", lastDelivered: "2026-10-14", days: 4 });
    // Delivered at 10:00 on the 15th in Sydney, which is 23:00 UTC on the 14th.
    setDraftDayStore(store({ s2: "2026-10-14T23:00:30Z" }));
    expect([await tell([SYDNEY], "2026-10-16T23:00:00Z"), await tell([SYDNEY], "2026-10-16T12:00:00Z")]).toEqual([1, 0]);
    expect(reportIncident).toHaveBeenLastCalledWith({ occasion: "autopilot-stalled", domain: "s2.example", lastDelivered: "2026-10-15", days: 2 });
    setDraftDayStore(null);
  });
});
