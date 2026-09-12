// tests/jobs/weekly-judge.test.ts — the Monday tick's second obligation
// (issue #576): §6's "a verdict on every page published so far".
//
// The discriminating pair: a measured week leaves rows behind it *before*
// the digest reads them — a digest composed from an unjudged week reports
// nothing moved — and a failed pass, which stored no report, judges
// nothing at all rather than writing a week of blanks.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DOMAIN, SITE_ID, WEEK, fakeStore, releaseStore, type Fake } from "../opportunities/verdicts/harness";
import type { DigestPage } from "@/lib/opportunities/verdicts";

const weekly = vi.hoisted(() => ({
  outcome: { ran: true, scanId: "scan-1", status: "done" } as unknown,
}));
vi.mock("@/lib/scan/weekly", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scan/weekly")>();
  return { ...actual, runWeekly: async () => weekly.outcome };
});

// The digest, reading what this tick wrote through its own reader. The
// mail itself is `tests/jobs/weekly-digest.test.ts`'s subject; what is
// under test here is what the digest finds on disk when it is called.
const digest = vi.hoisted(() => ({ read: [] as DigestPage[] }));
vi.mock("@/lib/mail/weekly", () => ({
  sendWeeklyDigest: async (a: { siteId: string; weekStart: string }) => {
    const { weeklyDigest } = await import("@/lib/opportunities");
    digest.read = [...(await weeklyDigest({ siteId: a.siteId, week: a.weekStart })).standings];
    return { sent: true, id: "vendor-1" };
  },
}));

const { startWeeklyScan } = await import("@/jobs/engine");

const NOW = new Date(Date.UTC(2026, 7, 31, 10, 0, 0));
const tick = () =>
  startWeeklyScan({ siteId: SITE_ID, domain: DOMAIN, zone: "UTC", weekStart: WEEK, now: NOW });

let store: Fake;
beforeEach(() => {
  releaseStore();
  weekly.outcome = { ran: true, scanId: "scan-1", status: "done" };
  digest.read = [];
  store = fakeStore({});
});

describe("the Monday tick judges the week it measured", () => {
  it("one published page and one measured week leave one verdict, and the digest names it", async () => {
    expect(await tick()).toEqual({ done: true });

    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]!.week).toBe(WEEK);
    expect(digest.read.map((page) => page.publicationId)).toEqual(["pub-1"]);
    expect(digest.read[0]!.standing.kind).toBe("verdict");
  });

  it("a degraded week is judged too — a partly measured week is a measured one", async () => {
    weekly.outcome = { ran: true, scanId: "scan-1", status: "degraded", unmeasured: ["rivals"] };
    await tick();
    expect(store.rows).toHaveLength(1);
  });

  it("**a failed pass judges nothing** — there is no report to judge against", async () => {
    weekly.outcome = { ran: true, scanId: "scan-1", status: "failed" };
    await tick();
    expect(store.inserted).toEqual([]);
  });

  it("**a re-delivered tick writes no second verdict** — the key is (publication, week)", async () => {
    await tick();
    await tick();
    expect(store.rows).toHaveLength(1);
  });
});
