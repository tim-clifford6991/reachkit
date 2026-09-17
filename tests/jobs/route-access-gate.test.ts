// tests/jobs/route-access-gate.test.ts — issue 863
//
// The access gate as the jobs route's own module graph reaches it.
//
// Production held every hourly `draft/generate` tick `access-unreadable`
// for a paying site: `src/instrumentation.ts` registered billing's gate
// into the copy of `src/lib/scan/weekly/access.ts` in *its* bundle, and the
// `/api/jobs` route bundle read another copy that nothing had registered.
// The boot probe asked instrumentation's copy and passed.
//
// So these tests never call `register()`. Each loads the real route handler
// in a fresh module graph and delivers one tick to it the way the platform
// does — a POST naming the function — and asserts the selection answered.
// On a graph where nothing registers the gate lazily, the daily tick holds
// and the weekly tick throws, which is what these fail on.
//
// Doubled: Postgres (the §9 harness's PostgREST double, which embeds the
// `sites → users.paid_through` read billing's gate makes), the platform's
// signature check (the SDK's own dev mode), and — weekly only — the two
// edges past the selection that spend or mail: the measurement pass and the
// digest. The selection, billing's gate and `hasActiveAccess()` are real.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";
import { fakeDb, type Row } from "../publish/harness";

const db = fakeDb();

const PAYING = "site-paying";
const LAPSED = "site-lapsed";
const ZONE = "America/New_York";

function site(id: string): Row {
  return { id, user_id: `user-${id}`, domain: `${id}.example`, publishing_enabled: true, timezone: ZONE };
}

/** One owner paid through a month from now, one whose month ended. */
function seedOwners(): void {
  db.seed("sites", [site(PAYING), site(LAPSED)]);
  db.seed("users", [
    { id: `user-${PAYING}`, paid_through: "2026-10-17T00:00:00.000Z" },
    { id: `user-${LAPSED}`, paid_through: "2026-08-17T00:00:00.000Z" },
  ]);
}

let logged: string[] = [];
const weeklyRuns: string[] = [];

async function loadRoute() {
  stubEnv(false);
  vi.stubEnv("INNGEST_DEV", "1");
  vi.doMock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
  vi.doMock("@/lib/scan/weekly/run", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/scan/weekly/run")>()),
    runWeekly: async (a: { siteId: string }) => {
      weeklyRuns.push(a.siteId);
      return { ran: false, reason: "already_measured" };
    },
  }));
  vi.doMock("@/lib/mail/weekly", () => ({
    sendWeeklyDigest: async () => ({ sent: false, reason: "not-measured" }),
  }));
  const route = await import("@/app/api/jobs/[[...slug]]/route");
  return { route };
}

/** One delivery of a scheduled function, as the platform sends it. */
function tick(fnSlug: string): NextRequest {
  const body = {
    version: 1,
    event: { name: "inngest/scheduled.timer", data: {}, ts: Date.now() },
    events: [],
    steps: {},
    ctx: {
      run_id: `run-${fnSlug}`,
      attempt: 0,
      disable_immediate_execution: false,
      use_api: false,
      stack: { stack: [], current: 0 },
    },
  };
  return new NextRequest(`https://app.example.com/api/jobs?fnId=reachkit-${fnSlug}&stepId=step`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function lines(event: string): Record<string, unknown>[] {
  return logged
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((line): line is Record<string, unknown> => line !== null && line.event === event);
}

beforeEach(() => {
  db.reset();
  logged = [];
  weeklyRuns.length = 0;
  vi.spyOn(console, "log").mockImplementation((line: unknown) => void logged.push(String(line)));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation((line: unknown) => void logged.push(String(line)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("@/lib/db");
  vi.doUnmock("@/lib/scan/weekly/run");
  vi.doUnmock("@/lib/mail/weekly");
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("issue 863 — /api/jobs answers who is paying without instrumentation's register()", () => {
  it("draft/generate selects the paying site and is not held access-unreadable", async () => {
    // 15:00 in New York: not the evening hour, so no page is written and
    // the tick ends at the selection.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-17T19:00:00.000Z"));
    seedOwners();
    db.seed("destinations", [
      { id: "dest-1", site_id: PAYING, kind: "hosted", health: "ok", deleted_at: null },
      { id: "dest-2", site_id: LAPSED, kind: "hosted", health: "ok", deleted_at: null },
    ]);

    const { route } = await loadRoute();
    const response = await route.POST(tick("draft-generate"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);

    expect(lines("daily_site_selection")).toEqual([
      { event: "daily_site_selection", sites: 2, withDestination: 2, paying: 1 },
    ]);
    const job = lines("job").find((line) => line.jobId === "draft/generate");
    expect(job?.outcome).not.toBe("degraded");
    expect(JSON.stringify(logged)).not.toContain("access-unreadable");
  });

  it("weekly/refresh selects the paying site and starts its pass alone", async () => {
    // Monday 06:00 in New York — the site's own weekly due hour.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T10:00:00.000Z"));
    seedOwners();
    db.seed("scans", []);

    const { route } = await loadRoute();
    const response = await route.POST(tick("weekly-refresh"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);

    expect(lines("weekly_due_selection")).toEqual([{ event: "weekly_due_selection", candidates: 2, due: 1 }]);
    expect(weeklyRuns).toEqual([PAYING]);
    expect(JSON.stringify(logged)).not.toContain("ActiveAccessGateNotRegistered");
  });
});

describe("issue 863 — the ports instrumentation registers are seen by another module graph", () => {
  it("the spend alert sink registered in one graph is told from a fresh one", async () => {
    stubEnv(false);
    const boot = await import("@/lib/costs/daily");
    const told: string[] = [];
    boot.registerSpendAlertSink((alert) => void told.push(alert.crossed));

    vi.resetModules();
    const route = await import("@/lib/costs/daily");
    expect(route).not.toBe(boot);
    route.publishSpendAlert({ crossed: "warn", spentCents: 1, ceilingCents: 2 });
    expect(told).toEqual(["warn"]);

    route.registerSpendAlertSink(null);
    boot.publishSpendAlert({ crossed: "ceiling", spentCents: 2, ceilingCents: 2 });
    expect(told).toEqual(["warn"]);
  });

  it("the WordPress place port registered in one graph answers in a fresh one", async () => {
    stubEnv(false);
    const boot = await import("@/lib/account/lifecycle/left-in-wordpress");
    const place = { siteBaseUrl: "https://blog.example", stampSlug: "reachkit" };
    boot.setStampCapability({ place: async () => place });

    vi.resetModules();
    const route = await import("@/lib/account/lifecycle/left-in-wordpress");
    expect(route).not.toBe(boot);
    await expect(route.stampCapability().place("dest-1")).resolves.toEqual(place);

    route.setStampCapability(null);
    await expect(boot.stampCapability().place("dest-1")).resolves.toBeNull();
  });
});
