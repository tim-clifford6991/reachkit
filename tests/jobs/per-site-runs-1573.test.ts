// tests/jobs/per-site-runs-1573.test.ts — the draft and weekly ticks select
// and send; each site is a keyed run of its own, its stages durable steps.
// Through the real ticks, the real engine seam and the real draft-day
// record; doubled at the access gate, the site list, the day's page and the
// review edge.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";
import type { SubjectEvent } from "@/jobs/types";

applyEnvFixture();

type Site = { siteId: string; timeZone: string; publishTime: string; vetoHours: number };
const doubles = vi.hoisted(() => ({
  sites: [] as Site[],
  weeklyDue: [] as { siteId: string; domain: string; zone: string; weekStart: string }[],
  decideDayPage: vi.fn(),
  generateDayPage: vi.fn(),
  recheckStopped: vi.fn(),
}));
vi.mock("@/lib/account/billing", () => ({ ensureActiveAccessGate: async () => {} }));
vi.mock("@/lib/publish/daily", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sitesForDailyTick: async () => ({ sites: doubles.sites, held: null }),
}));
vi.mock("@/lib/scan/weekly", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  dueSites: async () => doubles.weeklyDue,
}));
vi.mock("@/lib/generate", () => ({
  decideDayPage: doubles.decideDayPage,
  generateDayPage: doubles.generateDayPage,
  restartedDrafts: async () => [],
}));
vi.mock("@/lib/generate/recheck", () => ({ recheckStopped: doubles.recheckStopped }));
vi.mock("@/lib/publish/destinations/health", () => ({ sendBreakageMail: async () => ({ sent: false }) }));
vi.mock("@/lib/publish/attempt/window", () => ({ enterReview: async () => ({ kind: "untold", reason: "test" }) }));

const { draftGenerate } = await import("@/jobs/draft-generate");
const { weeklyRefresh } = await import("@/jobs/weekly-refresh");
const { setDraftDayStore } = await import("@/lib/publish/daily");
const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");

/** Days recorded, keyed `site/date`. */
let recorded: Map<string, string>;
/** Whether the site holds a page dated before the day asked about. */
let draftedBefore: boolean;
/** Each date's page state, keyed `YYYY-MM-DD`. */
let pages: Map<string, string>;
/** The dates the owner was told had no page. */
let told: Set<string>;
/** Mails the vendor accepted. */
let mails: unknown[];

/** What the platform does with a sent event: one with an id it has seen is
 *  dropped. */
function platform() {
  const ids = new Set<string>();
  const accepted: SubjectEvent[] = [];
  return {
    accepted,
    send: async (events: readonly SubjectEvent[]) => {
      for (const event of events) {
        if (ids.has(event.key)) continue;
        ids.add(event.key);
        accepted.push(event);
      }
    },
  };
}

beforeEach(() => {
  recorded = new Map();
  draftedBefore = true;
  pages = new Map();
  told = new Set();
  mails = [];
  __setVendorTransportForTesting(async (payload) => {
    mails.push(JSON.parse(payload));
    return { status: 200, headers: {}, body: JSON.stringify({ id: `vendor-${mails.length}` }) };
  });
  doubles.recheckStopped.mockReset().mockResolvedValue(null);
  doubles.sites = [];
  doubles.weeklyDue = [];
  doubles.decideDayPage.mockReset().mockResolvedValue({ ok: true, opportunityId: "o1" });
  doubles.generateDayPage.mockReset().mockResolvedValue({ ok: true, draftId: "d1" });
  setDraftDayStore({
    record: async (a) => void recorded.set(`${a.siteId}/${a.publishDate}`, a.outcome),
    statesOn: async (_id, date) => (pages.has(date) ? [pages.get(date)!] : []),
    goingOutFrom: async (_id, date) => [...pages].some(([day, state]) => day >= date && state === "in_review"),
    draftedBefore: async () => draftedBefore,
    reasonOn: async () => null,
    decidedOn: async (days) => days.filter((day) => recorded.has(`${day.siteId}/${day.publishDate}`)),
    domainOf: async () => "example.com",
    claimMissingAlert: async (_id, date) => !told.has(date) && Boolean(told.add(date)),
    untoldBetween: async () => [],
    pagesBetween: async () => [],
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  setDraftDayStore(null);
  __setVendorTransportForTesting(null);
  vi.restoreAllMocks();
});

const EVENING = new Date("2026-09-07T18:00:00.000Z");
const CLOCK = { timeZone: "UTC", publishTime: "18:00", vetoHours: 24 };

describe("draft/generate — the owner is told after the site's run, and only when nothing is going out", () => {
  // The evening's due hour drafts the 8th and is the hour the 7th publishes in; the 7th has no page.
  const run = () =>
    draftGenerate.perSubject!({
      data: { key: "draft:site-1:2026-09-08", ...CLOCK, siteId: "site-1", publishDate: "2026-09-08", hour: EVENING.toISOString() },
      now: new Date(EVENING.getTime() + 60_000),
    });

  it("a rescued page silences the stall alert", async () => {
    doubles.recheckStopped.mockImplementation(async () => {
      pages.set("2026-09-08", "in_review");
      return "d-rescued";
    });
    doubles.decideDayPage.mockResolvedValue({ ok: false, because: "already_drafted" });
    await run();
    expect(doubles.recheckStopped).toHaveBeenCalledOnce();
    expect(mails).toEqual([]);
  });

  it("a run whose recheck rescues nothing and that leaves no page going out sends 1 mail", async () => {
    doubles.decideDayPage.mockResolvedValue({ ok: false, because: "no_opportunity" });
    await run();
    await run();
    expect(mails).toHaveLength(1);
  });

  it("the tick itself mails nobody: a site with no due hour is checked by the run its missed day sends", async () => {
    doubles.sites = [{ siteId: "site-1", ...CLOCK }];
    const queue = platform();
    await draftGenerate.run({ data: {}, now: new Date("2026-09-07T20:00:00.000Z"), send: queue.send });
    expect(mails).toEqual([]);
    expect(queue.accepted.map((event) => event.data)).toEqual([{ siteId: "site-1", publishDate: "2026-09-08", hour: EVENING.toISOString(), ...CLOCK }]);
  });
});

describe("draft/generate — the tick sends one keyed event per due site", () => {
  it("a tick with 25 due sites sends 25 keyed events, and writes no page itself; a re-delivery sends 0 new", async () => {
    doubles.sites = Array.from({ length: 25 }, (_, i) => ({ siteId: `site-${i}`, timeZone: "UTC", publishTime: "18:00", vetoHours: 24 }));
    const queue = platform();

    await draftGenerate.run({ data: {}, now: EVENING, send: queue.send });
    expect(queue.accepted.map((event) => event.key)).toEqual(doubles.sites.map((site) => `draft:${site.siteId}:2026-09-08`));
    expect(queue.accepted[0]!.data).toEqual({ siteId: "site-0", publishDate: "2026-09-08", hour: EVENING.toISOString(), timeZone: "UTC", publishTime: "18:00", vetoHours: 24 });
    expect(doubles.generateDayPage).not.toHaveBeenCalled();

    await draftGenerate.run({ data: {}, now: new Date(EVENING.getTime() + 40_000), send: queue.send });
    expect(queue.accepted).toHaveLength(25);
  });

  it("a site's run is its stages as steps — notice, hold, recheck, select, write, review, alert — and records the day", async () => {
    const steps: string[] = [];
    const outcome = await draftGenerate.perSubject!({
      data: { key: "draft:site-1:2026-09-08", ...CLOCK, siteId: "site-1", publishDate: "2026-09-08", hour: EVENING.toISOString() },
      now: new Date(EVENING.getTime() + 600_000),
      step: async (name, body) => {
        steps.push(name);
        return JSON.parse(JSON.stringify((await body()) ?? null));
      },
    });
    expect(steps).toEqual(["notice", "hold", "recheck", "select", "write", "review", "alert"]);
    expect(doubles.generateDayPage).toHaveBeenCalledWith({ siteId: "site-1", publishDate: "2026-09-08", now: EVENING, opportunityId: "o1" });
    expect(outcome).toEqual({ outcome: "degraded", subjectId: "site-1", step: "draft-ready:test" });
    expect(recorded.get("site-1/2026-09-08")).toBe("no_page");
  });
});

describe("draft/generate — a missed draft hour is caught on the next tick, inside its window", () => {
  const MORNING_SITE = { siteId: "site-9", timeZone: "UTC", publishTime: "09:00", vetoHours: 24 };
  const TEN = new Date("2026-10-19T10:00:00.000Z");

  it("a site due at 09:00 with no day recorded, and the tick at 10:00, is one event, its window counted from 09:00", async () => {
    doubles.sites = [MORNING_SITE];
    const queue = platform();
    await draftGenerate.run({ data: {}, now: TEN, send: queue.send });
    expect(queue.accepted).toEqual([
      {
        key: "draft:site-9:2026-10-20",
        data: { siteId: "site-9", publishDate: "2026-10-20", hour: "2026-10-19T09:00:00.000Z", timeZone: "UTC", publishTime: "09:00", vetoHours: 24 },
      },
    ]);
  });

  it("a site's first day, with no page dated before it, was not owed and is not caught", async () => {
    doubles.sites = [MORNING_SITE];
    draftedBefore = false;
    const queue = platform();
    await draftGenerate.run({ data: {}, now: TEN, send: queue.send });
    expect(queue.accepted).toEqual([]);
  });

  it("a day its due hour recorded is not sent again", async () => {
    doubles.sites = [MORNING_SITE];
    recorded.set("site-9/2026-10-20", "drafted");
    const queue = platform();
    await draftGenerate.run({ data: {}, now: TEN, send: queue.send });
    expect(queue.accepted).toEqual([]);
  });
});

describe("weekly/refresh — the tick sends one keyed event per due site", () => {
  it("each due site is an event keyed by its week; a re-delivery sends 0 new", async () => {
    doubles.weeklyDue = ["a", "b", "c"].map((id) => ({ siteId: `site-${id}`, domain: `${id}.example.com`, zone: "UTC", weekStart: "2026-09-07" }));
    const queue = platform();
    const monday = new Date("2026-09-07T06:00:00.000Z");
    await weeklyRefresh.run({ data: {}, now: monday, send: queue.send });
    await weeklyRefresh.run({ data: {}, now: monday, send: queue.send });
    expect(queue.accepted.map((event) => event.key)).toEqual(["weekly:site-a:2026-09-07", "weekly:site-b:2026-09-07", "weekly:site-c:2026-09-07"]);
    expect(queue.accepted[0]!.data).toEqual({ ...doubles.weeklyDue[0], at: monday.toISOString() });
  });

  it("a released week's retry tick sends the first pass's event id, so the platform drops it inside its window", async () => {
    const { subjectEvents } = await import("@/jobs/client");
    doubles.weeklyDue = [{ siteId: "site-a", domain: "a.example.com", zone: "UTC", weekStart: "2026-09-07" }];
    const sent: SubjectEvent[][] = [];
    const record = async (events: readonly SubjectEvent[]) => void sent.push([...events]);
    await weeklyRefresh.run({ data: {}, now: new Date("2026-09-07T06:00:00.000Z"), send: record });
    await weeklyRefresh.run({ data: {}, now: new Date("2026-09-07T07:00:00.000Z"), send: record });
    const [first, retry] = sent.map((events) => subjectEvents("weekly/refresh", events).map((event) => event.id));
    expect(first).toEqual(["weekly:site-a:2026-09-07"]);
    expect(retry).toEqual(first);
  });
});
